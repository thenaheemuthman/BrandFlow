import test from 'node:test';
import assert from 'node:assert/strict';
import type { Brand, BrandStrategyModule } from '../types/brand.ts';
import {
  FoundationIsolationError,
  applyAiSynthesisResult,
  buildFoundationUpsertPayload,
  buildProposedStatementDraft,
  canCompleteBrandFoundation,
  checkSynthesisReadiness,
  computeFoundationProgress,
  createInitialBrandFoundationState,
  hydrateBrandFoundationState,
  validateFoundationSection,
  type BrandFoundationState,
} from './brandFoundationLogic.ts';

function makeBrand(overrides: Partial<Brand> = {}): Brand {
  return {
    id: 'brand-111',
    userId: 'owner-1',
    brandName: 'Solstice Health',
    businessDescription: 'Preventive biomarker diagnostics and longevity care.',
    industry: 'Health & Wellness',
    productsOrServices: 'Biomarker panels and clinician reviews',
    targetMarket: 'Proactive adults 30-55',
    primaryLocation: 'Austin, TX',
    websiteUrl: 'https://solstice.example.com',
    socialLinks: '',
    existingMission: '',
    existingVision: '',
    marketingChallenges: 'Confusing lab results without clinical guidance',
    businessGoals: 'Make preventive longevity care accessible',
    competitors: 'Generic telehealth clinics',
    additionalNotes: '',
    moduleStatuses: {
      brandFoundation: 'not_started',
      brandMessaging: 'not_started',
      customerIntelligence: 'not_started',
      marketingStrategy: 'not_started',
      contentStrategy: 'not_started',
      contentCalendar: 'not_started',
      contentStudio: 'not_started',
    },
    contentPiecesCount: 0,
    pendingApprovalsCount: 0,
    createdAt: '2026-11-15T00:00:00.000Z',
    updatedAt: '2026-11-15T00:00:00.000Z',
    lastAccessedAt: '2026-11-15T00:00:00.000Z',
    ...overrides,
  };
}

function makeCompleteState(brand: Brand): BrandFoundationState {
  const base = createInitialBrandFoundationState(brand);
  return {
    ...base,
    purpose: {
      ...base.purpose,
      problemAddressed: 'Reactive healthcare that waits for illness',
      peopleServed: 'Proactive adults seeking preventive clarity',
      positiveChange: 'Earlier health action guided by evidence',
      statement: 'Solstice Health exists to replace guesswork with preventive clarity.',
      approved: true,
      approvedAt: '2026-11-15T10:00:00.000Z',
    },
    mission: {
      ...base.mission,
      whatBusinessDoes: 'Deliver preventive biomarker diagnostics',
      whoItServes: 'Health-conscious adults',
      howItServes: 'Clinician-led testing and plain-language action plans',
      valueDelivered: 'Actionable early health confidence',
      statement: 'Deliver clinician-guided preventive insights for proactive adults.',
      approved: true,
      approvedAt: '2026-11-15T10:05:00.000Z',
    },
    vision: {
      ...base.vision,
      futureCreated: 'Preventive diagnostics as the normal starting point of care',
      longTermAmbition: 'Make routine longevity monitoring mainstream',
      impactAchieved: 'Measurable reduction in preventable chronic decline',
      statement: 'A world where preventive insight precedes medical crisis.',
      approved: true,
      approvedAt: '2026-11-15T10:10:00.000Z',
    },
    coreValues: {
      values: [
        {
          id: 'val-1',
          name: 'Clinical Honesty',
          behaviors: 'Explain limits of biomarkers clearly alongside every report.',
          whyItMatters: 'Builds lasting medical trust over marketing hype.',
        },
      ],
      approved: true,
      approvedAt: '2026-11-15T10:15:00.000Z',
    },
    positioning: {
      ...base.positioning,
      targetMarket: 'Preventive diagnostics in Austin, TX',
      primaryCustomer: 'Busy professionals ages 30-55',
      customerProblem: 'Unexplained lab numbers with no follow-up plan',
      brandSolution: 'Integrated quarterly labs paired with physician reviews',
      differentiatingAdvantage: 'Direct clinician interpretation included',
      competitiveDistinction: 'Automated app-only blood test portals',
      mainValueDelivered: 'Confident next steps backed by physicians',
      differentiationAttributes: ['Clinician-led', 'Plain-language reporting'],
      statement: 'For busy Austin adults, Solstice delivers physician-backed biomarker clarity.',
      approved: true,
      approvedAt: '2026-11-15T10:20:00.000Z',
    },
    aiSynthesis: {
      promptId: 'brand_foundation_synthesis',
      promptVersion: '1.0.0',
      sourceClassification: 'reconstructed',
      model: 'gemini-4-hydrogen',
      generatedAt: '2026-11-15T09:55:00.000Z',
      suppliedFactsUsed: ['Brand Name: Solstice Health'],
      missingContextNotes: ['existingVision was not provided'],
      aiSuggestionsSummary: { rationale: 'Emphasize clinical clarity.' },
    },
  };
}

