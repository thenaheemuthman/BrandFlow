import type { PromptExecutionResult } from '../prompts/types.ts';
import type {
  Brand,
  BrandStrategyModule,
  ModuleStatus,
  UpsertBrandModuleInput,
} from '../types/brand.ts';
import type { FoundationSectionKey } from './brandFoundationLogic.ts';
import type {
  ApprovedFoundationSnapshot,
  MessagingSectionKey,
} from './brandMessagingLogic.ts';
import {
  CustomerIntelligenceIsolationError,
  evaluateCustomerIntelligenceDependencies,
  hydrateCustomerIntelligenceState,
  validateAudienceInterest,
  validatePersona,
  type ApprovedMessagingSnapshot,
  type AudienceInterestItem,
  type CustomerPersonaItem,
} from './customerIntelligenceLogic.ts';

export type MarketingStrategySectionKey =
  | 'goals'
  | 'objectives'
  | 'channels'
  | 'tactics'
  | 'kpis'
  | 'roadmap';

export type MarketingStrategyStepKey = MarketingStrategySectionKey | 'review';

export type StrategyItemSource = 'manual' | 'ai_adopted' | 'edited_ai';
export type SuggestionReviewStatus = 'pending_review' | 'approved' | 'rejected';
export type StrategyPriority = 'high' | 'medium' | 'low';
export type ChannelPriority = 'primary' | 'secondary' | 'experimental';
export type KpiClassification = 'leading' | 'lagging';

export interface BusinessContextGapsInput {
  budgetConstraints: string;
  teamCapacity: string;
  baselinePerformance: string;
  targetTimeline: string;
  additionalConstraints: string;
}

export interface SmartMarketingGoalItem {
  id: string;
  title: string;
  description: string;
  strategicRationale: string;
  targetAudience: string;
  supportingBusinessObjective: string;
  successMetrics: string[];
  targetValue: string;
  measurementPeriod: string;
  recommendedTimeframe: string;
  source: StrategyItemSource;
  aiHypothesisNote: string | null;
  approved: boolean;
  approvedAt: string | null;
}

export interface AiSuggestedGoalItem {
  id: string;
  title: string;
  description: string;
  strategicRationale: string;
  targetAudience: string;
  supportingBusinessObjective: string;
  successMetrics: string[];
  targetValue: string;
  measurementPeriod: string;
  recommendedTimeframe: string;
  suggestionStatus: SuggestionReviewStatus;
}

export interface MarketingObjectiveItem {
  id: string;
  title: string;
  description: string;
  intendedBusinessOutcome: string;
  targetAudience: string;
  supportingGoalId: string;
  supportingGoalTitle: string;
  measurementCriteria: string;
  priority: StrategyPriority;
  source: StrategyItemSource;
  approved: boolean;
  approvedAt: string | null;
}

export interface AiSuggestedObjectiveItem {
  id: string;
  title: string;
  description: string;
  intendedBusinessOutcome: string;
  targetAudience: string;
  supportingGoalTitle: string;
  matchedGoalId: string;
  measurementCriteria: string;
  priority: StrategyPriority;
  suggestionStatus: SuggestionReviewStatus;
}

export interface MarketingChannelItem {
  id: string;
  channelName: string;
  strategicRationale: string;
  relevantAudience: string;
  recommendedUse: string;
  expectedContribution: string;
  priority: ChannelPriority;
  supportingObjectiveId: string;
  supportingObjectiveTitle: string;
  source: StrategyItemSource;
  approved: boolean;
  approvedAt: string | null;
}

export interface AiSuggestedChannelItem {
  id: string;
  channelName: string;
  strategicRationale: string;
  relevantAudience: string;
  recommendedUse: string;
  expectedContribution: string;
  priority: ChannelPriority;
  supportingObjectiveTitle: string;
  matchedObjectiveId: string;
  suggestionStatus: SuggestionReviewStatus;
}

export interface MarketingTacticItem {
  id: string;
  tacticName: string;
  description: string;
  supportingObjectiveId: string;
  supportingObjectiveTitle: string;
  recommendedChannelId: string;
  recommendedChannelName: string;
  targetAudience: string;
  executionGuidance: string;
  suggestedFrequency: string;
  successMetric: string;
  priority: StrategyPriority;
  source: StrategyItemSource;
  approved: boolean;
  approvedAt: string | null;
}

export interface AiSuggestedTacticItem {
  id: string;
  tacticName: string;
  description: string;
  supportingObjectiveTitle: string;
  matchedObjectiveId: string;
  recommendedChannelName: string;
  matchedChannelId: string;
  targetAudience: string;
  executionGuidance: string;
  suggestedFrequency: string;
  successMetric: string;
  priority: StrategyPriority;
  suggestionStatus: SuggestionReviewStatus;
}

export interface MarketingKpiItem {
  id: string;
  kpiName: string;
  description: string;
  whatItMeasures: string;
  relatedObjectiveId: string;
  relatedObjectiveTitle: string;
  measurementMethod: string;
  reportingFrequency: string;
  classification: KpiClassification;
  baselineNote: string;
  source: StrategyItemSource;
  approved: boolean;
  approvedAt: string | null;
}

export interface AiSuggestedKpiItem {
  id: string;
  kpiName: string;
  description: string;
  whatItMeasures: string;
  relatedObjectiveTitle: string;
  matchedObjectiveId: string;
  measurementMethod: string;
  reportingFrequency: string;
  classification: KpiClassification;
  baselineNote: string;
  suggestionStatus: SuggestionReviewStatus;
}

export interface ImplementationRoadmapItem {
  id: string;
  phase: string;
  activity: string;
  description: string;
  supportingObjectiveId: string;
  supportingObjectiveTitle: string;
  channel: string;
  priority: StrategyPriority;
  suggestedTimeframe: string;
  dependencies: string[];
  successIndicator: string;
  decisionInputNeeded: string;
  source: StrategyItemSource;
  approved: boolean;
  approvedAt: string | null;
}

export interface AiSuggestedRoadmapItem {
  id: string;
  phase: string;
  activity: string;
  description: string;
  supportingObjectiveTitle: string;
  matchedObjectiveId: string;
  channel: string;
  priority: StrategyPriority;
  suggestedTimeframe: string;
  dependencies: string[];
  successIndicator: string;
  decisionInputNeeded: string;
  suggestionStatus: SuggestionReviewStatus;
}

export interface MarketingAiRunState {
  promptId: string | null;
  promptVersion: string | null;
  sourceClassification: 'reconstructed' | 'original' | null;
  model: string | null;
  generatedAt: string | null;
  researchCaveat: string | null;
  suppliedFactsUsed: string[];
  missingContextNotes: string[];
  aiSuggestionsSummary: Record<string, unknown> | null;
}

export interface MarketingStrategyUpstreamSnapshot {
  foundationApprovedAt: string | null;
  messagingApprovedAt: string | null;
  customerIntelUpdatedAt: string | null;
  approvedPersonasCount: number;
  approvedInterestsCount: number;
  positioningStatement: string;
  coreValueProposition: string;
  primaryPersonaNames: string[];
  primaryInterestTopics: string[];
}

export interface MarketingStrategyApprovedSummary {
  goals: SmartMarketingGoalItem[];
  objectives: MarketingObjectiveItem[];
  channels: MarketingChannelItem[];
  tactics: MarketingTacticItem[];
  kpis: MarketingKpiItem[];
  roadmapItems: ImplementationRoadmapItem[];
  businessContext: BusinessContextGapsInput;
  approvedAt: string;
}

export interface MarketingStrategyState {
  schemaVersion: 1;
  brandId: string;
  upstreamSnapshot: MarketingStrategyUpstreamSnapshot | null;
  businessContext: BusinessContextGapsInput;
  goals: SmartMarketingGoalItem[];
  aiSuggestedGoals: AiSuggestedGoalItem[];
  objectives: MarketingObjectiveItem[];
  aiSuggestedObjectives: AiSuggestedObjectiveItem[];
  channels: MarketingChannelItem[];
  aiSuggestedChannels: AiSuggestedChannelItem[];
  tactics: MarketingTacticItem[];
  aiSuggestedTactics: AiSuggestedTacticItem[];
  kpis: MarketingKpiItem[];
  aiSuggestedKpis: AiSuggestedKpiItem[];
  roadmapItems: ImplementationRoadmapItem[];
  aiSuggestedRoadmapItems: AiSuggestedRoadmapItem[];
  goalsObjectivesSynthesis: MarketingAiRunState;
  channelsTacticsSynthesis: MarketingAiRunState;
  kpisSynthesis: MarketingAiRunState;
  roadmapSynthesis: MarketingAiRunState;
  completedAt: string | null;
  approvedSummary: MarketingStrategyApprovedSummary | null;
}

export type MarketingValidationErrors = Record<string, string>;

export class MarketingStrategyIsolationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MarketingStrategyIsolationError';
  }
}

export const MARKETING_STRATEGY_SECTIONS: ReadonlyArray<{
  key: MarketingStrategySectionKey;
  number: string;
  title: string;
  shortTitle: string;
  subtitle: string;
}> = [
  {
    key: 'goals',
    number: '01',
    title: 'SMART Marketing Goals',
    shortTitle: 'SMART Goals',
    subtitle: 'Specific, measurable, achievable, relevant, and time-bound marketing goals',
  },
  {
    key: 'objectives',
    number: '02',
    title: 'Marketing Objectives',
    shortTitle: 'Objectives',
    subtitle: 'Focused strategic objectives directly supporting approved SMART goals',
  },
  {
    key: 'channels',
    number: '03',
    title: 'Marketing Channels',
    shortTitle: 'Channels',
    subtitle: 'Evidence-based channel selections anchored in personas and audience interests',
  },
  {
    key: 'tactics',
    number: '04',
    title: 'Marketing Tactics',
    shortTitle: 'Tactics',
    subtitle: 'Specific, execution-ready marketing tactics tied to objectives and channels',
  },
  {
    key: 'kpis',
    number: '05',
    title: 'KPIs & Measurement',
    shortTitle: 'KPIs',
    subtitle: 'Leading and lagging indicators with clear measurement methods and baseline notes',
  },
  {
    key: 'roadmap',
    number: '06',
    title: 'Implementation Roadmap',
    shortTitle: 'Roadmap',
    subtitle: 'Phased execution sequence with dependencies, success signals, and owner decisions',
  },
];

const GENERIC_TACTIC_PATTERNS = [
  /^post\s+(consistently|regularly|daily|weekly)\s+on\s+social\s+media\.?$/i,
  /^be\s+active\s+on\s+social\s+media\.?$/i,
  /^do\s+seo\.?$/i,
  /^run\s+(paid\s+)?ads\.?$/i,
  /^send\s+emails\.?$/i,
  /^create\s+content\.?$/i,
];

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function asNullableString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeSource(value: unknown): StrategyItemSource {
  if (value === 'manual' || value === 'ai_adopted' || value === 'edited_ai') {
    return value;
  }
  return 'manual';
}

function normalizeSuggestionStatus(value: unknown): SuggestionReviewStatus {
  if (value === 'approved' || value === 'rejected' || value === 'pending_review') {
    return value;
  }
  return 'pending_review';
}

function normalizePriority(value: unknown): StrategyPriority {
  const lowered = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (lowered === 'high' || lowered === 'medium' || lowered === 'low') {
    return lowered;
  }
  return 'medium';
}

function normalizeChannelPriority(value: unknown): ChannelPriority {
  const lowered = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (lowered === 'primary' || lowered === 'secondary' || lowered === 'experimental') {
    return lowered;
  }
  return 'primary';
}

function normalizeKpiClassification(value: unknown): KpiClassification {
  const lowered = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (lowered === 'leading' || lowered === 'lagging') {
    return lowered;
  }
  return 'leading';
}

export function createEmptyBusinessContext(): BusinessContextGapsInput {
  return {
    budgetConstraints: '',
    teamCapacity: '',
    baselinePerformance: '',
    targetTimeline: '',
    additionalConstraints: '',
  };
}

