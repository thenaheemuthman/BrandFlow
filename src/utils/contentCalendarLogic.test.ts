import test from 'node:test';
import assert from 'node:assert/strict';
import type {
  Brand,
  BrandStrategyModule,
  ContentCalendar,
  ContentCalendarItem,
} from '../types/brand.ts';
import type { PromptExecutionResult } from '../prompts/types.ts';
import {
  addDaysIso,
  applyCalendarBatchOutput,
  buildCalendarBatchVariables,
  buildContentStudioHandoffPayload,
  buildDefaultCalendarName,
  buildDefaultCalendarSettings,
  buildDuplicateItemInput,
  buildMonthlyCalendarGrid,
  computeCalendarStats,
  computeEndDate,
  createInitialGenerationState,
  diffDaysInclusive,
  evaluateCalendarPrerequisites,
  extractApprovedCalendarContext,
  filterCalendarItems,
  groupItemsByWeek,
  isValidIsoDate,
  planCalendarBatches,
  updateBatchStateInGeneration,
  validateCalendarItemInput,
} from './contentCalendarLogic.ts';

function makeBrand(overrides: Partial<Brand> = {}): Brand {
  return {
    id: 'brand-cal-1',
    userId: 'owner-1',
    brandName: 'The Naheem Uthman',
    businessDescription: 'Strategic brand and content operations advisory for B2B service founders.',
    industry: 'Brand Strategy & B2B Marketing',
    productsOrServices: 'Brand Strategy Sprints and Content Operations Systems',
    targetMarket: 'B2B service founders and boutique agency leaders',
    primaryLocation: 'Lagos & Global Remote',
    websiteUrl: 'https://thenaheemuthman.example',
    socialLinks: '',
    existingMission: '',
    existingVision: '',
    marketingChallenges: 'Inconsistent publishing cadence',
    businessGoals: 'Build steady qualified consultation inquiries',
    competitors: 'Generic agencies',
    additionalNotes: 'Proof-led educational tone',
    moduleStatuses: {
      brandFoundation: 'completed',
      brandMessaging: 'completed',
      customerIntelligence: 'completed',
      marketingStrategy: 'completed',
      contentStrategy: 'completed',
      contentCalendar: 'not_started',
      contentStudio: 'not_started',
    },
    contentPiecesCount: 0,
    pendingApprovalsCount: 0,
    createdAt: '2026-11-20T00:00:00.000Z',
    updatedAt: '2026-11-20T00:00:00.000Z',
    lastAccessedAt: '2026-11-20T00:00:00.000Z',
    ...overrides,
  };
}

