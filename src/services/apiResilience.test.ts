import test from 'node:test';
import assert from 'node:assert/strict';
import {
  UserCancelledRequestError,
  fetchJsonWithResilience,
  fetchPromptExecutionWithResilience,
  formatFriendlyNetworkError,
  isTransientNetworkError,
} from './apiResilience.ts';
import { ClassifiedAiError } from './promptResponseParser.ts';

function makeMockResponse(params: {
  ok: boolean;
  status: number;
  contentType?: string | null;
  bodyText: string;
}) {
  return {
    ok: params.ok,
    status: params.status,
    headers: {
      get(name: string) {
        return name.toLowerCase() === 'content-type'
          ? (params.contentType ?? 'application/json')
          : null;
      },
    },
    async text() {
      return params.bodyText;
    },
  };
}

const VALID_PROMPT_SUCCESS_BODY = JSON.stringify({
  status: 'success',
  brandId: 'brand-1',
  promptId: 'content_strategy_objectives',
  promptVersion: '1.0.0',
  targetModule: 'contentStrategy',
  sourceClassification: 'reconstructed',
  model: 'gemini-4-hydrogen',
  generatedAt: '2026-11-21T00:00:00.000Z',
  rawText: '{"objectives":[]}',
  output: { objectives: [] },
  metadata: {
    promptId: 'content_strategy_objectives',
    promptVersion: '1.0.0',
    targetModule: 'contentStrategy',
    sourceClassification: 'reconstructed',
    brandId: 'brand-1',
    model: 'gemini-4-hydrogen',
    generatedAt: '2026-11-21T00:00:00.000Z',
  },
  canSave: true,
});

test('fetchPromptExecutionWithResilience recovers automatically from transient Failed to fetch and 503/HTML warmup responses', async () => {
  assert.equal(isTransientNetworkError(new TypeError('Failed to fetch')), true);
  assert.equal(isTransientNetworkError(new TypeError('Load failed')), true);

  // 1. Transient TypeError('Failed to fetch') on Attempt 1 recovers on Attempt 2
  let netAttempts = 0;
  const netRecovered = await fetchPromptExecutionWithResilience({
    url: '/api/brands/b1/prompts/execute',
    init: { method: 'POST', body: '{}' },
    retryDelayMs: 5,
    fetchImpl: async () => {
      netAttempts += 1;
      if (netAttempts === 1) {
        throw new TypeError('Failed to fetch');
      }
      return makeMockResponse({ ok: true, status: 200, bodyText: VALID_PROMPT_SUCCESS_BODY });
    },
  });
  assert.equal(netAttempts, 2);
  assert.equal(netRecovered.status, 'success');

  // 2. Persistent Failed to fetch is translated cleanly and never leaks raw browser text
  let persistentNetAttempts = 0;
  await assert.rejects(
    () =>
      fetchPromptExecutionWithResilience({
        url: '/api/brands/b1/prompts/execute',
        init: { method: 'POST', body: '{}' },
        retryDelayMs: 5,
        fetchImpl: async () => {
          persistentNetAttempts += 1;
          throw new TypeError('Failed to fetch');
        },
      }),
    (err: unknown) => {
      assert.ok(err instanceof Error);
      assert.equal(err.message.includes('Failed to fetch'), false);
      assert.match(err.message, /connection to the ai service was interrupted/i);
      return true;
    },
  );
  assert.equal(persistentNetAttempts, 2);

  // 3. Transient 503 busy or preview Nginx 500{upstreamStatus:503} or 200 HTML warmup retries once and succeeds
  for (const firstResp of [
    makeMockResponse({
      ok: false,
      status: 503,
      bodyText: JSON.stringify({ error: 'AI service is temporarily busy. Please try again in a moment.' }),
    }),
    makeMockResponse({
      ok: false,
      status: 500,
      bodyText: JSON.stringify({
        error: 'AI service is temporarily busy. Please try again in a moment.',
        upstreamStatus: 503,
      }),
    }),
    makeMockResponse({
      ok: true,
      status: 200,
      contentType: 'text/html; charset=utf-8',
      bodyText: '<!doctype html><html><body>Starting Server...</body></html>',
    }),
  ]) {
    let attempts = 0;
    const recovered = await fetchPromptExecutionWithResilience({
      url: '/api/brands/b1/prompts/execute',
      init: { method: 'POST', body: '{}' },
      retryDelayMs: 5,
      fetchImpl: async () => {
        attempts += 1;
        return attempts === 1
          ? firstResp
          : makeMockResponse({ ok: true, status: 200, bodyText: VALID_PROMPT_SUCCESS_BODY });
      },
    });
    assert.equal(attempts, 2);
    assert.equal(recovered.status, 'success');
  }

  // 4. Non-retryable 429 rate limit and 422 validation errors are NOT retried
  let rateAttempts = 0;
  await assert.rejects(
    () =>
      fetchPromptExecutionWithResilience({
        url: '/api/brands/b1/prompts/execute',
        init: { method: 'POST', body: '{}' },
        retryDelayMs: 5,
        fetchImpl: async () => {
          rateAttempts += 1;
          return makeMockResponse({
            ok: false,
            status: 429,
            bodyText: JSON.stringify({
              error: 'AI provider rate limit reached. Please wait a moment and try again.',
            }),
          });
        },
      }),
    /rate limit reached/i,
  );
  assert.equal(rateAttempts, 1);

  // 5. Client timeout translates AbortError cleanly
  const timeoutErr = formatFriendlyNetworkError(
    Object.assign(new Error('The operation was aborted'), { name: 'AbortError' }),
    'ai',
  );
  assert.match(timeoutErr.message, /timed out/i);
});

