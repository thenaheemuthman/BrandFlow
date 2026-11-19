import type {
  PromptDefinition,
  VerifiedBrandContext,
} from './types.ts';

export const MARKETING_STRATEGY_PROMPT_TARGET_BUDGET = 10_800;

export type ApprovedRecordKind =
  | 'persona'
  | 'interest'
  | 'goal'
  | 'objective'
  | 'channel'
  | 'tactic'
  | 'kpi'
  | 'roadmap'
  | 'generic';

const INTERNAL_METADATA_KEYS = new Set<string>([
  'id',
  'approved',
  'approvedAt',
  'source',
  'aiHypothesisNote',
  'linkedPersonaIds',
  'supportingGoalId',
  'supportingObjectiveId',
  'recommendedChannelId',
  'relatedObjectiveId',
  'suggestionStatus',
]);

const ENTITY_ALLOWED_FIELDS: Record<Exclude<ApprovedRecordKind, 'generic'>, readonly string[]> = {
  persona: [
    'name',
    'roleOrSegment',
    'summary',
    'goals',
    'painPoints',
    'motivations',
    'objections',
    'purchasingTriggers',
    'decisionFactors',
    'informationSources',
    'communicationPreferences',
    'demographics',
  ],
  interest: [
    'topic',
    'problemsToSolve',
    'contentConsumed',
    'searchTopics',
    'purchaseTriggers',
    'frequentQuestions',
    'productOrServiceInterests',
    'concernsOrObjections',
    'seasonalOrSituationalInterests',
  ],
  goal: [
    'title',
    'description',
    'strategicRationale',
    'targetAudience',
    'supportingBusinessObjective',
    'successMetrics',
    'targetValue',
    'measurementPeriod',
    'recommendedTimeframe',
  ],
  objective: [
    'title',
    'priority',
    'supportingGoalTitle',
    'intendedBusinessOutcome',
    'targetAudience',
    'measurementCriteria',
    'description',
  ],
  channel: [
    'channelName',
    'priority',
    'supportingObjectiveTitle',
    'relevantAudience',
    'strategicRationale',
    'recommendedUse',
    'expectedContribution',
  ],
  tactic: [
    'tacticName',
    'priority',
    'recommendedChannelName',
    'supportingObjectiveTitle',
    'targetAudience',
    'suggestedFrequency',
    'successMetric',
    'description',
    'executionGuidance',
  ],
  kpi: [
    'kpiName',
    'classification',
    'relatedObjectiveTitle',
    'whatItMeasures',
    'measurementMethod',
    'reportingFrequency',
    'baselineNote',
  ],
  roadmap: [
    'phase',
    'activity',
    'priority',
    'supportingObjectiveTitle',
    'channel',
    'suggestedTimeframe',
    'dependencies',
    'successIndicator',
    'decisionInputNeeded',
  ],
};

const PRIORITY_RANK: Record<string, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

const CHANNEL_PRIORITY_RANK: Record<string, number> = {
  primary: 0,
  secondary: 1,
  experimental: 2,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function cleanValueForCompactPrompt(value: unknown, maxArrayItems?: number): unknown {
  if (value === null || value === undefined) return undefined;
  if (typeof value === 'string') {
    const trimmed = value.replace(/\s+/g, ' ').trim();
    return trimmed || undefined;
  }
  if (typeof value === 'boolean' || typeof value === 'number') {
    return value;
  }
  if (Array.isArray(value)) {
    const seen = new Set<string>();
    const cleaned: unknown[] = [];
    for (const entry of value) {
      const next = cleanValueForCompactPrompt(entry);
      if (next === undefined) continue;
      if (typeof next === 'string') {
        const dedupeKey = next.toLowerCase();
        if (seen.has(dedupeKey)) continue;
        seen.add(dedupeKey);
      }
      cleaned.push(next);
      if (typeof maxArrayItems === 'number' && cleaned.length >= maxArrayItems) {
        break;
      }
    }
    return cleaned.length > 0 ? cleaned : undefined;
  }
  if (isRecord(value)) {
    const obj: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      if (INTERNAL_METADATA_KEYS.has(k)) continue;
      const next = cleanValueForCompactPrompt(v);
      if (next !== undefined) {
        obj[k] = next;
      }
    }
    return Object.keys(obj).length > 0 ? obj : undefined;
  }
  return undefined;
}

export interface CompactApprovedListOptions {
  kind?: ApprovedRecordKind;
  fields?: readonly string[];
  maxArrayItems?: number;
}

/**
 * Compacts approved strategy records for prompt interpolation:
 * - Excludes any explicitly unapproved records (`approved === false`)
 * - Removes internal metadata/UUIDs and empty strings/arrays/objects
 * - Deduplicates repeated array strings case-insensitively
 * - Preserves strategic fields and human-readable relationships
 */
export function compactApprovedList(
  items: readonly unknown[],
  options: CompactApprovedListOptions = {},
): Record<string, unknown>[] {
  const kind = options.kind ?? 'generic';
  const explicitFields =
    options.fields ?? (kind !== 'generic' ? ENTITY_ALLOWED_FIELDS[kind] : undefined);

  const compacted: Record<string, unknown>[] = [];

  for (const rawItem of items) {
    if (!isRecord(rawItem)) continue;
    // Defense-in-depth: never serialize explicitly unapproved records.
    if (rawItem.approved === false) continue;

    const clean: Record<string, unknown> = {};
    const keysToVisit = explicitFields ?? Object.keys(rawItem);

    for (const key of keysToVisit) {
      if (INTERNAL_METADATA_KEYS.has(key)) continue;
      if (key === 'demographicsRelevant') continue;
      if (key === 'demographics' && rawItem.demographicsRelevant === false) continue;

      const cleanedVal = cleanValueForCompactPrompt(rawItem[key], options.maxArrayItems);
      if (cleanedVal !== undefined) {
        clean[key] = cleanedVal;
      }
    }

    if (Object.keys(clean).length > 0) {
      compacted.push(clean);
    }
  }

  return compacted;
}

export function extractVerifiedCustomerLists(verifiedContext: VerifiedBrandContext): {
  personas: unknown[];
  interests: unknown[];
} {
  const customerIntelMod = verifiedContext.approvedStrategyModules.customerIntelligence;
  if (!customerIntelMod || !isRecord(customerIntelMod.content)) {
    return { personas: [], interests: [] };
  }
  const summaryPersonas =
    isRecord(customerIntelMod.content.approvedSummary) &&
    Array.isArray(customerIntelMod.content.approvedSummary.personas)
      ? customerIntelMod.content.approvedSummary.personas
      : null;
  const directPersonas = Array.isArray(customerIntelMod.content.personas)
    ? customerIntelMod.content.personas
    : null;

  const summaryInterests =
    isRecord(customerIntelMod.content.approvedSummary) &&
    Array.isArray(customerIntelMod.content.approvedSummary.interests)
      ? customerIntelMod.content.approvedSummary.interests
      : null;
  const directInterests = Array.isArray(customerIntelMod.content.interests)
    ? customerIntelMod.content.interests
    : null;

  return {
    personas: summaryPersonas ?? directPersonas ?? [],
    interests: summaryInterests ?? directInterests ?? [],
  };
}

export function extractVerifiedMarketingList(
  verifiedContext: VerifiedBrandContext,
  field: 'goals' | 'objectives' | 'channels' | 'tactics',
): unknown[] {
  const marketingMod = verifiedContext.approvedStrategyModules.marketingStrategy;
  if (!marketingMod || !isRecord(marketingMod.content)) return [];
  const summaryList =
    isRecord(marketingMod.content.approvedSummary) &&
    Array.isArray(marketingMod.content.approvedSummary[field])
      ? marketingMod.content.approvedSummary[field]
      : null;
  const directList = Array.isArray(marketingMod.content[field])
    ? marketingMod.content[field]
    : null;
  return summaryList ?? directList ?? [];
}

