import type { PromptExecutionResult } from '../prompts/types.ts';
import type { AiErrorCategory } from '../types/brand.ts';

export interface RawHttpResponsePayload {
  ok: boolean;
  status: number;
  contentType: string | null;
  bodyText: string;
}

const VALID_ERROR_CATEGORIES = new Set<AiErrorCategory>([
  'prompt_budget_exceeded',
  'missing_prerequisites',
  'authentication_failure',
  'rate_limited',
  'provider_unavailable',
  'request_timeout',
  'network_failure',
  'invalid_ai_response',
  'json_parse_failure',
  'persistence_failure',
  'request_cancelled',
]);

export class ClassifiedAiError extends Error {
  readonly errorCategory: AiErrorCategory;
  readonly status?: number;
  readonly requestId?: string;
  readonly retryAfterSeconds?: number;

  constructor(
    message: string,
    errorCategory: AiErrorCategory,
    options?: { status?: number; requestId?: string; retryAfterSeconds?: number },
  ) {
    super(message);
    this.name = 'ClassifiedAiError';
    this.errorCategory = errorCategory;
    this.status = options?.status;
    this.requestId = options?.requestId;
    this.retryAfterSeconds = options?.retryAfterSeconds;
  }
}

export function isClassifiedAiError(err: unknown): err is ClassifiedAiError {
  return err instanceof ClassifiedAiError;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function looksLikeHtml(contentType: string | null, bodyText: string): boolean {
  if (contentType && /text\/html/i.test(contentType)) {
    return true;
  }
  const trimmed = bodyText.trimStart();
  return /^<!doctype\s+html|^<html\b/i.test(trimmed);
}

function inferErrorCategory(
  status: number,
  parsed: Record<string, unknown>,
  message: string,
): AiErrorCategory {
  if (
    typeof parsed.errorCategory === 'string' &&
    VALID_ERROR_CATEGORIES.has(parsed.errorCategory as AiErrorCategory)
  ) {
    return parsed.errorCategory as AiErrorCategory;
  }
  const upstreamStatus =
    typeof parsed.upstreamStatus === 'number' ? parsed.upstreamStatus : status;
  if (upstreamStatus === 401 || upstreamStatus === 403 || /sign in|session|authentication/i.test(message)) {
    return 'authentication_failure';
  }
  if (upstreamStatus === 429 || /rate limit|quota/i.test(message)) {
    return 'rate_limited';
  }
  if (upstreamStatus === 504 || /timed?\s*out/i.test(message)) {
    return 'request_timeout';
  }
  if (/12000-character|12,000|exceeds.*limit|prompt budget/i.test(message)) {
    return 'prompt_budget_exceeded';
  }
  if (/missing required|prerequisite|approve/i.test(message)) {
    return 'missing_prerequisites';
  }
  if (/malformed json|could not be parsed/i.test(message)) {
    return 'json_parse_failure';
  }
  if (upstreamStatus === 503 || /temporarily busy|unavailable/i.test(message)) {
    return 'provider_unavailable';
  }
  return 'invalid_ai_response';
}

/**
 * Parses `/api/brands/:id/prompts/execute` responses safely without ever
 * silently collapsing non-JSON HTML proxy responses (such as reverse-proxy
 * warmup pages returned with HTTP 200) into `{}`.
 */
export function parsePromptExecutionResponse(
  payload: RawHttpResponsePayload,
): PromptExecutionResult {
  const { ok, status, contentType, bodyText } = payload;

  if (looksLikeHtml(contentType, bodyText)) {
    throw new ClassifiedAiError(
      'The AI service returned a temporary server gateway response instead of JSON. Please wait a moment and try again.',
      'provider_unavailable',
      { status },
    );
  }

  let parsed: unknown;
  try {
    parsed = bodyText.trim() ? JSON.parse(bodyText) : null;
  } catch {
    throw new ClassifiedAiError(
      ok
        ? 'The server returned an unreadable non-JSON response. Please try again.'
        : `Request failed with status ${status}.`,
      'json_parse_failure',
      { status },
    );
  }

  if (!isPlainObject(parsed)) {
    throw new ClassifiedAiError(
      ok
        ? 'The server returned an unexpected empty response. Please try again.'
        : `Request failed with status ${status}.`,
      'invalid_ai_response',
      { status },
    );
  }

  const resultStatus = parsed.status;
  if (ok && resultStatus === 'success') {
    return parsed as unknown as PromptExecutionResult;
  }

  if (
    status === 422 &&
    (resultStatus === 'missing_information' || resultStatus === 'validation_error')
  ) {
    return parsed as unknown as PromptExecutionResult;
  }

  if (status === 502 && resultStatus === 'validation_error') {
    return parsed as unknown as PromptExecutionResult;
  }

  const requestId =
    typeof parsed.requestId === 'string' && parsed.requestId.trim()
      ? parsed.requestId.trim()
      : undefined;

  const retryAfterSeconds =
    typeof parsed.retryAfterSeconds === 'number' &&
    Number.isFinite(parsed.retryAfterSeconds) &&
    parsed.retryAfterSeconds > 0
      ? Math.ceil(parsed.retryAfterSeconds)
      : undefined;

  const message =
    typeof parsed.error === 'string' && parsed.error.trim()
      ? parsed.error.trim()
      : ok
        ? 'AI prompt execution returned an unexpected response format. Please try again.'
        : `Request failed with status ${status}.`;

  const category = inferErrorCategory(status, parsed, message);
  throw new ClassifiedAiError(message, category, { status, requestId, retryAfterSeconds });
}
