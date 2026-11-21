import type { PromptExecutionResult } from '../prompts/types.ts';
import {
  ClassifiedAiError,
  isClassifiedAiError,
  parsePromptExecutionResponse,
} from './promptResponseParser.ts';

export const DEFAULT_AI_CLIENT_TIMEOUT_MS = 65_000;
export const DEFAULT_API_CLIENT_TIMEOUT_MS = 30_000;
export const DEFAULT_AI_CLIENT_RETRY_DELAY_MS = 1_500;
export const DEFAULT_GET_CLIENT_RETRY_DELAY_MS = 800;

export type FetchLike = (
  input: string,
  init?: RequestInit,
) => Promise<{
  ok: boolean;
  status: number;
  headers: { get(name: string): string | null };
  text(): Promise<string>;
}>;

export class UserCancelledRequestError extends ClassifiedAiError {
  constructor() {
    super('Request was cancelled before completion.', 'request_cancelled');
    this.name = 'UserCancelledRequestError';
  }
}

export function isUserCancelledError(err: unknown): boolean {
  return (
    err instanceof UserCancelledRequestError ||
    (isClassifiedAiError(err) && err.errorCategory === 'request_cancelled')
  );
}

export function isAbortError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  if (isUserCancelledError(err)) return false;
  return err.name === 'AbortError' || /aborted|timed?\s*out/i.test(err.message);
}

export function isTransientNetworkError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  if (isAbortError(err) || isUserCancelledError(err)) return false;
  return (
    err.name === 'TypeError' ||
    /failed to fetch|load failed|networkerror|network request failed|fetch failed|econnreset|socket/i.test(
      err.message,
    )
  );
}

export function isTransientHttpStatus(status: number): boolean {
  return status === 502 || status === 503 || status === 504;
}

function looksLikeHtmlBody(contentType: string | null, bodyText: string): boolean {
  if (contentType && /text\/html/i.test(contentType)) return true;
  return /^<!doctype\s+html|^<html\b/i.test(bodyText.trimStart());
}

function hasRetryableGatewayUpstreamStatus(status: number, bodyText: string): boolean {
  if (status !== 500) return false;
  try {
    const parsed: unknown = bodyText.trim() ? JSON.parse(bodyText) : null;
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
      const upstream = (parsed as { upstreamStatus?: unknown }).upstreamStatus;
      return upstream === 502 || upstream === 503 || upstream === 504;
    }
  } catch {
    return false;
  }
  return false;
}

export function formatFriendlyNetworkError(
  err: unknown,
  context: 'ai' | 'api',
): Error {
  if (isUserCancelledError(err)) {
    return err as Error;
  }
  if (isClassifiedAiError(err)) {
    return err;
  }
  if (isAbortError(err)) {
    return new ClassifiedAiError(
      context === 'ai'
        ? 'AI generation timed out before a response arrived. Please try again.'
        : 'The request timed out before the server responded. Please try again.',
      'request_timeout',
    );
  }
  if (isTransientNetworkError(err)) {
    return new ClassifiedAiError(
      context === 'ai'
        ? 'Connection to the AI service was interrupted before a response arrived. Please check your connection and try again.'
        : 'Unable to reach the server. Please check your connection and try again.',
      'network_failure',
    );
  }
  return err instanceof Error
    ? err
    : new ClassifiedAiError(
        context === 'ai'
          ? 'Unable to complete AI generation. Please try again.'
          : 'Request failed. Please try again.',
        context === 'ai' ? 'provider_unavailable' : 'network_failure',
      );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function fetchWithTimeout(
  fetchImpl: FetchLike,
  url: string,
  init: RequestInit,
  timeoutMs: number,
) {
  const controller = new AbortController();
  const existingSignal = init.signal;
  let cancelledByCaller = false;

  const onExternalAbort = () => {
    cancelledByCaller = true;
    controller.abort();
  };
  if (existingSignal) {
    if (existingSignal.aborted) {
      throw new UserCancelledRequestError();
    }
    existingSignal.addEventListener('abort', onExternalAbort, { once: true });
  }

  const timer = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    return await fetchImpl(url, {
      ...init,
      signal: controller.signal,
    });
  } catch (err) {
    if (cancelledByCaller || existingSignal?.aborted) {
      throw new UserCancelledRequestError();
    }
    throw err;
  } finally {
    clearTimeout(timer);
    if (existingSignal) {
      existingSignal.removeEventListener('abort', onExternalAbort);
    }
  }
}

export interface ResilientPromptFetchOptions {
  url: string;
  init: RequestInit;
  fetchImpl?: FetchLike;
  timeoutMs?: number;
  maxRetries?: number;
  retryDelayMs?: number;
}

