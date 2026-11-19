import test from 'node:test';
import assert from 'node:assert/strict';
import type { Brand, BrandStrategyModule } from '../types/brand.ts';
import type { PromptExecutionSuccess } from '../prompts/types.ts';
import {
  MarketingStrategyIsolationError,
  adoptAiChannelSuggestion,
  adoptAiGoalSuggestion,
  adoptAiKpiSuggestion,
  adoptAiObjectiveSuggestion,
  adoptAiRoadmapSuggestion,
  adoptAiTacticSuggestion,
  applyAiChannelsTacticsResult,
  applyAiGoalsObjectivesResult,
  applyAiKpisResult,
  applyAiRoadmapResult,
  buildMarketingPromptVariables,
  buildMarketingStrategyUpsertPayload,
  canCompleteMarketingStrategy,
  checkChannelsTacticsReadiness,
  checkGoalsObjectivesReadiness,
  checkKpisReadiness,
  checkRoadmapReadiness,
  collectOutstandingInformationGaps,
  computeMarketingStrategyProgress,
  createBlankMarketingChannel,
  createBlankMarketingKpi,
  createBlankMarketingObjective,
  createBlankMarketingTactic,
  createBlankRoadmapItem,
  createBlankSmartGoal,
  createInitialMarketingStrategyState,
  dismissAiGoalSuggestion,
  evaluateMarketingStrategyDependencies,
  hydrateMarketingStrategyState,
  removeChannelFromState,
  removeGoalFromState,
  removeObjectiveFromState,
  validateMarketingChannel,
  validateMarketingKpi,
  validateMarketingObjective,
  validateMarketingTactic,
  validateRoadmapActivity,
  validateSmartGoal,
  type ImplementationRoadmapItem,
  type MarketingChannelItem,
  type MarketingKpiItem,
  type MarketingObjectiveItem,
  type MarketingTacticItem,
  type SmartMarketingGoalItem,
} from './marketingStrategyLogic.ts';

function makeBrand(overrides: Partial<Brand> = {}): Brand {
  return {
    id: 'brand-ms-1',
    userId: 'owner-1',
    brandName: 'Solstice Health',
    businessDescription: 'Preventive biomarker diagnostics and personalized clinician plans.',
    industry: 'Health & Wellness',
    productsOrServices: 'Quarterly biomarker lab panels and clinician coaching',
    targetMarket: 'Proactive founders and executives ages 30 to 55',
    primaryLocation: 'Austin, TX',
    websiteUrl: 'https://solstice.example.com',
    socialLinks: 'https://linkedin.com/company/solstice',
    existingMission: 'Make preventive health understandable.',
    existingVision: 'Proactive care before crisis care.',
    marketingChallenges: 'Building clinical credibility online without hype.',
    businessGoals: 'Grow annual preventive memberships.',
    competitors: 'Generic telehealth clinics',
    additionalNotes: 'Focus on evidence-backed Austin clinicians.',
    moduleStatuses: {
      brandFoundation: 'completed',
      brandMessaging: 'completed',
      customerIntelligence: 'completed',
      marketingStrategy: 'not_started',
      contentStrategy: 'not_started',
      contentCalendar: 'not_started',
      contentStudio: 'not_started',
    },
    contentPiecesCount: 0,
    pendingApprovalsCount: 0,
    createdAt: '2026-11-15T00:00:00.000Z',
    updatedAt: '2026-11-18T00:00:00.000Z',
    lastAccessedAt: '2026-11-18T00:00:00.000Z',
    ...overrides,
  };
}

