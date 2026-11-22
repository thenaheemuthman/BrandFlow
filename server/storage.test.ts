import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  LocalJsonStorageRepository,
  SupabaseStorageRepository,
  validateServerBrandInput,
} from './storage.ts';
import type { BrandFormInput, StrategyModuleKey } from '../src/types/brand.ts';

function makeBrandInput(overrides: Partial<BrandFormInput> = {}): BrandFormInput {
  return {
    brandName: 'Solstice Health',
    businessDescription: 'Preventive diagnostics and personalized wellness membership.',
    industry: 'Health & Wellness',
    productsOrServices: 'Annual biomarker panels and clinician care plans',
    targetMarket: 'Health-conscious professionals ages 28-55',
    primaryLocation: 'Austin, TX',
    websiteUrl: 'https://solstice.example.com',
    ...overrides,
  };
}

test('LocalJsonStorageRepository persists brands and activities across instances', async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'brandflow-test-'));
  try {
    const repo1 = new LocalJsonStorageRepository('user-owner', 'owner@example.com', tempDir);
    const initialBrands = await repo1.listBrands();
    assert.equal(initialBrands.length, 0);

    const created = await repo1.createBrand(makeBrandInput());

    assert.equal(created.brandName, 'Solstice Health');
    assert.equal(created.userId, 'user-owner');
    assert.ok(created.id);

    // Re-instantiate repository pointing to same disk directory to verify persistence
    const repo2 = new LocalJsonStorageRepository('user-owner', 'owner@example.com', tempDir);
    const persistedBrands = await repo2.listBrands();
    assert.equal(persistedBrands.length, 1);
    assert.equal(persistedBrands[0].id, created.id);

    const updated = await repo2.updateBrand(created.id, {
      brandName: 'Solstice Health Clinic',
      businessDescription: 'Preventive diagnostics and personalized longevity care.',
      industry: 'Health & Wellness',
      productsOrServices: 'Biomarker panels and longevity memberships',
      targetMarket: 'Executives and proactive adults',
      primaryLocation: 'Austin, TX',
    });
    assert.equal(updated?.brandName, 'Solstice Health Clinic');

    const activities = await repo2.listActivities(created.id);
    assert.equal(activities.length, 2);
    assert.equal(activities[0].type, 'brand_updated');
    assert.equal(activities[1].type, 'brand_created');

    const deleted = await repo2.deleteBrand(created.id);
    assert.equal(deleted, true);
    assert.equal((await repo2.listBrands()).length, 0);
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
});

test('LocalJsonStorageRepository creates, retrieves, updates, lists, and syncs strategy modules', async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'brandflow-modules-'));
  try {
    const repo = new LocalJsonStorageRepository('user-owner', 'owner@example.com', tempDir);
    const brand = await repo.createBrand(makeBrandInput());
    const initialUpdatedAt = brand.updatedAt;

    assert.equal(await repo.getBrandModule(brand.id, 'brandFoundation'), null);
    assert.deepEqual(await repo.listBrandModules(brand.id), []);

    // Wait 2ms so updatedAt advances deterministically
    await new Promise((resolve) => setTimeout(resolve, 2));

    // Create strategy module
    const createdModule = await repo.upsertBrandModule(brand.id, 'brandFoundation', {
      status: 'in_progress',
      content: {
        mission: 'Deliver proactive longevity care.',
        vision: 'Make preventive diagnostics accessible.',
        values: ['Clarity', 'Rigor', 'Empathy'],
      },
      promptId: 'brand_foundation_core',
      promptVersion: '1.0.0',
      model: 'gemini-4-hydrogen',
      generatedAt: '2026-11-14T12:00:00.000Z',
    });

    assert.ok(createdModule.id);
    assert.equal(createdModule.brandId, brand.id);
    assert.equal(createdModule.userId, 'user-owner');
    assert.equal(createdModule.moduleKey, 'brandFoundation');
    assert.equal(createdModule.status, 'in_progress');
    assert.equal(createdModule.promptId, 'brand_foundation_core');
    assert.equal(createdModule.promptVersion, '1.0.0');
    assert.equal(createdModule.model, 'gemini-4-hydrogen');
    assert.deepEqual(createdModule.content, {
      mission: 'Deliver proactive longevity care.',
      vision: 'Make preventive diagnostics accessible.',
      values: ['Clarity', 'Rigor', 'Empathy'],
    });

    // Retrieve strategy module
    const fetched = await repo.getBrandModule(brand.id, 'brandFoundation');
    assert.deepEqual(fetched, createdModule);

    // Brand status & updatedAt synchronized, unrelated module statuses preserved
    const afterCreateBrand = await repo.getBrand(brand.id, false);
    assert.ok(afterCreateBrand);
    assert.equal(afterCreateBrand.moduleStatuses.brandFoundation, 'in_progress');
    assert.equal(afterCreateBrand.moduleStatuses.brandMessaging, 'not_started');
    assert.equal(afterCreateBrand.moduleStatuses.customerIntelligence, 'not_started');
    assert.equal(afterCreateBrand.moduleStatuses.contentStudio, 'not_started');
    assert.notEqual(afterCreateBrand.updatedAt, initialUpdatedAt);

    // Update existing module to completed (partial update must preserve content & provenance)
    const completedModule = await repo.upsertBrandModule(brand.id, 'brandFoundation', {
      status: 'completed',
    });

    assert.equal(completedModule.id, createdModule.id);
    assert.equal(completedModule.status, 'completed');
    assert.deepEqual(completedModule.content, createdModule.content);
    assert.equal(completedModule.promptId, 'brand_foundation_core');
    assert.equal(completedModule.promptVersion, '1.0.0');

    // Add second Phase 2A module and verify listing + unrelated preservation
    await repo.upsertBrandModule(brand.id, 'brandMessaging', {
      status: 'in_progress',
      content: { coreMessage: 'Evidence-led preventive medicine.' },
    });

    const modules = await repo.listBrandModules(brand.id);
    assert.equal(modules.length, 2);
    assert.deepEqual(
      modules.map((m) => m.moduleKey),
      ['brandFoundation', 'brandMessaging'],
    );

    const afterSecondUpdateBrand = await repo.getBrand(brand.id, false);
    assert.ok(afterSecondUpdateBrand);
    assert.equal(afterSecondUpdateBrand.moduleStatuses.brandFoundation, 'completed');
    assert.equal(afterSecondUpdateBrand.moduleStatuses.brandMessaging, 'in_progress');
    assert.equal(afterSecondUpdateBrand.moduleStatuses.marketingStrategy, 'not_started');
    assert.equal(afterSecondUpdateBrand.moduleStatuses.contentCalendar, 'not_started');

    // Verify activity tracking events recorded
    const activities = await repo.listActivities(brand.id);
    assert.equal(activities[0].type, 'module_updated');
    assert.match(activities[0].description, /Brand Messaging/);
    assert.equal(activities[1].type, 'module_completed');
    assert.match(activities[1].description, /Brand Foundation/);
    assert.equal(activities[2].type, 'module_updated');
    assert.match(activities[2].description, /Brand Foundation/);
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
});