/**
 * Executes a prompt-execution POST with a bounded client timeout, automatic
 * single retry on transient connection drops (`Failed to fetch`), gateway
 * warmup HTML responses, or transient 502/503/504 overload statuses, and
 * structured error classification. Distinguishes user cancellation from timeout.
 */
export async function fetchPromptExecutionWithResilience(
  options: ResilientPromptFetchOptions,
): Promise<PromptExecutionResult> {
  const fetchImpl: FetchLike = options.fetchImpl ?? (globalThis.fetch as FetchLike);
  const timeoutMs = options.timeoutMs ?? DEFAULT_AI_CLIENT_TIMEOUT_MS;
  const maxRetries = Math.max(0, options.maxRetries ?? 1);
  const retryDelayMs = Math.max(0, options.retryDelayMs ?? DEFAULT_AI_CLIENT_RETRY_DELAY_MS);
  const maxAttempts = maxRetries + 1;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await fetchWithTimeout(fetchImpl, options.url, options.init, timeoutMs);
      const bodyText = await response.text();
      const contentType = response.headers.get('content-type');

      const shouldRetryResponse =
        attempt < maxAttempts &&
        (isTransientHttpStatus(response.status) ||
          looksLikeHtmlBody(contentType, bodyText) ||
          hasRetryableGatewayUpstreamStatus(response.status, bodyText));

      if (shouldRetryResponse) {
        if (retryDelayMs > 0) {
          await sleep(retryDelayMs);
        }
        continue;
      }

      return parsePromptExecutionResponse({
        ok: response.ok,
        status: response.status,
        contentType,
        bodyText,
      });
    } catch (err) {
      if (isUserCancelledError(err)) {
        throw err;
      }
      if (attempt < maxAttempts && isTransientNetworkError(err)) {
        if (retryDelayMs > 0) {
          await sleep(retryDelayMs);
        }
        continue;
      }
      throw formatFriendlyNetworkError(err, 'ai');
    }
  }

  throw new ClassifiedAiError(
    'Unable to complete AI generation. Please try again.',
    'provider_unavailable',
  );
}

export interface ResilientJsonFetchOptions {
  url: string;
  init: RequestInit;
  fetchImpl?: FetchLike;
  timeoutMs?: number;
  retryDelayMs?: number;
}

/**
 * Executes a standard JSON API call with timeout protection, friendly error
 * translation for raw `Failed to fetch` network drops, and a single safe retry
 * for idempotent GET requests on transient failures.
 */
export async function fetchJsonWithResilience<T>(
  options: ResilientJsonFetchOptions,
): Promise<T> {
  const fetchImpl: FetchLike = options.fetchImpl ?? (globalThis.fetch as FetchLike);
  const timeoutMs = options.timeoutMs ?? DEFAULT_API_CLIENT_TIMEOUT_MS;
  const retryDelayMs = Math.max(0, options.retryDelayMs ?? DEFAULT_GET_CLIENT_RETRY_DELAY_MS);
  const method = (options.init.method ?? 'GET').toUpperCase();
  const maxAttempts = method === 'GET' ? 2 : 1;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await fetchWithTimeout(fetchImpl, options.url, options.init, timeoutMs);
      const bodyText = await response.text();
      const contentType = response.headers.get('content-type');

      if (
        attempt < maxAttempts &&
        (isTransientHttpStatus(response.status) || looksLikeHtmlBody(contentType, bodyText))
      ) {
        if (retryDelayMs > 0) {
          await sleep(retryDelayMs);
        }
        continue;
      }

      let data: Record<string, unknown> | null = null;
      try {
        const parsed: unknown = bodyText.trim() ? JSON.parse(bodyText) : null;
        if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
          data = parsed as Record<string, unknown>;
        }
      } catch {
        data = null;
      }

      if (!response.ok) {
        const message =
          typeof data?.error === 'string' && data.error.trim()
            ? data.error.trim()
            : `Request failed with status ${response.status}`;
        throw new Error(message);
      }

      if (data === null) {
        if (looksLikeHtmlBody(contentType, bodyText)) {
          throw new Error(
            'The server returned a temporary gateway page instead of JSON. Please try again.',
          );
        }
        throw new Error('The server returned an unreadable non-JSON response. Please try again.');
      }

      return data as T;
    } catch (err) {
      if (isUserCancelledError(err)) {
        throw err;
      }
      if (attempt < maxAttempts && isTransientNetworkError(err)) {
        if (retryDelayMs > 0) {
          await sleep(retryDelayMs);
        }
        continue;
      }
      throw formatFriendlyNetworkError(err, 'api');
    }
  }

  throw new ClassifiedAiError(
    'Unable to reach the server. Please check your connection and try again.',
    'network_failure',
  );
}
