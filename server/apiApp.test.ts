import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import { createApiApp, type CreateApiAppOptions } from './apiApp.ts';
import { LocalJsonStorageRepository } from './storage.ts';
import {
  DEFAULT_GEMINI_MODEL,
  GeminiProviderError,
  GeminiTimeoutError,
  MAX_CONTEXT_LENGTH,
  MAX_PROMPT_LENGTH,
  generateGeminiContent,
} from './gemini.ts';
import type { BrandModuleStatuses } from '../src/types/brand.ts';

const OWNER_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_USER_ID = '99999999-9999-4999-8999-999999999999';
const OWNED_BRAND_ID = '22222222-2222-4222-8222-222222222222';
const FOREIGN_BRAND_ID = '33333333-3333-4333-8333-333333333333';

interface StubSupabaseState {
  brands: Map<
    string,
    {
      id: string;
      user_id: string;
      brand_name: string;
      business_description: string;
      industry: string;
      products_or_services: string;
      target_market: string;
      primary_location: string;
      website_url: string;
      social_links: string;
      existing_mission: string;
      existing_vision: string;
      marketing_challenges: string;
      business_goals: string;
      competitors: string;
      additional_notes: string;
      module_statuses: BrandModuleStatuses;
      content_pieces_count: number;
      pending_approvals_count: number;
      created_at: string;
      updated_at: string;
      last_accessed_at: string;
    }
  >;
  modules: Map<string, Record<string, unknown>>;
  activities: Array<Record<string, unknown>>;
}

function createInitialState(): StubSupabaseState {
  const brands = new Map();
  brands.set(OWNED_BRAND_ID, {
    id: OWNED_BRAND_ID,
    user_id: OWNER_ID,
    brand_name: 'Solstice Health',
    business_description: 'Preventive diagnostics and personalized wellness membership.',
    industry: 'Health & Wellness',
    products_or_services: 'Biomarker panels and longevity care plans',
    target_market: 'Health-conscious adults ages 28-55',
    primary_location: 'Austin, TX',
    website_url: 'https://solstice.example.com',
    social_links: '',
    existing_mission: '',
    existing_vision: '',
    marketing_challenges: '',
    business_goals: '',
    competitors: '',
    additional_notes: '',
    module_statuses: {
      brandFoundation: 'not_started',
      brandMessaging: 'not_started',
      customerIntelligence: 'completed',
      marketingStrategy: 'not_started',
      contentStrategy: 'not_started',
      contentCalendar: 'not_started',
      contentStudio: 'not_started',
    },
    content_pieces_count: 0,
    pending_approvals_count: 0,
    created_at: '2026-11-14T10:00:00.000Z',
    updated_at: '2026-11-14T10:00:00.000Z',
    last_accessed_at: '2026-11-14T10:00:00.000Z',
  });
  return {
    brands,
    modules: new Map(),
    activities: [],
  };
}