export function renderPromptWithVariables(
  definition: PromptDefinition,
  compiledSystemInstructions: string,
  resolvedVariables: Record<string, string>,
): { compiledUserPrompt: string; combinedPromptText: string } {
  const compiledUserPrompt = definition.userPromptTemplate.replace(
    /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g,
    (_fullMatch, key: string) => resolvedVariables[key] ?? 'Not provided',
  );
  const combinedPromptText = `${compiledSystemInstructions}\n\n${compiledUserPrompt}`.trim();
  return { compiledUserPrompt, combinedPromptText };
}

export function measureCompiledPromptLength(
  definition: PromptDefinition,
  compiledSystemInstructions: string,
  vars: Record<string, string>,
): number {
  return renderPromptWithVariables(definition, compiledSystemInstructions, vars)
    .combinedPromptText.length;
}

export function sortByStrategicPriority(
  records: Record<string, unknown>[],
): Record<string, unknown>[] {
  return [...records].sort((a, b) => {
    const rankA = PRIORITY_RANK[String(a.priority ?? '').toLowerCase()] ?? 3;
    const rankB = PRIORITY_RANK[String(b.priority ?? '').toLowerCase()] ?? 3;
    return rankA - rankB;
  });
}

export function sortChannelsByPriority(
  records: Record<string, unknown>[],
): Record<string, unknown>[] {
  return [...records].sort((a, b) => {
    const rankA = CHANNEL_PRIORITY_RANK[String(a.priority ?? '').toLowerCase()] ?? 3;
    const rankB = CHANNEL_PRIORITY_RANK[String(b.priority ?? '').toLowerCase()] ?? 3;
    return rankA - rankB;
  });
}

export function trimSentenceBounded(text: string, maxChars: number): string {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxChars) return normalized;
  const slice = normalized.slice(0, maxChars);
  const lastSentence = Math.max(
    slice.lastIndexOf('. '),
    slice.lastIndexOf('; '),
    slice.lastIndexOf(' | '),
  );
  if (lastSentence >= Math.floor(maxChars * 0.55)) {
    return slice.slice(0, lastSentence + 1).trim();
  }
  const lastSpace = slice.lastIndexOf(' ');
  return (lastSpace > 40 ? slice.slice(0, lastSpace) : slice).trim();
}

/**
 * Reorders pipe-delimited `businessConstraints` segments by prompt-specific priority
 * (e.g. Known Baselines first for KPIs; Target Timeline & Team Capacity first for Roadmap)
 * and trims cleanly at segment/sentence boundaries when over budget.
 */
export function compactBusinessConstraints(
  raw: string,
  preferredPrefixes: readonly string[],
  maxChars: number,
): string {
  const normalized = raw.replace(/\s+/g, ' ').trim();
  if (!normalized || normalized === 'Not provided') return normalized;
  if (normalized.length <= maxChars) return normalized;

  const segments = normalized
    .split(/\s*\|\s*/)
    .map((s) => s.trim())
    .filter(Boolean);

  if (segments.length <= 1) {
    return trimSentenceBounded(normalized, maxChars);
  }

  const ordered = [...segments].sort((a, b) => {
    const rankOf = (seg: string) => {
      const lower = seg.toLowerCase();
      const idx = preferredPrefixes.findIndex((p) => lower.startsWith(p.toLowerCase()));
      return idx === -1 ? preferredPrefixes.length : idx;
    };
    return rankOf(a) - rankOf(b);
  });

  const kept: string[] = [];
  let used = 0;
  for (const seg of ordered) {
    const separatorLen = kept.length > 0 ? 3 : 0;
    const remaining = maxChars - used - separatorLen;
    if (remaining < 48) break;
    const piece = seg.length <= remaining ? seg : trimSentenceBounded(seg, remaining);
    if (!piece) continue;
    kept.push(piece);
    used += separatorLen + piece.length;
  }

  return kept.length > 0 ? kept.join(' | ') : trimSentenceBounded(ordered[0], maxChars);
}

function assignCompactedJson(
  vars: Record<string, string>,
  key: string,
  records: readonly unknown[],
): void {
  if (records.length > 0) {
    vars[key] = JSON.stringify(records);
  }
}

function trimOptionalTextVars(
  vars: Record<string, string>,
  keys: readonly string[],
  maxChars: number,
): void {
  for (const key of keys) {
    if (vars[key] && vars[key] !== 'Not provided' && vars[key].length > maxChars) {
      vars[key] = trimSentenceBounded(vars[key], maxChars);
    }
  }
}

function trimRecordStrings(
  records: Record<string, unknown>[],
  fieldLimits: Record<string, number>,
): Record<string, unknown>[] {
  return records.map((rec) => {
    const next: Record<string, unknown> = { ...rec };
    for (const [field, limit] of Object.entries(fieldLimits)) {
      const val = next[field];
      if (typeof val === 'string' && val.length > limit) {
        next[field] = trimSentenceBounded(val, limit);
      } else if (Array.isArray(val)) {
        next[field] = val.map((item) =>
          typeof item === 'string' && item.length > limit
            ? trimSentenceBounded(item, limit)
            : item,
        );
      }
    }
    return next;
  });
}

/**
 * Backfills missing human-readable `supportingGoalTitle` on approved objectives
 * using `supportingGoalId` before internal IDs are stripped during compaction.
 */
export function enrichObjectivesWithGoalTitles(
  rawObjectives: readonly unknown[],
  rawGoals: readonly unknown[],
): unknown[] {
  const goalTitleById = new Map<string, string>();
  for (const goal of rawGoals) {
    if (!isRecord(goal) || goal.approved === false) continue;
    const id = typeof goal.id === 'string' ? goal.id.trim() : '';
    const title = typeof goal.title === 'string' ? goal.title.trim() : '';
    if (id && title) {
      goalTitleById.set(id, title);
    }
  }

  return rawObjectives.map((obj) => {
    if (!isRecord(obj)) return obj;
    const existingGoalTitle =
      typeof obj.supportingGoalTitle === 'string' ? obj.supportingGoalTitle.trim() : '';
    const goalId = typeof obj.supportingGoalId === 'string' ? obj.supportingGoalId.trim() : '';
    if (!existingGoalTitle && goalId && goalTitleById.has(goalId)) {
      return { ...obj, supportingGoalTitle: goalTitleById.get(goalId) };
    }
    return obj;
  });
}

/**
 * Backfills missing human-readable `supportingObjectiveTitle` on approved channels
 * using `supportingObjectiveId` before internal IDs are stripped.
 */
export function enrichChannelsWithObjectiveTitles(
  rawChannels: readonly unknown[],
  rawObjectives: readonly unknown[],
): unknown[] {
  const objectiveTitleById = new Map<string, string>();
  for (const obj of rawObjectives) {
    if (!isRecord(obj) || obj.approved === false) continue;
    const id = typeof obj.id === 'string' ? obj.id.trim() : '';
    const title = typeof obj.title === 'string' ? obj.title.trim() : '';
    if (id && title) {
      objectiveTitleById.set(id, title);
    }
  }

  return rawChannels.map((ch) => {
    if (!isRecord(ch)) return ch;
    const existingTitle =
      typeof ch.supportingObjectiveTitle === 'string' ? ch.supportingObjectiveTitle.trim() : '';
    const objId =
      typeof ch.supportingObjectiveId === 'string' ? ch.supportingObjectiveId.trim() : '';
    if (!existingTitle && objId && objectiveTitleById.has(objId)) {
      return { ...ch, supportingObjectiveTitle: objectiveTitleById.get(objId) };
    }
    return ch;
  });
}

/**
 * Backfills missing human-readable `supportingObjectiveTitle` and `recommendedChannelName`
 * on approved tactics before internal IDs are stripped.
 */
