import type {
  Brand,
  BrandStrategyModule,
  ContentArticleSection,
  ContentAsset,
  ContentAssetBody,
  ContentAssetFormatCategory,
  ContentAssetStatus,
  ContentCarouselSlide,
  ContentLengthPreference,
  ContentStudioGenerationOptions,
  ContentStudioHandoffPayload,
  ContentStudioRefinementAction,
  ContentVideoScene,
  CreateContentAssetInput,
} from '../types/brand.ts';
import { extractApprovedCalendarContext } from './contentCalendarLogic.ts';

export const CONTENT_ASSET_STATUSES: readonly {
  value: ContentAssetStatus;
  label: string;
}[] = [
  { value: 'draft', label: 'Draft' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'ready_for_review', label: 'Ready for Review' },
  { value: 'approved', label: 'Approved' },
  { value: 'published', label: 'Published' },
  { value: 'archived', label: 'Archived' },
];

export const CONTENT_ASSET_FORMAT_CATEGORIES: readonly {
  value: ContentAssetFormatCategory;
  label: string;
  description: string;
}[] = [
  {
    value: 'social_post',
    label: 'Social Media Caption / Post',
    description: 'Native feed post with scroll-stopping hook, concise body, CTA, and hashtags.',
  },
  {
    value: 'educational_post',
    label: 'Educational / Informative Post',
    description: 'Actionable breakdown or practical framework teaching the audience something useful.',
  },
  {
    value: 'promotional_post',
    label: 'Promotional / Sales Content',
    description: 'Conversion-focused offer or value proof post with clear next step.',
  },
  {
    value: 'story_post',
    label: 'Story-Based Content',
    description: 'Narrative lesson, founder observation, or customer journey arc.',
  },
  {
    value: 'short_video_script',
    label: 'Short-Form Video Script',
    description: 'Scene-by-scene script with 3-second hook, visual directions, dialogue, and CTA.',
  },
  {
    value: 'carousel',
    label: 'Carousel Content',
    description: 'Multi-slide swipeable deck with cover hook, structured slides, and closing CTA.',
  },
  {
    value: 'long_form_article',
    label: 'Long-Form Article / Blog',
    description: 'Structured editorial piece with clear subheadings, body sections, and takeaway.',
  },
  {
    value: 'platform_adaptation',
    label: 'Platform Adaptation',
    description: 'Repurposed version tailored to a target platform’s native cadence and constraints.',
  },
];

export const CONTENT_LENGTH_OPTIONS: readonly {
  value: ContentLengthPreference;
  label: string;
  hint: string;
}[] = [
  { value: 'short', label: 'Short', hint: 'Tight, punchy, quick to scan' },
  { value: 'medium', label: 'Medium', hint: 'Balanced depth and readability' },
  { value: 'long', label: 'Long', hint: 'Deep, thorough, high-context' },
];

export const CONTENT_STUDIO_REFINEMENT_ACTIONS: readonly {
  action: ContentStudioRefinementAction;
  label: string;
  shortLabel: string;
  description: string;
}[] = [
  {
    action: 'alternative_hooks',
    label: 'Generate Alternative Hooks',
    shortLabel: 'Alt Hooks',
    description: 'Create fresh opening angles while keeping the approved message intact.',
  },
  {
    action: 'improve_clarity',
    label: 'Improve Clarity',
    shortLabel: 'Clarity',
    description: 'Tighten phrasing, remove jargon, and sharpen flow for the target persona.',
  },
  {
    action: 'adjust_tone',
    label: 'Adjust Tone',
    shortLabel: 'Tone',
    description: 'Shift voice cadence (e.g., sharper executive, warmer conversational, punchier).',
  },
  {
    action: 'shorten',
    label: 'Shorten',
    shortLabel: 'Shorten',
    description: 'Condense length without losing core proof points or CTA.',
  },
  {
    action: 'expand',
    label: 'Expand',
    shortLabel: 'Expand',
    description: 'Add deeper examples, tactical steps, or clearer context grounded in brand facts.',
  },
  {
    action: 'refine_section',
    label: 'Refine Selected Section',
    shortLabel: 'Refine Section',
    description: 'Focus edits specifically on a highlighted excerpt or section you paste.',
  },
  {
    action: 'adapt_platform',
    label: 'Adapt to Another Platform',
    shortLabel: 'Adapt Platform',
    description: 'Reformat structure, length, and hashtags for a different channel.',
  },
  {
    action: 'regenerate',
    label: 'Regenerate Draft',
    shortLabel: 'Regenerate',
    description: 'Produce a fresh complete take using your current strategic brief and options.',
  },
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function asStringArray(value: unknown, maxItems = 15): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of value) {
    if (typeof item !== 'string') continue;
    const cleaned = item.trim();
    if (!cleaned) continue;
    const key = cleaned.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(cleaned);
    if (out.length >= maxItems) break;
  }
  return out;
}

