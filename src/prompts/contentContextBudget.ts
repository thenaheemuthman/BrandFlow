import type {
  PromptDefinition,
  VerifiedBrandContext,
} from './types.ts';
import {
  cleanValueForCompactPrompt,
  compactApprovedList,
  extractVerifiedCustomerLists,
  extractVerifiedMarketingList,
  measureCompiledPromptLength,
  projectCompactBrandFoundation,
  projectCompactBrandMessaging,
  sortByStrategicPriority,
  sortChannelsByPriority,
  trimSentenceBounded,
} from './marketingContextBudget.ts';

export const CONTENT_STRATEGY_PROMPT_TARGET_BUDGET = 7_800;

export const CONTENT_STRATEGY_PROMPT_IDS = [
  'content_strategy_objectives',
  'content_strategy_pillars',
  'content_strategy_themes',
  'content_strategy_formats',
  'content_strategy_distribution',
  'content_strategy_governance',
] as const;

export type ContentStrategyPromptId = (typeof CONTENT_STRATEGY_PROMPT_IDS)[number];

const CONTENT_STRATEGY_PROMPT_ID_SET = new Set<string>(CONTENT_STRATEGY_PROMPT_IDS);

export function isContentStrategyPromptId(promptId: string): promptId is ContentStrategyPromptId {
  return CONTENT_STRATEGY_PROMPT_ID_SET.has(promptId);
}

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

export type ContentApprovedListKey =
  | 'objectives'
  | 'pillars'
  | 'themes'
  | 'formats'
  | 'series'
  | 'distribution'
  | 'governance';

export function extractVerifiedContentList(
  verifiedContext: VerifiedBrandContext,
  key: ContentApprovedListKey,
): unknown[] {
  const contentMod = verifiedContext.approvedStrategyModules.contentStrategy;
  if (!contentMod || !isRecord(contentMod.content)) return [];
  const summaryList =
    isRecord(contentMod.content.approvedSummary) &&
    Array.isArray(contentMod.content.approvedSummary[key])
      ? (contentMod.content.approvedSummary[key] as unknown[])
      : null;
  const directList = Array.isArray(contentMod.content[key])
    ? (contentMod.content[key] as unknown[])
    : null;
  return summaryList ?? directList ?? [];
}

function compactContentObjectives(
  items: readonly unknown[],
  tier: 'full' | 'lean' | 'minimal',
): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  const limit = tier === 'minimal' ? 4 : tier === 'lean' ? 6 : 8;
  for (const raw of items) {
    if (!isRecord(raw) || raw.approved === false) continue;
    const entry: Record<string, unknown> = {};
    const title = trimSentenceBounded(asTrimmedString(raw.title), tier === 'minimal' ? 75 : 100);
    if (title) entry.title = title;
    const level = asTrimmedString(raw.level);
    if (level) entry.level = level;
    if (tier !== 'minimal') {
      const desc = trimSentenceBounded(asTrimmedString(raw.description), tier === 'lean' ? 110 : 160);
      if (desc) entry.description = desc;
    }
    const outcomes = trimStringArray(
      raw.targetAudienceOutcomes,
      tier === 'minimal' ? 1 : 2,
      tier === 'minimal' ? 70 : 95,
    );
    if (outcomes) entry.outcomes = outcomes;
    const actions = trimStringArray(
      raw.desiredAudienceActions,
      tier === 'minimal' ? 1 : 2,
      tier === 'minimal' ? 65 : 90,
    );
    if (actions) entry.actions = actions;
    const goalTitle = trimSentenceBounded(asTrimmedString(raw.alignedMarketingGoalTitle), 70);
    if (goalTitle && tier !== 'minimal') entry.marketingGoal = goalTitle;
    const objTitle = trimSentenceBounded(asTrimmedString(raw.alignedMarketingObjectiveTitle), 70);
    if (objTitle) entry.marketingObjective = objTitle;
    if (Object.keys(entry).length > 0) out.push(entry);
    if (out.length >= limit) break;
  }
  return out;
}

function compactContentPillars(
  items: readonly unknown[],
  tier: 'full' | 'lean' | 'minimal',
): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  const limit = tier === 'minimal' ? 5 : tier === 'lean' ? 6 : 8;
  for (const raw of items) {
    if (!isRecord(raw) || raw.approved === false) continue;
    const entry: Record<string, unknown> = {};
    const name = trimSentenceBounded(asTrimmedString(raw.name), tier === 'minimal' ? 70 : 95);
    if (name) entry.name = name;
    if (tier !== 'minimal') {
      const desc = trimSentenceBounded(asTrimmedString(raw.description), tier === 'lean' ? 110 : 160);
      if (desc) entry.description = desc;
    }
    const purpose = trimSentenceBounded(asTrimmedString(raw.strategicPurpose), tier === 'minimal' ? 85 : 125);
    if (purpose) entry.purpose = purpose;
    const audience = trimSentenceBounded(asTrimmedString(raw.targetAudienceSegment), 70);
    if (audience) entry.audience = audience;
    const painPoints = trimStringArray(
      raw.relevantInterestsAndPainPoints,
      tier === 'minimal' ? 1 : 2,
      tier === 'minimal' ? 65 : 90,
    );
    if (painPoints) entry.interestsAndPainPoints = painPoints;
    const keyMessages = trimStringArray(
      raw.keyMessages,
      tier === 'minimal' ? 1 : 2,
      tier === 'minimal' ? 65 : 95,
    );
    if (keyMessages) entry.keyMessages = keyMessages;
    if (tier === 'full') {
      const topics = trimStringArray(raw.supportingTopics, 3, 65);
      if (topics) entry.supportingTopics = topics;
    }
    const alignedObj = trimSentenceBounded(asTrimmedString(raw.alignedMarketingObjectiveTitle), 75);
    if (alignedObj) entry.marketingObjective = alignedObj;
    if (Object.keys(entry).length > 0) out.push(entry);
    if (out.length >= limit) break;
  }
  return out;
}