function makeAllFiveApprovedModules(brandId = 'brand-cal-1', userId = 'owner-1'): BrandStrategyModule[] {
  const now = '2026-11-20T00:00:00.000Z';
  const prov = {
    promptId: null,
    promptVersion: null,
    model: null,
    generatedAt: null,
  };
  return [
    {
      id: 'm-1',
      brandId,
      userId,
      moduleKey: 'brandFoundation',
      status: 'completed',
      content: {
        brandId,
        approvedSummary: {
          purpose: 'Clarify B2B founder positioning.',
          positioningStatement: 'Turn expertise into predictable inbound authority.',
        },
      },
      ...prov,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'm-2',
      brandId,
      userId,
      moduleKey: 'brandMessaging',
      status: 'completed',
      content: {
        brandId,
        approvedSummary: {
          coreValueProposition: 'Strategy-first content engines.',
          messagingPillars: [{ title: 'Clarity Before Channels', summary: 'Fix positioning first.' }],
          voiceAndTone: { attributes: ['Direct', 'Consultative'], guardrails: ['No hype'] },
        },
      },
      ...prov,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'm-3',
      brandId,
      userId,
      moduleKey: 'customerIntelligence',
      status: 'completed',
      content: {
        brandId,
        personas: [
          { id: 'p1', name: 'Growth-Stage B2B Founder', approved: true },
          { id: 'p2', name: 'UNAPPROVED_DRAFT_PERSONA', approved: false },
        ],
        interests: [
          { id: 'i1', topic: 'Positioning Architecture', approved: true },
          { id: 'i2', topic: 'UNAPPROVED_INTEREST', approved: false },
        ],
      },
      ...prov,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'm-4',
      brandId,
      userId,
      moduleKey: 'marketingStrategy',
      status: 'completed',
      content: {
        brandId,
        objectives: [
          { id: 'o1', title: 'Generate Qualified Strategy Sprint Inquiries', approved: true },
          { id: 'o2', title: 'UNAPPROVED_OBJ', approved: false },
        ],
        channels: [
          { id: 'c1', channelName: 'LinkedIn', approved: true },
          { id: 'c2', channelName: 'Email Newsletter', approved: true },
          { id: 'c3', channelName: 'TikTok_UNAPPROVED', approved: false },
        ],
        kpis: [
          { id: 'k1', kpiName: 'Discovery Calls Booked', approved: true },
        ],
      },
      ...prov,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'm-5',
      brandId,
      userId,
      moduleKey: 'contentStrategy',
      status: 'completed',
      content: {
        brandId,
        objectives: [
          { id: 'co1', title: 'Build Proof-Led Market Authority', approved: true },
          { id: 'co2', title: 'UNAPPROVED_CONTENT_OBJ', approved: false },
        ],
        pillars: [
          { id: 'cp1', name: 'Positioning Clarity', approved: true },
          { id: 'cp2', name: 'Content Systems', approved: true },
          { id: 'cp3', name: 'UNAPPROVED_PILLAR', approved: false },
        ],
        themes: [
          { id: 'ct1', title: 'Messaging Teardowns', approved: true },
        ],
        formats: [
          { id: 'cf1', formatName: 'Carousel Breakdown', approved: true },
          { id: 'cf2', formatName: 'Founder Essay', approved: true },
        ],
        series: [
          { id: 'cs1', seriesName: 'Tuesday Teardown', approved: true },
        ],
        distribution: [
          { id: 'cd1', platformName: 'LinkedIn', recommendedFrequency: '3x per week', approved: true },
          { id: 'cd2', platformName: 'Email Newsletter', recommendedFrequency: '1x per week', approved: true },
          { id: 'cd3', platformName: 'Pinterest_UNAPPROVED', recommendedFrequency: '5x per week', approved: false },
        ],
      },
      ...prov,
      createdAt: now,
      updatedAt: now,
    },
  ];
}

test('evaluateCalendarPrerequisites enforces all five approved modules and ignores foreign-brand modules', () => {
  const brand = makeBrand();
  const allModules = makeAllFiveApprovedModules(brand.id, brand.userId);

  const readyCheck = evaluateCalendarPrerequisites(brand, allModules);
  assert.equal(readyCheck.ready, true);
  assert.deepEqual(readyCheck.missingLabels, []);
  assert.equal(readyCheck.items.length, 5);

  // Removing each module individually blocks readiness
  for (const modKey of [
    'brandFoundation',
    'brandMessaging',
    'customerIntelligence',
    'marketingStrategy',
    'contentStrategy',
  ] as const) {
    const subset = allModules.filter((m) => m.moduleKey !== modKey);
    const check = evaluateCalendarPrerequisites(brand, subset);
    assert.equal(check.ready, false, `Missing ${modKey} should block calendar generation`);
    assert.equal(check.missingLabels.length, 1);
  }

  // Foreign-brand approved modules must never satisfy prerequisites for this brand
  const foreignModules = makeAllFiveApprovedModules('brand-other-999', brand.userId);
  const crossBrandCheck = evaluateCalendarPrerequisites(brand, foreignModules);
  assert.equal(crossBrandCheck.ready, false);
  assert.equal(crossBrandCheck.missingLabels.length, 5);
});