test('LocalJsonStorageRepository enforces brand isolation, ownership, validation, and cascade delete', async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'brandflow-isolation-'));
  try {
    const ownerRepo = new LocalJsonStorageRepository('user-owner', 'owner@example.com', tempDir);
    const otherUserRepo = new LocalJsonStorageRepository('user-other', 'other@example.com', tempDir);

    const brandA = await ownerRepo.createBrand(makeBrandInput({ brandName: 'Brand Alpha' }));
    const brandB = await ownerRepo.createBrand(makeBrandInput({ brandName: 'Brand Beta' }));

    await ownerRepo.upsertBrandModule(brandA.id, 'brandFoundation', {
      status: 'completed',
      content: { mission: 'Alpha only mission' },
    });
    await ownerRepo.upsertBrandModule(brandB.id, 'brandMessaging', {
      status: 'in_progress',
      content: { positioning: 'Beta only positioning' },
    });

    // Cross-brand isolation within same owner
    const brandAModules = await ownerRepo.listBrandModules(brandA.id);
    const brandBModules = await ownerRepo.listBrandModules(brandB.id);
    assert.equal(brandAModules.length, 1);
    assert.equal(brandAModules[0].moduleKey, 'brandFoundation');
    assert.equal(await ownerRepo.getBrandModule(brandA.id, 'brandMessaging'), null);
    assert.equal(brandBModules.length, 1);
    assert.equal(brandBModules[0].moduleKey, 'brandMessaging');
    assert.equal(await ownerRepo.getBrandModule(brandB.id, 'brandFoundation'), null);

    // Cross-user ownership enforcement before read or write
    await assert.rejects(
      () => otherUserRepo.listBrandModules(brandA.id),
      /Brand not found or access denied/,
    );
    await assert.rejects(
      () => otherUserRepo.getBrandModule(brandA.id, 'brandFoundation'),
      /Brand not found or access denied/,
    );
    await assert.rejects(
      () =>
        otherUserRepo.upsertBrandModule(brandA.id, 'brandFoundation', {
          status: 'completed',
          content: { mission: 'Tampered' },
        }),
      /Brand not found or access denied/,
    );

    // Marketing Strategy module persists cleanly and updates brand module status
    const msMod = await ownerRepo.upsertBrandModule(brandA.id, 'marketingStrategy', {
      status: 'in_progress',
      content: { goals: [{ id: 'g1', title: 'Grow pipeline', approved: true }] },
      promptId: 'marketing_strategy_goals_objectives',
      promptVersion: '1.0.0',
    });
    assert.equal(msMod.moduleKey, 'marketingStrategy');
    assert.equal(msMod.status, 'in_progress');

    // Content Strategy module persists cleanly and updates brand module status
    const csMod = await ownerRepo.upsertBrandModule(brandA.id, 'contentStrategy', {
      status: 'in_progress',
      content: { objectives: [{ id: 'cobj-1', title: 'Build Authority', approved: true }] },
      promptId: 'content_strategy_objectives',
      promptVersion: '1.0.0',
    });
    assert.equal(csMod.moduleKey, 'contentStrategy');
    assert.equal(csMod.status, 'in_progress');

    // Invalid module keys & invalid content rejected
    await assert.rejects(
      () =>
        ownerRepo.upsertBrandModule(
          brandA.id,
          'contentCalendar' as StrategyModuleKey,
          { status: 'in_progress', content: {} },
        ),
      /Unsupported strategy module key/,
    );
    await assert.rejects(
      () =>
        ownerRepo.upsertBrandModule(brandA.id, 'brandFoundation', {
          content: ['invalid'] as unknown as Record<string, unknown>,
        }),
      /JSON object/,
    );

    // Deleting brandA cascades its strategy modules without touching brandB
    assert.equal(await ownerRepo.deleteBrand(brandA.id), true);
    await assert.rejects(
      () => ownerRepo.listBrandModules(brandA.id),
      /Brand not found or access denied/,
    );
    const remainingBrandBModules = await ownerRepo.listBrandModules(brandB.id);
    assert.equal(remainingBrandBModules.length, 1);
    assert.equal(remainingBrandBModules[0].brandId, brandB.id);

    // Confirm persisted JSON file has zero orphaned modules for brandA
    const rawDb = JSON.parse(
      await fs.readFile(path.join(tempDir, 'brandflow-db.json'), 'utf-8'),
    ) as { brandModules: Array<{ brandId: string }> };
    assert.equal(
      rawDb.brandModules.some((m) => m.brandId === brandA.id),
      false,
    );
    assert.equal(rawDb.brandModules.length, 1);
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
});