function compactContentThemes(
  items: readonly unknown[],
  tier: 'full' | 'lean' | 'minimal',
): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  const limit = tier === 'minimal' ? 6 : tier === 'lean' ? 8 : 12;
  for (const raw of items) {
    if (!isRecord(raw) || raw.approved === false) continue;
    const entry: Record<string, unknown> = {};
    const title = trimSentenceBounded(asTrimmedString(raw.title), tier === 'minimal' ? 70 : 95);
    if (title) entry.title = title;
    const pillar = trimSentenceBounded(asTrimmedString(raw.associatedPillarName), 65);
    if (pillar) entry.pillar = pillar;
    if (tier !== 'minimal') {
      const angle = trimSentenceBounded(asTrimmedString(raw.communicationAngle), tier === 'lean' ? 85 : 120);
      if (angle) entry.angle = angle;
    }
    if (tier === 'full') {
      const need = trimSentenceBounded(asTrimmedString(raw.addressedNeedOrAspiration), 100);
      if (need) entry.need = need;
      const obj = trimSentenceBounded(asTrimmedString(raw.alignedMarketingObjectiveTitle), 70);
      if (obj) entry.marketingObjective = obj;
    }
    if (Object.keys(entry).length > 0) out.push(entry);
    if (out.length >= limit) break;
  }
  return out;
}

function compactContentFormats(
  items: readonly unknown[],
  tier: 'full' | 'lean' | 'minimal',
): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  const limit = tier === 'minimal' ? 5 : tier === 'lean' ? 7 : 10;
  for (const raw of items) {
    if (!isRecord(raw) || raw.approved === false) continue;
    const entry: Record<string, unknown> = {};
    const name = trimSentenceBounded(asTrimmedString(raw.formatName), 65);
    if (name) entry.format = name;
    if (tier !== 'minimal') {
      const purpose = trimSentenceBounded(asTrimmedString(raw.purpose), tier === 'lean' ? 85 : 125);
      if (purpose) entry.purpose = purpose;
    }
    const platforms = trimStringArray(raw.suitablePlatforms, 4, 45);
    if (platforms) entry.platforms = platforms;
    const pillars = trimStringArray(raw.relatedPillarNames, 3, 55);
    if (pillars && tier !== 'minimal') entry.pillars = pillars;
    if (Object.keys(entry).length > 0) out.push(entry);
    if (out.length >= limit) break;
  }
  return out;
}

function compactContentSeries(
  items: readonly unknown[],
  tier: 'full' | 'lean' | 'minimal',
): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  const limit = tier === 'minimal' ? 4 : tier === 'lean' ? 6 : 8;
  for (const raw of items) {
    if (!isRecord(raw) || raw.approved === false) continue;
    const entry: Record<string, unknown> = {};
    const name = trimSentenceBounded(asTrimmedString(raw.seriesName), 70);
    if (name) entry.series = name;
    const fmt = trimSentenceBounded(asTrimmedString(raw.formatName), 55);
    if (fmt) entry.format = fmt;
    if (tier !== 'minimal') {
      const desc = trimSentenceBounded(asTrimmedString(raw.description), tier === 'lean' ? 90 : 130);
      if (desc) entry.description = desc;
    }
    const platforms = trimStringArray(raw.suitablePlatforms, 4, 45);
    if (platforms) entry.platforms = platforms;
    const pillars = trimStringArray(raw.relatedPillarNames, 2, 55);
    if (pillars) entry.pillars = pillars;
    const cadence = trimSentenceBounded(asTrimmedString(raw.cadenceHint), 45);
    if (cadence) entry.cadence = cadence;
    if (Object.keys(entry).length > 0) out.push(entry);
    if (out.length >= limit) break;
  }
  return out;
}

function compactContentDistribution(
  items: readonly unknown[],
  tier: 'full' | 'lean' | 'minimal',
): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  const limit = tier === 'minimal' ? 4 : 6;
  for (const raw of items) {
    if (!isRecord(raw) || raw.approved === false) continue;
    const entry: Record<string, unknown> = {};
    const platform = trimSentenceBounded(asTrimmedString(raw.platformName), 55);
    if (platform) entry.platform = platform;
    const freq = trimSentenceBounded(asTrimmedString(raw.recommendedFrequency), 60);
    if (freq) entry.frequency = freq;
    const mix = trimStringArray(raw.contentMix, tier === 'minimal' ? 2 : 3, 60);
    if (mix) entry.contentMix = mix;
    if (tier !== 'minimal') {
      const approach = trimSentenceBounded(asTrimmedString(raw.distributionApproach), 100);
      if (approach) entry.approach = approach;
    }
    if (Object.keys(entry).length > 0) out.push(entry);
    if (out.length >= limit) break;
  }
  return out;
}

export function compactApprovedContentList(
  items: readonly unknown[],
  kind: ContentApprovedListKey,
): Record<string, unknown>[] {
  switch (kind) {
    case 'objectives':
      return compactContentObjectives(items, 'full');
    case 'pillars':
      return compactContentPillars(items, 'full');
    case 'themes':
      return compactContentThemes(items, 'full');
    case 'formats':
      return compactContentFormats(items, 'full');
    case 'series':
      return compactContentSeries(items, 'full');
    case 'distribution':
      return compactContentDistribution(items, 'full');
    case 'governance':
      return compactApprovedList(items, { kind: 'generic', maxArrayItems: 4 });
  }
}

function compactPersonasForContent(
  personas: readonly unknown[],
  tier: 'full' | 'lean' | 'minimal',
): Record<string, unknown>[] {
  const limit = tier === 'minimal' ? 3 : tier === 'lean' ? 4 : 5;
  const out: Record<string, unknown>[] = [];
  for (const raw of personas) {
    if (!isRecord(raw) || raw.approved === false) continue;
    const entry: Record<string, unknown> = {};
    const name = trimSentenceBounded(asTrimmedString(raw.name), 60);
    if (name) entry.name = name;
    const role = trimSentenceBounded(asTrimmedString(raw.roleOrSegment), 70);
    if (role) entry.segment = role;
    const painPoints = trimStringArray(
      raw.painPoints,
      tier === 'minimal' ? 2 : 3,
      tier === 'minimal' ? 65 : 90,
    );
    if (painPoints) entry.painPoints = painPoints;
    const goals = trimStringArray(
      raw.goals,
      tier === 'minimal' ? 1 : 2,
      tier === 'minimal' ? 65 : 90,
    );
    if (goals) entry.goals = goals;
    if (tier !== 'minimal') {
      const motivations = trimStringArray(raw.motivations, 2, 85);
      if (motivations) entry.motivations = motivations;
      const channels = trimStringArray(
        raw.communicationPreferences ?? raw.informationSources,
        3,
        45,
      );
      if (channels) entry.channels = channels;
    }
    if (tier === 'full') {
      const triggers = trimStringArray(raw.purchasingTriggers, 2, 80);
      if (triggers) entry.triggers = triggers;
      const objections = trimStringArray(raw.objections, 2, 80);
      if (objections) entry.objections = objections;
    }
    if (Object.keys(entry).length > 0) out.push(entry);
    if (out.length >= limit) break;
  }
  return out;
}