async function withTestServer(
  run: (baseUrl: string, state: StubSupabaseState) => Promise<void>,
  appOptions?: CreateApiAppOptions,
) {
  const originalEnv = {
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
    BRANDFLOW_OWNER_USER_ID: process.env.BRANDFLOW_OWNER_USER_ID,
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    NGINX_PORT: process.env.NGINX_PORT,
  };
  const originalFetch = globalThis.fetch;

  process.env.SUPABASE_URL = 'https://example.supabase.co';
  process.env.SUPABASE_ANON_KEY = 'anon-test-key';
  process.env.BRANDFLOW_OWNER_USER_ID = OWNER_ID;
  delete process.env.NGINX_PORT;

  const state = createInitialState();

  const server = http.createServer(createApiApp(appOptions));
  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve());
  });
  const address = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${address.port}`;

  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString();

    if (!url.startsWith('https://example.supabase.co')) {
      return originalFetch(input, init);
    }

    const parsed = new URL(url);
    const headers = (init?.headers ?? {}) as Record<string, string>;
    const authHeader = headers.Authorization ?? headers.authorization ?? '';
    const method = init?.method ?? 'GET';
    const bodyText = typeof init?.body === 'string' ? init.body : undefined;

    if (parsed.pathname === '/auth/v1/user') {
      if (authHeader === 'Bearer owner-token') {
        return new Response(JSON.stringify({ id: OWNER_ID, email: 'owner@example.com' }), {
          status: 200,
        });
      }
      if (authHeader === 'Bearer other-token') {
        return new Response(JSON.stringify({ id: OTHER_USER_ID, email: 'other@example.com' }), {
          status: 200,
        });
      }
      return new Response(JSON.stringify({ message: 'Invalid JWT' }), { status: 401 });
    }

    if (parsed.pathname === '/rest/v1/brands') {
      const idFilter = parsed.searchParams.get('id');
      const requestedId = idFilter?.startsWith('eq.') ? idFilter.slice(3) : null;

      if (method === 'GET') {
        if (requestedId) {
          const brand = state.brands.get(requestedId);
          return new Response(
            JSON.stringify(brand && brand.user_id === OWNER_ID ? [brand] : []),
            { status: 200 },
          );
        }
        return new Response(JSON.stringify([...state.brands.values()]), { status: 200 });
      }

      if (method === 'PATCH' && requestedId) {
        const brand = state.brands.get(requestedId);
        if (brand) {
          const patch = JSON.parse(bodyText ?? '{}') as Record<string, unknown>;
          state.brands.set(requestedId, {
            ...brand,
            ...(patch as Partial<typeof brand>),
          });
        }
        return new Response(null, { status: 204 });
      }
    }

    if (parsed.pathname === '/rest/v1/brand_strategy_modules') {
      const brandFilter = parsed.searchParams.get('brand_id')?.replace(/^eq\./, '');
      const keyFilter = parsed.searchParams.get('module_key')?.replace(/^eq\./, '');
      const idFilter = parsed.searchParams.get('id')?.replace(/^eq\./, '');

      if (method === 'GET') {
        const rows = [...state.modules.values()].filter((m) => {
          if (brandFilter && m.brand_id !== brandFilter) return false;
          if (keyFilter && m.module_key !== keyFilter) return false;
          return true;
        });
        return new Response(JSON.stringify(rows), { status: 200 });
      }

      if (method === 'POST') {
        const payload = JSON.parse(bodyText ?? '{}') as Record<string, unknown>;
        const compositeKey = `${String(payload.brand_id)}:${String(payload.module_key)}`;
        const now = new Date().toISOString();
        const existing = state.modules.get(compositeKey);
        const row = {
          id: existing?.id ?? '44444444-4444-4444-8444-444444444444',
          created_at: existing?.created_at ?? now,
          ...payload,
        };
        state.modules.set(compositeKey, row);
        return new Response(JSON.stringify([row]), { status: 201 });
      }

      if (method === 'PATCH') {
        const payload = JSON.parse(bodyText ?? '{}') as Record<string, unknown>;
        for (const [k, row] of state.modules.entries()) {
          if (idFilter && row.id === idFilter) {
            const updated = { ...row, ...payload };
            state.modules.set(k, updated);
            return new Response(JSON.stringify([updated]), { status: 200 });
          }
        }
        return new Response(JSON.stringify([]), { status: 200 });
      }

      if (method === 'DELETE') {
        const deleted: Array<Record<string, unknown>> = [];
        for (const [k, row] of state.modules.entries()) {
          if (
            (!brandFilter || row.brand_id === brandFilter) &&
            (!keyFilter || row.module_key === keyFilter)
          ) {
            deleted.push(row);
            state.modules.delete(k);
          }
        }
        return new Response(JSON.stringify(deleted), { status: 200 });
      }
    }

    if (parsed.pathname === '/rest/v1/brand_activities' && method === 'POST') {
      const payload = JSON.parse(bodyText ?? '{}') as Record<string, unknown>;
      const allowedActivityTypes = new Set([
        'brand_created',
        'brand_updated',
        'workspace_accessed',
        'brand_deleted',
        'module_updated',
        'module_completed',
      ]);
      if (typeof payload.type !== 'string' || !allowedActivityTypes.has(payload.type)) {
        return new Response(
          JSON.stringify({
            message:
              'new row for relation "brand_activities" violates check constraint "brand_activities_type_check"',
          }),
          { status: 400 },
        );
      }
      state.activities.unshift(payload);
      return new Response(null, { status: 201 });
    }

    return new Response('Unhandled stubbed Supabase request', { status: 500 });
  }) as typeof fetch;

  try {
    await run(baseUrl, state);
  } finally {
    globalThis.fetch = originalFetch;
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });

    if (originalEnv.SUPABASE_URL === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = originalEnv.SUPABASE_URL;

    if (originalEnv.SUPABASE_ANON_KEY === undefined) delete process.env.SUPABASE_ANON_KEY;
    else process.env.SUPABASE_ANON_KEY = originalEnv.SUPABASE_ANON_KEY;

    if (originalEnv.BRANDFLOW_OWNER_USER_ID === undefined) delete process.env.BRANDFLOW_OWNER_USER_ID;
    else process.env.BRANDFLOW_OWNER_USER_ID = originalEnv.BRANDFLOW_OWNER_USER_ID;

    if (originalEnv.GEMINI_API_KEY === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = originalEnv.GEMINI_API_KEY;

    if (originalEnv.NGINX_PORT === undefined) delete process.env.NGINX_PORT;
    else process.env.NGINX_PORT = originalEnv.NGINX_PORT;
  }
}

test('Phase 2A strategy module endpoints enforce authentication and owner-only access', async () => {
  await withTestServer(async (baseUrl) => {
    const routes = [
      { method: 'GET', path: `/api/brands/${OWNED_BRAND_ID}/strategy-modules` },
      { method: 'GET', path: `/api/brands/${OWNED_BRAND_ID}/strategy-modules/brandFoundation` },
      { method: 'PUT', path: `/api/brands/${OWNED_BRAND_ID}/strategy-modules/brandFoundation` },
      { method: 'DELETE', path: `/api/brands/${OWNED_BRAND_ID}/strategy-modules/brandFoundation` },
    ];

    for (const route of routes) {
      const unauthRes = await fetch(`${baseUrl}${route.path}`, {
        method: route.method,
        headers: { 'Content-Type': 'application/json' },
        body: route.method === 'PUT' ? JSON.stringify({ status: 'in_progress' }) : undefined,
      });
      assert.equal(unauthRes.status, 401, `${route.method} ${route.path} should require auth`);

      const nonOwnerRes = await fetch(`${baseUrl}${route.path}`, {
        method: route.method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer other-token',
        },
        body: route.method === 'PUT' ? JSON.stringify({ status: 'in_progress' }) : undefined,
      });
      assert.equal(nonOwnerRes.status, 403, `${route.method} ${route.path} should reject non-owner`);
    }
  });
});

test('Phase 2A strategy module endpoints validate brand IDs, module keys, payloads, and missing brands', async () => {
  await withTestServer(async (baseUrl) => {
    const authHeaders = {
      'Content-Type': 'application/json',
      Authorization: 'Bearer owner-token',
    };

    // Invalid brand UUID
    const badIdRes = await fetch(`${baseUrl}/api/brands/not-a-uuid/strategy-modules`, {
      headers: authHeaders,
    });
    assert.equal(badIdRes.status, 400);

    // Unsupported module key
    const badKeyRes = await fetch(
      `${baseUrl}/api/brands/${OWNED_BRAND_ID}/strategy-modules/contentCalendar`,
      { headers: authHeaders },
    );
    assert.equal(badKeyRes.status, 400);

    // Invalid status
    const badStatusRes = await fetch(
      `${baseUrl}/api/brands/${OWNED_BRAND_ID}/strategy-modules/brandFoundation`,
      {
        method: 'PUT',
        headers: authHeaders,
        body: JSON.stringify({ status: 'published' }),
      },
    );
    assert.equal(badStatusRes.status, 400);

    // Non-object content
    const badContentRes = await fetch(
      `${baseUrl}/api/brands/${OWNED_BRAND_ID}/strategy-modules/brandFoundation`,
      {
        method: 'PUT',
        headers: authHeaders,
        body: JSON.stringify({ status: 'in_progress', content: ['bad'] }),
      },
    );
    assert.equal(badContentRes.status, 400);

    // Empty body
    const emptyBodyRes = await fetch(
      `${baseUrl}/api/brands/${OWNED_BRAND_ID}/strategy-modules/brandFoundation`,
      {
        method: 'PUT',
        headers: authHeaders,
        body: JSON.stringify({}),
      },
    );
    assert.equal(emptyBodyRes.status, 400);

    // Foreign / missing brand -> 404
    const foreignGetRes = await fetch(
      `${baseUrl}/api/brands/${FOREIGN_BRAND_ID}/strategy-modules`,
      { headers: authHeaders },
    );
    assert.equal(foreignGetRes.status, 404);

    const foreignPutRes = await fetch(
      `${baseUrl}/api/brands/${FOREIGN_BRAND_ID}/strategy-modules/brandFoundation`,
      {
        method: 'PUT',
        headers: authHeaders,
        body: JSON.stringify({ status: 'in_progress', content: { mission: 'Test' } }),
      },
    );
    assert.equal(foreignPutRes.status, 404);
  });
});

test('Phase 2A strategy module endpoints execute full list, get, upsert, and delete lifecycle', async () => {
  await withTestServer(async (baseUrl, state) => {
    const authHeaders = {
      'Content-Type': 'application/json',
      Authorization: 'Bearer owner-token',
    };

    // Initially empty list and 404 for uncreated module
    const emptyListRes = await fetch(
      `${baseUrl}/api/brands/${OWNED_BRAND_ID}/strategy-modules`,
      { headers: authHeaders },
    );
    assert.equal(emptyListRes.status, 200);
    assert.deepEqual(await emptyListRes.json(), { modules: [] });

    const missingModRes = await fetch(
      `${baseUrl}/api/brands/${OWNED_BRAND_ID}/strategy-modules/brandFoundation`,
      { headers: authHeaders },
    );
    assert.equal(missingModRes.status, 404);

    // Create brandFoundation via PUT
    const putCreateRes = await fetch(
      `${baseUrl}/api/brands/${OWNED_BRAND_ID}/strategy-modules/brandFoundation`,
      {
        method: 'PUT',
        headers: authHeaders,
        body: JSON.stringify({
          status: 'in_progress',
          content: { mission: 'Deliver preventive care.', values: ['Rigor', 'Clarity'] },
          promptId: 'brand_foundation_core',
          promptVersion: '1.0.0',
          model: 'gemini-4-hydrogen',
        }),
      },
    );
    assert.equal(putCreateRes.status, 200);
    const createdBody = (await putCreateRes.json()) as {
      module: { moduleKey: string; status: string; content: Record<string, unknown>; brandId: string };
    };
    assert.equal(createdBody.module.moduleKey, 'brandFoundation');
    assert.equal(createdBody.module.status, 'in_progress');
    assert.equal(createdBody.module.brandId, OWNED_BRAND_ID);

    // Get brandFoundation
    const getSingleRes = await fetch(
      `${baseUrl}/api/brands/${OWNED_BRAND_ID}/strategy-modules/brandFoundation`,
      { headers: authHeaders },
    );
    assert.equal(getSingleRes.status, 200);
    const singleBody = (await getSingleRes.json()) as {
      module: { status: string; content: { mission: string } };
    };
    assert.equal(singleBody.module.status, 'in_progress');
    assert.equal(singleBody.module.content.mission, 'Deliver preventive care.');

    // Update brandFoundation -> completed
    const putUpdateRes = await fetch(
      `${baseUrl}/api/brands/${OWNED_BRAND_ID}/strategy-modules/brandFoundation`,
      {
        method: 'PUT',
        headers: authHeaders,
        body: JSON.stringify({ status: 'completed' }),
      },
    );
    assert.equal(putUpdateRes.status, 200);
    const updatedBody = (await putUpdateRes.json()) as {
      module: { status: string; content: { mission: string } };
    };
    assert.equal(updatedBody.module.status, 'completed');
    assert.equal(updatedBody.module.content.mission, 'Deliver preventive care.');

    // Add second module brandMessaging
    const putSecondRes = await fetch(
      `${baseUrl}/api/brands/${OWNED_BRAND_ID}/strategy-modules/brandMessaging`,
      {
        method: 'PUT',
        headers: authHeaders,
        body: JSON.stringify({
          status: 'in_progress',
          content: { tagline: 'Longevity through precision.' },
        }),
      },
    );
    assert.equal(putSecondRes.status, 200);

    // List both modules
    const listRes = await fetch(
      `${baseUrl}/api/brands/${OWNED_BRAND_ID}/strategy-modules`,
      { headers: authHeaders },
    );
    assert.equal(listRes.status, 200);
    const listBody = (await listRes.json()) as {
      modules: Array<{ moduleKey: string; status: string }>;
    };
    assert.equal(listBody.modules.length, 2);

    // Delete brandFoundation
    const deleteRes = await fetch(
      `${baseUrl}/api/brands/${OWNED_BRAND_ID}/strategy-modules/brandFoundation`,
      { method: 'DELETE', headers: authHeaders },
    );
    assert.equal(deleteRes.status, 200);
    assert.deepEqual(await deleteRes.json(), { deleted: true });

    // brandFoundation now returns 404, brandMessaging remains intact, brand status reset cleanly
    const afterDeleteGetRes = await fetch(
      `${baseUrl}/api/brands/${OWNED_BRAND_ID}/strategy-modules/brandFoundation`,
      { headers: authHeaders },
    );
    assert.equal(afterDeleteGetRes.status, 404);

    const remainingListRes = await fetch(
      `${baseUrl}/api/brands/${OWNED_BRAND_ID}/strategy-modules`,
      { headers: authHeaders },
    );
    assert.equal(remainingListRes.status, 200);
    const remainingListBody = (await remainingListRes.json()) as {
      modules: Array<{ moduleKey: string }>;
    };
    assert.deepEqual(
      remainingListBody.modules.map((m) => m.moduleKey),
      ['brandMessaging'],
    );

    const brandState = state.brands.get(OWNED_BRAND_ID);
    assert.ok(brandState);
    assert.equal(brandState.module_statuses.brandFoundation, 'not_started');
    assert.equal(brandState.module_statuses.brandMessaging, 'in_progress');
    assert.equal(brandState.module_statuses.customerIntelligence, 'completed');

    // Repeating delete on missing module returns 404
    const deleteAgainRes = await fetch(
      `${baseUrl}/api/brands/${OWNED_BRAND_ID}/strategy-modules/brandFoundation`,
      { method: 'DELETE', headers: authHeaders },
    );
    assert.equal(deleteAgainRes.status, 404);

    // Verify all activity events recorded across create, update, second module create, and delete
    assert.deepEqual(
      state.activities.map((a) => a.type),
      ['module_updated', 'module_updated', 'module_completed', 'module_updated'],
    );
  });
});

test('POST /api/ai/generate enforces owner-only auth (401/403) and generates via mocked provider', async () => {
  await withTestServer(
    async (baseUrl) => {
      // 1. Unauthenticated -> 401
      const unauthRes = await fetch(`${baseUrl}/api/ai/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: 'Hello' }),
      });
      assert.equal(unauthRes.status, 401);

      // 2. Non-owner -> 403
      const nonOwnerRes = await fetch(`${baseUrl}/api/ai/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer other-token',
        },
        body: JSON.stringify({ prompt: 'Hello' }),
      });
      assert.equal(nonOwnerRes.status, 403);

      // 3. Valid authenticated owner request
      const okRes = await fetch(`${baseUrl}/api/ai/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer owner-token',
        },
        body: JSON.stringify({
          prompt: 'Draft a brand positioning line.',
          context: { brandName: 'Solstice Health' },
          model: 'gemini-3.1-flash-lite',
        }),
      });
      assert.equal(okRes.status, 200);
      const okBody = (await okRes.json()) as {
        text: string;
        model: string;
        generatedAt: string;
      };
      assert.equal(okBody.text, 'Mocked response for gemini-3.1-flash-lite');
      assert.equal(okBody.model, 'gemini-3.1-flash-lite');
      assert.ok(!Number.isNaN(Date.parse(okBody.generatedAt)));
    },
    {
      generateAiContent: async (input) => ({
        text: `Mocked response for ${input.model}`,
        model: input.model,
        generatedAt: '2026-11-15T14:00:00.000Z',
      }),
    },
  );
});