test('extractApprovedCalendarContext and defaults strictly exclude unapproved items and infer realistic cadence', () => {
  const brand = makeBrand();
  const modules = makeAllFiveApprovedModules(brand.id, brand.userId);

  const ctx = extractApprovedCalendarContext(brand, modules);
  assert.deepEqual(ctx.approvedPlatforms, ['LinkedIn', 'Email Newsletter']);
  assert.equal(ctx.approvedPlatforms.includes('TikTok_UNAPPROVED'), false);
  assert.equal(ctx.approvedPlatforms.includes('Pinterest_UNAPPROVED'), false);
  assert.deepEqual(ctx.approvedPillars, ['Positioning Clarity', 'Content Systems']);
  assert.deepEqual(ctx.approvedPersonas, ['Growth-Stage B2B Founder']);
  assert.deepEqual(ctx.approvedInterests, ['Positioning Architecture']);
  assert.equal(ctx.recommendedPostsPerWeek, 4); // 3x/week LinkedIn + 1x/week Newsletter

  const settings = buildDefaultCalendarSettings(ctx, '2026-12-01');
  assert.equal(settings.startDate, '2026-12-01');
  assert.equal(settings.durationDays, 30);
  assert.deepEqual(settings.selectedPlatforms, ['LinkedIn', 'Email Newsletter']);
  assert.equal(settings.postsPerWeek, 4);
  assert.equal(buildDefaultCalendarName(brand.brandName, '2026-12-01'), 'Dec 2026 30-Day Calendar');
});

test('UTC date math and planCalendarBatches split 30 days into 4 contiguous non-overlapping weekly batches', () => {
  assert.equal(isValidIsoDate('2026-02-28'), true);
  assert.equal(isValidIsoDate('2026-02-29'), false);
  assert.equal(computeEndDate('2026-12-01', 30), '2026-12-30');
  assert.equal(diffDaysInclusive('2026-12-01', '2026-12-30'), 30);

  const brand = makeBrand();
  const ctx = extractApprovedCalendarContext(brand, makeAllFiveApprovedModules(brand.id));
  const settings = buildDefaultCalendarSettings(ctx, '2026-12-01');
  const batches = planCalendarBatches(settings);

  assert.equal(batches.length, 4);
  assert.equal(batches[0].startDate, '2026-12-01');
  assert.equal(batches[0].endDate, '2026-12-07');
  assert.equal(batches[1].startDate, '2026-12-08');
  assert.equal(batches[1].endDate, '2026-12-14');
  assert.equal(batches[2].startDate, '2026-12-15');
  assert.equal(batches[2].endDate, '2026-12-21');
  assert.equal(batches[3].startDate, '2026-12-22');
  assert.equal(batches[3].endDate, '2026-12-30');

  // Verify contiguous coverage with zero gaps or overlaps
  for (let i = 1; i < batches.length; i += 1) {
    assert.equal(addDaysIso(batches[i - 1].endDate, 1), batches[i].startDate);
  }
});