export function createEmptyMarketingAiRunState(): MarketingAiRunState {
  return {
    promptId: null,
    promptVersion: null,
    sourceClassification: null,
    model: null,
    generatedAt: null,
    researchCaveat: null,
    suppliedFactsUsed: [],
    missingContextNotes: [],
    aiSuggestionsSummary: null,
  };
}

export function createBlankSmartGoal(id: string): SmartMarketingGoalItem {
  return {
    id,
    title: '',
    description: '',
    strategicRationale: '',
    targetAudience: '',
    supportingBusinessObjective: '',
    successMetrics: [],
    targetValue: '',
    measurementPeriod: '',
    recommendedTimeframe: '',
    source: 'manual',
    aiHypothesisNote: null,
    approved: false,
    approvedAt: null,
  };
}

export function createBlankMarketingObjective(
  id: string,
  defaultGoal?: { id: string; title: string },
): MarketingObjectiveItem {
  return {
    id,
    title: '',
    description: '',
    intendedBusinessOutcome: '',
    targetAudience: '',
    supportingGoalId: defaultGoal?.id ?? '',
    supportingGoalTitle: defaultGoal?.title ?? '',
    measurementCriteria: '',
    priority: 'high',
    source: 'manual',
    approved: false,
    approvedAt: null,
  };
}

export function createBlankMarketingChannel(
  id: string,
  defaultObjective?: { id: string; title: string },
): MarketingChannelItem {
  return {
    id,
    channelName: '',
    strategicRationale: '',
    relevantAudience: '',
    recommendedUse: '',
    expectedContribution: '',
    priority: 'primary',
    supportingObjectiveId: defaultObjective?.id ?? '',
    supportingObjectiveTitle: defaultObjective?.title ?? '',
    source: 'manual',
    approved: false,
    approvedAt: null,
  };
}

export function createBlankMarketingTactic(
  id: string,
  defaults?: {
    objective?: { id: string; title: string };
    channel?: { id: string; name: string };
  },
): MarketingTacticItem {
  return {
    id,
    tacticName: '',
    description: '',
    supportingObjectiveId: defaults?.objective?.id ?? '',
    supportingObjectiveTitle: defaults?.objective?.title ?? '',
    recommendedChannelId: defaults?.channel?.id ?? '',
    recommendedChannelName: defaults?.channel?.name ?? '',
    targetAudience: '',
    executionGuidance: '',
    suggestedFrequency: '',
    successMetric: '',
    priority: 'high',
    source: 'manual',
    approved: false,
    approvedAt: null,
  };
}

export function createBlankMarketingKpi(
  id: string,
  defaultObjective?: { id: string; title: string },
): MarketingKpiItem {
  return {
    id,
    kpiName: '',
    description: '',
    whatItMeasures: '',
    relatedObjectiveId: defaultObjective?.id ?? '',
    relatedObjectiveTitle: defaultObjective?.title ?? '',
    measurementMethod: '',
    reportingFrequency: '',
    classification: 'leading',
    baselineNote: 'Baseline to be established during Phase 1 tracking.',
    source: 'manual',
    approved: false,
    approvedAt: null,
  };
}

export function createBlankRoadmapItem(
  id: string,
  defaultObjective?: { id: string; title: string },
): ImplementationRoadmapItem {
  return {
    id,
    phase: 'Phase 1: Foundation & Setup',
    activity: '',
    description: '',
    supportingObjectiveId: defaultObjective?.id ?? '',
    supportingObjectiveTitle: defaultObjective?.title ?? '',
    channel: '',
    priority: 'high',
    suggestedTimeframe: '',
    dependencies: [],
    successIndicator: '',
    decisionInputNeeded: '',
    source: 'manual',
    approved: false,
    approvedAt: null,
  };
}

export function createInitialMarketingStrategyState(
  brand: Brand,
  upstreamSnapshot: MarketingStrategyUpstreamSnapshot | null = null,
): MarketingStrategyState {
  return {
    schemaVersion: 1,
    brandId: brand.id,
    upstreamSnapshot,
    businessContext: createEmptyBusinessContext(),
    goals: [],
    aiSuggestedGoals: [],
    objectives: [],
    aiSuggestedObjectives: [],
    channels: [],
    aiSuggestedChannels: [],
    tactics: [],
    aiSuggestedTactics: [],
    kpis: [],
    aiSuggestedKpis: [],
    roadmapItems: [],
    aiSuggestedRoadmapItems: [],
    goalsObjectivesSynthesis: createEmptyMarketingAiRunState(),
    channelsTacticsSynthesis: createEmptyMarketingAiRunState(),
    kpisSynthesis: createEmptyMarketingAiRunState(),
    roadmapSynthesis: createEmptyMarketingAiRunState(),
    completedAt: null,
    approvedSummary: null,
  };
}

function matchByTitle<T extends { id: string }>(
  targetTitle: string,
  items: readonly T[],
  getLabel: (item: T) => string,
): T | null {
  const normalized = targetTitle.trim().toLowerCase();
  if (!normalized) return null;

  const exact = items.find((item) => getLabel(item).trim().toLowerCase() === normalized);
  if (exact) return exact;

  const partial = items.filter((item) => {
    const label = getLabel(item).trim().toLowerCase();
    return label.length > 0 && (label.includes(normalized) || normalized.includes(label));
  });
  return partial.length === 1 ? partial[0] : null;
}

function normalizeBusinessContext(raw: unknown): BusinessContextGapsInput {
  if (!isPlainObject(raw)) return createEmptyBusinessContext();
  return {
    budgetConstraints: asString(raw.budgetConstraints),
    teamCapacity: asString(raw.teamCapacity),
    baselinePerformance: asString(raw.baselinePerformance),
    targetTimeline: asString(raw.targetTimeline),
    additionalConstraints: asString(raw.additionalConstraints),
  };
}

function normalizeAiRunState(raw: unknown): MarketingAiRunState {
  if (!isPlainObject(raw)) return createEmptyMarketingAiRunState();
  return {
    promptId: asNullableString(raw.promptId),
    promptVersion: asNullableString(raw.promptVersion),
    sourceClassification:
      raw.sourceClassification === 'reconstructed' || raw.sourceClassification === 'original'
        ? raw.sourceClassification
        : null,
    model: asNullableString(raw.model),
    generatedAt: asNullableString(raw.generatedAt),
    researchCaveat: asNullableString(raw.researchCaveat),
    suppliedFactsUsed: asStringArray(raw.suppliedFactsUsed),
    missingContextNotes: asStringArray(raw.missingContextNotes),
    aiSuggestionsSummary: isPlainObject(raw.aiSuggestionsSummary)
      ? raw.aiSuggestionsSummary
      : null,
  };
}

function normalizeGoalItem(raw: unknown, idx: number): SmartMarketingGoalItem | null {
  if (!isPlainObject(raw)) return null;
  return {
    id: asString(raw.id, `goal-${idx + 1}`).trim() || `goal-${idx + 1}`,
    title: asString(raw.title),
    description: asString(raw.description),
    strategicRationale: asString(raw.strategicRationale),
    targetAudience: asString(raw.targetAudience),
    supportingBusinessObjective: asString(raw.supportingBusinessObjective),
    successMetrics: asStringArray(raw.successMetrics),
    targetValue: asString(raw.targetValue),
    measurementPeriod: asString(raw.measurementPeriod),
    recommendedTimeframe: asString(raw.recommendedTimeframe),
    source: normalizeSource(raw.source),
    aiHypothesisNote: asNullableString(raw.aiHypothesisNote),
    approved: raw.approved === true,
    approvedAt: asNullableString(raw.approvedAt),
  };
}

function normalizeSuggestedGoalItem(raw: unknown, idx: number): AiSuggestedGoalItem | null {
  if (!isPlainObject(raw)) return null;
  const title = asString(raw.title).trim();
  const description = asString(raw.description).trim();
  if (!title && !description) return null;
  return {
    id: asString(raw.id, `ai-goal-${idx + 1}`).trim() || `ai-goal-${idx + 1}`,
    title: title || `Suggested Goal ${idx + 1}`,
    description,
    strategicRationale: asString(raw.strategicRationale).trim(),
    targetAudience: asString(raw.targetAudience).trim(),
    supportingBusinessObjective: asString(raw.supportingBusinessObjective).trim(),
    successMetrics: asStringArray(raw.successMetrics),
    targetValue: asString(raw.targetValue).trim(),
    measurementPeriod: asString(raw.measurementPeriod).trim(),
    recommendedTimeframe: asString(raw.recommendedTimeframe).trim(),
    suggestionStatus: normalizeSuggestionStatus(raw.suggestionStatus),
  };
}

function normalizeObjectiveItem(raw: unknown, idx: number): MarketingObjectiveItem | null {
  if (!isPlainObject(raw)) return null;
  return {
    id: asString(raw.id, `objective-${idx + 1}`).trim() || `objective-${idx + 1}`,
    title: asString(raw.title),
    description: asString(raw.description),
    intendedBusinessOutcome: asString(raw.intendedBusinessOutcome),
    targetAudience: asString(raw.targetAudience),
    supportingGoalId: asString(raw.supportingGoalId),
    supportingGoalTitle: asString(raw.supportingGoalTitle),
    measurementCriteria: asString(raw.measurementCriteria),
    priority: normalizePriority(raw.priority),
    source: normalizeSource(raw.source),
    approved: raw.approved === true,
    approvedAt: asNullableString(raw.approvedAt),
  };
}

function normalizeSuggestedObjectiveItem(
  raw: unknown,
  idx: number,
  goals: readonly SmartMarketingGoalItem[],
): AiSuggestedObjectiveItem | null {
  if (!isPlainObject(raw)) return null;
  const title = asString(raw.title).trim();
  if (!title) return null;
  const supportingGoalTitle = asString(raw.supportingGoalTitle).trim();
  const explicitGoalId = asString(raw.matchedGoalId).trim();
  const matchedGoal =
    (explicitGoalId ? goals.find((g) => g.id === explicitGoalId) : null) ??
    matchByTitle(supportingGoalTitle, goals, (g) => g.title);

  return {
    id: asString(raw.id, `ai-objective-${idx + 1}`).trim() || `ai-objective-${idx + 1}`,
    title,
    description: asString(raw.description).trim(),
    intendedBusinessOutcome: asString(raw.intendedBusinessOutcome).trim(),
    targetAudience: asString(raw.targetAudience).trim(),
    supportingGoalTitle,
    matchedGoalId: matchedGoal?.id ?? '',
    measurementCriteria: asString(raw.measurementCriteria).trim(),
    priority: normalizePriority(raw.priority),
    suggestionStatus: normalizeSuggestionStatus(raw.suggestionStatus),
  };
}

function normalizeChannelItem(raw: unknown, idx: number): MarketingChannelItem | null {
  if (!isPlainObject(raw)) return null;
  return {
    id: asString(raw.id, `channel-${idx + 1}`).trim() || `channel-${idx + 1}`,
    channelName: asString(raw.channelName),
    strategicRationale: asString(raw.strategicRationale),
    relevantAudience: asString(raw.relevantAudience),
    recommendedUse: asString(raw.recommendedUse),
    expectedContribution: asString(raw.expectedContribution),
    priority: normalizeChannelPriority(raw.priority),
    supportingObjectiveId: asString(raw.supportingObjectiveId),
    supportingObjectiveTitle: asString(raw.supportingObjectiveTitle),
    source: normalizeSource(raw.source),
    approved: raw.approved === true,
    approvedAt: asNullableString(raw.approvedAt),
  };
}