function makeCompletedFoundation(brand: Brand): BrandStrategyModule {
  return {
    id: 'mod-f-1',
    userId: brand.userId,
    brandId: brand.id,
    moduleKey: 'brandFoundation',
    status: 'completed',
    content: {
      schemaVersion: 1,
      brandId: brand.id,
      purpose: {
        problemAddressed: 'Late-stage chronic disease detection',
        peopleServed: 'Proactive founders and executives',
        positiveChange: 'Earlier preventive interventions',
        statement: 'Empower proactive health decisions.',
        approved: true,
        approvedAt: '2026-11-15T01:00:00.000Z',
      },
      mission: {
        whatBusinessDoes: 'Biomarker diagnostics',
        whoItServes: 'Proactive adults',
        howItServes: 'Quarterly panels and clinician guidance',
        valueDelivered: 'Clear action plans',
        statement: 'Deliver clinician-led biomarker clarity.',
        approved: true,
        approvedAt: '2026-11-15T01:00:00.000Z',
      },
      vision: {
        futureCreated: 'Preventive care precedes chronic illness',
        longTermAmbition: 'Make longitudinal health tracking routine',
        impactAchieved: 'Longer healthspans',
        statement: 'A future where preventive data precedes chronic illness.',
        approved: true,
        approvedAt: '2026-11-15T01:00:00.000Z',
      },
      coreValues: {
        values: [
          { id: 'val-1', name: 'Clinical Rigor', behaviors: 'Cite lab limits', whyItMatters: 'Builds trust' },
          { id: 'val-2', name: 'Plain Clarity', behaviors: 'Avoid jargon', whyItMatters: 'Drives action' },
          { id: 'val-3', name: 'Proactive Care', behaviors: 'Track trends', whyItMatters: 'Early insight' },
        ],
        approved: true,
        approvedAt: '2026-11-15T01:00:00.000Z',
      },
      positioning: {
        targetMarket: 'Proactive adults 30-55',
        primaryCustomer: 'Time-pressed founders and executives',
        customerProblem: 'Confusing lab results without clinical context',
        brandSolution: 'Quarterly panels paired with physician interpretation',
        differentiatingAdvantage: 'Longitudinal physician oversight',
        competitiveDistinction: 'Direct-to-consumer kits without MD guidance',
        mainValueDelivered: 'Actionable preventive clarity',
        statement: 'Clinician-guided preventive biomarker diagnostics for proactive adults.',
        differentiationAttributes: ['Clinician-led', 'Quarterly longitudinal tracking'],
        approved: true,
        approvedAt: '2026-11-15T01:00:00.000Z',
      },
      completedAt: '2026-11-15T02:00:00.000Z',
      approvedSummary: {
        purposeStatement: 'Empower proactive health decisions.',
        missionStatement: 'Deliver clinician-led biomarker clarity.',
        visionStatement: 'A future where preventive data precedes chronic illness.',
        coreValues: [
          { id: 'val-1', name: 'Clinical Rigor', behaviors: 'Cite lab limits', whyItMatters: 'Builds trust' },
          { id: 'val-2', name: 'Plain Clarity', behaviors: 'Avoid jargon', whyItMatters: 'Drives action' },
          { id: 'val-3', name: 'Proactive Care', behaviors: 'Track trends', whyItMatters: 'Early insight' },
        ],
        positioningStatement: 'Clinician-guided preventive biomarker diagnostics for proactive adults.',
        differentiationAttributes: ['Clinician-led', 'Quarterly longitudinal tracking'],
        approvedAt: '2026-11-15T02:00:00.000Z',
      },
    },
    promptId: 'brand_foundation_synthesis',
    promptVersion: '1.0.0',
    model: 'gemini-4-hydrogen',
    generatedAt: '2026-11-15T01:00:00.000Z',
    createdAt: '2026-11-15T01:00:00.000Z',
    updatedAt: '2026-11-15T02:00:00.000Z',
  };
}

function makeCompletedMessaging(brand: Brand): BrandStrategyModule {
  return {
    id: 'mod-m-1',
    userId: brand.userId,
    brandId: brand.id,
    moduleKey: 'brandMessaging',
    status: 'completed',
    content: {
      schemaVersion: 1,
      brandId: brand.id,
      coreValueProposition: {
        statement: 'Clinician-interpreted quarterly biomarkers that turn lab data into calm action.',
        approved: true,
        approvedAt: '2026-11-15T03:00:00.000Z',
      },
      messagingPillars: {
        pillars: [
          { id: 'p1', title: 'Clinical Clarity', summary: 'Plain-language biomarker interpretation.' },
          { id: 'p2', title: 'Longitudinal Tracking', summary: 'Spot metabolic trends early.' },
        ],
        approved: true,
        approvedAt: '2026-11-15T03:00:00.000Z',
      },
      voiceAndTone: {
        attributes: ['Calm', 'Evidence-led'],
        guardrails: ['Never overpromise outcomes'],
        approved: true,
        approvedAt: '2026-11-15T03:00:00.000Z',
      },
      audienceAngles: {
        angles: [{ id: 'a1', audience: 'Busy Founders', message: 'Preventive clarity in 15 minutes per quarter.' }],
        approved: true,
        approvedAt: '2026-11-15T03:00:00.000Z',
      },
      completedAt: '2026-11-15T04:00:00.000Z',
      approvedSummary: {
        coreValueProposition: 'Clinician-interpreted quarterly biomarkers that turn lab data into calm action.',
        messagingPillars: [
          { id: 'p1', title: 'Clinical Clarity', summary: 'Plain-language biomarker interpretation.' },
          { id: 'p2', title: 'Longitudinal Tracking', summary: 'Spot metabolic trends early.' },
        ],
        voiceAndTone: {
          attributes: ['Calm', 'Evidence-led'],
          guardrails: ['Never overpromise outcomes'],
        },
        audienceAngles: [{ id: 'a1', audience: 'Busy Founders', message: 'Preventive clarity in 15 minutes per quarter.' }],
        approvedAt: '2026-11-15T04:00:00.000Z',
      },
    },
    promptId: 'brand_messaging_framework',
    promptVersion: '1.0.0',
    model: 'gemini-4-hydrogen',
    generatedAt: '2026-11-15T03:00:00.000Z',
    createdAt: '2026-11-15T03:00:00.000Z',
    updatedAt: '2026-11-15T04:00:00.000Z',
  };
}