function compactInterestsForContent(
  interests: readonly unknown[],
  tier: 'full' | 'lean' | 'minimal',
): Record<string, unknown>[] {
  const limit = tier === 'minimal' ? 4 : tier === 'lean' ? 5 : 7;
  const out: Record<string, unknown>[] = [];
  for (const raw of interests) {
    if (!isRecord(raw) || raw.approved === false) continue;
    const entry: Record<string, unknown> = {};
    const topic = trimSentenceBounded(asTrimmedString(raw.topic), 70);
    if (topic) entry.topic = topic;
    const problems = trimStringArray(
      raw.problemsToSolve,
      tier === 'minimal' ? 1 : 2,
      tier === 'minimal' ? 65 : 90,
    );
    if (problems) entry.problems = problems;
    const questions = trimStringArray(
      raw.frequentQuestions,
      tier === 'minimal' ? 1 : 2,
      tier === 'minimal' ? 70 : 95,
    );
    if (questions) entry.questions = questions;
    if (tier !== 'minimal') {
      const consumed = trimStringArray(raw.contentConsumed, 2, 65);
      if (consumed) entry.contentConsumed = consumed;
      const search = trimStringArray(raw.searchTopics, 2, 60);
      if (search) entry.searchTopics = search;
    }
    if (tier === 'full') {
      const triggers = trimStringArray(raw.purchaseTriggers, 2, 75);
      if (triggers) entry.purchaseTriggers = triggers;
    }
    if (Object.keys(entry).length > 0) out.push(entry);
    if (out.length >= limit) break;
  }
  return out;
}

function compactMarketingGoalsForContent(
  goals: readonly unknown[],
  tier: 'full' | 'lean' | 'minimal',
): Record<string, unknown>[] {
  const limit = tier === 'minimal' ? 3 : tier === 'lean' ? 4 : 6;
  const out: Record<string, unknown>[] = [];
  for (const raw of goals) {
    if (!isRecord(raw) || raw.approved === false) continue;
    const entry: Record<string, unknown> = {};
    const title = trimSentenceBounded(asTrimmedString(raw.title), 85);
    if (title) entry.title = title;
    const audience = trimSentenceBounded(asTrimmedString(raw.targetAudience), 65);
    if (audience && tier !== 'minimal') entry.targetAudience = audience;
    const metrics = trimStringArray(raw.successMetrics, tier === 'minimal' ? 1 : 2, 75);
    if (metrics) entry.metrics = metrics;
    if (tier === 'full') {
      const desc = trimSentenceBounded(asTrimmedString(raw.description), 115);
      if (desc) entry.description = desc;
      const timeframe = trimSentenceBounded(asTrimmedString(raw.recommendedTimeframe), 45);
      if (timeframe) entry.timeframe = timeframe;
    }
    if (Object.keys(entry).length > 0) out.push(entry);
    if (out.length >= limit) break;
  }
  return out;
}

function compactMarketingObjectivesForContent(
  objectives: readonly unknown[],
  tier: 'full' | 'lean' | 'minimal',
): Record<string, unknown>[] {
  const sorted = sortByStrategicPriority(objectives.filter(isRecord));
  const limit = tier === 'minimal' ? 4 : tier === 'lean' ? 6 : 8;
  const out: Record<string, unknown>[] = [];
  for (const raw of sorted) {
    if (!isRecord(raw) || raw.approved === false) continue;
    const entry: Record<string, unknown> = {};
    const title = trimSentenceBounded(asTrimmedString(raw.title), 85);
    if (title) entry.title = title;
    const priority = asTrimmedString(raw.priority);
    if (priority) entry.priority = priority;
    const goal = trimSentenceBounded(asTrimmedString(raw.supportingGoalTitle), 70);
    if (goal) entry.goal = goal;
    if (tier !== 'minimal') {
      const outcome = trimSentenceBounded(asTrimmedString(raw.intendedBusinessOutcome), 95);
      if (outcome) entry.outcome = outcome;
      const audience = trimSentenceBounded(asTrimmedString(raw.targetAudience), 60);
      if (audience) entry.audience = audience;
    }
    if (tier === 'full') {
      const criteria = trimSentenceBounded(asTrimmedString(raw.measurementCriteria), 90);
      if (criteria) entry.measurement = criteria;
    }
    if (Object.keys(entry).length > 0) out.push(entry);
    if (out.length >= limit) break;
  }
  return out;
}

function compactMarketingChannelsForContent(
  channels: readonly unknown[],
  tier: 'full' | 'lean' | 'minimal',
): Record<string, unknown>[] {
  const sorted = sortChannelsByPriority(channels.filter(isRecord));
  const limit = tier === 'minimal' ? 4 : tier === 'lean' ? 6 : 8;
  const out: Record<string, unknown>[] = [];
  for (const raw of sorted) {
    if (!isRecord(raw) || raw.approved === false) continue;
    const entry: Record<string, unknown> = {};
    const name = trimSentenceBounded(asTrimmedString(raw.channelName), 55);
    if (name) entry.channel = name;
    const priority = asTrimmedString(raw.priority);
    if (priority) entry.priority = priority;
    const audience = trimSentenceBounded(asTrimmedString(raw.relevantAudience), 65);
    if (audience) entry.audience = audience;
    const obj = trimSentenceBounded(asTrimmedString(raw.supportingObjectiveTitle), 70);
    if (obj) entry.objective = obj;
    if (tier !== 'minimal') {
      const use = trimSentenceBounded(asTrimmedString(raw.recommendedUse), tier === 'lean' ? 95 : 140);
      if (use) entry.recommendedUse = use;
    }
    if (tier === 'full') {
      const contrib = trimSentenceBounded(asTrimmedString(raw.expectedContribution), 100);
      if (contrib) entry.expectedContribution = contrib;
    }
    if (Object.keys(entry).length > 0) out.push(entry);
    if (out.length >= limit) break;
  }
  return out;
}