function normalizeSuggestedChannelItem(
  raw: unknown,
  idx: number,
  objectives: readonly MarketingObjectiveItem[],
): AiSuggestedChannelItem | null {
  if (!isPlainObject(raw)) return null;
  const channelName = asString(raw.channelName).trim();
  if (!channelName) return null;
  const supportingObjectiveTitle = asString(raw.supportingObjectiveTitle).trim();
  const explicitObjId = asString(raw.matchedObjectiveId).trim();
  const matchedObj =
    (explicitObjId ? objectives.find((o) => o.id === explicitObjId) : null) ??
    matchByTitle(supportingObjectiveTitle, objectives, (o) => o.title);

  return {
    id: asString(raw.id, `ai-channel-${idx + 1}`).trim() || `ai-channel-${idx + 1}`,
    channelName,
    strategicRationale: asString(raw.strategicRationale).trim(),
    relevantAudience: asString(raw.relevantAudience).trim(),
    recommendedUse: asString(raw.recommendedUse).trim(),
    expectedContribution: asString(raw.expectedContribution).trim(),
    priority: normalizeChannelPriority(raw.priority),
    supportingObjectiveTitle,
    matchedObjectiveId: matchedObj?.id ?? '',
    suggestionStatus: normalizeSuggestionStatus(raw.suggestionStatus),
  };
}

function normalizeTacticItem(raw: unknown, idx: number): MarketingTacticItem | null {
  if (!isPlainObject(raw)) return null;
  return {
    id: asString(raw.id, `tactic-${idx + 1}`).trim() || `tactic-${idx + 1}`,
    tacticName: asString(raw.tacticName),
    description: asString(raw.description),
    supportingObjectiveId: asString(raw.supportingObjectiveId),
    supportingObjectiveTitle: asString(raw.supportingObjectiveTitle),
    recommendedChannelId: asString(raw.recommendedChannelId),
    recommendedChannelName: asString(raw.recommendedChannelName),
    targetAudience: asString(raw.targetAudience),
    executionGuidance: asString(raw.executionGuidance),
    suggestedFrequency: asString(raw.suggestedFrequency),
    successMetric: asString(raw.successMetric),
    priority: normalizePriority(raw.priority),
    source: normalizeSource(raw.source),
    approved: raw.approved === true,
    approvedAt: asNullableString(raw.approvedAt),
  };
}

function normalizeSuggestedTacticItem(
  raw: unknown,
  idx: number,
  objectives: readonly MarketingObjectiveItem[],
  channels: readonly MarketingChannelItem[],
): AiSuggestedTacticItem | null {
  if (!isPlainObject(raw)) return null;
  const tacticName = asString(raw.tacticName).trim();
  if (!tacticName) return null;

  const supportingObjectiveTitle = asString(raw.supportingObjectiveTitle).trim();
  const explicitObjId = asString(raw.matchedObjectiveId).trim();
  const matchedObj =
    (explicitObjId ? objectives.find((o) => o.id === explicitObjId) : null) ??
    matchByTitle(supportingObjectiveTitle, objectives, (o) => o.title);

  const recommendedChannelName = asString(raw.recommendedChannelName).trim();
  const explicitChannelId = asString(raw.matchedChannelId).trim();
  const matchedChan =
    (explicitChannelId ? channels.find((c) => c.id === explicitChannelId) : null) ??
    matchByTitle(recommendedChannelName, channels, (c) => c.channelName);

  return {
    id: asString(raw.id, `ai-tactic-${idx + 1}`).trim() || `ai-tactic-${idx + 1}`,
    tacticName,
    description: asString(raw.description).trim(),
    supportingObjectiveTitle,
    matchedObjectiveId: matchedObj?.id ?? '',
    recommendedChannelName,
    matchedChannelId: matchedChan?.id ?? '',
    targetAudience: asString(raw.targetAudience).trim(),
    executionGuidance: asString(raw.executionGuidance).trim(),
    suggestedFrequency: asString(raw.suggestedFrequency).trim(),
    successMetric: asString(raw.successMetric).trim(),
    priority: normalizePriority(raw.priority),
    suggestionStatus: normalizeSuggestionStatus(raw.suggestionStatus),
  };
}

function normalizeKpiItem(raw: unknown, idx: number): MarketingKpiItem | null {
  if (!isPlainObject(raw)) return null;
  return {
    id: asString(raw.id, `kpi-${idx + 1}`).trim() || `kpi-${idx + 1}`,
    kpiName: asString(raw.kpiName),
    description: asString(raw.description),
    whatItMeasures: asString(raw.whatItMeasures),
    relatedObjectiveId: asString(raw.relatedObjectiveId),
    relatedObjectiveTitle: asString(raw.relatedObjectiveTitle),
    measurementMethod: asString(raw.measurementMethod),
    reportingFrequency: asString(raw.reportingFrequency),
    classification: normalizeKpiClassification(raw.classification),
    baselineNote: asString(raw.baselineNote),
    source: normalizeSource(raw.source),
    approved: raw.approved === true,
    approvedAt: asNullableString(raw.approvedAt),
  };
}

function normalizeSuggestedKpiItem(
  raw: unknown,
  idx: number,
  objectives: readonly MarketingObjectiveItem[],
): AiSuggestedKpiItem | null {
  if (!isPlainObject(raw)) return null;
  const kpiName = asString(raw.kpiName).trim();
  if (!kpiName) return null;

  const relatedObjectiveTitle = asString(raw.relatedObjectiveTitle).trim();
  const explicitObjId = asString(raw.matchedObjectiveId).trim();
  const matchedObj =
    (explicitObjId ? objectives.find((o) => o.id === explicitObjId) : null) ??
    matchByTitle(relatedObjectiveTitle, objectives, (o) => o.title);

  return {
    id: asString(raw.id, `ai-kpi-${idx + 1}`).trim() || `ai-kpi-${idx + 1}`,
    kpiName,
    description: asString(raw.description).trim(),
    whatItMeasures: asString(raw.whatItMeasures).trim(),
    relatedObjectiveTitle,
    matchedObjectiveId: matchedObj?.id ?? '',
    measurementMethod: asString(raw.measurementMethod).trim(),
    reportingFrequency: asString(raw.reportingFrequency).trim(),
    classification: normalizeKpiClassification(raw.classification),
    baselineNote:
      asString(raw.baselineNote).trim() ||
      'Baseline to be established during initial measurement cycle.',
    suggestionStatus: normalizeSuggestionStatus(raw.suggestionStatus),
  };
}

function normalizeRoadmapItem(raw: unknown, idx: number): ImplementationRoadmapItem | null {
  if (!isPlainObject(raw)) return null;
  return {
    id: asString(raw.id, `roadmap-${idx + 1}`).trim() || `roadmap-${idx + 1}`,
    phase: asString(raw.phase, 'Phase 1: Foundation & Setup'),
    activity: asString(raw.activity),
    description: asString(raw.description),
    supportingObjectiveId: asString(raw.supportingObjectiveId),
    supportingObjectiveTitle: asString(raw.supportingObjectiveTitle),
    channel: asString(raw.channel),
    priority: normalizePriority(raw.priority),
    suggestedTimeframe: asString(raw.suggestedTimeframe),
    dependencies: asStringArray(raw.dependencies),
    successIndicator: asString(raw.successIndicator),
    decisionInputNeeded: asString(raw.decisionInputNeeded),
    source: normalizeSource(raw.source),
    approved: raw.approved === true,
    approvedAt: asNullableString(raw.approvedAt),
  };
}

function normalizeSuggestedRoadmapItem(
  raw: unknown,
  idx: number,
  objectives: readonly MarketingObjectiveItem[],
): AiSuggestedRoadmapItem | null {
  if (!isPlainObject(raw)) return null;
  const activity = asString(raw.activity).trim();
  if (!activity) return null;

  const supportingObjectiveTitle = asString(raw.supportingObjectiveTitle).trim();
  const explicitObjId = asString(raw.matchedObjectiveId).trim();
  const matchedObj =
    (explicitObjId ? objectives.find((o) => o.id === explicitObjId) : null) ??
    matchByTitle(supportingObjectiveTitle, objectives, (o) => o.title);

  return {
    id: asString(raw.id, `ai-roadmap-${idx + 1}`).trim() || `ai-roadmap-${idx + 1}`,
    phase: asString(raw.phase, 'Phase 1: Foundation & Setup').trim() || 'Phase 1: Foundation & Setup',
    activity,
    description: asString(raw.description).trim(),
    supportingObjectiveTitle,
    matchedObjectiveId: matchedObj?.id ?? '',
    channel: asString(raw.channel).trim(),
    priority: normalizePriority(raw.priority),
    suggestedTimeframe: asString(raw.suggestedTimeframe).trim(),
    dependencies: asStringArray(raw.dependencies),
    successIndicator: asString(raw.successIndicator).trim(),
    decisionInputNeeded: asString(raw.decisionInputNeeded).trim(),
    suggestionStatus: normalizeSuggestionStatus(raw.suggestionStatus),
  };
}

export interface MarketingStrategyDependencyEvaluation {
  ready: boolean;
  foundationReady: boolean;
  messagingReady: boolean;
  personasReady: boolean;
  interestsReady: boolean;
  foundationStatus: ModuleStatus;
  messagingStatus: ModuleStatus;
  customerIntelStatus: ModuleStatus;
  missingFoundationSections: FoundationSectionKey[];
  missingMessagingSections: MessagingSectionKey[];
  approvedPersonasCount: number;
  approvedInterestsCount: number;
  approvedFoundation: ApprovedFoundationSnapshot | null;
  approvedMessaging: ApprovedMessagingSnapshot | null;
  approvedPersonas: CustomerPersonaItem[];
  approvedInterests: AudienceInterestItem[];
  upstreamSnapshot: MarketingStrategyUpstreamSnapshot | null;
  reason: string | null;
}

/**
 * Verifies all four upstream prerequisites for the exact brand/owner:
 * 1. Completed Brand Foundation
 * 2. Completed Brand Messaging
 * 3. At least 1 valid approved Customer Persona
 * 4. At least 1 valid approved Audience Interest cluster
 */
export function evaluateMarketingStrategyDependencies(
  brand: Brand,
  strategyModules: readonly BrandStrategyModule[] | null | undefined,
): MarketingStrategyDependencyEvaluation {
  const list = strategyModules ?? [];
  for (const mod of list) {
    if (mod.brandId !== brand.id) {
      throw new MarketingStrategyIsolationError(
        `Brand context isolation error: module "${mod.moduleKey}" belongs to brand "${mod.brandId}" rather than "${brand.id}".`,
      );
    }
    if (brand.userId && mod.userId && mod.userId !== brand.userId) {
      throw new MarketingStrategyIsolationError(
        `Brand ownership isolation error: module "${mod.moduleKey}" does not belong to the active brand owner.`,
      );
    }
  }

  let ciDeps;
  try {
    ciDeps = evaluateCustomerIntelligenceDependencies(brand, list);
  } catch (err) {
    if (err instanceof CustomerIntelligenceIsolationError) {
      throw new MarketingStrategyIsolationError(err.message);
    }
    throw err;
  }

  const ciModule = list.find((m) => m.moduleKey === 'customerIntelligence') ?? null;
  const customerIntelStatus: ModuleStatus = ciModule?.status ?? 'not_started';

  let approvedPersonas: CustomerPersonaItem[] = [];
  let approvedInterests: AudienceInterestItem[] = [];

  if (ciModule) {
    let hydratedCi;
    try {
      hydratedCi = hydrateCustomerIntelligenceState(brand, ciModule, ciDeps.upstreamSnapshot);
    } catch (err) {
      if (err instanceof CustomerIntelligenceIsolationError) {
        throw new MarketingStrategyIsolationError(err.message);
      }
      throw err;
    }

    approvedPersonas = hydratedCi.personas.filter(
      (p) => p.approved && Object.keys(validatePersona(p)).length === 0,
    );
    const approvedPersonaIds = new Set(approvedPersonas.map((p) => p.id));

    approvedInterests = hydratedCi.interests.filter(
      (i) =>
        i.approved &&
        Object.keys(validateAudienceInterest(i, hydratedCi.personas)).length === 0 &&
        i.linkedPersonaIds.some((id) => approvedPersonaIds.has(id)),
    );
  }

  const personasReady = approvedPersonas.length > 0;
  const interestsReady = approvedInterests.length > 0;
  const ready = ciDeps.foundationReady && ciDeps.messagingReady && personasReady && interestsReady;

  const missingLabels: string[] = [];
  if (!ciDeps.foundationReady) missingLabels.push('completed Brand Foundation');
  if (!ciDeps.messagingReady) missingLabels.push('completed Brand Messaging');
  if (!personasReady) missingLabels.push('at least one approved Customer Persona');
  if (!interestsReady) missingLabels.push('at least one approved Audience Interest cluster');

  const reason =
    missingLabels.length > 0
      ? `Marketing Strategy AI generation requires ${missingLabels.join(', ')}.`
      : null;

  const upstreamSnapshot: MarketingStrategyUpstreamSnapshot | null =
    ready && ciDeps.approvedFoundation && ciDeps.approvedMessaging
      ? {
          foundationApprovedAt: ciDeps.approvedFoundation.approvedAt,
          messagingApprovedAt: ciDeps.approvedMessaging.approvedAt,
          customerIntelUpdatedAt: ciModule?.updatedAt ?? null,
          approvedPersonasCount: approvedPersonas.length,
          approvedInterestsCount: approvedInterests.length,
          positioningStatement: ciDeps.approvedFoundation.positioningStatement,
          coreValueProposition: ciDeps.approvedMessaging.coreValueProposition,
          primaryPersonaNames: approvedPersonas.slice(0, 4).map((p) => p.name),
          primaryInterestTopics: approvedInterests.slice(0, 4).map((i) => i.topic),
        }
      : null;

  return {
    ready,
    foundationReady: ciDeps.foundationReady,
    messagingReady: ciDeps.messagingReady,
    personasReady,
    interestsReady,
    foundationStatus: ciDeps.foundationStatus,
    messagingStatus: ciDeps.messagingStatus,
    customerIntelStatus,
    missingFoundationSections: ciDeps.missingFoundationSections,
    missingMessagingSections: ciDeps.missingMessagingSections,
    approvedPersonasCount: approvedPersonas.length,
    approvedInterestsCount: approvedInterests.length,
    approvedFoundation: ciDeps.approvedFoundation,
    approvedMessaging: ciDeps.approvedMessaging,
    approvedPersonas,
    approvedInterests,
    upstreamSnapshot,
    reason,
  };
}