export function createEmptyAssetBody(): ContentAssetBody {
  return {
    hook: '',
    alternativeHooks: [],
    mainCopy: '',
    cta: '',
    hashtags: [],
    visualDirection: '',
    carouselSlides: [],
    videoScript: null,
    articleSections: [],
    adaptationNotes: '',
    suppliedFactsUsed: [],
    missingContextNotes: [],
    researchCaveat: '',
  };
}

export function getFormatCategoryLabel(category: ContentAssetFormatCategory): string {
  return (
    CONTENT_ASSET_FORMAT_CATEGORIES.find((c) => c.value === category)?.label ??
    'Social Media Caption / Post'
  );
}

export function inferFormatCategoryFromLabel(formatLabel: string): ContentAssetFormatCategory {
  const lower = formatLabel.toLowerCase();
  if (/carousel|slide|deck|swipe/.test(lower)) return 'carousel';
  if (/reel|tiktok|short[\s-]*form|video|youtube\s*short|script/.test(lower)) {
    return 'short_video_script';
  }
  if (/blog|article|guide|whitepaper|newsletter|essay|long[\s-]*form|case\s*study/.test(lower)) {
    return 'long_form_article';
  }
  if (/promo|sales|offer|launch|conversion|product\s*spotlight|demo/.test(lower)) {
    return 'promotional_post';
  }
  if (/story|behind[\s-]*the[\s-]*scenes|founder|narrative|journey/.test(lower)) {
    return 'story_post';
  }
  if (/educat|how[\s-]*to|tutorial|framework|breakdown|tips|checklist|explainer/.test(lower)) {
    return 'educational_post';
  }
  if (/adapt|repurpos|cross[\s-]*post/.test(lower)) {
    return 'platform_adaptation';
  }
  return 'social_post';
}

export function getPlatformCreativeGuidance(
  platform: string,
  formatCategory: ContentAssetFormatCategory,
): string {
  const p = platform.toLowerCase();
  const platformNotes: string[] = [];

  if (p.includes('linkedin')) {
    platformNotes.push(
      'LinkedIn: Lead with a crisp 1–2 line hook before the fold, use clean single-sentence line breaks, maintain B2B/professional credibility, avoid fluff, include 3–5 relevant hashtags.',
    );
  } else if (p.includes('instagram')) {
    platformNotes.push(
      'Instagram: Visual-first storytelling, punchy first-line hook, scannable spacing, save/share-worthy value, conversational CTA, 5–8 targeted hashtags.',
    );
  } else if (p.includes('tiktok') || p.includes('reel') || p.includes('youtube')) {
    platformNotes.push(
      'Short-Form Video: 0–3s visual & verbal pattern-interrupt hook, tight pacing, spoken conversational sentences, explicit visual cues per scene, clear spoken & on-screen CTA.',
    );
  } else if (p.includes('x') || p.includes('twitter')) {
    platformNotes.push(
      'X / Twitter: Ultra-concise punchy lines, sharp point of view, minimal hashtags (0–2), clear thread or single-post rhythm.',
    );
  } else if (p.includes('blog') || p.includes('website') || p.includes('medium')) {
    platformNotes.push(
      'Blog / Web Article: Clear SEO-friendly headline, scannable H2 sections, practical examples grounded in brand expertise, logical takeaway and CTA.',
    );
  } else if (p.includes('email') || p.includes('newsletter')) {
    platformNotes.push(
      'Email / Newsletter: Compelling subject-line hook, personal 1-to-1 voice, scannable paragraphs, single focused CTA.',
    );
  } else if (p.includes('facebook')) {
    platformNotes.push(
      'Facebook: Community-oriented conversational hook, relatable narrative, prompt discussion or clear link CTA, 1–3 light hashtags.',
    );
  } else {
    platformNotes.push(
      `${platform || 'Selected Platform'}: Match native platform pacing, clear hook, skimmable structure, and a focused CTA.`,
    );
  }

  switch (formatCategory) {
    case 'carousel':
      platformNotes.push(
        'Format Requirement (Carousel): Slide 1 = cover hook headline, Slides 2–5/6 = one crisp takeaway per slide with visualCue, Final slide = concise recap + direct CTA.',
      );
      break;
    case 'short_video_script':
      platformNotes.push(
        'Format Requirement (Short Video Script): Provide hook, 3–6 timed scenes (visual, dialogue, durationHint), and closing CTA.',
      );
      break;
    case 'long_form_article':
      platformNotes.push(
        'Format Requirement (Long-Form Article): Provide title, intro hook/summary in mainCopy, 3–6 structured articleSections (heading + body), and concluding CTA.',
      );
      break;
    case 'educational_post':
      platformNotes.push(
        'Format Requirement (Educational Post): Teach a concrete, immediately usable insight or 3–5 step breakdown tied to an audience pain point.',
      );
      break;
    case 'promotional_post':
      platformNotes.push(
        'Format Requirement (Promotional Post): Connect verified offering value directly to audience pain points without hype or unverified claims; end with a clear action CTA.',
      );
      break;
    case 'story_post':
      platformNotes.push(
        'Format Requirement (Story-Based Post): Use a clear tension → turning point → practical lesson arc grounded in brand positioning.',
      );
      break;
    case 'platform_adaptation':
      platformNotes.push(
        'Format Requirement (Platform Adaptation): Preserve the strategic core message while adapting rhythm, length, structure, and CTA natively to the target platform.',
      );
      break;
    default:
      platformNotes.push(
        'Format Requirement (Social Post): Strong hook, clean scannable copy, clear CTA, and platform-appropriate hashtags.',
      );
  }

  return platformNotes.join(' ');
}