test('updateBatchStateInGeneration tracks partial failure accurately and never marks incomplete calendars active', () => {
  const brand = makeBrand();
  const ctx = extractApprovedCalendarContext(brand, makeAllFiveApprovedModules(brand.id));
  const batches = planCalendarBatches(buildDefaultCalendarSettings(ctx, '2026-12-01'));
  let state = createInitialGenerationState(batches);

  // Batch 0 completes
  let step = updateBatchStateInGeneration(
    state,
    0,
    { status: 'completed', itemCount: 4, completedAt: '2026-11-21T00:00:00.000Z' },
    { suppliedFactsUsed: ['LinkedIn'], researchCaveat: 'Draft plan' },
  );
  state = step.nextState;
  assert.equal(step.derivedCalendarStatus, 'partial');
  assert.equal(state.completedBatches, 1);

  // Batch 1 fails with provider_unavailable -> calendar must be partial, never active/completed
  step = updateBatchStateInGeneration(
    state,
    1,
    {
      status: 'failed',
      errorMessage: 'AI service is temporarily busy.',
      errorCategory: 'provider_unavailable',
    },
    { lastError: 'AI service is temporarily busy.', lastErrorCategory: 'provider_unavailable' },
  );
  state = step.nextState;
  assert.equal(step.derivedCalendarStatus, 'partial');
  assert.equal(state.batches[0].status, 'completed');
  assert.equal(state.batches[1].status, 'failed');
  assert.equal(state.lastErrorCategory, 'provider_unavailable');

  // Resuming batches 1, 2, 3 completes calendar -> only now becomes active
  for (const idx of [1, 2, 3]) {
    step = updateBatchStateInGeneration(state, idx, {
      status: 'completed',
      itemCount: 4,
      errorMessage: null,
      errorCategory: null,
      completedAt: '2026-11-21T00:05:00.000Z',
    });
    state = step.nextState;
  }
  assert.equal(step.derivedCalendarStatus, 'active');
  assert.equal(state.completedBatches, 4);
});

test('applyCalendarBatchOutput restricts platforms to approved channels, clamps dates, deduplicates titles, and defaults to planned', () => {
  const brand = makeBrand();
  const ctx = extractApprovedCalendarContext(brand, makeAllFiveApprovedModules(brand.id));
  const settings = buildDefaultCalendarSettings(ctx, '2026-12-01');
  const batches = planCalendarBatches(settings);
  const batch0 = batches[0]; // 2026-12-01..2026-12-07

  const batchVars = buildCalendarBatchVariables(settings, batch0, []);
  assert.ok(batchVars.calendarBatchPlan);

  const mockResult: PromptExecutionResult = {
    status: 'success',
    brandId: brand.id,
    promptId: 'content_calendar_weekly_batch',
    promptVersion: '1.0.0',
    targetModule: 'contentCalendar',
    sourceClassification: 'reconstructed',
    model: 'gemini-4-hydrogen',
    generatedAt: '2026-11-21T00:00:00.000Z',
    rawText: '{}',
    output: {
      suppliedFactsUsed: ['Positioning Clarity'],
      missingContextNotes: [],
      researchCaveat: 'Review before production.',
      items: [
        {
          scheduledDate: '2026-12-02',
          suggestedTime: '09:00 AM',
          platform: 'TikTok', // Unapproved! Must be mapped to an approved channel
          title: 'Why Positioning Breaks Before Distribution',
          contentPillar: 'Positioning Clarity',
          contentTheme: 'Messaging Teardowns',
          contentFormat: 'Carousel Breakdown',
          targetAudience: 'Growth-Stage B2B Founder',
          contentObjective: 'Build Proof-Led Market Authority',
          coreMessage: 'Fix positioning before scaling output.',
        },
        {
          scheduledDate: '2027-01-15', // Out of batch range! Must clamp inside 2026-12-01..2026-12-07
          platform: 'Email Newsletter',
          title: 'Existing Duplicate Title',
          suggestedAngle: '', // Exact duplicate with no distinguishing angle -> dropped
          contentPillar: 'Content Systems',
          contentFormat: 'Founder Essay',
          coreMessage: 'Duplicate item.',
        },
        {
          scheduledDate: '2026-12-29', // Out of batch range -> clamped into batch0
          platform: 'Email Newsletter',
          title: 'Founder Weekly System Checklist',
          contentPillar: 'Content Systems',
          contentFormat: 'Founder Essay',
          coreMessage: 'A practical 3-hour weekly editorial cadence.',
        },
      ],
    },
    metadata: {
      promptId: 'content_calendar_weekly_batch',
      promptVersion: '1.0.0',
      targetModule: 'contentCalendar',
      sourceClassification: 'reconstructed',
      brandId: brand.id,
      model: 'gemini-4-hydrogen',
      generatedAt: '2026-11-21T00:00:00.000Z',
    },
    canSave: true,
  };

  const applied = applyCalendarBatchOutput({
    result: mockResult,
    batch: batch0,
    settings,
    approvedContext: ctx,
    existingItems: [
      { title: 'Existing Duplicate Title', platform: 'LinkedIn', scheduledDate: '2026-12-01' },
    ],
  });

  assert.equal(applied.items.length, 2);
  for (const item of applied.items) {
    assert.equal(
      settings.selectedPlatforms.includes(item.platform),
      true,
      `Platform ${item.platform} must be strictly within approved selectedPlatforms`,
    );
    assert.equal(item.scheduledDate >= batch0.startDate && item.scheduledDate <= batch0.endDate, true);
    assert.equal(item.workflowStatus, 'planned');
    assert.equal(item.source, 'ai_generated');
    assert.equal(item.batchIndex, 0);
  }
});