test('POST /api/ai/generate validates payloads, oversized inputs, and missing GEMINI_API_KEY safely', async () => {
  await withTestServer(async (baseUrl) => {
    delete process.env.GEMINI_API_KEY;
    const authHeaders = {
      'Content-Type': 'application/json',
      Authorization: 'Bearer owner-token',
    };

    // 4. Missing GEMINI_API_KEY -> safe 503 config error
    const missingKeyRes = await fetch(`${baseUrl}/api/ai/generate`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ prompt: 'Generate positioning' }),
    });
    assert.equal(missingKeyRes.status, 503);
    const missingKeyText = await missingKeyRes.text();
    assert.match(missingKeyText, /not configured/i);

    // 5. Invalid bodies -> 400
    const badJsonRes = await fetch(`${baseUrl}/api/ai/generate`, {
      method: 'POST',
      headers: authHeaders,
      body: '{bad-json',
    });
    assert.equal(badJsonRes.status, 400);

    const invalidCases = [
      {},
      { prompt: '' },
      { prompt: 42 },
      { prompt: 'Valid', context: ['array-not-allowed'] },
      { prompt: 'Valid', model: 'gemini-1.5-pro' },
      { prompt: 'Valid', model: 'arbitrary-model-name' },
    ];
    for (const payload of invalidCases) {
      const res = await fetch(`${baseUrl}/api/ai/generate`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify(payload),
      });
      assert.equal(res.status, 400);
    }

    // 6. Oversized prompt, oversized context, and oversized request body
    const longPromptRes = await fetch(`${baseUrl}/api/ai/generate`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ prompt: 'p'.repeat(MAX_PROMPT_LENGTH + 1) }),
    });
    assert.equal(longPromptRes.status, 400);

    const longContextRes = await fetch(`${baseUrl}/api/ai/generate`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        prompt: 'Valid prompt',
        context: 'c'.repeat(MAX_CONTEXT_LENGTH + 1),
      }),
    });
    assert.equal(longContextRes.status, 400);

    const hugeBodyRes = await fetch(`${baseUrl}/api/ai/generate`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ prompt: 'Valid', context: 'x'.repeat(80 * 1024) }),
    });
    assert.equal(hugeBodyRes.status, 413);
    const hugeBodyJson = (await hugeBodyRes.json()) as { error: string };
    assert.match(hugeBodyJson.error, /size limit/i);
  });
});

test('POST /api/ai/generate returns sanitised provider errors and never exposes keys or credentials', async () => {
  const secretKey = 'AIzaSyTestSecretKeyDoNotLeak12345';

  // Use real generateGeminiContent wired with mocked client throwing credentialed error
  await withTestServer(
    async (baseUrl) => {
      process.env.GEMINI_API_KEY = secretKey;
      const authHeaders = {
        'Content-Type': 'application/json',
        Authorization: 'Bearer owner-token',
      };

      const providerFailRes = await fetch(`${baseUrl}/api/ai/generate`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ prompt: 'Test failure sanitisation' }),
      });
      assert.equal(providerFailRes.status, 502);
      const rawBody = await providerFailRes.text();
      assert.equal(rawBody.includes(secretKey), false);
      assert.equal(rawBody.includes('googleapis'), false);
      assert.equal(rawBody.includes('at '), false);
      const parsed = JSON.parse(rawBody) as { error: string };
      assert.ok(parsed.error.length > 0);
    },
    {
      generateAiContent: (input) =>
        generateGeminiContent(input, {
          apiKey: secretKey,
          clientFactory: () => ({
            models: {
              async generateContent() {
                const err = new Error(
                  `Upstream failure with key=${secretKey} at https://generativelanguage.googleapis.com`,
                ) as Error & { status?: number };
                err.status = 500;
                throw err;
              },
            },
          }),
        }),
    },
  );

  // Also test rate-limit and timeout error HTTP statuses
  await withTestServer(
    async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/ai/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer owner-token',
        },
        body: JSON.stringify({ prompt: 'Rate limited', model: DEFAULT_GEMINI_MODEL }),
      });
      assert.equal(res.status, 429);
    },
    {
      generateAiContent: async () => {
        throw new GeminiProviderError('Rate limited', 429);
      },
    },
  );

  await withTestServer(
    async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/ai/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer owner-token',
        },
        body: JSON.stringify({ prompt: 'Timeout test' }),
      });
      assert.equal(res.status, 504);
    },
    {
      generateAiContent: async () => {
        throw new GeminiTimeoutError();
      },
    },
  );
});

test('POST /api/brands/:id/prompts/execute enforces owner auth, brand isolation, draft blocking, missing-info, and structured validation', async () => {
  let aiCallCount = 0;

  await withTestServer(
    async (baseUrl, state) => {
      const ownerHeaders = {
        'Content-Type': 'application/json',
        Authorization: 'Bearer owner-token',
      };

      // 1. Unauthenticated / non-owner rejected
      const noAuth = await fetch(
        `${baseUrl}/api/brands/${OWNED_BRAND_ID}/prompts/execute`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ promptId: 'brand_foundation_synthesis' }),
        },
      );
      assert.equal(noAuth.status, 401);

      const nonOwner = await fetch(
        `${baseUrl}/api/brands/${OWNED_BRAND_ID}/prompts/execute`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer other-token',
          },
          body: JSON.stringify({ promptId: 'brand_foundation_synthesis' }),
        },
      );
      assert.equal(nonOwner.status, 403);

      // 2. Foreign/missing brand isolated with 404
      const foreignBrandRes = await fetch(
        `${baseUrl}/api/brands/${FOREIGN_BRAND_ID}/prompts/execute`,
        {
          method: 'POST',
          headers: ownerHeaders,
          body: JSON.stringify({ promptId: 'brand_foundation_synthesis' }),
        },
      );
      assert.equal(foreignBrandRes.status, 404);

      // 3. Draft original prompt cannot execute
      const draftRes = await fetch(
        `${baseUrl}/api/brands/${OWNED_BRAND_ID}/prompts/execute`,
        {
          method: 'POST',
          headers: ownerHeaders,
          body: JSON.stringify({ promptId: 'brand_foundation_core_values_discovery' }),
        },
      );
      assert.equal(draftRes.status, 400);
      assert.equal(aiCallCount, 0);

      // 4. Incomplete brand returns 422 missing_information without calling AI
      const ownedBrand = state.brands.get(OWNED_BRAND_ID)!;
      const savedTargetMarket = ownedBrand.target_market;
      ownedBrand.target_market = '  ';

      const missingInfoRes = await fetch(
        `${baseUrl}/api/brands/${OWNED_BRAND_ID}/prompts/execute`,
        {
          method: 'POST',
          headers: ownerHeaders,
          body: JSON.stringify({ promptId: 'brand_foundation_synthesis' }),
        },
      );
      assert.equal(missingInfoRes.status, 422);
      const missingBody = (await missingInfoRes.json()) as {
        status: string;
        missingVariables: string[];
        canSave: boolean;
      };
      assert.equal(missingBody.status, 'missing_information');
      assert.deepEqual(missingBody.missingVariables, ['targetMarket']);
      assert.equal(missingBody.canSave, false);
      assert.equal(aiCallCount, 0);

      ownedBrand.target_market = savedTargetMarket;

      // 5. Valid execution returns structured output + metadata
      const successRes = await fetch(
        `${baseUrl}/api/brands/${OWNED_BRAND_ID}/prompts/execute`,
        {
          method: 'POST',
          headers: ownerHeaders,
          body: JSON.stringify({ promptId: 'brand_foundation_synthesis' }),
        },
      );
      assert.equal(successRes.status, 200);
      const successBody = (await successRes.json()) as {
        status: string;
        canSave: boolean;
        metadata: {
          promptId: string;
          promptVersion: string;
          targetModule: string;
          model: string;
          brandId: string;
        };
        output: { purpose: string };
      };
      assert.equal(successBody.status, 'success');
      assert.equal(successBody.canSave, true);
      assert.equal(successBody.metadata.promptId, 'brand_foundation_synthesis');
      assert.equal(successBody.metadata.promptVersion, '1.0.0');
      assert.equal(successBody.metadata.targetModule, 'brandFoundation');
      assert.equal(successBody.metadata.brandId, OWNED_BRAND_ID);
      assert.equal(successBody.output.purpose, 'Make preventive care clear.');
      assert.equal(aiCallCount, 1);

      // Modules table was NOT mutated automatically during prompt execution
      assert.equal(state.modules.size, 0);
    },
    {
      generateAiContent: async (input) => {
        aiCallCount += 1;
        assert.equal(input.model, DEFAULT_GEMINI_MODEL);
        return {
          text: JSON.stringify({
            suppliedFactsUsed: ['Solstice Health in Austin, TX'],
            missingContextNotes: ['existingVision not provided'],
            aiSuggestions: { rationale: 'Lead with preventive clarity.' },
            purpose: 'Make preventive care clear.',
            missionStatement: 'Deliver clinician-guided longevity insights.',
            visionStatement: 'Preventive diagnostics as everyday healthcare.',
            positioningStatement: 'For Austin adults seeking proactive health clarity.',
            differentiationAttributes: ['Clinician-led', 'Biomarker tracking'],
          }),
          model: DEFAULT_GEMINI_MODEL,
          generatedAt: '2026-11-15T16:00:00.000Z',
        };
      },
    },
  );

  // 6. Malformed JSON response returns 422 validation_error (avoiding preview Nginx 502 interception) and never auto-saves
  await withTestServer(
    async (baseUrl, state) => {
      const res = await fetch(
        `${baseUrl}/api/brands/${OWNED_BRAND_ID}/prompts/execute`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer owner-token',
          },
          body: JSON.stringify({ promptId: 'brand_foundation_synthesis' }),
        },
      );
      assert.equal(res.status, 422);
      const body = (await res.json()) as { status: string; canSave: boolean };
      assert.equal(body.status, 'validation_error');
      assert.equal(body.canSave, false);
      assert.equal(state.modules.size, 0);
    },
    {
      generateAiContent: async () => ({
        text: 'not valid json at all',
        model: DEFAULT_GEMINI_MODEL,
        generatedAt: '2026-11-15T16:00:00.000Z',
      }),
    },
  );
});

