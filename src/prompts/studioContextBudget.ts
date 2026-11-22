import type {
  PromptDefinition,
  VerifiedBrandContext,
} from './types.ts';
import {
  extractVerifiedCustomerLists,
  extractVerifiedMarketingList,
  measureCompiledPromptLength,
  projectCompactBrandFoundation,
  projectCompactBrandMessaging,
  sortByStrategicPriority,
  trimSentenceBounded,
} from './marketingContextBudget.ts';
import {
  extractVerifiedContentList,
  projectCompactMessagingForGovernance,
} from './contentContextBudget.ts';

export const CONTENT_STUDIO_PROMPT_TARGET_BUDGET = 9_500;

export const CONTENT_STUDIO_PROMPT_IDS = [
  'content_studio_generate_asset',
  'content_studio_refine_asset',
] as const;

export type ContentStudioPromptId = (typeof CONTENT_STUDIO_PROMPT_IDS)[number];

const CONTENT_STUDIO_PROMPT_ID_SET = new Set<string>(CONTENT_STUDIO_PROMPT_IDS);

export function isContentStudioPromptId(promptId: string): promptId is ContentStudioPromptId {
  return CONTENT_STUDIO_PROMPT_ID_SET.has(promptId);
}

type CompactionTier = 'full' | 'lean' | 'minimal' | 'ultra';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asTrimmedString(value: unknown): string {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
}

function trimStringArray(
  value: unknown,
  maxItems: number,
  maxItemChars: number,
): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const seen = new Set<string>();
  const out: string[] = [];
  for (const entry of value) {
    if (typeof entry !== 'string') continue;
    const cleaned = trimSentenceBounded(entry, maxItemChars);
    if (!cleaned) continue;
    const key = cleaned.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(cleaned);
    if (out.length >= maxItems) break;
  }
  return out.length > 0 ? out : undefined;
}

/**
 * Priority 1: Brand Foundation & Brand Messaging (identity, positioning,
 * value proposition, pillars, voice & tone guardrails).
 */
function compactStudioBrandSummary(
  verifiedContext: VerifiedBrandContext,
  tier: CompactionTier,
): Record<string, unknown> {
  const out: Record<string, unknown> = {
    brandName: trimSentenceBounded(verifiedContext.brandName, 80),
  };

  const foundationMod = verifiedContext.approvedStrategyModules.brandFoundation;
  if (foundationMod && isRecord(foundationMod.content)) {
    const f = projectCompactBrandFoundation(foundationMod.content);
    const maxField = tier === 'ultra' ? 95 : tier === 'minimal' ? 125 : tier === 'lean' ? 160 : 210;
    const compactF: Record<string, unknown> = {};
    if (typeof f.positioning === 'string' && f.positioning) {
      compactF.positioning = trimSentenceBounded(f.positioning, maxField);
    }
    if (typeof f.mission === 'string' && f.mission && tier !== 'ultra') {
      compactF.mission = trimSentenceBounded(f.mission, maxField);
    }
    if (typeof f.purpose === 'string' && f.purpose && (tier === 'full' || tier === 'lean')) {
      compactF.purpose = trimSentenceBounded(f.purpose, maxField);
    }
    if (Array.isArray(f.coreValues) && tier !== 'ultra') {
      const vals = trimStringArray(f.coreValues, tier === 'minimal' ? 3 : 4, 45);
      if (vals) compactF.coreValues = vals;
    }
    if (Object.keys(compactF).length > 0) out.foundation = compactF;
  }

  const messagingMod = verifiedContext.approvedStrategyModules.brandMessaging;
  if (messagingMod && isRecord(messagingMod.content)) {
    const m = projectCompactBrandMessaging(messagingMod.content);
    const govVoice = projectCompactMessagingForGovernance(
      messagingMod.content,
      tier === 'ultra' || tier === 'minimal' ? 'minimal' : 'lean',
    );
    const maxField = tier === 'ultra' ? 95 : tier === 'minimal' ? 130 : tier === 'lean' ? 170 : 220;
    const compactM: Record<string, unknown> = {};
    if (typeof m.valueProposition === 'string' && m.valueProposition) {
      compactM.valueProposition = trimSentenceBounded(m.valueProposition, maxField);
    }
    if (Array.isArray(m.messagingPillars)) {
      const pillars = trimStringArray(
        m.messagingPillars.map((p) => (typeof p === 'string' ? p : isRecord(p) ? asTrimmedString(p.title || p.name || p.statement) : '')),
        tier === 'ultra' ? 2 : tier === 'minimal' ? 3 : 4,
        tier === 'ultra' ? 65 : 95,
      );
      if (pillars) compactM.pillars = pillars;
    }
    if (govVoice.voiceTone) {
      compactM.voiceAndTone = govVoice.voiceTone;
    } else if (typeof m.voiceAndTone === 'string' && m.voiceAndTone) {
      compactM.voiceAndTone = trimSentenceBounded(m.voiceAndTone, maxField);
    }
    if (Object.keys(compactM).length > 0) out.messaging = compactM;
  }

  return out;
}

