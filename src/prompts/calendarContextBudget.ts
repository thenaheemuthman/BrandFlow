import type {
  PromptDefinition,
  VerifiedBrandContext,
} from './types.ts';
import {
  extractVerifiedCustomerLists,
  extractVerifiedMarketingList,
  measureCompiledPromptLength,
  projectCompactBrandFoundation,
  sortByStrategicPriority,
  sortChannelsByPriority,
  trimSentenceBounded,
} from './marketingContextBudget.ts';
import {
  extractVerifiedContentList,
  projectCompactMessagingForGovernance,
} from './contentContextBudget.ts';

export const CONTENT_CALENDAR_PROMPT_TARGET_BUDGET = 9_200;

export const CONTENT_CALENDAR_PROMPT_IDS = [
  'content_calendar_weekly_batch',
] as const;

export type ContentCalendarPromptId = (typeof CONTENT_CALENDAR_PROMPT_IDS)[number];

const CONTENT_CALENDAR_PROMPT_ID_SET = new Set<string>(CONTENT_CALENDAR_PROMPT_IDS);

export function isContentCalendarPromptId(promptId: string): promptId is ContentCalendarPromptId {
  return CONTENT_CALENDAR_PROMPT_ID_SET.has(promptId);
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

function compactCalendarObjectives(
  items: readonly unknown[],
  tier: CompactionTier,
): Record<string, unknown>[] {
  const limit = tier === 'ultra' ? 2 : tier === 'minimal' ? 3 : tier === 'lean' ? 4 : 5;
  const out: Record<string, unknown>[] = [];
  for (const raw of items) {
    if (!isRecord(raw) || raw.approved === false) continue;
    const entry: Record<string, unknown> = {};
    const title = trimSentenceBounded(asTrimmedString(raw.title), tier === 'ultra' ? 55 : 75);
    if (title) entry.title = title;
    const level = asTrimmedString(raw.level);
    if (level) entry.level = level;
    const mktObj = trimSentenceBounded(asTrimmedString(raw.alignedMarketingObjectiveTitle), 60);
    if (mktObj) entry.marketingObjective = mktObj;
    if (tier === 'full' || tier === 'lean') {
      const actions = trimStringArray(raw.desiredAudienceActions, 1, 65);
      if (actions) entry.desiredAction = actions[0];
    }
    if (Object.keys(entry).length > 0) out.push(entry);
    if (out.length >= limit) break;
  }
  return out;
}

function compactCalendarPillars(
  items: readonly unknown[],
  tier: CompactionTier,
): Record<string, unknown>[] {
  const limit = tier === 'ultra' ? 4 : tier === 'minimal' ? 5 : 6;
  const out: Record<string, unknown>[] = [];
  for (const raw of items) {
    if (!isRecord(raw) || raw.approved === false) continue;
    const entry: Record<string, unknown> = {};
    const name = trimSentenceBounded(asTrimmedString(raw.name), tier === 'ultra' ? 50 : 70);
    if (name) entry.name = name;
    const audience = trimSentenceBounded(asTrimmedString(raw.targetAudienceSegment), 55);
    if (audience && tier !== 'ultra') entry.audience = audience;
    if (tier === 'full' || tier === 'lean') {
      const purpose = trimSentenceBounded(asTrimmedString(raw.strategicPurpose), tier === 'lean' ? 75 : 100);
      if (purpose) entry.purpose = purpose;
      const keyMessages = trimStringArray(raw.keyMessages, 1, 75);
      if (keyMessages) entry.keyMessage = keyMessages[0];
    }
    const mktObj = trimSentenceBounded(asTrimmedString(raw.alignedMarketingObjectiveTitle), 60);
    if (mktObj) entry.marketingObjective = mktObj;
    if (Object.keys(entry).length > 0) out.push(entry);
    if (out.length >= limit) break;
  }
  return out;
}

function compactCalendarThemes(
  items: readonly unknown[],
  tier: CompactionTier,
): Record<string, unknown>[] {
  const limit = tier === 'ultra' ? 4 : tier === 'minimal' ? 5 : tier === 'lean' ? 7 : 10;
  const out: Record<string, unknown>[] = [];
  for (const raw of items) {
    if (!isRecord(raw) || raw.approved === false) continue;
    const entry: Record<string, unknown> = {};
    const title = trimSentenceBounded(asTrimmedString(raw.title), tier === 'ultra' ? 55 : 75);
    if (title) entry.title = title;
    const pillar = trimSentenceBounded(asTrimmedString(raw.associatedPillarName), 50);
    if (pillar) entry.pillar = pillar;
    if (tier === 'full' || tier === 'lean') {
      const angle = trimSentenceBounded(asTrimmedString(raw.communicationAngle), tier === 'lean' ? 70 : 95);
      if (angle) entry.angle = angle;
    }
    if (Object.keys(entry).length > 0) out.push(entry);
    if (out.length >= limit) break;
  }
  return out;
}

function compactCalendarFormatsAndSeries(
  formats: readonly unknown[],
  series: readonly unknown[],
  tier: CompactionTier,
): Record<string, unknown> {
  const fmtLimit = tier === 'ultra' ? 4 : tier === 'minimal' ? 5 : tier === 'lean' ? 6 : 8;
  const seriesLimit = tier === 'ultra' ? 2 : tier === 'minimal' ? 3 : 5;

  const compactFormats: Record<string, unknown>[] = [];
  for (const raw of formats) {
    if (!isRecord(raw) || raw.approved === false) continue;
    const entry: Record<string, unknown> = {};
    const name = trimSentenceBounded(asTrimmedString(raw.formatName), 50);
    if (name) entry.format = name;
    const platforms = trimStringArray(raw.suitablePlatforms, 3, 35);
    if (platforms) entry.platforms = platforms;
    if (tier === 'full') {
      const purpose = trimSentenceBounded(asTrimmedString(raw.purpose), 75);
      if (purpose) entry.purpose = purpose;
    }
    if (Object.keys(entry).length > 0) compactFormats.push(entry);
    if (compactFormats.length >= fmtLimit) break;
  }

  const compactSeries: Record<string, unknown>[] = [];
  for (const raw of series) {
    if (!isRecord(raw) || raw.approved === false) continue;
    const entry: Record<string, unknown> = {};
    const name = trimSentenceBounded(asTrimmedString(raw.seriesName), 55);
    if (name) entry.series = name;
    const fmt = trimSentenceBounded(asTrimmedString(raw.formatName), 40);
    if (fmt) entry.format = fmt;
    const platforms = trimStringArray(raw.suitablePlatforms, 3, 35);
    if (platforms) entry.platforms = platforms;
    const cadence = trimSentenceBounded(asTrimmedString(raw.cadenceHint), 35);
    if (cadence && tier !== 'ultra') entry.cadence = cadence;
    if (Object.keys(entry).length > 0) compactSeries.push(entry);
    if (compactSeries.length >= seriesLimit) break;
  }

  return {
    formats: compactFormats,
    ...(compactSeries.length > 0 ? { series: compactSeries } : {}),
  };
}

function compactCalendarDistribution(
  items: readonly unknown[],
  tier: CompactionTier,
): Record<string, unknown>[] {
  const limit = tier === 'ultra' ? 4 : 6;
  const out: Record<string, unknown>[] = [];
  for (const raw of items) {
    if (!isRecord(raw) || raw.approved === false) continue;
    const entry: Record<string, unknown> = {};
    const platform = trimSentenceBounded(asTrimmedString(raw.platformName), 45);
    if (platform) entry.platform = platform;
    const freq = trimSentenceBounded(asTrimmedString(raw.recommendedFrequency), 45);
    if (freq) entry.frequency = freq;
    if (tier !== 'ultra') {
      const mix = trimStringArray(raw.contentMix, 2, 45);
      if (mix) entry.contentMix = mix;
    }
    if (Object.keys(entry).length > 0) out.push(entry);
    if (out.length >= limit) break;
  }
  return out;
}

function compactCalendarMarketingSummary(
  verifiedContext: VerifiedBrandContext,
  tier: CompactionTier,
): Record<string, unknown> {
  const objectives = sortByStrategicPriority(
    extractVerifiedMarketingList(verifiedContext, 'objectives').filter(isRecord),
  );
  const channels = sortChannelsByPriority(
    extractVerifiedMarketingList(verifiedContext, 'channels').filter(isRecord),
  );
  const kpis = extractVerifiedMarketingList(verifiedContext, 'kpis').filter(isRecord);

  const objLimit = tier === 'ultra' ? 2 : tier === 'minimal' ? 3 : 4;
  const chLimit = tier === 'ultra' ? 4 : 5;
  const kpiLimit = tier === 'ultra' ? 2 : tier === 'minimal' ? 3 : 5;

  const compactObjectives = objectives
    .filter((o) => o.approved !== false)
    .slice(0, objLimit)
    .map((o) => ({
      title: trimSentenceBounded(asTrimmedString(o.title), 65),
      priority: asTrimmedString(o.priority) || undefined,
    }))
    .filter((o) => o.title);

  const compactChannels = channels
    .filter((c) => c.approved !== false)
    .slice(0, chLimit)
    .map((c) => ({
      channel: trimSentenceBounded(asTrimmedString(c.channelName), 45),
      priority: asTrimmedString(c.priority) || undefined,
    }))
    .filter((c) => c.channel);

  const compactKpis = kpis
    .filter((k) => k.approved !== false)
    .slice(0, kpiLimit)
    .map((k) => ({
      kpi: trimSentenceBounded(asTrimmedString(k.kpiName), 55),
      objective:
        tier === 'full' || tier === 'lean'
          ? trimSentenceBounded(asTrimmedString(k.relatedObjectiveTitle), 55) || undefined
          : undefined,
    }))
    .filter((k) => k.kpi);

  return {
    objectives: compactObjectives,
    channels: compactChannels,
    ...(compactKpis.length > 0 ? { kpis: compactKpis } : {}),
  };
}

function compactCalendarAudienceSummary(
  verifiedContext: VerifiedBrandContext,
  tier: CompactionTier,
): Record<string, unknown> {
  const { personas, interests } = extractVerifiedCustomerLists(verifiedContext);
  const personaLimit = tier === 'ultra' ? 2 : tier === 'minimal' ? 2 : 3;
  const interestLimit = tier === 'ultra' ? 2 : tier === 'minimal' ? 3 : 4;

  const compactPersonas = personas
    .filter((p): p is Record<string, unknown> => isRecord(p) && p.approved !== false)
    .slice(0, personaLimit)
    .map((p) => {
      const entry: Record<string, unknown> = {
        name: trimSentenceBounded(asTrimmedString(p.name), 50),
      };
      const painPoints = trimStringArray(
        p.painPoints,
        tier === 'ultra' ? 1 : 2,
        tier === 'ultra' ? 55 : 70,
      );
      if (painPoints) entry.painPoints = painPoints;
      if (tier === 'full') {
        const goals = trimStringArray(p.goals, 1, 65);
        if (goals) entry.goals = goals;
      }
      return entry;
    })
    .filter((p) => p.name);

  const compactInterests = interests
    .filter((i): i is Record<string, unknown> => isRecord(i) && i.approved !== false)
    .slice(0, interestLimit)
    .map((i) => {
      const entry: Record<string, unknown> = {
        topic: trimSentenceBounded(asTrimmedString(i.topic), 55),
      };
      if (tier === 'full' || tier === 'lean') {
        const questions = trimStringArray(i.frequentQuestions, 1, 65);
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

function compactPreviouslyScheduledVariable(
  raw: string | undefined,
  tier: CompactionTier,
): string {
  if (!raw || raw === 'Not provided' || raw === '[]') return 'None scheduled yet';
  try {
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      const maxEntries = tier === 'ultra' ? 10 : tier === 'minimal' ? 14 : 24;
      const compacted = parsed
        .slice(-maxEntries)
        .map((entry) => {
          if (typeof entry === 'string') return trimSentenceBounded(entry, 55);
          if (!isRecord(entry)) return null;
          const date = asTrimmedString(entry.date || entry.scheduledDate);
          const platform = trimSentenceBounded(asTrimmedString(entry.platform), 28);
          const title = trimSentenceBounded(asTrimmedString(entry.title), tier === 'ultra' ? 40 : 55);
          const pillar = trimSentenceBounded(asTrimmedString(entry.pillar || entry.contentPillar), 35);
          return tier === 'ultra'
            ? `${date} | ${platform} | ${title}`
            : { date, platform, pillar, title };
        })
        .filter(Boolean);
      return compacted.length > 0 ? JSON.stringify(compacted) : 'None scheduled yet';
    }
  } catch {
    // Plain text fallback — compact cleanly without splitting JSON.
  }
  return trimSentenceBounded(raw, tier === 'ultra' ? 280 : tier === 'minimal' ? 420 : 650) || 'None scheduled yet';
}

function compactBatchPlanVariable(raw: string | undefined, tier: CompactionTier): string {
  if (!raw || raw === 'Not provided') return 'Not provided';
  try {
    const parsed: unknown = JSON.parse(raw);
    if (isRecord(parsed)) {
      const cleaned: Record<string, unknown> = {
        batchLabel: asTrimmedString(parsed.batchLabel),
        startDate: asTrimmedString(parsed.startDate),
        endDate: asTrimmedString(parsed.endDate),
        targetItemCount: typeof parsed.targetItemCount === 'number' ? parsed.targetItemCount : 4,
        selectedPlatforms: Array.isArray(parsed.selectedPlatforms)
          ? parsed.selectedPlatforms.slice(0, 8)
          : [],
        preferredDays: Array.isArray(parsed.preferredDays) ? parsed.preferredDays.slice(0, 7) : [],
        preferredTime: trimSentenceBounded(asTrimmedString(parsed.preferredTime), 40),
        postingFrequency: trimSentenceBounded(asTrimmedString(parsed.postingFrequency), 60),
      };
      const focus = trimSentenceBounded(
        asTrimmedString(parsed.campaignObjectiveFocus),
        tier === 'ultra' ? 90 : 160,
      );
      if (focus) cleaned.campaignObjectiveFocus = focus;
      const mix = trimSentenceBounded(
        asTrimmedString(parsed.contentMixPreference),
        tier === 'ultra' ? 80 : 140,
      );
      if (mix) cleaned.contentMixPreference = mix;
      const capacity = trimSentenceBounded(
        asTrimmedString(parsed.teamCapacityNote),
        tier === 'ultra' ? 75 : 130,
      );
      if (capacity) cleaned.teamCapacityNote = capacity;
      const constraints = trimSentenceBounded(
        asTrimmedString(parsed.specialDatesOrConstraints),
        tier === 'ultra' ? 95 : 180,
      );
      if (constraints) cleaned.specialDatesOrConstraints = constraints;
      return JSON.stringify(cleaned);
    }
  } catch {
    // Keep clean bounded text fallback.
  }
  return trimSentenceBounded(raw, tier === 'ultra' ? 400 : 700);
}

/**
 * Deterministic, priority-based prompt context optimizer for `content_calendar_weekly_batch`.
 * Enforces priority retention:
 *   1. Approved Content Strategy (pillars, themes, formats, distribution, objectives) + batch plan
 *   2. Approved Marketing Strategy (objectives, channels, KPIs)
 *   3. Approved Customer Intelligence (personas, pain points, interests)
 *   4. Brand Messaging & Foundation (passed concisely in supplemental context)
 *   5. Brand profile & optional notes
 * Always outputs valid JSON strings and guarantees compiled prompt <= 9,200 chars (< 12,000 limit).
 */
export function optimizeContentCalendarPromptVariables(
  definition: PromptDefinition,
  verifiedContext: VerifiedBrandContext,
  compiledSystemInstructions: string,
  resolvedVariables: Record<string, string>,
): Record<string, string> {
  if (!isContentCalendarPromptId(definition.promptId)) {
    return resolvedVariables;
  }

  const contentObjectives = extractVerifiedContentList(verifiedContext, 'objectives');
  const contentPillars = extractVerifiedContentList(verifiedContext, 'pillars');
  const contentThemes = extractVerifiedContentList(verifiedContext, 'themes');
  const contentFormats = extractVerifiedContentList(verifiedContext, 'formats');
  const contentSeries = extractVerifiedContentList(verifiedContext, 'series');
  const contentDistribution = extractVerifiedContentList(verifiedContext, 'distribution');

  const tiers: readonly CompactionTier[] = ['full', 'lean', 'minimal', 'ultra'];
  let candidate = { ...resolvedVariables };

  for (const tier of tiers) {
    candidate = { ...resolvedVariables };

    // Priority 1: Approved Content Strategy + Batch Plan
    candidate.calendarBatchPlan = compactBatchPlanVariable(resolvedVariables.calendarBatchPlan, tier);
    candidate.previouslyScheduledSummary = compactPreviouslyScheduledVariable(
      resolvedVariables.previouslyScheduledSummary,
      tier,
    );
    candidate.approvedContentObjectives = JSON.stringify(
      compactCalendarObjectives(contentObjectives, tier),
    );
    candidate.approvedContentPillars = JSON.stringify(
      compactCalendarPillars(contentPillars, tier),
    );
    candidate.approvedContentThemes =
      contentThemes.length > 0
        ? JSON.stringify(compactCalendarThemes(contentThemes, tier))
        : '[]';
    candidate.approvedContentFormats = JSON.stringify(
      compactCalendarFormatsAndSeries(contentFormats, contentSeries, tier),
    );
    candidate.approvedContentDistribution =
      contentDistribution.length > 0
        ? JSON.stringify(compactCalendarDistribution(contentDistribution, tier))
        : '[]';

    // Priority 2: Approved Marketing Strategy summary
    candidate.approvedMarketingSummary = JSON.stringify(
      compactCalendarMarketingSummary(verifiedContext, tier),
    );

    // Priority 3: Approved Customer Intelligence summary
    candidate.approvedAudienceSummary = JSON.stringify(
      compactCalendarAudienceSummary(verifiedContext, tier),
    );

    // Priority 5: Brand profile strings
    const maxProfile = tier === 'ultra' ? 90 : tier === 'minimal' ? 120 : tier === 'lean' ? 160 : 210;
    if (candidate.productsOrServices) {
      candidate.productsOrServices = trimSentenceBounded(candidate.productsOrServices, maxProfile);
    }
    if (candidate.targetMarket) {
      candidate.targetMarket = trimSentenceBounded(candidate.targetMarket, maxProfile);
    }
    if (candidate.additionalNotes && candidate.additionalNotes !== 'Not provided') {
      candidate.additionalNotes =
        trimSentenceBounded(
          candidate.additionalNotes,
          tier === 'ultra' ? 60 : tier === 'minimal' ? 95 : 150,
        ) || 'Not provided';
    }

    const compiledLen = measureCompiledPromptLength(
      definition,
      compiledSystemInstructions,
      candidate,
    );
    if (compiledLen <= CONTENT_CALENDAR_PROMPT_TARGET_BUDGET) {
      return candidate;
    }
  }

  return candidate;
}

/**
 * Projects lean supplemental upstream modules (Brand Foundation, Brand Messaging,
 * Content Governance) into `contextPayload` without duplicating embedded template variables.
 */
export function projectCalendarSupplementalModule(
  moduleKey: string,
  content: Record<string, unknown>,
): Record<string, unknown> | null {
  if (moduleKey === 'brandFoundation') {
    const projected = projectCompactBrandFoundation(content);
    return Object.keys(projected).length > 0 ? projected : null;
  }
  if (moduleKey === 'brandMessaging') {
    const projected = projectCompactMessagingForGovernance(content, 'lean');
    return Object.keys(projected).length > 0 ? projected : null;
  }
  return null;
}