function compactMarketingTacticsForContent(
  tactics: readonly unknown[],
  tier: 'full' | 'lean' | 'minimal',
): Record<string, unknown>[] {
  const sorted = sortByStrategicPriority(tactics.filter(isRecord));
  const limit = tier === 'minimal' ? 5 : tier === 'lean' ? 7 : 10;
  const out: Record<string, unknown>[] = [];
  for (const raw of sorted) {
    if (!isRecord(raw) || raw.approved === false) continue;
    const entry: Record<string, unknown> = {};
    const name = trimSentenceBounded(asTrimmedString(raw.tacticName), 75);
    if (name) entry.tactic = name;
    const channel = trimSentenceBounded(asTrimmedString(raw.recommendedChannelName), 50);
    if (channel) entry.channel = channel;
    const freq = trimSentenceBounded(asTrimmedString(raw.suggestedFrequency), 50);
    if (freq) entry.frequency = freq;
    const priority = asTrimmedString(raw.priority);
    if (priority) entry.priority = priority;
    if (tier !== 'minimal') {
      const obj = trimSentenceBounded(asTrimmedString(raw.supportingObjectiveTitle), 65);
      if (obj) entry.objective = obj;
      const audience = trimSentenceBounded(asTrimmedString(raw.targetAudience), 60);
      if (audience) entry.audience = audience;
    }
    if (tier === 'full') {
      const desc = trimSentenceBounded(asTrimmedString(raw.description), 110);
      if (desc) entry.description = desc;
    }
    if (Object.keys(entry).length > 0) out.push(entry);
    if (out.length >= limit) break;
  }
  return out;
}

function compactMarketingKpisForContent(
  kpis: readonly unknown[],
  tier: 'full' | 'lean' | 'minimal',
): Record<string, unknown>[] {
  const limit = tier === 'minimal' ? 5 : tier === 'lean' ? 7 : 10;
  const out: Record<string, unknown>[] = [];
  for (const raw of kpis) {
    if (!isRecord(raw) || raw.approved === false) continue;
    const entry: Record<string, unknown> = {};
    const name = trimSentenceBounded(asTrimmedString(raw.kpiName), 70);
    if (name) entry.kpi = name;
    const cls = asTrimmedString(raw.classification);
    if (cls) entry.classification = cls;
    const obj = trimSentenceBounded(asTrimmedString(raw.relatedObjectiveTitle), 70);
    if (obj) entry.objective = obj;
    if (tier !== 'minimal') {
      const what = trimSentenceBounded(asTrimmedString(raw.whatItMeasures), 95);
      if (what) entry.measures = what;
      const freq = trimSentenceBounded(asTrimmedString(raw.reportingFrequency), 40);
      if (freq) entry.frequency = freq;
    }
    if (tier === 'full') {
      const method = trimSentenceBounded(asTrimmedString(raw.measurementMethod), 85);
      if (method) entry.method = method;
    }
    if (Object.keys(entry).length > 0) out.push(entry);
    if (out.length >= limit) break;
  }
  return out;
}

function compactMarketingRoadmapForContent(
  roadmap: readonly unknown[],
  tier: 'full' | 'lean' | 'minimal',
): Record<string, unknown>[] {
  const sorted = sortByStrategicPriority(roadmap.filter(isRecord));
  const limit = tier === 'minimal' ? 4 : tier === 'lean' ? 6 : 8;
  const out: Record<string, unknown>[] = [];
  for (const raw of sorted) {
    if (!isRecord(raw) || raw.approved === false) continue;
    const entry: Record<string, unknown> = {};
    const phase = trimSentenceBounded(asTrimmedString(raw.phase), 45);
    if (phase) entry.phase = phase;
    const activity = trimSentenceBounded(asTrimmedString(raw.activity), 75);
    if (activity) entry.activity = activity;
    const channel = trimSentenceBounded(asTrimmedString(raw.channel), 45);
    if (channel) entry.channel = channel;
    const timeframe = trimSentenceBounded(asTrimmedString(raw.suggestedTimeframe), 45);
    if (timeframe && tier !== 'minimal') entry.timeframe = timeframe;
    const priority = asTrimmedString(raw.priority);
    if (priority) entry.priority = priority;
    if (Object.keys(entry).length > 0) out.push(entry);
    if (out.length >= limit) break;
  }
  return out;
}

export function projectCompactMessagingForGovernance(
  content: Record<string, unknown>,
  tier: 'full' | 'lean' | 'minimal',
): Record<string, unknown> {
  const summary = isRecord(content.approvedSummary) ? content.approvedSummary : content;
  const out: Record<string, unknown> = {};

  const cvp = trimSentenceBounded(
    asTrimmedString(summary.coreValueProposition) ||
      (isRecord(summary.coreValueProposition)
        ? asTrimmedString(summary.coreValueProposition.statement)
        : ''),
    tier === 'minimal' ? 140 : 210,
  );
  if (cvp) out.coreValueProposition = cvp;

  const voiceSrc = isRecord(summary.voiceAndTone) ? summary.voiceAndTone : null;
  if (voiceSrc) {
    const voice: Record<string, unknown> = {};
    const attrs = trimStringArray(voiceSrc.attributes, tier === 'minimal' ? 3 : 5, 55);
    if (attrs) voice.attributes = attrs;
    const guardrails = trimStringArray(
      voiceSrc.guardrails,
      tier === 'minimal' ? 3 : 5,
      tier === 'minimal' ? 75 : 110,
    );
    if (guardrails) voice.guardrails = guardrails;
    const notes = trimSentenceBounded(asTrimmedString(voiceSrc.toneNotes), 120);
    if (notes && tier !== 'minimal') voice.toneNotes = notes;
    if (Object.keys(voice).length > 0) out.voiceAndTone = voice;
  }

  const rawPillars = Array.isArray(summary.messagingPillars)
    ? summary.messagingPillars
    : isRecord(summary.messagingPillars) && Array.isArray(summary.messagingPillars.pillars)
      ? summary.messagingPillars.pillars
      : [];
  const pillars = rawPillars
    .filter((p): p is Record<string, unknown> => isRecord(p))
    .slice(0, tier === 'minimal' ? 3 : 5)
    .map((p) => {
      const title = trimSentenceBounded(asTrimmedString(p.title), 65);
      const sum = tier === 'minimal' ? '' : trimSentenceBounded(asTrimmedString(p.summary), 100);
      return sum ? `${title}: ${sum}` : title;
    })
    .filter(Boolean);
  if (pillars.length > 0) out.messagingPillars = pillars;

  if (tier === 'full') {
    const rawAngles = Array.isArray(summary.audienceAngles)
      ? summary.audienceAngles
      : isRecord(summary.audienceAngles) && Array.isArray(summary.audienceAngles.angles)
        ? summary.audienceAngles.angles
        : [];
    const angles = rawAngles
      .filter((a): a is Record<string, unknown> => isRecord(a))
      .slice(0, 3)
      .map((a) => ({
        audience: trimSentenceBounded(asTrimmedString(a.audience), 55),
        message: trimSentenceBounded(asTrimmedString(a.message), 95),
      }))
      .filter((a) => a.audience && a.message);
    if (angles.length > 0) out.audienceAngles = angles;
  }

  return out;
}

