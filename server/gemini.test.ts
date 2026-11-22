import test from 'node:test';
import assert from 'node:assert/strict';
import { ThinkingLevel } from '@google/genai';
import {
  DEFAULT_AI_TIMEOUT_MS,
  DEFAULT_GEMINI_MODEL,
  DEFAULT_RATE_LIMIT_COOLDOWN_MS,
  FALLBACK_GEMINI_MODEL,
  GeminiConfigError,
  GeminiProviderError,
  GeminiTimeoutError,
  MAX_CONTEXT_LENGTH,
  MAX_PROMPT_LENGTH,
  buildGeminiContents,
  clearGeminiRateLimitCooldowns,
  extractRetryAfterMs,
  generateGeminiContent,
  getModelRateLimitCooldownRemainingMs,
  isHardQuotaExhaustionError,
  isRetryableProviderError,
  sanitizeProviderError,
  validateAiGenerateBody,
} from './gemini.ts';

async function withEnv(
  patch: Record<string, string | undefined>,
  fn: () => Promise<void>,
) {
  const snapshot: Record<string, string | undefined> = {};
  for (const key of Object.keys(patch)) {
    snapshot[key] = process.env[key];
    const next = patch[key];
    if (next === undefined) delete process.env[key];
    else process.env[key] = next;
  }
  try {
    await fn();
  } finally {
    for (const key of Object.keys(snapshot)) {
      const prev = snapshot[key];
      if (prev === undefined) delete process.env[key];
      else process.env[key] = prev;
    }
  }
}

test('validateAiGenerateBody validates prompts, context types/lengths, and model allowlist', () => {
  assert.ok(validateAiGenerateBody(null).error);
  assert.ok(validateAiGenerateBody([]).error);
  assert.ok(validateAiGenerateBody({}).error);
  assert.ok(validateAiGenerateBody({ prompt: '   ' }).error);
  assert.ok(validateAiGenerateBody({ prompt: 123 }).error);

  assert.ok(
    validateAiGenerateBody({ prompt: 'a'.repeat(MAX_PROMPT_LENGTH + 1) }).error,
  );
  assert.ok(
    validateAiGenerateBody({
      prompt: 'Valid prompt',
      context: 'c'.repeat(MAX_CONTEXT_LENGTH + 1),
    }).error,
  );
  assert.ok(
    validateAiGenerateBody({
      prompt: 'Valid prompt',
      context: ['not-allowed-array'],
    }).error,
  );
  assert.ok(
    validateAiGenerateBody({
      prompt: 'Valid prompt',
      model: 'gemini-1.5-flash',
    }).error,
  );
  assert.ok(
    validateAiGenerateBody({
      prompt: 'Valid prompt',
      model: 'gemini-4-argon',
    }).error,
  );

  const validDefault = validateAiGenerateBody({
    prompt: '  Summarize positioning  ',
    context: { brandName: 'Northstar' },
  });
  assert.equal(validDefault.error, undefined);
  assert.equal(validDefault.data?.prompt, 'Summarize positioning');
  assert.equal(validDefault.data?.contextText, '{"brandName":"Northstar"}');
  assert.equal(validDefault.data?.model, DEFAULT_GEMINI_MODEL);

  const validAltModel = validateAiGenerateBody({
    prompt: 'Draft value proposition',
    context: 'SaaS workflow platform',
    model: 'gemini-3.1-flash-lite',
    responseMimeType: 'application/json',
  });
  assert.equal(validAltModel.error, undefined);
  assert.equal(validAltModel.data?.model, 'gemini-3.1-flash-lite');
  assert.equal(validAltModel.data?.responseMimeType, 'application/json');

  assert.ok(
    validateAiGenerateBody({
      prompt: 'Valid prompt',
      responseMimeType: 'text/html',
    }).error,
  );
});

