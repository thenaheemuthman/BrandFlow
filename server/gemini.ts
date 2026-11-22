import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import type {
  AiErrorCategory,
  AiGenerateResponse,
  AiResponseMimeType,
  AllowedGeminiModel,
} from '../src/types/brand.ts';

export const DEFAULT_GEMINI_MODEL: AllowedGeminiModel = 'gemini-4-hydrogen';
export const FALLBACK_GEMINI_MODEL: AllowedGeminiModel = 'gemini-3.1-flash-lite';

export const ALLOWED_GEMINI_MODELS: readonly AllowedGeminiModel[] = [
  'gemini-4-hydrogen',
  'gemini-3.1-flash-lite',
];

export const ALLOWED_RESPONSE_MIME_TYPES: readonly AiResponseMimeType[] = [
  'application/json',
  'text/plain',
];

export const AI_REQUEST_BODY_LIMIT = '64kb';
export const MAX_PROMPT_LENGTH = 12_000;
export const MAX_CONTEXT_LENGTH = 24_000;
export const MAX_RESPONSE_SCHEMA_LENGTH = 16_000;
export const DEFAULT_AI_TIMEOUT_MS = 50_000;
export const DEFAULT_AI_MAX_RETRIES = 2;
export const DEFAULT_AI_RETRY_BASE_DELAY_MS = 900;
export const DEFAULT_PRIMARY_ATTEMPT_TIMEOUT_MS = 22_000;
export const DEFAULT_SECOND_ATTEMPT_TIMEOUT_MS = 14_000;
export const MIN_FALLBACK_BUDGET_MS = 6_000;
export const DEFAULT_RATE_LIMIT_COOLDOWN_MS = 45_000;
export const MAX_RATE_LIMIT_COOLDOWN_MS = 120_000;
export const MAX_INLINE_RATE_LIMIT_WAIT_MS = 6_000;

export interface ValidatedAiGenerateInput {
  prompt: string;
  contextText?: string;
  model: AllowedGeminiModel;
  responseMimeType?: AiResponseMimeType;
  responseSchema?: Record<string, unknown>;
}

export interface GeminiClientLike {
  models: {
    generateContent(params: {
      model: string;
      contents: string;
      config?: {
        abortSignal?: AbortSignal;
        responseMimeType?: string;
        responseSchema?: Record<string, unknown>;
        thinkingConfig?: {
          thinkingLevel?: ThinkingLevel;
        };
      };
    }): Promise<{ text?: string }>;
  };
}

export interface GeminiDiagnosticContext {
  requestId?: string;
  brandId?: string;
  promptId?: string;
  stage?: string;
}

export type GeminiGenerateFn = (
  input: ValidatedAiGenerateInput,
  diagnostics?: GeminiDiagnosticContext,
) => Promise<AiGenerateResponse>;

export class GeminiConfigError extends Error {
  readonly statusCode = 503;
  readonly errorCategory: AiErrorCategory = 'provider_unavailable';

  constructor(message = 'AI generation is not configured on the server (missing GEMINI_API_KEY).') {
    super(message);
    this.name = 'GeminiConfigError';
  }
}

export class GeminiTimeoutError extends Error {
  readonly statusCode = 504;
  readonly errorCategory: AiErrorCategory = 'request_timeout';

  constructor(message = 'AI generation timed out. Please try again.') {
    super(message);
    this.name = 'GeminiTimeoutError';
  }
}

export class GeminiProviderError extends Error {
  readonly statusCode: number;
  readonly errorCategory: AiErrorCategory;
  readonly retryAfterSeconds?: number;

  constructor(
    message: string,
    statusCode = 502,
    errorCategory?: AiErrorCategory,
    retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = 'GeminiProviderError';
    this.statusCode = statusCode;
    this.errorCategory =
      errorCategory ??
      (statusCode === 429
        ? 'rate_limited'
        : statusCode === 503
          ? 'provider_unavailable'
          : 'provider_unavailable');
    this.retryAfterSeconds =
      typeof retryAfterSeconds === 'number' && Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0
        ? Math.ceil(retryAfterSeconds)
        : undefined;
  }
}

export function isAllowedGeminiModel(model: string): model is AllowedGeminiModel {
  return (ALLOWED_GEMINI_MODELS as readonly string[]).includes(model);
}

export function isAllowedResponseMimeType(
  value: string,
): value is AiResponseMimeType {
  return (ALLOWED_RESPONSE_MIME_TYPES as readonly string[]).includes(value);
}