function makeCustomerIntelligence(
  brand: Brand,
  options: { approvePersona?: boolean; approveInterest?: boolean } = {},
): BrandStrategyModule {
  const { approvePersona = true, approveInterest = true } = options;
  return {
    id: 'mod-ci-1',
    userId: brand.userId,
    brandId: brand.id,
    moduleKey: 'customerIntelligence',
    status: approvePersona && approveInterest ? 'completed' : 'in_progress',
    content: {
      schemaVersion: 1,
      brandId: brand.id,
      personas: [
        {
          id: 'persona-1',
          name: 'Proactive Austin Founder',
          roleOrSegment: 'Tech Founder / Executive',
          summary: 'Time-constrained leader who wants quarterly preventive labs interpreted by an MD.',
          goals: ['Maintain high cognitive energy'],
          painPoints: ['Confusing raw lab PDFs'],
          motivations: ['Longevity with clinical rigor'],
          objections: ['Skeptical of influencer wellness apps'],
          purchasingTriggers: ['Annual physical left unanswered questions'],
          decisionFactors: ['Board-certified clinician oversight'],
          informationSources: ['LinkedIn', 'Health podcasts'],
          communicationPreferences: ['Concise email briefs'],
          demographicsRelevant: false,
          demographics: {},
          source: 'manual',
          approved: approvePersona,
          approvedAt: approvePersona ? '2026-11-16T01:00:00.000Z' : null,
        },
      ],
      interests: [
        {
          id: 'interest-1',
          topic: 'Evidence-Based Metabolic Biomarkers',
          linkedPersonaIds: ['persona-1'],
          frequentQuestions: ['Which markers predict energy crashes?'],
          problemsToSolve: ['Translating ApoB and HbA1c into habits'],
          contentConsumed: ['Clinician newsletters'],
          searchTopics: ['preventive biomarker panel Austin'],
          productOrServiceInterests: ['Quarterly MD lab reviews'],
          purchaseTriggers: ['Quarterly health check-in'],
          concernsOrObjections: ['Data privacy'],
          seasonalOrSituationalInterests: ['Q1 annual goal setting'],
          source: 'manual',
          approved: approveInterest,
          approvedAt: approveInterest ? '2026-11-16T02:00:00.000Z' : null,
        },
      ],
    },
    promptId: 'customer_audience_interests',
    promptVersion: '1.0.0',
    model: 'gemini-4-hydrogen',
    generatedAt: '2026-11-16T02:00:00.000Z',
    createdAt: '2026-11-16T01:00:00.000Z',
    updatedAt: '2026-11-16T02:00:00.000Z',
  };
}

function makeValidGoal(overrides: Partial<SmartMarketingGoalItem> = {}): SmartMarketingGoalItem {
  return {
    ...createBlankSmartGoal('goal-1'),
    title: 'Grow Qualified Austin Consultations',
    description: 'Increase qualified clinician discovery calls from Austin executives.',
    strategicRationale: 'Directly converts high-intent founder persona interest into annual plans.',
    targetAudience: 'Proactive Austin Founder',
    supportingBusinessObjective: 'Grow annual preventive memberships.',
    successMetrics: ['Qualified discovery calls booked', 'Consultation-to-member conversion rate'],
    targetValue: 'Baseline to be established in first 30 days; aim for consistent monthly qualified pipeline growth',
    measurementPeriod: 'Monthly',
    recommendedTimeframe: 'Next 90 days',
    approved: true,
    approvedAt: '2026-11-18T01:00:00.000Z',
    ...overrides,
  };
}

function makeValidObjective(
  overrides: Partial<MarketingObjectiveItem> = {},
): MarketingObjectiveItem {
  return {
    ...createBlankMarketingObjective('obj-1', {
      id: 'goal-1',
      title: 'Grow Qualified Austin Consultations',
    }),
    title: 'Establish Clinical Authority Among Austin Founders',
    description: 'Position Solstice clinicians as the clearest preventive biomarker educators in Austin.',
    intendedBusinessOutcome: 'Higher inbound consultation trust and lower skepticism during onboarding.',
    targetAudience: 'Proactive Austin Founder',
    measurementCriteria: 'Inbound discovery call volume citing clinician educational guides',
    priority: 'high',
    approved: true,
    approvedAt: '2026-11-18T01:05:00.000Z',
    ...overrides,
  };
}