/**
 * Priority 2: Target Audience & Customer Intelligence (personas, pain points, goals, interests).
 */
function compactStudioAudienceSummary(
  verifiedContext: VerifiedBrandContext,
  tier: CompactionTier,
  preferredAudienceHint?: string,
): Record<string, unknown> {
  const { personas, interests } = extractVerifiedCustomerLists(verifiedContext);
  const personaLimit = tier === 'ultra' ? 1 : tier === 'minimal' ? 2 : 3;
  const interestLimit = tier === 'ultra' ? 2 : tier === 'minimal' ? 3 : 4;

  const hintLower = (preferredAudienceHint ?? '').toLowerCase();
  const approvedPersonas = personas
    .filter((p): p is Record<string, unknown> => isRecord(p) && p.approved !== false)
    .sort((a, b) => {
      if (!hintLower) return 0;
      const aMatch = asTrimmedString(a.name).toLowerCase().includes(hintLower) ||
        hintLower.includes(asTrimmedString(a.name).toLowerCase());
      const bMatch = asTrimmedString(b.name).toLowerCase().includes(hintLower) ||
        hintLower.includes(asTrimmedString(b.name).toLowerCase());
      if (aMatch !== bMatch) return aMatch ? -1 : 1;
      return 0;
    });

  const compactPersonas = approvedPersonas
    .slice(0, personaLimit)
    .map((p) => {
      const entry: Record<string, unknown> = {
        name: trimSentenceBounded(asTrimmedString(p.name), 55),
      };
      const painPoints = trimStringArray(
        p.painPoints,
        tier === 'ultra' ? 1 : 2,
        tier === 'ultra' ? 65 : 85,
      );
      if (painPoints) entry.painPoints = painPoints;
      if (tier === 'full' || tier === 'lean') {
        const goals = trimStringArray(p.goals, 2, 75);
        if (goals) entry.goals = goals;
      }
      if (tier === 'full') {
        const objections = trimStringArray(p.objections, 1, 75);
        if (objections) entry.objections = objections;
      }
      return entry;
    })
    .filter((p) => p.name);

  const compactInterests = interests
    .filter((i): i is Record<string, unknown> => isRecord(i) && i.approved !== false)
    .slice(0, interestLimit)
    .map((i) => {
      const entry: Record<string, unknown> = {
        topic: trimSentenceBounded(asTrimmedString(i.topic), 60),
      };
      if (tier === 'full' || tier === 'lean') {
        const questions = trimStringArray(i.frequentQuestions, 1, 75);
        if (questions) entry.question = questions[0];
      }
      return entry;
    })
    .filter((i) => i.topic);

  return {
    personas: compactPersonas,
    ...(compactInterests.length > 0 ? { interests: compactInterests } : {}),
  };
}

/**
 * Priority 5: Approved Marketing & Content Strategy context (compact reference).
 */