test('generateGeminiContent rejects missing or placeholder GEMINI_API_KEY without leaking secrets', async () => {
  await withEnv({ GEMINI_API_KEY: undefined }, async () => {
    await assert.rejects(
      () =>
        generateGeminiContent({
          prompt: 'Test prompt',
          model: DEFAULT_GEMINI_MODEL,
        }),
      (err: unknown) => {
        assert.ok(err instanceof GeminiConfigError);
        assert.equal(err.statusCode, 503);
        return true;
      },
    );
  });

  await withEnv({ GEMINI_API_KEY: 'MY_GEMINI_API_KEY' }, async () => {
    await assert.rejects(
      () =>
        generateGeminiContent({
          prompt: 'Test prompt',
          model: DEFAULT_GEMINI_MODEL,
        }),
      (err: unknown) => err instanceof GeminiConfigError,
    );
  });
});

test('generateGeminiContent invokes client cleanly with mocked provider and sanitises errors/timeouts', async () => {
  const fakeSecret = 'AIzaSyFakeSecretValueForUnitTests999999';

  await withEnv({ GEMINI_API_KEY: fakeSecret }, async () => {
    let seenModel = '';
    let seenContents = '';
    let receivedKey = '';
    let hadSignal = false;

    const result = await generateGeminiContent(
      {
        prompt: 'Write a crisp brand mission.',
        contextText: 'Brand: Solstice',
        model: DEFAULT_GEMINI_MODEL,
      },
      {
        clientFactory: (apiKey) => {
          receivedKey = apiKey;
          return {
            models: {
              async generateContent(params) {
                seenModel = params.model;
                seenContents = params.contents;
                hadSignal = Boolean(params.config?.abortSignal);
                return { text: '  Deliver proactive preventive care.  ' };
              },
            },
          };
        },
      },
    );

    assert.equal(receivedKey, fakeSecret);
    assert.equal(seenModel, DEFAULT_GEMINI_MODEL);
    assert.equal(
      seenContents,
      buildGeminiContents('Write a crisp brand mission.', 'Brand: Solstice'),
    );
    assert.equal(hadSignal, true);
    assert.equal(result.text, 'Deliver proactive preventive care.');
    assert.equal(result.model, DEFAULT_GEMINI_MODEL);
    assert.ok(!Number.isNaN(Date.parse(result.generatedAt)));

    // Provider error containing sensitive key/stack must be sanitised
    await assert.rejects(
      () =>
        generateGeminiContent(
          { prompt: 'Trigger failure', model: DEFAULT_GEMINI_MODEL },
          {
            clientFactory: () => ({
              models: {
                async generateContent() {
                  const err = new Error(
                    `Request failed for key=${fakeSecret} at https://generativelanguage.googleapis.com`,
                  ) as Error & { status?: number };
                  err.status = 403;
                  throw err;
                },
              },
            }),
          },
        ),
      (err: unknown) => {
        assert.ok(err instanceof GeminiProviderError);
        assert.equal(err.statusCode, 502);
        assert.equal(err.message.includes(fakeSecret), false);
        assert.equal(err.message.includes('googleapis'), false);
        return true;
      },
    );

    // Timeout enforcement
    await assert.rejects(
      () =>
        generateGeminiContent(
          { prompt: 'Hang forever', model: DEFAULT_GEMINI_MODEL },
          {
            timeoutMs: 25,
            clientFactory: () => ({
              models: {
                generateContent() {
                  return new Promise(() => {
                    // Intentionally unresolved to test timeout
                  });
                },
              },
            }),
          },
        ),
      (err: unknown) => {
        assert.ok(err instanceof GeminiTimeoutError);
        assert.equal(err.statusCode, 504);
        return true;
      },
    );
  });
});

test('sanitizeProviderError maps 429 rate limits and 503 overload cleanly', () => {
  const rateErr = Object.assign(new Error('RESOURCE_EXHAUSTED with secret xyz'), {
    status: 429,
  });
  const mapped = sanitizeProviderError(rateErr);
  assert.ok(mapped instanceof GeminiProviderError);
  assert.equal(mapped.statusCode, 429);
  assert.equal(mapped.message.includes('xyz'), false);

  const busyErr = Object.assign(new Error('503 UNAVAILABLE model overloaded'), {
    status: 503,
  });
  const mappedBusy = sanitizeProviderError(busyErr);
  assert.ok(mappedBusy instanceof GeminiProviderError);
  assert.equal(mappedBusy.statusCode, 503);
  assert.match(mappedBusy.message, /temporarily busy/i);
});