function makeValidChannel(overrides: Partial<MarketingChannelItem> = {}): MarketingChannelItem {
  return {
    ...createBlankMarketingChannel('chan-1', {
      id: 'obj-1',
      title: 'Establish Clinical Authority Among Austin Founders',
    }),
    channelName: 'LinkedIn Executive Thought Leadership',
    strategicRationale:
      'Approved Austin Founder persona relies on LinkedIn for peer-vetted clinician analysis rather than consumer social feeds.',
    relevantAudience: 'Proactive Austin Founder',
    recommendedUse: 'Publish MD-authored biomarker case breakdowns and executive health checklists.',
    expectedContribution: 'Drives high-trust discovery traffic and newsletter signups.',
    priority: 'primary',
    approved: true,
    approvedAt: '2026-11-18T01:10:00.000Z',
    ...overrides,
  };
}

function makeValidTactic(overrides: Partial<MarketingTacticItem> = {}): MarketingTacticItem {
  return {
    ...createBlankMarketingTactic('tactic-1', {
      objective: { id: 'obj-1', title: 'Establish Clinical Authority Among Austin Founders' },
      channel: { id: 'chan-1', name: 'LinkedIn Executive Thought Leadership' },
    }),
    tacticName: 'Weekly Clinician Biomarker Breakdown Carousel on LinkedIn',
    description: 'Break down one misunderstood metabolic marker (e.g., ApoB, fasting insulin) into actionable executive insights.',
    targetAudience: 'Proactive Austin Founder',
    executionGuidance:
      'Have lead clinician outline 5 evidence-cited slides each Tuesday covering normal vs optimal ranges, common misconceptions, and a link to the Austin biomarker briefing signup.',
    suggestedFrequency: 'Once per week (Tuesdays)',
    successMetric: 'Briefing page clicks and qualified Austin consultation requests',
    priority: 'high',
    approved: true,
    approvedAt: '2026-11-18T01:15:00.000Z',
    ...overrides,
  };
}

function makeValidKpi(overrides: Partial<MarketingKpiItem> = {}): MarketingKpiItem {
  return {
    ...createBlankMarketingKpi('kpi-1', {
      id: 'obj-1',
      title: 'Establish Clinical Authority Among Austin Founders',
    }),
    kpiName: 'Qualified Discovery Calls from Clinician Content',
    description: 'Tracks booked consultations attributed to LinkedIn briefings and email guides.',
    whatItMeasures: 'Conversion of audience trust into sales-qualified clinician conversations.',
    measurementMethod: 'UTM tracking plus booking form attribution field in CRM',
    reportingFrequency: 'Monthly',
    classification: 'lagging',
    baselineNote: 'Baseline to be established during Month 1 of UTM instrumentation.',
    approved: true,
    approvedAt: '2026-11-18T01:20:00.000Z',
    ...overrides,
  };
}

function makeValidRoadmap(
  overrides: Partial<ImplementationRoadmapItem> = {},
): ImplementationRoadmapItem {
  return {
    ...createBlankRoadmapItem('rm-1', {
      id: 'obj-1',
      title: 'Establish Clinical Authority Among Austin Founders',
    }),
    phase: 'Phase 1: Foundation & Setup',
    activity: 'Configure UTM Attribution & Executive Briefing Landing Page',
    description: 'Instrument booking form attribution and publish the clinician biomarker briefing opt-in.',
    channel: 'Website & LinkedIn',
    priority: 'high',
    suggestedTimeframe: 'Weeks 1–2 (relative to kickoff)',
    dependencies: ['Approved messaging copy', 'Clinician review sign-off'],
    successIndicator: 'Test consultation booking records clean UTM source in CRM',
    decisionInputNeeded: 'Confirm owner sign-off on weekly clinician review hours.',
    approved: true,
    approvedAt: '2026-11-18T01:25:00.000Z',
    ...overrides,
  };
}