function compactStudioStrategySummary(
  verifiedContext: VerifiedBrandContext,
  tier: CompactionTier,
): Record<string, unknown> {
  const objectives = sortByStrategicPriority(
    extractVerifiedMarketingList(verifiedContext, 'objectives').filter(isRecord),
  );
  const contentPillars = extractVerifiedContentList(verifiedContext, 'pillars');
  const governance = extractVerifiedContentList(verifiedContext, 'governance');

  const compactObjectives = objectives
    .filter((o) => o.approved !== false)
    .slice(0, tier === 'ultra' ? 1 : tier === 'minimal' ? 2 : 3)
    .map((o) => trimSentenceBounded(asTrimmedString(o.title), 70))
    .filter(Boolean);

  const compactPillars = contentPillars
    .filter((p): p is Record<string, unknown> => isRecord(p) && p.approved !== false)
    .slice(0, tier === 'ultra' ? 2 : tier === 'minimal' ? 3 : 4)
    .map((p) => ({
      name: trimSentenceBounded(asTrimmedString(p.name), 55),
      ...(tier === 'full' || tier === 'lean'
        ? { purpose: trimSentenceBounded(asTrimmedString(p.strategicPurpose), 75) || undefined }
        : {}),
    }))
    .filter((p) => p.name);

  const compactGovernance = governance
    .filter((g): g is Record<string, unknown> => isRecord(g) && g.approved !== false)
    .slice(0, tier === 'ultra' ? 1 : 2)
    .map((g) => trimSentenceBounded(asTrimmedString(g.ruleTitle || g.rule || g.description), 85))
    .filter(Boolean);

  return {
    ...(compactObjectives.length > 0 ? { marketingObjectives: compactObjectives } : {}),
    ...(compactPillars.length > 0 ? { contentPillars: compactPillars } : {}),
    ...(compactGovernance.length > 0 ? { governanceGuardrails: compactGovernance } : {}),
  };
}

/**
 * Priority 3: Selected Calendar Entry / Handoff Brief.
 */
function compactStudioBriefVariable(
  raw: string | undefined,
  tier: CompactionTier,
): string {
  if (!raw || raw === 'Not provided') return 'Standalone draft (no calendar entry selected)';
  try {
    const parsed: unknown = JSON.parse(raw);
    if (isRecord(parsed)) {
      const maxShort = tier === 'ultra' ? 70 : tier === 'minimal' ? 95 : tier === 'lean' ? 130 : 180;
      const maxMed = tier === 'ultra' ? 110 : tier === 'minimal' ? 160 : tier === 'lean' ? 230 : 320;
      const cleaned: Record<string, unknown> = {};
      const copyField = (key: string, maxLen: number) => {
        const val = asTrimmedString(parsed[key]);
        if (val) cleaned[key] = trimSentenceBounded(val, maxLen);
      };
      copyField('title', maxShort);
      copyField('platform', 45);
      copyField('contentFormat', 55);
      copyField('contentPillar', 65);
      copyField('contentTheme', maxShort);
      copyField('targetAudience', maxShort);
      copyField('audiencePainPoint', maxMed);
      copyField('contentObjective', maxShort);
      copyField('coreMessage', maxMed);
      copyField('suggestedAngle', maxMed);
      copyField('intendedCta', maxShort);
      if (tier !== 'ultra') {
        copyField('relatedMarketingObjective', maxShort);
        copyField('relevantKpi', 65);
        copyField('scheduledDate', 20);
        copyField('productionNotes', maxMed);
      }
      return Object.keys(cleaned).length > 0 ? JSON.stringify(cleaned) : 'Standalone draft';
    }
  } catch {
    // Plain text fallback
  }
  return trimSentenceBounded(raw, tier === 'ultra' ? 350 : tier === 'minimal' ? 520 : 800) || 'Standalone draft';
}

/**
 * Priority 4: Platform & Format Requirements + Generation Options.
 */
function compactStudioOptionsVariable(
  raw: string | undefined,
  tier: CompactionTier,
): string {
  if (!raw || raw === 'Not provided') return '{}';
  try {
    const parsed: unknown = JSON.parse(raw);
    if (isRecord(parsed)) {
      const maxField = tier === 'ultra' ? 90 : tier === 'minimal' ? 140 : tier === 'lean' ? 200 : 280;
      const cleaned: Record<string, unknown> = {};
      for (const [key, val] of Object.entries(parsed)) {
        if (typeof val === 'string') {
          const t = asTrimmedString(val);
          if (t) {
            cleaned[key] = trimSentenceBounded(
              t,
              key === 'additionalInstructions' ? (tier === 'ultra' ? 140 : tier === 'minimal' ? 220 : 360) : maxField,
            );
          }
        } else if (Array.isArray(val)) {
          const arr = trimStringArray(val, tier === 'ultra' ? 3 : 5, 70);
          if (arr) cleaned[key] = arr;
        }
      }
      return JSON.stringify(cleaned);
    }
  } catch {
    // Fallback
  }
  return trimSentenceBounded(raw, tier === 'ultra' ? 320 : 600);
}