export function checkGoalsObjectivesReadiness(
  brand: Brand,
  strategyModules: readonly BrandStrategyModule[] | null | undefined,
): {
  ready: boolean;
  dependenciesReady: boolean;
  profileReady: boolean;
  missingProfileFields: string[];
  dependencyEvaluation: MarketingStrategyDependencyEvaluation;
  reason: string | null;
} {
  const dependencyEvaluation = evaluateMarketingStrategyDependencies(brand, strategyModules);

  const requiredFields: Array<[string, string | undefined]> = [
    ['brandName', brand.brandName],
    ['businessDescription', brand.businessDescription],
    ['industry', brand.industry],
    ['productsOrServices', brand.productsOrServices],
    ['targetMarket', brand.targetMarket],
    ['primaryLocation', brand.primaryLocation],
  ];

  const missingProfileFields = requiredFields
    .filter(([, value]) => typeof value !== 'string' || !value.trim())
    .map(([key]) => key);

  const profileReady = missingProfileFields.length === 0;
  const ready = dependencyEvaluation.ready && profileReady;

  let reason = dependencyEvaluation.reason;
  if (!reason && !profileReady) {
    reason = `Missing required brand profile information: ${missingProfileFields.join(', ')}.`;
  }

  return {
    ready,
    dependenciesReady: dependencyEvaluation.ready,
    profileReady,
    missingProfileFields,
    dependencyEvaluation,
    reason,
  };
}

export function checkChannelsTacticsReadiness(
  brand: Brand,
  strategyModules: readonly BrandStrategyModule[] | null | undefined,
  state: MarketingStrategyState,
): {
  ready: boolean;
  dependenciesReady: boolean;
  hasApprovedGoals: boolean;
  hasApprovedObjectives: boolean;
  reason: string | null;
} {
  const base = checkGoalsObjectivesReadiness(brand, strategyModules);
  const validApprovedGoals = state.goals.filter(
    (g) => g.approved && Object.keys(validateSmartGoal(g)).length === 0,
  );
  const validApprovedObjectives = state.objectives.filter(
    (o) => o.approved && Object.keys(validateMarketingObjective(o, state.goals)).length === 0,
  );

  const hasApprovedGoals = validApprovedGoals.length > 0;
  const hasApprovedObjectives = validApprovedObjectives.length > 0;
  const ready = base.ready && hasApprovedGoals && hasApprovedObjectives;

  let reason = base.reason;
  if (!reason && !hasApprovedGoals) {
    reason = 'Approve at least one SMART Marketing Goal before generating Channels & Tactics.';
  } else if (!reason && !hasApprovedObjectives) {
    reason =
      'Approve at least one Marketing Objective before generating Channels & Tactics.';
  }

  return {
    ready,
    dependenciesReady: base.dependenciesReady,
    hasApprovedGoals,
    hasApprovedObjectives,
    reason,
  };
}

export function checkKpisReadiness(
  brand: Brand,
  strategyModules: readonly BrandStrategyModule[] | null | undefined,
  state: MarketingStrategyState,
): {
  ready: boolean;
  dependenciesReady: boolean;
  hasApprovedChannels: boolean;
  hasApprovedTactics: boolean;
  reason: string | null;
} {
  const base = checkChannelsTacticsReadiness(brand, strategyModules, state);
  const validApprovedChannels = state.channels.filter(
    (c) => c.approved && Object.keys(validateMarketingChannel(c, state.objectives)).length === 0,
  );
  const validApprovedTactics = state.tactics.filter(
    (t) =>
      t.approved &&
      Object.keys(validateMarketingTactic(t, state.objectives, state.channels)).length === 0,
  );

  const hasApprovedChannels = validApprovedChannels.length > 0;
  const hasApprovedTactics = validApprovedTactics.length > 0;
  const ready = base.ready && hasApprovedChannels && hasApprovedTactics;

  let reason = base.reason;
  if (!reason && !hasApprovedChannels) {
    reason = 'Approve at least one Marketing Channel before generating KPIs.';
  } else if (!reason && !hasApprovedTactics) {
    reason = 'Approve at least one Marketing Tactic before generating KPIs.';
  }

  return {
    ready,
    dependenciesReady: base.dependenciesReady,
    hasApprovedChannels,
    hasApprovedTactics,
    reason,
  };
}

export function checkRoadmapReadiness(
  brand: Brand,
  strategyModules: readonly BrandStrategyModule[] | null | undefined,
  state: MarketingStrategyState,
): {
  ready: boolean;
  dependenciesReady: boolean;
  hasApprovedChannels: boolean;
  hasApprovedTactics: boolean;
  reason: string | null;
} {
  const kpiBase = checkKpisReadiness(brand, strategyModules, state);
  let reason = kpiBase.reason;
  if (reason && reason.includes('generating KPIs')) {
    reason = reason.replace('generating KPIs', 'generating the Implementation Roadmap');
  }
  return {
    ...kpiBase,
    reason,
  };
}

// ============================================================================
// VALIDATORS FOR ALL 6 MARKETING STRATEGY SECTIONS
// ============================================================================

export function validateSmartGoal(goal: SmartMarketingGoalItem): MarketingValidationErrors {
  const errors: MarketingValidationErrors = {};
  if (!goal.title.trim()) errors.title = 'Goal title is required.';
  if (!goal.description.trim()) errors.description = 'Describe the specific goal clearly.';
  if (!goal.strategicRationale.trim()) {
    errors.strategicRationale = 'Explain the strategic rationale grounded in your brand context.';
  }
  if (!goal.targetAudience.trim()) {
    errors.targetAudience = 'Specify the target audience segment or persona.';
  }
  if (!goal.supportingBusinessObjective.trim()) {
    errors.supportingBusinessObjective = 'Connect this goal to a business objective.';
  }
  if (goal.successMetrics.filter((m) => m.trim()).length === 0) {
    errors.successMetrics = 'Add at least one measurable success metric.';
  }
  if (!goal.targetValue.trim()) {
    errors.targetValue =
      'Provide a target value or state "Baseline to be established" if no historical benchmark exists.';
  }
  if (!goal.measurementPeriod.trim()) {
    errors.measurementPeriod = 'Specify the measurement cadence or period.';
  }
  if (!goal.recommendedTimeframe.trim()) {
    errors.recommendedTimeframe = 'Provide a time-bound timeframe (e.g., 90 days or Q1–Q2).';
  }
  return errors;
}

export function validateMarketingObjective(
  objective: MarketingObjectiveItem,
  goals: readonly SmartMarketingGoalItem[],
): MarketingValidationErrors {
  const errors: MarketingValidationErrors = {};
  if (!objective.title.trim()) errors.title = 'Objective title is required.';
  if (!objective.description.trim()) errors.description = 'Describe what this objective achieves.';
  if (!objective.intendedBusinessOutcome.trim()) {
    errors.intendedBusinessOutcome = 'Specify the intended business outcome.';
  }
  if (!objective.targetAudience.trim()) {
    errors.targetAudience = 'Specify the target audience for this objective.';
  }
  if (!objective.measurementCriteria.trim()) {
    errors.measurementCriteria = 'Define how achievement of this objective will be evaluated.';
  }

  const hasValidGoalId =
    objective.supportingGoalId.trim().length > 0 &&
    goals.some((g) => g.id === objective.supportingGoalId);
  const hasGoalTitle = objective.supportingGoalTitle.trim().length > 0;
  if (!hasValidGoalId && !hasGoalTitle) {
    errors.supportingGoalId = 'Link this objective to a supporting SMART marketing goal.';
  }

  return errors;
}

export function validateMarketingChannel(
  channel: MarketingChannelItem,
  objectives: readonly MarketingObjectiveItem[],
): MarketingValidationErrors {
  const errors: MarketingValidationErrors = {};
  if (!channel.channelName.trim()) errors.channelName = 'Channel name is required.';
  if (channel.strategicRationale.trim().length < 15) {
    errors.strategicRationale =
      'Provide a grounded strategic rationale (at least 15 characters) explaining why this channel fits your personas and strategy.';
  }
  if (!channel.relevantAudience.trim()) {
    errors.relevantAudience = 'Identify which target persona or audience segment uses this channel.';
  }
  if (!channel.recommendedUse.trim()) {
    errors.recommendedUse = 'Describe how this channel should be used strategically.';
  }
  if (!channel.expectedContribution.trim()) {
    errors.expectedContribution = 'Describe the expected contribution to your marketing objectives.';
  }

  const hasValidObjId =
    channel.supportingObjectiveId.trim().length > 0 &&
    objectives.some((o) => o.id === channel.supportingObjectiveId);
  const hasObjTitle = channel.supportingObjectiveTitle.trim().length > 0;
  if (!hasValidObjId && !hasObjTitle) {
    errors.supportingObjectiveId = 'Link this channel to a supporting marketing objective.';
  }

  return errors;
}