test('POST /api/brands/:id/prompts/execute enforces 64KB size limit and passes only approved module facts', async () => {
  let capturedPrompt = '';
  let capturedContext = '';

  await withTestServer(
    async (baseUrl, state) => {
      const ownerHeaders = {
        'Content-Type': 'application/json',
        Authorization: 'Bearer owner-token',
      };

      // 1. Oversized request body (>64KB) rejected with 413
      const hugeRes = await fetch(
        `${baseUrl}/api/brands/${OWNED_BRAND_ID}/prompts/execute`,
        {
          method: 'POST',
          headers: ownerHeaders,
          body: JSON.stringify({
            promptId: 'brand_foundation_synthesis',
            variables: { additionalNotes: 'z'.repeat(80 * 1024) },
          }),
        },
      );
      assert.equal(hugeRes.status, 413);

      // 2. Seed persisted completed brandFoundation containing an unapproved AI suggestion field
      state.modules.set(`${OWNED_BRAND_ID}:brandFoundation`, {
        id: '44444444-4444-4444-8444-444444444444',
        user_id: OWNER_ID,
        brand_id: OWNED_BRAND_ID,
        module_key: 'brandFoundation',
        status: 'completed',
        content: {
          brandId: OWNED_BRAND_ID,
          completedAt: '2026-11-15T10:00:00.000Z',
          approvedSummary: {
            purpose: 'Approved Foundation Purpose Only',
            mission: 'Approved Foundation Mission',
            vision: 'Approved Foundation Vision',
            coreValues: [{ name: 'Clinical Rigor', behaviors: 'Cite limits', whyItMatters: 'Trust' }],
            positioning: 'Physician-backed clarity.',
            differentiationAttributes: ['Clinician-led'],
          },
          purpose: {
            statement: 'Approved Foundation Purpose Only',
            aiSuggestedStatement: 'UNAPPROVED_SUGGESTION_MUST_NOT_REACH_GEMINI',
            approved: true,
          },
        },
        prompt_id: 'brand_foundation_synthesis',
        prompt_version: '1.0.0',
        model: DEFAULT_GEMINI_MODEL,
        generated_at: '2026-11-15T10:00:00.000Z',
        created_at: '2026-11-15T10:00:00.000Z',
        updated_at: '2026-11-15T10:00:00.000Z',
      });

      const execRes = await fetch(
        `${baseUrl}/api/brands/${OWNED_BRAND_ID}/prompts/execute`,
        {
          method: 'POST',
          headers: ownerHeaders,
          body: JSON.stringify({
            promptId: 'brand_messaging_framework',
            includeApprovedModules: true,
          }),
        },
      );
      assert.equal(execRes.status, 200);
      const execBody = (await execRes.json()) as {
        status: string;
        metadata: { promptId: string; targetModule: string };
      };
      assert.equal(execBody.status, 'success');
      assert.equal(execBody.metadata.promptId, 'brand_messaging_framework');
      assert.equal(execBody.metadata.targetModule, 'brandMessaging');

      assert.match(capturedPrompt, /Approved Foundation Purpose Only/);
      assert.equal(capturedContext.includes('Approved Foundation Purpose Only'), false);
      assert.match(capturedContext, new RegExp(OWNED_BRAND_ID));
      assert.equal(capturedPrompt.includes('UNAPPROVED_SUGGESTION_MUST_NOT_REACH_GEMINI'), false);
      assert.equal(capturedContext.includes('UNAPPROVED_SUGGESTION_MUST_NOT_REACH_GEMINI'), false);
    },
    {
      generateAiContent: async (input) => {
        capturedPrompt = input.prompt;
        capturedContext = input.contextText ?? '';
        assert.equal(input.responseMimeType, 'application/json');
        return {
          text: JSON.stringify({
            suppliedFactsUsed: ['Brand Name: Solstice Health', 'Approved Brand Foundation used'],
            missingContextNotes: [],
            aiSuggestions: { rationale: 'Emphasize physician clarity.' },
            coreValueProposition: 'Physician-backed biomarker clarity for Austin adults.',
            messagingPillars: [
              { title: 'Clinical Clarity', summary: 'Plain-language physician reports.' },
              { title: 'Preventive Cadence', summary: 'Quarterly tracking.' },
            ],
            voiceAndTone: {
              attributes: ['Calm', 'Evidence-led'],
              guardrails: ['Avoid hype'],
            },
            audienceAngles: [
              { audience: 'Austin executives', message: 'See early trends without guesswork.' },
            ],
          }),
          model: DEFAULT_GEMINI_MODEL,
          generatedAt: '2026-11-15T16:15:00.000Z',
        };
      },
    },
  );
});

test('Phase 2B customerIntelligence strategy module supports authenticated CRUD persistence', async () => {
  await withTestServer(async (baseUrl, state) => {
    const authHeaders = {
      'Content-Type': 'application/json',
      Authorization: 'Bearer owner-token',
    };

    const putRes = await fetch(
      `${baseUrl}/api/brands/${OWNED_BRAND_ID}/strategy-modules/customerIntelligence`,
      {
        method: 'PUT',
        headers: authHeaders,
        body: JSON.stringify({
          status: 'in_progress',
          content: {
            brandId: OWNED_BRAND_ID,
            personas: [{ id: 'p-1', name: 'Time-Pressed Founder', approved: true }],
            interests: [],
          },
          promptId: 'customer_personas_synthesis',
          promptVersion: '1.0.0',
          model: DEFAULT_GEMINI_MODEL,
        }),
      },
    );
    assert.equal(putRes.status, 200);
    const putBody = (await putRes.json()) as {
      module: { moduleKey: string; status: string };
    };
    assert.equal(putBody.module.moduleKey, 'customerIntelligence');
    assert.equal(putBody.module.status, 'in_progress');

    const getRes = await fetch(
      `${baseUrl}/api/brands/${OWNED_BRAND_ID}/strategy-modules/customerIntelligence`,
      { headers: authHeaders },
    );
    assert.equal(getRes.status, 200);
    assert.equal(state.brands.get(OWNED_BRAND_ID)?.module_statuses.customerIntelligence, 'in_progress');

    const delRes = await fetch(
      `${baseUrl}/api/brands/${OWNED_BRAND_ID}/strategy-modules/customerIntelligence`,
      { method: 'DELETE', headers: authHeaders },
    );
    assert.equal(delRes.status, 200);
    assert.equal(state.brands.get(OWNED_BRAND_ID)?.module_statuses.customerIntelligence, 'not_started');
  });
});

test('Phase 2B marketingStrategy module supports authenticated CRUD persistence', async () => {
  await withTestServer(async (baseUrl, state) => {
    const authHeaders = {
      'Content-Type': 'application/json',
      Authorization: 'Bearer owner-token',
    };

    const putRes = await fetch(
      `${baseUrl}/api/brands/${OWNED_BRAND_ID}/strategy-modules/marketingStrategy`,
      {
        method: 'PUT',
        headers: authHeaders,
        body: JSON.stringify({
          status: 'in_progress',
          content: {
            brandId: OWNED_BRAND_ID,
            goals: [{ id: 'g-1', title: 'Grow Austin Consultations', approved: true }],
            objectives: [],
          },
          promptId: 'marketing_strategy_goals_objectives',
          promptVersion: '1.0.0',
          model: DEFAULT_GEMINI_MODEL,
        }),
      },
    );
    assert.equal(putRes.status, 200);
    const putBody = (await putRes.json()) as {
      module: { moduleKey: string; status: string };
    };
    assert.equal(putBody.module.moduleKey, 'marketingStrategy');
    assert.equal(putBody.module.status, 'in_progress');

    const getRes = await fetch(
      `${baseUrl}/api/brands/${OWNED_BRAND_ID}/strategy-modules/marketingStrategy`,
      { headers: authHeaders },
    );
    assert.equal(getRes.status, 200);
    assert.equal(
      state.brands.get(OWNED_BRAND_ID)?.module_statuses.marketingStrategy,
      'in_progress',
    );

    const delRes = await fetch(
      `${baseUrl}/api/brands/${OWNED_BRAND_ID}/strategy-modules/marketingStrategy`,
      { method: 'DELETE', headers: authHeaders },
    );
    assert.equal(delRes.status, 200);
    assert.equal(
      state.brands.get(OWNED_BRAND_ID)?.module_statuses.marketingStrategy,
      'not_started',
    );
  });
});

