import test from 'node:test';
import assert from 'node:assert/strict';
import type { Brand, BrandStrategyModule } from '../types/brand.ts';
import type { PromptExecutionResult } from '../prompts/types.ts';
import {
  ContentStrategyIsolationError,
  adoptAiContentFormatSuggestion,
  adoptAiContentObjectiveSuggestion,
  adoptAiContentPillarSuggestion,
  adoptAiContentSeriesSuggestion,
  adoptAiContentThemeSuggestion,
  adoptAiDistributionSuggestion,
  adoptAiGovernanceSuggestion,
  applyAiContentDistributionResult,
  applyAiContentFormatsResult,
  applyAiContentGovernanceResult,
  applyAiContentObjectivesResult,
  applyAiContentPillarsResult,
  applyAiContentThemesResult,
  buildContentPromptVariables,
  buildContentStrategyUpsertPayload,
  canCompleteContentStrategy,
  checkContentDistributionReadiness,
  checkContentFormatsReadiness,
  checkContentGovernanceReadiness,
  checkContentObjectivesReadiness,
  checkContentPillarsReadiness,
  checkContentThemesReadiness,
  computeContentStrategyProgress,
  createBlankContentFormat,
  createBlankContentObjective,
  createBlankContentPillar,
  createBlankContentSeries,
  createBlankContentTheme,
  createBlankDistributionApproach,
  createBlankGovernanceStandard,
  createInitialContentStrategyState,
  dismissAiContentObjectiveSuggestion,
  evaluateContentStrategyDependencies,
  hydrateContentStrategyState,
  removeContentPillarFromState,
  validateContentFormat,
  validateContentObjective,
  validateContentPillar,
  validateContentSeries,
  validateContentTheme,
  validateDistributionApproach,
  validateGovernanceStandard,
} from './contentStrategyLogic.ts';

function makeBrand(overrides: Partial<Brand> = {}): Brand {
  return {
    id: 'brand-cs-1',
    userId: 'owner-1',
    brandName: 'Solstice Health',
    businessDescription: 'Preventive biomarker diagnostics and clinician-led longevity plans.',
    industry: 'Health & Wellness',
    productsOrServices: 'Quarterly biomarker panels and MD longevity care',
    targetMarket: 'Proactive founders and executives ages 30-55',
    primaryLocation: 'Austin, TX',
    websiteUrl: 'https://solstice.example.com',
    socialLinks: '',
    existingMission: 'Make preventive longevity actionable.',
    existingVision: '',
    marketingChallenges: 'Building clinical credibility online.',
    businessGoals: 'Grow annual preventive memberships.',
    competitors: 'Generic telehealth clinics',
    additionalNotes: '',
    moduleStatuses: {
      brandFoundation: 'completed',
      brandMessaging: 'completed',
      customerIntelligence: 'completed',
      marketingStrategy: 'completed',
      contentStrategy: 'not_started',
      contentCalendar: 'not_started',
      contentStudio: 'not_started',
    },
    contentPiecesCount: 0,
    pendingApprovalsCount: 0,
    createdAt: '2026-11-18T00:00:00.000Z',
    updatedAt: '2026-11-18T00:00:00.000Z',
    lastAccessedAt: '2026-11-18T00:00:00.000Z',
    ...overrides,
  };
}