test('SupabaseStorageRepository sends owner JWT, checks ownership, syncs statuses, and prevents cross-user access', async () => {
  const originalFetch = globalThis.fetch;
  const calls: Array<{ url: string; method: string; headers: Record<string, string>; body?: string }> = [];

  const ownerId = '11111111-1111-4111-8111-111111111111';
  const brandId = '22222222-2222-4222-8222-222222222222';
  const foreignBrandId = '33333333-3333-4333-8333-333333333333';

  let storedModule: Record<string, unknown> | null = null;
  let brandModuleStatuses = {
    brandFoundation: 'not_started',
    brandMessaging: 'not_started',
    customerIntelligence: 'completed',
    marketingStrategy: 'not_started',
    contentStrategy: 'not_started',
    contentCalendar: 'not_started',
    contentStudio: 'not_started',
  };

  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString();
    const method = init?.method ?? 'GET';
    const headers = (init?.headers ?? {}) as Record<string, string>;
    const body = typeof init?.body === 'string' ? init.body : undefined;
    calls.push({ url, method, headers, body });

    if (url.includes(`brands?id=eq.${encodeURIComponent(brandId)}`) && method === 'GET') {
      return new Response(
        JSON.stringify([
          {
            id: brandId,
            user_id: ownerId,
            brand_name: 'Solstice Health',
            business_description: 'Preventive diagnostics.',
            industry: 'Health & Wellness',
            products_or_services: 'Biomarker panels',
            target_market: 'Adults',
            primary_location: 'Austin, TX',
            website_url: '',
            social_links: '',
            existing_mission: '',
            existing_vision: '',
            marketing_challenges: '',
            business_goals: '',
            competitors: '',
            additional_notes: '',
            module_statuses: brandModuleStatuses,
            content_pieces_count: 0,
            pending_approvals_count: 0,
            created_at: '2026-11-14T10:00:00.000Z',
            updated_at: '2026-11-14T10:00:00.000Z',
            last_accessed_at: '2026-11-14T10:00:00.000Z',
          },
        ]),
        { status: 200 },
      );
    }

    if (url.includes(`brands?id=eq.${encodeURIComponent(foreignBrandId)}`) && method === 'GET') {
      return new Response(JSON.stringify([]), { status: 200 });
    }

    if (url.includes('/rest/v1/brand_strategy_modules') && method === 'GET') {
      return new Response(JSON.stringify(storedModule ? [storedModule] : []), { status: 200 });
    }

    if (url.includes('/rest/v1/brand_strategy_modules') && method === 'POST') {
      const payload = JSON.parse(body ?? '{}') as Record<string, unknown>;
      storedModule = {
        id: '44444444-4444-4444-8444-444444444444',
        created_at: '2026-11-14T12:00:00.000Z',
        ...payload,
      };
      return new Response(JSON.stringify([storedModule]), { status: 201 });
    }

    if (url.includes('/rest/v1/brand_strategy_modules') && method === 'PATCH') {
      const payload = JSON.parse(body ?? '{}') as Record<string, unknown>;
      storedModule = { ...(storedModule ?? {}), ...payload };
      return new Response(JSON.stringify([storedModule]), { status: 200 });
    }

    if (url.includes('/rest/v1/brands?') && method === 'PATCH') {
      const payload = JSON.parse(body ?? '{}') as { module_statuses?: typeof brandModuleStatuses };
      if (payload.module_statuses) {
        brandModuleStatuses = payload.module_statuses;
      }
      return new Response(null, { status: 204 });
    }

    if (url.includes('/rest/v1/brand_activities') && method === 'POST') {
      const payload = JSON.parse(body ?? '{}') as { type?: string };
      const allowed = new Set([
        'brand_created',
        'brand_updated',
        'workspace_accessed',
        'brand_deleted',
        'module_updated',
        'module_completed',
      ]);
      if (!payload.type || !allowed.has(payload.type)) {
        return new Response(
          JSON.stringify({
            message:
              'new row for relation "brand_activities" violates check constraint "brand_activities_type_check"',
          }),
          { status: 400 },
        );
      }
      return new Response(null, { status: 201 });
    }

    return new Response('Unexpected request', { status: 500 });
  }) as typeof fetch;

  try {
    const repo = new SupabaseStorageRepository(
      'https://example.supabase.co',
      'anon-key',
      'owner-jwt-token',
      ownerId,
      'owner@example.com',
    );

    // Cross-user / non-owned brand denied before module query executes
    await assert.rejects(
      () => repo.listBrandModules(foreignBrandId),
      /Brand not found or access denied/,
    );
    await assert.rejects(
      () => repo.getBrandModule(foreignBrandId, 'brandFoundation'),
      /Brand not found or access denied/,
    );

    // Create in_progress module -> emits module_updated and passes brand_activities_type_check
    const inProgress = await repo.upsertBrandModule(brandId, 'brandFoundation', {
      status: 'in_progress',
      content: { mission: 'Initial positioning draft.' },
      promptId: 'brand_foundation_core',
      promptVersion: '1.0.0',
      model: 'gemini-4-hydrogen',
    });
    assert.equal(inProgress.status, 'in_progress');
    assert.equal(brandModuleStatuses.brandFoundation, 'in_progress');

    // Update module -> completed -> emits module_completed, preserves unrelated statuses
    const saved = await repo.upsertBrandModule(brandId, 'brandFoundation', {
      status: 'completed',
      content: { values: ['Integrity'] },
      promptId: 'brand_foundation_core',
      promptVersion: '1.0.0',
      model: 'gemini-4-hydrogen',
    });

    assert.equal(saved.status, 'completed');
    assert.equal(brandModuleStatuses.brandFoundation, 'completed');
    assert.equal(brandModuleStatuses.customerIntelligence, 'completed');
    assert.equal(brandModuleStatuses.brandMessaging, 'not_started');

    const listed = await repo.listBrandModules(brandId);
    assert.equal(listed.length, 1);
    assert.equal(listed[0].id, saved.id);

    // Deleting an existing module removes only that module and resets its status on brand
    let deleteCallMade = false;
    const prevFetch = globalThis.fetch;
    globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      const method = init?.method ?? 'GET';
      const headers = (init?.headers ?? {}) as Record<string, string>;
      if (url.includes('/rest/v1/brand_strategy_modules') && method === 'DELETE') {
        deleteCallMade = true;
        calls.push({ url, method, headers });
        if (!storedModule) {
          return new Response(JSON.stringify([]), { status: 200 });
        }
        const deleted = storedModule;
        storedModule = null;
        return new Response(JSON.stringify([deleted]), { status: 200 });
      }
      return prevFetch(input, init);
    }) as typeof fetch;

    const deletedExisting = await repo.deleteBrandModule(brandId, 'brandFoundation');
    assert.equal(deletedExisting, true);
    assert.equal(deleteCallMade, true);
    assert.equal(brandModuleStatuses.brandFoundation, 'not_started');
    assert.equal(brandModuleStatuses.customerIntelligence, 'completed');
    assert.equal(brandModuleStatuses.brandMessaging, 'not_started');

    const deletedMissing = await repo.deleteBrandModule(brandId, 'brandFoundation');
    assert.equal(deletedMissing, false);

    // Every Supabase request used anonKey + authenticated user Bearer JWT
    assert.ok(calls.length > 0);
    for (const call of calls) {
      assert.equal(call.headers.apikey, 'anon-key');
      assert.equal(call.headers.Authorization, 'Bearer owner-jwt-token');
    }

    const activityCalls = calls.filter((c) => c.url.includes('/rest/v1/brand_activities'));
    assert.equal(activityCalls.length, 3);
    assert.match(activityCalls[0].body ?? '', /module_updated/);
    assert.match(activityCalls[1].body ?? '', /module_completed/);
    assert.match(activityCalls[2].body ?? '', /module_updated/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('brand_activities_type_check SQL constraint and schema match all Phase 1 and Phase 2A activity types', async () => {
  const migrationSql = await fs.readFile(
    path.resolve(process.cwd(), 'supabase/migrations/20261115_phase2a_brand_activities_module_updated.sql'),
    'utf-8',
  );
  const schemaSql = await fs.readFile(
    path.resolve(process.cwd(), 'supabase/schema.sql'),
    'utf-8',
  );

  const expectedTypes = [
    'brand_created',
    'brand_updated',
    'workspace_accessed',
    'brand_deleted',
    'module_updated',
    'module_completed',
  ];

  for (const sql of [migrationSql, schemaSql]) {
    assert.match(sql, /brand_activities_type_check/);
    for (const activityType of expectedTypes) {
      assert.match(sql, new RegExp(`'${activityType}'`));
    }
  }

  // Verify Phase 1 repository flows still emit all 4 existing Phase 1 activity types
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'brandflow-phase1-activities-'));
  try {
    const repo = new LocalJsonStorageRepository('user-owner', 'owner@example.com', tempDir);
    const brand = await repo.createBrand(makeBrandInput());
    await repo.getBrand(brand.id, true);
    await repo.updateBrand(brand.id, makeBrandInput({ brandName: 'Solstice Clinic' }));
    await repo.deleteBrand(brand.id);

    const activities = await repo.listActivities();
    assert.deepEqual(
      activities.map((a) => a.type),
      ['brand_deleted', 'brand_updated', 'workspace_accessed', 'brand_created'],
    );
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
});