test('regression: marketing_strategy_channels_tactics passes native Gemini responseSchema, returns 422 on validation_error, and shields AI Studio preview Nginx from hijacking 502/503/504 errors', async () => {
  const seedApprovedUpstreamModules = (state: { modules: Map<string, Record<string, unknown>> }) => {
    const now = '2026-11-18T10:00:00.000Z';
    state.modules.set(`${OWNED_BRAND_ID}:brandFoundation`, {
      id: '44444444-4444-4444-8444-444444444441',
      user_id: OWNER_ID,
      brand_id: OWNED_BRAND_ID,
      module_key: 'brandFoundation',
      status: 'completed',
      content: {
        brandId: OWNED_BRAND_ID,
        approvedSummary: {
          purpose: 'Make preventive care clear.',
          mission: 'Clinician-led longevity insights.',
          vision: 'Proactive diagnostics for every adult.',
          coreValues: [{ name: 'Rigor', behaviors: 'Cite evidence', whyItMatters: 'Trust' }],
          positioningStatement: 'For Austin adults seeking physician-backed biomarker clarity.',
          differentiationAttributes: ['Clinician-led'],
        },
      },
      prompt_id: 'brand_foundation_synthesis',
      prompt_version: '1.0.0',
      model: DEFAULT_GEMINI_MODEL,
      generated_at: now,
      created_at: now,
      updated_at: now,
    });
    state.modules.set(`${OWNED_BRAND_ID}:brandMessaging`, {
      id: '44444444-4444-4444-8444-444444444442',
      user_id: OWNER_ID,
      brand_id: OWNED_BRAND_ID,
      module_key: 'brandMessaging',
      status: 'completed',
      content: {
        brandId: OWNED_BRAND_ID,
        approvedSummary: {
          coreValueProposition: 'Physician-backed biomarker clarity without guesswork.',
          messagingPillars: [{ title: 'Clinical Clarity', summary: 'Plain-language reports.' }],
          voiceAndTone: { attributes: ['Calm', 'Evidence-led'], guardrails: ['Avoid hype'] },
        },
      },
      prompt_id: 'brand_messaging_framework',
      prompt_version: '1.0.0',
      model: DEFAULT_GEMINI_MODEL,
      generated_at: now,
      created_at: now,
      updated_at: now,
    });
    state.modules.set(`${OWNED_BRAND_ID}:customerIntelligence`, {
      id: '44444444-4444-4444-8444-444444444443',
      user_id: OWNER_ID,
      brand_id: OWNED_BRAND_ID,
      module_key: 'customerIntelligence',
      status: 'completed',
      content: {
        brandId: OWNED_BRAND_ID,
        personas: [
          {
            id: 'p-1',
            name: 'Austin Tech Founder',
            roleOrSegment: 'Founder',
            painPoints: ['Generic lab results'],
            informationSources: ['LinkedIn', 'Clinician Newsletters'],
            approved: true,
          },
        ],
        interests: [
          {
            id: 'i-1',
            topic: 'Metabolic Biomarker Clarity',
            problemsToSolve: ['Interpreting ApoB labs'],
            contentConsumed: ['Physician LinkedIn breakdowns'],
            searchTopics: ['austin preventive biomarker clinic'],
            approved: true,
          },
        ],
      },
      prompt_id: 'customer_personas_synthesis',
      prompt_version: '1.0.0',
      model: DEFAULT_GEMINI_MODEL,
      generated_at: now,
      created_at: now,
      updated_at: now,
    });
    state.modules.set(`${OWNED_BRAND_ID}:marketingStrategy`, {
      id: '44444444-4444-4444-8444-444444444444',
      user_id: OWNER_ID,
      brand_id: OWNED_BRAND_ID,
      module_key: 'marketingStrategy',
      status: 'in_progress',
      content: {
        brandId: OWNED_BRAND_ID,
        goals: [
          {
            id: 'g-1',
            title: 'Grow Austin Preventive Consultations',
            targetAudience: 'Austin Tech Founder',
            approved: true,
          },
        ],
        objectives: [
          {
            id: 'o-1',
            title: 'Build Local Clinical Authority',
            priority: 'high',
            supportingGoalId: 'g-1',
            supportingGoalTitle: '',
            intendedBusinessOutcome: 'Increase qualified discovery bookings',
            targetAudience: 'Austin Tech Founder',
            approved: true,
          },
        ],
      },
      prompt_id: 'marketing_strategy_goals_objectives',
      prompt_version: '1.0.0',
      model: DEFAULT_GEMINI_MODEL,
      generated_at: now,
      created_at: now,
      updated_at: now,
    });
  };

  // 1. Successful execution verifies responseMimeType, native responseSchema, and goal title backfill
  let seenMime: string | undefined;
  let seenSchema: Record<string, unknown> | undefined;
  let seenPrompt = '';

  await withTestServer(
    async (baseUrl, state) => {
      seedApprovedUpstreamModules(state as unknown as { modules: Map<string, Record<string, unknown>> });

      const res = await fetch(
        `${baseUrl}/api/brands/${OWNED_BRAND_ID}/prompts/execute`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer owner-token',
          },
          body: JSON.stringify({
            promptId: 'marketing_strategy_channels_tactics',
            includeApprovedModules: true,
          }),
        },
      );

      assert.equal(res.status, 200);
      const body = (await res.json()) as {
        status: string;
        canSave: boolean;
        output: { channels: unknown[]; tactics: unknown[] };
      };
      assert.equal(body.status, 'success');
      assert.equal(body.canSave, true);
      assert.equal(body.output.channels.length, 2);
      assert.equal(body.output.tactics.length, 2);
      assert.equal(seenMime, 'application/json');
      assert.equal(seenSchema?.type, 'OBJECT');
      assert.ok(seenSchema?.properties);
      assert.match(seenPrompt, /Grow Austin Preventive Consultations/);
    },
    {
      generateAiContent: async (input) => {
        seenMime = input.responseMimeType;
        seenSchema = input.responseSchema;
        seenPrompt = input.prompt;
        return {
          text: JSON.stringify({
            suppliedFactsUsed: ['Austin Tech Founder', 'Build Local Clinical Authority'],
            missingContextNotes: ['Monthly paid media budget not supplied'],
            researchCaveat: 'AI channel and tactic recommendations require owner approval.',
            aiSuggestions: {
              channelMixRationale: 'Prioritize executive credibility channels.',
              tradeOffNotes: ['Defer paid display until organic demand baseline is captured.'],
            },
            channels: [
              {
                channelName: 'LinkedIn Executive Editorial',
                strategicRationale: 'Austin Tech Founder reads physician posts on LinkedIn.',
                relevantAudience: 'Austin Tech Founder',
                recommendedUse: 'Weekly ApoB breakdowns',
                expectedContribution: 'Drives high-trust discovery clicks',
                priority: 'primary',
                supportingObjectiveTitle: 'Build Local Clinical Authority',
              },
              {
                channelName: 'Clinician Email Briefing',
                strategicRationale: 'Direct inbox access for busy founders.',
                relevantAudience: 'Austin Tech Founder',
                recommendedUse: 'Bi-weekly lab Q&A',
                expectedContribution: 'Converts readers into consultation bookings',
                priority: 'primary',
                supportingObjectiveTitle: 'Build Local Clinical Authority',
              },
            ],
            tactics: [
              {
                tacticName: 'Weekly MD Biomarker Carousel',
                description: 'Publish 5-slide clinician breakdowns.',
                supportingObjectiveTitle: 'Build Local Clinical Authority',
                recommendedChannelName: 'LinkedIn Executive Editorial',
                targetAudience: 'Austin Tech Founder',
                executionGuidance: 'Outline 5 cited slides each Tuesday linking to Austin briefing.',
                suggestedFrequency: 'Weekly',
                successMetric: 'Briefing page opt-ins',
                priority: 'high',
              },
              {
                tacticName: 'Bi-Weekly Lab Q&A Dispatch',
                description: 'Answer one top founder biomarker question.',
                supportingObjectiveTitle: 'Build Local Clinical Authority',
                recommendedChannelName: 'Clinician Email Briefing',
                targetAudience: 'Austin Tech Founder',
                executionGuidance: 'Send 400-word clinician note with clear consultation CTA.',
                suggestedFrequency: 'Bi-weekly',
                successMetric: 'Discovery booking clicks',
                priority: 'high',
              },
            ],
          }),
          model: DEFAULT_GEMINI_MODEL,
          generatedAt: '2026-11-18T12:00:00.000Z',
        };
      },
    },
  );

  // 2. Behind preview Nginx (NGINX_PORT set), Gemini timeout (504) maps to 500 JSON with upstreamStatus so Nginx cannot replace it with 200 HTML; outside preview, 504 is preserved.
  await withTestServer(
    async (baseUrl, state) => {
      seedApprovedUpstreamModules(state as unknown as { modules: Map<string, Record<string, unknown>> });

      // Outside preview (NGINX_PORT unset): exact 504 preserved (e.g., Vercel)
      const standardRes = await fetch(
        `${baseUrl}/api/brands/${OWNED_BRAND_ID}/prompts/execute`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer owner-token',
          },
          body: JSON.stringify({
            promptId: 'marketing_strategy_channels_tactics',
            includeApprovedModules: true,
          }),
        },
      );
      assert.equal(standardRes.status, 504);

      // Inside Google AI Studio preview (NGINX_PORT set): 500 JSON with upstreamStatus so Nginx does not hijack into 200 HTML
      process.env.NGINX_PORT = '8080';
      const previewRes = await fetch(
        `${baseUrl}/api/brands/${OWNED_BRAND_ID}/prompts/execute`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer owner-token',
          },
          body: JSON.stringify({
            promptId: 'marketing_strategy_channels_tactics',
            includeApprovedModules: true,
          }),
        },
      );
      assert.equal(previewRes.status, 500);
      const body = (await previewRes.json()) as { error: string; upstreamStatus?: number };
      assert.match(body.error, /timed out/i);
      assert.equal(body.upstreamStatus, 504);
    },
    {
      generateAiContent: async () => {
        throw new GeminiTimeoutError();
      },
    },
  );
});