export interface HandoffValidationResult {
  valid: boolean;
  error?: string;
  payload?: ContentStudioHandoffPayload;
}

export function validateContentStudioHandoffPayload(
  raw: unknown,
  expectedBrandId: string,
): HandoffValidationResult {
  if (!isRecord(raw)) {
    return { valid: false, error: 'Calendar handoff payload is missing or invalid.' };
  }
  if (raw.schemaVersion !== '1.0') {
    return { valid: false, error: 'Unsupported Content Studio handoff schema version.' };
  }
  const brandId = asString(raw.brandId);
  if (!brandId || brandId !== expectedBrandId) {
    return {
      valid: false,
      error: 'Calendar handoff payload belongs to a different brand and was rejected for brand isolation.',
    };
  }
  const calendarId = asString(raw.calendarId);
  const calendarItemId = asString(raw.calendarItemId);
  const platform = asString(raw.platform);
  const title = asString(raw.title);
  if (!calendarId || !calendarItemId || !platform || !title) {
    return {
      valid: false,
      error: 'Calendar handoff payload is missing required calendar item metadata.',
    };
  }
  return {
    valid: true,
    payload: raw as unknown as ContentStudioHandoffPayload,
  };
}

export interface StudioApprovedContext {
  approvedPlatforms: string[];
  approvedPillars: string[];
  approvedPersonas: string[];
  approvedObjectives: string[];
  defaultToneOfVoice: string;
  brandPositioning: string;
  valueProposition: string;
  hasUpstreamStrategy: boolean;
  missingUpstreamModules: string[];
}

