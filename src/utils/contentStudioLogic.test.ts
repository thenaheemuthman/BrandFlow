import test from 'node:test';
import assert from 'node:assert/strict';
import type {
  Brand,
  BrandStrategyModule,
  ContentAsset,
  ContentStudioHandoffPayload,
} from '../types/brand.ts';
import {
  CONTENT_ASSET_FORMAT_CATEGORIES,
  CONTENT_STUDIO_REFINEMENT_ACTIONS,
  applyStudioGenerateOutput,
  applyStudioRefineOutput,
  buildDefaultGenerationOptions,
  buildDuplicateAssetInput,
  buildStudioGenerateVariables,
  buildStudioRefineVariables,
  computeStudioStats,
  createEmptyAssetBody,
  extractStudioApprovedContext,
  filterContentAssets,
  formatAssetAsPlainText,
  getPlatformCreativeGuidance,
  inferFormatCategoryFromLabel,
  requiresVersionSnapshotOnBodyEdit,
  validateContentStudioHandoffPayload,
} from './contentStudioLogic.ts';

function makeBrand(overrides: Partial<Brand> = {}): Brand {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    userId: 'owner-1',
    brandName: 'The Naheem Uthman',
    businessDescription:
      'Strategic brand consulting and AI-enabled content operations for B2B service founders.',
    industry: 'Brand Strategy & B2B Advisory',
    productsOrServices: 'Brand Strategy Sprints, Content Operations Retainers',
    targetMarket: 'B2B service founders and boutique agency principals',
    primaryLocation: 'Lagos & Global Remote',
    websiteUrl: 'https://thenaheemuthman.example',
    socialLinks: 'https://linkedin.com/in/thenaheemuthman',
    existingMission: '',
    existingVision: '',
    marketingChallenges: 'Inconsistent publishing cadence',
    businessGoals: 'Build predictable inbound strategy sprint inquiries',
    competitors: 'Generic agencies',
    additionalNotes: 'Proof-led executive tone',
    moduleStatuses: {
      brandFoundation: 'completed',
      brandMessaging: 'completed',
      customerIntelligence: 'completed',
      marketingStrategy: 'completed',
      contentStrategy: 'completed',
      contentCalendar: 'completed',
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

function makeHandoff(overrides: Partial<ContentStudioHandoffPayload> = {}): ContentStudioHandoffPayload {
  return {
    schemaVersion: '1.0',
    brandId: '11111111-1111-4111-8111-111111111111',
    brandName: 'The Naheem Uthman',
    calendarId: '22222222-2222-4222-8222-222222222222',
    calendarName: 'Dec 2026 Calendar',
    calendarItemId: '33333333-3333-4333-8333-333333333333',
    scheduledDate: '2026-12-03',
    suggestedTime: '09:00 AM',
    platform: 'LinkedIn',
    title: '5-Slide B2B Positioning Diagnostic',
    contentPillar: 'Brand Positioning',
    contentTheme: 'Teardown Frameworks',
    contentFormat: 'LinkedIn Carousel',
    contentSeries: 'Weekly Clinic',
    targetAudience: 'Growth-Stage B2B Founder',
    audiencePainPoint: 'Referral dependency and blended messaging',
    contentObjective: 'Establish proof-led positioning authority',
    relatedMarketingObjective: 'Convert B2B founders into strategy sprints',
    coreMessage: 'Clarify positioning before scaling publishing volume.',
    suggestedAngle: '5-minute executive self-audit',
    intendedCta: 'Comment AUDIT for the scorecard',
    relevantKpi: 'Qualified discovery calls',
    productionNotes: 'Keep slides under 25 words each',
    workflowStatus: 'approved',
    ...overrides,
  };
}

function makeAsset(overrides: Partial<ContentAsset> = {}): ContentAsset {
  return {
    id: '44444444-4444-4444-8444-444444444444',
    userId: 'owner-1',
    brandId: '11111111-1111-4111-8111-111111111111',
    calendarId: '22222222-2222-4222-8222-222222222222',
    calendarItemId: '33333333-3333-4333-8333-333333333333',
    title: '5-Slide B2B Positioning Diagnostic',
    platform: 'LinkedIn',
    formatCategory: 'carousel',
    formatLabel: 'LinkedIn Carousel',
    contentPillar: 'Brand Positioning',
    contentTheme: 'Teardown Frameworks',
    targetAudience: 'Growth-Stage B2B Founder',
    contentObjective: 'Establish proof-led positioning authority',
    toneOfVoice: 'Direct, analytical',
    contentLength: 'medium',
    scheduledDate: '2026-12-03',
    workflowStatus: 'draft',
    source: 'ai_generated',
    currentVersionNumber: 1,
    approvedVersionNumber: null,
    body: {
      ...createEmptyAssetBody(),
      hook: 'Most B2B firms do not have a posting problem. They have a positioning problem.',
      alternativeHooks: ['Stop posting more until your buyer knows why you exist.'],
      mainCopy: 'Before increasing cadence, audit whether your homepage passes the 5-second test.',
      cta: 'Comment AUDIT to get the 5-point positioning scorecard.',
      hashtags: ['#B2BStrategy', '#BrandPositioning'],
      carouselSlides: [
        {
          slideNumber: 1,
          headline: 'Why More Content Fails',
          body: 'Volume multiplies weak positioning.',
          visualCue: 'High-contrast cover slide',
        },
        {
          slideNumber: 2,
          headline: 'Fix The Promise First',
          body: 'Name the exact buyer and painful bottleneck.',
          visualCue: 'Two-column comparison table',
        },
      ],
    },
    generationOptions: {
      platform: 'LinkedIn',
      formatCategory: 'carousel',
      formatLabel: 'LinkedIn Carousel',
      toneOfVoice: 'Direct, analytical',
      contentLength: 'medium',
      primaryObjective: 'Establish proof-led positioning authority',
      targetAudience: 'Growth-Stage B2B Founder',
      ctaPreference: 'Comment AUDIT for the scorecard',
      additionalInstructions: '',
    },
    handoffSnapshot: makeHandoff(),
    promptId: 'content_studio_generate_asset',
    promptVersion: '1.0.0',
    model: 'gemini-4-hydrogen',
    generatedAt: '2026-11-21T10:00:00.000Z',
    approvedAt: null,
    publishedAt: null,
    createdAt: '2026-11-21T10:00:00.000Z',
    updatedAt: '2026-11-21T10:00:00.000Z',
    ...overrides,
  };
}

test('validateContentStudioHandoffPayload enforces schema v1.0, required fields, and strict brand isolation', () => {
  const valid = validateContentStudioHandoffPayload(
    makeHandoff(),
    '11111111-1111-4111-8111-111111111111',
  );
  assert.equal(valid.valid, true);
  assert.equal(valid.payload?.calendarItemId, '33333333-3333-4333-8333-333333333333');

  const wrongBrand = validateContentStudioHandoffPayload(
    makeHandoff(),
    '99999999-9999-4999-8999-999999999999',
  );
  assert.equal(wrongBrand.valid, false);
  assert.match(wrongBrand.error ?? '', /different brand/i);

  const wrongSchema = validateContentStudioHandoffPayload(
    { ...makeHandoff(), schemaVersion: '2.0' },
    '11111111-1111-4111-8111-111111111111',
  );
  assert.equal(wrongSchema.valid, false);

  const missingMeta = validateContentStudioHandoffPayload(
    { ...makeHandoff(), title: '   ' },
    '11111111-1111-4111-8111-111111111111',
  );
  assert.equal(missingMeta.valid, false);
});

test('inferFormatCategoryFromLabel and getPlatformCreativeGuidance cover all 8 content categories', () => {
  assert.equal(CONTENT_ASSET_FORMAT_CATEGORIES.length, 8);
  assert.equal(CONTENT_STUDIO_REFINEMENT_ACTIONS.length, 8);

  assert.equal(inferFormatCategoryFromLabel('LinkedIn Swipe Carousel'), 'carousel');
  assert.equal(inferFormatCategoryFromLabel('Instagram Reel Short-Form Video'), 'short_video_script');
  assert.equal(inferFormatCategoryFromLabel('SEO Blog Article'), 'long_form_article');
  assert.equal(inferFormatCategoryFromLabel('Product Offer Launch Promo'), 'promotional_post');
  assert.equal(inferFormatCategoryFromLabel('Founder Story Behind-the-scenes'), 'story_post');
  assert.equal(inferFormatCategoryFromLabel('How-to Framework Breakdown'), 'educational_post');
  assert.equal(inferFormatCategoryFromLabel('Cross-post Platform Adaptation'), 'platform_adaptation');
  assert.equal(inferFormatCategoryFromLabel('Standard Caption'), 'social_post');

  assert.match(getPlatformCreativeGuidance('LinkedIn', 'carousel'), /Slide 1/i);
  assert.match(getPlatformCreativeGuidance('TikTok', 'short_video_script'), /0–3s/i);
  assert.match(getPlatformCreativeGuidance('Blog', 'long_form_article'), /articleSections/i);
  assert.match(getPlatformCreativeGuidance('Email Newsletter', 'educational_post'), /subject-line/i);
});

test('extractStudioApprovedContext and buildDefaultGenerationOptions honor only approved strategy data and calendar handoff', () => {
  const brand = makeBrand();
  const modules: BrandStrategyModule[] = [
    {
      id: 'm1',
      userId: brand.userId,
      brandId: brand.id,
      moduleKey: 'brandFoundation',
      status: 'completed',
      content: {
        approvedSummary: {
          positioningStatement: 'Strategy-first growth advisory for B2B founders.',
        },
      },
      promptId: null,
      promptVersion: null,
      model: null,
      generatedAt: null,
      createdAt: '2026-11-20T00:00:00.000Z',
      updatedAt: '2026-11-20T00:00:00.000Z',
    },
    {
      id: 'm2',
      userId: brand.userId,
      brandId: brand.id,
      moduleKey: 'brandMessaging',
      status: 'completed',
      content: {
        approvedSummary: {
          coreValueProposition: 'Turn founder expertise into repeatable inbound demand.',
          voiceAndTone: { attributes: ['Sharp', 'Consultative'], guardrails: ['No hype'] },
        },
      },
      promptId: null,
      promptVersion: null,
      model: null,
      generatedAt: null,
      createdAt: '2026-11-20T00:00:00.000Z',
      updatedAt: '2026-11-20T00:00:00.000Z',
    },
  ];

  const ctx = extractStudioApprovedContext(brand, modules);
  assert.equal(ctx.brandPositioning, 'Strategy-first growth advisory for B2B founders.');
  assert.equal(ctx.valueProposition, 'Turn founder expertise into repeatable inbound demand.');
  assert.match(ctx.defaultToneOfVoice, /Sharp/);

  const opts = buildDefaultGenerationOptions(ctx, makeHandoff());
  assert.equal(opts.platform, 'LinkedIn');
  assert.equal(opts.formatCategory, 'carousel');
  assert.equal(opts.targetAudience, 'Growth-Stage B2B Founder');
  assert.equal(opts.ctaPreference, 'Comment AUDIT for the scorecard');

  const genVars = buildStudioGenerateVariables(opts, makeHandoff());
  const genOpts = genVars.studioGenerationOptions as Record<string, unknown>;
  assert.equal(genOpts.platform, 'LinkedIn');
  assert.equal(genOpts.formatCategory, 'carousel');
  assert.match(String(genOpts.platformGuidance), /LinkedIn/i);
  assert.ok(genVars.studioCalendarBrief);
});

test('applyStudioGenerateOutput normalizes social, carousel, video script, and long-form outputs and never auto-approves', () => {
  const opts = {
    platform: 'TikTok',
    formatCategory: 'short_video_script' as const,
    formatLabel: 'Short-Form Video',
    toneOfVoice: 'Direct',
    contentLength: 'short' as const,
    primaryObjective: 'Build awareness',
    targetAudience: 'B2B Founders',
    ctaPreference: 'Follow for weekly clinics',
    additionalInstructions: '',
  };

  const generated = applyStudioGenerateOutput(
    {
      suppliedFactsUsed: ['Brand Name: The Naheem Uthman'],
      missingContextNotes: ['Pricing not supplied'],
      researchCaveat: 'Human review required.',
      aiSuggestions: {
        creativeRationale: 'Opens with sharp buyer tension.',
        platformBestPracticesApplied: ['3-second visual hook'],
      },
      asset: {
        title: 'Why Referral Pipelines Stall',
        hook: 'If 90% of your revenue comes from referrals, watch this.',
        alternativeHooks: ['Referrals are great until they stop.'],
        mainCopy: 'Summary copy for video caption.',
        cta: 'Follow for weekly B2B positioning breakdowns.',
        hashtags: ['B2B', '#Positioning'],
        visualDirection: 'Founder talking to camera with whiteboard',
        carouselSlides: [
          { slideNumber: 1, headline: 'Cover', body: 'Intro', visualCue: 'Bold title' },
        ],
        videoScript: {
          hook: '0-3s hook line',
          scenes: [
            { sceneNumber: 1, visual: 'Close-up', dialogue: 'Here is the real bottleneck.', durationHint: '5s' },
          ],
          cta: 'Comment CLINIC below.',
        },
        articleSections: [{ heading: 'Why It Matters', body: 'Detailed breakdown.' }],
      },
    },
    opts,
    null,
  );

  // Explicit human approval invariant: never auto-approve or auto-publish
  assert.equal(generated.workflowStatus, 'draft');
  assert.equal(generated.title, 'Why Referral Pipelines Stall');
  assert.deepEqual(generated.body.hashtags, ['#B2B', '#Positioning']);
  assert.equal(generated.body.videoScript?.scenes.length, 1);
  assert.equal(generated.body.carouselSlides.length, 1);
  assert.equal(generated.body.articleSections.length, 1);
  assert.deepEqual(generated.body.suppliedFactsUsed, ['Brand Name: The Naheem Uthman']);
});

test('applyStudioRefineOutput merges alternative hooks cleanly and preserves existing fields when omitted', () => {
  const asset = makeAsset();
  const vars = buildStudioRefineVariables(asset, 'alternative_hooks', {
    instructions: 'Provide 3 sharper executive hooks.',
  });
  assert.equal(vars.refinementAction, 'alternative_hooks');

  const refined = applyStudioRefineOutput(
    asset.title,
    asset.body,
    {
      suppliedFactsUsed: ['Brand Positioning'],
      missingContextNotes: [],
      researchCaveat: 'Review hooks before approval.',
      aiSuggestions: {
        changeSummary: 'Added 2 sharper opening hooks.',
        editorialNotes: ['Kept CTA unchanged.'],
      },
      asset: {
        alternativeHooks: [
          'Your agency is not invisible because of the algorithm.',
          'Three signs your positioning is costing you retainers.',
        ],
      },
    },
    'alternative_hooks',
  );

  assert.equal(refined.title, asset.title);
  assert.equal(refined.body.mainCopy, asset.body.mainCopy);
  assert.equal(refined.body.alternativeHooks.length, 3);
  assert.equal(refined.changeSummary, 'Added 2 sharper opening hooks.');
});

test('approved snapshot protection, duplication, filtering, stats, and plain text formatting work deterministically', () => {
  assert.equal(requiresVersionSnapshotOnBodyEdit('draft'), false);
  assert.equal(requiresVersionSnapshotOnBodyEdit('in_progress'), false);
  assert.equal(requiresVersionSnapshotOnBodyEdit('ready_for_review'), false);
  assert.equal(requiresVersionSnapshotOnBodyEdit('approved'), true);
  assert.equal(requiresVersionSnapshotOnBodyEdit('published'), true);

  const asset1 = makeAsset({ id: 'a1', workflowStatus: 'approved', scheduledDate: '2026-12-03' });
  const asset2 = makeAsset({
    id: 'a2',
    title: 'Email Deep Dive',
    platform: 'Email Newsletter',
    formatCategory: 'long_form_article',
    workflowStatus: 'ready_for_review',
    calendarItemId: null,
    scheduledDate: '2026-12-15',
    body: {
      ...createEmptyAssetBody(),
      hook: 'Why strategy sprints beat retainers',
      articleSections: [{ heading: 'The Shift', body: 'Clear scope accelerates buyer trust.' }],
      cta: 'Reply SPRINT to book.',
    },
  });

  const dup = buildDuplicateAssetInput(asset1);
  assert.equal(dup.title, '5-Slide B2B Positioning Diagnostic (Copy)');
  assert.equal(dup.workflowStatus, 'draft');
  assert.equal(dup.source, 'edited_ai');

  const filtered = filterContentAssets([asset1, asset2], {
    platform: 'Email Newsletter',
    status: 'ready_for_review',
    dateFrom: '2026-12-10',
    dateTo: '2026-12-20',
    query: 'sprints',
  });
  assert.deepEqual(
    filtered.map((a) => a.id),
    ['a2'],
  );

  const stats = computeStudioStats([asset1, asset2]);
  assert.equal(stats.total, 2);
  assert.equal(stats.approved, 1);
  assert.equal(stats.readyForReview, 1);
  assert.equal(stats.linkedToCalendar, 1);

  const carouselText = formatAssetAsPlainText(asset1);
  assert.match(carouselText, /Slide 1: Why More Content Fails/);
  assert.match(carouselText, /#B2BStrategy/);

  const articleText = formatAssetAsPlainText(asset2);
  assert.match(articleText, /## The Shift/);
});