const ALLOWED_SCHEMA_TYPES = new Set([
  'STRING',
  'NUMBER',
  'INTEGER',
  'BOOLEAN',
  'ARRAY',
  'OBJECT',
]);

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validateGeminiSchemaNode(node: unknown, depth = 0): string | null {
  if (depth > 8) {
    return 'responseSchema exceeds maximum nesting depth.';
  }
  if (!isPlainRecord(node)) {
    return 'responseSchema nodes must be JSON objects.';
  }
  if (typeof node.type !== 'string' || !ALLOWED_SCHEMA_TYPES.has(node.type)) {
    return 'responseSchema nodes must specify a valid Gemini schema type.';
  }
  if (node.type === 'OBJECT') {
    if (!isPlainRecord(node.properties) || Object.keys(node.properties).length === 0) {
      return 'responseSchema OBJECT nodes must define non-empty properties.';
    }
    for (const child of Object.values(node.properties)) {
      const childErr = validateGeminiSchemaNode(child, depth + 1);
      if (childErr) return childErr;
    }
  }
  if (node.type === 'ARRAY') {
    if (!isPlainRecord(node.items)) {
      return 'responseSchema ARRAY nodes must define an items schema object.';
    }
    const itemErr = validateGeminiSchemaNode(node.items, depth + 1);
    if (itemErr) return itemErr;
  }
  return null;
}

export function validateGeminiResponseSchema(
  schema: unknown,
): { data?: Record<string, unknown>; error?: string } {
  if (!isPlainRecord(schema)) {
    return { error: 'responseSchema must be a JSON object.' };
  }
  if (schema.type !== 'OBJECT') {
    return { error: 'Top-level responseSchema must have type "OBJECT".' };
  }
  const nodeError = validateGeminiSchemaNode(schema, 0);
  if (nodeError) {
    return { error: nodeError };
  }
  try {
    const serialized = JSON.stringify(schema);
    if (serialized.length > MAX_RESPONSE_SCHEMA_LENGTH) {
      return {
        error: `responseSchema exceeds the maximum allowed length of ${MAX_RESPONSE_SCHEMA_LENGTH} characters.`,
      };
    }
  } catch {
    return { error: 'responseSchema must be serializable JSON.' };
  }
  return { data: schema };
}

export function validateAiGenerateBody(
  body: unknown,
): { data?: ValidatedAiGenerateInput; error?: string } {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return { error: 'Request body must be a JSON object.' };
  }

  const raw = body as Record<string, unknown>;

  if (typeof raw.prompt !== 'string') {
    return { error: 'Prompt is required and must be a string.' };
  }

  const prompt = raw.prompt.trim();
  if (!prompt) {
    return { error: 'Prompt is required.' };
  }
  if (prompt.length > MAX_PROMPT_LENGTH) {
    return {
      error: `Prompt exceeds the maximum allowed length of ${MAX_PROMPT_LENGTH} characters.`,
    };
  }

  let contextText: string | undefined;
  if (raw.context !== undefined && raw.context !== null) {
    if (typeof raw.context === 'string') {
      const trimmedContext = raw.context.trim();
      if (trimmedContext.length > MAX_CONTEXT_LENGTH) {
        return {
          error: `Context exceeds the maximum allowed length of ${MAX_CONTEXT_LENGTH} characters.`,
        };
      }
      if (trimmedContext) {
        contextText = trimmedContext;
      }
    } else if (typeof raw.context === 'object' && !Array.isArray(raw.context)) {
      try {
        const serialized = JSON.stringify(raw.context);
        if (serialized.length > MAX_CONTEXT_LENGTH) {
          return {
            error: `Context exceeds the maximum allowed length of ${MAX_CONTEXT_LENGTH} characters.`,
          };
        }
        contextText = serialized;
      } catch {
        return { error: 'Context must be a valid JSON object or string.' };
      }
    } else {
      return { error: 'Context must be a string or JSON object.' };
    }
  }

  let model: AllowedGeminiModel = DEFAULT_GEMINI_MODEL;
  if (raw.model !== undefined && raw.model !== null) {
    if (typeof raw.model !== 'string' || !isAllowedGeminiModel(raw.model.trim())) {
      return {
        error: `Unsupported model. Allowed models are: ${ALLOWED_GEMINI_MODELS.join(', ')}.`,
      };
    }
    model = raw.model.trim() as AllowedGeminiModel;
  }

  let responseMimeType: AiResponseMimeType | undefined;
  if (raw.responseMimeType !== undefined && raw.responseMimeType !== null) {
    if (
      typeof raw.responseMimeType !== 'string' ||
      !isAllowedResponseMimeType(raw.responseMimeType.trim())
    ) {
      return {
        error: `Unsupported responseMimeType. Allowed values are: ${ALLOWED_RESPONSE_MIME_TYPES.join(', ')}.`,
      };
    }
    responseMimeType = raw.responseMimeType.trim() as AiResponseMimeType;
  }

  let responseSchema: Record<string, unknown> | undefined;
  if (raw.responseSchema !== undefined && raw.responseSchema !== null) {
    const schemaCheck = validateGeminiResponseSchema(raw.responseSchema);
    if (schemaCheck.error || !schemaCheck.data) {
      return { error: schemaCheck.error ?? 'Invalid responseSchema.' };
    }
    responseSchema = schemaCheck.data;
  }

  return {
    data: {
      prompt,
      contextText,
      model,
      responseMimeType,
      responseSchema,
    },
  };
}