test('evaluateMarketingStrategyDependencies requires all 4 upstream prerequisites and enforces strict isolation', () => {
  const brand = makeBrand();
  const foundation = makeCompletedFoundation(brand);
  const messaging = makeCompletedMessaging(brand);
  const ciComplete = makeCustomerIntelligence(brand);

  const readyEval = evaluateMarketingStrategyDependencies(brand, [
    foundation,
    messaging,
    ciComplete,
  ]);
  assert.equal(readyEval.ready, true);
  assert.equal(readyEval.foundationReady, true);
  assert.equal(readyEval.messagingReady, true);
  assert.equal(readyEval.personasReady, true);
  assert.equal(readyEval.interestsReady, true);
  assert.equal(readyEval.approvedPersonasCount, 1);
  assert.equal(readyEval.approvedInterestsCount, 1);
  assert.ok(readyEval.upstreamSnapshot);

  // Missing approved interest blocks readiness
  const ciNoInterest = makeCustomerIntelligence(brand, {
    approvePersona: true,
    approveInterest: false,
  });
  const missingInterestEval = evaluateMarketingStrategyDependencies(brand, [
    foundation,
    messaging,
    ciNoInterest,
  ]);
  assert.equal(missingInterestEval.ready, false);
  assert.equal(missingInterestEval.personasReady, true);
  assert.equal(missingInterestEval.interestsReady, false);
  assert.match(missingInterestEval.reason ?? '', /Audience Interest/);

  // Missing approved persona blocks both personas and linked interests
  const ciNoPersona = makeCustomerIntelligence(brand, {
    approvePersona: false,
    approveInterest: true,
  });
  const missingPersonaEval = evaluateMarketingStrategyDependencies(brand, [
    foundation,
    messaging,
    ciNoPersona,
  ]);
  assert.equal(missingPersonaEval.ready, false);
  assert.equal(missingPersonaEval.personasReady, false);
  assert.equal(missingPersonaEval.interestsReady, false);

  // Foreign brand module throws MarketingStrategyIsolationError
  assert.throws(
    () =>
      evaluateMarketingStrategyDependencies(brand, [
        { ...foundation, brandId: 'foreign-brand-99' },
      ]),
    MarketingStrategyIsolationError,
  );
});

test('step readiness checkers enforce sequential upstream approvals and required profile fields', () => {
  const brand = makeBrand();
  const modules = [
    makeCompletedFoundation(brand),
    makeCompletedMessaging(brand),
    makeCustomerIntelligence(brand),
  ];

  // Missing required profile field fails goals readiness
  const incompleteBrand = makeBrand({ targetMarket: '' });
  const profileCheck = checkGoalsObjectivesReadiness(incompleteBrand, modules);
  assert.equal(profileCheck.ready, false);
  assert.deepEqual(profileCheck.missingProfileFields, ['targetMarket']);

  // Empty strategy state cannot generate channels/tactics, KPIs, or roadmap yet
  const state = createInitialMarketingStrategyState(brand);
  assert.equal(checkGoalsObjectivesReadiness(brand, modules).ready, true);
  assert.equal(checkChannelsTacticsReadiness(brand, modules, state).ready, false);
  assert.equal(checkKpisReadiness(brand, modules, state).ready, false);
  assert.equal(checkRoadmapReadiness(brand, modules, state).ready, false);

  // Approving goal + objective unlocks channels & tactics
  const withGoalsAndObjectives = {
    ...state,
    goals: [makeValidGoal()],
    objectives: [makeValidObjective()],
  };
  assert.equal(checkChannelsTacticsReadiness(brand, modules, withGoalsAndObjectives).ready, true);
  assert.equal(checkKpisReadiness(brand, modules, withGoalsAndObjectives).ready, false);

  // Approving channel + tactic unlocks KPIs & roadmap
  const withChannelsAndTactics = {
    ...withGoalsAndObjectives,
    channels: [makeValidChannel()],
    tactics: [makeValidTactic()],
  };
  assert.equal(checkKpisReadiness(brand, modules, withChannelsAndTactics).ready, true);
  assert.equal(checkRoadmapReadiness(brand, modules, withChannelsAndTactics).ready, true);
});

test('validators enforce specificity, reject generic tactics, and validate all 6 sections', () => {
  const goal = makeValidGoal();
  const obj = makeValidObjective();
  const chan = makeValidChannel();
  const tactic = makeValidTactic();
  const kpi = makeValidKpi();
  const roadmap = makeValidRoadmap();

  assert.deepEqual(validateSmartGoal(goal), {});
  assert.deepEqual(validateMarketingObjective(obj, [goal]), {});
  assert.deepEqual(validateMarketingChannel(chan, [obj]), {});
  assert.deepEqual(validateMarketingTactic(tactic, [obj], [chan]), {});
  assert.deepEqual(validateMarketingKpi(kpi, [obj]), {});
  assert.deepEqual(validateRoadmapActivity(roadmap, [obj]), {});

  // Generic tactic without concrete guidance fails
  const genericTactic = makeValidTactic({
    tacticName: 'Post consistently on social media',
    executionGuidance: 'Post 3x/week.',
  });
  const genericErrors = validateMarketingTactic(genericTactic, [obj], [chan]);
  assert.ok(genericErrors.tacticName);
  assert.ok(genericErrors.executionGuidance);

  // Shallow channel rationale fails
  const weakChannel = makeValidChannel({ strategicRationale: 'Popular app' });
  assert.ok(validateMarketingChannel(weakChannel, [obj]).strategicRationale);

  // Missing KPI baselineNote fails
  const missingBaselineKpi = makeValidKpi({ baselineNote: '' });
  assert.ok(validateMarketingKpi(missingBaselineKpi, [obj]).baselineNote);
});