export function validateMarketingTactic(
  tactic: MarketingTacticItem,
  objectives: readonly MarketingObjectiveItem[],
  channels: readonly MarketingChannelItem[],
): MarketingValidationErrors {
  const errors: MarketingValidationErrors = {};
  const trimmedName = tactic.tacticName.trim();
  const trimmedGuidance = tactic.executionGuidance.trim();

  if (!trimmedName) {
    errors.tacticName = 'Tactic name is required.';
  } else if (
    GENERIC_TACTIC_PATTERNS.some((pattern) => pattern.test(trimmedName)) &&
    trimmedGuidance.length < 30
  ) {
    errors.tacticName =
      'Tactic is too generic. Specify a concrete execution tactic and detailed execution guidance.';
  }

  if (!tactic.description.trim()) errors.description = 'Describe the tactic clearly.';
  if (!tactic.targetAudience.trim()) errors.targetAudience = 'Specify the target audience.';
  if (trimmedGuidance.length < 20) {
    errors.executionGuidance =
      'Provide concrete, execution-ready guidance (at least 20 characters explaining how to execute this tactic).';
  }
  if (!tactic.suggestedFrequency.trim()) {
    errors.suggestedFrequency = 'Specify a practical execution cadence or frequency.';
  }
  if (!tactic.successMetric.trim()) {
    errors.successMetric = 'Specify the primary metric used to evaluate this tactic.';
  }

  const hasValidObjId =
    tactic.supportingObjectiveId.trim().length > 0 &&
    objectives.some((o) => o.id === tactic.supportingObjectiveId);
  if (!hasValidObjId && !tactic.supportingObjectiveTitle.trim()) {
    errors.supportingObjectiveId = 'Link this tactic to a supporting marketing objective.';
  }

  const hasValidChanId =
    tactic.recommendedChannelId.trim().length > 0 &&
    channels.some((c) => c.id === tactic.recommendedChannelId);
  if (!hasValidChanId && !tactic.recommendedChannelName.trim()) {
    errors.recommendedChannelId = 'Assign this tactic to a recommended marketing channel.';
  }

  return errors;
}

export function validateMarketingKpi(
  kpi: MarketingKpiItem,
  objectives: readonly MarketingObjectiveItem[],
): MarketingValidationErrors {
  const errors: MarketingValidationErrors = {};
  if (!kpi.kpiName.trim()) errors.kpiName = 'KPI name is required.';
  if (!kpi.description.trim()) errors.description = 'Describe what this KPI tracks.';
  if (!kpi.whatItMeasures.trim()) {
    errors.whatItMeasures = 'Clarify the exact signal or outcome measured.';
  }
  if (!kpi.measurementMethod.trim()) {
    errors.measurementMethod = 'Specify the tool, data source, or method used to measure it.';
  }
  if (!kpi.reportingFrequency.trim()) {
    errors.reportingFrequency = 'Specify the reporting cadence (e.g., Weekly, Monthly).';
  }
  if (kpi.classification !== 'leading' && kpi.classification !== 'lagging') {
    errors.classification = 'Classify the KPI as either leading or lagging.';
  }
  if (!kpi.baselineNote.trim()) {
    errors.baselineNote =
      'Provide baseline context or note that a baseline must be established first.';
  }

  const hasValidObjId =
    kpi.relatedObjectiveId.trim().length > 0 &&
    objectives.some((o) => o.id === kpi.relatedObjectiveId);
  if (!hasValidObjId && !kpi.relatedObjectiveTitle.trim()) {
    errors.relatedObjectiveId = 'Link this KPI to a related marketing objective.';
  }

  return errors;
}

export function validateRoadmapActivity(
  item: ImplementationRoadmapItem,
  objectives: readonly MarketingObjectiveItem[],
): MarketingValidationErrors {
  const errors: MarketingValidationErrors = {};
  if (!item.phase.trim()) errors.phase = 'Assign this activity to an implementation phase.';
  if (!item.activity.trim()) errors.activity = 'Activity title is required.';
  if (!item.description.trim()) errors.description = 'Describe the implementation activity.';
  if (!item.channel.trim()) errors.channel = 'Specify the relevant channel or operational focus.';
  if (!item.suggestedTimeframe.trim()) {
    errors.suggestedTimeframe = 'Provide a relative timeframe or phase window.';
  }
  if (!item.successIndicator.trim()) {
    errors.successIndicator = 'Define a concrete completion or success indicator.';
  }

  const hasValidObjId =
    item.supportingObjectiveId.trim().length > 0 &&
    objectives.some((o) => o.id === item.supportingObjectiveId);
  if (!hasValidObjId && !item.supportingObjectiveTitle.trim()) {
    errors.supportingObjectiveId = 'Link this activity to a supporting marketing objective.';
  }

  return errors;
}

// ============================================================================
// PROMPT VARIABLE BUILDER
// ============================================================================

export function buildMarketingPromptVariables(
  brand: Brand,
  state: MarketingStrategyState,
): Record<string, string> {
  const constraintsParts: string[] = [];
  if (state.businessContext.budgetConstraints.trim()) {
    constraintsParts.push(`Budget: ${state.businessContext.budgetConstraints.trim()}`);
  }
  if (state.businessContext.teamCapacity.trim()) {
    constraintsParts.push(`Team Capacity: ${state.businessContext.teamCapacity.trim()}`);
  }
  if (state.businessContext.baselinePerformance.trim()) {
    constraintsParts.push(
      `Known Baselines: ${state.businessContext.baselinePerformance.trim()}`,
    );
  }
  if (state.businessContext.targetTimeline.trim()) {
    constraintsParts.push(`Target Timeline: ${state.businessContext.targetTimeline.trim()}`);
  }
  if (state.businessContext.additionalConstraints.trim()) {
    constraintsParts.push(
      `Additional Constraints: ${state.businessContext.additionalConstraints.trim()}`,
    );
  }

  const vars: Record<string, string> = {};
  if (constraintsParts.length > 0) {
    vars.businessConstraints = constraintsParts.join(' | ');
  }
  if (brand.additionalNotes?.trim()) {
    vars.additionalNotes = brand.additionalNotes.trim();
  }
  return vars;
}

// ============================================================================
// AI RESULT APPLIERS (NON-DESTRUCTIVE — NEVER OVERWRITE APPROVED RECORDS)
// ============================================================================

export function applyAiGoalsObjectivesResult(
  current: MarketingStrategyState,
  executionResult: PromptExecutionResult,
): { applied: boolean; state: MarketingStrategyState; error?: string } {
  if (executionResult.status !== 'success') {
    return { applied: false, state: current, error: 'Prompt execution did not succeed.' };
  }

  const output = executionResult.output;
  const stamp = Date.now();
  const rawGoals = Array.isArray(output.goals) ? output.goals : [];
  const rawObjectives = Array.isArray(output.objectives) ? output.objectives : [];

  const parsedGoals = rawGoals
    .map((item, idx) =>
      normalizeSuggestedGoalItem(
        isPlainObject(item)
          ? { ...item, id: asString(item.id, `ai-goal-${stamp}-${idx + 1}`) }
          : item,
        idx,
      ),
    )
    .filter((item): item is AiSuggestedGoalItem => item !== null)
    .map((item) => ({ ...item, suggestionStatus: 'pending_review' as const }));

  const parsedObjectives = rawObjectives
    .map((item, idx) =>
      normalizeSuggestedObjectiveItem(
        isPlainObject(item)
          ? { ...item, id: asString(item.id, `ai-objective-${stamp}-${idx + 1}`) }
          : item,
        idx,
        current.goals,
      ),
    )
    .filter((item): item is AiSuggestedObjectiveItem => item !== null)
    .map((item) => ({ ...item, suggestionStatus: 'pending_review' as const }));

  if (parsedGoals.length === 0 && parsedObjectives.length === 0) {
    return {
      applied: false,
      state: current,
      error: 'AI returned no structured SMART goals or marketing objectives.',
    };
  }

  return {
    applied: true,
    state: {
      ...current,
      aiSuggestedGoals: parsedGoals,
      aiSuggestedObjectives: parsedObjectives,
      goalsObjectivesSynthesis: {
        promptId: executionResult.metadata.promptId,
        promptVersion: executionResult.metadata.promptVersion,
        sourceClassification: executionResult.metadata.sourceClassification,
        model: executionResult.metadata.model,
        generatedAt: executionResult.metadata.generatedAt,
        researchCaveat:
          asNullableString(output.researchCaveat) ??
          'AI-generated SMART goals and objectives require owner review, adjustment, and explicit approval.',
        suppliedFactsUsed: asStringArray(output.suppliedFactsUsed),
        missingContextNotes: asStringArray(output.missingContextNotes),
        aiSuggestionsSummary: isPlainObject(output.aiSuggestions) ? output.aiSuggestions : null,
      },
    },
  };
}

export function applyAiChannelsTacticsResult(
  current: MarketingStrategyState,
  executionResult: PromptExecutionResult,
): { applied: boolean; state: MarketingStrategyState; error?: string } {
  if (executionResult.status !== 'success') {
    return { applied: false, state: current, error: 'Prompt execution did not succeed.' };
  }

  const output = executionResult.output;
  const stamp = Date.now();
  const rawChannels = Array.isArray(output.channels) ? output.channels : [];
  const rawTactics = Array.isArray(output.tactics) ? output.tactics : [];

  const parsedChannels = rawChannels
    .map((item, idx) =>
      normalizeSuggestedChannelItem(
        isPlainObject(item)
          ? { ...item, id: asString(item.id, `ai-channel-${stamp}-${idx + 1}`) }
          : item,
        idx,
        current.objectives,
      ),
    )
    .filter((item): item is AiSuggestedChannelItem => item !== null)
    .map((item) => ({ ...item, suggestionStatus: 'pending_review' as const }));

  const parsedTactics = rawTactics
    .map((item, idx) =>
      normalizeSuggestedTacticItem(
        isPlainObject(item)
          ? { ...item, id: asString(item.id, `ai-tactic-${stamp}-${idx + 1}`) }
          : item,
        idx,
        current.objectives,
        current.channels,
      ),
    )
    .filter((item): item is AiSuggestedTacticItem => item !== null)
    .map((item) => ({ ...item, suggestionStatus: 'pending_review' as const }));

  if (parsedChannels.length === 0 && parsedTactics.length === 0) {
    return {
      applied: false,
      state: current,
      error: 'AI returned no structured marketing channels or tactics.',
    };
  }

  return {
    applied: true,
    state: {
      ...current,
      aiSuggestedChannels: parsedChannels,
      aiSuggestedTactics: parsedTactics,
      channelsTacticsSynthesis: {
        promptId: executionResult.metadata.promptId,
        promptVersion: executionResult.metadata.promptVersion,
        sourceClassification: executionResult.metadata.sourceClassification,
        model: executionResult.metadata.model,
        generatedAt: executionResult.metadata.generatedAt,
        researchCaveat:
          asNullableString(output.researchCaveat) ??
          'AI-generated channel and tactic recommendations require review and approval before execution.',
        suppliedFactsUsed: asStringArray(output.suppliedFactsUsed),
        missingContextNotes: asStringArray(output.missingContextNotes),
        aiSuggestionsSummary: isPlainObject(output.aiSuggestions) ? output.aiSuggestions : null,
      },
    },
  };
}

export function applyAiKpisResult(
  current: MarketingStrategyState,
  executionResult: PromptExecutionResult,
): { applied: boolean; state: MarketingStrategyState; error?: string } {
  if (executionResult.status !== 'success') {
    return { applied: false, state: current, error: 'Prompt execution did not succeed.' };
  }

  const output = executionResult.output;
  const stamp = Date.now();
  const rawKpis = Array.isArray(output.kpis) ? output.kpis : [];

  const parsedKpis = rawKpis
    .map((item, idx) =>
      normalizeSuggestedKpiItem(
        isPlainObject(item)
          ? { ...item, id: asString(item.id, `ai-kpi-${stamp}-${idx + 1}`) }
          : item,
        idx,
        current.objectives,
      ),
    )
    .filter((item): item is AiSuggestedKpiItem => item !== null)
    .map((item) => ({ ...item, suggestionStatus: 'pending_review' as const }));

  if (parsedKpis.length === 0) {
    return {
      applied: false,
      state: current,
      error: 'AI returned no structured KPI recommendations.',
    };
  }

  return {
    applied: true,
    state: {
      ...current,
      aiSuggestedKpis: parsedKpis,
      kpisSynthesis: {
        promptId: executionResult.metadata.promptId,
        promptVersion: executionResult.metadata.promptVersion,
        sourceClassification: executionResult.metadata.sourceClassification,
        model: executionResult.metadata.model,
        generatedAt: executionResult.metadata.generatedAt,
        researchCaveat:
          asNullableString(output.researchCaveat) ??
          'AI KPI recommendations do not assume unverified baselines; confirm tracking setup and baselines before approval.',
        suppliedFactsUsed: asStringArray(output.suppliedFactsUsed),
        missingContextNotes: asStringArray(output.missingContextNotes),
        aiSuggestionsSummary: isPlainObject(output.aiSuggestions) ? output.aiSuggestions : null,
      },
    },
  };
}

