import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { LocalJsonStorageRepository, validateServerBrandInput } from './storage.ts';

test('LocalJsonStorageRepository persists brands and activities across instances', async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'brandflow-test-'));
  try {
    const repo1 = new LocalJsonStorageRepository(tempDir);
    const initialBrands = await repo1.listBrands();
    assert.equal(initialBrands.length, 0);

    const created = await repo1.createBrand({
      brandName: 'Solstice Health',
      businessDescription: 'Preventive diagnostics and personalized wellness membership.',
      industry: 'Health & Wellness',
      productsOrServices: 'Annual biomarker panels and clinician care plans',
      targetMarket: 'Health-conscious professionals ages 28-55',
      primaryLocation: 'Austin, TX',
      websiteUrl: 'https://solstice.example.com',
    });

    assert.equal(created.brandName, 'Solstice Health');
    assert.ok(created.id);

    // Re-instantiate repository pointing to same disk directory to verify persistence
    const repo2 = new LocalJsonStorageRepository(tempDir);
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