test('regression: POST /api/brands/:id/prompts/execute optimizes large KPI and Roadmap prompts authoritatively on the server below 12000 chars', async () => {
  const captured: Array<{
    promptId: string;
    promptLen: number;
    contextLen: number;
    mime?: string;
    hasSchema: boolean;
  }> = [];

  await withTestServer(
    async (baseUrl, state) => {
      const now = '2026-11-19T00:00:00.000Z';
      const personas = Array.from({ length: 5 }, (_, idx) => ({
        id: `p-${idx + 1}`,
        name: `Approved Persona ${idx + 1}: Growth Founder`,
        roleOrSegment: `Principal Segment ${idx + 1}`,
        summary: 'Experienced domain expert seeking repeatable inbound pipeline without agency fluff. '.repeat(3),
        painPoints: [`Referral plateau ${idx + 1}`, 'Generic agency copy'],
        informationSources: ['LinkedIn', 'Operator newsletters'],
        approved: true,
      }));
      const interests = Array.from({ length: 8 }, (_, idx) => ({
        id: `i-${idx + 1}`,
        topic: `Approved Interest ${idx + 1}: B2B Positioning`,
        problemsToSolve: [`Generic messaging ${idx + 1}`, 'Zero buyer inquiries'],
        contentConsumed: ['LinkedIn carousels', 'Weekly newsletters'],
        approved: true,
      }));
      const goals = Array.from({ length: 5 }, (_, idx) => ({
        id: `g-${idx + 1}`,
        title: `SMART Goal ${idx + 1}: Build Predictable Inbound Advisory Pipeline`,
        description: `Detailed goal description ${idx + 1} establishing repeatable organic inbound consultation demand. `.repeat(3),
        strategicRationale: `Strategic rationale for goal ${idx + 1} eliminating referral volatility. `.repeat(2),
        targetAudience: 'Approved Persona 1: Growth Founder',
        successMetrics: ['Qualified discovery calls booked per month', 'Newsletter-to-call conversion rate'],
        targetValue: 'Baseline to be established in Weeks 1-4.',
        measurementPeriod: 'Monthly review',
        recommendedTimeframe: 'Next 2 quarters',
        approved: true,
      }));
      const objectives = Array.from({ length: 7 }, (_, idx) => ({
        id: `o-${idx + 1}`,
        title: `Objective ${idx + 1}: Establish Proof-Driven Authority`,
        description: `Detailed objective narrative ${idx + 1} for structured teardown publishing. `.repeat(3),
        intendedBusinessOutcome: `Drive recurring consultation inquiries in track ${idx + 1}.`,
        targetAudience: 'Approved Persona 1: Growth Founder',
        supportingGoalId: `g-${(idx % 5) + 1}`,
        supportingGoalTitle: `SMART Goal ${(idx % 5) + 1}: Build Predictable Inbound Advisory Pipeline`,
        measurementCriteria: `Track engaged decision-maker visits and discovery bookings for track ${idx + 1}.`,
        priority: idx < 2 ? 'high' : idx < 5 ? 'medium' : 'low',
        approved: true,
      }));
      const channels = Array.from({ length: 6 }, (_, idx) => ({
        id: `ch-${idx + 1}`,
        channelName: `Channel ${idx + 1}: LinkedIn Executive Editorial`,
        strategicRationale: `Long justification for channel ${idx + 1} grounded in founder reading behavior. `.repeat(3),
        relevantAudience: 'Approved Persona 1: Growth Founder',
        recommendedUse: `Publish structured messaging teardowns and diagnostics on channel ${idx + 1}.`,
        expectedContribution: `Drives authority awareness and consultation clicks on channel ${idx + 1}.`,
        priority: idx < 2 ? 'primary' : idx < 4 ? 'secondary' : 'experimental',
        supportingObjectiveId: `o-${(idx % 7) + 1}`,
        supportingObjectiveTitle: `Objective ${(idx % 7) + 1}: Establish Proof-Driven Authority`,
        approved: true,
      }));
      const tactics = Array.from({ length: 10 }, (_, idx) => ({
        id: `t-${idx + 1}`,
        tacticName: `Tactic ${idx + 1}: Weekly Positioning Teardown`,
        description: `Concrete before-and-after breakdown of B2B positioning clarity for scenario ${idx + 1}.`,
        supportingObjectiveId: `o-${(idx % 7) + 1}`,
        supportingObjectiveTitle: `Objective ${(idx % 7) + 1}: Establish Proof-Driven Authority`,
        recommendedChannelId: `ch-${(idx % 6) + 1}`,
        recommendedChannelName: `Channel ${(idx % 6) + 1}: LinkedIn Executive Editorial`,
        targetAudience: 'Approved Persona 1: Growth Founder',
        executionGuidance: `Step 1: Choose buyer pain point ${idx + 1}. Step 2: Draft 6-slide teardown with concrete rewrites. Step 3: Publish Tuesday 9am with diagnostic worksheet CTA and follow up with commenters. `.repeat(2),
        suggestedFrequency: 'Weekly',
        successMetric: `Qualified diagnostic worksheet downloads (Track ${idx + 1})`,
        priority: idx < 3 ? 'high' : idx < 7 ? 'medium' : 'low',
        approved: true,
      }));

      state.modules.set(`${OWNED_BRAND_ID}:brandFoundation`, {
        id: '55555555-5555-4555-8555-555555555551',
        user_id: OWNER_ID,
        brand_id: OWNED_BRAND_ID,
        module_key: 'brandFoundation',
        status: 'completed',
        content: {
          brandId: OWNED_BRAND_ID,
          approvedSummary: {
            purposeStatement: 'Verbose purpose narrative. '.repeat(20),
            positioningStatement: 'Physician-backed clarity for Austin adults.',
            differentiationAttributes: ['Clinician-led'],
          },
        },
        prompt_id: 'brand_foundation_synthesis',
        prompt_version: '1.0.0',
        model: DEFAULT_GEMINI_MODEL,
        generated_at: now,
        created_at: now,
        updated_at: now,
      });
      state.modules.set(`${OWNED_BRAND_ID}:brandMessaging`, {
        id: '55555555-5555-4555-8555-555555555552',
        user_id: OWNER_ID,
        brand_id: OWNED_BRAND_ID,
        module_key: 'brandMessaging',
        status: 'completed',
        content: {
          brandId: OWNED_BRAND_ID,
          approvedSummary: {
            coreValueProposition: 'Clear preventive biomarker insights without guesswork.',
            messagingPillars: [{ title: 'Clarity', summary: 'Plain-language reporting.' }],
          },
        },
        prompt_id: 'brand_messaging_framework',
        prompt_version: '1.0.0',
        model: DEFAULT_GEMINI_MODEL,
        generated_at: now,
        created_at: now,
        updated_at: now,
      });
      state.modules.set(`${OWNED_BRAND_ID}:customerIntelligence`, {
        id: '55555555-5555-4555-8555-555555555553',
        user_id: OWNER_ID,
        brand_id: OWNED_BRAND_ID,
        module_key: 'customerIntelligence',
        status: 'completed',
        content: { brandId: OWNED_BRAND_ID, personas, interests },
        prompt_id: 'customer_personas_synthesis',
        prompt_version: '1.0.0',
        model: DEFAULT_GEMINI_MODEL,
        generated_at: now,
        created_at: now,
        updated_at: now,
      });
      state.modules.set(`${OWNED_BRAND_ID}:marketingStrategy`, {
        id: '55555555-5555-4555-8555-555555555554',
        user_id: OWNER_ID,
        brand_id: OWNED_BRAND_ID,
        module_key: 'marketingStrategy',
        status: 'in_progress',
        content: { brandId: OWNED_BRAND_ID, goals, objectives, channels, tactics },
        prompt_id: 'marketing_strategy_channels_tactics',
        prompt_version: '1.0.0',
        model: DEFAULT_GEMINI_MODEL,
        generated_at: now,
        created_at: now,
        updated_at: now,
      });

      const constraints =
        'Budget: Lean organic-first | Team Capacity: 4 hrs/week | Known Baselines: 420 newsletter subscribers at 38% open rate | Target Timeline: Next 2 quarters (24 weeks)';

      // 1. Execute KPI prompt via authoritative server route
      const kpiRes = await fetch(`${baseUrl}/api/brands/${OWNED_BRAND_ID}/prompts/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer owner-token' },
        body: JSON.stringify({
          promptId: 'marketing_strategy_kpis',
          includeApprovedModules: true,
          variables: { businessConstraints: constraints },
        }),
      });
      assert.equal(kpiRes.status, 200);
      const kpiBody = (await kpiRes.json()) as { status: string; output: { kpis: unknown[] } };
      assert.equal(kpiBody.status, 'success');
      assert.equal(kpiBody.output.kpis.length, 2);

      // 2. Execute Roadmap prompt via authoritative server route
      const roadmapRes = await fetch(`${baseUrl}/api/brands/${OWNED_BRAND_ID}/prompts/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer owner-token' },
        body: JSON.stringify({
          promptId: 'marketing_strategy_roadmap',
          includeApprovedModules: true,
          variables: { businessConstraints: constraints },
        }),
      });
      assert.equal(roadmapRes.status, 200);
      const roadmapBody = (await roadmapRes.json()) as {
        status: string;
        output: { roadmapItems: unknown[] };
      };
      assert.equal(roadmapBody.status, 'success');
      assert.equal(roadmapBody.output.roadmapItems.length, 3);

      // Verify both requests actually reached Gemini strictly under unchanged server limits with native JSON schemas
      assert.equal(captured.length, 2);
      for (const call of captured) {
        assert.ok(call.promptLen < MAX_PROMPT_LENGTH, `Server compiled prompt (${call.promptLen}) must be < ${MAX_PROMPT_LENGTH}`);
        assert.ok(call.contextLen < MAX_CONTEXT_LENGTH, `Server context (${call.contextLen}) must be < ${MAX_CONTEXT_LENGTH}`);
        assert.equal(call.mime, 'application/json');
        assert.equal(call.hasSchema, true);
      }
    },
    {
      generateAiContent: async (input) => {
        const isKpi = input.prompt.includes('KPI & Measurement Framework');
        captured.push({
          promptId: isKpi ? 'marketing_strategy_kpis' : 'marketing_strategy_roadmap',
          promptLen: input.prompt.length,
          contextLen: (input.contextText ?? '').length,
          mime: input.responseMimeType,
          hasSchema: Boolean(input.responseSchema),
        });
        return {
          text: isKpi
            ? JSON.stringify({
                suppliedFactsUsed: ['SMART Goal 1', 'Known Baselines: 420 newsletter subscribers'],
                missingContextNotes: ['Website consultation attribution baseline not yet captured'],
                researchCaveat: 'AI KPI proposals require baseline verification before target lock.',
                aiSuggestions: {
                  measurementGovernanceNote: 'Review leading metrics weekly and lagging metrics monthly.',
                  instrumentationChecklist: ['Enable UTM tracking on diagnostic worksheet links'],
                },
                kpis: [
                  {
                    kpiName: 'Qualified Diagnostic Worksheet Downloads',
                    description: 'Measures early founder intent from weekly teardowns.',
                    whatItMeasures: 'Weekly lead-magnet opt-ins from target B2B founders',
                    relatedObjectiveTitle: 'Objective 1: Establish Proof-Driven Authority',
                    measurementMethod: 'Newsletter form UTM attribution',
                    reportingFrequency: 'Weekly',
                    classification: 'leading',
                    baselineNote: 'Baseline to be captured during Weeks 1-4.',
                  },
                  {
                    kpiName: 'Qualified Discovery Calls Booked',
                    description: 'Tracks pipeline conversion from authority content.',
                    whatItMeasures: 'Monthly consultation bookings meeting fit criteria',
                    relatedObjectiveTitle: 'Objective 1: Establish Proof-Driven Authority',
                    measurementMethod: 'Calendar intake form + source tag',
                    reportingFrequency: 'Monthly',
                    classification: 'lagging',
                    baselineNote: 'Baseline to be established during Month 1.',
                  },
                ],
              })
            : JSON.stringify({
                suppliedFactsUsed: ['Objective 1', 'Target Timeline: Next 2 quarters'],
                missingContextNotes: ['Confirm editor weekly handoff schedule'],
                researchCaveat: 'AI sequencing proposal pending owner capacity confirmation.',
                aiSuggestions: {
                  sequencingRationale: 'Build attribution foundation before scaling weekly teardowns.',
                  keyRisksToConfirm: ['Confirm 4-hour founder weekly review slot'],
                },
                roadmapItems: [
                  {
                    phase: 'Phase 1: Foundation & Setup',
                    activity: 'Instrument UTM tracking and diagnostic intake page',
                    description: 'Configure landing-page attribution before publishing series.',
                    supportingObjectiveTitle: 'Objective 1: Establish Proof-Driven Authority',
                    channel: 'Channel 1: LinkedIn Executive Editorial',
                    priority: 'high',
                    suggestedTimeframe: 'Weeks 1-2',
                    dependencies: ['Approved positioning messaging'],
                    successIndicator: 'End-to-end UTM attribution verified in analytics',
                    decisionInputNeeded: 'Confirm preferred analytics tool',
                  },
                  {
                    phase: 'Phase 2: Launch & Validation',
                    activity: 'Launch Weekly Positioning Teardown Series',
                    description: 'Publish initial 4 weekly teardowns and log reader questions.',
                    supportingObjectiveTitle: 'Objective 1: Establish Proof-Driven Authority',
                    channel: 'Channel 1: LinkedIn Executive Editorial',
                    priority: 'high',
                    suggestedTimeframe: 'Weeks 3-8',
                    dependencies: ['Diagnostic intake page live'],
                    successIndicator: '4 consecutive weekly teardowns published on cadence',
                    decisionInputNeeded: '',
                  },
                  {
                    phase: 'Phase 3: Optimization & Scale',
                    activity: 'Refine teardown angles from Month 1-2 baseline data',
                    description: 'Double down on highest-converting diagnostic topics.',
                    supportingObjectiveTitle: 'Objective 1: Establish Proof-Driven Authority',
                    channel: 'Channel 1: LinkedIn Executive Editorial',
                    priority: 'medium',
                    suggestedTimeframe: 'Weeks 9-16',
                    dependencies: ['Weeks 3-8 baseline review completed'],
                    successIndicator: 'Updated Q2 editorial cadence approved by owner',
                    decisionInputNeeded: 'Confirm whether to add secondary distribution channel',
                  },
                ],
              }),
          model: DEFAULT_GEMINI_MODEL,
          generatedAt: '2026-11-19T00:00:00.000Z',
        };
      },
    },
  );
});

