import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeBrandProgress,
  computeDashboardMetrics,
  createDefaultModuleStatuses,
  filterAndSortBrands,
  hasValidationErrors,
  isFormDirty,
  isValidHttpUrl,
  validateBrandForm,
} from './brandLogic';
import type { Brand, BrandFormInput } from '../types/brand';

function makeValidInput(overrides: Partial<BrandFormInput> = {}): BrandFormInput {
  return {
    brandName: 'Northstar Analytics',
    businessDescription: 'B2B revenue attribution and marketing intelligence software for SaaS teams.',
    industry: 'B2B SaaS & Software',
    productsOrServices: 'Multi-touch attribution platform and executive pipeline reporting.',
    targetMarket: 'Series A to Series C B2B SaaS marketing leaders',
    primaryLocation: 'London, United Kingdom',
    websiteUrl: 'https://northstar.example.com',
    socialLinks: 'https://linkedin.com/company/northstar',
    existingMission: '',
    existingVision: '',
    marketingChallenges: '',
    businessGoals: '',
    competitors: '',
    additionalNotes: '',
    ...overrides,
  };
}

function makeBrand(overrides: Partial<Brand> = {}): Brand {
  return {
    id: 'brand-1',
    userId: 'user-default',
    brandName: 'Northstar Analytics',
    businessDescription: 'B2B revenue attribution and marketing intelligence software.',
    industry: 'B2B SaaS & Software',
    productsOrServices: 'Attribution platform',
    targetMarket: 'B2B SaaS teams',
    primaryLocation: 'London, UK',
    websiteUrl: 'https://northstar.example.com',
    socialLinks: '',
    existingMission: '',
    existingVision: '',
    marketingChallenges: '',
    businessGoals: '',
    competitors: '',
    additionalNotes: '',
    moduleStatuses: createDefaultModuleStatuses(),
    contentPiecesCount: 0,
    pendingApprovalsCount: 0,
    createdAt: '2026-11-10T10:00:00.000Z',
    updatedAt: '2026-11-12T10:00:00.000Z',
    lastAccessedAt: '2026-11-14T10:00:00.000Z',
    ...overrides,
  };
}

test('validateBrandForm passes with valid required fields', () => {
  const errors = validateBrandForm(makeValidInput());
  assert.equal(hasValidationErrors(errors), false);
});

test('validateBrandForm rejects empty required fields and invalid URLs', () => {
  const errors = validateBrandForm({
    brandName: '',
    businessDescription: 'Short',
    industry: '',
    productsOrServices: '',
    targetMarket: '',
    primaryLocation: '',
    websiteUrl: 'not-a-url',
  });

  assert.equal(hasValidationErrors(errors), true);
  assert.ok(errors.brandName);
  assert.ok(errors.businessDescription);
  assert.ok(errors.industry);
  assert.ok(errors.productsOrServices);
  assert.ok(errors.targetMarket);
  assert.ok(errors.primaryLocation);
  assert.ok(errors.websiteUrl);
});

test('isValidHttpUrl accepts empty string and http/https URLs, rejects javascript/ftp', () => {
  assert.equal(isValidHttpUrl(''), true);
  assert.equal(isValidHttpUrl('https://brandflow.example'), true);
  assert.equal(isValidHttpUrl('http://localhost:3000'), true);
  assert.equal(isValidHttpUrl('ftp://files.example.com'), false);
  assert.equal(isValidHttpUrl('brandflow.com'), false);
});

test('computeBrandProgress calculates accurate counts and labels without fake progress', () => {
  const fresh = makeBrand();
  const freshProgress = computeBrandProgress(fresh);
  assert.equal(freshProgress.completedCount, 0);
  assert.equal(freshProgress.totalModules, 7);
  assert.equal(freshProgress.percentage, 0);
  assert.equal(freshProgress.strategyStatusLabel, 'Not started');
  assert.equal(freshProgress.contentStatusLabel, 'Not started');
  assert.equal(freshProgress.calendarStatusLabel, 'Not started');

  const partial = makeBrand({
    moduleStatuses: {
      ...createDefaultModuleStatuses(),
      brandFoundation: 'completed',
      brandMessaging: 'in_progress',
      contentStrategy: 'completed',
    },
  });
  const partialProgress = computeBrandProgress(partial);
  assert.equal(partialProgress.completedCount, 2);
  assert.equal(partialProgress.inProgressCount, 1);
  assert.equal(partialProgress.percentage, 29);
  assert.equal(partialProgress.strategyStatusLabel, '1 of 4 modules complete');
  assert.equal(partialProgress.contentStatusLabel, 'Completed');
});

test('computeDashboardMetrics reflects actual brands without invented numbers', () => {
  assert.deepEqual(computeDashboardMetrics([]), {
    totalBrands: 0,
    strategiesCreated: 0,
    contentPiecesGenerated: 0,
    pendingApprovals: 0,
  });

  const brands = [
    makeBrand({
      id: 'b1',
      moduleStatuses: {
        ...createDefaultModuleStatuses(),
        brandFoundation: 'completed',
      },
      contentPiecesCount: 4,
      pendingApprovalsCount: 1,
    }),
    makeBrand({
      id: 'b2',
      contentPiecesCount: 0,
      pendingApprovalsCount: 0,
    }),
  ];

  assert.deepEqual(computeDashboardMetrics(brands), {
    totalBrands: 2,
    strategiesCreated: 1,
    contentPiecesGenerated: 4,
    pendingApprovals: 1,
  });
});

test('filterAndSortBrands filters by query and industry and sorts accurately', () => {
  const brands = [
    makeBrand({
      id: 'b1',
      brandName: 'Zeta Commerce',
      industry: 'E-Commerce & Retail',
      updatedAt: '2026-11-11T10:00:00.000Z',
    }),
    makeBrand({
      id: 'b2',
      brandName: 'Alpha Cloud',
      industry: 'B2B SaaS & Software',
      updatedAt: '2026-11-14T10:00:00.000Z',
    }),
  ];

  const byUpdated = filterAndSortBrands(brands, '', 'all', 'updated');
  assert.deepEqual(
    byUpdated.map((b) => b.id),
    ['b2', 'b1'],
  );

  const byName = filterAndSortBrands(brands, '', 'all', 'name');
  assert.deepEqual(
    byName.map((b) => b.id),
    ['b2', 'b1'],
  );

  const filteredByIndustry = filterAndSortBrands(brands, '', 'E-Commerce & Retail', 'updated');
  assert.deepEqual(
    filteredByIndustry.map((b) => b.id),
    ['b1'],
  );

  const filteredByQuery = filterAndSortBrands(brands, 'zeta', 'all', 'updated');
  assert.deepEqual(
    filteredByQuery.map((b) => b.id),
    ['b1'],
  );
});

test('isFormDirty detects whitespace-normalized changes accurately', () => {
  const initial = makeValidInput();
  const unchanged = makeValidInput({ brandName: '  Northstar Analytics  ' });
  const changed = makeValidInput({ brandName: 'Northstar AI' });

  assert.equal(isFormDirty(unchanged, initial), false);
  assert.equal(isFormDirty(changed, initial), true);
});
