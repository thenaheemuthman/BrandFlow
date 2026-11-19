import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import type {
  AiGenerateResponse,
  AiResponseMimeType,
  AllowedGeminiModel,
} from '../src/types/brand.ts';

export const DEFAULT_GEMINI_MODEL: AllowedGeminiModel = 'gemini-4-hydrogen';

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
export const DEFAULT_AI_RETRY_BASE_DELAY_MS = 400;

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

export type GeminiGenerateFn = (
  input: ValidatedAiGenerateInput,
) => Promise<AiGenerateResponse>;

export class GeminiConfigError extends Error {
  readonly statusCode = 503;

  constructor(message = 'AI generation is not configured on the server (missing GEMINI_API_KEY).') {
    super(message);
    this.name = 'GeminiConfigError';
  }
}

export class GeminiTimeoutError extends Error {
  readonly statusCode = 504;

  constructor(message = 'AI generation timed out. Please try again.') {
    super(message);
    this.name = 'GeminiTimeoutError';
  }
}

export class GeminiProviderError extends Error {
  readonly statusCode: number;

  constructor(message: string, statusCode = 502) {
    super(message);
    this.name = 'GeminiProviderError';
    this.statusCode = statusCode;
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

export function sanitizeProviderError(err: unknown): GeminiProviderError | GeminiTimeoutError {
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
    return new GeminiProviderError(
      'AI provider rate limit reached. Please wait a moment and try again.',
      429,
    );
  }

  if (
    status === 401 ||
    status === 403 ||
    /PERMISSION_DENIED|API_KEY_INVALID|invalid api key|unauthorized/i.test(rawMessage)
  ) {
    return new GeminiProviderError(
      'AI provider authentication failed. Verify the server Gemini API configuration.',
      502,
    );
  }

  if (status === 400 || status === 404) {
    return new GeminiProviderError(
      'AI provider rejected the generation request parameters.',
      502,
    );
  }

  if (status === 503 || /UNAVAILABLE|overloaded|temporarily unavailable/i.test(rawMessage)) {
    return new GeminiProviderError(
      'AI service is temporarily busy. Please try again in a moment.',
      503,
    );
  }

  return new GeminiProviderError(
    'AI generation failed due to an upstream provider error.',
    502,
  );
}

function logSanitizedGeminiFailure(details: {
  model: AllowedGeminiModel;
  attempt: number;
  maxAttempts: number;
  err: unknown;
  mappedStatus: number;
  willRetry: boolean;
}) {
  const upstreamStatus = readNumericStatus(details.err);
  const errorName = details.err instanceof Error ? details.err.name : 'UnknownError';
  // Log only sanitized metadata — never log API keys, URLs, prompt text, or raw error messages.
  console.error(
    `[Gemini] model=${details.model} attempt=${details.attempt}/${details.maxAttempts} upstreamStatus=${upstreamStatus ?? 'none'} errorName=${errorName} mappedStatus=${details.mappedStatus} willRetry=${details.willRetry}`,
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

export async function generateGeminiContent(
  input: ValidatedAiGenerateInput,
  options?: {
    apiKey?: string;
    timeoutMs?: number;
    maxRetries?: number;
    retryBaseDelayMs?: number;
    clientFactory?: (apiKey: string) => GeminiClientLike;
  },
): Promise<AiGenerateResponse> {
  const apiKey = (options?.apiKey ?? process.env.GEMINI_API_KEY ?? '').trim();
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    throw new GeminiConfigError();
  }

  const timeoutMs = options?.timeoutMs ?? DEFAULT_AI_TIMEOUT_MS;
  const maxRetries = Math.max(0, options?.maxRetries ?? DEFAULT_AI_MAX_RETRIES);
  const retryBaseDelayMs = Math.max(
    0,
    options?.retryBaseDelayMs ?? DEFAULT_AI_RETRY_BASE_DELAY_MS,
  );
  const maxAttempts = maxRetries + 1;
  const clientFactory = options?.clientFactory ?? defaultClientFactory;
  const client = clientFactory(apiKey);
  const contents = buildGeminiContents(input.prompt, input.contextText);
  const deadline = Date.now() + timeoutMs;

  let lastMappedError: GeminiProviderError | GeminiTimeoutError | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const remainingMs = deadline - Date.now();
    if (remainingMs <= 0) {
      throw new GeminiTimeoutError();
    }

    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;

    const timeoutPromise = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => {
        controller.abort();
        reject(new GeminiTimeoutError());
      }, remainingMs);
    });

    const config: {
      abortSignal: AbortSignal;
      responseMimeType?: string;
      responseSchema?: Record<string, unknown>;
      thinkingConfig?: { thinkingLevel: ThinkingLevel };
    } = {
      abortSignal: controller.signal,
    };

    if (input.model === 'gemini-4-hydrogen') {
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
          model: input.model,
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
        );
      }

      return {
        text,
        model: input.model,
        generatedAt: new Date().toISOString(),
      };
    } catch (err) {
      if (err instanceof GeminiConfigError) {
        throw err;
      }

      const mapped = sanitizeProviderError(err);
      lastMappedError = mapped;

      const retryDelayMs = retryBaseDelayMs * Math.pow(2, attempt - 1);
      const hasBudgetForRetry = deadline - Date.now() > retryDelayMs + 50;
      const willRetry =
        attempt < maxAttempts &&
        isRetryableProviderError(err) &&
        hasBudgetForRetry;

      logSanitizedGeminiFailure({
        model: input.model,
        attempt,
        maxAttempts,
        err,
        mappedStatus: mapped.statusCode,
        willRetry,
      });

      if (!willRetry) {
        throw mapped;
      }

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