export function extractStudioApprovedContext(
  brand: Brand,
  strategyModules: readonly BrandStrategyModule[],
): StudioApprovedContext {
  const calendarCtx = extractApprovedCalendarContext(brand, strategyModules);
  const brandModules = strategyModules.filter((m) => m.brandId === brand.id);

  let defaultToneOfVoice = '';
  let valueProposition = '';
  let brandPositioning = '';

  const foundationMod = brandModules.find((m) => m.moduleKey === 'brandFoundation');
  if (foundationMod && isRecord(foundationMod.content)) {
    const summary = isRecord(foundationMod.content.approvedSummary)
      ? foundationMod.content.approvedSummary
      : null;
    if (summary && (typeof summary.positioning === 'string' || typeof summary.positioningStatement === 'string')) {
      brandPositioning = asString(summary.positioning || summary.positioningStatement);
    } else if (isRecord(foundationMod.content.positioning)) {
      const pos = foundationMod.content.positioning;
      if (pos.approved === true && typeof pos.userStatement === 'string') {
        brandPositioning = pos.userStatement.trim();
      }
    }
  }

  const messagingMod = brandModules.find((m) => m.moduleKey === 'brandMessaging');
  if (messagingMod && isRecord(messagingMod.content)) {
    const summary = isRecord(messagingMod.content.approvedSummary)
      ? messagingMod.content.approvedSummary
      : null;
    if (summary) {
      if (typeof summary.coreValueProposition === 'string') {
        valueProposition = summary.coreValueProposition.trim();
      }
      if (typeof summary.voiceAndTone === 'string') {
        defaultToneOfVoice = summary.voiceAndTone.trim();
      } else if (isRecord(summary.voiceAndTone)) {
        const attrs = asStringArray(summary.voiceAndTone.attributes, 5);
        const guide = asString(summary.voiceAndTone.summary || summary.voiceAndTone.userStatement);
        defaultToneOfVoice = [attrs.join(', '), guide].filter(Boolean).join(' — ');
      }
    } else {
      if (isRecord(messagingMod.content.coreValueProposition)) {
        const cvp = messagingMod.content.coreValueProposition;
        if (cvp.approved === true && typeof cvp.userStatement === 'string') {
          valueProposition = cvp.userStatement.trim();
        }
      }
      if (isRecord(messagingMod.content.voiceAndTone)) {
        const vt = messagingMod.content.voiceAndTone;
        if (vt.approved === true) {
          const attrs = asStringArray(vt.attributes, 5);
          const stmt = asString(vt.userStatement);
          defaultToneOfVoice = [attrs.join(', '), stmt].filter(Boolean).join(' — ');
        }
      }
    }
  }

  const missingUpstreamModules: string[] = [];
  if (!brandPositioning) missingUpstreamModules.push('Brand Foundation');
  if (!valueProposition && !defaultToneOfVoice) missingUpstreamModules.push('Brand Messaging');
  if (calendarCtx.approvedPersonas.length === 0) missingUpstreamModules.push('Customer Intelligence');
  if (calendarCtx.approvedPlatforms.length === 0) missingUpstreamModules.push('Marketing Strategy');
  if (calendarCtx.approvedPillars.length === 0) missingUpstreamModules.push('Content Strategy');

  return {
    approvedPlatforms:
      calendarCtx.approvedPlatforms.length > 0
        ? calendarCtx.approvedPlatforms
        : ['LinkedIn', 'Instagram', 'Blog / Website', 'Email Newsletter'],
    approvedPillars: calendarCtx.approvedPillars,
    approvedPersonas: calendarCtx.approvedPersonas,
    approvedObjectives: Array.from(
      new Set([
        ...calendarCtx.approvedContentObjectives,
        ...calendarCtx.approvedMarketingObjectives,
      ]),
    ),
    defaultToneOfVoice: defaultToneOfVoice || 'Clear, authoritative, and audience-focused',
    brandPositioning,
    valueProposition,
    hasUpstreamStrategy: missingUpstreamModules.length < 5,
    missingUpstreamModules,
  };
}

export function buildDefaultGenerationOptions(
  context: StudioApprovedContext,
  handoff?: ContentStudioHandoffPayload | null,
): ContentStudioGenerationOptions {
  const platform = handoff?.platform || context.approvedPlatforms[0] || 'LinkedIn';
  const formatLabel = handoff?.contentFormat || 'Social Media Post';
  const formatCategory = handoff?.contentFormat
    ? inferFormatCategoryFromLabel(handoff.contentFormat)
    : 'social_post';

  return {
    platform,
    formatCategory,
    formatLabel,
    toneOfVoice: context.defaultToneOfVoice,
    contentLength: formatCategory === 'long_form_article' ? 'long' : 'medium',
    primaryObjective:
      handoff?.contentObjective ||
      handoff?.relatedMarketingObjective ||
      context.approvedObjectives[0] ||
      'Educate and build audience trust',
    targetAudience:
      handoff?.targetAudience || context.approvedPersonas[0] || 'Core target customers',
    ctaPreference: handoff?.intendedCta || 'Invite thoughtful engagement or next step',
    additionalInstructions: handoff?.productionNotes || '',
  };
}