export function projectContentSupplementalFoundation(
  content: Record<string, unknown>,
  includeIdentity = true,
): Record<string, unknown> {
  const base = projectCompactBrandFoundation(content);
  if (!includeIdentity) return base;
  const summary = isRecord(content.approvedSummary) ? content.approvedSummary : content;
  const out: Record<string, unknown> = { ...base };
  const purpose = trimSentenceBounded(
    asTrimmedString(summary.purpose) ||
      (isRecord(summary.purpose) ? asTrimmedString(summary.purpose.statement) : ''),
    160,
  );
  if (purpose) out.purpose = purpose;
  const rawValues = Array.isArray(summary.coreValues)
    ? summary.coreValues
    : isRecord(summary.coreValues) && Array.isArray(summary.coreValues.attributes)
      ? summary.coreValues.attributes
      : [];
  const coreValues = trimStringArray(rawValues, 5, 55);
  if (coreValues) out.coreValues = coreValues;
  return out;
}

export function projectContentSupplementalMessaging(
  content: Record<string, unknown>,
  mode: 'full' | 'voice_and_value' | 'value_only',
): Record<string, unknown> {
  if (mode === 'value_only') {
    return projectCompactBrandMessaging(content, { valuePropOnly: true });
  }
  const base = projectCompactBrandMessaging(content);
  if (mode === 'voice_and_value') {
    const summary = isRecord(content.approvedSummary) ? content.approvedSummary : content;
    const out: Record<string, unknown> = {};
    if (base.coreValueProposition) out.coreValueProposition = base.coreValueProposition;
    if (base.voiceAttributes) out.voiceAttributes = base.voiceAttributes;
    const voiceSrc = isRecord(summary.voiceAndTone) ? summary.voiceAndTone : null;
    if (voiceSrc) {
      const guardrails = trimStringArray(voiceSrc.guardrails, 4, 95);
      if (guardrails) out.voiceGuardrails = guardrails;
    }
    return out;
  }
  return projectCompactMessagingForGovernance(content, 'full');
}

function compactOptionalTextField(value: string | undefined, maxChars: number): string {
  if (!value || value === 'Not provided') return 'Not provided';
  const cleaned = trimSentenceBounded(value, maxChars);
  return cleaned || 'Not provided';
}

function compactContentProfileFields(
  vars: Record<string, string>,
  limits: {
    businessDescription?: number;
    productsOrServices?: number;
    targetMarket?: number;
    contentConstraints?: number;
    additionalNotes?: number;
  },
): void {
  if (limits.businessDescription && vars.businessDescription) {
    vars.businessDescription = trimSentenceBounded(
      vars.businessDescription,
      limits.businessDescription,
    );
  }
  if (limits.productsOrServices && vars.productsOrServices) {
    vars.productsOrServices = trimSentenceBounded(
      vars.productsOrServices,
      limits.productsOrServices,
    );
  }
  if (limits.targetMarket && vars.targetMarket) {
    vars.targetMarket = trimSentenceBounded(vars.targetMarket, limits.targetMarket);
  }
  if (limits.contentConstraints && vars.contentConstraints) {
    vars.contentConstraints = compactOptionalTextField(
      vars.contentConstraints,
      limits.contentConstraints,
    );
  }
  if (limits.additionalNotes && vars.additionalNotes) {
    vars.additionalNotes = compactOptionalTextField(vars.additionalNotes, limits.additionalNotes);
  }
}

function serializeOrFallback(items: Record<string, unknown>[], fallback = '[]'): string {
  return items.length > 0 ? JSON.stringify(items) : fallback;
}

function optimizeWithTiers(
  definition: PromptDefinition,
  compiledSystemInstructions: string,
  baseVars: Record<string, string>,
  applyTier: (vars: Record<string, string>, tier: 'full' | 'lean' | 'minimal' | 'ultra') => void,
): Record<string, string> {
  const tiers: Array<'full' | 'lean' | 'minimal' | 'ultra'> = [
    'full',
    'lean',
    'minimal',
    'ultra',
  ];

  let candidate = { ...baseVars };
  for (const tier of tiers) {
    candidate = { ...baseVars };
    applyTier(candidate, tier);
    const len = measureCompiledPromptLength(definition, compiledSystemInstructions, candidate);
    if (len <= CONTENT_STRATEGY_PROMPT_TARGET_BUDGET) {
      return candidate;
    }
  }
  return candidate;
}

// ============================================================================
// 6 PROMPT-SPECIFIC DETERMINISTIC BUDGET OPTIMIZERS
// ============================================================================