function makeCompletedUpstreamModules(brand: Brand): BrandStrategyModule[] {
  const now = '2026-11-19T00:00:00.000Z';
  const foundation: BrandStrategyModule = {
    id: 'mod-f-1',
    userId: brand.userId,
    brandId: brand.id,
    moduleKey: 'brandFoundation',
    status: 'completed',
    content: {
      schemaVersion: 1,
      brandId: brand.id,
      completedAt: now,
      purpose: {
        problemAddressed: 'Late-stage chronic disease detection',
        peopleServed: 'Proactive founders and executives',
        positiveChange: 'Earlier preventive interventions',
        statement: 'Make preventive longevity understandable.',
        approved: true,
        approvedAt: now,
      },
      mission: {
        whatBusinessDoes: 'Biomarker diagnostics',
        whoItServes: 'Proactive adults',
        howItServes: 'Quarterly panels and clinician guidance',
        valueDelivered: 'Clear action plans',
        statement: 'Deliver clinician-led biomarker clarity.',
        approved: true,
        approvedAt: now,
      },
      vision: {
        futureCreated: 'Preventive care precedes chronic illness',
        longTermAmbition: 'Make longitudinal health tracking routine',
        impactAchieved: 'Longer healthspans',
        statement: 'Proactive diagnostics before symptoms start.',
        approved: true,
        approvedAt: now,
      },
      coreValues: {
        values: [
          { id: 'v1', name: 'Clinical Rigor', behaviors: 'Cite studies', whyItMatters: 'Trust' },
          { id: 'v2', name: 'Plain Clarity', behaviors: 'Avoid jargon', whyItMatters: 'Actionable care' },
          { id: 'v3', name: 'Proactive Cadence', behaviors: 'Track trends quarterly', whyItMatters: 'Early insight' },
        ],
        approved: true,
        approvedAt: now,
      },
      positioning: {
        targetMarket: 'Proactive adults 30-55',
        primaryCustomer: 'Time-pressed founders and executives',
        customerProblem: 'Confusing raw lab PDFs without clinical context',
        brandSolution: 'Quarterly panels paired with physician interpretation',
        differentiatingAdvantage: 'Longitudinal physician oversight',
        competitiveDistinction: 'Direct-to-consumer kits without MD guidance',
        mainValueDelivered: 'Actionable preventive clarity',
        statement: 'For Austin leaders seeking physician-guided preventive biomarker plans.',
        differentiationAttributes: ['Clinician-led', 'Quarterly tracking'],
        approved: true,
        approvedAt: now,
      },
      approvedSummary: {
        purposeStatement: 'Make preventive longevity understandable.',
        missionStatement: 'Deliver clinician-led biomarker clarity.',
        visionStatement: 'Proactive diagnostics before symptoms start.',
        coreValues: [
          { id: 'v1', name: 'Clinical Rigor', behaviors: 'Cite studies', whyItMatters: 'Trust' },
          { id: 'v2', name: 'Plain Clarity', behaviors: 'Avoid jargon', whyItMatters: 'Actionable care' },
          { id: 'v3', name: 'Proactive Cadence', behaviors: 'Track trends quarterly', whyItMatters: 'Early insight' },
        ],
        positioningStatement: 'For Austin leaders seeking physician-guided preventive biomarker plans.',
        differentiationAttributes: ['Clinician-led', 'Quarterly tracking'],
        approvedAt: now,
      },
    },
    promptId: 'brand_foundation_synthesis',
    promptVersion: '1.0.0',
    model: 'gemini-4-hydrogen',
    generatedAt: now,
    createdAt: now,
    updatedAt: now,
  };

  const messaging: BrandStrategyModule = {
    id: 'mod-m-1',
    userId: brand.userId,
    brandId: brand.id,
    moduleKey: 'brandMessaging',
    status: 'completed',
    content: {
      schemaVersion: 1,
      brandId: brand.id,
      completedAt: now,
      coreValueProposition: {
        statement: 'Clinician-guided preventive biomarker plans without generic hype.',
        approved: true,
        approvedAt: now,
      },
      messagingPillars: {
        pillars: [
          { id: 'mp1', title: 'Clinical Clarity', summary: 'Plain-language lab analysis.' },
          { id: 'mp2', title: 'Preventive Cadence', summary: 'Quarterly trend tracking.' },
        ],
        approved: true,
        approvedAt: now,
      },
      voiceAndTone: {
        attributes: ['Calm', 'Evidence-led'],
        guardrails: ['Avoid unverified wellness hype'],
        approved: true,
        approvedAt: now,
      },
      audienceAngles: {
        angles: [{ id: 'aa1', audience: 'Austin founders', message: 'Catch trends years early.' }],
        approved: true,
        approvedAt: now,
      },
      approvedSummary: {
        coreValueProposition: 'Clinician-guided preventive biomarker plans without generic hype.',
        messagingPillars: [
          { id: 'mp1', title: 'Clinical Clarity', summary: 'Plain-language lab analysis.' },
          { id: 'mp2', title: 'Preventive Cadence', summary: 'Quarterly trend tracking.' },
        ],
        voiceAndTone: {
          attributes: ['Calm', 'Evidence-led'],
          guardrails: ['Avoid unverified wellness hype'],
        },
        audienceAngles: [{ id: 'aa1', audience: 'Austin founders', message: 'Catch trends years early.' }],
        approvedAt: now,
      },
    },
    promptId: 'brand_messaging_framework',
    promptVersion: '1.0.0',
    model: 'gemini-4-hydrogen',
    generatedAt: now,
    createdAt: now,
    updatedAt: now,
  };

  const customerIntelligence: BrandStrategyModule = {
    id: 'mod-ci-1',
    userId: brand.userId,
    brandId: brand.id,
    moduleKey: 'customerIntelligence',
    status: 'completed',
    content: {
      schemaVersion: 1,
      brandId: brand.id,
      completedAt: now,
      personas: [
        {
          id: 'p1',
          name: 'Time-Pressed Founder',
          roleOrSegment: 'Founder / CEO',
          summary: 'Needs concise physician-backed preventive insights.',
          goals: ['Maintain peak cognitive energy'],
          painPoints: ['Conflicting online lab advice'],
          motivations: ['Long-term healthspan'],
          objections: ['No time for fragmented clinics'],
          purchasingTriggers: ['Annual physical uncertainty'],
          decisionFactors: ['Physician oversight'],
          informationSources: ['Medical podcasts', 'LinkedIn'],
          communicationPreferences: ['Concise email briefs'],
          demographicsRelevant: false,
          demographics: {},
          source: 'manual',
          approved: true,
          approvedAt: now,
        },
      ],
      interests: [
        {
          id: 'i1',
          topic: 'Cardiometabolic Biomarker Clarity',
          linkedPersonaIds: ['p1'],
          frequentQuestions: ['Which markers actually matter before 45?'],
          problemsToSolve: ['Translating ApoB and HbA1c into habits'],
          contentConsumed: ['MD-annotated biomarker breakdowns'],
          searchTopics: ['preventive biomarker panel Austin'],
          productOrServiceInterests: ['Quarterly MD lab reviews'],
          purchaseTriggers: ['Annual physical uncertainty'],
          concernsOrObjections: ['Data privacy'],
          seasonalOrSituationalInterests: ['Q1 health check-in'],
          source: 'manual',
          approved: true,
          approvedAt: now,
        },
      ],
    },
    promptId: 'customer_personas_synthesis',
    promptVersion: '1.0.0',
    model: 'gemini-4-hydrogen',
    generatedAt: now,
    createdAt: now,
    updatedAt: now,
  };

  const marketingStrategy: BrandStrategyModule = {
    id: 'mod-ms-1',
    userId: brand.userId,
    brandId: brand.id,
    moduleKey: 'marketingStrategy',
    status: 'completed',
    content: {
      brandId: brand.id,
      completedAt: now,
      goals: [
        {
          id: 'g1',
          title: 'Build Qualified Consultation Pipeline',
          description: 'Drive qualified discovery bookings from Austin founders.',
          strategicRationale: 'Clinician authority lowers skepticism.',
          targetAudience: 'Time-Pressed Founder',
          supportingBusinessObjective: 'Grow annual preventive memberships.',
          successMetrics: ['Qualified consultations booked'],
          targetValue: 'Baseline in first 30 days',
          measurementPeriod: 'Monthly',
          recommendedTimeframe: 'Next 90 days',
          source: 'manual',
          approved: true,
          approvedAt: now,
        },
      ],
      objectives: [
        {
          id: 'o1',
          title: 'Establish Clinician Authority on Preventive Biomarkers',
          description: 'Publish credible lab breakdowns that build trust.',
          supportingGoalId: 'g1',
          supportingGoalTitle: 'Build Qualified Consultation Pipeline',
          intendedBusinessOutcome: 'Higher inbound consultation quality',
          targetAudience: 'Time-Pressed Founder',
          measurementCriteria: 'Briefing opt-ins and consultation referrals',
          priority: 'high',
          source: 'manual',
          approved: true,
          approvedAt: now,
        },
      ],
      channels: [
        {
          id: 'ch1',
          channelName: 'LinkedIn',
          strategicRationale: 'Primary peer discovery channel for Austin founders.',
          relevantAudience: 'Time-Pressed Founder',
          recommendedUse: 'Weekly biomarker analysis carousels',
          expectedContribution: 'Drives high-trust briefing signups',
          priority: 'primary',
          supportingObjectiveId: 'o1',
          supportingObjectiveTitle: 'Establish Clinician Authority on Preventive Biomarkers',
          source: 'manual',
          approved: true,
          approvedAt: now,
        },
      ],
      tactics: [
        {
          id: 't1',
          tacticName: 'Weekly MD Biomarker Teardown',
          description: 'Break down one preventive biomarker each week.',
          supportingObjectiveId: 'o1',
          supportingObjectiveTitle: 'Establish Clinician Authority on Preventive Biomarkers',
          recommendedChannelId: 'ch1',
          recommendedChannelName: 'LinkedIn',
          targetAudience: 'Time-Pressed Founder',
          executionGuidance: 'MD reviews 5-slide visual breakdown linking to newsletter.',
          suggestedFrequency: 'Weekly',
          successMetric: 'Briefing signups',
          priority: 'high',
          source: 'manual',
          approved: true,
          approvedAt: now,
        },
      ],
      kpis: [
        {
          id: 'k1',
          kpiName: 'Qualified Briefing Signups',
          description: 'Measures founder interest from editorial posts.',
          whatItMeasures: 'Weekly newsletter signups from LinkedIn UTMs',
          relatedObjectiveId: 'o1',
          relatedObjectiveTitle: 'Establish Clinician Authority on Preventive Biomarkers',
          measurementMethod: 'UTM attribution in newsletter platform',
          reportingFrequency: 'Weekly',
          classification: 'leading',
          baselineNote: 'Establish baseline in Weeks 1-4.',
          source: 'manual',
          approved: true,
          approvedAt: now,
        },
      ],
      roadmapItems: [
        {
          id: 'r1',
          phase: 'Phase 1: Foundation',
          activity: 'Set up UTM tracking and launch weekly teardowns',
          description: 'Ensure clean attribution before publishing cadence starts.',
          supportingObjectiveId: 'o1',
          supportingObjectiveTitle: 'Establish Clinician Authority on Preventive Biomarkers',
          channel: 'LinkedIn',
          priority: 'high',
          suggestedTimeframe: 'Weeks 1-4',
          dependencies: ['Approved messaging'],
          successIndicator: '4 consecutive teardowns tracked cleanly',
          decisionInputNeeded: '',
          source: 'manual',
          approved: true,
          approvedAt: now,
        },
      ],
      approvedSummary: {
        approvedAt: now,
      },
    },
    promptId: 'marketing_strategy_roadmap',
    promptVersion: '1.0.0',
    model: 'gemini-4-hydrogen',
    generatedAt: now,
    createdAt: now,
    updatedAt: now,
  };

  return [foundation, messaging, customerIntelligence, marketingStrategy];
}