export function buildStudioGenerateVariables(
  options: ContentStudioGenerationOptions,
  handoff?: ContentStudioHandoffPayload | null,
): Record<string, unknown> {
  const platformGuidance = getPlatformCreativeGuidance(
    options.platform,
    options.formatCategory,
  );

  const brief = handoff
    ? {
        title: handoff.title,
        scheduledDate: handoff.scheduledDate,
        platform: handoff.platform,
        contentFormat: handoff.contentFormat,
        contentPillar: handoff.contentPillar,
        contentTheme: handoff.contentTheme,
        targetAudience: handoff.targetAudience,
        audiencePainPoint: handoff.audiencePainPoint,
        contentObjective: handoff.contentObjective,
        relatedMarketingObjective: handoff.relatedMarketingObjective,
        coreMessage: handoff.coreMessage,
        suggestedAngle: handoff.suggestedAngle,
        intendedCta: handoff.intendedCta,
        relevantKpi: handoff.relevantKpi,
        productionNotes: handoff.productionNotes,
      }
    : {
        mode: 'standalone',
        platform: options.platform,
        formatCategory: options.formatCategory,
        formatLabel: options.formatLabel,
        primaryObjective: options.primaryObjective,
        targetAudience: options.targetAudience,
      };

  return {
    studioCalendarBrief: brief,
    studioGenerationOptions: {
      platform: options.platform,
      formatCategory: options.formatCategory,
      formatLabel: options.formatLabel || getFormatCategoryLabel(options.formatCategory),
      toneOfVoice: options.toneOfVoice,
      contentLength: options.contentLength,
      primaryObjective: options.primaryObjective,
      targetAudience: options.targetAudience,
      ctaPreference: options.ctaPreference,
      additionalInstructions: options.additionalInstructions,
      platformGuidance,
    },
  };
}

export function buildStudioRefineVariables(
  asset: {
    title: string;
    platform: string;
    formatCategory: ContentAssetFormatCategory;
    formatLabel: string;
    body: ContentAssetBody;
    generationOptions: ContentStudioGenerationOptions;
    handoffSnapshot: ContentStudioHandoffPayload | null;
  },
  action: ContentStudioRefinementAction,
  params?: {
    targetPlatform?: string;
    targetTone?: string;
    instructions?: string;
    selectedSectionText?: string;
  },
): Record<string, unknown> {
  const effectivePlatform =
    action === 'adapt_platform' && params?.targetPlatform?.trim()
      ? params.targetPlatform.trim()
      : asset.platform;
  const effectiveFormatCategory: ContentAssetFormatCategory =
    action === 'adapt_platform' ? 'platform_adaptation' : asset.formatCategory;
  const effectiveTone =
    action === 'adjust_tone' && params?.targetTone?.trim()
      ? params.targetTone.trim()
      : asset.generationOptions.toneOfVoice;

  const options: ContentStudioGenerationOptions = {
    ...asset.generationOptions,
    platform: effectivePlatform,
    formatCategory: effectiveFormatCategory,
    toneOfVoice: effectiveTone,
  };

  const baseVars = buildStudioGenerateVariables(options, asset.handoffSnapshot);

  return {
    ...baseVars,
    refinementAction: action,
    targetPlatform: effectivePlatform,
    targetTone: effectiveTone,
    refinementInstructions: params?.instructions?.trim() || 'Apply the requested refinement while keeping all brand facts accurate.',
    selectedSectionText: params?.selectedSectionText?.trim() || 'Not provided',
    existingDraft: {
      title: asset.title,
      hook: asset.body.hook,
      mainCopy: asset.body.mainCopy,
      cta: asset.body.cta,
      hashtags: asset.body.hashtags,
      carouselSlides: asset.body.carouselSlides,
      videoScript: asset.body.videoScript,
      articleSections: asset.body.articleSections,
    },
  };
}

function normalizeCarouselSlides(raw: unknown): ContentCarouselSlide[] {
  if (!Array.isArray(raw)) return [];
  const slides: ContentCarouselSlide[] = [];
  raw.forEach((item, index) => {
    if (!isRecord(item)) return;
    const headline = asString(item.headline);
    const body = asString(item.body);
    const visualCue = asString(item.visualCue);
    if (!headline && !body) return;
    slides.push({
      slideNumber:
        typeof item.slideNumber === 'number' && Number.isFinite(item.slideNumber) && item.slideNumber > 0
          ? Math.round(item.slideNumber)
          : index + 1,
      headline: headline || `Slide ${index + 1}`,
      body,
      visualCue,
    });
  });
  return slides;
}

function normalizeVideoScript(
  raw: unknown,
): ContentAssetBody['videoScript'] {
  if (!isRecord(raw)) return null;
  const hook = asString(raw.hook);
  const cta = asString(raw.cta);
  const scenes: ContentVideoScene[] = [];
  if (Array.isArray(raw.scenes)) {
    raw.scenes.forEach((sc, idx) => {
      if (!isRecord(sc)) return;
      const visual = asString(sc.visual);
      const dialogue = asString(sc.dialogue);
      const durationHint = asString(sc.durationHint);
      if (!visual && !dialogue) return;
      scenes.push({
        sceneNumber:
          typeof sc.sceneNumber === 'number' && Number.isFinite(sc.sceneNumber) && sc.sceneNumber > 0
            ? Math.round(sc.sceneNumber)
            : idx + 1,
        visual,
        dialogue,
        durationHint: durationHint || '5–8s',
      });
    });
  }
  if (!hook && scenes.length === 0 && !cta) return null;
  return { hook, scenes, cta };
}