test('AI result appliers preserve approved items on regeneration and adopted items start unapproved', () => {
  const brand = makeBrand();
  const existingApprovedGoal = makeValidGoal({ id: 'goal-approved-1', title: 'Existing Approved Goal' });
  const state = {
    ...createInitialMarketingStrategyState(brand),
    goals: [existingApprovedGoal],
    objectives: [makeValidObjective({ supportingGoalId: 'goal-approved-1', supportingGoalTitle: 'Existing Approved Goal' })],
    channels: [makeValidChannel()],
  };

  const goalsResult: PromptExecutionSuccess = {
    status: 'success',
    brandId: brand.id,
    promptId: 'marketing_strategy_goals_objectives',
    promptVersion: '1.0.0',
    targetModule: 'marketingStrategy',
    sourceClassification: 'reconstructed',
    model: 'gemini-4-hydrogen',
    generatedAt: '2026-11-18T02:00:00.000Z',
    rawText: '{}',
    canSave: true,
    metadata: {
      promptId: 'marketing_strategy_goals_objectives',
      promptVersion: '1.0.0',
      targetModule: 'marketingStrategy',
      sourceClassification: 'reconstructed',
      brandId: brand.id,
      model: 'gemini-4-hydrogen',
      generatedAt: '2026-11-18T02:00:00.000Z',
    },
    output: {
      suppliedFactsUsed: ['Solstice Health in Austin, TX'],
      missingContextNotes: ['Monthly marketing budget not provided.'],
      researchCaveat: 'AI goals require owner validation.',
      aiSuggestions: { strategicFocusSummary: 'Prioritize clinician authority.' },
      goals: [
        {
          title: 'Build Preventive Newsletter Audience',
          description: 'Grow opted-in Austin executive subscribers.',
          strategicRationale: 'Matches preferred communication channel of approved persona.',
          targetAudience: 'Proactive Austin Founder',
          supportingBusinessObjective: 'Grow annual preventive memberships.',
          successMetrics: ['Qualified Austin newsletter subscribers'],
          targetValue: 'Baseline to be established',
          measurementPeriod: 'Monthly',
          recommendedTimeframe: 'Next 90 days',
        },
      ],
      objectives: [
        {
          title: 'Convert LinkedIn Readers to Briefing Subscribers',
          description: 'Offer an MD-authored biomarker guide on LinkedIn.',
          intendedBusinessOutcome: 'Warm pipeline for quarterly memberships.',
          targetAudience: 'Proactive Austin Founder',
          supportingGoalTitle: 'Existing Approved Goal',
          measurementCriteria: 'Opt-in conversion rate on briefing page',
          priority: 'high',
        },
      ],
    },
  };

  const appliedGoals = applyAiGoalsObjectivesResult(state, goalsResult);
  assert.equal(appliedGoals.applied, true);
  // Existing approved goal is untouched!
  assert.equal(appliedGoals.state.goals.length, 1);
  assert.equal(appliedGoals.state.goals[0].approved, true);
  assert.equal(appliedGoals.state.aiSuggestedGoals.length, 1);
  assert.equal(appliedGoals.state.aiSuggestedObjectives[0].matchedGoalId, 'goal-approved-1');

  // Adopting creates an UNAPPROVED draft
  const adoptedGoal = adoptAiGoalSuggestion(
    appliedGoals.state,
    appliedGoals.state.aiSuggestedGoals[0].id,
    'goal-adopted-1',
  );
  assert.ok(adoptedGoal.adopted);
  assert.equal(adoptedGoal.adopted?.approved, false);
  assert.equal(adoptedGoal.adopted?.source, 'ai_adopted');
  assert.equal(adoptedGoal.state.goals.length, 2);

  // Dismissing marks suggestion rejected without touching working goals
  const dismissed = dismissAiGoalSuggestion(
    appliedGoals.state,
    appliedGoals.state.aiSuggestedGoals[0].id,
  );
  assert.equal(dismissed.aiSuggestedGoals[0].suggestionStatus, 'rejected');
  assert.equal(dismissed.goals.length, 1);

  // Adopt objective, channel, tactic, KPI, roadmap via their appliers
  const adoptedObj = adoptAiObjectiveSuggestion(
    adoptedGoal.state,
    adoptedGoal.state.aiSuggestedObjectives[0].id,
    'obj-adopted-1',
  );
  assert.equal(adoptedObj.adopted?.approved, false);

  const channelsTacticsRes = applyAiChannelsTacticsResult(adoptedObj.state, {
    ...goalsResult,
    promptId: 'marketing_strategy_channels_tactics',
    metadata: { ...goalsResult.metadata, promptId: 'marketing_strategy_channels_tactics' },
    output: {
      suppliedFactsUsed: ['Approved Founder Persona'],
      missingContextNotes: ['Ad spend cap not provided.'],
      researchCaveat: 'Review channels.',
      aiSuggestions: {},
      channels: [
        {
          channelName: 'Clinician Email Briefing',
          strategicRationale: 'Approved persona prefers concise email briefs over social noise.',
          relevantAudience: 'Proactive Austin Founder',
          recommendedUse: 'Bi-weekly biomarker research digest.',
          expectedContribution: 'Nurtures leads to discovery calls.',
          priority: 'primary',
          supportingObjectiveTitle: adoptedObj.state.objectives[0].title,
        },
      ],
      tactics: [
        {
          tacticName: 'Bi-Weekly MD Biomarker Q&A Dispatch',
          description: 'Answer one top founder lab question per issue.',
          supportingObjectiveTitle: adoptedObj.state.objectives[0].title,
          recommendedChannelName: 'Clinician Email Briefing',
          targetAudience: 'Proactive Austin Founder',
          executionGuidance: 'Select one recurring ApoB/HbA1c question from Austin consultations, write a 400-word clinician note with clear action checklist and discovery CTA.',
          suggestedFrequency: 'Bi-weekly',
          successMetric: 'Reply rate and discovery booking clicks',
          priority: 'high',
        },
      ],
    },
  });
  assert.equal(channelsTacticsRes.applied, true);
  const adoptedChan = adoptAiChannelSuggestion(
    channelsTacticsRes.state,
    channelsTacticsRes.state.aiSuggestedChannels[0].id,
    'chan-adopted-1',
  );
  const adoptedTac = adoptAiTacticSuggestion(
    adoptedChan.state,
    adoptedChan.state.aiSuggestedTactics[0].id,
    'tactic-adopted-1',
  );
  assert.equal(adoptedTac.adopted?.recommendedChannelId, 'chan-adopted-1');

  const kpisRes = applyAiKpisResult(adoptedTac.state, {
    ...goalsResult,
    promptId: 'marketing_strategy_kpis',
    metadata: { ...goalsResult.metadata, promptId: 'marketing_strategy_kpis' },
    output: {
      suppliedFactsUsed: ['Approved Objectives'],
      missingContextNotes: ['Current email open rate baseline unknown.'],
      researchCaveat: 'Baselines not fabricated.',
      aiSuggestions: {},
      kpis: [
        {
          kpiName: 'Briefing Click-Through Rate',
          description: 'Tracks reader engagement with clinician guides.',
          whatItMeasures: 'Early message resonance.',
          relatedObjectiveTitle: adoptedTac.state.objectives[0].title,
          measurementMethod: 'ESP link tracking',
          reportingFrequency: 'Bi-weekly',
          classification: 'leading',
          baselineNote: 'Baseline to be established after first 4 dispatches.',
        },
      ],
    },
  });
  assert.equal(kpisRes.applied, true);
  const adoptedKpi = adoptAiKpiSuggestion(
    kpisRes.state,
    kpisRes.state.aiSuggestedKpis[0].id,
    'kpi-adopted-1',
  );
  assert.equal(adoptedKpi.adopted?.classification, 'leading');

  const roadmapRes = applyAiRoadmapResult(adoptedKpi.state, {
    ...goalsResult,
    promptId: 'marketing_strategy_roadmap',
    metadata: { ...goalsResult.metadata, promptId: 'marketing_strategy_roadmap' },
    output: {
      suppliedFactsUsed: ['Approved Channels'],
      missingContextNotes: ['Team capacity per week not confirmed.'],
      researchCaveat: 'Relative phases only.',
      aiSuggestions: {},
      roadmapItems: [
        {
          phase: 'Phase 1: Foundation & Setup',
          activity: 'Launch Briefing Opt-In Template',
          description: 'Publish landing page and ESP double opt-in.',
          supportingObjectiveTitle: adoptedKpi.state.objectives[0].title,
          channel: 'Clinician Email Briefing',
          priority: 'high',
          suggestedTimeframe: 'Weeks 1–2',
          dependencies: ['Approved messaging'],
          successIndicator: 'First test subscriber completes flow',
          decisionInputNeeded: 'Confirm owner sign-off on ESP tool choice.',
        },
      ],
    },
  });
  assert.equal(roadmapRes.applied, true);
  const adoptedRm = adoptAiRoadmapSuggestion(
    roadmapRes.state,
    roadmapRes.state.aiSuggestedRoadmapItems[0].id,
    'rm-adopted-1',
  );
  assert.equal(adoptedRm.adopted?.approved, false);

  const gaps = collectOutstandingInformationGaps(adoptedRm.state);
  assert.equal(gaps.missingContextNotes.length, 4);
  assert.equal(gaps.roadmapDecisionsNeeded.length, 1);
  assert.equal(gaps.baselinesToEstablish.length, 1);
});