export function enrichTacticsWithRelations(
  rawTactics: readonly unknown[],
  rawObjectives: readonly unknown[],
  rawChannels: readonly unknown[],
): unknown[] {
  const objectiveTitleById = new Map<string, string>();
  for (const obj of rawObjectives) {
    if (!isRecord(obj) || obj.approved === false) continue;
    const id = typeof obj.id === 'string' ? obj.id.trim() : '';
    const title = typeof obj.title === 'string' ? obj.title.trim() : '';
    if (id && title) {
      objectiveTitleById.set(id, title);
    }
  }

  const channelNameById = new Map<string, string>();
  for (const ch of rawChannels) {
    if (!isRecord(ch) || ch.approved === false) continue;
    const id = typeof ch.id === 'string' ? ch.id.trim() : '';
    const name = typeof ch.channelName === 'string' ? ch.channelName.trim() : '';
    if (id && name) {
      channelNameById.set(id, name);
    }
  }

  return rawTactics.map((tactic) => {
    if (!isRecord(tactic)) return tactic;
    let patched: Record<string, unknown> = tactic;
    const existingObjTitle =
      typeof tactic.supportingObjectiveTitle === 'string'
        ? tactic.supportingObjectiveTitle.trim()
        : '';
    const objId =
      typeof tactic.supportingObjectiveId === 'string' ? tactic.supportingObjectiveId.trim() : '';
    if (!existingObjTitle && objId && objectiveTitleById.has(objId)) {
      patched = { ...patched, supportingObjectiveTitle: objectiveTitleById.get(objId) };
    }

    const existingChName =
      typeof tactic.recommendedChannelName === 'string'
        ? tactic.recommendedChannelName.trim()
        : '';
    const chId =
      typeof tactic.recommendedChannelId === 'string' ? tactic.recommendedChannelId.trim() : '';
    if (!existingChName && chId && channelNameById.has(chId)) {
      patched = { ...patched, recommendedChannelName: channelNameById.get(chId) };
    }
    return patched;
  });
}

function prioritizeGoalsByLinkedObjectives(
  goals: Record<string, unknown>[],
  objectives: Record<string, unknown>[],
): Record<string, unknown>[] {
  const linkedGoalTitles = new Set<string>(
    objectives
      .map((o) =>
        typeof o.supportingGoalTitle === 'string' ? o.supportingGoalTitle.toLowerCase() : '',
      )
      .filter(Boolean),
  );
  return [...goals].sort((a, b) => {
    const aLinked = linkedGoalTitles.has(String(a.title ?? '').toLowerCase()) ? 0 : 1;
    const bLinked = linkedGoalTitles.has(String(b.title ?? '').toLowerCase()) ? 0 : 1;
    return aLinked - bLinked;
  });
}

// ============================================================================
// SHARED SUPPLEMENTAL MODULE PROJECTIONS (FOR `buildApprovedContextPayload`)
// ============================================================================

export function projectCompactBrandFoundation(
  content: Record<string, unknown>,
): Record<string, unknown> {
  const summary = isRecord(content.approvedSummary) ? content.approvedSummary : null;
  const positioningObj = isRecord(content.positioning) ? content.positioning : null;
  const positioning = cleanValueForCompactPrompt(
    summary?.positioningStatement ??
      summary?.positioning ??
      positioningObj?.statement ??
      (typeof content.positioning === 'string' ? content.positioning : undefined) ??
      content.positioningStatement,
  );
  const differentiationAttributes = cleanValueForCompactPrompt(
    summary?.differentiationAttributes ?? positioningObj?.differentiationAttributes,
    5,
  );
  const projected: Record<string, unknown> = {};
  if (positioning) projected.positioning = positioning;
  if (differentiationAttributes) projected.differentiationAttributes = differentiationAttributes;
  return projected;
}

export function projectCompactBrandMessaging(
  content: Record<string, unknown>,
  options?: { valuePropOnly?: boolean },
): Record<string, unknown> {
  const summary = isRecord(content.approvedSummary) ? content.approvedSummary : null;
  const cvpObj = isRecord(content.coreValueProposition) ? content.coreValueProposition : null;

  const projected: Record<string, unknown> = {};
  const coreValueProposition = cleanValueForCompactPrompt(
    summary?.coreValueProposition ?? cvpObj?.statement ?? content.coreValueProposition,
  );
  if (coreValueProposition) projected.coreValueProposition = coreValueProposition;

  if (options?.valuePropOnly) {
    return projected;
  }

  const pillarsSource = Array.isArray(summary?.messagingPillars)
    ? summary.messagingPillars
    : isRecord(content.messagingPillars) && Array.isArray(content.messagingPillars.pillars)
      ? content.messagingPillars.pillars
      : [];
  const voiceSource = isRecord(summary?.voiceAndTone)
    ? summary.voiceAndTone
    : isRecord(content.voiceAndTone)
      ? content.voiceAndTone
      : null;
  const anglesSource = Array.isArray(summary?.audienceAngles)
    ? summary.audienceAngles
    : isRecord(content.audienceAngles) && Array.isArray(content.audienceAngles.angles)
      ? content.audienceAngles.angles
      : [];

  const pillars = compactApprovedList(pillarsSource, {
    fields: ['title', 'summary'],
  });
  if (pillars.length > 0) projected.messagingPillars = pillars;

  if (voiceSource) {
    const voice: Record<string, unknown> = {};
    const attributes = cleanValueForCompactPrompt(voiceSource.attributes, 6);
    const guardrails = cleanValueForCompactPrompt(voiceSource.guardrails, 4);
    if (attributes) voice.attributes = attributes;
    if (guardrails) voice.guardrails = guardrails;
    if (Object.keys(voice).length > 0) projected.voiceAndTone = voice;
  }

  const audienceAngles = compactApprovedList(anglesSource, {
    fields: ['audience', 'message'],
  });
  if (audienceAngles.length > 0) projected.audienceAngles = audienceAngles;

  return projected;
}

export function projectCompactCustomerMeasurementCues(
  verifiedContext: VerifiedBrandContext,
): Record<string, unknown> {
  const { personas } = extractVerifiedCustomerLists(verifiedContext);
  const compactPersonas = compactApprovedList(personas, {
    kind: 'persona',
    fields: ['name', 'roleOrSegment'],
  });
  const personaLabels = compactPersonas
    .map((p) => {
      const name = typeof p.name === 'string' ? p.name : '';
      const role = typeof p.roleOrSegment === 'string' ? p.roleOrSegment : '';
      return role && !name.toLowerCase().includes(role.toLowerCase()) ? `${name} (${role})` : name;
    })
    .filter(Boolean)
    .slice(0, 6);

  return personaLabels.length > 0 ? { approvedTargetPersonas: personaLabels } : {};
}

export function projectExistingApprovedStrategyTitles(
  verifiedContext: VerifiedBrandContext,
): Record<string, unknown> {
  const goals = compactApprovedList(extractVerifiedMarketingList(verifiedContext, 'goals'), {
    kind: 'goal',
    fields: ['title', 'recommendedTimeframe'],
  }).slice(0, 6);
  const objectives = sortByStrategicPriority(
    compactApprovedList(extractVerifiedMarketingList(verifiedContext, 'objectives'), {
      kind: 'objective',
      fields: ['title', 'priority'],
    }),
  ).slice(0, 8);

  const projected: Record<string, unknown> = {};
  if (goals.length > 0) projected.existingApprovedGoals = goals;
  if (objectives.length > 0) projected.existingApprovedObjectives = objectives;
  return projected;
}

// ============================================================================
// 1. GOALS & OBJECTIVES OPTIMIZER (`marketing_strategy_goals_objectives`)
// ============================================================================

/**
 * Priority order preserved under budget pressure:
 *   1. Verified brand positioning & value proposition (in supplementalApprovedModules) + core brand profile
 *   2. Approved customer personas
 *   3. Approved audience interests
 *   4. Business constraints & planning notes
 *   5. Existing approved goals/objectives (compact titles in supplementalApprovedModules)
 */