function normalizeArticleSections(raw: unknown): ContentArticleSection[] {
  if (!Array.isArray(raw)) return [];
  const sections: ContentArticleSection[] = [];
  for (const item of raw) {
    if (!isRecord(item)) continue;
    const heading = asString(item.heading);
    const body = asString(item.body);
    if (!heading && !body) continue;
    sections.push({ heading: heading || 'Section', body });
  }
  return sections;
}

function normalizeHashtags(raw: unknown): string[] {
  return asStringArray(raw, 15).map((tag) => (tag.startsWith('#') ? tag : `#${tag.replace(/\s+/g, '')}`));
}

export interface NormalizedStudioGenerationResult {
  title: string;
  body: ContentAssetBody;
  creativeRationale: string;
  platformBestPracticesApplied: string[];
  workflowStatus: 'draft';
}

export function applyStudioGenerateOutput(
  data: Record<string, unknown>,
  options: ContentStudioGenerationOptions,
  handoff?: ContentStudioHandoffPayload | null,
): NormalizedStudioGenerationResult {
  const rawAsset = isRecord(data.asset) ? data.asset : {};
  const rawSuggestions = isRecord(data.aiSuggestions) ? data.aiSuggestions : {};

  const title =
    asString(rawAsset.title) ||
    handoff?.title ||
    `${options.platform} ${getFormatCategoryLabel(options.formatCategory)}`;

  const carouselSlides = normalizeCarouselSlides(rawAsset.carouselSlides);
  const videoScript = normalizeVideoScript(rawAsset.videoScript);
  const articleSections = normalizeArticleSections(rawAsset.articleSections);

  const body: ContentAssetBody = {
    hook: asString(rawAsset.hook),
    alternativeHooks: asStringArray(rawAsset.alternativeHooks, 8),
    mainCopy: asString(rawAsset.mainCopy),
    cta: asString(rawAsset.cta) || options.ctaPreference,
    hashtags: normalizeHashtags(rawAsset.hashtags),
    visualDirection: asString(rawAsset.visualDirection),
    carouselSlides,
    videoScript,
    articleSections,
    adaptationNotes: asString(rawAsset.adaptationNotes),
    suppliedFactsUsed: asStringArray(data.suppliedFactsUsed, 15),
    missingContextNotes: asStringArray(data.missingContextNotes, 15),
    researchCaveat:
      asString(data.researchCaveat) ||
      'AI-generated draft grounded in approved brand strategy. Review and approve before publishing.',
  };

  return {
    title,
    body,
    creativeRationale: asString(rawSuggestions.creativeRationale),
    platformBestPracticesApplied: asStringArray(rawSuggestions.platformBestPracticesApplied, 8),
    // Explicit human approval guardrail: AI never auto-approves or auto-publishes.
    workflowStatus: 'draft',
  };
}

export interface NormalizedStudioRefineResult {
  title: string;
  body: ContentAssetBody;
  changeSummary: string;
  editorialNotes: string[];
}