export function buildGeminiContents(prompt: string, contextText?: string): string {
  if (!contextText) {
    return prompt;
  }
  return `Context:\n${contextText}\n\nInstruction:\n${prompt}`;
}

function readNumericStatus(err: unknown): number | undefined {
  if (typeof err !== 'object' || err === null) return undefined;
  const candidate = err as { status?: unknown; statusCode?: unknown; code?: unknown };
  if (typeof candidate.status === 'number') return candidate.status;
  if (typeof candidate.statusCode === 'number') return candidate.statusCode;
  if (typeof candidate.code === 'number') return candidate.code;
  return undefined;
}

const modelRateLimitCooldownUntil = new Map<AllowedGeminiModel, number>();

export function clearGeminiRateLimitCooldowns(): void {
  modelRateLimitCooldownUntil.clear();
}

export function getModelRateLimitCooldownRemainingMs(
  model: AllowedGeminiModel,
  nowMs = Date.now(),
): number {
  const until = modelRateLimitCooldownUntil.get(model);
  if (!until) return 0;
  const remaining = until - nowMs;
  if (remaining <= 0) {
    modelRateLimitCooldownUntil.delete(model);
    return 0;
  }
  return remaining;
}

function markModelRateLimited(
  model: AllowedGeminiModel,
  retryAfterMs: number | undefined,
  nowMs = Date.now(),
): void {
  const durationMs = Math.min(
    MAX_RATE_LIMIT_COOLDOWN_MS,
    Math.max(DEFAULT_RATE_LIMIT_COOLDOWN_MS, retryAfterMs ?? DEFAULT_RATE_LIMIT_COOLDOWN_MS),
  );
  modelRateLimitCooldownUntil.set(model, nowMs + durationMs);
}

export function isRateLimitError(err: unknown): boolean {
  if (err instanceof GeminiProviderError) {
    return err.statusCode === 429 || err.errorCategory === 'rate_limited';
  }
  const status = readNumericStatus(err);
  if (status === 429) return true;
  const rawMessage = err instanceof Error ? err.message : '';
  return /RESOURCE_EXHAUSTED|rate\s*limit|quota/i.test(rawMessage);
}

export function isHardQuotaExhaustionError(err: unknown): boolean {
  const rawMessage = err instanceof Error ? err.message : '';
  if (/per\s*day|PerDay|daily\s*quota|limit:\s*0\b|free_tier.*requests.*0/i.test(rawMessage)) {
    return true;
  }
  if (typeof err === 'object' && err !== null) {
    const details = (err as { details?: unknown }).details;
    if (Array.isArray(details)) {
      try {
        const serialized = JSON.stringify(details);
        if (/PerDay|daily|limit":0/i.test(serialized)) {
          return true;
        }
      } catch {
        // ignore unserializable error details
      }
    }
  }
  return false;
}

function parseDurationTokenToMs(value: number, unit?: string): number | undefined {
  if (!Number.isFinite(value) || value <= 0) return undefined;
  const normalizedUnit = (unit ?? 's').toLowerCase();
  const ms = normalizedUnit === 'ms' ? value : value * 1000;
  return Math.min(600_000, Math.ceil(ms));
}