test('required-field validation enforces all five Brand Foundation sections cleanly', () => {
  const brand = makeBrand();
  const empty = createInitialBrandFoundationState(brand);

  assert.ok(validateFoundationSection('purpose', empty).statement);
  assert.ok(validateFoundationSection('mission', empty).valueDelivered);
  assert.ok(validateFoundationSection('vision', empty).futureCreated);
  assert.ok(validateFoundationSection('coreValues', empty).values);
  assert.ok(validateFoundationSection('positioning', empty).primaryCustomer);

  // Incomplete core value entry rejected
  const partialValueState: BrandFoundationState = {
    ...empty,
    coreValues: {
      values: [{ id: 'v1', name: 'Clarity', behaviors: '', whyItMatters: 'Trust' }],
      approved: false,
      approvedAt: null,
    },
  };
  assert.match(
    validateFoundationSection('coreValues', partialValueState).values ?? '',
    /Core Value #1/,
  );

  // Complete sections pass validation
  const complete = makeCompleteState(brand);
  assert.deepEqual(validateFoundationSection('purpose', complete), {});
  assert.deepEqual(validateFoundationSection('mission', complete), {});
  assert.deepEqual(validateFoundationSection('vision', complete), {});
  assert.deepEqual(validateFoundationSection('coreValues', complete), {});
  assert.deepEqual(validateFoundationSection('positioning', complete), {});
});

test('missing-information readiness check detects incomplete brand profiles before synthesis', () => {
  const ready = checkSynthesisReadiness(makeBrand());
  assert.equal(ready.ready, true);
  assert.deepEqual(ready.missingFields, []);

  const incomplete = checkSynthesisReadiness(
    makeBrand({ targetMarket: ' ', productsOrServices: '' }),
  );
  assert.equal(incomplete.ready, false);
  assert.deepEqual(incomplete.missingFields, ['productsOrServices', 'targetMarket']);
});