test('evaluateContentStrategyDependencies enforces all four completed upstream modules and strict brand isolation', () => {
  const brand = makeBrand();
  const modules = makeCompletedUpstreamModules(brand);

  const readyEval = evaluateContentStrategyDependencies(brand, modules);
  assert.equal(readyEval.ready, true);
  assert.equal(readyEval.foundationReady, true);
  assert.equal(readyEval.messagingReady, true);
  assert.equal(readyEval.customerIntelligenceReady, true);
  assert.equal(readyEval.marketingStrategyReady, true);
  assert.equal(readyEval.approvedMarketingChannels.length, 1);
  assert.equal(readyEval.upstreamSnapshot?.primaryChannelNames[0], 'LinkedIn');

  // Incomplete Customer Intelligence blocks readiness
  const incompleteCi = modules.map((m) =>
    m.moduleKey === 'customerIntelligence' ? { ...m, status: 'in_progress' as const } : m,
  );
  const ciBlocked = evaluateContentStrategyDependencies(brand, incompleteCi);
  assert.equal(ciBlocked.ready, false);
  assert.equal(ciBlocked.customerIntelligenceReady, false);
  assert.match(ciBlocked.reason ?? '', /Customer Intelligence/i);

  // Missing Marketing Strategy blocks readiness
  const withoutMs = modules.filter((m) => m.moduleKey !== 'marketingStrategy');
  const msBlocked = evaluateContentStrategyDependencies(brand, withoutMs);
  assert.equal(msBlocked.ready, false);
  assert.equal(msBlocked.marketingStrategyReady, false);
  assert.match(msBlocked.reason ?? '', /Marketing Strategy/i);

  // Cross-brand module throws ContentStrategyIsolationError
  const foreignBrandModules = [
    ...modules.slice(0, 3),
    { ...modules[3], brandId: 'brand-foreign-99' },
  ];
  assert.throws(
    () => evaluateContentStrategyDependencies(brand, foreignBrandModules),
    ContentStrategyIsolationError,
  );

  // Cross-owner module throws ContentStrategyIsolationError
  const foreignOwnerModules = [
    ...modules.slice(0, 3),
    { ...modules[3], userId: 'owner-other-2' },
  ];
  assert.throws(
    () => evaluateContentStrategyDependencies(brand, foreignOwnerModules),
    ContentStrategyIsolationError,
  );
});