export function optimizeGoalsObjectivesVariables(
  definition: PromptDefinition,
  verifiedContext: VerifiedBrandContext,
  compiledSystemInstructions: string,
  resolvedVariables: Record<string, string>,
): Record<string, string> {
  const vars = { ...resolvedVariables };
  const { personas: rawPersonas, interests: rawInterests } =
    extractVerifiedCustomerLists(verifiedContext);

  const currentLength = () =>
    measureCompiledPromptLength(definition, compiledSystemInstructions, vars);

  // Tier 1 (Default compact profile — drops low-signal/redundant persona & interest prose)
  const tier1Personas = compactApprovedList(rawPersonas, {
    kind: 'persona',
    fields: [
      'name',
      'roleOrSegment',
      'summary',
      'goals',
      'painPoints',
      'purchasingTriggers',
      'decisionFactors',
      'informationSources',
      'demographics',
    ],
  });
  assignCompactedJson(vars, 'approvedCustomerPersonas', tier1Personas);

  const tier1Interests = compactApprovedList(rawInterests, {
    kind: 'interest',
    fields: [
      'topic',
      'problemsToSolve',
      'purchaseTriggers',
      'productOrServiceInterests',
      'frequentQuestions',
      'concernsOrObjections',
    ],
  });
  assignCompactedJson(vars, 'approvedAudienceInterests', tier1Interests);

  if (currentLength() <= MARKETING_STRATEGY_PROMPT_TARGET_BUDGET) {
    return vars;
  }

  // Stage 1 — Trim secondary optional prose first while protecting personas/interests & planning constraints
  trimOptionalTextVars(vars, ['additionalNotes', 'competitors', 'marketingChallenges'], 240);
  if (vars.businessConstraints && vars.businessConstraints !== 'Not provided' && vars.businessConstraints.length > 420) {
    vars.businessConstraints = compactBusinessConstraints(
      vars.businessConstraints,
      ['Known Baselines:', 'Target Timeline:', 'Budget:', 'Team Capacity:', 'Additional Constraints:'],
      420,
    );
  }

  if (currentLength() <= MARKETING_STRATEGY_PROMPT_TARGET_BUDGET) {
    return vars;
  }

  // Stage 2 — Compact Audience Interests (Priority 3) before touching Personas (Priority 2)
  if (rawInterests.length > 0) {
    const tightInterests = compactApprovedList(rawInterests, {
      kind: 'interest',
      fields: ['topic', 'problemsToSolve', 'purchaseTriggers', 'productOrServiceInterests'],
      maxArrayItems: 2,
    });
    assignCompactedJson(vars, 'approvedAudienceInterests', tightInterests);

    if (currentLength() > MARKETING_STRATEGY_PROMPT_TARGET_BUDGET && tightInterests.length > 4) {
      for (const keepCount of [4, 3, 2]) {
        const primary = tightInterests.slice(0, keepCount);
        const remainingTopics = tightInterests
          .slice(keepCount)
          .map((item) => String(item.topic ?? '').trim())
          .filter(Boolean);
        assignCompactedJson(
          vars,
          'approvedAudienceInterests',
          remainingTopics.length > 0
            ? [...primary, { additionalApprovedTopics: remainingTopics.slice(0, 8) }]
            : primary,
        );
        if (currentLength() <= MARKETING_STRATEGY_PROMPT_TARGET_BUDGET) {
          return vars;
        }
      }
    }
  }

  if (currentLength() <= MARKETING_STRATEGY_PROMPT_TARGET_BUDGET) {
    return vars;
  }

  // Stage 3 — Compact Customer Personas (Priority 2) preserving core decision/goal/pain signals
  if (rawPersonas.length > 0) {
    const tightPersonas = compactApprovedList(rawPersonas, {
      kind: 'persona',
      fields: [
        'name',
        'roleOrSegment',
        'goals',
        'painPoints',
        'purchasingTriggers',
        'decisionFactors',
      ],
      maxArrayItems: 2,
    });
    assignCompactedJson(vars, 'approvedCustomerPersonas', tightPersonas);

    if (currentLength() > MARKETING_STRATEGY_PROMPT_TARGET_BUDGET && tightPersonas.length > 3) {
      for (const keepCount of [3, 2]) {
        const primary = tightPersonas.slice(0, keepCount);
        const remaining = tightPersonas.slice(keepCount).map((p) => {
          const minimal: Record<string, unknown> = { name: p.name };
          if (p.roleOrSegment) minimal.roleOrSegment = p.roleOrSegment;
          if (Array.isArray(p.goals) && p.goals[0]) minimal.primaryGoal = p.goals[0];
          if (Array.isArray(p.painPoints) && p.painPoints[0]) minimal.primaryPainPoint = p.painPoints[0];
          return minimal;
        });
        assignCompactedJson(vars, 'approvedCustomerPersonas', [...primary, ...remaining]);
        if (currentLength() <= MARKETING_STRATEGY_PROMPT_TARGET_BUDGET) {
          return vars;
        }
      }
    }
  }

  if (currentLength() <= MARKETING_STRATEGY_PROMPT_TARGET_BUDGET) {
    return vars;
  }

  // Stage 4 — Condense Audience Interests to topic + primary problem cue
  if (rawInterests.length > 0) {
    const topicCues = trimRecordStrings(
      compactApprovedList(rawInterests, {
        kind: 'interest',
        fields: ['topic', 'problemsToSolve'],
        maxArrayItems: 1,
      }),
      { topic: 110, problemsToSolve: 110 },
    );
    const topInterests = topicCues.slice(0, 3);
    const otherTopics = topicCues
      .slice(3)
      .map((i) => String(i.topic ?? '').trim())
      .filter(Boolean)
      .slice(0, 8);
    assignCompactedJson(
      vars,
      'approvedAudienceInterests',
      otherTopics.length > 0
        ? [...topInterests, { additionalApprovedTopics: otherTopics }]
        : topInterests,
    );
  }

  if (currentLength() <= MARKETING_STRATEGY_PROMPT_TARGET_BUDGET) {
    return vars;
  }

  // Stage 5 — Condense Personas to concise structured decision profiles + trim optional prose further
  if (rawPersonas.length > 0) {
    const minimalPersonas = trimRecordStrings(
      compactApprovedList(rawPersonas, {
        kind: 'persona',
        fields: ['name', 'roleOrSegment', 'goals', 'painPoints'],
        maxArrayItems: 1,
      }),
      { name: 90, roleOrSegment: 80, goals: 110, painPoints: 110 },
    );
    const topPersonas = minimalPersonas.slice(0, 4);
    const otherNames = minimalPersonas
      .slice(4)
      .map((p) => String(p.name ?? '').trim())
      .filter(Boolean)
      .slice(0, 8);
    assignCompactedJson(
      vars,
      'approvedCustomerPersonas',
      otherNames.length > 0
        ? [...topPersonas, { additionalApprovedPersonas: otherNames }]
        : topPersonas,
    );
  }

  if (currentLength() > MARKETING_STRATEGY_PROMPT_TARGET_BUDGET) {
    trimOptionalTextVars(vars, ['additionalNotes', 'competitors', 'marketingChallenges', 'businessGoals'], 160);
    if (vars.businessConstraints && vars.businessConstraints !== 'Not provided' && vars.businessConstraints.length > 260) {
      vars.businessConstraints = compactBusinessConstraints(
        vars.businessConstraints,
        ['Known Baselines:', 'Target Timeline:', 'Budget:', 'Team Capacity:'],
        260,
      );
    }
  }

  return vars;
}

// ============================================================================
// 2. CHANNELS & TACTICS OPTIMIZER (`marketing_strategy_channels_tactics`)
// ============================================================================

/**
 * Preserved existing targeted, deterministic, priority-ordered context budgeting for
 * `marketing_strategy_channels_tactics`.
 *
 * Priority order preserved under budget pressure:
 *   1. Approved marketing objectives (high -> medium -> low)
 *   2. Approved customer personas
 *   3. Approved audience interests
 *   4. Relevant brand positioning & messaging (in supplementalApprovedModules)
 *   5. Supporting context (approved marketing goals & optional profile notes)
 */