test('cascade-safe deletions unlink and unapprove orphaned downstream strategy items', () => {
  const brand = makeBrand();
  const fullState = {
    ...createInitialMarketingStrategyState(brand),
    goals: [makeValidGoal({ id: 'g-1' })],
    objectives: [makeValidObjective({ id: 'o-1', supportingGoalId: 'g-1' })],
    channels: [makeValidChannel({ id: 'c-1', supportingObjectiveId: 'o-1' })],
    tactics: [
      makeValidTactic({
        id: 't-1',
        supportingObjectiveId: 'o-1',
        recommendedChannelId: 'c-1',
      }),
    ],
    kpis: [makeValidKpi({ id: 'k-1', relatedObjectiveId: 'o-1' })],
    roadmapItems: [makeValidRoadmap({ id: 'r-1', supportingObjectiveId: 'o-1' })],
  };

  const afterRemoveGoal = removeGoalFromState(fullState, 'g-1');
  assert.equal(afterRemoveGoal.goals.length, 0);
  assert.equal(afterRemoveGoal.objectives[0].supportingGoalId, '');
  assert.equal(afterRemoveGoal.objectives[0].approved, false);

  const afterRemoveObj = removeObjectiveFromState(fullState, 'o-1');
  assert.equal(afterRemoveObj.channels[0].approved, false);
  assert.equal(afterRemoveObj.tactics[0].approved, false);
  assert.equal(afterRemoveObj.kpis[0].approved, false);
  assert.equal(afterRemoveObj.roadmapItems[0].approved, false);

  const afterRemoveChan = removeChannelFromState(fullState, 'c-1');
  assert.equal(afterRemoveChan.tactics[0].recommendedChannelId, '');
  assert.equal(afterRemoveChan.tactics[0].approved, false);
});