/**
 * For `content_studio_refine_asset`, keeps the existing draft readable and JSON-valid
 * across tiers while preserving key copy, slides, video scenes, or article sections.
 */
function compactExistingDraftVariable(
  raw: string | undefined,
  tier: CompactionTier,
): string {
  if (!raw || raw === 'Not provided') return '{}';
  const maxCopy = tier === 'ultra' ? 950 : tier === 'minimal' ? 1500 : tier === 'lean' ? 2200 : 3200;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (isRecord(parsed)) {
      const cleaned: Record<string, unknown> = {};
      const title = asTrimmedString(parsed.title);
      if (title) cleaned.title = trimSentenceBounded(title, 120);
      const hook = asTrimmedString(parsed.hook);
      if (hook) cleaned.hook = trimSentenceBounded(hook, 220);
      const mainCopy = asTrimmedString(parsed.mainCopy);
      if (mainCopy) cleaned.mainCopy = trimSentenceBounded(mainCopy, maxCopy);
      const cta = asTrimmedString(parsed.cta);
      if (cta) cleaned.cta = trimSentenceBounded(cta, 180);
      if (Array.isArray(parsed.hashtags)) {
        const tags = trimStringArray(parsed.hashtags, 8, 35);
        if (tags) cleaned.hashtags = tags;
      }
      if (Array.isArray(parsed.carouselSlides) && parsed.carouselSlides.length > 0) {
        const slideLimit = tier === 'ultra' ? 6 : 10;
        const slideBodyMax = tier === 'ultra' ? 110 : tier === 'minimal' ? 170 : 260;
        cleaned.carouselSlides = parsed.carouselSlides
          .filter(isRecord)
          .slice(0, slideLimit)
          .map((s, idx) => ({
            slideNumber: typeof s.slideNumber === 'number' ? s.slideNumber : idx + 1,
            headline: trimSentenceBounded(asTrimmedString(s.headline), 85),
            body: trimSentenceBounded(asTrimmedString(s.body), slideBodyMax),
            ...(tier !== 'ultra'
              ? { visualCue: trimSentenceBounded(asTrimmedString(s.visualCue), 80) }
              : {}),
          }));
      }
      if (isRecord(parsed.videoScript)) {
        const vs = parsed.videoScript;
        const scenes = Array.isArray(vs.scenes)
          ? vs.scenes
              .filter(isRecord)
              .slice(0, tier === 'ultra' ? 5 : 8)
              .map((sc, idx) => ({
                sceneNumber: typeof sc.sceneNumber === 'number' ? sc.sceneNumber : idx + 1,
                visual: trimSentenceBounded(asTrimmedString(sc.visual), tier === 'ultra' ? 85 : 140),
                dialogue: trimSentenceBounded(asTrimmedString(sc.dialogue), tier === 'ultra' ? 130 : 220),
                durationHint: trimSentenceBounded(asTrimmedString(sc.durationHint), 25),
              }))
          : [];
        cleaned.videoScript = {
          hook: trimSentenceBounded(asTrimmedString(vs.hook), 180),
          scenes,
          cta: trimSentenceBounded(asTrimmedString(vs.cta), 140),
        };
      }
      if (Array.isArray(parsed.articleSections) && parsed.articleSections.length > 0) {
        const secLimit = tier === 'ultra' ? 4 : 7;
        const secBodyMax = tier === 'ultra' ? 180 : tier === 'minimal' ? 280 : 480;
        cleaned.articleSections = parsed.articleSections
          .filter(isRecord)
          .slice(0, secLimit)
          .map((sec) => ({
            heading: trimSentenceBounded(asTrimmedString(sec.heading), 90),
            body: trimSentenceBounded(asTrimmedString(sec.body), secBodyMax),
          }));
      }
      return JSON.stringify(cleaned);
    }
  } catch {
    // Plain text fallback
  }
  return trimSentenceBounded(raw, maxCopy);
}

/**
 * Deterministic 4-tier prompt context optimizer for Content Studio prompts.
 * Priority retention order:
 *   1. Brand Foundation & Brand Messaging (identity, positioning, value prop, pillars, voice)
 *   2. Target Audience & Customer Intelligence (personas, pain points, interests)
 *   3. Selected Calendar Entry / Handoff Brief
 *   4. Platform & Format Requirements + User Generation Options
 *   5. Approved Marketing & Content Strategy context
 * Guarantees valid JSON strings and targets <= 9,500 chars (well below the 12,000 hard limit).
 */