export function applyStudioRefineOutput(
  existingTitle: string,
  existingBody: ContentAssetBody,
  data: Record<string, unknown>,
  action: ContentStudioRefinementAction,
): NormalizedStudioRefineResult {
  const rawAsset = isRecord(data.asset) ? data.asset : {};
  const rawSuggestions = isRecord(data.aiSuggestions) ? data.aiSuggestions : {};

  const nextTitle = asString(rawAsset.title) || existingTitle;
  const incomingHooks = asStringArray(rawAsset.alternativeHooks, 8);
  const incomingSlides = normalizeCarouselSlides(rawAsset.carouselSlides);
  const incomingVideo = normalizeVideoScript(rawAsset.videoScript);
  const incomingArticle = normalizeArticleSections(rawAsset.articleSections);
  const incomingHashtags = normalizeHashtags(rawAsset.hashtags);

  const mergedBody: ContentAssetBody = {
    hook: asString(rawAsset.hook) || existingBody.hook,
    alternativeHooks:
      action === 'alternative_hooks' && incomingHooks.length > 0
        ? Array.from(new Set([...incomingHooks, ...existingBody.alternativeHooks])).slice(0, 8)
        : incomingHooks.length > 0
          ? incomingHooks
          : existingBody.alternativeHooks,
    mainCopy: asString(rawAsset.mainCopy) || existingBody.mainCopy,
    cta: asString(rawAsset.cta) || existingBody.cta,
    hashtags: incomingHashtags.length > 0 ? incomingHashtags : existingBody.hashtags,
    visualDirection: asString(rawAsset.visualDirection) || existingBody.visualDirection,
    carouselSlides: incomingSlides.length > 0 ? incomingSlides : existingBody.carouselSlides,
    videoScript: incomingVideo ?? existingBody.videoScript,
    articleSections: incomingArticle.length > 0 ? incomingArticle : existingBody.articleSections,
    adaptationNotes: asString(rawAsset.adaptationNotes) || existingBody.adaptationNotes,
    suppliedFactsUsed:
      asStringArray(data.suppliedFactsUsed, 15).length > 0
        ? asStringArray(data.suppliedFactsUsed, 15)
        : existingBody.suppliedFactsUsed,
    missingContextNotes:
      asStringArray(data.missingContextNotes, 15).length > 0
        ? asStringArray(data.missingContextNotes, 15)
        : existingBody.missingContextNotes,
    researchCaveat:
      asString(data.researchCaveat) ||
      existingBody.researchCaveat ||
      'AI-refined draft. Review and approve before publishing.',
  };

  const defaultSummaryMap: Record<ContentStudioRefinementAction, string> = {
    regenerate: 'Regenerated full draft from approved brief',
    refine_section: 'Refined selected section',
    alternative_hooks: 'Generated alternative hooks',
    improve_clarity: 'Improved clarity and readability',
    adjust_tone: 'Adjusted tone of voice',
    shorten: 'Shortened copy for tighter pacing',
    expand: 'Expanded draft with deeper detail',
    adapt_platform: 'Adapted content for target platform',
  };

  return {
    title: nextTitle,
    body: mergedBody,
    changeSummary: asString(rawSuggestions.changeSummary) || defaultSummaryMap[action],
    editorialNotes: asStringArray(rawSuggestions.editorialNotes, 8),
  };
}

/**
 * Protects approved or published assets from being silently overwritten.
 * Any content edit/regeneration on an approved or published asset creates a new
 * draft/in_progress version while preserving the previously approved snapshot.
 */
export function requiresVersionSnapshotOnBodyEdit(
  currentStatus: ContentAssetStatus,
): boolean {
  return currentStatus === 'approved' || currentStatus === 'published';
}

export function buildDuplicateAssetInput(asset: ContentAsset): CreateContentAssetInput {
  return {
    calendarId: asset.calendarId,
    calendarItemId: asset.calendarItemId,
    title: `${asset.title} (Copy)`,
    platform: asset.platform,
    formatCategory: asset.formatCategory,
    formatLabel: asset.formatLabel,
    contentPillar: asset.contentPillar,
    contentTheme: asset.contentTheme,
    targetAudience: asset.targetAudience,
    contentObjective: asset.contentObjective,
    toneOfVoice: asset.toneOfVoice,
    contentLength: asset.contentLength,
    scheduledDate: asset.scheduledDate,
    workflowStatus: 'draft',
    source: asset.source === 'ai_generated' ? 'edited_ai' : asset.source,
    body: JSON.parse(JSON.stringify(asset.body)) as ContentAssetBody,
    generationOptions: { ...asset.generationOptions },
    handoffSnapshot: asset.handoffSnapshot ? { ...asset.handoffSnapshot } : null,
    changeSummary: `Duplicated from "${asset.title}" (v${asset.currentVersionNumber})`,
    actionType: 'duplicate',
    promptId: asset.promptId,
    promptVersion: asset.promptVersion,
    model: asset.model,
    generatedAt: asset.generatedAt,
  };
}

export interface ContentAssetFilterState {
  query?: string;
  platform?: string;
  formatCategory?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
}