test('manual validation, duplication, filtering, views, stats, and Content Studio handoff work cleanly and enforce brand isolation', () => {
  const brand = makeBrand();
  const calendar: ContentCalendar = {
    id: 'cal-1',
    brandId: brand.id,
    userId: brand.userId,
    name: 'Dec 2026 30-Day Calendar',
    startDate: '2026-12-01',
    endDate: '2026-12-30',
    durationDays: 30,
    status: 'active',
    settings: buildDefaultCalendarSettings(
      extractApprovedCalendarContext(brand, makeAllFiveApprovedModules(brand.id)),
      '2026-12-01',
    ),
    generationState: {
      totalBatches: 4,
      completedBatches: 4,
      batches: [],
      suppliedFactsUsed: [],
      missingContextNotes: [],
      researchCaveat: '',
    },
    upstreamSnapshot: {},
    promptId: 'content_calendar_weekly_batch',
    promptVersion: '1.0.0',
    model: 'gemini-4-hydrogen',
    generatedAt: '2026-11-21T00:00:00.000Z',
    createdAt: '2026-11-21T00:00:00.000Z',
    updatedAt: '2026-11-21T00:00:00.000Z',
  };

  // Manual validation rejects unapproved platforms and missing fields
  assert.ok(
    validateCalendarItemInput(
      {
        title: 'Valid Title',
        scheduledDate: '2026-12-03',
        platform: 'Snapchat',
        contentPillar: 'Positioning Clarity',
        contentFormat: 'Carousel Breakdown',
        coreMessage: 'Key brief',
      },
      ['LinkedIn', 'Email Newsletter'],
    ),
  );
  assert.equal(
    validateCalendarItemInput(
      {
        title: 'Valid Title',
        scheduledDate: '2026-12-03',
        platform: 'LinkedIn',
        contentPillar: 'Positioning Clarity',
        contentFormat: 'Carousel Breakdown',
        coreMessage: 'Key brief',
      },
      ['LinkedIn', 'Email Newsletter'],
    ),
    null,
  );

  const items: ContentCalendarItem[] = [
    {
      id: 'item-1',
      calendarId: calendar.id,
      brandId: brand.id,
      userId: brand.userId,
      scheduledDate: '2026-12-02',
      suggestedTime: '09:00 AM',
      platform: 'LinkedIn',
      title: 'Positioning Audit Framework',
      contentPillar: 'Positioning Clarity',
      contentTheme: 'Messaging Teardowns',
      contentFormat: 'Carousel Breakdown',
      contentSeries: 'Tuesday Teardown',
      targetAudience: 'Growth-Stage B2B Founder',
      audiencePainPoint: 'Blends into competitors',
      contentObjective: 'Build Proof-Led Market Authority',
      relatedMarketingObjective: 'Generate Qualified Strategy Sprint Inquiries',
      coreMessage: 'Diagnose positioning before hiring content agencies.',
      suggestedAngle: '5-step audit checklist',
      intendedCta: 'Comment AUDIT for checklist',
      relevantKpi: 'Discovery Calls Booked',
      productionNotes: '5 clean slides',
      workflowStatus: 'approved',
      batchIndex: 0,
      source: 'ai_generated',
      sortOrder: 0,
      createdAt: '2026-11-21T00:00:00.000Z',
      updatedAt: '2026-11-21T00:00:00.000Z',
    },
    {
      id: 'item-2',
      calendarId: calendar.id,
      brandId: brand.id,
      userId: brand.userId,
      scheduledDate: '2026-12-10',
      suggestedTime: '10:00 AM',
      platform: 'Email Newsletter',
      title: 'Weekly Editorial Rhythm',
      contentPillar: 'Content Systems',
      contentTheme: 'Workflow Architecture',
      contentFormat: 'Founder Essay',
      contentSeries: '',
      targetAudience: 'Growth-Stage B2B Founder',
      audiencePainPoint: 'No time to publish consistently',
      contentObjective: 'Build Proof-Led Market Authority',
      relatedMarketingObjective: 'Generate Qualified Strategy Sprint Inquiries',
      coreMessage: 'Run a 3-hour weekly founder publishing loop.',
      suggestedAngle: 'Time-boxed workflow',
      intendedCta: 'Reply with your current bottleneck',
      relevantKpi: 'Discovery Calls Booked',
      productionNotes: 'Keep under 450 words',
      workflowStatus: 'planned',
      batchIndex: 1,
      source: 'manual',
      sortOrder: 0,
      createdAt: '2026-11-21T00:00:00.000Z',
      updatedAt: '2026-11-21T00:00:00.000Z',
    },
  ];

  // Duplication shifts date by 1 day and resets status to planned
  const dup = buildDuplicateItemInput(items[0], calendar.endDate);
  assert.equal(dup.scheduledDate, '2026-12-03');
  assert.equal(dup.title, 'Positioning Audit Framework (Copy)');
  assert.equal(dup.workflowStatus, 'planned');
  assert.equal(dup.source, 'manual');

  // Filtering and search
  const filtered = filterCalendarItems(items, {
    platform: 'LinkedIn',
    pillar: 'all',
    format: 'all',
    status: 'approved',
    query: 'audit',
  });
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].id, 'item-1');

  // Stats, Monthly grid, and Weekly groups
  const stats = computeCalendarStats(calendar, items);
  assert.equal(stats.totalItems, 2);
  assert.equal(stats.byStatus.approved, 1);
  assert.equal(stats.byStatus.planned, 1);
  assert.equal(stats.coveredDays, 2);
  assert.equal(stats.totalDays, 30);

  const grid = buildMonthlyCalendarGrid(calendar, items);
  assert.ok(grid.length >= 35 && grid.length % 7 === 0);
  const dec2Cell = grid.find((c) => c.isoDate === '2026-12-02');
  assert.equal(dec2Cell?.inCalendarWindow, true);
  assert.equal(dec2Cell?.items.length, 1);

  const weekly = groupItemsByWeek(calendar, items);
  assert.equal(weekly.length, 4);
  assert.equal(weekly[0].totalItems, 1);
  assert.equal(weekly[1].totalItems, 1);

  // Content Studio Handoff contract preserves all fields and blocks cross-brand mismatch
  const handoff = buildContentStudioHandoffPayload(brand, calendar, items[0]);
  assert.equal(handoff.schemaVersion, '1.0');
  assert.equal(handoff.brandId, brand.id);
  assert.equal(handoff.calendarId, calendar.id);
  assert.equal(handoff.calendarItemId, items[0].id);
  assert.equal(handoff.platform, 'LinkedIn');

  assert.throws(
    () =>
      buildContentStudioHandoffPayload(
        { id: 'brand-other', brandName: 'Other Brand' },
        calendar,
        items[0],
      ),
    /mismatched brand or calendar IDs/i,
  );
});