test('section validators enforce quality rules: reject generic pillars, pillar-name repetition, and duplicate themes', () => {
  // Generic pillar rejected
  const genericPillar = {
    ...createBlankContentPillar('p-gen'),
    name: 'Educational Content',
    description: 'General tips',
    strategicPurpose: 'Educate readers',
    targetAudienceSegment: 'Founders',
    relevantInterestsAndPainPoints: ['Biomarkers'],
    keyMessages: ['Clarity'],
    supportingTopics: ['Labs'],
    alignedMarketingObjectiveTitle: 'Establish Authority',
  };
  const genericErrs = validateContentPillar(genericPillar);
  assert.ok(genericErrs.name);
  assert.match(genericErrs.name, /generic pillar names/i);

  // Valid distinctive pillar passes
  const validPillar = { ...genericPillar, id: 'p-1', name: 'Preventive Biomarker Diagnostics' };
  assert.deepEqual(validateContentPillar(validPillar), {});

  // Duplicate pillar name rejected
  const dupPillar = { ...validPillar, id: 'p-2' };
  assert.ok(validateContentPillar(dupPillar, [validPillar]).name);

  // Theme repeating pillar name rejected
  const repeatedTheme = {
    ...createBlankContentTheme('th-1', { id: 'p-1', name: validPillar.name }),
    title: 'Preventive Biomarker Diagnostics',
    description: 'Same name as pillar.',
    audienceRelevance: 'Founders care about labs.',
    addressedNeedOrAspiration: 'Conflicting lab advice',
    communicationAngle: 'Clinician breakdown',
    alignedMarketingObjectiveTitle: 'Establish Authority',
  };
  const repeatErrs = validateContentTheme(repeatedTheme, [validPillar]);
  assert.ok(repeatErrs.title);
  assert.match(repeatErrs.title, /not repeat the pillar name/i);

  // Duplicate theme title rejected
  const validTheme = { ...repeatedTheme, title: 'Reading ApoB Before Symptoms Appear' };
  assert.deepEqual(validateContentTheme(validTheme, [validPillar]), {});
  const dupTheme = { ...validTheme, id: 'th-2' };
  assert.ok(validateContentTheme(dupTheme, [validPillar], [validTheme]).title);
});