test('generateGeminiContent uses 50s timeout, ThinkingLevel.LOW for gemini-4-hydrogen, JSON mode, and bounded retry on transient errors', async () => {
  assert.equal(DEFAULT_AI_TIMEOUT_MS, 50_000);

  const fakeSecret = 'AIzaSyRetrySecretNeverLog98765';
  const loggedLines: string[] = [];
  const origConsoleError = console.error;
  console.error = (...args: unknown[]) => {
    loggedLines.push(args.map((a) => String(a)).join(' '));
  };

  try {
    await withEnv({ GEMINI_API_KEY: fakeSecret }, async () => {
      // 1. Verify ThinkingLevel.LOW & responseMimeType passed for gemini-4-hydrogen + retry recovery on 503
      let attempts = 0;
      let seenThinkingLevel: ThinkingLevel | undefined;
      let seenMimeType: string | undefined;

      const recovered = await generateGeminiContent(
        {
          prompt: 'Generate personas JSON',
          model: 'gemini-4-hydrogen',
          responseMimeType: 'application/json',
        },
        {
          retryBaseDelayMs: 5,
          clientFactory: () => ({
            models: {
              async generateContent(params) {
                attempts += 1;
                seenThinkingLevel = params.config?.thinkingConfig?.thinkingLevel;
                seenMimeType = params.config?.responseMimeType;
                if (attempts === 1) {
                  const err = new Error(`503 UNAVAILABLE key=${fakeSecret}`) as Error & {
                    status?: number;
                  };
                  err.status = 503;
                  throw err;
                }
                return { text: '{"ok":true}' };
              },
            },
          }),
        },
      );

      assert.equal(attempts, 2);
      assert.equal(seenThinkingLevel, ThinkingLevel.LOW);
      assert.equal(seenMimeType, 'application/json');
      assert.equal(recovered.text, '{"ok":true}');

      // Confirm sanitized log never leaked secret or URL
      assert.ok(loggedLines.length >= 1);
      for (const line of loggedLines) {
        assert.equal(line.includes(fakeSecret), false);
        assert.match(line, /\[Gemini\]/);
      }

      // 2. Verify thinkingConfig is NOT sent for gemini-3.1-flash-lite
      let seenLiteThinking: unknown = 'unset';
      await generateGeminiContent(
        {
          prompt: 'Quick summary',
          model: 'gemini-3.1-flash-lite',
        },
        {
          clientFactory: () => ({
            models: {
              async generateContent(params) {
                seenLiteThinking = params.config?.thinkingConfig;
                return { text: 'Summary text' };
              },
            },
          }),
        },
      );
      assert.equal(seenLiteThinking, undefined);

      // 3. Verify 429 is non-retryable on same primary model, but falls back once to gemini-3.1-flash-lite
      // and fails cleanly without retry storms when hard quota is exhausted across both models.
      clearGeminiRateLimitCooldowns();
      const rateModelsSeen: string[] = [];
      assert.equal(
        isRetryableProviderError(Object.assign(new Error('RESOURCE_EXHAUSTED'), { status: 429 })),
        false,
      );
      assert.equal(
        isRetryableProviderError(Object.assign(new Error('UNAVAILABLE'), { status: 503 })),
        true,
      );
      assert.equal(isRetryableProviderError(new Error('fetch failed')), true);

      await assert.rejects(
        () =>
          generateGeminiContent(
            { prompt: 'Quota hit', model: 'gemini-4-hydrogen' },
            {
              retryBaseDelayMs: 5,
              useRateLimitCooldown: false,
              clientFactory: () => ({
                models: {
                  async generateContent(params) {
                    rateModelsSeen.push(params.model);
                    const err = new Error(
                      'RESOURCE_EXHAUSTED: GenerateRequestsPerDayPerProjectPerModel limit: 0',
                    ) as Error & { status?: number };
                    err.status = 429;
                    throw err;
                  },
                },
              }),
            },
          ),
        (err: unknown) =>
          err instanceof GeminiProviderError &&
          err.statusCode === 429 &&
          err.errorCategory === 'rate_limited',
      );
      assert.deepEqual(rateModelsSeen, ['gemini-4-hydrogen', FALLBACK_GEMINI_MODEL]);

      // 4. Verify persistent 503 exhausts maxRetries and returns 503 busy message
      let busyAttempts = 0;
      await assert.rejects(
        () =>
          generateGeminiContent(
            { prompt: 'Still busy', model: 'gemini-4-hydrogen' },
            {
              maxRetries: 2,
              retryBaseDelayMs: 5,
              clientFactory: () => ({
                models: {
                  async generateContent() {
                    busyAttempts += 1;
                    const err = new Error('UNAVAILABLE') as Error & { status?: number };
                    err.status = 503;
                    throw err;
                  },
                },
              }),
            },
          ),
        (err: unknown) =>
          err instanceof GeminiProviderError &&
          err.statusCode === 503 &&
          /temporarily busy/i.test(err.message),
      );
      assert.equal(busyAttempts, 3);
    });
  } finally {
    console.error = origConsoleError;
  }
});