test('AI synthesis applies suggestions without auto-approving or overwriting approved sections', () => {
  const brand = makeBrand();
  const initial = createInitialBrandFoundationState(brand);

  const withApprovedPurpose: BrandFoundationState = {
    ...initial,
    purpose: {
      ...initial.purpose,
      problemAddressed: 'Reactive care',
      peopleServed: 'Austin adults',
      positiveChange: 'Earlier action',
      statement: 'Approved user-authored purpose statement.',
      approved: true,
      approvedAt: '2026-11-15T10:00:00.000Z',
    },
    mission: {
      ...initial.mission,
      statement: 'User initial draft mission',
    },
  };

  const next = applyAiSynthesisResult(withApprovedPurpose, {
    status: 'success',
    brandId: brand.id,
    promptId: 'brand_foundation_synthesis',
    promptVersion: '1.0.0',
    targetModule: 'brandFoundation',
    sourceClassification: 'reconstructed',
    model: 'gemini-4-hydrogen',
    generatedAt: '2026-11-15T11:00:00.000Z',
    rawText: '{}',
    canSave: true,
    metadata: {
      promptId: 'brand_foundation_synthesis',
      promptVersion: '1.0.0',
      targetModule: 'brandFoundation',
      sourceClassification: 'reconstructed',
      brandId: brand.id,
      model: 'gemini-4-hydrogen',
      generatedAt: '2026-11-15T11:00:00.000Z',
    },
    output: {
      suppliedFactsUsed: ['Solstice Health in Austin, TX'],
      missingContextNotes: ['existingVision not provided'],
      aiSuggestions: { note: 'Focus on preventive trust' },
      purpose: 'AI generated new purpose suggestion',
      missionStatement: 'AI generated mission suggestion',
      visionStatement: 'AI generated vision suggestion',
      positioningStatement: 'AI generated positioning suggestion',
      differentiationAttributes: ['Clinician-led', 'Preventive tracking'],
    },
  });

  // Approved purpose is strictly preserved and NOT overwritten!
  assert.equal(next.purpose.approved, true);
  assert.equal(next.purpose.statement, 'Approved user-authored purpose statement.');
  assert.equal(next.purpose.aiSuggestedStatement, null);

  // Unapproved mission receives AI suggestion separately without overwriting user draft statement
  assert.equal(next.mission.statement, 'User initial draft mission');
  assert.equal(next.mission.aiSuggestedStatement, 'AI generated mission suggestion');
  assert.equal(next.mission.suggestionStatus, 'pending_review');
  assert.equal(next.mission.approved, false);

  // Metadata recorded cleanly
  assert.equal(next.aiSynthesis.promptId, 'brand_foundation_synthesis');
  assert.equal(next.aiSynthesis.promptVersion, '1.0.0');
  assert.equal(next.aiSynthesis.model, 'gemini-4-hydrogen');
  assert.deepEqual(next.aiSynthesis.suppliedFactsUsed, ['Solstice Health in Austin, TX']);

  // Explicit overwriteApproved=true resets approval only if user confirms replacement
  const overwritten = applyAiSynthesisResult(
    withApprovedPurpose,
    {
      status: 'success',
      brandId: brand.id,
      promptId: 'brand_foundation_synthesis',
      promptVersion: '1.0.0',
      targetModule: 'brandFoundation',
      sourceClassification: 'reconstructed',
      model: 'gemini-4-hydrogen',
      generatedAt: '2026-11-15T11:05:00.000Z',
      rawText: '{}',
      canSave: true,
      metadata: {
        promptId: 'brand_foundation_synthesis',
        promptVersion: '1.0.0',
        targetModule: 'brandFoundation',
        sourceClassification: 'reconstructed',
        brandId: brand.id,
        model: 'gemini-4-hydrogen',
        generatedAt: '2026-11-15T11:05:00.000Z',
      },
      output: {
        suppliedFactsUsed: ['Solstice Health'],
        missingContextNotes: [],
        aiSuggestions: {},
        purpose: 'Replaced purpose suggestion',
        missionStatement: 'M',
        visionStatement: 'V',
        positioningStatement: 'P',
        differentiationAttributes: ['A', 'B'],
      },
    },
    { overwriteApproved: true },
  );
  assert.equal(overwritten.purpose.aiSuggestedStatement, 'Replaced purpose suggestion');
  assert.equal(overwritten.purpose.approved, false);
});

test('progress tracking, completion gating, and upsert payload preserve prompt metadata', () => {
  const brand = makeBrand();
  const initial = createInitialBrandFoundationState(brand);

  const initialProgress = computeFoundationProgress(initial);
  assert.equal(initialProgress.approvedCount, 0);
  assert.equal(initialProgress.totalSections, 5);
  assert.equal(initialProgress.allSectionsApproved, false);

  assert.throws(
    () => buildFoundationUpsertPayload(initial, 'completed'),
    /Cannot complete Brand Foundation/,
  );

  // Save in-progress succeeds cleanly
  const inProgressPayload = buildFoundationUpsertPayload(initial, 'in_progress');
  assert.equal(inProgressPayload.status, 'in_progress');

  const complete = makeCompleteState(brand);
  const completeCheck = canCompleteBrandFoundation(complete);
  assert.equal(completeCheck.allowed, true);

  const completePayload = buildFoundationUpsertPayload(
    complete,
    'completed',
    '2026-11-15T12:00:00.000Z',
  );
  assert.equal(completePayload.status, 'completed');
  assert.equal(completePayload.promptId, 'brand_foundation_synthesis');
  assert.equal(completePayload.promptVersion, '1.0.0');
  assert.equal(completePayload.model, 'gemini-4-hydrogen');
  assert.equal(completePayload.generatedAt, '2026-11-15T09:55:00.000Z');
  assert.ok((completePayload.content as unknown as BrandFoundationState).approvedSummary);
});