export function applyAiRoadmapResult(
  current: MarketingStrategyState,
  executionResult: PromptExecutionResult,
): { applied: boolean; state: MarketingStrategyState; error?: string } {
  if (executionResult.status !== 'success') {
    return { applied: false, state: current, error: 'Prompt execution did not succeed.' };
  }

  const output = executionResult.output;
  const stamp = Date.now();
  const rawItems = Array.isArray(output.roadmapItems) ? output.roadmapItems : [];

  const parsedItems = rawItems
    .map((item, idx) =>
      normalizeSuggestedRoadmapItem(
        isPlainObject(item)
          ? { ...item, id: asString(item.id, `ai-roadmap-${stamp}-${idx + 1}`) }
          : item,
        idx,
        current.objectives,
      ),
    )
    .filter((item): item is AiSuggestedRoadmapItem => item !== null)
    .map((item) => ({ ...item, suggestionStatus: 'pending_review' as const }));

  if (parsedItems.length === 0) {
    return {
      applied: false,
      state: current,
      error: 'AI returned no structured implementation roadmap items.',
    };
  }

  return {
    applied: true,
    state: {
      ...current,
      aiSuggestedRoadmapItems: parsedItems,
      roadmapSynthesis: {
        promptId: executionResult.metadata.promptId,
        promptVersion: executionResult.metadata.promptVersion,
        sourceClassification: executionResult.metadata.sourceClassification,
        model: executionResult.metadata.model,
        generatedAt: executionResult.metadata.generatedAt,
        researchCaveat:
          asNullableString(output.researchCaveat) ??
          'AI roadmap sequencing is a proposal pending owner confirmation of budget, capacity, and timing.',
        suppliedFactsUsed: asStringArray(output.suppliedFactsUsed),
        missingContextNotes: asStringArray(output.missingContextNotes),
        aiSuggestionsSummary: isPlainObject(output.aiSuggestions) ? output.aiSuggestions : null,
      },
    },
  };
}

// ============================================================================
// ADOPT / DISMISS SUGGESTIONS (ALWAYS LAND AS UNAPPROVED DRAFTS FIRST)
// ============================================================================

export function adoptAiGoalSuggestion(
  state: MarketingStrategyState,
  suggestionId: string,
  newId: string,
): { state: MarketingStrategyState; adopted: SmartMarketingGoalItem | null } {
  const suggestion = state.aiSuggestedGoals.find((s) => s.id === suggestionId);
  if (!suggestion) return { state, adopted: null };

  const adopted: SmartMarketingGoalItem = {
    id: newId,
    title: suggestion.title,
    description: suggestion.description,
    strategicRationale: suggestion.strategicRationale,
    targetAudience: suggestion.targetAudience,
    supportingBusinessObjective: suggestion.supportingBusinessObjective,
    successMetrics: [...suggestion.successMetrics],
    targetValue: suggestion.targetValue,
    measurementPeriod: suggestion.measurementPeriod,
    recommendedTimeframe: suggestion.recommendedTimeframe,
    source: 'ai_adopted',
    aiHypothesisNote:
      state.goalsObjectivesSynthesis.researchCaveat ??
      'Adopted from AI recommendation; review and explicitly approve.',
    approved: false,
    approvedAt: null,
  };

  return {
    adopted,
    state: {
      ...state,
      completedAt: null,
      approvedSummary: null,
      goals: [...state.goals, adopted],
      aiSuggestedGoals: state.aiSuggestedGoals.map((item) =>
        item.id === suggestionId ? { ...item, suggestionStatus: 'approved' } : item,
      ),
    },
  };
}

export function dismissAiGoalSuggestion(
  state: MarketingStrategyState,
  suggestionId: string,
): MarketingStrategyState {
  return {
    ...state,
    aiSuggestedGoals: state.aiSuggestedGoals.map((item) =>
      item.id === suggestionId ? { ...item, suggestionStatus: 'rejected' } : item,
    ),
  };
}

export function adoptAiObjectiveSuggestion(
  state: MarketingStrategyState,
  suggestionId: string,
  newId: string,
): { state: MarketingStrategyState; adopted: MarketingObjectiveItem | null } {
  const suggestion = state.aiSuggestedObjectives.find((s) => s.id === suggestionId);
  if (!suggestion) return { state, adopted: null };

  const matchedGoal =
    state.goals.find((g) => g.id === suggestion.matchedGoalId) ??
    matchByTitle(suggestion.supportingGoalTitle, state.goals, (g) => g.title) ??
    state.goals.find((g) => g.approved) ??
    state.goals[0] ??
    null;

  const adopted: MarketingObjectiveItem = {
    id: newId,
    title: suggestion.title,
    description: suggestion.description,
    intendedBusinessOutcome: suggestion.intendedBusinessOutcome,
    targetAudience: suggestion.targetAudience,
    supportingGoalId: matchedGoal?.id ?? '',
    supportingGoalTitle: matchedGoal?.title ?? suggestion.supportingGoalTitle,
    measurementCriteria: suggestion.measurementCriteria,
    priority: suggestion.priority,
    source: 'ai_adopted',
    approved: false,
    approvedAt: null,
  };

  return {
    adopted,
    state: {
      ...state,
      completedAt: null,
      approvedSummary: null,
      objectives: [...state.objectives, adopted],
      aiSuggestedObjectives: state.aiSuggestedObjectives.map((item) =>
        item.id === suggestionId ? { ...item, suggestionStatus: 'approved' } : item,
      ),
    },
  };
}

export function dismissAiObjectiveSuggestion(
  state: MarketingStrategyState,
  suggestionId: string,
): MarketingStrategyState {
  return {
    ...state,
    aiSuggestedObjectives: state.aiSuggestedObjectives.map((item) =>
      item.id === suggestionId ? { ...item, suggestionStatus: 'rejected' } : item,
    ),
  };
}

export function adoptAiChannelSuggestion(
  state: MarketingStrategyState,
  suggestionId: string,
  newId: string,
): { state: MarketingStrategyState; adopted: MarketingChannelItem | null } {
  const suggestion = state.aiSuggestedChannels.find((s) => s.id === suggestionId);
  if (!suggestion) return { state, adopted: null };

  const matchedObj =
    state.objectives.find((o) => o.id === suggestion.matchedObjectiveId) ??
    matchByTitle(suggestion.supportingObjectiveTitle, state.objectives, (o) => o.title) ??
    state.objectives.find((o) => o.approved) ??
    state.objectives[0] ??
    null;

  const adopted: MarketingChannelItem = {
    id: newId,
    channelName: suggestion.channelName,
    strategicRationale: suggestion.strategicRationale,
    relevantAudience: suggestion.relevantAudience,
    recommendedUse: suggestion.recommendedUse,
    expectedContribution: suggestion.expectedContribution,
    priority: suggestion.priority,
    supportingObjectiveId: matchedObj?.id ?? '',
    supportingObjectiveTitle: matchedObj?.title ?? suggestion.supportingObjectiveTitle,
    source: 'ai_adopted',
    approved: false,
    approvedAt: null,
  };

  return {
    adopted,
    state: {
      ...state,
      completedAt: null,
      approvedSummary: null,
      channels: [...state.channels, adopted],
      aiSuggestedChannels: state.aiSuggestedChannels.map((item) =>
        item.id === suggestionId ? { ...item, suggestionStatus: 'approved' } : item,
      ),
    },
  };
}

export function dismissAiChannelSuggestion(
  state: MarketingStrategyState,
  suggestionId: string,
): MarketingStrategyState {
  return {
    ...state,
    aiSuggestedChannels: state.aiSuggestedChannels.map((item) =>
      item.id === suggestionId ? { ...item, suggestionStatus: 'rejected' } : item,
    ),
  };
}

export function adoptAiTacticSuggestion(
  state: MarketingStrategyState,
  suggestionId: string,
  newId: string,
): { state: MarketingStrategyState; adopted: MarketingTacticItem | null } {
  const suggestion = state.aiSuggestedTactics.find((s) => s.id === suggestionId);
  if (!suggestion) return { state, adopted: null };

  const matchedObj =
    state.objectives.find((o) => o.id === suggestion.matchedObjectiveId) ??
    matchByTitle(suggestion.supportingObjectiveTitle, state.objectives, (o) => o.title) ??
    state.objectives.find((o) => o.approved) ??
    state.objectives[0] ??
    null;

  const matchedChan =
    state.channels.find((c) => c.id === suggestion.matchedChannelId) ??
    matchByTitle(suggestion.recommendedChannelName, state.channels, (c) => c.channelName) ??
    state.channels.find((c) => c.approved) ??
    state.channels[0] ??
    null;

  const adopted: MarketingTacticItem = {
    id: newId,
    tacticName: suggestion.tacticName,
    description: suggestion.description,
    supportingObjectiveId: matchedObj?.id ?? '',
    supportingObjectiveTitle: matchedObj?.title ?? suggestion.supportingObjectiveTitle,
    recommendedChannelId: matchedChan?.id ?? '',
    recommendedChannelName: matchedChan?.channelName ?? suggestion.recommendedChannelName,
    targetAudience: suggestion.targetAudience,
    executionGuidance: suggestion.executionGuidance,
    suggestedFrequency: suggestion.suggestedFrequency,
    successMetric: suggestion.successMetric,
    priority: suggestion.priority,
    source: 'ai_adopted',
    approved: false,
    approvedAt: null,
  };

  return {
    adopted,
    state: {
      ...state,
      completedAt: null,
      approvedSummary: null,
      tactics: [...state.tactics, adopted],
      aiSuggestedTactics: state.aiSuggestedTactics.map((item) =>
        item.id === suggestionId ? { ...item, suggestionStatus: 'approved' } : item,
      ),
    },
  };
}

export function dismissAiTacticSuggestion(
  state: MarketingStrategyState,
  suggestionId: string,
): MarketingStrategyState {
  return {
    ...state,
    aiSuggestedTactics: state.aiSuggestedTactics.map((item) =>
      item.id === suggestionId ? { ...item, suggestionStatus: 'rejected' } : item,
    ),
  };
}

export function adoptAiKpiSuggestion(
  state: MarketingStrategyState,
  suggestionId: string,
  newId: string,
): { state: MarketingStrategyState; adopted: MarketingKpiItem | null } {
  const suggestion = state.aiSuggestedKpis.find((s) => s.id === suggestionId);
  if (!suggestion) return { state, adopted: null };

  const matchedObj =
    state.objectives.find((o) => o.id === suggestion.matchedObjectiveId) ??
    matchByTitle(suggestion.relatedObjectiveTitle, state.objectives, (o) => o.title) ??
    state.objectives.find((o) => o.approved) ??
    state.objectives[0] ??
    null;

  const adopted: MarketingKpiItem = {
    id: newId,
    kpiName: suggestion.kpiName,
    description: suggestion.description,
    whatItMeasures: suggestion.whatItMeasures,
    relatedObjectiveId: matchedObj?.id ?? '',
    relatedObjectiveTitle: matchedObj?.title ?? suggestion.relatedObjectiveTitle,
    measurementMethod: suggestion.measurementMethod,
    reportingFrequency: suggestion.reportingFrequency,
    classification: suggestion.classification,
    baselineNote: suggestion.baselineNote,
    source: 'ai_adopted',
    approved: false,
    approvedAt: null,
  };

  return {
    adopted,
    state: {
      ...state,
      completedAt: null,
      approvedSummary: null,
      kpis: [...state.kpis, adopted],
      aiSuggestedKpis: state.aiSuggestedKpis.map((item) =>
        item.id === suggestionId ? { ...item, suggestionStatus: 'approved' } : item,
      ),
    },
  };
}