test('validateAiGenerateBody and generateGeminiContent validate and forward Gemini responseSchema safely', async () => {
  const validSchema = {
    type: 'OBJECT',
    properties: {
      suppliedFactsUsed: { type: 'ARRAY', items: { type: 'STRING' } },
      aiSuggestions: {
        type: 'OBJECT',
        properties: {
          channelMixRationale: { type: 'STRING' },
        },
        required: ['channelMixRationale'],
      },
    },
    required: ['suppliedFactsUsed', 'aiSuggestions'],
  };

  // Rejects empty OBJECT schema (Gemini API rejects empty OBJECT nodes)
  const emptyObjResult = validateAiGenerateBody({
    prompt: 'Generate structured output',
    responseMimeType: 'application/json',
    responseSchema: { type: 'OBJECT', properties: {} },
  });
  assert.ok(emptyObjResult.error);

  const nestedEmptyObjResult = validateAiGenerateBody({
    prompt: 'Generate structured output',
    responseMimeType: 'application/json',
    responseSchema: {
      type: 'OBJECT',
      properties: {
        aiSuggestions: { type: 'OBJECT' },
      },
    },
  });
  assert.ok(nestedEmptyObjResult.error);

  const validResult = validateAiGenerateBody({
    prompt: 'Generate channels and tactics',
    responseMimeType: 'application/json',
    responseSchema: validSchema,
  });
  assert.equal(validResult.error, undefined);
  assert.deepEqual(validResult.data?.responseSchema, validSchema);

  await withEnv({ GEMINI_API_KEY: 'AIzaSySchemaForwardTestKey12345' }, async () => {
    let capturedSchema: Record<string, unknown> | undefined;
    let capturedMime: string | undefined;

    await generateGeminiContent(
      {
        prompt: 'Generate channels and tactics',
        model: 'gemini-4-hydrogen',
        responseMimeType: 'application/json',
        responseSchema: validSchema,
      },
      {
        clientFactory: () => ({
          models: {
            async generateContent(params) {
              capturedSchema = params.config?.responseSchema;
              capturedMime = params.config?.responseMimeType;
              return { text: '{"suppliedFactsUsed":["Brand"],"aiSuggestions":{"channelMixRationale":"Focused"}}' };
            },
          },
        }),
      },
    );

    assert.equal(capturedMime, 'application/json');
    assert.deepEqual(capturedSchema, validSchema);
  });
});

