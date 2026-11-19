import type { PromptExecutionResult } from '../prompts/types.ts';

export interface RawHttpResponsePayload {
  ok: boolean;
  status: number;
  contentType: string | null;
  bodyText: string;
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
    throw new Error(
      'The AI service returned a temporary server gateway response instead of JSON. Please wait a moment and try again.',
    );
  }

  let parsed: unknown;
  try {
    parsed = bodyText.trim() ? JSON.parse(bodyText) : null;
  } catch {
    throw new Error(
      ok
        ? 'The server returned an unreadable non-JSON response. Please try again.'
        : `Request failed with status ${status}.`,
    );
  }

  if (!isPlainObject(parsed)) {
    throw new Error(
      ok
        ? 'The server returned an unexpected empty response. Please try again.'
        : `Request failed with status ${status}.`,
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

  const message =
    typeof parsed.error === 'string' && parsed.error.trim()
      ? parsed.error.trim()
      : ok
        ? 'AI prompt execution returned an unexpected response format. Please try again.'
        : `Request failed with status ${status}`;
  throw new Error(message);
}