export function optimizeChannelsTacticsVariables(
  definition: PromptDefinition,
  verifiedContext: VerifiedBrandContext,
  compiledSystemInstructions: string,
  resolvedVariables: Record<string, string>,
): Record<string, string> {
  const vars = { ...resolvedVariables };

  const rawGoals = extractVerifiedMarketingList(verifiedContext, 'goals');
  const rawObjectives = extractVerifiedMarketingList(verifiedContext, 'objectives');
  const { personas: rawPersonas, interests: rawInterests } =
    extractVerifiedCustomerLists(verifiedContext);

  const enrichedRawObjectives = enrichObjectivesWithGoalTitles(rawObjectives, rawGoals);

  const sortedObjectivesFull = sortByStrategicPriority(
    compactApprovedList(enrichedRawObjectives, {
      kind: 'objective',
      fields: [
        'title',
        'priority',
        'supportingGoalTitle',
        'intendedBusinessOutcome',
        'targetAudience',
        'measurementCriteria',
      ],
    }),
  );

  // Tier 1 (Default targeted channels & tactics profile — excludes low-signal fields)
  assignCompactedJson(vars, 'approvedMarketingObjectives', sortedObjectivesFull);

  const tier1Goals = prioritizeGoalsByLinkedObjectives(
    compactApprovedList(rawGoals, {
      kind: 'goal',
      fields: ['title', 'targetAudience', 'strategicRationale'],
    }),
    sortedObjectivesFull,
  );
  assignCompactedJson(vars, 'approvedMarketingGoals', tier1Goals);

  const tier1Personas = compactApprovedList(rawPersonas, {
    kind: 'persona',
    fields: [
      'name',
      'roleOrSegment',
      'summary',
      'painPoints',
      'goals',
      'informationSources',
      'communicationPreferences',
      'purchasingTriggers',
      'decisionFactors',
      'demographics',
    ],
  });
  assignCompactedJson(vars, 'approvedCustomerPersonas', tier1Personas);

  const tier1Interests = compactApprovedList(rawInterests, {
    kind: 'interest',
    fields: [
      'topic',
      'problemsToSolve',
      'contentConsumed',
      'searchTopics',
      'purchaseTriggers',
    ],
  });
  assignCompactedJson(vars, 'approvedAudienceInterests', tier1Interests);

  const currentLength = () =>
    measureCompiledPromptLength(definition, compiledSystemInstructions, vars);

  if (currentLength() <= MARKETING_STRATEGY_PROMPT_TARGET_BUDGET) {
    return vars;
  }

  // Stage 1 (Priority 5 — Supporting Goals & optional text fields reduced first)
  if (tier1Goals.length > 0) {
    const compactGoals = prioritizeGoalsByLinkedObjectives(
      compactApprovedList(rawGoals, {
        kind: 'goal',
        fields: ['title', 'targetAudience'],
      }),
      sortedObjectivesFull,
    );
    assignCompactedJson(vars, 'approvedMarketingGoals', compactGoals);
  }
  trimOptionalTextVars(
    vars,
    ['additionalNotes', 'competitors', 'marketingChallenges', 'businessConstraints'],
    240,
  );

  if (currentLength() <= MARKETING_STRATEGY_PROMPT_TARGET_BUDGET) {
    return vars;
  }

  // Stage 2 (Priority 5 — Condense Goals to objective-linked titles + remaining goal titles)
  if (tier1Goals.length > 0) {
    const orderedGoalTitles = tier1Goals
      .map((g) => String(g.title ?? '').trim())
      .filter(Boolean);
    if (orderedGoalTitles.length > 0) {
      vars.approvedMarketingGoals = JSON.stringify(orderedGoalTitles.slice(0, 6));
    }
  }

  if (currentLength() <= MARKETING_STRATEGY_PROMPT_TARGET_BUDGET) {
    return vars;
  }

  // Stage 3 (Priority 3 — Deterministic Audience Interests compaction before touching Personas/Objectives)
  if (rawInterests.length > 0) {
    const tightInterests = compactApprovedList(rawInterests, {
      kind: 'interest',
      fields: ['topic', 'problemsToSolve', 'contentConsumed', 'searchTopics'],
      maxArrayItems: 2,
    });
    assignCompactedJson(vars, 'approvedAudienceInterests', tightInterests);

    if (currentLength() > MARKETING_STRATEGY_PROMPT_TARGET_BUDGET && tightInterests.length > 4) {
      for (const keepCount of [4, 3, 2]) {
        const primary = tightInterests.slice(0, keepCount);
        const remainingTopics = tightInterests
          .slice(keepCount)
          .map((item) => String(item.topic ?? '').trim())
          .filter(Boolean);
        const condensed =
          remainingTopics.length > 0
            ? [...primary, { additionalApprovedTopics: remainingTopics.slice(0, 8) }]
            : primary;
        assignCompactedJson(vars, 'approvedAudienceInterests', condensed);
        if (currentLength() <= MARKETING_STRATEGY_PROMPT_TARGET_BUDGET) {
          return vars;
        }
      }
    }
  }

  if (currentLength() <= MARKETING_STRATEGY_PROMPT_TARGET_BUDGET) {
    return vars;
  }

  // Stage 4 (Priority 2 — Deterministic Customer Personas compaction while keeping Objectives intact)
  if (rawPersonas.length > 0) {
    const tightPersonas = compactApprovedList(rawPersonas, {
      kind: 'persona',
      fields: [
        'name',
        'roleOrSegment',
        'painPoints',
        'goals',
        'informationSources',
        'purchasingTriggers',
      ],
      maxArrayItems: 2,
    });
    assignCompactedJson(vars, 'approvedCustomerPersonas', tightPersonas);

    if (currentLength() > MARKETING_STRATEGY_PROMPT_TARGET_BUDGET && tightPersonas.length > 3) {
      for (const keepCount of [3, 2]) {
        const primary = tightPersonas.slice(0, keepCount);
        const remaining = tightPersonas.slice(keepCount).map((p) => {
          const minimal: Record<string, unknown> = { name: p.name };
          if (p.roleOrSegment) minimal.roleOrSegment = p.roleOrSegment;
          if (p.informationSources) minimal.informationSources = p.informationSources;
          return minimal;
        });
        assignCompactedJson(vars, 'approvedCustomerPersonas', [...primary, ...remaining]);
        if (currentLength() <= MARKETING_STRATEGY_PROMPT_TARGET_BUDGET) {
          return vars;
        }
      }
    }

    if (currentLength() > MARKETING_STRATEGY_PROMPT_TARGET_BUDGET) {
      const minimalPersonas = compactApprovedList(rawPersonas, {
        kind: 'persona',
        fields: ['name', 'roleOrSegment', 'painPoints', 'informationSources'],
        maxArrayItems: 1,
      });
      assignCompactedJson(vars, 'approvedCustomerPersonas', minimalPersonas.slice(0, 4));
    }
  }

  if (currentLength() <= MARKETING_STRATEGY_PROMPT_TARGET_BUDGET) {
    return vars;
  }

  // Stage 5 (Priority 3 minimal — keep topic + search/content cues only if still under pressure)
  if (rawInterests.length > 0) {
    const topicCues = compactApprovedList(rawInterests, {
      kind: 'interest',
      fields: ['topic', 'contentConsumed'],
      maxArrayItems: 1,
    });
    const topInterests = topicCues.slice(0, 3);
    const otherTopics = topicCues
      .slice(3)
      .map((i) => String(i.topic ?? '').trim())
      .filter(Boolean)
      .slice(0, 6);
    assignCompactedJson(
      vars,
      'approvedAudienceInterests',
      otherTopics.length > 0
        ? [...topInterests, { additionalApprovedTopics: otherTopics }]
        : topInterests,
    );
  }

  if (currentLength() <= MARKETING_STRATEGY_PROMPT_TARGET_BUDGET) {
    return vars;
  }

  // Stage 6 (Priority 1 — Objectives protected until last; drop secondary criteria first, prioritize High -> Medium -> Low)
  if (sortedObjectivesFull.length > 0) {
    const coreObjectives = sortByStrategicPriority(
      compactApprovedList(enrichedRawObjectives, {
        kind: 'objective',
        fields: ['title', 'priority', 'supportingGoalTitle', 'intendedBusinessOutcome', 'targetAudience'],
      }),
    );
    assignCompactedJson(vars, 'approvedMarketingObjectives', coreObjectives);

    if (currentLength() > MARKETING_STRATEGY_PROMPT_TARGET_BUDGET) {
      const leanObjectives = coreObjectives.map((obj) => {
        const lean: Record<string, unknown> = {
          title: obj.title,
          priority: obj.priority,
        };
        if (obj.supportingGoalTitle) lean.supportingGoalTitle = obj.supportingGoalTitle;
        if (obj.intendedBusinessOutcome) {
          lean.intendedBusinessOutcome = trimSentenceBounded(
            String(obj.intendedBusinessOutcome),
            140,
          );
        }
        return lean;
      });
      assignCompactedJson(vars, 'approvedMarketingObjectives', leanObjectives);

      if (currentLength() > MARKETING_STRATEGY_PROMPT_TARGET_BUDGET && leanObjectives.length > 5) {
        const prioritizedCap = leanObjectives.slice(0, 8);
        assignCompactedJson(vars, 'approvedMarketingObjectives', prioritizedCap);
        if (currentLength() > MARKETING_STRATEGY_PROMPT_TARGET_BUDGET) {
          assignCompactedJson(
            vars,
            'approvedMarketingObjectives',
            leanObjectives.slice(0, 5).map((o) => ({
              title: o.title,
              priority: o.priority,
              ...(o.supportingGoalTitle ? { supportingGoalTitle: o.supportingGoalTitle } : {}),
            })),
          );
        }
      }
    }
  }

  return vars;
}