test('AI suggestions enter pending_review, adoption creates unapproved drafts, and regeneration strictly preserves approved items', () => {
  const brand = makeBrand();
  let state = createInitialContentStrategyState(brand);

  // Pre-existing approved objective
  const approvedManualObj = {
    ...createBlankContentObjective('obj-approved-1'),
    title: 'Approved Manual Objective',
    description: 'Build clinical credibility with Austin founders.',
    targetAudienceOutcomes: ['Understand quarterly lab trends'],
    desiredAudienceActions: ['Book discovery call'],
    alignedMarketingObjectiveTitle: 'Establish Clinician Authority',
    approved: true,
    approvedAt: '2026-11-19T00:00:00.000Z',
  };
  state = { ...state, objectives: [approvedManualObj] };

  const aiResult: PromptExecutionResult = {
    status: 'success',
    canSave: true,
    promptId: 'content_strategy_objectives',
    promptVersion: '1.0.0',
    targetModule: 'contentStrategy',
    sourceClassification: 'reconstructed',
    brandId: brand.id,
    model: 'gemini-4-hydrogen',
    generatedAt: '2026-11-19T02:00:00.000Z',
    metadata: {
      promptId: 'content_strategy_objectives',
      promptVersion: '1.0.0',
      targetModule: 'contentStrategy',
      sourceClassification: 'reconstructed',
      brandId: brand.id,
      model: 'gemini-4-hydrogen',
      generatedAt: '2026-11-19T02:00:00.000Z',
    },
    rawText: '{}',
    output: {
      suppliedFactsUsed: ['Approved Marketing Objective'],
      missingContextNotes: [],
      researchCaveat: 'Requires owner review.',
      aiSuggestions: { note: 'Start with clinician clarity.' },
      objectives: [
        {
          title: 'Clarify Early Cardiometabolic Risk Signals',
          level: 'primary',
          description: 'Demystify ApoB and HbA1c for founders.',
          targetAudienceOutcomes: ['Spot metabolic trends early'],
          desiredAudienceActions: ['Subscribe to MD briefing'],
          alignedMarketingGoalTitle: 'Build Qualified Consultation Pipeline',
          alignedMarketingObjectiveTitle: 'Establish Clinician Authority',
        },
        {
          title: 'Address Fragmented Clinic Objections',
          level: 'supporting',
          description: 'Show unified clinician workflow.',
          targetAudienceOutcomes: ['Confidence in single-team oversight'],
          desiredAudienceActions: ['Review membership guide'],
          alignedMarketingGoalTitle: 'Build Qualified Consultation Pipeline',
          alignedMarketingObjectiveTitle: 'Establish Clinician Authority',
        },
      ],
    },
  };

  // Apply AI result -> enters pending_review and preserves existing approved objective
  const applied = applyAiContentObjectivesResult(state, aiResult);
  assert.equal(applied.applied, true);
  assert.equal(applied.state.objectives.length, 1);
  assert.equal(applied.state.objectives[0].approved, true);
  assert.equal(applied.state.aiSuggestedObjectives.length, 2);
  assert.equal(applied.state.aiSuggestedObjectives[0].suggestionStatus, 'pending_review');

  // Adopt first suggestion -> creates UNAPPROVED draft with source 'ai_adopted'
  const adoptedRes = adoptAiContentObjectiveSuggestion(
    applied.state,
    applied.state.aiSuggestedObjectives[0].id,
    'cobj-adopted-1',
  );
  assert.ok(adoptedRes.adopted);
  assert.equal(adoptedRes.adopted?.approved, false);
  assert.equal(adoptedRes.adopted?.approvedAt, null);
  assert.equal(adoptedRes.adopted?.source, 'ai_adopted');
  assert.equal(adoptedRes.state.objectives.length, 2);

  // Dismiss second suggestion
  const afterDismiss = dismissAiContentObjectiveSuggestion(
    adoptedRes.state,
    adoptedRes.state.aiSuggestedObjectives[1].id,
  );
  assert.equal(afterDismiss.aiSuggestedObjectives[1].suggestionStatus, 'rejected');

  // Regenerating again replaces pending queue while keeping approved & adopted working items untouched
  const regenerated = applyAiContentObjectivesResult(afterDismiss, aiResult);
  assert.equal(regenerated.applied, true);
  assert.equal(regenerated.state.objectives.length, 2);
  assert.equal(regenerated.state.objectives[0].approved, true);
  assert.equal(regenerated.state.objectives[1].approved, false);
});

