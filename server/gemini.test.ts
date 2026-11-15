import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_GEMINI_MODEL,
  GeminiConfigError,
  GeminiProviderError,
  GeminiTimeoutError,
  MAX_CONTEXT_LENGTH,
  MAX_PROMPT_LENGTH,
  buildGeminiContents,
  generateGeminiContent,
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
  });
  assert.equal(validAltModel.error, undefined);
  assert.equal(validAltModel.data?.model, 'gemini-3.1-flash-lite');
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

test('sanitizeProviderError maps 429 rate limits cleanly', () => {
  const rateErr = Object.assign(new Error('RESOURCE_EXHAUSTED with secret xyz'), {
    status: 429,
  });
  const mapped = sanitizeProviderError(rateErr);
  assert.ok(mapped instanceof GeminiProviderError);
  assert.equal(mapped.statusCode, 429);
  assert.equal(mapped.message.includes('xyz'), false);
});