test('LocalJsonStorageRepository deleteBrandModule removes only requested module, resets status, and enforces ownership', async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'brandflow-delete-module-'));
  try {
    const ownerRepo = new LocalJsonStorageRepository('user-owner', 'owner@example.com', tempDir);
    const otherUserRepo = new LocalJsonStorageRepository('user-other', 'other@example.com', tempDir);

    const brand = await ownerRepo.createBrand(makeBrandInput({ brandName: 'Delta Labs' }));
    await ownerRepo.upsertBrandModule(brand.id, 'brandFoundation', {
      status: 'completed',
      content: { mission: 'Build durable systems.' },
    });
    await ownerRepo.upsertBrandModule(brand.id, 'brandMessaging', {
      status: 'in_progress',
      content: { tagline: 'Built to endure.' },
    });

    const beforeDelete = await ownerRepo.getBrand(brand.id, false);
    assert.ok(beforeDelete);
    const updatedBeforeDelete = beforeDelete.updatedAt;

    await new Promise((resolve) => setTimeout(resolve, 2));

    // Cross-user delete must fail
    await assert.rejects(
      () => otherUserRepo.deleteBrandModule(brand.id, 'brandFoundation'),
      /Brand not found or access denied/,
    );

    // Unsupported key rejected
    await assert.rejects(
      () => ownerRepo.deleteBrandModule(brand.id, 'contentCalendar' as StrategyModuleKey),
      /Unsupported strategy module key/,
    );

    // Delete brandFoundation only
    const removed = await ownerRepo.deleteBrandModule(brand.id, 'brandFoundation');
    assert.equal(removed, true);

    assert.equal(await ownerRepo.getBrandModule(brand.id, 'brandFoundation'), null);
    const remainingMessaging = await ownerRepo.getBrandModule(brand.id, 'brandMessaging');
    assert.ok(remainingMessaging);
    assert.equal(remainingMessaging.status, 'in_progress');
    assert.deepEqual(remainingMessaging.content, { tagline: 'Built to endure.' });

    const afterDeleteBrand = await ownerRepo.getBrand(brand.id, false);
    assert.ok(afterDeleteBrand);
    assert.equal(afterDeleteBrand.moduleStatuses.brandFoundation, 'not_started');
    assert.equal(afterDeleteBrand.moduleStatuses.brandMessaging, 'in_progress');
    assert.notEqual(afterDeleteBrand.updatedAt, updatedBeforeDelete);

    const activities = await ownerRepo.listActivities(brand.id);
    assert.equal(activities[0].type, 'module_updated');
    assert.match(activities[0].description, /Removed Brand Foundation/);

    // Deleting a non-existent module returns false without error
    assert.equal(await ownerRepo.deleteBrandModule(brand.id, 'brandFoundation'), false);
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
});