test('fetchJsonWithResilience retries GET on transient network failure and never leaks raw Failed to fetch on PUT mutations', async () => {
  // GET retries once on transient network drop
  let getAttempts = 0;
  const data = await fetchJsonWithResilience<{ modules: unknown[] }>({
    url: '/api/brands/b1/strategy-modules',
    init: { method: 'GET' },
    retryDelayMs: 5,
    fetchImpl: async () => {
      getAttempts += 1;
      if (getAttempts === 1) throw new TypeError('Failed to fetch');
      return makeMockResponse({ ok: true, status: 200, bodyText: '{"modules":[]}' });
    },
  });
  assert.equal(getAttempts, 2);
  assert.deepEqual(data, { modules: [] });

  // PUT mutation fails cleanly without duplicate retries and without raw Failed to fetch text
  let putAttempts = 0;
  await assert.rejects(
    () =>
      fetchJsonWithResilience({
        url: '/api/brands/b1/strategy-modules/contentStrategy',
        init: { method: 'PUT', body: '{}' },
        retryDelayMs: 5,
        fetchImpl: async () => {
          putAttempts += 1;
          throw new TypeError('Failed to fetch');
        },
      }),
    (err: unknown) => {
      assert.ok(err instanceof Error);
      assert.equal(err.message.includes('Failed to fetch'), false);
      assert.match(err.message, /unable to reach the server/i);
      return true;
    },
  );
  assert.equal(putAttempts, 1);
});

test('fetchPromptExecutionWithResilience respects caller AbortSignal as request_cancelled without retrying or reporting timeout', async () => {
  const controller = new AbortController();
  let attempts = 0;

  await assert.rejects(
    () =>
      fetchPromptExecutionWithResilience({
        url: '/api/brands/b1/prompts/execute',
        init: { method: 'POST', body: '{}', signal: controller.signal },
        retryDelayMs: 5,
        fetchImpl: async (_url, init) => {
          attempts += 1;
          controller.abort();
          if (init?.signal?.aborted) {
            throw Object.assign(new Error('The operation was aborted'), { name: 'AbortError' });
          }
          throw Object.assign(new Error('The operation was aborted'), { name: 'AbortError' });
        },
      }),
    (err: unknown) => {
      assert.ok(err instanceof UserCancelledRequestError);
      assert.equal(err.errorCategory, 'request_cancelled');
      assert.equal(err.message.toLowerCase().includes('timed out'), false);
      return true;
    },
  );
  assert.equal(attempts, 1);

  // Server ClassifiedAiError carries explicit errorCategory & requestId
  await assert.rejects(
    () =>
      fetchPromptExecutionWithResilience({
        url: '/api/brands/b1/prompts/execute',
        init: { method: 'POST', body: '{}' },
        retryDelayMs: 5,
        fetchImpl: async () =>
          makeMockResponse({
            ok: false,
            status: 500,
            bodyText: JSON.stringify({
              error: 'AI service is temporarily busy. Please try again in a moment.',
              upstreamStatus: 503,
              errorCategory: 'provider_unavailable',
              requestId: 'req-abc-123',
            }),
          }),
      }),
    (err: unknown) => {
      assert.ok(err instanceof ClassifiedAiError);
      assert.equal(err.errorCategory, 'provider_unavailable');
      assert.equal(err.requestId, 'req-abc-123');
      return true;
    },
  );
});