export function optimizeContentObjectivesVariables(
  definition: PromptDefinition,
  verifiedContext: VerifiedBrandContext,
  compiledSystemInstructions: string,
  resolvedVariables: Record<string, string>,
): Record<string, string> {
  const { personas, interests } = extractVerifiedCustomerLists(verifiedContext);
  const goals = extractVerifiedMarketingList(verifiedContext, 'goals');
  const objectives = extractVerifiedMarketingList(verifiedContext, 'objectives');

  return optimizeWithTiers(definition, compiledSystemInstructions, resolvedVariables, (vars, tier) => {
    const t = tier === 'ultra' ? 'minimal' : tier;
    vars.approvedMarketingGoals = serializeOrFallback(compactMarketingGoalsForContent(goals, t));
    vars.approvedMarketingObjectives = serializeOrFallback(
      compactMarketingObjectivesForContent(objectives, t),
    );
    vars.approvedCustomerPersonas = serializeOrFallback(compactPersonasForContent(personas, t));
    vars.approvedAudienceInterests = serializeOrFallback(compactInterestsForContent(interests, t));

    if (tier === 'full') {
      compactContentProfileFields(vars, {
        businessDescription: 360,
        productsOrServices: 240,
        targetMarket: 220,
        contentConstraints: 380,
        additionalNotes: 240,
      });
    } else if (tier === 'lean') {
      compactContentProfileFields(vars, {
        businessDescription: 260,
        productsOrServices: 180,
        targetMarket: 160,
        contentConstraints: 280,
        additionalNotes: 140,
      });
    } else if (tier === 'minimal') {
      compactContentProfileFields(vars, {
        businessDescription: 180,
        productsOrServices: 130,
        targetMarket: 120,
        contentConstraints: 200,
        additionalNotes: 80,
      });
    } else {
      // Ultra tier: keep top 2 goals, 3 objectives, 2 personas, 3 interests as valid JSON
      vars.approvedMarketingGoals = serializeOrFallback(
        compactMarketingGoalsForContent(goals, 'minimal').slice(0, 2),
      );
      vars.approvedMarketingObjectives = serializeOrFallback(
        compactMarketingObjectivesForContent(objectives, 'minimal').slice(0, 3),
      );
      vars.approvedCustomerPersonas = serializeOrFallback(
        compactPersonasForContent(personas, 'minimal').slice(0, 2),
      );
      vars.approvedAudienceInterests = serializeOrFallback(
        compactInterestsForContent(interests, 'minimal').slice(0, 3),
      );
      compactContentProfileFields(vars, {
        businessDescription: 140,
        productsOrServices: 100,
        targetMarket: 100,
        contentConstraints: 140,
        additionalNotes: 60,
      });
    }
  });
}

export function optimizeContentPillarsVariables(
  definition: PromptDefinition,
  verifiedContext: VerifiedBrandContext,
  compiledSystemInstructions: string,
  resolvedVariables: Record<string, string>,
): Record<string, string> {
  const { personas, interests } = extractVerifiedCustomerLists(verifiedContext);
  const mktObjectives = extractVerifiedMarketingList(verifiedContext, 'objectives');
  const contentObjectives = extractVerifiedContentList(verifiedContext, 'objectives');

  return optimizeWithTiers(definition, compiledSystemInstructions, resolvedVariables, (vars, tier) => {
    const t = tier === 'ultra' ? 'minimal' : tier;
    vars.approvedContentObjectives = serializeOrFallback(
      compactContentObjectives(contentObjectives, t),
    );
    vars.approvedMarketingObjectives = serializeOrFallback(
      compactMarketingObjectivesForContent(mktObjectives, t),
    );
    vars.approvedCustomerPersonas = serializeOrFallback(compactPersonasForContent(personas, t));
    vars.approvedAudienceInterests = serializeOrFallback(compactInterestsForContent(interests, t));

    if (tier === 'full') {
      compactContentProfileFields(vars, {
        productsOrServices: 240,
        targetMarket: 220,
        contentConstraints: 360,
        additionalNotes: 220,
      });
    } else if (tier === 'lean') {
      compactContentProfileFields(vars, {
        productsOrServices: 170,
        targetMarket: 160,
        contentConstraints: 260,
        additionalNotes: 120,
      });
    } else if (tier === 'minimal') {
      compactContentProfileFields(vars, {
        productsOrServices: 120,
        targetMarket: 120,
        contentConstraints: 180,
        additionalNotes: 80,
      });
    } else {
      vars.approvedContentObjectives = serializeOrFallback(
        compactContentObjectives(contentObjectives, 'minimal').slice(0, 3),
      );
      vars.approvedMarketingObjectives = serializeOrFallback(
        compactMarketingObjectivesForContent(mktObjectives, 'minimal').slice(0, 3),
      );
      vars.approvedCustomerPersonas = serializeOrFallback(
        compactPersonasForContent(personas, 'minimal').slice(0, 2),
      );
      vars.approvedAudienceInterests = serializeOrFallback(
        compactInterestsForContent(interests, 'minimal').slice(0, 3),
      );
      compactContentProfileFields(vars, {
        productsOrServices: 100,
        targetMarket: 100,
        contentConstraints: 140,
        additionalNotes: 60,
      });
    }
  });
}

export function optimizeContentThemesVariables(
  definition: PromptDefinition,
  verifiedContext: VerifiedBrandContext,
  compiledSystemInstructions: string,
  resolvedVariables: Record<string, string>,
): Record<string, string> {
  const { personas, interests } = extractVerifiedCustomerLists(verifiedContext);
  const mktObjectives = extractVerifiedMarketingList(verifiedContext, 'objectives');
  const pillars = extractVerifiedContentList(verifiedContext, 'pillars');

  return optimizeWithTiers(definition, compiledSystemInstructions, resolvedVariables, (vars, tier) => {
    const t = tier === 'ultra' ? 'minimal' : tier;
    vars.approvedContentPillars = serializeOrFallback(compactContentPillars(pillars, t));
    vars.approvedMarketingObjectives = serializeOrFallback(
      compactMarketingObjectivesForContent(mktObjectives, t),
    );
    vars.approvedCustomerPersonas = serializeOrFallback(compactPersonasForContent(personas, t));
    vars.approvedAudienceInterests = serializeOrFallback(compactInterestsForContent(interests, t));

    if (tier === 'full') {
      compactContentProfileFields(vars, {
        targetMarket: 200,
        contentConstraints: 340,
        additionalNotes: 200,
      });
    } else if (tier === 'lean') {
      compactContentProfileFields(vars, {
        targetMarket: 150,
        contentConstraints: 240,
        additionalNotes: 120,
      });
    } else if (tier === 'minimal') {
      compactContentProfileFields(vars, {
        targetMarket: 110,
        contentConstraints: 180,
        additionalNotes: 75,
      });
    } else {
      vars.approvedContentPillars = serializeOrFallback(
        compactContentPillars(pillars, 'minimal').slice(0, 4),
      );
      vars.approvedMarketingObjectives = serializeOrFallback(
        compactMarketingObjectivesForContent(mktObjectives, 'minimal').slice(0, 3),
      );
      vars.approvedCustomerPersonas = serializeOrFallback(
        compactPersonasForContent(personas, 'minimal').slice(0, 2),
      );
      vars.approvedAudienceInterests = serializeOrFallback(
        compactInterestsForContent(interests, 'minimal').slice(0, 3),
      );
      compactContentProfileFields(vars, {
        targetMarket: 95,
        contentConstraints: 130,
        additionalNotes: 60,
      });
    }
  });
}