test('validateServerBrandInput rejects invalid payloads', () => {
  assert.ok(
    validateServerBrandInput({
      brandName: 'A',
      businessDescription: 'Too short',
      industry: 'Retail',
      productsOrServices: 'Goods',
      targetMarket: 'Everyone',
      primaryLocation: 'NYC',
    }),
  );

  assert.equal(
    validateServerBrandInput({
      brandName: 'Acme Studio',
      businessDescription: 'Independent architectural lighting design and manufacturing.',
      industry: 'Real Estate & Architecture',
      productsOrServices: 'Custom architectural luminaires',
      targetMarket: 'Commercial interior architects',
      primaryLocation: 'Chicago, IL',
      websiteUrl: 'https://acme.example.com',
    }),
    null,
  );
});

test('Phase 2B Content Strategy SQL migration and schema.sql include contentStrategy in chk_brand_strategy_modules_module_key', async () => {
  const migrationSql = await fs.readFile(
    path.resolve(
      process.cwd(),
      'supabase/migrations/20261120_phase2b_content_strategy_module_key.sql',
    ),
    'utf-8',
  );
  const schemaSql = await fs.readFile(
    path.resolve(process.cwd(), 'supabase/schema.sql'),
    'utf-8',
  );

  for (const sql of [migrationSql, schemaSql]) {
    assert.match(sql, /chk_brand_strategy_modules_module_key/);
    assert.match(sql, /'brandFoundation'/);
    assert.match(sql, /'brandMessaging'/);
    assert.match(sql, /'customerIntelligence'/);
    assert.match(sql, /'marketingStrategy'/);
    assert.match(sql, /'contentStrategy'/);
  }
});