test('Phase 2B contentStrategy module supports authenticated CRUD persistence and end-to-end prompt execution under server limits', async () => {
  const captured: Array<{
    promptLen: number;
    contextLen: number;
    mime?: string;
    hasSchema: boolean;
  }> = [];

  await withTestServer(
    async (baseUrl, state) => {
      const authHeaders = {
        'Content-Type': 'application/json',
        Authorization: 'Bearer owner-token',
      };

      // 1. Authenticated CRUD on /strategy-modules/contentStrategy
      const putRes = await fetch(
        `${baseUrl}/api/brands/${OWNED_BRAND_ID}/strategy-modules/contentStrategy`,
        {
          method: 'PUT',
          headers: authHeaders,
          body: JSON.stringify({
            status: 'in_progress',
            content: {
              brandId: OWNED_BRAND_ID,
              objectives: [
                {
                  id: 'cobj-1',
                  title: 'Build Clinical Authority',
                  level: 'primary',
                  description: 'Clarify preventive diagnostics.',
                  approved: true,
                },
              ],
            },
            promptId: 'content_strategy_objectives',
            promptVersion: '1.0.0',
            model: DEFAULT_GEMINI_MODEL,
          }),
        },
      );
      assert.equal(putRes.status, 200);
      const putBody = (await putRes.json()) as {
        module: { moduleKey: string; status: string };
      };
      assert.equal(putBody.module.moduleKey, 'contentStrategy');
      assert.equal(putBody.module.status, 'in_progress');
      assert.equal(
        state.brands.get(OWNED_BRAND_ID)?.module_statuses.contentStrategy,
        'in_progress',
      );

      // 2. Seed completed upstream modules so content_strategy_objectives compiles authoritatively
      const now = '2026-11-20T00:00:00.000Z';
      state.modules.set(`${OWNED_BRAND_ID}:brandFoundation`, {
        id: '44444444-4444-4444-8444-444444444451',
        user_id: OWNER_ID,
        brand_id: OWNED_BRAND_ID,
        module_key: 'brandFoundation',
        status: 'completed',
        content: {
          brandId: OWNED_BRAND_ID,
          approvedSummary: {
            positioningStatement: 'Clinician-led preventive biomarker clarity for Austin adults.',
            differentiationAttributes: ['Clinician-led', 'Quarterly tracking'],
          },
        },
        created_at: now,
        updated_at: now,
      });
      state.modules.set(`${OWNED_BRAND_ID}:brandMessaging`, {
        id: '44444444-4444-4444-8444-444444444452',
        user_id: OWNER_ID,
        brand_id: OWNED_BRAND_ID,
        module_key: 'brandMessaging',
        status: 'completed',
        content: {
          brandId: OWNED_BRAND_ID,
          approvedSummary: {
            coreValueProposition: 'Plain-language physician biomarker guidance.',
            messagingPillars: [{ title: 'Clinical Clarity', summary: 'No wellness hype.' }],
            voiceAndTone: { attributes: ['Calm', 'Evidence-led'], guardrails: ['Avoid hype'] },
          },
        },
        created_at: now,
        updated_at: now,
      });
      state.modules.set(`${OWNED_BRAND_ID}:customerIntelligence`, {
        id: '44444444-4444-4444-8444-444444444453',
        user_id: OWNER_ID,
        brand_id: OWNED_BRAND_ID,
        module_key: 'customerIntelligence',
        status: 'completed',
        content: {
          brandId: OWNED_BRAND_ID,
          approvedSummary: {
            personas: [
              { id: 'p1', name: 'Austin Founder', summary: 'Wants proactive longevity clarity.' },
            ],
            interests: [
              {
                id: 'i1',
                topic: 'Biomarker Clarity',
                frequentQuestions: ['Which markers matter first?'],
              },
            ],
          },
        },
        created_at: now,
        updated_at: now,
      });
      state.modules.set(`${OWNED_BRAND_ID}:marketingStrategy`, {
        id: '44444444-4444-4444-8444-444444444454',
        user_id: OWNER_ID,
        brand_id: OWNED_BRAND_ID,
        module_key: 'marketingStrategy',
        status: 'completed',
        content: {
          brandId: OWNED_BRAND_ID,
          goals: [
            {
              id: 'g1',
              title: 'Grow Consultation Pipeline',
              targetAudience: 'Austin Founder',
              recommendedTimeframe: 'Next 90 days',
              approved: true,
            },
          ],
          objectives: [
            {
              id: 'o1',
              title: 'Establish Clinician Authority',
              priority: 'high',
              approved: true,
            },
          ],
          channels: [
            {
              id: 'c1',
              channelName: 'LinkedIn',
              priority: 'primary',
              approved: true,
            },
          ],
          tactics: [
            {
              id: 't1',
              tacticName: 'Weekly Biomarker Breakdown',
              recommendedChannelName: 'LinkedIn',
              approved: true,
            },
          ],
          kpis: [
            {
              id: 'k1',
              kpiName: 'Qualified Briefing Signups',
              classification: 'leading',
              approved: true,
            },
          ],
        },
        created_at: now,
        updated_at: now,
      });

      const execRes = await fetch(`${baseUrl}/api/brands/${OWNED_BRAND_ID}/prompts/execute`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          promptId: 'content_strategy_objectives',
          includeApprovedModules: true,
          variables: { contentConstraints: 'Publishing Capacity: 2 LinkedIn posts/week' },
        }),
      });
      assert.equal(execRes.status, 200);
      const execBody = (await execRes.json()) as {
        status: string;
        metadata: { promptId: string; targetModule: string };
        output: { objectives: unknown[] };
      };
      assert.equal(execBody.status, 'success');
      assert.equal(execBody.metadata.promptId, 'content_strategy_objectives');
      assert.equal(execBody.metadata.targetModule, 'contentStrategy');
      assert.equal(execBody.output.objectives.length, 2);

      assert.equal(captured.length, 1);
      assert.ok(captured[0].promptLen < MAX_PROMPT_LENGTH);
      assert.ok(captured[0].contextLen < MAX_CONTEXT_LENGTH);
      assert.equal(captured[0].mime, 'application/json');
      assert.equal(captured[0].hasSchema, true);

      const delRes = await fetch(
        `${baseUrl}/api/brands/${OWNED_BRAND_ID}/strategy-modules/contentStrategy`,
        { method: 'DELETE', headers: authHeaders },
      );
      assert.equal(delRes.status, 200);
      assert.equal(
        state.brands.get(OWNED_BRAND_ID)?.module_statuses.contentStrategy,
        'not_started',
      );
    },
    {
      generateAiContent: async (input) => {
        captured.push({
          promptLen: input.prompt.length,
          contextLen: (input.contextText ?? '').length,
          mime: input.responseMimeType,
          hasSchema: Boolean(input.responseSchema),
        });
        return {
          text: JSON.stringify({
            suppliedFactsUsed: ['Austin Founder', 'Establish Clinician Authority'],
            missingContextNotes: [],
            researchCaveat: 'AI content objectives require owner review.',
            aiSuggestions: { note: 'Focus on plain-language clinician clarity.' },
            objectives: [
              {
                title: 'Establish Plain-Language Biomarker Credibility',
                level: 'primary',
                description: 'Make preventive biomarkers clear for Austin founders.',
                targetAudienceOutcomes: ['Understand early ApoB signals'],
                desiredAudienceActions: ['Subscribe to weekly MD briefing'],
                alignedMarketingGoalTitle: 'Grow Consultation Pipeline',
                alignedMarketingObjectiveTitle: 'Establish Clinician Authority',
              },
              {
                title: 'Convert Informed Readers Into Consultation Inquiries',
                level: 'supporting',
                description: 'Bridge educational teardowns to discovery bookings.',
                targetAudienceOutcomes: ['Know when clinician care adds value'],
                desiredAudienceActions: ['Book preventive discovery call'],
                alignedMarketingGoalTitle: 'Grow Consultation Pipeline',
                alignedMarketingObjectiveTitle: 'Establish Clinician Authority',
              },
            ],
          }),
          model: DEFAULT_GEMINI_MODEL,
          generatedAt: '2026-11-20T00:00:00.000Z',
        };
      },
    },
  );
});

