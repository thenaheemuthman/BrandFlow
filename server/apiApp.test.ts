import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { createApiApp } from './apiApp.ts';
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
) {
  const originalEnv = {
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
    BRANDFLOW_OWNER_USER_ID: process.env.BRANDFLOW_OWNER_USER_ID,
  };
  const originalFetch = globalThis.fetch;

  process.env.SUPABASE_URL = 'https://example.supabase.co';
  process.env.SUPABASE_ANON_KEY = 'anon-test-key';
  process.env.BRANDFLOW_OWNER_USER_ID = OWNER_ID;

  const state = createInitialState();

  const server = http.createServer(createApiApp());
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
      `${baseUrl}/api/brands/${OWNED_BRAND_ID}/strategy-modules/customerIntelligence`,
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
  });
});