test('sequential readiness, cascade-safe pillar deletion, progress tracking, completion gating, hydration, and upsert serialization work end-to-end', () => {
  const brand = makeBrand();
  const upstream = makeCompletedUpstreamModules(brand);
  let state = createInitialContentStrategyState(brand);
  state.editorialContext = {
    publishingCapacity: '2 LinkedIn posts/wk',
    productionConstraints: 'No studio video',
    editorialNotes: 'Clinician reviewed',
  };

  assert.match(String(buildContentPromptVariables(brand, state).contentConstraints), /2 LinkedIn posts/);
  assert.equal(checkContentObjectivesReadiness(brand, upstream).ready, true);
  assert.equal(checkContentPillarsReadiness(brand, upstream, state).ready, false);

  const now = '2026-11-19T05:00:00.000Z';

  // 1. Objective
  const obj = {
    ...createBlankContentObjective('obj-1'),
    title: 'Build Preventive Authority',
    description: 'Educate founders on preventive biomarker diagnostics.',
    targetAudienceOutcomes: ['Understand quarterly lab panels'],
    desiredAudienceActions: ['Join MD briefing'],
    alignedMarketingObjectiveTitle: 'Establish Clinician Authority on Preventive Biomarkers',
    approved: true,
    approvedAt: now,
  };
  assert.deepEqual(validateContentObjective(obj), {});
  state = { ...state, objectives: [obj] };
  assert.equal(checkContentPillarsReadiness(brand, upstream, state).ready, true);
  assert.equal(checkContentThemesReadiness(brand, upstream, state).ready, false);

  // 2. Pillar
  const pillar = {
    ...createBlankContentPillar('pil-1'),
    name: 'Biomarker Decision Intelligence',
    description: 'How leaders interpret preventive lab markers.',
    strategicPurpose: 'Establish clinician credibility.',
    targetAudienceSegment: 'Time-Pressed Founder',
    relevantInterestsAndPainPoints: ['Conflicting online lab advice'],
    keyMessages: ['Plain-language lab analysis'],
    supportingTopics: ['ApoB tracking'],
    alignedMarketingObjectiveTitle: 'Establish Clinician Authority on Preventive Biomarkers',
    approved: true,
    approvedAt: now,
  };
  state = { ...state, pillars: [pillar] };
  assert.equal(checkContentThemesReadiness(brand, upstream, state).ready, true);
  assert.equal(checkContentFormatsReadiness(brand, upstream, state).ready, true);
  assert.equal(checkContentDistributionReadiness(brand, upstream, state).ready, false);
  assert.equal(checkContentGovernanceReadiness(brand, upstream, state).ready, true);

  // 3. Theme
  const theme = {
    ...createBlankContentTheme('thm-1', { id: pillar.id, name: pillar.name }),
    title: 'Quarterly ApoB Trend Interpretation',
    description: 'Why trend lines beat single-point reference ranges.',
    audienceRelevance: 'Founders want early prevention.',
    addressedNeedOrAspiration: 'Avoid late cardiometabolic surprises',
    communicationAngle: 'Clinician chart teardown',
    alignedMarketingObjectiveTitle: 'Establish Clinician Authority on Preventive Biomarkers',
    approved: true,
    approvedAt: now,
  };
  state = { ...state, themes: [theme] };

  // 4. Format + Series
  const format = {
    ...createBlankContentFormat('fmt-1'),
    formatName: 'Annotated Biomarker Carousel',
    purpose: 'Turn dense clinical data into 5-slide visuals.',
    suitablePlatforms: ['LinkedIn'],
    audienceSuitability: 'Scannable between executive meetings.',
    relatedPillarNames: [pillar.name],
    approved: true,
    approvedAt: now,
  };
  assert.deepEqual(validateContentFormat(format), {});

  const series = {
    ...createBlankContentSeries('ser-1'),
    seriesName: 'Tuesday Biomarker Brief',
    description: 'Weekly clinician breakdown of one preventive marker.',
    formatName: format.formatName,
    suitablePlatforms: ['LinkedIn'],
    relatedPillarNames: [pillar.name],
    audienceSuitability: 'Time-Pressed Founder',
    cadenceHint: 'Weekly',
    approved: true,
    approvedAt: now,
  };
  assert.deepEqual(validateContentSeries(series), {});
  state = { ...state, formats: [format], series: [series] };
  assert.equal(checkContentDistributionReadiness(brand, upstream, state).ready, true);

  // 5. Distribution
  const dist = {
    ...createBlankDistributionApproach('dst-1', 'LinkedIn'),
    channelRole: 'Primary authority channel',
    platformConsiderations: 'Lead with data visual on slide 1.',
    recommendedFrequency: '2 posts/week',
    contentMix: ['1 Biomarker Carousel', '1 Operator Q&A post'],
    distributionApproach: 'Publish Tuesday/Thursday mornings with briefing CTA.',
    repurposingOpportunities: ['Expand top carousels into monthly newsletter essays'],
    publishingConstraints: 'Clinician sign-off 48 hours ahead',
    approved: true,
    approvedAt: now,
  };
  assert.deepEqual(validateDistributionApproach(dist), {});
  state = { ...state, distribution: [dist] };

  // 6. Governance
  const gov = {
    ...createBlankGovernanceStandard('gov-1'),
    title: 'Clinical Evidence & Voice Gate',
    category: 'voice_and_messaging' as const,
    qualityStandards: ['Every marker claim cites peer-reviewed source'],
    brandVoiceCompliance: 'Calm, evidence-led, zero hype.',
    messagingConsistency: 'Reinforce clinician-guided preventive positioning.',
    editorialGuidelines: ['Avoid miracle claims or fabricated stats'],
    approvalConsiderations: 'MD and brand owner approve before scheduling.',
    performanceIndicators: ['Qualified Briefing Signups (UTM tracked)'],
    marketingObjectiveAlignment: 'Directly tracks authority-to-briefing conversion.',
    approved: true,
    approvedAt: now,
  };
  assert.deepEqual(validateGovernanceStandard(gov), {});
  state = { ...state, governance: [gov] };

  // Progress & completion allowed
  const progress = computeContentStrategyProgress(state);
  assert.equal(progress.approvedCount, 6);
  assert.equal(progress.percentage, 100);
  const completeCheck = canCompleteContentStrategy(state);
  assert.equal(completeCheck.allowed, true);
  assert.deepEqual(completeCheck.blockers, []);

  // Build upsert payload and hydrate back cleanly
  const upsert = buildContentStrategyUpsertPayload(state, 'completed');
  assert.equal(upsert.status, 'completed');
  assert.ok((upsert.content as Record<string, unknown>).approvedSummary);

  const hydrated = hydrateContentStrategyState(brand, {
    id: 'mod-cs-1',
    userId: brand.userId,
    brandId: brand.id,
    moduleKey: 'contentStrategy',
    status: 'completed',
    content: upsert.content ?? {},
    promptId: null,
    promptVersion: null,
    model: null,
    generatedAt: null,
    createdAt: now,
    updatedAt: now,
  });
  assert.equal(hydrated.objectives.length, 1);
  assert.equal(hydrated.pillars.length, 1);
  assert.equal(hydrated.themes.length, 1);
  assert.equal(hydrated.formats.length, 1);
  assert.equal(hydrated.series.length, 1);
  assert.equal(hydrated.distribution.length, 1);
  assert.equal(hydrated.governance.length, 1);
  assert.ok(hydrated.approvedSummary);

  // Cascade-safe pillar deletion unlinks and unapproves connected themes and blocks completion
  const afterPillarDelete = removeContentPillarFromState(hydrated, pillar.id);
  assert.equal(afterPillarDelete.pillars.length, 0);
  assert.equal(afterPillarDelete.themes[0].associatedPillarId, '');
  assert.equal(afterPillarDelete.themes[0].approved, false);
  assert.equal(canCompleteContentStrategy(afterPillarDelete).allowed, false);
  assert.throws(
    () => buildContentStrategyUpsertPayload(afterPillarDelete, 'completed'),
    /Approve at least one/i,
  );
});