export function optimizeContentFormatsVariables(
  definition: PromptDefinition,
  verifiedContext: VerifiedBrandContext,
  compiledSystemInstructions: string,
  resolvedVariables: Record<string, string>,
): Record<string, string> {
  const { personas } = extractVerifiedCustomerLists(verifiedContext);
  const channels = extractVerifiedMarketingList(verifiedContext, 'channels');
  const tactics = extractVerifiedMarketingList(verifiedContext, 'tactics');
  const pillars = extractVerifiedContentList(verifiedContext, 'pillars');
  const themes = extractVerifiedContentList(verifiedContext, 'themes');

  return optimizeWithTiers(definition, compiledSystemInstructions, resolvedVariables, (vars, tier) => {
    const t = tier === 'ultra' ? 'minimal' : tier;
    vars.approvedContentPillars = serializeOrFallback(compactContentPillars(pillars, t));
    vars.approvedContentThemes =
      themes.length > 0
        ? serializeOrFallback(compactContentThemes(themes, t))
        : 'Not provided';
    vars.approvedMarketingChannels = serializeOrFallback(
      compactMarketingChannelsForContent(channels, t),
    );
    vars.approvedMarketingTactics = serializeOrFallback(
      compactMarketingTacticsForContent(tactics, t),
    );
    vars.approvedCustomerPersonas = serializeOrFallback(compactPersonasForContent(personas, t));

    if (tier === 'full') {
      compactContentProfileFields(vars, {
        targetMarket: 200,
        contentConstraints: 360,
        additionalNotes: 180,
      });
    } else if (tier === 'lean') {
      compactContentProfileFields(vars, {
        targetMarket: 150,
        contentConstraints: 260,
        additionalNotes: 120,
      });
    } else if (tier === 'minimal') {
      compactContentProfileFields(vars, {
        targetMarket: 110,
        contentConstraints: 180,
        additionalNotes: 75,
      });
    } else {
      vars.approvedContentPillars = serializeOrFallback(
        compactContentPillars(pillars, 'minimal').slice(0, 4),
      );
      vars.approvedContentThemes =
        themes.length > 0
          ? serializeOrFallback(compactContentThemes(themes, 'minimal').slice(0, 4))
          : 'Not provided';
      vars.approvedMarketingChannels = serializeOrFallback(
        compactMarketingChannelsForContent(channels, 'minimal').slice(0, 4),
      );
      vars.approvedMarketingTactics = serializeOrFallback(
        compactMarketingTacticsForContent(tactics, 'minimal').slice(0, 4),
      );
      vars.approvedCustomerPersonas = serializeOrFallback(
        compactPersonasForContent(personas, 'minimal').slice(0, 2),
      );
      compactContentProfileFields(vars, {
        targetMarket: 95,
        contentConstraints: 140,
        additionalNotes: 60,
      });
    }
  });
}

export function optimizeContentDistributionVariables(
  definition: PromptDefinition,
  verifiedContext: VerifiedBrandContext,
  compiledSystemInstructions: string,
  resolvedVariables: Record<string, string>,
): Record<string, string> {
  const channels = extractVerifiedMarketingList(verifiedContext, 'channels');
  const tactics = extractVerifiedMarketingList(verifiedContext, 'tactics');
  const roadmap = extractVerifiedMarketingList(verifiedContext, 'roadmapItems');
  const pillars = extractVerifiedContentList(verifiedContext, 'pillars');
  const formats = extractVerifiedContentList(verifiedContext, 'formats');
  const series = extractVerifiedContentList(verifiedContext, 'series');

  return optimizeWithTiers(definition, compiledSystemInstructions, resolvedVariables, (vars, tier) => {
    const t = tier === 'ultra' ? 'minimal' : tier;
    vars.approvedMarketingChannels = serializeOrFallback(
      compactMarketingChannelsForContent(channels, t),
    );
    vars.approvedMarketingTactics = serializeOrFallback(
      compactMarketingTacticsForContent(tactics, t),
    );
    vars.approvedMarketingRoadmap =
      roadmap.length > 0
        ? serializeOrFallback(compactMarketingRoadmapForContent(roadmap, t))
        : 'Not provided';
    vars.approvedContentPillars = serializeOrFallback(compactContentPillars(pillars, t));
    vars.approvedContentFormats =
      formats.length > 0
        ? serializeOrFallback(compactContentFormats(formats, t))
        : 'Not provided';
    vars.approvedContentSeries =
      series.length > 0
        ? serializeOrFallback(compactContentSeries(series, t))
        : 'Not provided';

    if (tier === 'full') {
      compactContentProfileFields(vars, {
        targetMarket: 180,
        contentConstraints: 380,
        additionalNotes: 180,
      });
    } else if (tier === 'lean') {
      compactContentProfileFields(vars, {
        targetMarket: 140,
        contentConstraints: 280,
        additionalNotes: 110,
      });
    } else if (tier === 'minimal') {
      compactContentProfileFields(vars, {
        targetMarket: 105,
        contentConstraints: 200,
        additionalNotes: 75,
      });
    } else {
      vars.approvedMarketingChannels = serializeOrFallback(
        compactMarketingChannelsForContent(channels, 'minimal').slice(0, 4),
      );
      vars.approvedMarketingTactics = serializeOrFallback(
        compactMarketingTacticsForContent(tactics, 'minimal').slice(0, 4),
      );
      vars.approvedMarketingRoadmap =
        roadmap.length > 0
          ? serializeOrFallback(compactMarketingRoadmapForContent(roadmap, 'minimal').slice(0, 3))
          : 'Not provided';
      vars.approvedContentPillars = serializeOrFallback(
        compactContentPillars(pillars, 'minimal').slice(0, 4),
      );
      vars.approvedContentFormats =
        formats.length > 0
          ? serializeOrFallback(compactContentFormats(formats, 'minimal').slice(0, 4))
          : 'Not provided';
      vars.approvedContentSeries =
        series.length > 0
          ? serializeOrFallback(compactContentSeries(series, 'minimal').slice(0, 3))
          : 'Not provided';
      compactContentProfileFields(vars, {
        targetMarket: 90,
        contentConstraints: 150,
        additionalNotes: 60,
      });
    }
  });
}