test('generateGeminiContent falls back to gemini-3.1-flash-lite after consecutive 503 overload errors or primary per-attempt timeout', async () => {
  const schema = {
    type: 'OBJECT',
    properties: {
      objectives: { type: 'ARRAY', items: { type: 'STRING' } },
    },
    required: ['objectives'],
  };

  await withEnv({ GEMINI_API_KEY: 'AIzaSyFallbackTestKey98765' }, async () => {
    // 1. Consecutive 503 overload on gemini-4-hydrogen falls back to gemini-3.1-flash-lite on Attempt 3
    const seenModels503: string[] = [];
    const seenThinking503: Array<unknown> = [];
    let seenFallbackSchema: Record<string, unknown> | undefined;

    const recovered503 = await generateGeminiContent(
      {
        prompt: 'Generate content objectives',
        model: 'gemini-4-hydrogen',
        responseMimeType: 'application/json',
        responseSchema: schema,
      },
      {
        maxRetries: 2,
        retryBaseDelayMs: 5,
        clientFactory: () => ({
          models: {
            async generateContent(params) {
              seenModels503.push(params.model);
              seenThinking503.push(params.config?.thinkingConfig);
              if (params.model === 'gemini-4-hydrogen') {
                const err = new Error('503 UNAVAILABLE overloaded') as Error & { status?: number };
                err.status = 503;
                throw err;
              }
              seenFallbackSchema = params.config?.responseSchema;
              return { text: '{"objectives":["Recovered via fallback"]}' };
            },
          },
        }),
      },
    );

    assert.deepEqual(seenModels503, [
      'gemini-4-hydrogen',
      'gemini-4-hydrogen',
      FALLBACK_GEMINI_MODEL,
    ]);
    assert.equal((seenThinking503[0] as { thinkingLevel?: ThinkingLevel })?.thinkingLevel, ThinkingLevel.LOW);
    assert.equal(seenThinking503[2], undefined);
    assert.deepEqual(seenFallbackSchema, schema);
    assert.equal(recovered503.model, FALLBACK_GEMINI_MODEL);
    assert.equal(recovered503.text, '{"objectives":["Recovered via fallback"]}');

    // 2. Stalled Attempt 1 hitting per-attempt timeout cap aborts primary and recovers immediately on gemini-3.1-flash-lite
    const seenModelsTimeout: string[] = [];
    let primaryAborted = false;

    const recoveredTimeout = await generateGeminiContent(
      {
        prompt: 'Generate content pillars',
        model: 'gemini-4-hydrogen',
        responseMimeType: 'application/json',
        responseSchema: schema,
      },
      {
        timeoutMs: 600,
        attemptTimeoutMs: 40,
        maxRetries: 2,
        retryBaseDelayMs: 5,
        clientFactory: () => ({
          models: {
            generateContent(params) {
              seenModelsTimeout.push(params.model);
              if (params.model === 'gemini-4-hydrogen') {
                return new Promise((_resolve, reject) => {
                  params.config?.abortSignal?.addEventListener('abort', () => {
                    primaryAborted = true;
                    reject(Object.assign(new Error('Aborted'), { name: 'AbortError' }));
                  });
                });
              }
              return Promise.resolve({ text: '{"objectives":["Recovered after timeout"]}' });
            },
          },
        }),
      },
    );

    assert.equal(primaryAborted, true);
    assert.deepEqual(seenModelsTimeout, ['gemini-4-hydrogen', FALLBACK_GEMINI_MODEL]);
    assert.equal(recoveredTimeout.model, FALLBACK_GEMINI_MODEL);
    assert.equal(recoveredTimeout.text, '{"objectives":["Recovered after timeout"]}');
  });
});

test('Gemini errors carry explicit errorCategory values and diagnostic logs include requestId/stage without raw prompts or secrets', async () => {
  const mapped429 = sanitizeProviderError(Object.assign(new Error('RESOURCE_EXHAUSTED'), { status: 429 }));
  assert.equal(mapped429.errorCategory, 'rate_limited');

  const mapped503 = sanitizeProviderError(Object.assign(new Error('503 UNAVAILABLE'), { status: 503 }));
  assert.equal(mapped503.errorCategory, 'provider_unavailable');

  const mapped401 = sanitizeProviderError(Object.assign(new Error('API key invalid'), { status: 401 }));
  assert.equal(mapped401.errorCategory, 'authentication_failure');

  const mappedNet = sanitizeProviderError(new Error('fetch failed ECONNRESET'));
  assert.equal(mappedNet.errorCategory, 'network_failure');

  const timeoutErr = new GeminiTimeoutError();
  assert.equal(timeoutErr.errorCategory, 'request_timeout');

  const configErr = new GeminiConfigError();
  assert.equal(configErr.errorCategory, 'provider_unavailable');

  // Empty model output maps to invalid_ai_response and logs sanitized diagnostic metadata
  const logged: string[] = [];
  const origErr = console.error;
  console.error = (...args: unknown[]) => logged.push(args.map(String).join(' '));
  try {
    await withEnv({ GEMINI_API_KEY: 'AIzaSyDiagSecret12345' }, async () => {
      await assert.rejects(
        () =>
          generateGeminiContent(
            { prompt: 'SECRET_PROMPT_TEXT_MUST_NOT_APPEAR_IN_LOGS', model: 'gemini-4-hydrogen' },
            {
              diagnostics: {
                requestId: 'req-diag-777',
                brandId: 'brand-diag-1',
                promptId: 'content_calendar_weekly_batch',
                stage: 'prompt_execute',
              },
              clientFactory: () => ({
                models: {
                  async generateContent() {
                    return { text: '   ' };
                  },
                },
              }),
            },
          ),
        (err: unknown) =>
          err instanceof GeminiProviderError && err.errorCategory === 'invalid_ai_response',
      );
    });
  } finally {
    console.error = origErr;
  }

  const combinedLogs = logged.join('\n');
  assert.match(combinedLogs, /req-diag-777/);
  assert.match(combinedLogs, /content_calendar_weekly_batch/);
  assert.equal(combinedLogs.includes('SECRET_PROMPT_TEXT_MUST_NOT_APPEAR_IN_LOGS'), false);
  assert.equal(combinedLogs.includes('AIzaSyDiagSecret12345'), false);
});

