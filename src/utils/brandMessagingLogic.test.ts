import test from 'node:test';
import assert from 'node:assert/strict';
import type { Brand, BrandStrategyModule } from '../types/brand.ts';
import type { PromptExecutionResult } from '../prompts/types.ts';
import {
  buildFoundationUpsertPayload,
  createInitialBrandFoundationState,
  type BrandFoundationState,
} from './brandFoundationLogic.ts';
import {
  MessagingIsolationError,
  applyAiMessagingResult,
  buildMessagingPromptVariables,
  buildMessagingUpsertPayload,
  canCompleteBrandMessaging,
  checkMessagingGenerationReadiness,
  computeMessagingProgress,
  createInitialBrandMessagingState,
  evaluateFoundationDependency,
  hydrateBrandMessagingState,
  validateMessagingFrameworkOutput,
  validateMessagingSection,
  type BrandMessagingState,
} from './brandMessagingLogic.ts';

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
      brandFoundation: 'completed',
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

function makeCompleteFoundationState(brand: Brand): BrandFoundationState {
  const base = createInitialBrandFoundationState(brand);
  return {
    ...base,
    purpose: {
      ...base.purpose,
      problemAddressed: 'Reactive healthcare that waits for illness',
      peopleServed: 'Proactive adults seeking preventive clarity',
      positiveChange: 'Earlier health action guided by evidence',
      statement: 'Approved Purpose: Replace guesswork with preventive clarity.',
      aiSuggestedStatement: 'UNAPPROVED AI SUGGESTION SHOULD NEVER LEAK',
      suggestionStatus: 'rejected',
      approved: true,
      approvedAt: '2026-11-15T10:00:00.000Z',
    },
    mission: {
      ...base.mission,
      whatBusinessDoes: 'Deliver preventive biomarker diagnostics',
      whoItServes: 'Health-conscious adults',
      howItServes: 'Clinician-led testing and plain-language action plans',
      valueDelivered: 'Actionable early health confidence',
      statement: 'Approved Mission: Clinician-guided preventive insights.',
      approved: true,
      approvedAt: '2026-11-15T10:05:00.000Z',
    },
    vision: {
      ...base.vision,
      futureCreated: 'Preventive diagnostics as standard care',
      longTermAmbition: 'Make longevity monitoring mainstream',
      impactAchieved: 'Measurable reduction in preventable chronic decline',
      statement: 'Approved Vision: Preventive insight before medical crisis.',
      approved: true,
      approvedAt: '2026-11-15T10:10:00.000Z',
    },
    coreValues: {
      values: [
        {
          id: 'val-1',
          name: 'Clinical Honesty',
          behaviors: 'Explain limits of biomarkers clearly alongside every report.',
          whyItMatters: 'Builds lasting medical trust.',
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
      aiSuggestedAttributes: ['SHOULD_NOT_LEAK_SUGGESTION'],
      statement: 'Approved Positioning: Physician-backed biomarker clarity for Austin adults.',
      approved: true,
      approvedAt: '2026-11-15T10:20:00.000Z',
    },
  };
}

function makeCompletedFoundationModule(brand: Brand): BrandStrategyModule {
  const payload = buildFoundationUpsertPayload(
    makeCompleteFoundationState(brand),
    'completed',
    '2026-11-15T10:30:00.000Z',
  );
  return {
    id: `mod-foundation-${brand.id}`,
    userId: brand.userId,
    brandId: brand.id,
    moduleKey: 'brandFoundation',
    status: 'completed',
    content: payload.content ?? {},
    promptId: payload.promptId ?? null,
    promptVersion: payload.promptVersion ?? null,
    model: payload.model ?? null,
    generatedAt: payload.generatedAt ?? null,
    createdAt: '2026-11-15T10:30:00.000Z',
    updatedAt: '2026-11-15T10:30:00.000Z',
  };
}

function makeValidExecutionResult(brandId: string): PromptExecutionResult {
  return {
    status: 'success',
    brandId,
    promptId: 'brand_messaging_framework',
    promptVersion: '1.0.0',
    targetModule: 'brandMessaging',
    sourceClassification: 'reconstructed',
    model: 'gemini-4-hydrogen',
    generatedAt: '2026-11-15T12:00:00.000Z',
    rawText: '{}',
    canSave: true,
    metadata: {
      promptId: 'brand_messaging_framework',
      promptVersion: '1.0.0',
      targetModule: 'brandMessaging',
      sourceClassification: 'reconstructed',
      brandId,
      model: 'gemini-4-hydrogen',
      generatedAt: '2026-11-15T12:00:00.000Z',
    },
    output: {
      suppliedFactsUsed: ['Brand Name: Solstice Health', 'Approved Purpose & Positioning used'],
      missingContextNotes: ['websiteUrl testimonials not supplied'],
      aiSuggestions: {
        testingRecommendation: 'A/B test pillar headlines on Austin landing pages.',
      },
      coreValueProposition:
        'Physician-reviewed biomarker clarity that turns lab data into preventive confidence.',
      messagingPillars: [
        {
          title: 'Clinician Interpretation Included',
          summary: 'Every quarterly panel is translated into clear next steps by a real physician.',
        },
        {
          title: 'Plain-Language Action Plans',
          summary: 'No dense spreadsheets or guesswork—only prioritized habits and follow-ups.',
        },
      ],
      voiceAndTone: {
        attributes: ['Calm', 'Evidence-led', 'Human'],
        guardrails: ['Never promise miracle longevity cures', 'Avoid alarmist medical jargon'],
      },
      audienceAngles: [
        {
          audience: 'Busy Austin professionals ages 30-55',
          message: 'Understand your baseline early without decoding complex lab reports alone.',
        },
      ],
    },
  };
}

function makeCompleteMessagingState(brand: Brand): BrandMessagingState {
  const snapshot = evaluateFoundationDependency(brand, makeCompletedFoundationModule(brand)).approvedFoundation;
  const base = createInitialBrandMessagingState(brand, snapshot);
  return {
    ...base,
    coreValueProposition: {
      ...base.coreValueProposition,
      statement: 'Physician-reviewed biomarker clarity for proactive adults.',
      approved: true,
      approvedAt: '2026-11-15T12:10:00.000Z',
    },
    messagingPillars: {
      ...base.messagingPillars,
      pillars: [
        { id: 'p1', title: 'Clinical Clarity', summary: 'Plain-language physician reviews.' },
        { id: 'p2', title: 'Preventive Cadence', summary: 'Quarterly tracking before symptoms.' },
      ],
      approved: true,
      approvedAt: '2026-11-15T12:15:00.000Z',
    },
    voiceAndTone: {
      ...base.voiceAndTone,
      attributes: ['Calm', 'Evidence-led'],
      guardrails: ['Avoid hype or unverified longevity claims'],
      approved: true,
      approvedAt: '2026-11-15T12:20:00.000Z',
    },
    audienceAngles: {
      ...base.audienceAngles,
      angles: [
        {
          id: 'a1',
          audience: 'Time-pressed executives',
          message: 'Preventive biomarker clarity in one structured clinician briefing.',
        },
      ],
      approved: true,
      approvedAt: '2026-11-15T12:25:00.000Z',
    },
    aiSynthesis: {
      promptId: 'brand_messaging_framework',
      promptVersion: '1.0.0',
      sourceClassification: 'reconstructed',
      model: 'gemini-4-hydrogen',
      generatedAt: '2026-11-15T12:00:00.000Z',
      suppliedFactsUsed: ['Brand Name: Solstice Health'],
      missingContextNotes: [],
      aiSuggestionsSummary: { note: 'Verified prompt provenance.' },
    },
  };
}

test('Brand Foundation prerequisite check enforces completion, approved-only extraction, and brand isolation', () => {
  const brandA = makeBrand({ id: 'brand-a' });
  const brandB = makeBrand({ id: 'brand-b', brandName: 'Other Brand' });

  // Missing Brand Foundation blocks messaging generation
  const missingCheck = checkMessagingGenerationReadiness(brandA, null);
  assert.equal(missingCheck.ready, false);
  assert.equal(missingCheck.foundationReady, false);
  assert.equal(missingCheck.approvedFoundation, null);
  assert.match(missingCheck.reason ?? '', /Brand Foundation/);

  // In-progress Brand Foundation blocks messaging generation
  const incompleteFoundationModule: BrandStrategyModule = {
    ...makeCompletedFoundationModule(brandA),
    status: 'in_progress',
  };
  const inProgressCheck = evaluateFoundationDependency(brandA, incompleteFoundationModule);
  assert.equal(inProgressCheck.ready, false);
  assert.equal(inProgressCheck.status, 'in_progress');

  // Foreign brand foundation throws MessagingIsolationError
  const foreignFoundation = makeCompletedFoundationModule(brandB);
  assert.throws(
    () => evaluateFoundationDependency(brandA, foreignFoundation),
    MessagingIsolationError,
  );

  // Completed foundation extracts ONLY approved facts (ignoring pending/rejected AI suggestions)
  const readyCheck = checkMessagingGenerationReadiness(brandA, makeCompletedFoundationModule(brandA));
  assert.equal(readyCheck.ready, true);
  assert.equal(readyCheck.foundationReady, true);
  assert.equal(readyCheck.profileReady, true);
  assert.ok(readyCheck.approvedFoundation);
  assert.equal(
    readyCheck.approvedFoundation?.purposeStatement,
    'Approved Purpose: Replace guesswork with preventive clarity.',
  );

  const promptVars = buildMessagingPromptVariables(brandA, readyCheck.approvedFoundation!);
  assert.equal(promptVars.approvedBrandFoundation.includes('UNAPPROVED AI SUGGESTION'), false);
  assert.equal(promptVars.approvedBrandFoundation.includes('SHOULD_NOT_LEAK_SUGGESTION'), false);
  assert.match(promptVars.approvedBrandFoundation, /Approved Purpose/);

  // Incomplete brand profile detects missing fields even when foundation is ready
  const incompleteProfileBrand = makeBrand({ id: 'brand-a', targetMarket: ' ' });
  const missingProfileCheck = checkMessagingGenerationReadiness(
    incompleteProfileBrand,
    makeCompletedFoundationModule(incompleteProfileBrand),
  );
  assert.equal(missingProfileCheck.ready, false);
  assert.equal(missingProfileCheck.foundationReady, true);
  assert.equal(missingProfileCheck.profileReady, false);
  assert.deepEqual(missingProfileCheck.missingProfileFields, ['targetMarket']);
});

test('validateMessagingFrameworkOutput and applyAiMessagingResult reject invalid output and protect approved sections', () => {
  const brand = makeBrand();
  const initial = createInitialBrandMessagingState(brand);

  // Rejects nested incomplete pillars/voiceAndTone
  const invalidValidation = validateMessagingFrameworkOutput({
    suppliedFactsUsed: ['Solstice Health'],
    aiSuggestions: {},
    coreValueProposition: 'Valid statement',
    messagingPillars: [{ title: 'Only one pillar', summary: '' }],
    voiceAndTone: { attributes: ['Calm'], guardrails: [] },
    audienceAngles: [{ audience: 'Adults', message: 'Clear labs' }],
  });
  assert.equal(invalidValidation.valid, false);
  assert.match(invalidValidation.safeError ?? '', /messagingPillars/);

  // Applying validation_error execution never mutates state
  const rejectedResult = applyAiMessagingResult(initial, {
    status: 'validation_error',
    brandId: brand.id,
    promptId: 'brand_messaging_framework',
    promptVersion: '1.0.0',
    targetModule: 'brandMessaging',
    model: 'gemini-4-hydrogen',
    generatedAt: '2026-11-15T12:00:00.000Z',
    error: 'Invalid schema',
    errors: ['Invalid schema'],
    canSave: false,
  });
  assert.equal(rejectedResult.applied, false);
  assert.deepEqual(rejectedResult.state, initial);

  // Set up state with approved coreValueProposition and user draft on pillars
  const withApprovedCore: BrandMessagingState = {
    ...initial,
    coreValueProposition: {
      ...initial.coreValueProposition,
      statement: 'Approved user-owned core value proposition.',
      approved: true,
      approvedAt: '2026-11-15T11:30:00.000Z',
    },
    messagingPillars: {
      ...initial.messagingPillars,
      pillars: [{ id: 'user-p1', title: 'User Draft Pillar', summary: 'Draft summary' }],
      approved: false,
      approvedAt: null,
    },
  };

  const validExecution = makeValidExecutionResult(brand.id);
  const applied = applyAiMessagingResult(withApprovedCore, validExecution, {
    overwriteApproved: false,
  });

  assert.equal(applied.applied, true);
  // Approved Core Value Proposition strictly preserved and not replaced
  assert.equal(applied.state.coreValueProposition.approved, true);
  assert.equal(
    applied.state.coreValueProposition.statement,
    'Approved user-owned core value proposition.',
  );
  assert.equal(applied.state.coreValueProposition.aiSuggestedStatement, null);

  // Unapproved Pillars retains user draft AND stores AI suggestion separately as pending_review
  assert.equal(applied.state.messagingPillars.pillars[0]?.title, 'User Draft Pillar');
  assert.equal(applied.state.messagingPillars.aiSuggestedPillars.length, 2);
  assert.equal(applied.state.messagingPillars.suggestionStatus, 'pending_review');
  assert.equal(applied.state.messagingPillars.approved, false);

  // Voice & Tone and Audience Angles receive pending suggestions without auto-approval
  assert.equal(applied.state.voiceAndTone.aiSuggestedAttributes.length, 3);
  assert.equal(applied.state.voiceAndTone.approved, false);
  assert.equal(applied.state.audienceAngles.aiSuggestedAngles.length, 1);
  assert.equal(applied.state.audienceAngles.approved, false);

  // Prompt metadata preserved
  assert.equal(applied.state.aiSynthesis.promptId, 'brand_messaging_framework');
  assert.equal(applied.state.aiSynthesis.promptVersion, '1.0.0');
  assert.equal(applied.state.aiSynthesis.model, 'gemini-4-hydrogen');

  // Explicit overwrite targeting ONLY coreValueProposition resets only that component
  const selectiveOverwrite = applyAiMessagingResult(withApprovedCore, validExecution, {
    overwriteApproved: true,
    targetSections: ['coreValueProposition'],
  });
  assert.equal(selectiveOverwrite.state.coreValueProposition.approved, false);
  assert.ok(selectiveOverwrite.state.coreValueProposition.aiSuggestedStatement);
  // Unrelated section (messagingPillars) untouched when targetSections omitted it
  assert.equal(selectiveOverwrite.state.messagingPillars.aiSuggestedPillars.length, 0);

  // Cross-brand result throws MessagingIsolationError
  assert.throws(
    () => applyAiMessagingResult(initial, makeValidExecutionResult('foreign-brand')),
    MessagingIsolationError,
  );
});

test('section validation, progress tracking, completion gating, and payload serialization work end-to-end', () => {
  const brand = makeBrand();
  const empty = createInitialBrandMessagingState(brand);

  assert.ok(validateMessagingSection('coreValueProposition', empty).statement);
  assert.ok(validateMessagingSection('messagingPillars', empty).pillars);
  assert.ok(validateMessagingSection('voiceAndTone', empty).attributes);
  assert.ok(validateMessagingSection('voiceAndTone', empty).guardrails);
  assert.ok(validateMessagingSection('audienceAngles', empty).angles);

  const initialProgress = computeMessagingProgress(empty);
  assert.equal(initialProgress.approvedCount, 0);
  assert.equal(initialProgress.totalSections, 4);
  assert.equal(initialProgress.percentage, 0);
  assert.equal(initialProgress.allSectionsApproved, false);

  // Cannot complete when unapproved
  assert.throws(
    () => buildMessagingUpsertPayload(empty, 'completed'),
    /Cannot complete Brand Messaging/,
  );

  // Saving in-progress succeeds cleanly
  const draftPayload = buildMessagingUpsertPayload(empty, 'in_progress');
  assert.equal(draftPayload.status, 'in_progress');

  // Partial pillar validation error
  const onePillarState: BrandMessagingState = {
    ...empty,
    messagingPillars: {
      ...empty.messagingPillars,
      pillars: [{ id: 'p1', title: 'Only One', summary: 'Summary' }],
    },
  };
  assert.match(
    validateMessagingSection('messagingPillars', onePillarState).pillars ?? '',
    /at least two/,
  );

  // Complete approved state unlocks completion payload with prompt metadata & approvedSummary
  const complete = makeCompleteMessagingState(brand);
  const check = canCompleteBrandMessaging(complete);
  assert.equal(check.allowed, true);
  assert.deepEqual(check.incompleteSections, []);

  const completedPayload = buildMessagingUpsertPayload(
    complete,
    'completed',
    '2026-11-15T13:00:00.000Z',
  );
  assert.equal(completedPayload.status, 'completed');
  assert.equal(completedPayload.promptId, 'brand_messaging_framework');
  assert.equal(completedPayload.promptVersion, '1.0.0');
  assert.equal(completedPayload.model, 'gemini-4-hydrogen');
  assert.equal(completedPayload.generatedAt, '2026-11-15T12:00:00.000Z');
  assert.ok((completedPayload.content as unknown as BrandMessagingState).approvedSummary);
});

test('hydrateBrandMessagingState restores persisted state and blocks cross-brand leakage', () => {
  const brandA = makeBrand({ id: 'brand-a' });
  const brandB = makeBrand({ id: 'brand-b', brandName: 'Beta Brand' });

  const completeA = makeCompleteMessagingState(brandA);
  const payloadA = buildMessagingUpsertPayload(
    completeA,
    'completed',
    '2026-11-15T13:00:00.000Z',
  );

  const moduleA: BrandStrategyModule = {
    id: 'mod-msg-a',
    userId: brandA.userId,
    brandId: brandA.id,
    moduleKey: 'brandMessaging',
    status: 'completed',
    content: payloadA.content!,
    promptId: payloadA.promptId ?? null,
    promptVersion: payloadA.promptVersion ?? null,
    model: payloadA.model ?? null,
    generatedAt: payloadA.generatedAt ?? null,
    createdAt: '2026-11-15T13:00:00.000Z',
    updatedAt: '2026-11-15T13:00:00.000Z',
  };

  const hydrated = hydrateBrandMessagingState(brandA, moduleA);
  assert.equal(hydrated.brandId, 'brand-a');
  assert.equal(hydrated.coreValueProposition.approved, true);
  assert.equal(hydrated.messagingPillars.pillars.length, 2);
  assert.equal(hydrated.voiceAndTone.attributes.length, 2);
  assert.equal(hydrated.audienceAngles.angles.length, 1);
  assert.equal(hydrated.aiSynthesis.promptId, 'brand_messaging_framework');

  assert.throws(
    () => hydrateBrandMessagingState(brandB, moduleA),
    MessagingIsolationError,
  );
});

test('reopening completed Brand Messaging or overwriting approved components clears stale approvedSummary and completedAt', () => {
  const brand = makeBrand();
  const complete = makeCompleteMessagingState(brand);
  const completedPayload = buildMessagingUpsertPayload(
    complete,
    'completed',
    '2026-11-15T13:00:00.000Z',
  );
  const completedContent = completedPayload.content as unknown as BrandMessagingState;
  assert.ok(completedContent.approvedSummary);
  assert.equal(completedContent.completedAt, '2026-11-15T13:00:00.000Z');

  const reopenedState: BrandMessagingState = {
    ...completedContent,
    coreValueProposition: {
      ...completedContent.coreValueProposition,
      approved: false,
      approvedAt: null,
    },
  };
  const reopenedPayload = buildMessagingUpsertPayload(reopenedState, 'in_progress');
  const reopenedContent = reopenedPayload.content as unknown as BrandMessagingState;
  assert.equal(reopenedPayload.status, 'in_progress');
  assert.equal(reopenedContent.approvedSummary, null);
  assert.equal(reopenedContent.completedAt, null);

  const overwritten = applyAiMessagingResult(
    completedContent,
    makeValidExecutionResult(brand.id),
    { overwriteApproved: true, targetSections: ['coreValueProposition'] },
  );
  assert.equal(overwritten.applied, true);
  assert.equal(overwritten.state.coreValueProposition.approved, false);
  assert.equal(overwritten.state.approvedSummary, null);
  assert.equal(overwritten.state.completedAt, null);
});

