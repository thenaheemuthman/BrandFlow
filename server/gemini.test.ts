import test from 'node:test';
import assert from 'node:assert/strict';
import { ThinkingLevel } from '@google/genai';
import {
  DEFAULT_AI_TIMEOUT_MS,
  DEFAULT_GEMINI_MODEL,
  GeminiConfigError,
  GeminiProviderError,
  GeminiTimeoutError,
  MAX_CONTEXT_LENGTH,
  MAX_PROMPT_LENGTH,
  buildGeminiContents,
  generateGeminiContent,
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

      // 3. Verify non-retryable 429 fails immediately without retrying
      let rateAttempts = 0;
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
              clientFactory: () => ({
                models: {
                  async generateContent() {
                    rateAttempts += 1;
                    const err = new Error('RESOURCE_EXHAUSTED') as Error & { status?: number };
                    err.status = 429;
                    throw err;
                  },
                },
              }),
            },
          ),
        (err: unknown) => err instanceof GeminiProviderError && err.statusCode === 429,
      );
      assert.equal(rateAttempts, 1);

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