test('generateGeminiContent recovers from 429 rate limits via gemini-3.1-flash-lite fallback, cooldown routing, and bounded RPM retry', async () => {
  clearGeminiRateLimitCooldowns();

  // Helper extraction checks
  assert.equal(
    extractRetryAfterMs(new Error('RESOURCE_EXHAUSTED. Please retry in 12.2s.')),
    12_200,
  );
  assert.equal(
    extractRetryAfterMs({ details: [{ retryDelay: '3s' }] }),
    3_000,
  );
  assert.equal(
    extractRetryAfterMs({
      headers: { get: (name: string) => (name === 'retry-after' ? '25' : null) },
    }),
    25_000,
  );
  assert.equal(
    isHardQuotaExhaustionError(new Error('Quota exceeded for GenerateRequestsPerDayPerProjectPerModel')),
    true,
  );
  assert.equal(
    isHardQuotaExhaustionError(new Error('RESOURCE_EXHAUSTED: RPM burst')),
    false,
  );

  let fakeNow = 1_700_000_000_000;
  const now = () => fakeNow;

  await withEnv({ GEMINI_API_KEY: 'AIzaSyRateLimitFallbackTestKey12345' }, async () => {
    // 1. Primary 429 immediately falls back to gemini-3.1-flash-lite (without thinkingConfig) and succeeds
    const callModels1: string[] = [];
    const callThinking1: Array<unknown> = [];

    const recovered = await generateGeminiContent(
      {
        prompt: 'Generate LinkedIn post draft',
        model: DEFAULT_GEMINI_MODEL,
        responseMimeType: 'application/json',
      },
      {
        retryBaseDelayMs: 5,
        now,
        clientFactory: () => ({
          models: {
            async generateContent(params) {
              callModels1.push(params.model);
              callThinking1.push(params.config?.thinkingConfig);
              if (params.model === DEFAULT_GEMINI_MODEL) {
                const err = new Error('429 RESOURCE_EXHAUSTED Please retry in 30s') as Error & {
                  status?: number;
                };
                err.status = 429;
                throw err;
              }
              return { text: '{"ok":true,"draft":"Ready"}' };
            },
          },
        }),
      },
    );

    assert.deepEqual(callModels1, [DEFAULT_GEMINI_MODEL, FALLBACK_GEMINI_MODEL]);
    assert.equal(
      (callThinking1[0] as { thinkingLevel?: ThinkingLevel })?.thinkingLevel,
      ThinkingLevel.LOW,
    );
    assert.equal(callThinking1[1], undefined);
    assert.equal(recovered.model, FALLBACK_GEMINI_MODEL);
    assert.equal(recovered.text, '{"ok":true,"draft":"Ready"}');
    assert.ok(getModelRateLimitCooldownRemainingMs(DEFAULT_GEMINI_MODEL, fakeNow) > 0);

    // 2. Subsequent call during cooldown skips primary and routes directly to gemini-3.1-flash-lite
    const callModels2: string[] = [];
    const cooldownRouted = await generateGeminiContent(
      {
        prompt: 'Generate carousel draft',
        model: DEFAULT_GEMINI_MODEL,
      },
      {
        retryBaseDelayMs: 5,
        now,
        clientFactory: () => ({
          models: {
            async generateContent(params) {
              callModels2.push(params.model);
              return { text: 'Routed straight to lite' };
            },
          },
        }),
      },
    );
    assert.deepEqual(callModels2, [FALLBACK_GEMINI_MODEL]);
    assert.equal(cooldownRouted.model, FALLBACK_GEMINI_MODEL);

    // 3. Once cooldown expires, primary model is automatically used again
    fakeNow += DEFAULT_RATE_LIMIT_COOLDOWN_MS + 1_000;
    assert.equal(getModelRateLimitCooldownRemainingMs(DEFAULT_GEMINI_MODEL, fakeNow), 0);

    const callModels3: string[] = [];
    const resumedPrimary = await generateGeminiContent(
      {
        prompt: 'Generate article draft',
        model: DEFAULT_GEMINI_MODEL,
      },
      {
        retryBaseDelayMs: 5,
        now,
        clientFactory: () => ({
          models: {
            async generateContent(params) {
              callModels3.push(params.model);
              return { text: 'Primary resumed' };
            },
          },
        }),
      },
    );
    assert.deepEqual(callModels3, [DEFAULT_GEMINI_MODEL]);
    assert.equal(resumedPrimary.model, DEFAULT_GEMINI_MODEL);

    // 4. Brief transient RPM 429 on fallback model allows 1 bounded retry and succeeds
    clearGeminiRateLimitCooldowns();
    const callModels4: string[] = [];
    let liteHits = 0;
    const recoveredAfterBriefBurst = await generateGeminiContent(
      {
        prompt: 'Generate short script',
        model: DEFAULT_GEMINI_MODEL,
      },
      {
        retryBaseDelayMs: 5,
        useRateLimitCooldown: false,
        clientFactory: () => ({
          models: {
            async generateContent(params) {
              callModels4.push(params.model);
              if (params.model === DEFAULT_GEMINI_MODEL) {
                throw Object.assign(new Error('RESOURCE_EXHAUSTED'), { status: 429 });
              }
              liteHits += 1;
              if (liteHits === 1) {
                throw Object.assign(new Error('RESOURCE_EXHAUSTED retry in 10ms'), { status: 429 });
              }
              return { text: 'Recovered after brief RPM burst' };
            },
          },
        }),
      },
    );
    assert.deepEqual(callModels4, [
      DEFAULT_GEMINI_MODEL,
      FALLBACK_GEMINI_MODEL,
      FALLBACK_GEMINI_MODEL,
    ]);
    assert.equal(recoveredAfterBriefBurst.text, 'Recovered after brief RPM burst');

    // 5. Long retryDelay (e.g. 42s) on fallback fails fast without hanging or leaking secrets
    clearGeminiRateLimitCooldowns();
    const callModels5: string[] = [];
    await assert.rejects(
      () =>
        generateGeminiContent(
          {
            prompt: 'Exhausted everywhere',
            model: DEFAULT_GEMINI_MODEL,
          },
          {
            retryBaseDelayMs: 5,
            useRateLimitCooldown: false,
            clientFactory: () => ({
              models: {
                async generateContent(params) {
                  callModels5.push(params.model);
                  throw Object.assign(
                    new Error(
                      'RESOURCE_EXHAUSTED secret=AIzaSyMustNeverLeak Please retry in 42s',
                    ),
                    { status: 429 },
                  );
                },
              },
            }),
          },
        ),
      (err: unknown) => {
        assert.ok(err instanceof GeminiProviderError);
        assert.equal(err.statusCode, 429);
        assert.equal(err.errorCategory, 'rate_limited');
        assert.equal(err.retryAfterSeconds, 42);
        assert.match(err.message, /42 seconds/i);
        assert.equal(err.message.includes('AIzaSyMustNeverLeak'), false);
        return true;
      },
    );
    assert.deepEqual(callModels5, [DEFAULT_GEMINI_MODEL, FALLBACK_GEMINI_MODEL]);
  });

  clearGeminiRateLimitCooldowns();
});