test('all remaining AI result appliers & adoptions handle structured outputs cleanly without auto-approving', () => {
  const brand = makeBrand();
  let state = createInitialContentStrategyState(brand);
  const baseMeta = {
    status: 'success' as const,
    canSave: true as const,
    promptVersion: '1.0.0',
    targetModule: 'contentStrategy' as const,
    sourceClassification: 'reconstructed' as const,
    brandId: brand.id,
    model: 'gemini-4-hydrogen' as const,
    generatedAt: '2026-11-19T06:00:00.000Z',
    rawText: '{}',
  };

  // Pillars
  const pillarRes = applyAiContentPillarsResult(state, {
    ...baseMeta,
    promptId: 'content_strategy_pillars',
    metadata: { ...baseMeta, promptId: 'content_strategy_pillars' },
    output: {
      suppliedFactsUsed: ['Approved Positioning'],
      missingContextNotes: [],
      pillars: [
        {
          name: 'Preventive Lab Breakdowns',
          description: 'Translates clinical panels into founder habits.',
          strategicPurpose: 'Demonstrate clinical rigor.',
          targetAudienceSegment: 'Time-Pressed Founder',
          relevantInterestsAndPainPoints: ['Conflicting lab advice'],
          keyMessages: ['Plain-language clarity'],
          supportingTopics: ['ApoB tracking'],
          alignedMarketingObjectiveTitle: 'Establish Authority',
        },
      ],
    },
  });
  assert.equal(pillarRes.applied, true);
  state = adoptAiContentPillarSuggestion(
    pillarRes.state,
    pillarRes.state.aiSuggestedPillars[0].id,
    'pil-ai-1',
  ).state;
  assert.equal(state.pillars[0].approved, false);
  state = { ...state, pillars: [{ ...state.pillars[0], approved: true }] };

  // Themes (matches approved pillar by name)
  const themeRes = applyAiContentThemesResult(state, {
    ...baseMeta,
    promptId: 'content_strategy_themes',
    metadata: { ...baseMeta, promptId: 'content_strategy_themes' },
    output: {
      suppliedFactsUsed: ['Preventive Lab Breakdowns'],
      missingContextNotes: [],
      themes: [
        {
          title: 'Early ApoB Risk Signals',
          description: 'Reading lipid ratios before symptoms appear.',
          associatedPillarName: 'Preventive Lab Breakdowns',
          audienceRelevance: 'High relevance for 35+ founders.',
          addressedNeedOrAspiration: 'Prevent silent cardiovascular drift',
          communicationAngle: 'MD-annotated visual chart',
          alignedMarketingObjectiveTitle: 'Establish Authority',
        },
      ],
    },
  });
  assert.equal(themeRes.applied, true);
  assert.equal(themeRes.state.aiSuggestedThemes[0].matchedPillarId, 'pil-ai-1');
  state = adoptAiContentThemeSuggestion(
    themeRes.state,
    themeRes.state.aiSuggestedThemes[0].id,
    'thm-ai-1',
  ).state;
  assert.equal(state.themes[0].associatedPillarId, 'pil-ai-1');
  assert.equal(state.themes[0].approved, false);

  // Formats & Series
  const fmtRes = applyAiContentFormatsResult(state, {
    ...baseMeta,
    promptId: 'content_strategy_formats',
    metadata: { ...baseMeta, promptId: 'content_strategy_formats' },
    output: {
      suppliedFactsUsed: ['LinkedIn'],
      missingContextNotes: [],
      formats: [
        {
          formatName: 'Visual Biomarker Carousel',
          purpose: 'Concise visual education.',
          suitablePlatforms: ['LinkedIn'],
          audienceSuitability: 'Busy executives.',
          relatedPillarNames: ['Preventive Lab Breakdowns'],
        },
      ],
      series: [
        {
          seriesName: 'Weekly Lab Brief',
          description: 'One marker decoded weekly.',
          formatName: 'Visual Biomarker Carousel',
          suitablePlatforms: ['LinkedIn'],
          relatedPillarNames: ['Preventive Lab Breakdowns'],
          audienceSuitability: 'Time-Pressed Founder',
          cadenceHint: 'Weekly',
        },
      ],
    },
  });
  assert.equal(fmtRes.applied, true);
  state = adoptAiContentFormatSuggestion(
    fmtRes.state,
    fmtRes.state.aiSuggestedFormats[0].id,
    'fmt-ai-1',
  ).state;
  state = adoptAiContentSeriesSuggestion(
    state,
    state.aiSuggestedSeries[0].id,
    'ser-ai-1',
  ).state;
  assert.equal(state.formats[0].approved, false);
  assert.equal(state.series[0].approved, false);

  // Distribution
  const distRes = applyAiContentDistributionResult(state, {
    ...baseMeta,
    promptId: 'content_strategy_distribution',
    metadata: { ...baseMeta, promptId: 'content_strategy_distribution' },
    output: {
      suppliedFactsUsed: ['LinkedIn'],
      missingContextNotes: [],
      distributionPlans: [
        {
          platformName: 'LinkedIn',
          channelRole: 'Primary authority channel',
          platformConsiderations: 'High-contrast slide 1.',
          recommendedFrequency: '2x/week',
          contentMix: ['1 Carousel', '1 Text Q&A'],
          distributionApproach: 'Tuesday/Thursday mornings.',
          repurposingOpportunities: ['Monthly digest email'],
          publishingConstraints: 'Clinician review required',
        },
      ],
    },
  });
  assert.equal(distRes.applied, true);
  state = adoptAiDistributionSuggestion(
    distRes.state,
    distRes.state.aiSuggestedDistribution[0].id,
    'dst-ai-1',
  ).state;
  assert.equal(state.distribution[0].approved, false);

  // Governance
  const govRes = applyAiContentGovernanceResult(state, {
    ...baseMeta,
    promptId: 'content_strategy_governance',
    metadata: { ...baseMeta, promptId: 'content_strategy_governance' },
    output: {
      suppliedFactsUsed: ['Calm voice'],
      missingContextNotes: [],
      governanceStandards: [
        {
          title: 'Evidence-First Editorial Gate',
          category: 'quality_standard',
          qualityStandards: ['Verify lab reference citations'],
          brandVoiceCompliance: 'Calm and clinician-led.',
          messagingConsistency: 'Matches core value proposition.',
          editorialGuidelines: ['No fabricated statistics'],
          approvalConsiderations: 'Owner sign-off required.',
          performanceIndicators: ['Qualified Briefing Signups'],
          marketingObjectiveAlignment: 'Tracks authority conversion.',
        },
      ],
    },
  });
  assert.equal(govRes.applied, true);
  state = adoptAiGovernanceSuggestion(
    govRes.state,
    govRes.state.aiSuggestedGovernance[0].id,
    'gov-ai-1',
  ).state;
  assert.equal(state.governance[0].approved, false);
});