export function dismissAiKpiSuggestion(
  state: MarketingStrategyState,
  suggestionId: string,
): MarketingStrategyState {
  return {
    ...state,
    aiSuggestedKpis: state.aiSuggestedKpis.map((item) =>
      item.id === suggestionId ? { ...item, suggestionStatus: 'rejected' } : item,
    ),
  };
}

export function adoptAiRoadmapSuggestion(
  state: MarketingStrategyState,
  suggestionId: string,
  newId: string,
): { state: MarketingStrategyState; adopted: ImplementationRoadmapItem | null } {
  const suggestion = state.aiSuggestedRoadmapItems.find((s) => s.id === suggestionId);
  if (!suggestion) return { state, adopted: null };

  const matchedObj =
    state.objectives.find((o) => o.id === suggestion.matchedObjectiveId) ??
    matchByTitle(suggestion.supportingObjectiveTitle, state.objectives, (o) => o.title) ??
    state.objectives.find((o) => o.approved) ??
    state.objectives[0] ??
    null;

  const adopted: ImplementationRoadmapItem = {
    id: newId,
    phase: suggestion.phase,
    activity: suggestion.activity,
    description: suggestion.description,
    supportingObjectiveId: matchedObj?.id ?? '',
    supportingObjectiveTitle: matchedObj?.title ?? suggestion.supportingObjectiveTitle,
    channel: suggestion.channel,
    priority: suggestion.priority,
    suggestedTimeframe: suggestion.suggestedTimeframe,
    dependencies: [...suggestion.dependencies],
    successIndicator: suggestion.successIndicator,
    decisionInputNeeded: suggestion.decisionInputNeeded,
    source: 'ai_adopted',
    approved: false,
    approvedAt: null,
  };

  return {
    adopted,
    state: {
      ...state,
      completedAt: null,
      approvedSummary: null,
      roadmapItems: [...state.roadmapItems, adopted],
      aiSuggestedRoadmapItems: state.aiSuggestedRoadmapItems.map((item) =>
        item.id === suggestionId ? { ...item, suggestionStatus: 'approved' } : item,
      ),
    },
  };
}

export function dismissAiRoadmapSuggestion(
  state: MarketingStrategyState,
  suggestionId: string,
): MarketingStrategyState {
  return {
    ...state,
    aiSuggestedRoadmapItems: state.aiSuggestedRoadmapItems.map((item) =>
      item.id === suggestionId ? { ...item, suggestionStatus: 'rejected' } : item,
    ),
  };
}

// ============================================================================
// CASCADE-SAFE DELETIONS
// ============================================================================

export function removeGoalFromState(
  state: MarketingStrategyState,
  goalId: string,
): MarketingStrategyState {
  return {
    ...state,
    completedAt: null,
    approvedSummary: null,
    goals: state.goals.filter((g) => g.id !== goalId),
    objectives: state.objectives.map((obj) =>
      obj.supportingGoalId === goalId
        ? {
            ...obj,
            supportingGoalId: '',
            supportingGoalTitle: '',
            approved: false,
            approvedAt: null,
          }
        : obj,
    ),
    aiSuggestedObjectives: state.aiSuggestedObjectives.map((item) =>
      item.matchedGoalId === goalId ? { ...item, matchedGoalId: '' } : item,
    ),
  };
}

export function removeObjectiveFromState(
  state: MarketingStrategyState,
  objectiveId: string,
): MarketingStrategyState {
  return {
    ...state,
    completedAt: null,
    approvedSummary: null,
    objectives: state.objectives.filter((o) => o.id !== objectiveId),
    channels: state.channels.map((ch) =>
      ch.supportingObjectiveId === objectiveId
        ? {
            ...ch,
            supportingObjectiveId: '',
            supportingObjectiveTitle: '',
            approved: false,
            approvedAt: null,
          }
        : ch,
    ),
    tactics: state.tactics.map((t) =>
      t.supportingObjectiveId === objectiveId
        ? {
            ...t,
            supportingObjectiveId: '',
            supportingObjectiveTitle: '',
            approved: false,
            approvedAt: null,
          }
        : t,
    ),
    kpis: state.kpis.map((k) =>
      k.relatedObjectiveId === objectiveId
        ? {
            ...k,
            relatedObjectiveId: '',
            relatedObjectiveTitle: '',
            approved: false,
            approvedAt: null,
          }
        : k,
    ),
    roadmapItems: state.roadmapItems.map((r) =>
      r.supportingObjectiveId === objectiveId
        ? {
            ...r,
            supportingObjectiveId: '',
            supportingObjectiveTitle: '',
            approved: false,
            approvedAt: null,
          }
        : r,
    ),
  };
}

export function removeChannelFromState(
  state: MarketingStrategyState,
  channelId: string,
): MarketingStrategyState {
  return {
    ...state,
    completedAt: null,
    approvedSummary: null,
    channels: state.channels.filter((c) => c.id !== channelId),
    tactics: state.tactics.map((t) =>
      t.recommendedChannelId === channelId
        ? {
            ...t,
            recommendedChannelId: '',
            recommendedChannelName: '',
            approved: false,
            approvedAt: null,
          }
        : t,
    ),
  };
}

export function removeTacticFromState(
  state: MarketingStrategyState,
  tacticId: string,
): MarketingStrategyState {
  return {
    ...state,
    completedAt: null,
    approvedSummary: null,
    tactics: state.tactics.filter((t) => t.id !== tacticId),
  };
}

export function removeKpiFromState(
  state: MarketingStrategyState,
  kpiId: string,
): MarketingStrategyState {
  return {
    ...state,
    completedAt: null,
    approvedSummary: null,
    kpis: state.kpis.filter((k) => k.id !== kpiId),
  };
}

export function removeRoadmapItemFromState(
  state: MarketingStrategyState,
  roadmapId: string,
): MarketingStrategyState {
  return {
    ...state,
    completedAt: null,
    approvedSummary: null,
    roadmapItems: state.roadmapItems.filter((r) => r.id !== roadmapId),
  };
}

// ============================================================================
// PROGRESS, COMPLETION GATING & INFORMATION GAPS
// ============================================================================

export interface MarketingStrategyProgressSummary {
  approvedCount: number;
  totalSections: number;
  percentage: number;
  allSectionsApproved: boolean;
  approvedCounts: Record<MarketingStrategySectionKey, number>;
  totalCounts: Record<MarketingStrategySectionKey, number>;
  pendingSuggestions: Record<MarketingStrategySectionKey, number>;
  sectionStatuses: Record<MarketingStrategySectionKey, 'approved' | 'in_progress' | 'not_started'>;
}

export function computeMarketingStrategyProgress(
  state: MarketingStrategyState,
): MarketingStrategyProgressSummary {
  const validApprovedGoals = state.goals.filter(
    (g) => g.approved && Object.keys(validateSmartGoal(g)).length === 0,
  );
  const validApprovedObjectives = state.objectives.filter(
    (o) => o.approved && Object.keys(validateMarketingObjective(o, state.goals)).length === 0,
  );
  const validApprovedChannels = state.channels.filter(
    (c) => c.approved && Object.keys(validateMarketingChannel(c, state.objectives)).length === 0,
  );
  const validApprovedTactics = state.tactics.filter(
    (t) =>
      t.approved &&
      Object.keys(validateMarketingTactic(t, state.objectives, state.channels)).length === 0,
  );
  const validApprovedKpis = state.kpis.filter(
    (k) => k.approved && Object.keys(validateMarketingKpi(k, state.objectives)).length === 0,
  );
  const validApprovedRoadmap = state.roadmapItems.filter(
    (r) => r.approved && Object.keys(validateRoadmapActivity(r, state.objectives)).length === 0,
  );

  const approvedCounts: Record<MarketingStrategySectionKey, number> = {
    goals: validApprovedGoals.length,
    objectives: validApprovedObjectives.length,
    channels: validApprovedChannels.length,
    tactics: validApprovedTactics.length,
    kpis: validApprovedKpis.length,
    roadmap: validApprovedRoadmap.length,
  };

  const totalCounts: Record<MarketingStrategySectionKey, number> = {
    goals: state.goals.length,
    objectives: state.objectives.length,
    channels: state.channels.length,
    tactics: state.tactics.length,
    kpis: state.kpis.length,
    roadmap: state.roadmapItems.length,
  };

  const pendingSuggestions: Record<MarketingStrategySectionKey, number> = {
    goals: state.aiSuggestedGoals.filter((s) => s.suggestionStatus === 'pending_review').length,
    objectives: state.aiSuggestedObjectives.filter((s) => s.suggestionStatus === 'pending_review')
      .length,
    channels: state.aiSuggestedChannels.filter((s) => s.suggestionStatus === 'pending_review')
      .length,
    tactics: state.aiSuggestedTactics.filter((s) => s.suggestionStatus === 'pending_review')
      .length,
    kpis: state.aiSuggestedKpis.filter((s) => s.suggestionStatus === 'pending_review').length,
    roadmap: state.aiSuggestedRoadmapItems.filter((s) => s.suggestionStatus === 'pending_review')
      .length,
  };

  const resolveStatus = (
    key: MarketingStrategySectionKey,
  ): 'approved' | 'in_progress' | 'not_started' => {
    if (approvedCounts[key] > 0) return 'approved';
    if (totalCounts[key] > 0 || pendingSuggestions[key] > 0) return 'in_progress';
    return 'not_started';
  };

  const sectionStatuses: Record<
    MarketingStrategySectionKey,
    'approved' | 'in_progress' | 'not_started'
  > = {
    goals: resolveStatus('goals'),
    objectives: resolveStatus('objectives'),
    channels: resolveStatus('channels'),
    tactics: resolveStatus('tactics'),
    kpis: resolveStatus('kpis'),
    roadmap: resolveStatus('roadmap'),
  };

  const approvedCount = (Object.values(sectionStatuses) as Array<string>).filter(
    (s) => s === 'approved',
  ).length;

  return {
    approvedCount,
    totalSections: 6,
    percentage: Math.round((approvedCount / 6) * 100),
    allSectionsApproved: approvedCount === 6,
    approvedCounts,
    totalCounts,
    pendingSuggestions,
    sectionStatuses,
  };
}

export function canCompleteMarketingStrategy(state: MarketingStrategyState): {
  allowed: boolean;
  blockers: string[];
  incompleteSections: MarketingStrategySectionKey[];
} {
  const blockers: string[] = [];
  const incompleteSections: MarketingStrategySectionKey[] = [];

  const approvedGoals = state.goals.filter((g) => g.approved);
  const invalidGoal = approvedGoals.find((g) => Object.keys(validateSmartGoal(g)).length > 0);
  if (approvedGoals.length === 0) {
    incompleteSections.push('goals');
    blockers.push('Approve at least one complete SMART Marketing Goal.');
  } else if (invalidGoal) {
    incompleteSections.push('goals');
    blockers.push(`Approved goal "${invalidGoal.title || 'Untitled'}" is incomplete.`);
  }

  const approvedObjectives = state.objectives.filter((o) => o.approved);
  const invalidObjective = approvedObjectives.find(
    (o) => Object.keys(validateMarketingObjective(o, state.goals)).length > 0,
  );
  if (approvedObjectives.length === 0) {
    incompleteSections.push('objectives');
    blockers.push('Approve at least one Marketing Objective linked to a goal.');
  } else if (invalidObjective) {
    incompleteSections.push('objectives');
    blockers.push(
      `Approved objective "${invalidObjective.title || 'Untitled'}" is missing required fields or a linked goal.`,
    );
  }

  const approvedChannels = state.channels.filter((c) => c.approved);
  const invalidChannel = approvedChannels.find(
    (c) => Object.keys(validateMarketingChannel(c, state.objectives)).length > 0,
  );
  if (approvedChannels.length === 0) {
    incompleteSections.push('channels');
    blockers.push('Approve at least one justified Marketing Channel.');
  } else if (invalidChannel) {
    incompleteSections.push('channels');
    blockers.push(
      `Approved channel "${invalidChannel.channelName || 'Untitled'}" is missing required details.`,
    );
  }

  const approvedTactics = state.tactics.filter((t) => t.approved);
  const invalidTactic = approvedTactics.find(
    (t) => Object.keys(validateMarketingTactic(t, state.objectives, state.channels)).length > 0,
  );
  if (approvedTactics.length === 0) {
    incompleteSections.push('tactics');
    blockers.push('Approve at least one specific, execution-ready Marketing Tactic.');
  } else if (invalidTactic) {
    incompleteSections.push('tactics');
    blockers.push(
      `Approved tactic "${invalidTactic.tacticName || 'Untitled'}" is incomplete or lacks concrete execution guidance.`,
    );
  }

  const approvedKpis = state.kpis.filter((k) => k.approved);
  const invalidKpi = approvedKpis.find(
    (k) => Object.keys(validateMarketingKpi(k, state.objectives)).length > 0,
  );
  if (approvedKpis.length === 0) {
    incompleteSections.push('kpis');
    blockers.push('Approve at least one KPI & Measurement item.');
  } else if (invalidKpi) {
    incompleteSections.push('kpis');
    blockers.push(`Approved KPI "${invalidKpi.kpiName || 'Untitled'}" is incomplete.`);
  }

  const approvedRoadmap = state.roadmapItems.filter((r) => r.approved);
  const invalidRoadmap = approvedRoadmap.find(
    (r) => Object.keys(validateRoadmapActivity(r, state.objectives)).length > 0,
  );
  if (approvedRoadmap.length === 0) {
    incompleteSections.push('roadmap');
    blockers.push('Approve at least one Implementation Roadmap activity.');
  } else if (invalidRoadmap) {
    incompleteSections.push('roadmap');
    blockers.push(
      `Approved roadmap activity "${invalidRoadmap.activity || 'Untitled'}" is incomplete.`,
    );
  }

  return {
    allowed: blockers.length === 0,
    blockers,
    incompleteSections,
  };
}