export function extractRetryAfterMs(err: unknown): number | undefined {
  if (typeof err === 'object' && err !== null) {
    const candidate = err as {
      retryAfterMs?: unknown;
      retryAfterSeconds?: unknown;
      headers?: { get?: (name: string) => string | null };
      response?: { headers?: { get?: (name: string) => string | null } };
      details?: unknown;
    };

    if (typeof candidate.retryAfterMs === 'number' && candidate.retryAfterMs > 0) {
      return Math.min(600_000, Math.ceil(candidate.retryAfterMs));
    }
    if (typeof candidate.retryAfterSeconds === 'number' && candidate.retryAfterSeconds > 0) {
      return Math.min(600_000, Math.ceil(candidate.retryAfterSeconds * 1000));
    }

    const headerVal =
      candidate.headers?.get?.('retry-after') ??
      candidate.response?.headers?.get?.('retry-after');
    if (typeof headerVal === 'string' && headerVal.trim()) {
      const numeric = Number(headerVal.trim());
      if (Number.isFinite(numeric) && numeric > 0) {
        return Math.min(600_000, Math.ceil(numeric * 1000));
      }
    }

    if (Array.isArray(candidate.details)) {
      for (const detail of candidate.details) {
        if (typeof detail === 'object' && detail !== null) {
          const retryDelay = (detail as { retryDelay?: unknown }).retryDelay;
          if (typeof retryDelay === 'string') {
            const m = retryDelay.trim().match(/^(\d+(?:\.\d+)?)\s*(ms|s)?$/i);
            if (m) {
              const parsed = parseDurationTokenToMs(Number(m[1]), m[2]);
              if (parsed !== undefined) return parsed;
            }
          }
        }
      }
    }
  }

  const rawMessage = err instanceof Error ? err.message : '';
  if (rawMessage) {
    const match = rawMessage.match(
      /(?:retry\s*(?:in|after)|retryDelay["']?\s*[:=]\s*["']?)\s*(\d+(?:\.\d+)?)\s*(ms|s|sec|seconds)?/i,
    );
    if (match) {
      return parseDurationTokenToMs(Number(match[1]), match[2]);
    }
  }

  return undefined;
}

export function isRetryableProviderError(err: unknown): boolean {
  if (err instanceof GeminiConfigError || err instanceof GeminiTimeoutError) {
    return false;
  }
  if (err instanceof GeminiProviderError) {
    return err.statusCode === 503;
  }

  const name = err instanceof Error ? err.name : '';
  const rawMessage = err instanceof Error ? err.message : '';
  const status = readNumericStatus(err);

  if (name === 'AbortError' || /timed?\s*out|aborted/i.test(rawMessage)) {
    return false;
  }

  if (status === 400 || status === 401 || status === 403 || status === 404 || status === 429) {
    return false;
  }

  if (status === 500 || status === 502 || status === 503 || status === 504) {
    return true;
  }

  if (
    /UNAVAILABLE|overloaded|temporarily unavailable|INTERNAL|fetch failed|ECONNRESET|ETIMEDOUT|EAI_AGAIN|socket hang up/i.test(
      rawMessage,
    )
  ) {
    return true;
  }

  return false;
}

export function sanitizeProviderError(
  err: unknown,
  options?: { triedFallback?: boolean },
): GeminiProviderError | GeminiTimeoutError {
  if (err instanceof GeminiTimeoutError) {
    return err;
  }
  if (err instanceof GeminiProviderError) {
    return err;
  }

  const name = err instanceof Error ? err.name : '';
  const rawMessage = err instanceof Error ? err.message : '';
  const status = readNumericStatus(err);

  if (name === 'AbortError' || /timed?\s*out|aborted/i.test(rawMessage)) {
    return new GeminiTimeoutError();
  }

  if (status === 429 || /RESOURCE_EXHAUSTED|rate\s*limit|quota/i.test(rawMessage)) {
    const retryAfterMs = extractRetryAfterMs(err);
    const retryAfterSeconds =
      retryAfterMs !== undefined ? Math.max(1, Math.ceil(retryAfterMs / 1000)) : undefined;
    const hardQuota = isHardQuotaExhaustionError(err);

    let message: string;
    if (options?.triedFallback || hardQuota) {
      message =
        retryAfterSeconds !== undefined && retryAfterSeconds <= 120 && !hardQuota
          ? `AI provider rate limit reached across available models. Please wait about ${retryAfterSeconds} seconds and try again.`
          : 'AI provider rate limit reached across available models. Please wait a minute and try again, or verify your Gemini API quota.';
    } else if (retryAfterSeconds !== undefined && retryAfterSeconds <= 120) {
      message = `AI provider rate limit reached. Please wait about ${retryAfterSeconds} seconds and try again.`;
    } else {
      message = 'AI provider rate limit reached. Please wait a moment and try again.';
    }

    return new GeminiProviderError(message, 429, 'rate_limited', retryAfterSeconds);
  }

  if (
    status === 401 ||
    status === 403 ||
    /PERMISSION_DENIED|API_KEY_INVALID|invalid api key|unauthorized/i.test(rawMessage)
  ) {
    return new GeminiProviderError(
      'AI provider authentication failed. Verify the server Gemini API configuration.',
      502,
      'authentication_failure',
    );
  }

  if (status === 400 || status === 404) {
    return new GeminiProviderError(
      'AI provider rejected the generation request parameters.',
      502,
      'invalid_ai_response',
    );
  }

  if (status === 503 || /UNAVAILABLE|overloaded|temporarily unavailable/i.test(rawMessage)) {
    return new GeminiProviderError(
      'AI service is temporarily busy. Please try again in a moment.',
      503,
      'provider_unavailable',
    );
  }

  if (/fetch failed|ECONNRESET|ETIMEDOUT|EAI_AGAIN|socket hang up/i.test(rawMessage)) {
    return new GeminiProviderError(
      'Connection to the AI provider was interrupted before a response arrived. Please try again.',
      502,
      'network_failure',
    );
  }

  return new GeminiProviderError(
    'AI generation failed due to an upstream provider error.',
    502,
    'provider_unavailable',
  );
}

function logSanitizedGeminiFailure(details: {
  model: AllowedGeminiModel;
  attempt: number;
  maxAttempts: number;
  err: unknown;
  mappedStatus: number;
  errorCategory: AiErrorCategory;
  elapsedMs: number;
  willRetry: boolean;
  nextModel?: AllowedGeminiModel;
  diagnostics?: GeminiDiagnosticContext;
}) {
  const upstreamStatus = readNumericStatus(details.err);
  const errorName = details.err instanceof Error ? details.err.name : 'UnknownError';
  const fallbackNote =
    details.willRetry && details.nextModel && details.nextModel !== details.model
      ? ` nextModel=${details.nextModel}`
      : '';
  const diagParts = [
    details.diagnostics?.requestId ? `requestId=${details.diagnostics.requestId}` : '',
    details.diagnostics?.brandId ? `brandId=${details.diagnostics.brandId}` : '',
    details.diagnostics?.promptId ? `promptId=${details.diagnostics.promptId}` : '',
    details.diagnostics?.stage ? `stage=${details.diagnostics.stage}` : '',
  ]
    .filter(Boolean)
    .join(' ');
  const prefix = diagParts ? `${diagParts} ` : '';
  // Log only sanitized metadata — never log API keys, URLs, prompt text, or raw error messages.
  console.error(
    `[Gemini] ${prefix}model=${details.model} attempt=${details.attempt}/${details.maxAttempts} elapsedMs=${details.elapsedMs} upstreamStatus=${upstreamStatus ?? 'none'} errorName=${errorName} errorCategory=${details.errorCategory} mappedStatus=${details.mappedStatus} willRetry=${details.willRetry}${fallbackNote}`,
  );
}

function defaultClientFactory(apiKey: string): GeminiClientLike {
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function waitMs(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function computeAttemptTimeoutMs(params: {
  attempt: number;
  maxAttempts: number;
  remainingMs: number;
  totalTimeoutMs: number;
  activeModel: AllowedGeminiModel;
  overridePrimaryTimeoutMs?: number;
}): number {
  const { attempt, maxAttempts, remainingMs, totalTimeoutMs, activeModel, overridePrimaryTimeoutMs } =
    params;

  // On final attempt or when already on the fast fallback model, give it the full remaining deadline.
  if (attempt >= maxAttempts || activeModel === FALLBACK_GEMINI_MODEL) {
    return remainingMs;
  }

  // Respect explicit test/caller override for per-attempt primary cap.
  if (typeof overridePrimaryTimeoutMs === 'number' && overridePrimaryTimeoutMs > 0) {
    return Math.min(remainingMs, overridePrimaryTimeoutMs);
  }

  // Only apply per-attempt caps when total timeout is large enough to allow a clean fallback retry.
  if (totalTimeoutMs < 20_000) {
    return remainingMs;
  }

  const cap =
    attempt === 1 ? DEFAULT_PRIMARY_ATTEMPT_TIMEOUT_MS : DEFAULT_SECOND_ATTEMPT_TIMEOUT_MS;
  return Math.min(remainingMs, cap);
}

export async function generateGeminiContent(
  input: ValidatedAiGenerateInput,
  options?: {
    apiKey?: string;
    timeoutMs?: number;
    attemptTimeoutMs?: number;
    maxRetries?: number;
    retryBaseDelayMs?: number;
    useRateLimitCooldown?: boolean;
    now?: () => number;
    clientFactory?: (apiKey: string) => GeminiClientLike;
    diagnostics?: GeminiDiagnosticContext;
  },
): Promise<AiGenerateResponse> {
  const apiKey = (options?.apiKey ?? process.env.GEMINI_API_KEY ?? '').trim();
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    throw new GeminiConfigError();
  }

  const nowFn = options?.now ?? Date.now;
  const startedAt = nowFn();
  const timeoutMs = options?.timeoutMs ?? DEFAULT_AI_TIMEOUT_MS;
  const maxRetries = Math.max(0, options?.maxRetries ?? DEFAULT_AI_MAX_RETRIES);
  const retryBaseDelayMs = Math.max(
    0,
    options?.retryBaseDelayMs ?? DEFAULT_AI_RETRY_BASE_DELAY_MS,
  );
  const useCooldown = options?.useRateLimitCooldown ?? true;
  const maxAttempts = maxRetries + 1;
  const clientFactory = options?.clientFactory ?? defaultClientFactory;
  const client = clientFactory(apiKey);
  const contents = buildGeminiContents(input.prompt, input.contextText);
  const deadline = startedAt + timeoutMs;

  let activeModel: AllowedGeminiModel = input.model;
  let startedOnFallbackDueToCooldown = false;
  if (
    useCooldown &&
    activeModel === DEFAULT_GEMINI_MODEL &&
    getModelRateLimitCooldownRemainingMs(DEFAULT_GEMINI_MODEL, nowFn()) > 0
  ) {
    activeModel = FALLBACK_GEMINI_MODEL;
    startedOnFallbackDueToCooldown = true;
  }

  let triedFallbackModel = activeModel === FALLBACK_GEMINI_MODEL;
  let fallbackRateLimitRetries = 0;
  let lastMappedError: GeminiProviderError | GeminiTimeoutError | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const remainingMs = deadline - nowFn();
    if (remainingMs <= 0) {
      throw new GeminiTimeoutError();
    }

    const attemptTimeoutMs = computeAttemptTimeoutMs({
      attempt,
      maxAttempts,
      remainingMs,
      totalTimeoutMs: timeoutMs,
      activeModel,
      overridePrimaryTimeoutMs: options?.attemptTimeoutMs,
    });
    const isCappedAttempt = attemptTimeoutMs < remainingMs - 50;

    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let perAttemptTimedOut = false;

    const timeoutPromise = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => {
        if (isCappedAttempt) {
          perAttemptTimedOut = true;
        }
        controller.abort();
        reject(new GeminiTimeoutError());
      }, attemptTimeoutMs);
    });

    const config: {
      abortSignal: AbortSignal;
      responseMimeType?: string;
      responseSchema?: Record<string, unknown>;
      thinkingConfig?: { thinkingLevel: ThinkingLevel };
    } = {
      abortSignal: controller.signal,
    };

    if (activeModel === 'gemini-4-hydrogen') {
      config.thinkingConfig = { thinkingLevel: ThinkingLevel.LOW };
    }

    if (input.responseMimeType) {
      config.responseMimeType = input.responseMimeType;
    }

    if (input.responseMimeType === 'application/json' && input.responseSchema) {
      config.responseSchema = input.responseSchema;
    }

    try {
      const response = await Promise.race([
        client.models.generateContent({
          model: activeModel,
          contents,
          config,
        }),
        timeoutPromise,
      ]);

      const text = typeof response?.text === 'string' ? response.text.trim() : '';
      if (!text) {
        throw new GeminiProviderError(
          'AI provider returned an empty response. Please try again.',
          502,
          'invalid_ai_response',
        );
      }

      if (useCooldown && activeModel === DEFAULT_GEMINI_MODEL) {
        modelRateLimitCooldownUntil.delete(DEFAULT_GEMINI_MODEL);
      }

      return {
        text,
        model: activeModel,
        generatedAt: new Date(nowFn()).toISOString(),
      };
    } catch (err) {
      if (err instanceof GeminiConfigError) {
        throw err;
      }

      const rateLimited = isRateLimitError(err);
      const hardQuota = rateLimited && isHardQuotaExhaustionError(err);
      const upstreamRetryAfterMs = rateLimited ? extractRetryAfterMs(err) : undefined;

      if (rateLimited && useCooldown) {
        markModelRateLimited(activeModel, upstreamRetryAfterMs, nowFn());
      }

      const mapped = sanitizeProviderError(err, {
        triedFallback: triedFallbackModel || startedOnFallbackDueToCooldown,
      });
      lastMappedError = mapped;

      const minBudgetNeeded = perAttemptTimedOut
        ? Math.min(MIN_FALLBACK_BUDGET_MS, Math.max(50, Math.floor(timeoutMs * 0.25)))
        : 50;

      let canRetry = false;
      let nextModel: AllowedGeminiModel = activeModel;
      let retryDelayMs = 0;

      if (rateLimited) {
        if (activeModel === DEFAULT_GEMINI_MODEL) {
          // Immediately fall back to gemini-3.1-flash-lite (independent model quota bucket)
          // instead of hammering the rate-limited primary model.
          retryDelayMs = Math.min(retryBaseDelayMs, 200);
          const hasBudgetForFallback = deadline - nowFn() > retryDelayMs + minBudgetNeeded;
          if (attempt < maxAttempts && hasBudgetForFallback) {
            canRetry = true;
            nextModel = FALLBACK_GEMINI_MODEL;
            triedFallbackModel = true;
          }
        } else if (
          !hardQuota &&
          fallbackRateLimitRetries < 1 &&
          attempt < maxAttempts &&
          (upstreamRetryAfterMs === undefined ||
            upstreamRetryAfterMs <= MAX_INLINE_RATE_LIMIT_WAIT_MS)
        ) {
          // Allow at most one bounded polite retry on the fallback model for brief RPM bursts.
          retryDelayMs =
            upstreamRetryAfterMs !== undefined
              ? Math.min(upstreamRetryAfterMs, MAX_INLINE_RATE_LIMIT_WAIT_MS)
              : Math.min(Math.max(retryBaseDelayMs * 2, retryBaseDelayMs), 3_000);
          const hasBudgetForRetry = deadline - nowFn() > retryDelayMs + minBudgetNeeded;
          if (hasBudgetForRetry) {
            canRetry = true;
            nextModel = FALLBACK_GEMINI_MODEL;
            fallbackRateLimitRetries += 1;
          }
        }
      } else {
        retryDelayMs = perAttemptTimedOut
          ? Math.min(retryBaseDelayMs, 250)
          : retryBaseDelayMs * Math.pow(2, attempt - 1);
        const hasBudgetForRetry = deadline - nowFn() > retryDelayMs + minBudgetNeeded;
        canRetry =
          attempt < maxAttempts &&
          hasBudgetForRetry &&
          (isRetryableProviderError(err) || perAttemptTimedOut);

        // Switch to fast fallback model when primary model stalls past its per-attempt cap
        // OR when entering the final retry attempt after consecutive overload/transient errors.
        const shouldFallbackToLite =
          canRetry &&
          activeModel === 'gemini-4-hydrogen' &&
          (perAttemptTimedOut || attempt === maxAttempts - 1);
        if (shouldFallbackToLite) {
          nextModel = FALLBACK_GEMINI_MODEL;
          triedFallbackModel = true;
        }
      }

      logSanitizedGeminiFailure({
        model: activeModel,
        attempt,
        maxAttempts,
        err,
        mappedStatus: mapped.statusCode,
        errorCategory: mapped.errorCategory,
        elapsedMs: Math.max(0, nowFn() - startedAt),
        willRetry: canRetry,
        nextModel,
        diagnostics: options?.diagnostics,
      });

      if (!canRetry) {
        throw mapped;
      }

      activeModel = nextModel;

      if (retryDelayMs > 0) {
        await waitMs(retryDelayMs);
      }
    } finally {
      if (timer !== undefined) {
        clearTimeout(timer);
      }
    }
  }

  throw lastMappedError ?? new GeminiProviderError('AI generation failed due to an upstream provider error.', 502);
}