test('LocalJsonStorageRepository supports multi-calendar CRUD, batch upsert replaceBatchIndex, moduleStatuses sync, isolation, and cascade delete', async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'brandflow-calendar-storage-'));
  try {
    const ownerRepo = new LocalJsonStorageRepository('user-owner', 'owner@example.com', tempDir);
    const otherRepo = new LocalJsonStorageRepository('user-other', 'other@example.com', tempDir);

    const brandA = await ownerRepo.createBrand(makeBrandInput({ brandName: 'Brand Alpha' }));
    const brandB = await ownerRepo.createBrand(makeBrandInput({ brandName: 'Brand Beta' }));

    const cal1 = await ownerRepo.createContentCalendar(brandA.id, {
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
        campaignObjectiveFocus: '',
        contentMixPreference: '',
        teamCapacityNote: '',
        specialDatesOrConstraints: '',
      },
      generationState: {
        totalBatches: 4,
        completedBatches: 0,
        batches: [],
        suppliedFactsUsed: [],
        missingContextNotes: [],
        researchCaveat: '',
      },
    });
    const cal2 = await ownerRepo.createContentCalendar(brandA.id, {
      name: 'Jan 2027 Launch Calendar',
      startDate: '2027-01-01',
      endDate: '2027-01-30',
      durationDays: 30,
      status: 'draft',
      settings: {
        startDate: '2027-01-01',
        durationDays: 30,
        selectedPlatforms: ['LinkedIn'],
        postsPerWeek: 3,
        postingFrequencyLabel: '3 posts/week',
        preferredPostingDays: ['Tuesday', 'Thursday', 'Saturday'],
        preferredPostingTime: '09:00 AM',
        campaignObjectiveFocus: '',
        contentMixPreference: '',
        teamCapacityNote: '',
        specialDatesOrConstraints: '',
      },
    });

    // Multiple calendars per brand supported and strictly brand-isolated
    assert.equal((await ownerRepo.listContentCalendars(brandA.id)).length, 2);
    assert.equal((await ownerRepo.listContentCalendars(brandB.id)).length, 0);
    assert.equal(await ownerRepo.getContentCalendar(brandB.id, cal1.id), null);

    // Non-owner blocked
    await assert.rejects(
      () => otherRepo.listContentCalendars(brandA.id),
      /Brand not found or access denied/,
    );

    // Batch upsert items + safe replaceBatchIndex retry preserves other batches
    const week1Initial = await ownerRepo.createContentCalendarItems(
      brandA.id,
      cal1.id,
      [
        {
          scheduledDate: '2026-12-02',
          platform: 'LinkedIn',
          title: 'Week 1 Initial Post',
          contentPillar: 'Positioning',
          contentFormat: 'Carousel',
          targetAudience: 'B2B Founders',
          contentObjective: 'Build authority',
          coreMessage: 'Initial brief',
          batchIndex: 0,
        },
      ],
      0,
    );
    assert.equal(week1Initial.length, 1);

    await ownerRepo.createContentCalendarItems(
      brandA.id,
      cal1.id,
      [
        {
          scheduledDate: '2026-12-09',
          platform: 'Email Newsletter',
          title: 'Week 2 Preserved Post',
          contentPillar: 'Systems',
          contentFormat: 'Essay',
          targetAudience: 'B2B Founders',
          contentObjective: 'Build authority',
          coreMessage: 'Week 2 brief',
          batchIndex: 1,
        },
      ],
      1,
    );

    // Retry Week 1 (replaceBatchIndex: 0) replaces only batch 0 and preserves batch 1
    await ownerRepo.createContentCalendarItems(
      brandA.id,
      cal1.id,
      [
        {
          scheduledDate: '2026-12-03',
          platform: 'LinkedIn',
          title: 'Week 1 Retried Post',
          contentPillar: 'Positioning',
          contentFormat: 'Carousel',
          targetAudience: 'B2B Founders',
          contentObjective: 'Build authority',
          coreMessage: 'Retried brief',
          batchIndex: 0,
        },
      ],
      0,
    );

    const fullCal = await ownerRepo.getContentCalendar(brandA.id, cal1.id);
    assert.ok(fullCal);
    assert.equal(fullCal.items.length, 2);
    assert.equal(fullCal.items.some((i) => i.title === 'Week 1 Initial Post'), false);
    assert.equal(fullCal.items.some((i) => i.title === 'Week 1 Retried Post'), true);
    assert.equal(fullCal.items.some((i) => i.title === 'Week 2 Preserved Post'), true);

    // Manual item create, update (reschedule + workflow status), and delete
    const manualItem = await ownerRepo.createContentCalendarItem(brandA.id, cal1.id, {
      scheduledDate: '2026-12-15',
      platform: 'LinkedIn',
      title: 'Manual Founder Note',
      contentPillar: 'Authority',
      contentFormat: 'Text Post',
      targetAudience: 'B2B Founders',
      contentObjective: 'Share practical lessons',
      coreMessage: 'Share real lesson learned.',
      source: 'manual',
    });
    const updatedItem = await ownerRepo.updateContentCalendarItem(brandA.id, cal1.id, manualItem.id, {
      scheduledDate: '2026-12-16',
      workflowStatus: 'approved',
    });
    assert.equal(updatedItem?.scheduledDate, '2026-12-16');
    assert.equal(updatedItem?.workflowStatus, 'approved');

    // Cross-brand item update rejected cleanly
    assert.equal(
      await ownerRepo.updateContentCalendarItem(brandB.id, cal1.id, manualItem.id, { title: 'Tamper' }),
      null,
    );

    assert.equal(await ownerRepo.deleteContentCalendarItem(brandA.id, cal1.id, manualItem.id), true);

    // Updating calendar to active syncs brand.moduleStatuses.contentCalendar -> completed
    await ownerRepo.updateContentCalendar(brandA.id, cal1.id, { status: 'active' });
    const brandAfterActive = await ownerRepo.getBrand(brandA.id, false);
    assert.equal(brandAfterActive?.moduleStatuses.contentCalendar, 'completed');

    // Deleting calendar 1 leaves calendar 2 (draft -> in_progress)
    assert.equal(await ownerRepo.deleteContentCalendar(brandA.id, cal1.id), true);
    const brandAfterDel1 = await ownerRepo.getBrand(brandA.id, false);
    assert.equal(brandAfterDel1?.moduleStatuses.contentCalendar, 'in_progress');

    // Deleting brandA cascades remaining calendars & items cleanly
    assert.equal(await ownerRepo.deleteBrand(brandA.id), true);
    const rawDb = JSON.parse(
      await fs.readFile(path.join(tempDir, 'brandflow-db.json'), 'utf-8'),
    ) as { contentCalendars: unknown[]; contentCalendarItems: unknown[] };
    assert.equal(rawDb.contentCalendars.length, 0);
    assert.equal(rawDb.contentCalendarItems.length, 0);
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
});

test('Phase 2B Content Calendar SQL migration and schema.sql define tables, constraints, RLS, and authenticated-only grants', async () => {
  const migrationSql = await fs.readFile(
    path.resolve(process.cwd(), 'supabase/migrations/20261121_phase2b_content_calendars.sql'),
    'utf-8',
  );
  const schemaSql = await fs.readFile(
    path.resolve(process.cwd(), 'supabase/schema.sql'),
    'utf-8',
  );

  for (const sql of [migrationSql, schemaSql]) {
    assert.match(sql, /create table if not exists public\.content_calendars/);
    assert.match(sql, /create table if not exists public\.content_calendar_items/);
    assert.match(sql, /content_calendars_status_check/);
    assert.match(sql, /content_calendar_items_workflow_status_check/);
    assert.match(sql, /enable row level security/);
    assert.match(sql, /revoke all on public\.content_calendars from anon/);
    assert.match(sql, /revoke all on public\.content_calendar_items from anon/);
    assert.match(sql, /grant select, insert, update, delete on public\.content_calendars to authenticated/);
    assert.match(sql, /grant select, insert, update, delete on public\.content_calendar_items to authenticated/);
  }
});