export function collectOutstandingInformationGaps(state: MarketingStrategyState): {
  missingContextNotes: string[];
  roadmapDecisionsNeeded: Array<{ activity: string; phase: string; decision: string }>;
  baselinesToEstablish: Array<{ kpiName: string; baselineNote: string }>;
} {
  const notesSet = new Set<string>();
  const runs = [
    state.goalsObjectivesSynthesis,
    state.channelsTacticsSynthesis,
    state.kpisSynthesis,
    state.roadmapSynthesis,
  ];
  for (const run of runs) {
    for (const note of run.missingContextNotes) {
      if (note.trim()) notesSet.add(note.trim());
    }
  }

  const roadmapDecisionsNeeded = state.roadmapItems
    .filter((item) => item.decisionInputNeeded.trim().length > 0)
    .map((item) => ({
      activity: item.activity || 'Untitled Activity',
      phase: item.phase || 'Unassigned Phase',
      decision: item.decisionInputNeeded.trim(),
    }));

  const baselinesToEstablish = state.kpis
    .filter(
      (kpi) =>
        kpi.baselineNote.trim().length > 0 &&
        /establish|not\s+provided|capture|unknown|tbd|missing|no\s+baseline/i.test(kpi.baselineNote),
    )
    .map((kpi) => ({
      kpiName: kpi.kpiName || 'Untitled KPI',
      baselineNote: kpi.baselineNote.trim(),
    }));

  return {
    missingContextNotes: Array.from(notesSet),
    roadmapDecisionsNeeded,
    baselinesToEstablish,
  };
}

// ============================================================================
// HYDRATION & PERSISTENCE PAYLOAD BUILDER
// ============================================================================

export function hydrateMarketingStrategyState(
  brand: Brand,
  moduleRecord: BrandStrategyModule | null | undefined,
  upstreamSnapshot: MarketingStrategyUpstreamSnapshot | null = null,
): MarketingStrategyState {
  const initial = createInitialMarketingStrategyState(brand, upstreamSnapshot);
  if (!moduleRecord) {
    return initial;
  }

  if (moduleRecord.brandId !== brand.id) {
    throw new MarketingStrategyIsolationError(
      `Brand context isolation error: loaded strategy module belongs to brand "${moduleRecord.brandId}" rather than "${brand.id}".`,
    );
  }

  if (moduleRecord.moduleKey !== 'marketingStrategy') {
    throw new MarketingStrategyIsolationError(
      `Unexpected module key "${moduleRecord.moduleKey}" when hydrating Marketing Strategy.`,
    );
  }

  const content = moduleRecord.content ?? {};
  if (typeof content.brandId === 'string' && content.brandId && content.brandId !== brand.id) {
    throw new MarketingStrategyIsolationError(
      `Persisted marketing strategy content belongs to brand "${content.brandId}" rather than "${brand.id}".`,
    );
  }

  const goals = (Array.isArray(content.goals) ? content.goals : [])
    .map((item, idx) => normalizeGoalItem(item, idx))
    .filter((item): item is SmartMarketingGoalItem => item !== null);

  const aiSuggestedGoals = (Array.isArray(content.aiSuggestedGoals) ? content.aiSuggestedGoals : [])
    .map((item, idx) => normalizeSuggestedGoalItem(item, idx))
    .filter((item): item is AiSuggestedGoalItem => item !== null);

  const objectives = (Array.isArray(content.objectives) ? content.objectives : [])
    .map((item, idx) => normalizeObjectiveItem(item, idx))
    .filter((item): item is MarketingObjectiveItem => item !== null);

  const aiSuggestedObjectives = (
    Array.isArray(content.aiSuggestedObjectives) ? content.aiSuggestedObjectives : []
  )
    .map((item, idx) => normalizeSuggestedObjectiveItem(item, idx, goals))
    .filter((item): item is AiSuggestedObjectiveItem => item !== null);

  const channels = (Array.isArray(content.channels) ? content.channels : [])
    .map((item, idx) => normalizeChannelItem(item, idx))
    .filter((item): item is MarketingChannelItem => item !== null);

  const aiSuggestedChannels = (
    Array.isArray(content.aiSuggestedChannels) ? content.aiSuggestedChannels : []
  )
    .map((item, idx) => normalizeSuggestedChannelItem(item, idx, objectives))
    .filter((item): item is AiSuggestedChannelItem => item !== null);

  const tactics = (Array.isArray(content.tactics) ? content.tactics : [])
    .map((item, idx) => normalizeTacticItem(item, idx))
    .filter((item): item is MarketingTacticItem => item !== null);

  const aiSuggestedTactics = (
    Array.isArray(content.aiSuggestedTactics) ? content.aiSuggestedTactics : []
  )
    .map((item, idx) => normalizeSuggestedTacticItem(item, idx, objectives, channels))
    .filter((item): item is AiSuggestedTacticItem => item !== null);

  const kpis = (Array.isArray(content.kpis) ? content.kpis : [])
    .map((item, idx) => normalizeKpiItem(item, idx))
    .filter((item): item is MarketingKpiItem => item !== null);

  const aiSuggestedKpis = (Array.isArray(content.aiSuggestedKpis) ? content.aiSuggestedKpis : [])
    .map((item, idx) => normalizeSuggestedKpiItem(item, idx, objectives))
    .filter((item): item is AiSuggestedKpiItem => item !== null);

  const roadmapItems = (Array.isArray(content.roadmapItems) ? content.roadmapItems : [])
    .map((item, idx) => normalizeRoadmapItem(item, idx))
    .filter((item): item is ImplementationRoadmapItem => item !== null);

  const aiSuggestedRoadmapItems = (
    Array.isArray(content.aiSuggestedRoadmapItems) ? content.aiSuggestedRoadmapItems : []
  )
    .map((item, idx) => normalizeSuggestedRoadmapItem(item, idx, objectives))
    .filter((item): item is AiSuggestedRoadmapItem => item !== null);

  const persistedUpstream = isPlainObject(content.upstreamSnapshot)
    ? {
        foundationApprovedAt: asNullableString(content.upstreamSnapshot.foundationApprovedAt),
        messagingApprovedAt: asNullableString(content.upstreamSnapshot.messagingApprovedAt),
        customerIntelUpdatedAt: asNullableString(content.upstreamSnapshot.customerIntelUpdatedAt),
        approvedPersonasCount:
          typeof content.upstreamSnapshot.approvedPersonasCount === 'number'
            ? content.upstreamSnapshot.approvedPersonasCount
            : 0,
        approvedInterestsCount:
          typeof content.upstreamSnapshot.approvedInterestsCount === 'number'
            ? content.upstreamSnapshot.approvedInterestsCount
            : 0,
        positioningStatement: asString(content.upstreamSnapshot.positioningStatement),
        coreValueProposition: asString(content.upstreamSnapshot.coreValueProposition),
        primaryPersonaNames: asStringArray(content.upstreamSnapshot.primaryPersonaNames),
        primaryInterestTopics: asStringArray(content.upstreamSnapshot.primaryInterestTopics),
      }
    : null;

  const isCompleted = moduleRecord.status === 'completed';
  const rawSummary = isCompleted && isPlainObject(content.approvedSummary)
    ? (content.approvedSummary as unknown as MarketingStrategyApprovedSummary)
    : null;

  return {
    schemaVersion: 1,
    brandId: brand.id,
    upstreamSnapshot: upstreamSnapshot ?? persistedUpstream,
    businessContext: normalizeBusinessContext(content.businessContext),
    goals,
    aiSuggestedGoals,
    objectives,
    aiSuggestedObjectives,
    channels,
    aiSuggestedChannels,
    tactics,
    aiSuggestedTactics,
    kpis,
    aiSuggestedKpis,
    roadmapItems,
    aiSuggestedRoadmapItems,
    goalsObjectivesSynthesis: normalizeAiRunState(content.goalsObjectivesSynthesis),
    channelsTacticsSynthesis: normalizeAiRunState(content.channelsTacticsSynthesis),
    kpisSynthesis: normalizeAiRunState(content.kpisSynthesis),
    roadmapSynthesis: normalizeAiRunState(content.roadmapSynthesis),
    completedAt: isCompleted ? asNullableString(content.completedAt) : null,
    approvedSummary: rawSummary,
  };
}

export function buildMarketingStrategyUpsertPayload(
  state: MarketingStrategyState,
  requestedStatus: ModuleStatus,
): UpsertBrandModuleInput {
  let effectiveStatus = requestedStatus;
  let completedAt = state.completedAt;
  let approvedSummary = state.approvedSummary;

  if (requestedStatus === 'completed') {
    const check = canCompleteMarketingStrategy(state);
    if (!check.allowed) {
      throw new Error(
        check.blockers[0] ??
          'All six Marketing Strategy sections must contain valid approved items before completing.',
      );
    }

    const nowIso = new Date().toISOString();
    completedAt = nowIso;
    approvedSummary = {
      goals: state.goals.filter((g) => g.approved),
      objectives: state.objectives.filter((o) => o.approved),
      channels: state.channels.filter((c) => c.approved),
      tactics: state.tactics.filter((t) => t.approved),
      kpis: state.kpis.filter((k) => k.approved),
      roadmapItems: state.roadmapItems.filter((r) => r.approved),
      businessContext: { ...state.businessContext },
      approvedAt: nowIso,
    };
  } else {
    completedAt = null;
    approvedSummary = null;
  }

  // Pick the most recent AI execution metadata across all 4 modular runs
  const runs = [
    state.goalsObjectivesSynthesis,
    state.channelsTacticsSynthesis,
    state.kpisSynthesis,
    state.roadmapSynthesis,
  ].filter((run) => run.generatedAt !== null);

  runs.sort((a, b) => (b.generatedAt ?? '').localeCompare(a.generatedAt ?? ''));
  const latestRun = runs[0] ?? null;

  return {
    status: effectiveStatus,
    content: {
      ...state,
      completedAt,
      approvedSummary,
    },
    promptId: latestRun?.promptId ?? null,
    promptVersion: latestRun?.promptVersion ?? null,
    model: latestRun?.model ?? null,
    generatedAt: latestRun?.generatedAt ?? null,
  };
}