export function optimizeContentGovernanceVariables(
  definition: PromptDefinition,
  verifiedContext: VerifiedBrandContext,
  compiledSystemInstructions: string,
  resolvedVariables: Record<string, string>,
): Record<string, string> {
  const messagingMod = verifiedContext.approvedStrategyModules.brandMessaging;
  const messagingContent = messagingMod?.content ?? {};
  const mktObjectives = extractVerifiedMarketingList(verifiedContext, 'objectives');
  const kpis = extractVerifiedMarketingList(verifiedContext, 'kpis');
  const pillars = extractVerifiedContentList(verifiedContext, 'pillars');
  const contentObjectives = extractVerifiedContentList(verifiedContext, 'objectives');
  const distribution = extractVerifiedContentList(verifiedContext, 'distribution');

  return optimizeWithTiers(definition, compiledSystemInstructions, resolvedVariables, (vars, tier) => {
    const t = tier === 'ultra' ? 'minimal' : tier;
    const compactMessaging = projectCompactMessagingForGovernance(messagingContent, t);
    vars.approvedBrandMessaging =
      Object.keys(compactMessaging).length > 0
        ? JSON.stringify(compactMessaging)
        : vars.approvedBrandMessaging;
    vars.approvedMarketingObjectives = serializeOrFallback(
      compactMarketingObjectivesForContent(mktObjectives, t),
    );
    vars.approvedMarketingKpis = serializeOrFallback(compactMarketingKpisForContent(kpis, t));
    vars.approvedContentPillars = serializeOrFallback(compactContentPillars(pillars, t));
    vars.approvedContentObjectives =
      contentObjectives.length > 0
        ? serializeOrFallback(compactContentObjectives(contentObjectives, t))
        : 'Not provided';
    vars.approvedContentDistribution =
      distribution.length > 0
        ? serializeOrFallback(compactContentDistribution(distribution, t))
        : 'Not provided';

    if (tier === 'full') {
      compactContentProfileFields(vars, {
        contentConstraints: 360,
        additionalNotes: 180,
      });
    } else if (tier === 'lean') {
      compactContentProfileFields(vars, {
        contentConstraints: 260,
        additionalNotes: 110,
      });
    } else if (tier === 'minimal') {
      compactContentProfileFields(vars, {
        contentConstraints: 180,
        additionalNotes: 75,
      });
    } else {
      vars.approvedMarketingObjectives = serializeOrFallback(
        compactMarketingObjectivesForContent(mktObjectives, 'minimal').slice(0, 3),
      );
      vars.approvedMarketingKpis = serializeOrFallback(
        compactMarketingKpisForContent(kpis, 'minimal').slice(0, 4),
      );
      vars.approvedContentPillars = serializeOrFallback(
        compactContentPillars(pillars, 'minimal').slice(0, 4),
      );
      vars.approvedContentObjectives =
        contentObjectives.length > 0
          ? serializeOrFallback(compactContentObjectives(contentObjectives, 'minimal').slice(0, 3))
          : 'Not provided';
      vars.approvedContentDistribution =
        distribution.length > 0
          ? serializeOrFallback(compactContentDistribution(distribution, 'minimal').slice(0, 3))
          : 'Not provided';
      compactContentProfileFields(vars, {
        contentConstraints: 140,
        additionalNotes: 60,
      });
    }
  });
}

export function optimizeContentStrategyPromptVariables(
  definition: PromptDefinition,
  verifiedContext: VerifiedBrandContext,
  compiledSystemInstructions: string,
  resolvedVariables: Record<string, string>,
): Record<string, string> {
  switch (definition.promptId) {
    case 'content_strategy_objectives':
      return optimizeContentObjectivesVariables(
        definition,
        verifiedContext,
        compiledSystemInstructions,
        resolvedVariables,
      );
    case 'content_strategy_pillars':
      return optimizeContentPillarsVariables(
        definition,
        verifiedContext,
        compiledSystemInstructions,
        resolvedVariables,
      );
    case 'content_strategy_themes':
      return optimizeContentThemesVariables(
        definition,
        verifiedContext,
        compiledSystemInstructions,
        resolvedVariables,
      );
    case 'content_strategy_formats':
      return optimizeContentFormatsVariables(
        definition,
        verifiedContext,
        compiledSystemInstructions,
        resolvedVariables,
      );
    case 'content_strategy_distribution':
      return optimizeContentDistributionVariables(
        definition,
        verifiedContext,
        compiledSystemInstructions,
        resolvedVariables,
      );
    case 'content_strategy_governance':
      return optimizeContentGovernanceVariables(
        definition,
        verifiedContext,
        compiledSystemInstructions,
        resolvedVariables,
      );
    default:
      return resolvedVariables;
  }
}

/**
 * Builds lean, prompt-specific supplemental context projections for Content Strategy prompts
 * so `contextPayload` stays strictly under ENGINE_MAX_CONTEXT_LENGTH (24,000 chars)
 * without duplicating already-interpolated variables or dumping raw upstream modules.
 */
export function projectContentStrategySupplementalModule(
  promptId: ContentStrategyPromptId,
  moduleKey: string,
  modContent: Record<string, unknown>,
): Record<string, unknown> | null {
  if (moduleKey === 'brandFoundation') {
    const includeIdentity =
      promptId === 'content_strategy_objectives' ||
      promptId === 'content_strategy_pillars' ||
      promptId === 'content_strategy_governance';
    const projected = projectContentSupplementalFoundation(modContent, includeIdentity);
    return Object.keys(projected).length > 0 ? projected : null;
  }

  if (moduleKey === 'brandMessaging') {
    const mode =
      promptId === 'content_strategy_pillars'
        ? 'full'
        : promptId === 'content_strategy_objectives' ||
            promptId === 'content_strategy_themes' ||
            promptId === 'content_strategy_formats' ||
            promptId === 'content_strategy_distribution'
          ? 'voice_and_value'
          : 'value_only';
    const projected = projectContentSupplementalMessaging(modContent, mode);
    return Object.keys(projected).length > 0 ? projected : null;
  }

  // Never dump raw unprojected customerIntelligence, marketingStrategy, or contentStrategy
  // into supplementalApprovedModules when a Content Strategy prompt didn't request them.
  if (
    moduleKey === 'customerIntelligence' ||
    moduleKey === 'marketingStrategy' ||
    moduleKey === 'contentStrategy'
  ) {
    return null;
  }

  const cleaned = cleanValueForCompactPrompt(modContent, 3);
  return isRecord(cleaned) && Object.keys(cleaned).length > 0 ? cleaned : null;
}