test('LocalJsonStorageRepository supports Content Studio CRUD, immutable versions, approved-snapshot protection, metrics sync, cross-brand isolation, and cascade delete', async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'brandflow-studio-storage-'));
  try {
    const ownerRepo = new LocalJsonStorageRepository('user-owner', 'owner@example.com', tempDir);
    const otherRepo = new LocalJsonStorageRepository('user-other', 'other@example.com', tempDir);

    const brandA = await ownerRepo.createBrand(makeBrandInput({ brandName: 'Studio Brand A' }));
    const brandB = await ownerRepo.createBrand(makeBrandInput({ brandName: 'Studio Brand B' }));

    // Create a calendar + item on Brand A for valid calendar handoff linking
    const calA = await ownerRepo.createContentCalendar(brandA.id, {
      name: 'Dec 2026 Calendar',
      startDate: '2026-12-01',
      endDate: '2026-12-30',
      durationDays: 30,
      status: 'active',
      settings: {
        startDate: '2026-12-01',
        durationDays: 30,
        selectedPlatforms: ['LinkedIn'],
        postsPerWeek: 3,
        postingFrequencyLabel: '3 posts/week',
        preferredPostingDays: ['Tuesday', 'Thursday', 'Saturday'],
        preferredPostingTime: '09:00 AM',
        campaignObjectiveFocus: '',
        contentMixPreference: '',
        teamCapacityNote: '',
        specialDatesOrConstraints: '',
      },
    });
    const itemA = await ownerRepo.createContentCalendarItem(brandA.id, calA.id, {
      scheduledDate: '2026-12-03',
      platform: 'LinkedIn',
      title: 'Positioning Diagnostic Post',
      contentPillar: 'Positioning',
      contentFormat: 'Carousel',
      targetAudience: 'B2B Founders',
      contentObjective: 'Authority',
      coreMessage: 'Clarify positioning first.',
    });

    // Cross-brand calendar/item linking must be rejected
    await assert.rejects(
      () =>
        ownerRepo.createContentAsset(brandB.id, {
          calendarId: calA.id,
          calendarItemId: itemA.id,
          title: 'Cross-Brand Attempt',
          platform: 'LinkedIn',
          formatCategory: 'carousel',
          body: {
            hook: 'Hook',
            alternativeHooks: [],
            mainCopy: 'Copy',
            cta: 'CTA',
            hashtags: [],
            visualDirection: '',
            carouselSlides: [],
            videoScript: null,
            articleSections: [],
            adaptationNotes: '',
            suppliedFactsUsed: [],
            missingContextNotes: [],
            researchCaveat: '',
          },
        }),
      /does not belong to this brand/i,
    );

    // 1. Create asset linked to Brand A's calendar item -> creates initial v1 snapshot
    const created = await ownerRepo.createContentAsset(brandA.id, {
      calendarId: calA.id,
      calendarItemId: itemA.id,
      title: 'Positioning Diagnostic Draft',
      platform: 'LinkedIn',
      formatCategory: 'carousel',
      formatLabel: 'LinkedIn Carousel',
      contentPillar: 'Positioning',
      targetAudience: 'B2B Founders',
      contentObjective: 'Authority',
      toneOfVoice: 'Sharp',
      contentLength: 'medium',
      scheduledDate: '2026-12-03',
      workflowStatus: 'draft',
      source: 'ai_generated',
      body: {
        hook: 'Original v1 hook',
        alternativeHooks: [],
        mainCopy: 'Original v1 body copy',
        cta: 'Comment AUDIT',
        hashtags: ['#B2B'],
        visualDirection: 'Clean slides',
        carouselSlides: [
          { slideNumber: 1, headline: 'Slide 1', body: 'First insight', visualCue: 'Bold cover' },
        ],
        videoScript: null,
        articleSections: [],
        adaptationNotes: '',
        suppliedFactsUsed: ['Brand Positioning'],
        missingContextNotes: [],
        researchCaveat: 'Review before publishing.',
      },
      changeSummary: 'Initial AI draft',
      actionType: 'ai_generate',
    });

    assert.equal(created.currentVersionNumber, 1);
    assert.equal(created.versions.length, 1);
    assert.equal(created.versions[0].versionNumber, 1);
    assert.equal(created.workflowStatus, 'draft');

    // Brand metrics synced (in_progress, 1 piece, 0 pending approvals yet)
    const brandAfterCreate = await ownerRepo.getBrand(brandA.id, false);
    assert.equal(brandAfterCreate?.moduleStatuses.contentStudio, 'in_progress');
    assert.equal(brandAfterCreate?.contentPiecesCount, 1);
    assert.equal(brandAfterCreate?.pendingApprovalsCount, 0);

    // Strict brand and user isolation
    assert.equal((await ownerRepo.listContentAssets(brandB.id)).length, 0);
    assert.equal(await ownerRepo.getContentAsset(brandB.id, created.id), null);
    await assert.rejects(
      () => otherRepo.listContentAssets(brandA.id),
      /Brand not found or access denied/,
    );

    // 2. Move to ready_for_review -> pendingApprovalsCount increments to 1
    const inReview = await ownerRepo.updateContentAsset(brandA.id, created.id, {
      workflowStatus: 'ready_for_review',
    });
    assert.equal(inReview?.workflowStatus, 'ready_for_review');
    assert.equal((await ownerRepo.getBrand(brandA.id, false))?.pendingApprovalsCount, 1);

    // 3. Explicit human approval -> sets approvedAt and syncs moduleStatuses.contentStudio -> completed
    const approved = await ownerRepo.updateContentAsset(brandA.id, created.id, {
      workflowStatus: 'approved',
    });
    assert.equal(approved?.workflowStatus, 'approved');
    assert.ok(approved?.approvedAt);
    const brandAfterApprove = await ownerRepo.getBrand(brandA.id, false);
    assert.equal(brandAfterApprove?.moduleStatuses.contentStudio, 'completed');
    assert.equal(brandAfterApprove?.pendingApprovalsCount, 0);

    // 4. Editing body of an approved asset NEVER overwrites approved snapshot: preserves approved version + creates new version and moves status to in_progress
    const editedAfterApprove = await ownerRepo.updateContentAsset(brandA.id, created.id, {
      title: 'Positioning Diagnostic Draft (v2)',
      body: {
        ...created.body,
        hook: 'Revised v2 hook after approval',
      },
      changeSummary: 'Manual post-approval edit',
      actionType: 'manual_edit',
    });
    assert.ok(editedAfterApprove);
    assert.equal(editedAfterApprove.workflowStatus, 'in_progress');
    assert.ok(editedAfterApprove.currentVersionNumber >= 2);
    assert.ok(
      editedAfterApprove.versions.some((v) => v.body.hook === 'Original v1 hook'),
      'Approved v1 snapshot must remain preserved in version history',
    );
    assert.equal(editedAfterApprove.body.hook, 'Revised v2 hook after approval');

    // 5. Explicit createContentAssetVersion (e.g. AI refinement) increments version immutably
    const afterRefinement = await ownerRepo.createContentAssetVersion(brandA.id, created.id, {
      title: 'Positioning Diagnostic Draft (Refined)',
      body: {
        ...editedAfterApprove.body,
        hook: 'Refined hook v3',
      },
      source: 'edited_ai',
      changeSummary: 'Improved clarity with AI',
      actionType: 'ai_refine',
    });
    assert.ok(afterRefinement);
    assert.equal(afterRefinement.currentVersionNumber, editedAfterApprove.currentVersionNumber + 1);
    assert.equal(afterRefinement.versions.length, editedAfterApprove.versions.length + 1);

    // 6. Cross-brand delete blocked; owner delete succeeds & brand cascade cleans remaining assets/versions
    assert.equal(await ownerRepo.deleteContentAsset(brandB.id, created.id), false);

    const secondAsset = await ownerRepo.createContentAsset(brandA.id, {
      title: 'Cascade Test Asset',
      platform: 'LinkedIn',
      formatCategory: 'social_post',
      body: created.body,
    });
    assert.ok(secondAsset.id);

    assert.equal(await ownerRepo.deleteContentAsset(brandA.id, created.id), true);
    assert.equal(await ownerRepo.getContentAsset(brandA.id, created.id), null);

    // Cascade delete brand removes secondAsset and all versions
    assert.equal(await ownerRepo.deleteBrand(brandA.id), true);
    const rawDb = JSON.parse(
      await fs.readFile(path.join(tempDir, 'brandflow-db.json'), 'utf-8'),
    ) as { contentAssets: unknown[]; contentAssetVersions: unknown[] };
    assert.equal(rawDb.contentAssets.length, 0);
    assert.equal(rawDb.contentAssetVersions.length, 0);
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
});