test('Phase 2B Content Calendar API routes enforce owner auth, UUID validation, CRUD/batch persistence, and strict cross-brand isolation', async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'brandflow-cal-api-'));
  try {
    const ownerRepo = new LocalJsonStorageRepository(OWNER_ID, 'owner@example.com', tempDir);
    const brandA = await ownerRepo.createBrand({
      brandName: 'Brand Alpha Calendar',
      businessDescription: 'Strategic brand consultancy for B2B service founders.',
      industry: 'Consulting',
      productsOrServices: 'Brand Sprints',
      targetMarket: 'B2B Founders',
      primaryLocation: 'Lagos & Remote',
    });
    const brandB = await ownerRepo.createBrand({
      brandName: 'Brand Beta Calendar',
      businessDescription: 'Independent specialty coffee roastery and subscription.',
      industry: 'Food & Beverage',
      productsOrServices: 'Single-origin subscriptions',
      targetMarket: 'Coffee enthusiasts',
      primaryLocation: 'London, UK',
    });

    await withTestServer(
      async (baseUrl) => {
        const ownerHeaders = {
          'Content-Type': 'application/json',
          Authorization: 'Bearer owner-token',
        };

        // 1. Auth enforcement (401 unauth, 403 non-owner)
        const unauthRes = await fetch(`${baseUrl}/api/brands/${brandA.id}/calendars`);
        assert.equal(unauthRes.status, 401);

        const nonOwnerRes = await fetch(`${baseUrl}/api/brands/${brandA.id}/calendars`, {
          headers: { Authorization: 'Bearer other-token' },
        });
        assert.equal(nonOwnerRes.status, 403);

        // 2. Invalid UUID rejected with 400
        const badUuidRes = await fetch(`${baseUrl}/api/brands/not-a-uuid/calendars`, {
          headers: ownerHeaders,
        });
        assert.equal(badUuidRes.status, 400);

        // 3. Create calendar for Brand A
        const createRes = await fetch(`${baseUrl}/api/brands/${brandA.id}/calendars`, {
          method: 'POST',
          headers: ownerHeaders,
          body: JSON.stringify({
            name: 'Dec 2026 30-Day Calendar',
            startDate: '2026-12-01',
            endDate: '2026-12-30',
            durationDays: 30,
            status: 'generating',
            settings: {
              startDate: '2026-12-01',
              durationDays: 30,
              selectedPlatforms: ['LinkedIn', 'Email Newsletter'],
              postsPerWeek: 4,
              postingFrequencyLabel: '4 posts/week',
              preferredPostingDays: ['Monday', 'Tuesday', 'Thursday', 'Friday'],
              preferredPostingTime: '09:00 AM',
            },
          }),
        });
        assert.equal(createRes.status, 201);
        const createdCal = ((await createRes.json()) as { calendar: { id: string; brandId: string } })
          .calendar;
        assert.equal(createdCal.brandId, brandA.id);

        // 4. Batch upsert items into Week 1
        const batchRes = await fetch(
          `${baseUrl}/api/brands/${brandA.id}/calendars/${createdCal.id}/items/batch`,
          {
            method: 'POST',
            headers: ownerHeaders,
            body: JSON.stringify({
              replaceBatchIndex: 0,
              items: [
                {
                  scheduledDate: '2026-12-02',
                  platform: 'LinkedIn',
                  title: 'Week 1 Positioning Breakdown',
                  contentPillar: 'Positioning Clarity',
                  contentFormat: 'Carousel Breakdown',
                  coreMessage: 'Clarify market position before scaling content.',
                  batchIndex: 0,
                  source: 'ai_generated',
                },
              ],
            }),
          },
        );
        assert.equal(batchRes.status, 201);
        const batchBody = (await batchRes.json()) as { items: Array<{ id: string }> };
        assert.equal(batchBody.items.length, 1);

        // 5. Add manual item, edit/reschedule it, and verify GET calendar returns both items
        const addManualRes = await fetch(
          `${baseUrl}/api/brands/${brandA.id}/calendars/${createdCal.id}/items`,
          {
            method: 'POST',
            headers: ownerHeaders,
            body: JSON.stringify({
              scheduledDate: '2026-12-05',
              platform: 'Email Newsletter',
              title: 'Founder Q&A Dispatch',
              contentPillar: 'Content Systems',
              contentFormat: 'Founder Essay',
              coreMessage: 'Answer top client positioning question.',
              source: 'manual',
            }),
          },
        );
        assert.equal(addManualRes.status, 201);
        const manualItem = ((await addManualRes.json()) as { item: { id: string } }).item;

        const patchItemRes = await fetch(
          `${baseUrl}/api/brands/${brandA.id}/calendars/${createdCal.id}/items/${manualItem.id}`,
          {
            method: 'PATCH',
            headers: ownerHeaders,
            body: JSON.stringify({ scheduledDate: '2026-12-06', workflowStatus: 'approved' }),
          },
        );
        assert.equal(patchItemRes.status, 200);
        const patchedItem = (
          (await patchItemRes.json()) as { item: { scheduledDate: string; workflowStatus: string } }
        ).item;
        assert.equal(patchedItem.scheduledDate, '2026-12-06');
        assert.equal(patchedItem.workflowStatus, 'approved');

        // 6. Strict cross-brand isolation: Brand B cannot read, patch, or delete Brand A's calendar or items
        const crossGetCal = await fetch(
          `${baseUrl}/api/brands/${brandB.id}/calendars/${createdCal.id}`,
          { headers: ownerHeaders },
        );
        assert.equal(crossGetCal.status, 404);

        const crossPatchItem = await fetch(
          `${baseUrl}/api/brands/${brandB.id}/calendars/${createdCal.id}/items/${manualItem.id}`,
          {
            method: 'PATCH',
            headers: ownerHeaders,
            body: JSON.stringify({ title: 'Cross-brand tamper attempt' }),
          },
        );
        assert.equal(crossPatchItem.status, 404);

        const crossDeleteCal = await fetch(
          `${baseUrl}/api/brands/${brandB.id}/calendars/${createdCal.id}`,
          { method: 'DELETE', headers: ownerHeaders },
        );
        assert.equal(crossDeleteCal.status, 404);

        // 7. Brand A reads full calendar, updates status, deletes item, deletes calendar cleanly
        const getFullRes = await fetch(
          `${baseUrl}/api/brands/${brandA.id}/calendars/${createdCal.id}`,
          { headers: ownerHeaders },
        );
        assert.equal(getFullRes.status, 200);
        const fullBody = (await getFullRes.json()) as { calendar: { items: unknown[] } };
        assert.equal(fullBody.calendar.items.length, 2);

        const delItemRes = await fetch(
          `${baseUrl}/api/brands/${brandA.id}/calendars/${createdCal.id}/items/${manualItem.id}`,
          { method: 'DELETE', headers: ownerHeaders },
        );
        assert.equal(delItemRes.status, 200);

        const delCalRes = await fetch(
          `${baseUrl}/api/brands/${brandA.id}/calendars/${createdCal.id}`,
          { method: 'DELETE', headers: ownerHeaders },
        );
        assert.equal(delCalRes.status, 200);
      },
      {
        storageFactory: (userId, _accessToken, userEmail) =>
          new LocalJsonStorageRepository(userId, userEmail, tempDir),
      },
    );
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
});

test('POST /api/brands/:id/prompts/execute returns requestId and explicit errorCategory on provider failures', async () => {
  await withTestServer(
    async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/brands/${OWNED_BRAND_ID}/prompts/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer owner-token',
        },
        body: JSON.stringify({ promptId: 'brand_foundation_synthesis' }),
      });
      assert.equal(res.status, 503);
      const body = (await res.json()) as {
        error: string;
        errorCategory?: string;
        requestId?: string;
      };
      assert.match(body.error, /temporarily busy/i);
      assert.equal(body.errorCategory, 'provider_unavailable');
      assert.ok(body.requestId && body.requestId.length > 0);
    },
    {
      generateAiContent: async () => {
        throw new GeminiProviderError(
          'AI service is temporarily busy. Please try again in a moment.',
          503,
          'provider_unavailable',
        );
      },
    },
  );
});