test('progress tracking, completion gating, business constraints serialization, hydration, and upsert payload work end-to-end', () => {
  const brand = makeBrand();
  const completeState = {
    ...createInitialMarketingStrategyState(brand),
    businessContext: {
      budgetConstraints: '$2,500/mo initial test budget',
      teamCapacity: 'Founder + 1 part-time marketer',
      baselinePerformance: 'No paid baseline yet',
      targetTimeline: '90-day pilot',
      additionalConstraints: 'Clinical claims require MD sign-off',
    },
    goals: [makeValidGoal()],
    objectives: [makeValidObjective()],
    channels: [makeValidChannel()],
    tactics: [makeValidTactic()],
    kpis: [makeValidKpi()],
    roadmapItems: [makeValidRoadmap()],
  };

  const vars = buildMarketingPromptVariables(brand, completeState);
  assert.match(vars.businessConstraints, /\$2,500\/mo/);
  assert.match(vars.businessConstraints, /Founder \+ 1 part-time marketer/);

  const progress = computeMarketingStrategyProgress(completeState);
  assert.equal(progress.approvedCount, 6);
  assert.equal(progress.totalSections, 6);
  assert.equal(progress.percentage, 100);
  assert.equal(progress.allSectionsApproved, true);

  const completion = canCompleteMarketingStrategy(completeState);
  assert.equal(completion.allowed, true);
  assert.deepEqual(completion.blockers, []);

  // Upsert completed payload succeeds and captures approvedSummary
  const payload = buildMarketingStrategyUpsertPayload(completeState, 'completed');
  assert.equal(payload.status, 'completed');
  const content = payload.content as Record<string, unknown>;
  assert.ok(content.approvedSummary);
  assert.ok(content.completedAt);

  // Removing approved roadmap blocks completion
  const missingRoadmapState = { ...completeState, roadmapItems: [] };
  assert.equal(canCompleteMarketingStrategy(missingRoadmapState).allowed, false);
  assert.throws(
    () => buildMarketingStrategyUpsertPayload(missingRoadmapState, 'completed'),
    /Implementation Roadmap/,
  );

  // Hydration preserves state and enforces brand isolation
  const persistedRecord: BrandStrategyModule = {
    id: 'mod-ms-1',
    userId: brand.userId,
    brandId: brand.id,
    moduleKey: 'marketingStrategy',
    status: 'completed',
    content,
    promptId: null,
    promptVersion: null,
    model: null,
    generatedAt: null,
    createdAt: '2026-11-18T00:00:00.000Z',
    updatedAt: '2026-11-18T02:00:00.000Z',
  };

  const hydrated = hydrateMarketingStrategyState(brand, persistedRecord);
  assert.equal(hydrated.goals.length, 1);
  assert.equal(hydrated.roadmapItems.length, 1);
  assert.ok(hydrated.approvedSummary);

  assert.throws(
    () =>
      hydrateMarketingStrategyState(brand, {
        ...persistedRecord,
        brandId: 'other-brand',
      }),
    MarketingStrategyIsolationError,
  );
});