// ============================================================================
// 3. KPIS & MEASUREMENT OPTIMIZER (`marketing_strategy_kpis`)
// ============================================================================

/**
 * Priority order preserved under budget pressure:
 *   1. Approved marketing goals (title, successMetrics, targetValue, measurementPeriod, recommendedTimeframe)
 *   2. Approved marketing objectives (title, priority, supportingGoalTitle, measurementCriteria, intendedBusinessOutcome)
 *   3. Existing baseline information & measurement constraints (`businessConstraints`, Known Baselines prioritized)
 *   4. Approved marketing channels (measurement contribution & objective links only)
 *   5. Approved marketing tactics (metric, cadence, channel & objective links — excludes verbose executionGuidance/description)
 */
export function optimizeKpisVariables(
  definition: PromptDefinition,
  verifiedContext: VerifiedBrandContext,
  compiledSystemInstructions: string,
  resolvedVariables: Record<string, string>,
): Record<string, string> {
  const vars = { ...resolvedVariables };

  const rawGoals = extractVerifiedMarketingList(verifiedContext, 'goals');
  const rawObjectives = extractVerifiedMarketingList(verifiedContext, 'objectives');
  const rawChannels = extractVerifiedMarketingList(verifiedContext, 'channels');
  const rawTactics = extractVerifiedMarketingList(verifiedContext, 'tactics');

  const enrichedObjectives = enrichObjectivesWithGoalTitles(rawObjectives, rawGoals);
  const enrichedChannels = enrichChannelsWithObjectiveTitles(rawChannels, rawObjectives);
  const enrichedTactics = enrichTacticsWithRelations(rawTactics, rawObjectives, rawChannels);

  const currentLength = () =>
    measureCompiledPromptLength(definition, compiledSystemInstructions, vars);

  // Tier 1 (Measurement-focused projection — preserves every goal metric/target/timeframe & objective criteria,
  // removes lengthy tactical executionGuidance and channel rationales that do not drive KPI definitions)
  const tier1Objectives = sortByStrategicPriority(
    compactApprovedList(enrichedObjectives, {
      kind: 'objective',
      fields: [
        'title',
        'priority',
        'supportingGoalTitle',
        'measurementCriteria',
        'intendedBusinessOutcome',
      ],
    }),
  );
  assignCompactedJson(vars, 'approvedMarketingObjectives', tier1Objectives);

  const tier1Goals = prioritizeGoalsByLinkedObjectives(
    compactApprovedList(rawGoals, {
      kind: 'goal',
      fields: [
        'title',
        'successMetrics',
        'targetValue',
        'measurementPeriod',
        'recommendedTimeframe',
      ],
    }),
    tier1Objectives,
  );
  assignCompactedJson(vars, 'approvedMarketingGoals', tier1Goals);

  const tier1Channels = sortChannelsByPriority(
    compactApprovedList(enrichedChannels, {
      kind: 'channel',
      fields: ['channelName', 'priority', 'supportingObjectiveTitle', 'expectedContribution'],
    }),
  );
  assignCompactedJson(vars, 'approvedMarketingChannels', tier1Channels);

  const tier1Tactics = sortByStrategicPriority(
    compactApprovedList(enrichedTactics, {
      kind: 'tactic',
      fields: [
        'tacticName',
        'priority',
        'supportingObjectiveTitle',
        'recommendedChannelName',
        'suggestedFrequency',
        'successMetric',
      ],
    }),
  );
  assignCompactedJson(vars, 'approvedMarketingTactics', tier1Tactics);

  if (currentLength() <= MARKETING_STRATEGY_PROMPT_TARGET_BUDGET) {
    return vars;
  }

  // Stage 1 — Trim secondary prose while keeping Known Baselines in businessConstraints intact
  trimOptionalTextVars(vars, ['additionalNotes', 'marketingChallenges', 'businessGoals'], 220);

  if (currentLength() <= MARKETING_STRATEGY_PROMPT_TARGET_BUDGET) {
    return vars;
  }

  // Stage 2 — Compact Channels (keep name, priority, objective link) & Tactics (keep metric & links)
  if (tier1Channels.length > 0) {
    const leanChannels = sortChannelsByPriority(
      compactApprovedList(enrichedChannels, {
        kind: 'channel',
        fields: ['channelName', 'priority', 'supportingObjectiveTitle'],
      }),
    );
    assignCompactedJson(vars, 'approvedMarketingChannels', leanChannels);
  }

  if (currentLength() <= MARKETING_STRATEGY_PROMPT_TARGET_BUDGET) {
    return vars;
  }

  if (tier1Tactics.length > 0) {
    const leanTactics = trimRecordStrings(
      sortByStrategicPriority(
        compactApprovedList(enrichedTactics, {
          kind: 'tactic',
          fields: [
            'tacticName',
            'priority',
            'supportingObjectiveTitle',
            'recommendedChannelName',
            'successMetric',
          ],
        }),
      ),
      { tacticName: 110, successMetric: 120 },
    );
    assignCompactedJson(vars, 'approvedMarketingTactics', leanTactics);

    if (currentLength() > MARKETING_STRATEGY_PROMPT_TARGET_BUDGET && leanTactics.length > 5) {
      for (const keepCount of [6, 4]) {
        const primary = leanTactics.slice(0, keepCount);
        const remaining = leanTactics.slice(keepCount).map((t) => ({
          tacticName: t.tacticName,
          ...(t.successMetric ? { successMetric: t.successMetric } : {}),
        }));
        assignCompactedJson(
          vars,
          'approvedMarketingTactics',
          remaining.length > 0 ? [...primary, { additionalApprovedTactics: remaining.slice(0, 8) }] : primary,
        );
        if (currentLength() <= MARKETING_STRATEGY_PROMPT_TARGET_BUDGET) {
          return vars;
        }
      }
    }
  }

  if (currentLength() <= MARKETING_STRATEGY_PROMPT_TARGET_BUDGET) {
    return vars;
  }

  // Stage 3 — Condense Channels to prioritized names + objective links if still over budget
  if (tier1Channels.length > 4) {
    const topChannels = sortChannelsByPriority(
      compactApprovedList(enrichedChannels, {
        kind: 'channel',
        fields: ['channelName', 'priority', 'supportingObjectiveTitle'],
      }),
    );
    const primary = topChannels.slice(0, 4);
    const otherNames = topChannels
      .slice(4)
      .map((c) => String(c.channelName ?? '').trim())
      .filter(Boolean)
      .slice(0, 8);
    assignCompactedJson(
      vars,
      'approvedMarketingChannels',
      otherNames.length > 0
        ? [...primary, { additionalApprovedChannels: otherNames }]
        : primary,
    );
  }

  if (currentLength() <= MARKETING_STRATEGY_PROMPT_TARGET_BUDGET) {
    return vars;
  }

  // Stage 4 — Compact Objectives (keep title, priority, supportingGoalTitle, measurementCriteria)
  if (tier1Objectives.length > 0) {
    const tightObjectives = trimRecordStrings(
      sortByStrategicPriority(
        compactApprovedList(enrichedObjectives, {
          kind: 'objective',
          fields: ['title', 'priority', 'supportingGoalTitle', 'measurementCriteria'],
        }),
      ),
      { measurementCriteria: 150 },
    );
    assignCompactedJson(vars, 'approvedMarketingObjectives', tightObjectives);

    if (currentLength() > MARKETING_STRATEGY_PROMPT_TARGET_BUDGET && tightObjectives.length > 6) {
      const primary = tightObjectives.slice(0, 6);
      const remaining = tightObjectives.slice(6).map((o) => ({
        title: o.title,
        priority: o.priority,
        ...(o.supportingGoalTitle ? { supportingGoalTitle: o.supportingGoalTitle } : {}),
      }));
      assignCompactedJson(vars, 'approvedMarketingObjectives', [...primary, ...remaining.slice(0, 6)]);
    }
  }

  if (currentLength() <= MARKETING_STRATEGY_PROMPT_TARGET_BUDGET) {
    return vars;
  }

  // Stage 5 — Compact Goals while keeping titles, successMetrics, targetValue, measurementPeriod, recommendedTimeframe
  if (tier1Goals.length > 0) {
    const tightGoals = trimRecordStrings(
      prioritizeGoalsByLinkedObjectives(
        compactApprovedList(rawGoals, {
          kind: 'goal',
          fields: [
            'title',
            'successMetrics',
            'targetValue',
            'measurementPeriod',
            'recommendedTimeframe',
          ],
          maxArrayItems: 2,
        }),
        tier1Objectives,
      ),
      { targetValue: 130, measurementPeriod: 80, recommendedTimeframe: 80, successMetrics: 90 },
    );
    assignCompactedJson(vars, 'approvedMarketingGoals', tightGoals.slice(0, 6));
  }

  if (currentLength() <= MARKETING_STRATEGY_PROMPT_TARGET_BUDGET) {
    return vars;
  }

  // Stage 6 (Extreme stress — preserve Known Baselines first, condense tactics/channels/objectives cleanly)
  if (vars.businessConstraints && vars.businessConstraints !== 'Not provided' && vars.businessConstraints.length > 360) {
    vars.businessConstraints = compactBusinessConstraints(
      vars.businessConstraints,
      ['Known Baselines:', 'Target Timeline:', 'Budget:', 'Team Capacity:', 'Additional Constraints:'],
      360,
    );
  }
  trimOptionalTextVars(vars, ['additionalNotes', 'marketingChallenges', 'businessGoals'], 140);

  if (currentLength() > MARKETING_STRATEGY_PROMPT_TARGET_BUDGET && tier1Tactics.length > 0) {
    const minimalTactics = tier1Tactics.slice(0, 4).map((t) => ({
      tacticName: trimSentenceBounded(String(t.tacticName ?? ''), 90),
      supportingObjectiveTitle: t.supportingObjectiveTitle,
      successMetric: t.successMetric
        ? trimSentenceBounded(String(t.successMetric), 90)
        : undefined,
    }));
    assignCompactedJson(vars, 'approvedMarketingTactics', minimalTactics);
  }

  if (currentLength() > MARKETING_STRATEGY_PROMPT_TARGET_BUDGET && tier1Channels.length > 0) {
    const minimalChannels = tier1Channels.slice(0, 4).map((c) => ({
      channelName: trimSentenceBounded(String(c.channelName ?? ''), 80),
      priority: c.priority,
      supportingObjectiveTitle: c.supportingObjectiveTitle,
    }));
    assignCompactedJson(vars, 'approvedMarketingChannels', minimalChannels);
  }

  if (currentLength() > MARKETING_STRATEGY_PROMPT_TARGET_BUDGET && tier1Objectives.length > 0) {
    const minimalObjectives = tier1Objectives.slice(0, 5).map((o) => ({
      title: trimSentenceBounded(String(o.title ?? ''), 90),
      priority: o.priority,
      ...(o.supportingGoalTitle ? { supportingGoalTitle: trimSentenceBounded(String(o.supportingGoalTitle), 90) } : {}),
      ...(o.measurementCriteria ? { measurementCriteria: trimSentenceBounded(String(o.measurementCriteria), 100) } : {}),
    }));
    assignCompactedJson(vars, 'approvedMarketingObjectives', minimalObjectives);
  }

  return vars;
}

