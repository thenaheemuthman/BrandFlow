import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildInitialTestModuleInput,
  buildUpdatedTestModuleInput,
  createInitialStepReport,
  findExistingBrandFoundationModule,
  isConfirmedVerificationTestRecord,
  pickDefaultVerifyBrandId,
  sanitizeErrorMessage,
  verifyModuleMatchesExpected,
  verifyTrackedModuleOwnership,
  type TrackedTestRecord,
} from './phase2aVerifyLogic';
import { createDefaultModuleStatuses } from './brandLogic';
import type { Brand, BrandStrategyModule } from '../types/brand';

function makeBrand(id: string, brandName: string): Brand {
  return {
    id,
    userId: 'owner-1',
    brandName,
    businessDescription: 'Test business description for brand profile.',
    industry: 'B2B SaaS',
    productsOrServices: 'Strategy tools',
    targetMarket: 'Founders',
    primaryLocation: 'London, UK',
    websiteUrl: '',
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
    createdAt: '2026-11-15T10:00:00.000Z',
    updatedAt: '2026-11-15T10:00:00.000Z',
    lastAccessedAt: '2026-11-15T10:00:00.000Z',
  };
}

function makeModule(overrides: Partial<BrandStrategyModule> = {}): BrandStrategyModule {
  return {
    id: 'mod-1',
    userId: 'owner-1',
    brandId: 'brand-1',
    moduleKey: 'brandFoundation',
    status: 'in_progress',
    content: {
      testRun: true,
      label: 'Phase 2A Live CRUD Verification',
      description: 'Temporary integration test record',
      verificationId: 'run-123',
    },
    promptId: null,
    promptVersion: null,
    model: null,
    generatedAt: null,
    createdAt: '2026-11-15T10:00:00.000Z',
    updatedAt: '2026-11-15T10:00:00.000Z',
    ...overrides,
  };
}

test('pickDefaultVerifyBrandId selects The Naheem Uthman when present and falls back cleanly', () => {
  const brands = [
    makeBrand('b-1', 'Acme Labs'),
    makeBrand('b-2', '  the naheem uthman  '),
    makeBrand('b-3', 'Other Brand'),
  ];
  assert.equal(pickDefaultVerifyBrandId(brands), 'b-2');
  assert.equal(pickDefaultVerifyBrandId([makeBrand('b-1', 'Acme Labs')]), 'b-1');
  assert.equal(pickDefaultVerifyBrandId([]), '');
});

test('createInitialStepReport starts all five CRUD steps in PENDING state', () => {
  const report = createInitialStepReport();
  assert.deepEqual(Object.keys(report), ['CREATE', 'READ', 'UPDATE', 'LIST', 'DELETE']);
  for (const key of ['CREATE', 'READ', 'UPDATE', 'LIST', 'DELETE'] as const) {
    assert.equal(report[key].status, 'PENDING');
  }
});

test('findExistingBrandFoundationModule detects pre-existing brandFoundation without confusing brandMessaging', () => {
  const onlyMessaging = [makeModule({ moduleKey: 'brandMessaging' })];
  assert.equal(findExistingBrandFoundationModule(onlyMessaging), undefined);

  const hasFoundation = [makeModule({ moduleKey: 'brandFoundation' })];
  assert.equal(findExistingBrandFoundationModule(hasFoundation)?.id, 'mod-1');
});

test('verifyModuleMatchesExpected validates initial and updated test payloads strictly', () => {
  const initialInput = buildInitialTestModuleInput('run-123');
  const mod = makeModule({
    status: initialInput.status,
    content: initialInput.content as Record<string, unknown>,
  });

  assert.deepEqual(
    verifyModuleMatchesExpected(mod, {
      id: 'mod-1',
      userId: 'owner-1',
      brandId: 'brand-1',
      status: 'in_progress',
      content: initialInput.content as Record<string, unknown>,
    }),
    { ok: true },
  );

  const updatedInput = buildUpdatedTestModuleInput('run-123');
  assert.equal(
    verifyModuleMatchesExpected(mod, {
      id: 'mod-1',
      userId: 'owner-1',
      brandId: 'brand-1',
      status: 'completed',
      content: updatedInput.content as Record<string, unknown>,
    }).ok,
    false,
  );
});

test('verifyTrackedModuleOwnership and isConfirmedVerificationTestRecord prevent deleting unrelated records', () => {
  const tracked: TrackedTestRecord = {
    id: 'mod-1',
    userId: 'owner-1',
    brandId: 'brand-1',
    brandName: 'The Naheem Uthman',
    moduleKey: 'brandFoundation',
    verificationId: 'run-123',
    phase: 'created',
  };

  assert.equal(verifyTrackedModuleOwnership(null, 'brand-1', 'owner-1').ok, false);
  assert.equal(verifyTrackedModuleOwnership(tracked, 'brand-2', 'owner-1').ok, false);
  assert.equal(verifyTrackedModuleOwnership(tracked, 'brand-1', 'other-user').ok, false);
  assert.equal(verifyTrackedModuleOwnership(tracked, 'brand-1', 'owner-1').ok, true);

  assert.equal(isConfirmedVerificationTestRecord(makeModule(), tracked), true);
  assert.equal(
    isConfirmedVerificationTestRecord(
      makeModule({ content: { testRun: true, verificationId: 'different-run' } }),
      tracked,
    ),
    false,
  );
  assert.equal(
    isConfirmedVerificationTestRecord(makeModule({ id: 'mod-genuine' }), tracked),
    false,
  );
});

test('sanitizeErrorMessage redacts accidental bearer or JWT tokens', () => {
  const message = sanitizeErrorMessage(
    new Error('Failed with Bearer abc.def.ghi and eyJheader.eyJpayload.signature'),
  );
  assert.equal(message.includes('abc.def.ghi'), false);
  assert.equal(message.includes('eyJpayload'), false);
  assert.equal(message.includes('[redacted]'), true);
  assert.equal(message.includes('[redacted-token]'), true);
});