export function optimizeContentStudioPromptVariables(
  definition: PromptDefinition,
  verifiedContext: VerifiedBrandContext,
  compiledSystemInstructions: string,
  resolvedVariables: Record<string, string>,
): Record<string, string> {
  if (!isContentStudioPromptId(definition.promptId)) {
    return resolvedVariables;
  }

  let preferredAudienceHint = '';
  try {
    const parsedOptions = JSON.parse(resolvedVariables.studioGenerationOptions || '{}');
    if (isRecord(parsedOptions) && typeof parsedOptions.targetAudience === 'string') {
      preferredAudienceHint = parsedOptions.targetAudience;
    }
  } catch {
    // ignore
  }

  const tiers: readonly CompactionTier[] = ['full', 'lean', 'minimal', 'ultra'];
  let candidate = { ...resolvedVariables };

  for (const tier of tiers) {
    candidate = { ...resolvedVariables };

    // Priority 1: Brand Foundation & Brand Messaging
    candidate.studioBrandContext = JSON.stringify(
      compactStudioBrandSummary(verifiedContext, tier),
    );

    // Priority 2: Target Audience & Customer Intelligence
    candidate.studioAudienceContext = JSON.stringify(
      compactStudioAudienceSummary(verifiedContext, tier, preferredAudienceHint),
    );

    // Priority 3: Selected Calendar Entry / Handoff Brief
    candidate.studioCalendarBrief = compactStudioBriefVariable(
      resolvedVariables.studioCalendarBrief,
      tier,
    );

    // Priority 4: Platform & Format Requirements + User Generation Options
    candidate.studioGenerationOptions = compactStudioOptionsVariable(
      resolvedVariables.studioGenerationOptions,
      tier,
    );

    // Priority 5: Approved Marketing & Content Strategy context
    candidate.studioStrategyContext = JSON.stringify(
      compactStudioStrategySummary(verifiedContext, tier),
    );

    // Refinement-specific variables
    if (definition.promptId === 'content_studio_refine_asset') {
      candidate.existingDraft = compactExistingDraftVariable(
        resolvedVariables.existingDraft,
        tier,
      );
      if (candidate.refinementInstructions && candidate.refinementInstructions !== 'Not provided') {
        candidate.refinementInstructions = trimSentenceBounded(
          candidate.refinementInstructions,
          tier === 'ultra' ? 220 : tier === 'minimal' ? 350 : 550,
        );
      }
      if (candidate.selectedSectionText && candidate.selectedSectionText !== 'Not provided') {
        candidate.selectedSectionText = trimSentenceBounded(
          candidate.selectedSectionText,
          tier === 'ultra' ? 300 : tier === 'minimal' ? 500 : 850,
        );
      }
    }

    // Compact profile strings
    const maxProfile = tier === 'ultra' ? 85 : tier === 'minimal' ? 120 : tier === 'lean' ? 160 : 210;
    if (candidate.productsOrServices) {
      candidate.productsOrServices = trimSentenceBounded(candidate.productsOrServices, maxProfile);
    }
    if (candidate.targetMarket) {
      candidate.targetMarket = trimSentenceBounded(candidate.targetMarket, maxProfile);
    }

    const compiledLen = measureCompiledPromptLength(
      definition,
      compiledSystemInstructions,
      candidate,
    );
    if (compiledLen <= CONTENT_STUDIO_PROMPT_TARGET_BUDGET) {
      return candidate;
    }
  }

  return candidate;
}

/**
 * Keeps supplemental context lean and strictly under the 24,000-char context limit
 * because Content Studio prompts already embed compact verified brand, audience,
 * and strategy context directly inside their templated variables.
 */
export function projectStudioSupplementalModule(
  moduleKey: string,
  content: Record<string, unknown>,
): Record<string, unknown> | null {
  if (moduleKey === 'brandFoundation') {
    const projected = projectCompactBrandFoundation(content);
    return Object.keys(projected).length > 0 ? projected : null;
  }
  if (moduleKey === 'brandMessaging') {
    const projected = projectCompactMessagingForGovernance(content, 'minimal');
    return Object.keys(projected).length > 0 ? projected : null;
  }
  return null;
}