export function filterContentAssets(
  assets: readonly ContentAsset[],
  filters: ContentAssetFilterState,
): ContentAsset[] {
  const q = (filters.query ?? '').trim().toLowerCase();
  const platform = (filters.platform ?? 'all').trim().toLowerCase();
  const formatCategory = (filters.formatCategory ?? 'all').trim().toLowerCase();
  const status = (filters.status ?? 'all').trim().toLowerCase();
  const dateFrom = (filters.dateFrom ?? '').trim();
  const dateTo = (filters.dateTo ?? '').trim();

  return assets.filter((asset) => {
    if (platform !== 'all' && asset.platform.toLowerCase() !== platform) {
      return false;
    }
    if (formatCategory !== 'all' && asset.formatCategory.toLowerCase() !== formatCategory) {
      return false;
    }
    if (status !== 'all' && asset.workflowStatus.toLowerCase() !== status) {
      return false;
    }
    if (dateFrom) {
      const refDate = (asset.scheduledDate || asset.updatedAt.slice(0, 10));
      if (refDate < dateFrom) return false;
    }
    if (dateTo) {
      const refDate = (asset.scheduledDate || asset.updatedAt.slice(0, 10));
      if (refDate > dateTo) return false;
    }
    if (q) {
      const haystack = [
        asset.title,
        asset.platform,
        asset.formatLabel,
        asset.contentPillar,
        asset.contentTheme,
        asset.targetAudience,
        asset.body.hook,
        asset.body.mainCopy,
        asset.body.cta,
      ]
        .join(' ')
        .toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });
}

export interface StudioStats {
  total: number;
  draft: number;
  inProgress: number;
  readyForReview: number;
  approved: number;
  published: number;
  archived: number;
  linkedToCalendar: number;
}

export function computeStudioStats(assets: readonly ContentAsset[]): StudioStats {
  const stats: StudioStats = {
    total: assets.length,
    draft: 0,
    inProgress: 0,
    readyForReview: 0,
    approved: 0,
    published: 0,
    archived: 0,
    linkedToCalendar: 0,
  };

  for (const asset of assets) {
    if (asset.calendarItemId) stats.linkedToCalendar += 1;
    switch (asset.workflowStatus) {
      case 'draft':
        stats.draft += 1;
        break;
      case 'in_progress':
        stats.inProgress += 1;
        break;
      case 'ready_for_review':
        stats.readyForReview += 1;
        break;
      case 'approved':
        stats.approved += 1;
        break;
      case 'published':
        stats.published += 1;
        break;
      case 'archived':
        stats.archived += 1;
        break;
    }
  }

  return stats;
}

export function formatAssetAsPlainText(asset: ContentAsset): string {
  const lines: string[] = [];
  lines.push(asset.title);
  lines.push(`${asset.platform} | ${asset.formatLabel || getFormatCategoryLabel(asset.formatCategory)}`);
  lines.push('');

  if (asset.body.hook) {
    lines.push(asset.body.hook);
    lines.push('');
  }

  if (asset.formatCategory === 'carousel' && asset.body.carouselSlides.length > 0) {
    for (const slide of asset.body.carouselSlides) {
      lines.push(`Slide ${slide.slideNumber}: ${slide.headline}`);
      if (slide.body) lines.push(slide.body);
      if (slide.visualCue) lines.push(`[Visual: ${slide.visualCue}]`);
      lines.push('');
    }
  } else if (asset.formatCategory === 'short_video_script' && asset.body.videoScript) {
    if (asset.body.videoScript.hook && asset.body.videoScript.hook !== asset.body.hook) {
      lines.push(`Hook: ${asset.body.videoScript.hook}`);
      lines.push('');
    }
    for (const scene of asset.body.videoScript.scenes) {
      lines.push(`Scene ${scene.sceneNumber} (${scene.durationHint})`);
      if (scene.visual) lines.push(`Visual: ${scene.visual}`);
      if (scene.dialogue) lines.push(`Dialogue: ${scene.dialogue}`);
      lines.push('');
    }
    if (asset.body.videoScript.cta) {
      lines.push(`Video CTA: ${asset.body.videoScript.cta}`);
      lines.push('');
    }
  } else if (asset.formatCategory === 'long_form_article' && asset.body.articleSections.length > 0) {
    if (asset.body.mainCopy) {
      lines.push(asset.body.mainCopy);
      lines.push('');
    }
    for (const section of asset.body.articleSections) {
      lines.push(`## ${section.heading}`);
      lines.push(section.body);
      lines.push('');
    }
  } else if (asset.body.mainCopy) {
    lines.push(asset.body.mainCopy);
    lines.push('');
  }

  if (asset.body.cta) {
    lines.push(asset.body.cta);
    lines.push('');
  }

  if (asset.body.hashtags.length > 0) {
    lines.push(asset.body.hashtags.join(' '));
  }

  return lines.join('\n').trim();
}