// ============================================================================
// 4. IMPLEMENTATION ROADMAP OPTIMIZER (`marketing_strategy_roadmap`)
// ============================================================================

/**
 * Priority order preserved under budget pressure:
 *   1. Approved marketing objectives (title, priority, supportingGoalTitle, intendedBusinessOutcome)
 *   2. Approved marketing goals (title, recommendedTimeframe, measurementPeriod, targetValue)
 *   3. Approved marketing channels (channelName, priority, supportingObjectiveTitle, recommendedUse)
 *   4. Approved marketing tactics (tacticName, priority, supportingObjectiveTitle, recommendedChannelName, description, suggestedFrequency, successMetric)
 *   5. Business constraints & planning windows (`businessConstraints`: Target Timeline, Team Capacity, Budget prioritized)
 */
export function optimizeRoadmapVariables(
  definition: PromptDefinition,
  verifiedContext: VerifiedBrandContext,
  compiledSystemInstructions: string,
  resolvedVariables: Record<string, string>,
): Record<string, string> {
  const vars = { ...resolvedVariables };

  const rawGoals = extractVerifiedMarketingList(verifiedContext, 'goals');
  const rawObjectives = extractVerifiedMarketingList(verifiedContext, 'objectives');
  const rawChannels = extractVerifiedMarketingList(verifiedContext, 'channels');
  const rawTactics = extractVerifiedMarketingList(verifiedContext, 'tactics');

  const enrichedObjectives = enrichObjectivesWithGoalTitles(rawObjectives, rawGoals);
  const enrichedChannels = enrichChannelsWithObjectiveTitles(rawChannels, rawObjectives);
  const enrichedTactics = enrichTacticsWithRelations(rawTactics, rawObjectives, rawChannels);

  const currentLength = () =>
    measureCompiledPromptLength(definition, compiledSystemInstructions, vars);

  // Tier 1 (Execution-sequencing projection — keeps objective links, goal timeframes, channel uses,
  // tactic descriptions/cadence/metrics/priorities; omits verbose rationale & step-by-step copywriting prose)
  const tier1Objectives = sortByStrategicPriority(
    compactApprovedList(enrichedObjectives, {
      kind: 'objective',
      fields: ['title', 'priority', 'supportingGoalTitle', 'intendedBusinessOutcome'],
    }),
  );
  assignCompactedJson(vars, 'approvedMarketingObjectives', tier1Objectives);

  const tier1Goals = prioritizeGoalsByLinkedObjectives(
    compactApprovedList(rawGoals, {
      kind: 'goal',
      fields: ['title', 'recommendedTimeframe', 'measurementPeriod', 'targetValue'],
    }),
    tier1Objectives,
  );
  assignCompactedJson(vars, 'approvedMarketingGoals', tier1Goals);

  const tier1Channels = sortChannelsByPriority(
    compactApprovedList(enrichedChannels, {
      kind: 'channel',
      fields: ['channelName', 'priority', 'supportingObjectiveTitle', 'recommendedUse'],
    }),
  );
  assignCompactedJson(vars, 'approvedMarketingChannels', tier1Channels);

  const tier1Tactics = sortByStrategicPriority(
    compactApprovedList(enrichedTactics, {
      kind: 'tactic',
      fields: [
        'tacticName',
        'priority',
        'supportingObjectiveTitle',
        'recommendedChannelName',
        'description',
        'suggestedFrequency',
        'successMetric',
      ],
    }),
  );
  assignCompactedJson(vars, 'approvedMarketingTactics', tier1Tactics);

  if (currentLength() <= MARKETING_STRATEGY_PROMPT_TARGET_BUDGET) {
    return vars;
  }

  // Stage 1 — Trim optional narrative fields while protecting businessConstraints (timeline/capacity/budget)
  trimOptionalTextVars(vars, ['additionalNotes', 'marketingChallenges'], 220);

  if (currentLength() <= MARKETING_STRATEGY_PROMPT_TARGET_BUDGET) {
    return vars;
  }

  // Stage 2 — Condense Goals to title + recommendedTimeframe (preserves goal relationships & planning windows)
  if (tier1Goals.length > 0) {
    const compactGoals = prioritizeGoalsByLinkedObjectives(
      compactApprovedList(rawGoals, {
        kind: 'goal',
        fields: ['title', 'recommendedTimeframe'],
      }),
      tier1Objectives,
    );
    assignCompactedJson(vars, 'approvedMarketingGoals', compactGoals);
  }

  if (currentLength() <= MARKETING_STRATEGY_PROMPT_TARGET_BUDGET) {
    return vars;
  }

  // Stage 3 — Compact Channels (keep channelName, priority, supportingObjectiveTitle, concise recommendedUse)
  if (tier1Channels.length > 0) {
    const compactChannels = trimRecordStrings(tier1Channels, { recommendedUse: 110 });
    assignCompactedJson(vars, 'approvedMarketingChannels', compactChannels);

    if (currentLength() > MARKETING_STRATEGY_PROMPT_TARGET_BUDGET) {
      const leanChannels = sortChannelsByPriority(
        compactApprovedList(enrichedChannels, {
          kind: 'channel',
          fields: ['channelName', 'priority', 'supportingObjectiveTitle'],
        }),
      );
      assignCompactedJson(vars, 'approvedMarketingChannels', leanChannels);
    }
  }

  if (currentLength() <= MARKETING_STRATEGY_PROMPT_TARGET_BUDGET) {
    return vars;
  }

  // Stage 4 — Compact Tactics (prioritize High -> Medium -> Low; preserve tactic description, channel, objective, frequency, metric)
  if (tier1Tactics.length > 0) {
    const trimmedTactics = trimRecordStrings(tier1Tactics, {
      description: 130,
      successMetric: 100,
      suggestedFrequency: 50,
    });
    assignCompactedJson(vars, 'approvedMarketingTactics', trimmedTactics);

    if (currentLength() > MARKETING_STRATEGY_PROMPT_TARGET_BUDGET && trimmedTactics.length > 5) {
      for (const keepCount of [6, 4]) {
        const primary = trimmedTactics.slice(0, keepCount);
        const remaining = trimmedTactics.slice(keepCount).map((t) => ({
          tacticName: t.tacticName,
          priority: t.priority,
          supportingObjectiveTitle: t.supportingObjectiveTitle,
          recommendedChannelName: t.recommendedChannelName,
          ...(t.suggestedFrequency ? { suggestedFrequency: t.suggestedFrequency } : {}),
        }));
        assignCompactedJson(vars, 'approvedMarketingTactics', [...primary, ...remaining.slice(0, 6)]);
        if (currentLength() <= MARKETING_STRATEGY_PROMPT_TARGET_BUDGET) {
          return vars;
        }
      }
    }
  }

  if (currentLength() <= MARKETING_STRATEGY_PROMPT_TARGET_BUDGET) {
    return vars;
  }

  // Stage 5 — Compact Objectives (preserve title, priority, supportingGoalTitle, concise outcome)
  if (tier1Objectives.length > 0) {
    const leanObjectives = trimRecordStrings(tier1Objectives, {
      intendedBusinessOutcome: 120,
    });
    assignCompactedJson(vars, 'approvedMarketingObjectives', leanObjectives);

    if (currentLength() > MARKETING_STRATEGY_PROMPT_TARGET_BUDGET && leanObjectives.length > 6) {
      const primary = leanObjectives.slice(0, 6);
      const remaining = leanObjectives.slice(6).map((o) => ({
        title: o.title,
        priority: o.priority,
        ...(o.supportingGoalTitle ? { supportingGoalTitle: o.supportingGoalTitle } : {}),
      }));
      assignCompactedJson(vars, 'approvedMarketingObjectives', [...primary, ...remaining.slice(0, 6)]);
    }
  }

  if (currentLength() <= MARKETING_STRATEGY_PROMPT_TARGET_BUDGET) {
    return vars;
  }

  // Stage 6 (Extreme stress — preserve timeline/capacity/budget constraints, top prioritized objectives/channels/tactics & links)
  if (vars.businessConstraints && vars.businessConstraints !== 'Not provided' && vars.businessConstraints.length > 360) {
    vars.businessConstraints = compactBusinessConstraints(
      vars.businessConstraints,
      ['Target Timeline:', 'Team Capacity:', 'Budget:', 'Additional Constraints:', 'Known Baselines:'],
      360,
    );
  }
  trimOptionalTextVars(vars, ['additionalNotes', 'marketingChallenges'], 140);

  if (currentLength() > MARKETING_STRATEGY_PROMPT_TARGET_BUDGET && tier1Tactics.length > 0) {
    const compactFinalTactics = tier1Tactics.slice(0, 5).map((t) => ({
      tacticName: trimSentenceBounded(String(t.tacticName ?? ''), 90),
      priority: t.priority,
      supportingObjectiveTitle: t.supportingObjectiveTitle,
      recommendedChannelName: t.recommendedChannelName,
      ...(t.description ? { description: trimSentenceBounded(String(t.description), 90) } : {}),
      ...(t.suggestedFrequency ? { suggestedFrequency: trimSentenceBounded(String(t.suggestedFrequency), 40) } : {}),
      ...(t.successMetric ? { successMetric: trimSentenceBounded(String(t.successMetric), 80) } : {}),
    }));
    assignCompactedJson(vars, 'approvedMarketingTactics', compactFinalTactics);
  }

  if (currentLength() > MARKETING_STRATEGY_PROMPT_TARGET_BUDGET && tier1Channels.length > 0) {
    const compactFinalChannels = tier1Channels.slice(0, 5).map((c) => ({
      channelName: trimSentenceBounded(String(c.channelName ?? ''), 80),
      priority: c.priority,
      supportingObjectiveTitle: c.supportingObjectiveTitle,
    }));
    assignCompactedJson(vars, 'approvedMarketingChannels', compactFinalChannels);
  }

  if (currentLength() > MARKETING_STRATEGY_PROMPT_TARGET_BUDGET && tier1Objectives.length > 0) {
    const compactFinalObjectives = tier1Objectives.slice(0, 5).map((o) => ({
      title: trimSentenceBounded(String(o.title ?? ''), 90),
      priority: o.priority,
      ...(o.supportingGoalTitle ? { supportingGoalTitle: trimSentenceBounded(String(o.supportingGoalTitle), 90) } : {}),
    }));
    assignCompactedJson(vars, 'approvedMarketingObjectives', compactFinalObjectives);
  }

  if (currentLength() > MARKETING_STRATEGY_PROMPT_TARGET_BUDGET && tier1Goals.length > 0) {
    const compactFinalGoals = tier1Goals.slice(0, 4).map((g) => ({
      title: trimSentenceBounded(String(g.title ?? ''), 90),
      ...(g.recommendedTimeframe ? { recommendedTimeframe: trimSentenceBounded(String(g.recommendedTimeframe), 60) } : {}),
    }));
    assignCompactedJson(vars, 'approvedMarketingGoals', compactFinalGoals);
  }

  return vars;
}

// ============================================================================
// DISPATCHER FOR ALL FOUR MARKETING STRATEGY PROMPTS
// ============================================================================

export function optimizeMarketingStrategyPromptVariables(
  definition: PromptDefinition,
  verifiedContext: VerifiedBrandContext,
  compiledSystemInstructions: string,
  resolvedVariables: Record<string, string>,
): Record<string, string> {
  switch (definition.promptId) {
    case 'marketing_strategy_goals_objectives':
      return optimizeGoalsObjectivesVariables(
        definition,
        verifiedContext,
        compiledSystemInstructions,
        resolvedVariables,
      );
    case 'marketing_strategy_channels_tactics':
      return optimizeChannelsTacticsVariables(
        definition,
        verifiedContext,
        compiledSystemInstructions,
        resolvedVariables,
      );
    case 'marketing_strategy_kpis':
      return optimizeKpisVariables(
        definition,
        verifiedContext,
        compiledSystemInstructions,
        resolvedVariables,
      );
    case 'marketing_strategy_roadmap':
      return optimizeRoadmapVariables(
        definition,
        verifiedContext,
        compiledSystemInstructions,
        resolvedVariables,
      );
    default:
      return resolvedVariables;
  }
}