test('Phase 2B Content Studio SQL migration and schema.sql define tables, constraints, RLS, and authenticated-only grants', async () => {
  const migrationSql = await fs.readFile(
    path.resolve(process.cwd(), 'supabase/migrations/20261121_phase2b_content_studio.sql'),
    'utf-8',
  );
  const schemaSql = await fs.readFile(
    path.resolve(process.cwd(), 'supabase/schema.sql'),
    'utf-8',
  );

  for (const sql of [migrationSql, schemaSql]) {
    assert.match(sql, /create table if not exists public\.content_assets/);
    assert.match(sql, /create table if not exists public\.content_asset_versions/);
    assert.match(sql, /workflow_status text not null default 'draft' check/);
    assert.match(sql, /format_category text not null default 'social_post' check/);
    assert.match(sql, /content_length text not null default 'medium' check/);
    assert.match(sql, /create or replace function public\.set_updated_at\(\)[\s\S]*?set search_path = ''/i);
    assert.match(sql, /create or replace function public\.validate_content_asset_calendar_link\(\)[\s\S]*?set search_path = ''/i);
    assert.match(sql, /ci\.calendar_id = new\.calendar_id/);
    assert.match(sql, /and \(calendar_id is null or ci\.calendar_id = calendar_id\)/);
    assert.match(sql, /enable row level security/);
    assert.match(sql, /revoke all on public\.content_assets from anon/);
    assert.match(sql, /revoke all on public\.content_asset_versions from anon/);
    assert.match(sql, /grant select, insert, update, delete on public\.content_assets to authenticated/);
    assert.match(sql, /revoke update, delete on public\.content_asset_versions from authenticated/);
    assert.match(sql, /grant select, insert on public\.content_asset_versions to authenticated/);
    assert.doesNotMatch(sql, /grant select, insert, update, delete on public\.content_asset_versions to authenticated/);
    assert.match(sql, /create policy "content_asset_versions_select_own"/);
    assert.match(sql, /create policy "content_asset_versions_insert_own"/);
    assert.doesNotMatch(sql, /create policy "content_asset_versions_update_own"/);
    assert.doesNotMatch(sql, /create policy "content_asset_versions_delete_own"/);
  }
});


