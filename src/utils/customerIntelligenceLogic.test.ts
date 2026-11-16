import test from 'node:test';
import assert from 'node:assert/strict';
import type { Brand, BrandStrategyModule } from '../types/brand.ts';
import type { PromptExecutionResult } from '../prompts/types.ts';
import {
  CustomerIntelligenceIsolationError,
  adoptAiInterestSuggestion,
  adoptAiPersonaSuggestion,
  applyAiInterestsResult,
  applyAiPersonasResult,
  buildCustomerIntelligenceUpsertPayload,
  canCompleteCustomerIntelligence,
  checkInterestGenerationReadiness,
  checkPersonaGenerationReadiness,
  computeCustomerIntelligenceProgress,
  createBlankAudienceInterest,
  createBlankPersona,
  createInitialCustomerIntelligenceState,
  dismissAiInterestSuggestion,
  dismissAiPersonaSuggestion,
  evaluateCustomerIntelligenceDependencies,
  hydrateCustomerIntelligenceState,
  removePersonaFromState,
  validateAudienceInterest,
  validatePersona,
} from './customerIntelligenceLogic.ts';

function makeBrand(overrides: Partial<Brand> = {}): Brand {
  return {
    id: 'brand-solstice-1',
    userId: 'owner-1',
    brandName: 'Solstice Health',
    businessDescription: 'Preventive biomarker diagnostics and clinician-led longevity plans.',
    industry: 'Health & Wellness',
    productsOrServices: 'Quarterly biomarker panels and personalized physician reviews',
    targetMarket: 'Proactive working adults ages 30 to 55',
    primaryLocation: 'Austin, TX',
    websiteUrl: 'https://solstice.example.com',
    socialLinks: '',
    existingMission: 'Make preventive health actionable.',
    existingVision: '',
    marketingChallenges: 'Building clinical trust before booking a baseline panel.',
    businessGoals: 'Increase annual longevity membership retention.',
    competitors: 'Consumer test kits without physician guidance',
    additionalNotes: '',
    moduleStatuses: {
      brandFoundation: 'completed',
      brandMessaging: 'completed',
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

function makeCompletedFoundationModule(brandId = 'brand-solstice-1'): BrandStrategyModule {
  return {
    id: 'mod-foundation-1',
    userId: 'owner-1',
    brandId,
    moduleKey: 'brandFoundation',
    status: 'completed',
    content: {
      brandId,
      purpose: {
        problemAddressed: 'Late-stage chronic disease detection',
        peopleServed: 'Proactive adults',
        positiveChange: 'Earlier preventive interventions',
        statement: 'Exist to turn complex biomarkers into early preventive action.',
        approved: true,
        approvedAt: '2026-11-15T10:00:00.000Z',
      },
      mission: {
        whatBusinessDoes: 'Biomarker diagnostics',
        whoItServes: 'Proactive adults',
        howItServes: 'Quarterly panels and clinician guidance',
        valueDelivered: 'Clear action plans',
        statement: 'Deliver clinician-guided preventive diagnostics for busy adults.',
        approved: true,
        approvedAt: '2026-11-15T10:01:00.000Z',
      },
      vision: {
        futureCreated: 'Preventive care comes before symptoms',
        longTermAmbition: 'Make longitudinal health tracking standard',
        impactAchieved: 'Longer healthspans',
        statement: 'A future where preventive biomarker care is routine.',
        approved: true,
        approvedAt: '2026-11-15T10:02:00.000Z',
      },
      coreValues: {
        values: [
          {
            id: 'val-1',
            name: 'Clinical Rigor',
            behaviors: 'Cite reference ranges transparently.',
            whyItMatters: 'Builds lasting patient trust.',
          },
        ],
        approved: true,
        approvedAt: '2026-11-15T10:03:00.000Z',
      },
      positioning: {
        targetMarket: 'Proactive adults 30-55',
        primaryCustomer: 'Time-pressed founders and executives',
        customerProblem: 'Confusing lab results without clinical context',
        brandSolution: 'Quarterly panels paired with physician interpretation',
        differentiatingAdvantage: 'Longitudinal physician oversight',
        competitiveDistinction: 'Direct-to-consumer kits without MD guidance',
        mainValueDelivered: 'Actionable preventive clarity',
        differentiationAttributes: ['Clinician-led', 'Longitudinal biomarker trends'],
        statement: 'For proactive adults seeking clarity, Solstice Health delivers physician-backed biomarker plans.',
        approved: true,
        approvedAt: '2026-11-15T10:04:00.000Z',
      },
      completedAt: '2026-11-15T10:05:00.000Z',
      approvedSummary: {
        purposeStatement: 'Exist to turn complex biomarkers into early preventive action.',
        missionStatement: 'Deliver clinician-guided preventive diagnostics for busy adults.',
        visionStatement: 'A future where preventive biomarker care is routine.',
        coreValues: [
          {
            id: 'val-1',
            name: 'Clinical Rigor',
            behaviors: 'Cite reference ranges transparently.',
            whyItMatters: 'Builds lasting patient trust.',
          },
        ],
        positioningStatement:
          'For proactive adults seeking clarity, Solstice Health delivers physician-backed biomarker plans.',
        differentiationAttributes: ['Clinician-led', 'Longitudinal biomarker trends'],
        approvedAt: '2026-11-15T10:05:00.000Z',
      },
    },
    promptId: 'brand_foundation_synthesis',
    promptVersion: '1.0.0',
    model: 'gemini-4-hydrogen',
    generatedAt: '2026-11-15T09:50:00.000Z',
    createdAt: '2026-11-15T09:50:00.000Z',
    updatedAt: '2026-11-15T10:05:00.000Z',
  };
}

function makeCompletedMessagingModule(
  brandId = 'brand-solstice-1',
  overrides: Partial<BrandStrategyModule> = {},
): BrandStrategyModule {
  return {
    id: 'mod-messaging-1',
    userId: 'owner-1',
    brandId,
    moduleKey: 'brandMessaging',
    status: 'completed',
    content: {
      brandId,
      coreValueProposition: {
        statement: 'Turn quarterly lab markers into a clear physician-backed action plan.',
        approved: true,
        approvedAt: '2026-11-15T11:00:00.000Z',
      },
      messagingPillars: {
        pillars: [
          { id: 'p-1', title: 'Clinical Clarity', summary: 'Every biomarker explained by a physician.' },
          { id: 'p-2', title: 'Early Detection', summary: 'Track trends across every quarter.' },
        ],
        approved: true,
        approvedAt: '2026-11-15T11:01:00.000Z',
      },
      voiceAndTone: {
        attributes: ['Calm', 'Evidence-led'],
        guardrails: ['Never promise miraculous cures'],
        approved: true,
        approvedAt: '2026-11-15T11:02:00.000Z',
      },
      audienceAngles: {
        angles: [
          {
            id: 'a-1',
            audience: 'Time-pressed founders',
            message: 'Replace scattered blood tests with one physician-guided dashboard.',
          },
        ],
        approved: true,
        approvedAt: '2026-11-15T11:03:00.000Z',
      },
      completedAt: '2026-11-15T11:05:00.000Z',
      approvedSummary: {
        coreValueProposition: 'Turn quarterly lab markers into a clear physician-backed action plan.',
        messagingPillars: [
          { id: 'p-1', title: 'Clinical Clarity', summary: 'Every biomarker explained by a physician.' },
          { id: 'p-2', title: 'Early Detection', summary: 'Track trends across every quarter.' },
        ],
        voiceAndTone: {
          attributes: ['Calm', 'Evidence-led'],
          guardrails: ['Never promise miraculous cures'],
        },
        audienceAngles: [
          {
            id: 'a-1',
            audience: 'Time-pressed founders',
            message: 'Replace scattered blood tests with one physician-guided dashboard.',
          },
        ],
        approvedAt: '2026-11-15T11:05:00.000Z',
      },
    },
    promptId: 'brand_messaging_framework',
    promptVersion: '1.0.0',
    model: 'gemini-4-hydrogen',
    generatedAt: '2026-11-15T10:50:00.000Z',
    createdAt: '2026-11-15T10:50:00.000Z',
    updatedAt: '2026-11-15T11:05:00.000Z',
    ...overrides,
  };
}

function makePersonaSuccessResult(brandId = 'brand-solstice-1'): PromptExecutionResult {
  return {
    status: 'success',
    brandId,
    promptId: 'customer_personas_synthesis',
    promptVersion: '1.0.0',
    targetModule: 'customerIntelligence',
    sourceClassification: 'reconstructed',
    model: 'gemini-4-hydrogen',
    generatedAt: '2026-11-16T01:00:00.000Z',
    rawText: '{}',
    canSave: true,
    metadata: {
      promptId: 'customer_personas_synthesis',
      promptVersion: '1.0.0',
      targetModule: 'customerIntelligence',
      sourceClassification: 'reconstructed',
      brandId,
      model: 'gemini-4-hydrogen',
      generatedAt: '2026-11-16T01:00:00.000Z',
    },
    output: {
      suppliedFactsUsed: ['Brand Name: Solstice Health', 'Primary Location: Austin, TX'],
      missingContextNotes: ['No empirical interview transcripts provided yet.'],
      researchCaveat: 'AI-generated persona hypotheses for review; not verified customer interviews.',
      aiSuggestions: { segmentationRationale: 'Split by preventive health urgency.' },
      personas: [
        {
          name: 'Proactive Executive Optimizer',
          roleOrSegment: 'Busy B2B founder or senior operator',
          summary: 'Tracks energy and longevity biomarkers proactively without spare time to decode raw PDFs.',
          goals: ['Maintain sustained cognitive energy', 'Detect metabolic shifts early'],
          painPoints: ['Conflicting generic lab reports', 'Rushed 10-minute annual checkups'],
          motivations: ['Evidence-backed prevention', 'Time savings'],
          objections: ['Is this redundant with my primary doctor?'],
          purchasingTriggers: ['Noticeable afternoon fatigue', 'Peer recommendation'],
          decisionFactors: ['Physician interpretation', 'Clear action checklist'],
          informationSources: ['Health longevity podcasts', 'Clinician newsletters'],
          communicationPreferences: ['Concise executive summary', 'Quarterly video check-in'],
          demographicsRelevant: false,
          demographics: {},
        },
      ],
    },
  };
}

function makeInterestSuccessResult(brandId = 'brand-solstice-1'): PromptExecutionResult {
  return {
    status: 'success',
    brandId,
    promptId: 'customer_audience_interests',
    promptVersion: '1.0.0',
    targetModule: 'customerIntelligence',
    sourceClassification: 'reconstructed',
    model: 'gemini-4-hydrogen',
    generatedAt: '2026-11-16T02:00:00.000Z',
    rawText: '{}',
    canSave: true,
    metadata: {
      promptId: 'customer_audience_interests',
      promptVersion: '1.0.0',
      targetModule: 'customerIntelligence',
      sourceClassification: 'reconstructed',
      brandId,
      model: 'gemini-4-hydrogen',
      generatedAt: '2026-11-16T02:00:00.000Z',
    },
    output: {
      suppliedFactsUsed: ['Approved persona: Proactive Executive Optimizer'],
      missingContextNotes: [],
      researchCaveat: 'AI audience interest hypotheses derived from approved personas.',
      aiSuggestions: { priorityThemesSummary: 'Focus on biomarker interpretation.' },
      interests: [
        {
          topic: 'Biomarker Trend Tracking & Longevity Diagnostics',
          linkedPersonaNames: ['Proactive Executive Optimizer'],
          frequentQuestions: ['Which markers actually predict metabolic decline?'],
          problemsToSolve: ['Translating lab numbers into daily habits'],
          contentConsumed: ['Physician breakdown articles'],
          searchTopics: ['comprehensive longevity blood panel austin'],
          productOrServiceInterests: ['Quarterly biomarker membership'],
          purchaseTriggers: ['Elevated HbA1c surprise on annual physical'],
          concernsOrObjections: ['Fear of upsells or vague supplement protocols'],
          seasonalOrSituationalInterests: ['New Year executive health resets'],
        },
        {
          topic: 'Clinician-Led Healthspan Coaching',
          linkedPersonaNames: ['Proactive Executive Optimizer'],
          frequentQuestions: ['How quickly does a physician review my results?'],
          problemsToSolve: ['Separating clinical evidence from social media wellness hype'],
          contentConsumed: ['Evidence comparison guides'],
          searchTopics: ['preventive longevity doctor'],
          productOrServiceInterests: ['Clinician review sessions'],
          purchaseTriggers: ['Burnout after travel season'],
          concernsOrObjections: ['Scheduling friction'],
          seasonalOrSituationalInterests: ['Q3 travel fatigue'],
        },
      ],
    },
  };
}

test('dependency gate requires BOTH Brand Foundation AND Brand Messaging to be completed', () => {
  const brand = makeBrand();
  const foundationDone = makeCompletedFoundationModule(brand.id);
  const messagingDone = makeCompletedMessagingModule(brand.id);
  const messagingInProgress = makeCompletedMessagingModule(brand.id, { status: 'in_progress' });

  const missingBoth = evaluateCustomerIntelligenceDependencies(brand, []);
  assert.equal(missingBoth.ready, false);
  assert.equal(missingBoth.foundationReady, false);
  assert.equal(missingBoth.messagingReady, false);

  const missingMessaging = evaluateCustomerIntelligenceDependencies(brand, [foundationDone]);
  assert.equal(missingMessaging.ready, false);
  assert.equal(missingMessaging.foundationReady, true);
  assert.equal(missingMessaging.messagingReady, false);

  const draftMessaging = evaluateCustomerIntelligenceDependencies(brand, [
    foundationDone,
    messagingInProgress,
  ]);
  assert.equal(draftMessaging.ready, false);
  assert.equal(draftMessaging.messagingStatus, 'in_progress');

  const readyBoth = evaluateCustomerIntelligenceDependencies(brand, [
    foundationDone,
    messagingDone,
  ]);
  assert.equal(readyBoth.ready, true);
  assert.equal(readyBoth.foundationReady, true);
  assert.equal(readyBoth.messagingReady, true);
  assert.ok(readyBoth.upstreamSnapshot);
  assert.match(readyBoth.upstreamSnapshot.coreValueProposition, /physician-backed action plan/);

  // Cross-brand isolation enforcement
  assert.throws(
    () =>
      evaluateCustomerIntelligenceDependencies(brand, [
        makeCompletedFoundationModule('foreign-brand-id'),
        messagingDone,
      ]),
    CustomerIntelligenceIsolationError,
  );
});

test('interest AI readiness blocks generation until at least one approved persona exists', () => {
  const brand = makeBrand();
  const modules = [makeCompletedFoundationModule(brand.id), makeCompletedMessagingModule(brand.id)];
  const state = createInitialCustomerIntelligenceState(brand);

  const personaReady = checkPersonaGenerationReadiness(brand, modules);
  assert.equal(personaReady.ready, true);

  const blockedInterestReady = checkInterestGenerationReadiness(brand, modules, state);
  assert.equal(blockedInterestReady.ready, false);
  assert.equal(blockedInterestReady.hasApprovedPersonas, false);

  // Add an unapproved persona -> still blocked
  const unapproved = createBlankPersona('p-1');
  unapproved.name = 'Founder';
  unapproved.roleOrSegment = 'CEO';
  unapproved.summary = 'Busy founder.';
  unapproved.goals = ['Save time'];
  unapproved.painPoints = ['Overwhelmed by data'];
  unapproved.purchasingTriggers = ['Annual physical'];
  unapproved.decisionFactors = ['MD oversight'];

  const withUnapproved = { ...state, personas: [unapproved] };
  assert.equal(checkInterestGenerationReadiness(brand, modules, withUnapproved).ready, false);

  // Approve the persona -> ready
  const withApproved = {
    ...state,
    personas: [{ ...unapproved, approved: true, approvedAt: '2026-11-16T01:30:00.000Z' }],
  };
  const unlocked = checkInterestGenerationReadiness(brand, modules, withApproved);
  assert.equal(unlocked.ready, true);
  assert.equal(unlocked.approvedPersonasCount, 1);
});

test('AI persona & interest generation preserve approved items and require explicit adoption/approval', () => {
  const brand = makeBrand();
  const initial = createInitialCustomerIntelligenceState(brand);

  // Pre-seed a manually approved persona
  const existingPersona = {
    ...createBlankPersona('manual-p-1'),
    name: 'Existing Approved Buyer',
    roleOrSegment: 'Primary Buyer',
    summary: 'Validated by founder interviews.',
    goals: ['Early detection'],
    painPoints: ['Fragmented labs'],
    purchasingTriggers: ['New role stress'],
    decisionFactors: ['Clinical depth'],
    approved: true,
    approvedAt: '2026-11-16T00:15:00.000Z',
  };
  const seeded = { ...initial, personas: [existingPersona] };

  // Apply AI personas -> goes into aiSuggestedPersonas, NEVER touches existingPersona
  const personaApplied = applyAiPersonasResult(seeded, makePersonaSuccessResult(brand.id));
  assert.equal(personaApplied.applied, true);
  assert.equal(personaApplied.state.personas.length, 1);
  assert.equal(personaApplied.state.personas[0].name, 'Existing Approved Buyer');
  assert.equal(personaApplied.state.personas[0].approved, true);
  assert.equal(personaApplied.state.aiSuggestedPersonas.length, 1);
  assert.equal(personaApplied.state.aiSuggestedPersonas[0].suggestionStatus, 'pending_review');
  assert.match(personaApplied.state.personaSynthesis.researchCaveat ?? '', /hypotheses/i);

  // Adopt AI suggestion -> adds as unapproved persona so user must review & approve explicitly
  const suggestionId = personaApplied.state.aiSuggestedPersonas[0].id;
  const adopted = adoptAiPersonaSuggestion(personaApplied.state, suggestionId, 'adopted-p-2');
  assert.ok(adopted.adoptedPersona);
  assert.equal(adopted.adoptedPersona.approved, false);
  assert.equal(adopted.state.personas.length, 2);

  // Approve adopted persona
  const stateWithTwoApproved = {
    ...adopted.state,
    personas: adopted.state.personas.map((p) =>
      p.id === 'adopted-p-2' ? { ...p, approved: true, approvedAt: '2026-11-16T01:45:00.000Z' } : p,
    ),
  };

  // Generate AI interests -> maps to approved persona by name automatically
  const interestApplied = applyAiInterestsResult(
    stateWithTwoApproved,
    makeInterestSuccessResult(brand.id),
  );
  assert.equal(interestApplied.applied, true);
  assert.equal(interestApplied.state.interests.length, 0);
  assert.equal(interestApplied.state.aiSuggestedInterests.length, 2);
  assert.deepEqual(interestApplied.state.aiSuggestedInterests[0].matchedPersonaIds, ['adopted-p-2']);

  // Dismiss one AI suggestion & adopt the other
  const afterDismiss = dismissAiInterestSuggestion(
    interestApplied.state,
    interestApplied.state.aiSuggestedInterests[1].id,
  );
  assert.equal(afterDismiss.aiSuggestedInterests[1].suggestionStatus, 'rejected');

  const adoptedInterest = adoptAiInterestSuggestion(
    afterDismiss,
    afterDismiss.aiSuggestedInterests[0].id,
    'interest-1',
  );
  assert.ok(adoptedInterest.adoptedInterest);
  assert.equal(adoptedInterest.adoptedInterest.approved, false);
  assert.deepEqual(adoptedInterest.adoptedInterest.linkedPersonaIds, ['adopted-p-2']);
});

test('demographics are optional and persona removal maintains relational integrity with interests', () => {
  const brand = makeBrand();
  const personaNoDemo: ReturnType<typeof createBlankPersona> = {
    ...createBlankPersona('p-node-1'),
    name: 'IT Security Lead',
    roleOrSegment: 'Technical Evaluator',
    summary: 'Evaluates compliance without personal demographic relevance.',
    goals: ['Zero audit gaps'],
    painPoints: ['Manual vendor questionnaires'],
    purchasingTriggers: ['SOC 2 renewal'],
    decisionFactors: ['Automated evidence'],
    demographicsRelevant: false,
    approved: true,
    approvedAt: '2026-11-16T01:00:00.000Z',
  };
  assert.deepEqual(validatePersona(personaNoDemo), {});

  const interest: ReturnType<typeof createBlankAudienceInterest> = {
    ...createBlankAudienceInterest('int-1', ['p-node-1']),
    topic: 'SOC 2 Readiness',
    frequentQuestions: ['How long does onboarding take?'],
    approved: true,
    approvedAt: '2026-11-16T01:10:00.000Z',
  };
  assert.deepEqual(validateAudienceInterest(interest, [personaNoDemo]), {});

  let state = {
    ...createInitialCustomerIntelligenceState(brand),
    personas: [personaNoDemo],
    interests: [interest],
  };

  assert.equal(canCompleteCustomerIntelligence(state).allowed, true);

  // Removing persona unlinks the interest and revokes its approval since it has no remaining persona link
  state = removePersonaFromState(state, 'p-node-1');
  assert.equal(state.personas.length, 0);
  assert.deepEqual(state.interests[0].linkedPersonaIds, []);
  assert.equal(state.interests[0].approved, false);
  assert.equal(canCompleteCustomerIntelligence(state).allowed, false);
});

test('completion gating, progress calculation, upsert payload, and cross-brand hydration isolation', () => {
  const brand = makeBrand();
  const persona = {
    ...createBlankPersona('p-1'),
    name: 'Proactive Executive Optimizer',
    roleOrSegment: 'Founder',
    summary: 'Uses quarterly panels for energy longevity.',
    goals: ['Sustained focus'],
    painPoints: ['Scattered labs'],
    purchasingTriggers: ['Annual physical'],
    decisionFactors: ['Physician access'],
    approved: true,
    approvedAt: '2026-11-16T01:00:00.000Z',
  };
  const interest = {
    ...createBlankAudienceInterest('i-1', ['p-1']),
    topic: 'Biomarker Clarity',
    frequentQuestions: ['Which labs matter most?'],
    approved: true,
    approvedAt: '2026-11-16T01:10:00.000Z',
  };

  const state = {
    ...createInitialCustomerIntelligenceState(brand),
    personas: [persona],
    interests: [interest],
  };

  const progress = computeCustomerIntelligenceProgress(state);
  assert.equal(progress.approvedCount, 2);
  assert.equal(progress.percentage, 100);
  assert.equal(progress.allSectionsApproved, true);

  const inProgressPayload = buildCustomerIntelligenceUpsertPayload(state, 'in_progress');
  assert.equal(inProgressPayload.status, 'in_progress');
  assert.equal((inProgressPayload.content as Record<string, unknown>).approvedSummary, null);

  const completedPayload = buildCustomerIntelligenceUpsertPayload(
    state,
    'completed',
    '2026-11-16T03:00:00.000Z',
  );
  assert.equal(completedPayload.status, 'completed');
  const summary = (completedPayload.content as { approvedSummary: { personas: unknown[]; interests: unknown[] } }).approvedSummary;
  assert.equal(summary.personas.length, 1);
  assert.equal(summary.interests.length, 1);

  // Cross-brand hydration isolation
  const foreignModule: BrandStrategyModule = {
    id: 'mod-ci-foreign',
    userId: 'owner-1',
    brandId: 'other-brand-999',
    moduleKey: 'customerIntelligence',
    status: 'completed',
    content: completedPayload.content!,
    promptId: null,
    promptVersion: null,
    model: null,
    generatedAt: null,
    createdAt: '2026-11-16T03:00:00.000Z',
    updatedAt: '2026-11-16T03:00:00.000Z',
  };

  assert.throws(
    () => hydrateCustomerIntelligenceState(brand, foreignModule),
    CustomerIntelligenceIsolationError,
  );
});