test('hydrateBrandFoundationState restores saved module and enforces brand context isolation', () => {
  const brandA = makeBrand({ id: 'brand-a' });
  const brandB = makeBrand({ id: 'brand-b', brandName: 'Other Brand' });
  const completeA = makeCompleteState(brandA);
  const savedPayload = buildFoundationUpsertPayload(completeA, 'completed', '2026-11-15T12:00:00.000Z');

  const moduleA: BrandStrategyModule = {
    id: 'mod-a',
    userId: brandA.userId,
    brandId: brandA.id,
    moduleKey: 'brandFoundation',
    status: 'completed',
    content: savedPayload.content!,
    promptId: savedPayload.promptId ?? null,
    promptVersion: savedPayload.promptVersion ?? null,
    model: savedPayload.model ?? null,
    generatedAt: savedPayload.generatedAt ?? null,
    createdAt: '2026-11-15T12:00:00.000Z',
    updatedAt: '2026-11-15T12:00:00.000Z',
  };

  const hydrated = hydrateBrandFoundationState(brandA, moduleA);
  assert.equal(hydrated.brandId, 'brand-a');
  assert.equal(hydrated.purpose.approved, true);
  assert.equal(hydrated.coreValues.values[0]?.name, 'Clinical Honesty');
  assert.equal(hydrated.aiSynthesis.promptId, 'brand_foundation_synthesis');

  assert.throws(
    () => hydrateBrandFoundationState(brandB, moduleA),
    FoundationIsolationError,
  );
});

test('buildProposedStatementDraft drafts structured statements from captured section inputs', () => {
  const brand = makeBrand();
  const state = makeCompleteState(brand);
  assert.match(buildProposedStatementDraft('purpose', state, brand.brandName), /Solstice Health/);
  assert.match(buildProposedStatementDraft('mission', state, brand.brandName), /Solstice Health serves/);
  assert.match(buildProposedStatementDraft('vision', state, brand.brandName), /We envision/);
  assert.match(buildProposedStatementDraft('positioning', state, brand.brandName), /Solstice Health provides/);
});

test('reopening completed Brand Foundation or overwriting approved sections clears stale approvedSummary and completedAt', () => {
  const brand = makeBrand();
  const complete = makeCompleteState(brand);
  const completedPayload = buildFoundationUpsertPayload(
    complete,
    'completed',
    '2026-11-15T12:00:00.000Z',
  );
  const completedContent = completedPayload.content as unknown as BrandFoundationState;
  assert.ok(completedContent.approvedSummary);
  assert.equal(completedContent.completedAt, '2026-11-15T12:00:00.000Z');

  const reopenedState: BrandFoundationState = {
    ...completedContent,
    purpose: {
      ...completedContent.purpose,
      approved: false,
      approvedAt: null,
    },
  };
  const reopenedPayload = buildFoundationUpsertPayload(reopenedState, 'in_progress');
  const reopenedContent = reopenedPayload.content as unknown as BrandFoundationState;
  assert.equal(reopenedPayload.status, 'in_progress');
  assert.equal(reopenedContent.approvedSummary, null);
  assert.equal(reopenedContent.completedAt, null);

  const overwritten = applyAiSynthesisResult(
    completedContent,
    {
      status: 'success',
      brandId: brand.id,
      promptId: 'brand_foundation_synthesis',
      promptVersion: '1.0.0',
      targetModule: 'brandFoundation',
      sourceClassification: 'reconstructed',
      model: 'gemini-4-hydrogen',
      generatedAt: '2026-11-15T12:30:00.000Z',
      rawText: '{}',
      canSave: true,
      metadata: {
        promptId: 'brand_foundation_synthesis',
        promptVersion: '1.0.0',
        targetModule: 'brandFoundation',
        sourceClassification: 'reconstructed',
        brandId: brand.id,
        model: 'gemini-4-hydrogen',
        generatedAt: '2026-11-15T12:30:00.000Z',
      },
      output: {
        suppliedFactsUsed: ['Solstice Health'],
        missingContextNotes: [],
        aiSuggestions: {},
        purpose: 'New purpose suggestion',
        missionStatement: 'New mission suggestion',
        visionStatement: 'New vision suggestion',
        positioningStatement: 'New positioning suggestion',
        differentiationAttributes: ['Clinician-led'],
      },
    },
    { overwriteApproved: true },
  );
  assert.equal(overwritten.approvedSummary, null);
  assert.equal(overwritten.completedAt, null);
});

