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
import type {
  ApprovedMessagingSnapshot,
  AudienceInterestItem,
  CustomerPersonaItem,
} from './customerIntelligenceLogic.ts';
import {
  MarketingStrategyIsolationError,
  canCompleteMarketingStrategy,
  evaluateMarketingStrategyDependencies,
  hydrateMarketingStrategyState,
  type ImplementationRoadmapItem,
  type MarketingChannelItem,
  type MarketingKpiItem,
  type MarketingObjectiveItem,
  type MarketingTacticItem,
  type SmartMarketingGoalItem,
  type StrategyItemSource,
  type SuggestionReviewStatus,
} from './marketingStrategyLogic.ts';

export type ContentStrategySectionKey =
  | 'objectives'
  | 'pillars'
  | 'themes'
  | 'formats'
  | 'distribution'
  | 'governance';

export type ContentStrategyStepKey = ContentStrategySectionKey | 'review';
export type ContentObjectiveLevel = 'primary' | 'supporting';
export type GovernanceCategory =
  | 'quality_standard'
  | 'voice_and_messaging'
  | 'editorial_workflow'
  | 'performance_measurement';

export interface EditorialConstraintsInput {
  publishingCapacity: string;
  productionConstraints: string;
  editorialNotes: string;
}

export interface ContentObjectiveItem {
  id: string;
  title: string;
  level: ContentObjectiveLevel;
  description: string;
  targetAudienceOutcomes: string[];
  desiredAudienceActions: string[];
  alignedMarketingGoalTitle: string;
  alignedMarketingObjectiveTitle: string;
  source: StrategyItemSource;
  approved: boolean;
  approvedAt: string | null;
}

export interface AiSuggestedContentObjectiveItem {
  id: string;
  title: string;
  level: ContentObjectiveLevel;
  description: string;
  targetAudienceOutcomes: string[];
  desiredAudienceActions: string[];
  alignedMarketingGoalTitle: string;
  alignedMarketingObjectiveTitle: string;
  suggestionStatus: SuggestionReviewStatus;
}

export interface ContentPillarItem {
  id: string;
  name: string;
  description: string;
  strategicPurpose: string;
  targetAudienceSegment: string;
  relevantInterestsAndPainPoints: string[];
  keyMessages: string[];
  supportingTopics: string[];
  alignedMarketingObjectiveTitle: string;
  source: StrategyItemSource;
  approved: boolean;
  approvedAt: string | null;
}

export interface AiSuggestedContentPillarItem {
  id: string;
  name: string;
  description: string;
  strategicPurpose: string;
  targetAudienceSegment: string;
  relevantInterestsAndPainPoints: string[];
  keyMessages: string[];
  supportingTopics: string[];
  alignedMarketingObjectiveTitle: string;
  suggestionStatus: SuggestionReviewStatus;
}

export interface ContentThemeTopicItem {
  id: string;
  title: string;
  description: string;
  associatedPillarId: string;
  associatedPillarName: string;
  audienceRelevance: string;
  addressedNeedOrAspiration: string;
  communicationAngle: string;
  alignedMarketingObjectiveTitle: string;
  source: StrategyItemSource;
  approved: boolean;
  approvedAt: string | null;
}

export interface AiSuggestedContentThemeTopicItem {
  id: string;
  title: string;
  description: string;
  associatedPillarName: string;
  matchedPillarId: string;
  audienceRelevance: string;
  addressedNeedOrAspiration: string;
  communicationAngle: string;
  alignedMarketingObjectiveTitle: string;
  suggestionStatus: SuggestionReviewStatus;
}

export interface ContentFormatItem {
  id: string;
  formatName: string;
  purpose: string;
  suitablePlatforms: string[];
  audienceSuitability: string;
  relatedPillarNames: string[];
  source: StrategyItemSource;
  approved: boolean;
  approvedAt: string | null;
}

export interface AiSuggestedContentFormatItem {
  id: string;
  formatName: string;
  purpose: string;
  suitablePlatforms: string[];
  audienceSuitability: string;
  relatedPillarNames: string[];
  suggestionStatus: SuggestionReviewStatus;
}

export interface ContentSeriesItem {
  id: string;
  seriesName: string;
  description: string;
  formatName: string;
  suitablePlatforms: string[];
  relatedPillarNames: string[];
  audienceSuitability: string;
  cadenceHint: string;
  source: StrategyItemSource;
  approved: boolean;
  approvedAt: string | null;
}

export interface AiSuggestedContentSeriesItem {
  id: string;
  seriesName: string;
  description: string;
  formatName: string;
  suitablePlatforms: string[];
  relatedPillarNames: string[];
  audienceSuitability: string;
  cadenceHint: string;
  suggestionStatus: SuggestionReviewStatus;
}

export interface DistributionApproachItem {
  id: string;
  platformName: string;
  channelRole: string;
  platformConsiderations: string;
  recommendedFrequency: string;
  contentMix: string[];
  distributionApproach: string;
  repurposingOpportunities: string[];
  publishingConstraints: string;
  source: StrategyItemSource;
  approved: boolean;
  approvedAt: string | null;
}

export interface AiSuggestedDistributionApproachItem {
  id: string;
  platformName: string;
  channelRole: string;
  platformConsiderations: string;
  recommendedFrequency: string;
  contentMix: string[];
  distributionApproach: string;
  repurposingOpportunities: string[];
  publishingConstraints: string;
  suggestionStatus: SuggestionReviewStatus;
}

export interface ContentGovernanceStandardItem {
  id: string;
  title: string;
  category: GovernanceCategory;
  qualityStandards: string[];
  brandVoiceCompliance: string;
  messagingConsistency: string;
  editorialGuidelines: string[];
  approvalConsiderations: string;
  performanceIndicators: string[];
  marketingObjectiveAlignment: string;
  source: StrategyItemSource;
  approved: boolean;
  approvedAt: string | null;
}

export interface AiSuggestedContentGovernanceStandardItem {
  id: string;
  title: string;
  category: GovernanceCategory;
  qualityStandards: string[];
  brandVoiceCompliance: string;
  messagingConsistency: string;
  editorialGuidelines: string[];
  approvalConsiderations: string;
  performanceIndicators: string[];
  marketingObjectiveAlignment: string;
  suggestionStatus: SuggestionReviewStatus;
}

export interface ContentAiRunState {
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

export interface ContentStrategyUpstreamSnapshot {
  foundationApprovedAt: string | null;
  messagingApprovedAt: string | null;
  customerIntelUpdatedAt: string | null;
  marketingStrategyApprovedAt: string | null;
  approvedPersonasCount: number;
  approvedInterestsCount: number;
  approvedMarketingGoalsCount: number;
  approvedMarketingObjectivesCount: number;
  approvedMarketingChannelsCount: number;
  approvedMarketingKpisCount: number;
  positioningStatement: string;
  coreValueProposition: string;
  primaryChannelNames: string[];
  primaryPersonaNames: string[];
}

export interface ContentStrategyApprovedSummary {
  objectives: ContentObjectiveItem[];
  pillars: ContentPillarItem[];
  themes: ContentThemeTopicItem[];
  formats: ContentFormatItem[];
  series: ContentSeriesItem[];
  distribution: DistributionApproachItem[];
  governance: ContentGovernanceStandardItem[];
  editorialContext: EditorialConstraintsInput;
  approvedAt: string;
}

export interface ContentStrategyState {
  schemaVersion: 1;
  brandId: string;
  upstreamSnapshot: ContentStrategyUpstreamSnapshot | null;
  editorialContext: EditorialConstraintsInput;
  objectives: ContentObjectiveItem[];
  aiSuggestedObjectives: AiSuggestedContentObjectiveItem[];
  pillars: ContentPillarItem[];
  aiSuggestedPillars: AiSuggestedContentPillarItem[];
  themes: ContentThemeTopicItem[];
  aiSuggestedThemes: AiSuggestedContentThemeTopicItem[];
  formats: ContentFormatItem[];
  aiSuggestedFormats: AiSuggestedContentFormatItem[];
  series: ContentSeriesItem[];
  aiSuggestedSeries: AiSuggestedContentSeriesItem[];
  distribution: DistributionApproachItem[];
  aiSuggestedDistribution: AiSuggestedDistributionApproachItem[];
  governance: ContentGovernanceStandardItem[];
  aiSuggestedGovernance: AiSuggestedContentGovernanceStandardItem[];
  objectivesSynthesis: ContentAiRunState;
  pillarsSynthesis: ContentAiRunState;
  themesSynthesis: ContentAiRunState;
  formatsSynthesis: ContentAiRunState;
  distributionSynthesis: ContentAiRunState;
  governanceSynthesis: ContentAiRunState;
  completedAt: string | null;
  approvedSummary: ContentStrategyApprovedSummary | null;
}

export type ContentValidationErrors = Record<string, string>;

export class ContentStrategyIsolationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ContentStrategyIsolationError';
  }
}

export const CONTENT_STRATEGY_SECTIONS: ReadonlyArray<{
  key: ContentStrategySectionKey;
  number: string;
  title: string;
  shortTitle: string;
  subtitle: string;
}> = [
  {
    key: 'objectives',
    number: '01',
    title: 'Content Objectives',
    shortTitle: 'Objectives',
    subtitle: 'Primary and supporting editorial goals, audience outcomes, and marketing alignment',
  },
  {
    key: 'pillars',
    number: '02',
    title: 'Content Pillars',
    shortTitle: 'Pillars',
    subtitle: 'Distinctive brand themes rooted in positioning, messaging, and customer pain points',
  },
  {
    key: 'themes',
    number: '03',
    title: 'Content Themes & Topics',
    shortTitle: 'Themes',
    subtitle: 'Practical, non-overlapping subject areas mapped cleanly to approved pillars',
  },
  {
    key: 'formats',
    number: '04',
    title: 'Content Formats & Series',
    shortTitle: 'Formats',
    subtitle: 'Brand-appropriate content formats and recurring series matched to active channels',
  },
  {
    key: 'distribution',
    number: '05',
    title: 'Distribution & Publishing',
    shortTitle: 'Distribution',
    subtitle: 'Platform-specific publishing cadence, content mix, and repurposing workflows',
  },
  {
    key: 'governance',
    number: '06',
    title: 'Governance & Measurement',
    shortTitle: 'Governance',
    subtitle: 'Editorial quality standards, voice compliance, approvals, and KPI-linked evaluation',
  },
];

const GENERIC_PILLAR_PATTERNS = [
  /^educational(\s+content)?$/i,
  /^company\s+(news|updates)$/i,
  /^tips\s*(&|and)\s*tricks$/i,
  /^behind\s+the\s+scenes$/i,
  /^promotional(\s+(content|posts))?$/i,
  /^product\s+(updates|posts)$/i,
  /^general\s+(content|updates)$/i,
  /^thought\s+leadership$/i,
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

function normalizeObjectiveLevel(value: unknown): ContentObjectiveLevel {
  const lowered = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return lowered === 'supporting' ? 'supporting' : 'primary';
}

function normalizeGovernanceCategory(value: unknown): GovernanceCategory {
  const lowered = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (
    lowered === 'quality_standard' ||
    lowered === 'voice_and_messaging' ||
    lowered === 'editorial_workflow' ||
    lowered === 'performance_measurement'
  ) {
    return lowered;
  }
  return 'quality_standard';
}

function matchByLabel<T extends { id: string }>(
  target: string,
  items: readonly T[],
  getLabel: (item: T) => string,
): T | null {
  const normalized = target.trim().toLowerCase();
  if (!normalized) return null;
  const exact = items.find((item) => getLabel(item).trim().toLowerCase() === normalized);
  if (exact) return exact;
  const partial = items.filter((item) => {
    const label = getLabel(item).trim().toLowerCase();
    return label.length > 0 && (label.includes(normalized) || normalized.includes(label));
  });
  return partial.length === 1 ? partial[0] : null;
}

export function createEmptyEditorialContext(): EditorialConstraintsInput {
  return {
    publishingCapacity: '',
    productionConstraints: '',
    editorialNotes: '',
  };
}

export function createEmptyContentAiRunState(): ContentAiRunState {
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

export function createBlankContentObjective(id: string): ContentObjectiveItem {
  return {
    id,
    title: '',
    level: 'primary',
    description: '',
    targetAudienceOutcomes: [],
    desiredAudienceActions: [],
    alignedMarketingGoalTitle: '',
    alignedMarketingObjectiveTitle: '',
    source: 'manual',
    approved: false,
    approvedAt: null,
  };
}

export function createBlankContentPillar(id: string): ContentPillarItem {
  return {
    id,
    name: '',
    description: '',
    strategicPurpose: '',
    targetAudienceSegment: '',
    relevantInterestsAndPainPoints: [],
    keyMessages: [],
    supportingTopics: [],
    alignedMarketingObjectiveTitle: '',
    source: 'manual',
    approved: false,
    approvedAt: null,
  };
}

export function createBlankContentTheme(
  id: string,
  defaultPillar?: { id: string; name: string },
): ContentThemeTopicItem {
  return {
    id,
    title: '',
    description: '',
    associatedPillarId: defaultPillar?.id ?? '',
    associatedPillarName: defaultPillar?.name ?? '',
    audienceRelevance: '',
    addressedNeedOrAspiration: '',
    communicationAngle: '',
    alignedMarketingObjectiveTitle: '',
    source: 'manual',
    approved: false,
    approvedAt: null,
  };
}

export function createBlankContentFormat(id: string): ContentFormatItem {
  return {
    id,
    formatName: '',
    purpose: '',
    suitablePlatforms: [],
    audienceSuitability: '',
    relatedPillarNames: [],
    source: 'manual',
    approved: false,
    approvedAt: null,
  };
}

export function createBlankContentSeries(id: string): ContentSeriesItem {
  return {
    id,
    seriesName: '',
    description: '',
    formatName: '',
    suitablePlatforms: [],
    relatedPillarNames: [],
    audienceSuitability: '',
    cadenceHint: '',
    source: 'manual',
    approved: false,
    approvedAt: null,
  };
}

export function createBlankDistributionApproach(
  id: string,
  defaultPlatform = '',
): DistributionApproachItem {
  return {
    id,
    platformName: defaultPlatform,
    channelRole: '',
    platformConsiderations: '',
    recommendedFrequency: '',
    contentMix: [],
    distributionApproach: '',
    repurposingOpportunities: [],
    publishingConstraints: '',
    source: 'manual',
    approved: false,
    approvedAt: null,
  };
}

export function createBlankGovernanceStandard(id: string): ContentGovernanceStandardItem {
  return {
    id,
    title: '',
    category: 'quality_standard',
    qualityStandards: [],
    brandVoiceCompliance: '',
    messagingConsistency: '',
    editorialGuidelines: [],
    approvalConsiderations: '',
    performanceIndicators: [],
    marketingObjectiveAlignment: '',
    source: 'manual',
    approved: false,
    approvedAt: null,
  };
}

export function createInitialContentStrategyState(
  brand: Brand,
  upstreamSnapshot: ContentStrategyUpstreamSnapshot | null = null,
): ContentStrategyState {
  return {
    schemaVersion: 1,
    brandId: brand.id,
    upstreamSnapshot,
    editorialContext: createEmptyEditorialContext(),
    objectives: [],
    aiSuggestedObjectives: [],
    pillars: [],
    aiSuggestedPillars: [],
    themes: [],
    aiSuggestedThemes: [],
    formats: [],
    aiSuggestedFormats: [],
    series: [],
    aiSuggestedSeries: [],
    distribution: [],
    aiSuggestedDistribution: [],
    governance: [],
    aiSuggestedGovernance: [],
    objectivesSynthesis: createEmptyContentAiRunState(),
    pillarsSynthesis: createEmptyContentAiRunState(),
    themesSynthesis: createEmptyContentAiRunState(),
    formatsSynthesis: createEmptyContentAiRunState(),
    distributionSynthesis: createEmptyContentAiRunState(),
    governanceSynthesis: createEmptyContentAiRunState(),
    completedAt: null,
    approvedSummary: null,
  };
}

// ============================================================================
// UPSTREAM DEPENDENCY EVALUATION (STRICT BRAND ISOLATION & COMPLETED GATES)
// ============================================================================

export interface ContentStrategyDependencyEvaluation {
  ready: boolean;
  foundationReady: boolean;
  messagingReady: boolean;
  customerIntelligenceReady: boolean;
  personasReady: boolean;
  interestsReady: boolean;
  marketingStrategyReady: boolean;
  foundationStatus: ModuleStatus;
  messagingStatus: ModuleStatus;
  customerIntelStatus: ModuleStatus;
  marketingStrategyStatus: ModuleStatus;
  missingFoundationSections: FoundationSectionKey[];
  missingMessagingSections: MessagingSectionKey[];
  marketingStrategyBlockers: string[];
  approvedPersonasCount: number;
  approvedInterestsCount: number;
  approvedFoundation: ApprovedFoundationSnapshot | null;
  approvedMessaging: ApprovedMessagingSnapshot | null;
  approvedPersonas: CustomerPersonaItem[];
  approvedInterests: AudienceInterestItem[];
  approvedMarketingGoals: SmartMarketingGoalItem[];
  approvedMarketingObjectives: MarketingObjectiveItem[];
  approvedMarketingChannels: MarketingChannelItem[];
  approvedMarketingTactics: MarketingTacticItem[];
  approvedMarketingKpis: MarketingKpiItem[];
  approvedMarketingRoadmap: ImplementationRoadmapItem[];
  upstreamSnapshot: ContentStrategyUpstreamSnapshot | null;
  reason: string | null;
}

export function evaluateContentStrategyDependencies(
  brand: Brand,
  strategyModules: readonly BrandStrategyModule[] | null | undefined,
): ContentStrategyDependencyEvaluation {
  const list = strategyModules ?? [];
  for (const mod of list) {
    if (mod.brandId !== brand.id) {
      throw new ContentStrategyIsolationError(
        `Brand context isolation error: module "${mod.moduleKey}" belongs to brand "${mod.brandId}" rather than "${brand.id}".`,
      );
    }
    if (brand.userId && mod.userId && mod.userId !== brand.userId) {
      throw new ContentStrategyIsolationError(
        `Brand ownership isolation error: module "${mod.moduleKey}" does not belong to the active brand owner.`,
      );
    }
  }

  let msDeps;
  try {
    msDeps = evaluateMarketingStrategyDependencies(brand, list);
  } catch (err) {
    if (err instanceof MarketingStrategyIsolationError) {
      throw new ContentStrategyIsolationError(err.message);
    }
    throw err;
  }

  const customerIntelligenceReady =
    msDeps.customerIntelStatus === 'completed' && msDeps.personasReady && msDeps.interestsReady;

  const msModule = list.find((m) => m.moduleKey === 'marketingStrategy') ?? null;
  const marketingStrategyStatus: ModuleStatus = msModule?.status ?? 'not_started';

  let approvedMarketingGoals: SmartMarketingGoalItem[] = [];
  let approvedMarketingObjectives: MarketingObjectiveItem[] = [];
  let approvedMarketingChannels: MarketingChannelItem[] = [];
  let approvedMarketingTactics: MarketingTacticItem[] = [];
  let approvedMarketingKpis: MarketingKpiItem[] = [];
  let approvedMarketingRoadmap: ImplementationRoadmapItem[] = [];
  let marketingStrategyBlockers: string[] = [];
  let marketingStrategyApprovedAt: string | null = null;
  let marketingStrategyReady = false;

  if (!msModule || msModule.status !== 'completed') {
    marketingStrategyBlockers = ['Complete and approve the Marketing Strategy module.'];
  } else {
    let hydratedMs;
    try {
      hydratedMs = hydrateMarketingStrategyState(brand, msModule, msDeps.upstreamSnapshot);
    } catch (err) {
      if (err instanceof MarketingStrategyIsolationError) {
        throw new ContentStrategyIsolationError(err.message);
      }
      throw err;
    }

    const msCompleteCheck = canCompleteMarketingStrategy(hydratedMs);
    marketingStrategyBlockers = msCompleteCheck.blockers;
    approvedMarketingGoals = hydratedMs.goals.filter((g) => g.approved);
    approvedMarketingObjectives = hydratedMs.objectives.filter((o) => o.approved);
    approvedMarketingChannels = hydratedMs.channels.filter((c) => c.approved);
    approvedMarketingTactics = hydratedMs.tactics.filter((t) => t.approved);
    approvedMarketingKpis = hydratedMs.kpis.filter((k) => k.approved);
    approvedMarketingRoadmap = hydratedMs.roadmapItems.filter((r) => r.approved);
    marketingStrategyApprovedAt = hydratedMs.approvedSummary?.approvedAt ?? hydratedMs.completedAt;
    marketingStrategyReady = msCompleteCheck.allowed;
  }

  const ready =
    msDeps.foundationReady &&
    msDeps.messagingReady &&
    customerIntelligenceReady &&
    marketingStrategyReady;

  const missingLabels: string[] = [];
  if (!msDeps.foundationReady) missingLabels.push('completed Brand Foundation');
  if (!msDeps.messagingReady) missingLabels.push('completed Brand Messaging');
  if (!customerIntelligenceReady) {
    if (msDeps.customerIntelStatus !== 'completed') {
      missingLabels.push(
        'completed Customer Intelligence (with at least one approved Customer Persona and Audience Interest cluster)',
      );
    } else if (!msDeps.personasReady) {
      missingLabels.push('at least one approved Customer Persona');
    } else if (!msDeps.interestsReady) {
      missingLabels.push('at least one approved Audience Interest cluster');
    }
  }
  if (!marketingStrategyReady) missingLabels.push('completed Marketing Strategy');

  const reason =
    missingLabels.length > 0
      ? `Content Strategy requires ${missingLabels.join(', ')}.`
      : null;

  const upstreamSnapshot: ContentStrategyUpstreamSnapshot | null =
    ready && msDeps.approvedFoundation && msDeps.approvedMessaging
      ? {
          foundationApprovedAt: msDeps.approvedFoundation.approvedAt,
          messagingApprovedAt: msDeps.approvedMessaging.approvedAt,
          customerIntelUpdatedAt: msDeps.upstreamSnapshot?.customerIntelUpdatedAt ?? null,
          marketingStrategyApprovedAt,
          approvedPersonasCount: msDeps.approvedPersonasCount,
          approvedInterestsCount: msDeps.approvedInterestsCount,
          approvedMarketingGoalsCount: approvedMarketingGoals.length,
          approvedMarketingObjectivesCount: approvedMarketingObjectives.length,
          approvedMarketingChannelsCount: approvedMarketingChannels.length,
          approvedMarketingKpisCount: approvedMarketingKpis.length,
          positioningStatement: msDeps.approvedFoundation.positioningStatement,
          coreValueProposition: msDeps.approvedMessaging.coreValueProposition,
          primaryChannelNames: approvedMarketingChannels.slice(0, 5).map((c) => c.channelName),
          primaryPersonaNames: msDeps.approvedPersonas.slice(0, 4).map((p) => p.name),
        }
      : null;

  return {
    ready,
    foundationReady: msDeps.foundationReady,
    messagingReady: msDeps.messagingReady,
    customerIntelligenceReady,
    personasReady: msDeps.personasReady,
    interestsReady: msDeps.interestsReady,
    marketingStrategyReady,
    foundationStatus: msDeps.foundationStatus,
    messagingStatus: msDeps.messagingStatus,
    customerIntelStatus: msDeps.customerIntelStatus,
    marketingStrategyStatus,
    missingFoundationSections: msDeps.missingFoundationSections,
    missingMessagingSections: msDeps.missingMessagingSections,
    marketingStrategyBlockers,
    approvedPersonasCount: msDeps.approvedPersonasCount,
    approvedInterestsCount: msDeps.approvedInterestsCount,
    approvedFoundation: msDeps.approvedFoundation,
    approvedMessaging: msDeps.approvedMessaging,
    approvedPersonas: msDeps.approvedPersonas,
    approvedInterests: msDeps.approvedInterests,
    approvedMarketingGoals,
    approvedMarketingObjectives,
    approvedMarketingChannels,
    approvedMarketingTactics,
    approvedMarketingKpis,
    approvedMarketingRoadmap,
    upstreamSnapshot,
    reason,
  };
}

// ============================================================================
// SEQUENTIAL SECTION READINESS CHECKS
// ============================================================================

export function checkContentObjectivesReadiness(
  brand: Brand,
  strategyModules: readonly BrandStrategyModule[] | null | undefined,
): {
  ready: boolean;
  dependenciesReady: boolean;
  profileReady: boolean;
  missingProfileFields: string[];
  dependencyEvaluation: ContentStrategyDependencyEvaluation;
  reason: string | null;
} {
  const dependencyEvaluation = evaluateContentStrategyDependencies(brand, strategyModules);
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

export function checkContentPillarsReadiness(
  brand: Brand,
  strategyModules: readonly BrandStrategyModule[] | null | undefined,
  state: ContentStrategyState,
): { ready: boolean; hasApprovedObjectives: boolean; reason: string | null } {
  const base = checkContentObjectivesReadiness(brand, strategyModules);
  const hasApprovedObjectives = state.objectives.some(
    (o) => o.approved && Object.keys(validateContentObjective(o)).length === 0,
  );
  const ready = base.ready && hasApprovedObjectives;
  const reason =
    base.reason ??
    (!hasApprovedObjectives
      ? 'Approve at least one Content Objective before generating Content Pillars.'
      : null);
  return { ready, hasApprovedObjectives, reason };
}

export function checkContentThemesReadiness(
  brand: Brand,
  strategyModules: readonly BrandStrategyModule[] | null | undefined,
  state: ContentStrategyState,
): { ready: boolean; hasApprovedPillars: boolean; reason: string | null } {
  const base = checkContentObjectivesReadiness(brand, strategyModules);
  const hasApprovedPillars = state.pillars.some(
    (p) => p.approved && Object.keys(validateContentPillar(p)).length === 0,
  );
  const ready = base.ready && hasApprovedPillars;
  const reason =
    base.reason ??
    (!hasApprovedPillars
      ? 'Approve at least one Content Pillar before generating Content Themes & Topics.'
      : null);
  return { ready, hasApprovedPillars, reason };
}

export function checkContentFormatsReadiness(
  brand: Brand,
  strategyModules: readonly BrandStrategyModule[] | null | undefined,
  state: ContentStrategyState,
): { ready: boolean; hasApprovedPillars: boolean; reason: string | null } {
  const base = checkContentObjectivesReadiness(brand, strategyModules);
  const hasApprovedPillars = state.pillars.some(
    (p) => p.approved && Object.keys(validateContentPillar(p)).length === 0,
  );
  const ready = base.ready && hasApprovedPillars;
  const reason =
    base.reason ??
    (!hasApprovedPillars
      ? 'Approve at least one Content Pillar before generating Content Formats & Series.'
      : null);
  return { ready, hasApprovedPillars, reason };
}

export function checkContentDistributionReadiness(
  brand: Brand,
  strategyModules: readonly BrandStrategyModule[] | null | undefined,
  state: ContentStrategyState,
): {
  ready: boolean;
  hasApprovedPillars: boolean;
  hasApprovedFormatsOrSeries: boolean;
  reason: string | null;
} {
  const base = checkContentObjectivesReadiness(brand, strategyModules);
  const hasApprovedPillars = state.pillars.some(
    (p) => p.approved && Object.keys(validateContentPillar(p)).length === 0,
  );
  const hasApprovedFormatsOrSeries =
    state.formats.some((f) => f.approved && Object.keys(validateContentFormat(f)).length === 0) ||
    state.series.some((s) => s.approved && Object.keys(validateContentSeries(s)).length === 0);
  const ready = base.ready && hasApprovedPillars && hasApprovedFormatsOrSeries;
  const reason =
    base.reason ??
    (!hasApprovedPillars
      ? 'Approve at least one Content Pillar before generating the Distribution & Publishing Approach.'
      : !hasApprovedFormatsOrSeries
        ? 'Approve at least one Content Format or Recurring Series before generating Distribution & Publishing.'
        : null);
  return { ready, hasApprovedPillars, hasApprovedFormatsOrSeries, reason };
}

export function checkContentGovernanceReadiness(
  brand: Brand,
  strategyModules: readonly BrandStrategyModule[] | null | undefined,
  state: ContentStrategyState,
): { ready: boolean; hasApprovedPillars: boolean; reason: string | null } {
  const base = checkContentObjectivesReadiness(brand, strategyModules);
  const hasApprovedPillars = state.pillars.some(
    (p) => p.approved && Object.keys(validateContentPillar(p)).length === 0,
  );
  const ready = base.ready && hasApprovedPillars;
  const reason =
    base.reason ??
    (!hasApprovedPillars
      ? 'Approve at least one Content Pillar before generating Governance & Measurement standards.'
      : null);
  return { ready, hasApprovedPillars, reason };
}

// ============================================================================
// SECTION VALIDATORS
// ============================================================================

export function validateContentObjective(item: ContentObjectiveItem): ContentValidationErrors {
  const errors: ContentValidationErrors = {};
  if (!item.title.trim()) errors.title = 'Objective title is required.';
  if (!item.description.trim()) errors.description = 'Describe what this objective intends to achieve.';
  if (item.targetAudienceOutcomes.filter((s) => s.trim()).length === 0) {
    errors.targetAudienceOutcomes = 'Add at least one target audience outcome.';
  }
  if (item.desiredAudienceActions.filter((s) => s.trim()).length === 0) {
    errors.desiredAudienceActions = 'Add at least one desired audience action.';
  }
  if (!item.alignedMarketingObjectiveTitle.trim() && !item.alignedMarketingGoalTitle.trim()) {
    errors.alignedMarketingObjectiveTitle =
      'Link this content objective to an approved marketing goal or objective.';
  }
  return errors;
}

export function validateContentPillar(
  item: ContentPillarItem,
  existingPillars: readonly ContentPillarItem[] = [],
): ContentValidationErrors {
  const errors: ContentValidationErrors = {};
  const trimmedName = item.name.trim();
  if (!trimmedName) {
    errors.name = 'Pillar name is required.';
  } else if (GENERIC_PILLAR_PATTERNS.some((pattern) => pattern.test(trimmedName))) {
    errors.name =
      'Avoid generic pillar names (e.g., "Educational Content", "Company News", "Tips & Tricks"). Make it distinctive to this brand.';
  } else if (
    existingPillars.some(
      (other) =>
        other.id !== item.id &&
        other.name.trim().toLowerCase() === trimmedName.toLowerCase(),
    )
  ) {
    errors.name = 'Another content pillar already uses this name.';
  }

  if (!item.description.trim()) errors.description = 'Pillar description is required.';
  if (!item.strategicPurpose.trim()) errors.strategicPurpose = 'Explain the strategic purpose.';
  if (!item.targetAudienceSegment.trim()) {
    errors.targetAudienceSegment = 'Specify the target audience segment.';
  }
  if (item.relevantInterestsAndPainPoints.filter((s) => s.trim()).length === 0) {
    errors.relevantInterestsAndPainPoints = 'Add at least one audience interest or pain point.';
  }
  if (item.keyMessages.filter((s) => s.trim()).length === 0) {
    errors.keyMessages = 'Add at least one key brand message.';
  }
  if (item.supportingTopics.filter((s) => s.trim()).length === 0) {
    errors.supportingTopics = 'Add at least one supporting topic.';
  }
  if (!item.alignedMarketingObjectiveTitle.trim()) {
    errors.alignedMarketingObjectiveTitle = 'Connect this pillar to a marketing objective.';
  }
  return errors;
}

export function validateContentTheme(
  item: ContentThemeTopicItem,
  pillars: readonly ContentPillarItem[],
  existingThemes: readonly ContentThemeTopicItem[] = [],
): ContentValidationErrors {
  const errors: ContentValidationErrors = {};
  const trimmedTitle = item.title.trim();
  if (!trimmedTitle) {
    errors.title = 'Theme or topic title is required.';
  } else if (
    pillars.some((p) => p.name.trim().toLowerCase() === trimmedTitle.toLowerCase())
  ) {
    errors.title = 'Theme title should translate a pillar into a specific subject, not repeat the pillar name.';
  } else if (
    existingThemes.some(
      (other) =>
        other.id !== item.id &&
        other.title.trim().toLowerCase() === trimmedTitle.toLowerCase(),
    )
  ) {
    errors.title = 'Another content theme already uses this title. Keep themes distinct.';
  }

  if (!item.description.trim()) errors.description = 'Theme description is required.';
  const validPillar = pillars.find(
    (p) =>
      p.id === item.associatedPillarId ||
      (item.associatedPillarName.trim() &&
        p.name.trim().toLowerCase() === item.associatedPillarName.trim().toLowerCase()),
  );
  if (!validPillar) {
    errors.associatedPillarId = 'Associate this theme with an existing Content Pillar.';
  }
  if (!item.audienceRelevance.trim()) {
    errors.audienceRelevance = 'Explain why this theme is relevant to the target audience.';
  }
  if (!item.addressedNeedOrAspiration.trim()) {
    errors.addressedNeedOrAspiration = 'Specify the problem, interest, or aspiration addressed.';
  }
  if (!item.communicationAngle.trim()) {
    errors.communicationAngle = 'Define the intended communication angle.';
  }
  if (!item.alignedMarketingObjectiveTitle.trim()) {
    errors.alignedMarketingObjectiveTitle = 'Connect this theme to a marketing objective.';
  }
  return errors;
}

export function validateContentFormat(item: ContentFormatItem): ContentValidationErrors {
  const errors: ContentValidationErrors = {};
  if (!item.formatName.trim()) errors.formatName = 'Format name is required.';
  if (!item.purpose.trim()) errors.purpose = 'Explain the strategic purpose of this format.';
  if (item.suitablePlatforms.filter((s) => s.trim()).length === 0) {
    errors.suitablePlatforms = 'Specify at least one suitable platform from your marketing strategy.';
  }
  if (!item.audienceSuitability.trim()) {
    errors.audienceSuitability = 'Explain why this format fits the target audience.';
  }
  if (item.relatedPillarNames.filter((s) => s.trim()).length === 0) {
    errors.relatedPillarNames = 'Link at least one content pillar.';
  }
  return errors;
}

export function validateContentSeries(item: ContentSeriesItem): ContentValidationErrors {
  const errors: ContentValidationErrors = {};
  if (!item.seriesName.trim()) errors.seriesName = 'Recurring series name is required.';
  if (!item.description.trim()) errors.description = 'Describe the recurring series concept.';
  if (!item.formatName.trim()) errors.formatName = 'Specify the primary content format.';
  if (item.suitablePlatforms.filter((s) => s.trim()).length === 0) {
    errors.suitablePlatforms = 'Specify at least one suitable platform.';
  }
  if (item.relatedPillarNames.filter((s) => s.trim()).length === 0) {
    errors.relatedPillarNames = 'Link at least one content pillar.';
  }
  if (!item.audienceSuitability.trim()) {
    errors.audienceSuitability = 'Explain who this series serves.';
  }
  return errors;
}

export function validateDistributionApproach(
  item: DistributionApproachItem,
): ContentValidationErrors {
  const errors: ContentValidationErrors = {};
  if (!item.platformName.trim()) errors.platformName = 'Publishing platform is required.';
  if (!item.platformConsiderations.trim()) {
    errors.platformConsiderations = 'Document platform-specific content considerations.';
  }
  if (!item.recommendedFrequency.trim()) {
    errors.recommendedFrequency = 'Specify a practical publishing frequency.';
  }
  if (item.contentMix.filter((s) => s.trim()).length === 0) {
    errors.contentMix = 'Define the content mix for this platform.';
  }
  if (!item.distributionApproach.trim()) {
    errors.distributionApproach = 'Describe the distribution approach.';
  }
  if (item.repurposingOpportunities.filter((s) => s.trim()).length === 0) {
    errors.repurposingOpportunities = 'Add at least one repurposing opportunity.';
  }
  if (!item.publishingConstraints.trim()) {
    errors.publishingConstraints = 'Note practical publishing constraints or capacity considerations.';
  }
  return errors;
}

export function validateGovernanceStandard(
  item: ContentGovernanceStandardItem,
): ContentValidationErrors {
  const errors: ContentValidationErrors = {};
  if (!item.title.trim()) errors.title = 'Governance standard title is required.';
  if (item.qualityStandards.filter((s) => s.trim()).length === 0) {
    errors.qualityStandards = 'Add at least one content quality standard.';
  }
  if (!item.brandVoiceCompliance.trim()) {
    errors.brandVoiceCompliance = 'Specify how brand voice compliance will be maintained.';
  }
  if (!item.messagingConsistency.trim()) {
    errors.messagingConsistency = 'Specify how messaging consistency will be checked.';
  }
  if (item.editorialGuidelines.filter((s) => s.trim()).length === 0) {
    errors.editorialGuidelines = 'Add at least one editorial guideline.';
  }
  if (!item.approvalConsiderations.trim()) {
    errors.approvalConsiderations = 'Document content review and approval considerations.';
  }
  if (item.performanceIndicators.filter((s) => s.trim()).length === 0) {
    errors.performanceIndicators = 'Add at least one relevant performance indicator.';
  }
  if (!item.marketingObjectiveAlignment.trim()) {
    errors.marketingObjectiveAlignment =
      'Explain how content performance supports approved marketing objectives.';
  }
  return errors;
}

// ============================================================================
// PROMPT VARIABLE SERIALIZATION (USER-SUPPLIED OPTIONAL CONSTRAINTS ONLY)
// ============================================================================

export function buildContentPromptVariables(
  _brand: Brand,
  state: ContentStrategyState,
): Record<string, unknown> {
  const parts: string[] = [];
  if (state.editorialContext.publishingCapacity.trim()) {
    parts.push(`Publishing Capacity: ${state.editorialContext.publishingCapacity.trim()}`);
  }
  if (state.editorialContext.productionConstraints.trim()) {
    parts.push(`Production Constraints: ${state.editorialContext.productionConstraints.trim()}`);
  }
  if (state.editorialContext.editorialNotes.trim()) {
    parts.push(`Editorial Notes: ${state.editorialContext.editorialNotes.trim()}`);
  }

  return parts.length > 0 ? { contentConstraints: parts.join(' | ') } : {};
}

// ============================================================================
// AI RESULT APPLIERS (REGENERATION ALWAYS PRESERVES APPROVED & DRAFT ITEMS)
// ============================================================================

function buildRunState(
  result: Extract<PromptExecutionResult, { status: 'success' }>,
  output: Record<string, unknown>,
): ContentAiRunState {
  return {
    promptId: result.promptId,
    promptVersion: result.promptVersion,
    sourceClassification: result.sourceClassification,
    model: result.model,
    generatedAt: result.generatedAt,
    researchCaveat:
      asNullableString(output.researchCaveat) ??
      'AI-generated recommendations require owner review, explicit adoption, and individual approval.',
    suppliedFactsUsed: asStringArray(output.suppliedFactsUsed),
    missingContextNotes: asStringArray(output.missingContextNotes),
    aiSuggestionsSummary: isPlainObject(output.aiSuggestions) ? output.aiSuggestions : null,
  };
}

export function applyAiContentObjectivesResult(
  state: ContentStrategyState,
  result: PromptExecutionResult,
): { applied: boolean; state: ContentStrategyState; error?: string } {
  if (result.status !== 'success') {
    return {
      applied: false,
      state,
      error:
        result.status === 'validation_error'
          ? result.error
          : result.message,
    };
  }
  const output = result.output;
  if (!Array.isArray(output.objectives) || output.objectives.length === 0) {
    return { applied: false, state, error: 'AI did not return structured content objectives.' };
  }

  const stamp = Date.now();
  const suggestions: AiSuggestedContentObjectiveItem[] = output.objectives
    .map((raw, idx): AiSuggestedContentObjectiveItem | null => {
      if (!isPlainObject(raw)) return null;
      const title = asString(raw.title).trim();
      if (!title) return null;
      return {
        id: `ai-cobj-${stamp}-${idx + 1}`,
        title,
        level: normalizeObjectiveLevel(raw.level),
        description: asString(raw.description).trim(),
        targetAudienceOutcomes: asStringArray(raw.targetAudienceOutcomes),
        desiredAudienceActions: asStringArray(raw.desiredAudienceActions),
        alignedMarketingGoalTitle: asString(raw.alignedMarketingGoalTitle).trim(),
        alignedMarketingObjectiveTitle: asString(raw.alignedMarketingObjectiveTitle).trim(),
        suggestionStatus: 'pending_review',
      };
    })
    .filter((item): item is AiSuggestedContentObjectiveItem => item !== null);

  if (suggestions.length === 0) {
    return { applied: false, state, error: 'AI returned empty content objective entries.' };
  }

  return {
    applied: true,
    state: {
      ...state,
      aiSuggestedObjectives: suggestions,
      objectivesSynthesis: buildRunState(result, output),
    },
  };
}

export function applyAiContentPillarsResult(
  state: ContentStrategyState,
  result: PromptExecutionResult,
): { applied: boolean; state: ContentStrategyState; error?: string } {
  if (result.status !== 'success') {
    return {
      applied: false,
      state,
      error: result.status === 'validation_error' ? result.error : result.message,
    };
  }
  const output = result.output;
  if (!Array.isArray(output.pillars) || output.pillars.length === 0) {
    return { applied: false, state, error: 'AI did not return structured content pillars.' };
  }

  const stamp = Date.now();
  const suggestions: AiSuggestedContentPillarItem[] = output.pillars
    .map((raw, idx): AiSuggestedContentPillarItem | null => {
      if (!isPlainObject(raw)) return null;
      const name = asString(raw.name).trim();
      if (!name) return null;
      return {
        id: `ai-cpillar-${stamp}-${idx + 1}`,
        name,
        description: asString(raw.description).trim(),
        strategicPurpose: asString(raw.strategicPurpose).trim(),
        targetAudienceSegment: asString(raw.targetAudienceSegment).trim(),
        relevantInterestsAndPainPoints: asStringArray(raw.relevantInterestsAndPainPoints),
        keyMessages: asStringArray(raw.keyMessages),
        supportingTopics: asStringArray(raw.supportingTopics),
        alignedMarketingObjectiveTitle: asString(raw.alignedMarketingObjectiveTitle).trim(),
        suggestionStatus: 'pending_review',
      };
    })
    .filter((item): item is AiSuggestedContentPillarItem => item !== null);

  if (suggestions.length === 0) {
    return { applied: false, state, error: 'AI returned empty content pillar entries.' };
  }

  return {
    applied: true,
    state: {
      ...state,
      aiSuggestedPillars: suggestions,
      pillarsSynthesis: buildRunState(result, output),
    },
  };
}

export function applyAiContentThemesResult(
  state: ContentStrategyState,
  result: PromptExecutionResult,
): { applied: boolean; state: ContentStrategyState; error?: string } {
  if (result.status !== 'success') {
    return {
      applied: false,
      state,
      error: result.status === 'validation_error' ? result.error : result.message,
    };
  }
  const output = result.output;
  if (!Array.isArray(output.themes) || output.themes.length === 0) {
    return { applied: false, state, error: 'AI did not return structured content themes.' };
  }

  const stamp = Date.now();
  const approvedPillars = state.pillars.filter((p) => p.approved);
  const suggestions: AiSuggestedContentThemeTopicItem[] = output.themes
    .map((raw, idx): AiSuggestedContentThemeTopicItem | null => {
      if (!isPlainObject(raw)) return null;
      const title = asString(raw.title).trim();
      if (!title) return null;
      const pillarName = asString(raw.associatedPillarName).trim();
      const matchedPillar = matchByLabel(pillarName, approvedPillars, (p) => p.name);
      return {
        id: `ai-ctheme-${stamp}-${idx + 1}`,
        title,
        description: asString(raw.description).trim(),
        associatedPillarName: matchedPillar?.name ?? pillarName,
        matchedPillarId: matchedPillar?.id ?? '',
        audienceRelevance: asString(raw.audienceRelevance).trim(),
        addressedNeedOrAspiration: asString(raw.addressedNeedOrAspiration).trim(),
        communicationAngle: asString(raw.communicationAngle).trim(),
        alignedMarketingObjectiveTitle: asString(raw.alignedMarketingObjectiveTitle).trim(),
        suggestionStatus: 'pending_review',
      };
    })
    .filter((item): item is AiSuggestedContentThemeTopicItem => item !== null);

  if (suggestions.length === 0) {
    return { applied: false, state, error: 'AI returned empty content theme entries.' };
  }

  return {
    applied: true,
    state: {
      ...state,
      aiSuggestedThemes: suggestions,
      themesSynthesis: buildRunState(result, output),
    },
  };
}

export function applyAiContentFormatsResult(
  state: ContentStrategyState,
  result: PromptExecutionResult,
): { applied: boolean; state: ContentStrategyState; error?: string } {
  if (result.status !== 'success') {
    return {
      applied: false,
      state,
      error: result.status === 'validation_error' ? result.error : result.message,
    };
  }
  const output = result.output;
  const rawFormats = Array.isArray(output.formats) ? output.formats : [];
  const rawSeries = Array.isArray(output.series) ? output.series : [];
  if (rawFormats.length === 0 && rawSeries.length === 0) {
    return {
      applied: false,
      state,
      error: 'AI did not return structured content formats or recurring series.',
    };
  }

  const stamp = Date.now();
  const suggestedFormats: AiSuggestedContentFormatItem[] = rawFormats
    .map((raw, idx): AiSuggestedContentFormatItem | null => {
      if (!isPlainObject(raw)) return null;
      const formatName = asString(raw.formatName).trim();
      if (!formatName) return null;
      return {
        id: `ai-cformat-${stamp}-${idx + 1}`,
        formatName,
        purpose: asString(raw.purpose).trim(),
        suitablePlatforms: asStringArray(raw.suitablePlatforms),
        audienceSuitability: asString(raw.audienceSuitability).trim(),
        relatedPillarNames: asStringArray(raw.relatedPillarNames),
        suggestionStatus: 'pending_review',
      };
    })
    .filter((item): item is AiSuggestedContentFormatItem => item !== null);

  const suggestedSeries: AiSuggestedContentSeriesItem[] = rawSeries
    .map((raw, idx): AiSuggestedContentSeriesItem | null => {
      if (!isPlainObject(raw)) return null;
      const seriesName = asString(raw.seriesName).trim();
      if (!seriesName) return null;
      return {
        id: `ai-cseries-${stamp}-${idx + 1}`,
        seriesName,
        description: asString(raw.description).trim(),
        formatName: asString(raw.formatName).trim(),
        suitablePlatforms: asStringArray(raw.suitablePlatforms),
        relatedPillarNames: asStringArray(raw.relatedPillarNames),
        audienceSuitability: asString(raw.audienceSuitability).trim(),
        cadenceHint: asString(raw.cadenceHint).trim(),
        suggestionStatus: 'pending_review',
      };
    })
    .filter((item): item is AiSuggestedContentSeriesItem => item !== null);

  if (suggestedFormats.length === 0 && suggestedSeries.length === 0) {
    return { applied: false, state, error: 'AI returned empty formats and series entries.' };
  }

  return {
    applied: true,
    state: {
      ...state,
      aiSuggestedFormats: suggestedFormats,
      aiSuggestedSeries: suggestedSeries,
      formatsSynthesis: buildRunState(result, output),
    },
  };
}

export function applyAiContentDistributionResult(
  state: ContentStrategyState,
  result: PromptExecutionResult,
): { applied: boolean; state: ContentStrategyState; error?: string } {
  if (result.status !== 'success') {
    return {
      applied: false,
      state,
      error: result.status === 'validation_error' ? result.error : result.message,
    };
  }
  const output = result.output;
  if (!Array.isArray(output.distributionPlans) || output.distributionPlans.length === 0) {
    return {
      applied: false,
      state,
      error: 'AI did not return structured distribution and publishing plans.',
    };
  }

  const stamp = Date.now();
  const suggestions: AiSuggestedDistributionApproachItem[] = output.distributionPlans
    .map((raw, idx): AiSuggestedDistributionApproachItem | null => {
      if (!isPlainObject(raw)) return null;
      const platformName = asString(raw.platformName).trim();
      if (!platformName) return null;
      return {
        id: `ai-cdist-${stamp}-${idx + 1}`,
        platformName,
        channelRole: asString(raw.channelRole).trim(),
        platformConsiderations: asString(raw.platformConsiderations).trim(),
        recommendedFrequency: asString(raw.recommendedFrequency).trim(),
        contentMix: asStringArray(raw.contentMix),
        distributionApproach: asString(raw.distributionApproach).trim(),
        repurposingOpportunities: asStringArray(raw.repurposingOpportunities),
        publishingConstraints: asString(raw.publishingConstraints).trim(),
        suggestionStatus: 'pending_review',
      };
    })
    .filter((item): item is AiSuggestedDistributionApproachItem => item !== null);

  if (suggestions.length === 0) {
    return { applied: false, state, error: 'AI returned empty distribution entries.' };
  }

  return {
    applied: true,
    state: {
      ...state,
      aiSuggestedDistribution: suggestions,
      distributionSynthesis: buildRunState(result, output),
    },
  };
}

export function applyAiContentGovernanceResult(
  state: ContentStrategyState,
  result: PromptExecutionResult,
): { applied: boolean; state: ContentStrategyState; error?: string } {
  if (result.status !== 'success') {
    return {
      applied: false,
      state,
      error: result.status === 'validation_error' ? result.error : result.message,
    };
  }
  const output = result.output;
  if (!Array.isArray(output.governanceStandards) || output.governanceStandards.length === 0) {
    return {
      applied: false,
      state,
      error: 'AI did not return structured governance and measurement standards.',
    };
  }

  const stamp = Date.now();
  const suggestions: AiSuggestedContentGovernanceStandardItem[] = output.governanceStandards
    .map((raw, idx): AiSuggestedContentGovernanceStandardItem | null => {
      if (!isPlainObject(raw)) return null;
      const title = asString(raw.title).trim();
      if (!title) return null;
      return {
        id: `ai-cgov-${stamp}-${idx + 1}`,
        title,
        category: normalizeGovernanceCategory(raw.category),
        qualityStandards: asStringArray(raw.qualityStandards),
        brandVoiceCompliance: asString(raw.brandVoiceCompliance).trim(),
        messagingConsistency: asString(raw.messagingConsistency).trim(),
        editorialGuidelines: asStringArray(raw.editorialGuidelines),
        approvalConsiderations: asString(raw.approvalConsiderations).trim(),
        performanceIndicators: asStringArray(raw.performanceIndicators),
        marketingObjectiveAlignment: asString(raw.marketingObjectiveAlignment).trim(),
        suggestionStatus: 'pending_review',
      };
    })
    .filter((item): item is AiSuggestedContentGovernanceStandardItem => item !== null);

  if (suggestions.length === 0) {
    return { applied: false, state, error: 'AI returned empty governance standard entries.' };
  }

  return {
    applied: true,
    state: {
      ...state,
      aiSuggestedGovernance: suggestions,
      governanceSynthesis: buildRunState(result, output),
    },
  };
}

// ============================================================================
// EXPLICIT ADOPTION (CREATES UNAPPROVED DRAFT) & DISMISSAL HANDLERS
// ============================================================================

export function adoptAiContentObjectiveSuggestion(
  state: ContentStrategyState,
  suggestionId: string,
  newId: string,
): { state: ContentStrategyState; adopted: ContentObjectiveItem | null } {
  const suggestion = state.aiSuggestedObjectives.find((s) => s.id === suggestionId);
  if (!suggestion) return { state, adopted: null };

  const draft: ContentObjectiveItem = {
    id: newId,
    title: suggestion.title,
    level: suggestion.level,
    description: suggestion.description,
    targetAudienceOutcomes: [...suggestion.targetAudienceOutcomes],
    desiredAudienceActions: [...suggestion.desiredAudienceActions],
    alignedMarketingGoalTitle: suggestion.alignedMarketingGoalTitle,
    alignedMarketingObjectiveTitle: suggestion.alignedMarketingObjectiveTitle,
    source: 'ai_adopted',
    approved: false,
    approvedAt: null,
  };

  return {
    adopted: draft,
    state: {
      ...state,
      objectives: [...state.objectives, draft],
      aiSuggestedObjectives: state.aiSuggestedObjectives.map((s) =>
        s.id === suggestionId ? { ...s, suggestionStatus: 'approved' } : s,
      ),
    },
  };
}

export function dismissAiContentObjectiveSuggestion(
  state: ContentStrategyState,
  suggestionId: string,
): ContentStrategyState {
  return {
    ...state,
    aiSuggestedObjectives: state.aiSuggestedObjectives.map((s) =>
      s.id === suggestionId ? { ...s, suggestionStatus: 'rejected' } : s,
    ),
  };
}

export function adoptAiContentPillarSuggestion(
  state: ContentStrategyState,
  suggestionId: string,
  newId: string,
): { state: ContentStrategyState; adopted: ContentPillarItem | null } {
  const suggestion = state.aiSuggestedPillars.find((s) => s.id === suggestionId);
  if (!suggestion) return { state, adopted: null };

  const draft: ContentPillarItem = {
    id: newId,
    name: suggestion.name,
    description: suggestion.description,
    strategicPurpose: suggestion.strategicPurpose,
    targetAudienceSegment: suggestion.targetAudienceSegment,
    relevantInterestsAndPainPoints: [...suggestion.relevantInterestsAndPainPoints],
    keyMessages: [...suggestion.keyMessages],
    supportingTopics: [...suggestion.supportingTopics],
    alignedMarketingObjectiveTitle: suggestion.alignedMarketingObjectiveTitle,
    source: 'ai_adopted',
    approved: false,
    approvedAt: null,
  };

  return {
    adopted: draft,
    state: {
      ...state,
      pillars: [...state.pillars, draft],
      aiSuggestedPillars: state.aiSuggestedPillars.map((s) =>
        s.id === suggestionId ? { ...s, suggestionStatus: 'approved' } : s,
      ),
    },
  };
}

export function dismissAiContentPillarSuggestion(
  state: ContentStrategyState,
  suggestionId: string,
): ContentStrategyState {
  return {
    ...state,
    aiSuggestedPillars: state.aiSuggestedPillars.map((s) =>
      s.id === suggestionId ? { ...s, suggestionStatus: 'rejected' } : s,
    ),
  };
}

export function adoptAiContentThemeSuggestion(
  state: ContentStrategyState,
  suggestionId: string,
  newId: string,
): { state: ContentStrategyState; adopted: ContentThemeTopicItem | null } {
  const suggestion = state.aiSuggestedThemes.find((s) => s.id === suggestionId);
  if (!suggestion) return { state, adopted: null };

  const matchedPillar =
    state.pillars.find((p) => p.id === suggestion.matchedPillarId) ??
    matchByLabel(suggestion.associatedPillarName, state.pillars, (p) => p.name);

  const draft: ContentThemeTopicItem = {
    id: newId,
    title: suggestion.title,
    description: suggestion.description,
    associatedPillarId: matchedPillar?.id ?? '',
    associatedPillarName: matchedPillar?.name ?? suggestion.associatedPillarName,
    audienceRelevance: suggestion.audienceRelevance,
    addressedNeedOrAspiration: suggestion.addressedNeedOrAspiration,
    communicationAngle: suggestion.communicationAngle,
    alignedMarketingObjectiveTitle: suggestion.alignedMarketingObjectiveTitle,
    source: 'ai_adopted',
    approved: false,
    approvedAt: null,
  };

  return {
    adopted: draft,
    state: {
      ...state,
      themes: [...state.themes, draft],
      aiSuggestedThemes: state.aiSuggestedThemes.map((s) =>
        s.id === suggestionId ? { ...s, suggestionStatus: 'approved' } : s,
      ),
    },
  };
}

export function dismissAiContentThemeSuggestion(
  state: ContentStrategyState,
  suggestionId: string,
): ContentStrategyState {
  return {
    ...state,
    aiSuggestedThemes: state.aiSuggestedThemes.map((s) =>
      s.id === suggestionId ? { ...s, suggestionStatus: 'rejected' } : s,
    ),
  };
}

export function adoptAiContentFormatSuggestion(
  state: ContentStrategyState,
  suggestionId: string,
  newId: string,
): { state: ContentStrategyState; adopted: ContentFormatItem | null } {
  const suggestion = state.aiSuggestedFormats.find((s) => s.id === suggestionId);
  if (!suggestion) return { state, adopted: null };

  const draft: ContentFormatItem = {
    id: newId,
    formatName: suggestion.formatName,
    purpose: suggestion.purpose,
    suitablePlatforms: [...suggestion.suitablePlatforms],
    audienceSuitability: suggestion.audienceSuitability,
    relatedPillarNames: [...suggestion.relatedPillarNames],
    source: 'ai_adopted',
    approved: false,
    approvedAt: null,
  };

  return {
    adopted: draft,
    state: {
      ...state,
      formats: [...state.formats, draft],
      aiSuggestedFormats: state.aiSuggestedFormats.map((s) =>
        s.id === suggestionId ? { ...s, suggestionStatus: 'approved' } : s,
      ),
    },
  };
}

export function dismissAiContentFormatSuggestion(
  state: ContentStrategyState,
  suggestionId: string,
): ContentStrategyState {
  return {
    ...state,
    aiSuggestedFormats: state.aiSuggestedFormats.map((s) =>
      s.id === suggestionId ? { ...s, suggestionStatus: 'rejected' } : s,
    ),
  };
}

export function adoptAiContentSeriesSuggestion(
  state: ContentStrategyState,
  suggestionId: string,
  newId: string,
): { state: ContentStrategyState; adopted: ContentSeriesItem | null } {
  const suggestion = state.aiSuggestedSeries.find((s) => s.id === suggestionId);
  if (!suggestion) return { state, adopted: null };

  const draft: ContentSeriesItem = {
    id: newId,
    seriesName: suggestion.seriesName,
    description: suggestion.description,
    formatName: suggestion.formatName,
    suitablePlatforms: [...suggestion.suitablePlatforms],
    relatedPillarNames: [...suggestion.relatedPillarNames],
    audienceSuitability: suggestion.audienceSuitability,
    cadenceHint: suggestion.cadenceHint,
    source: 'ai_adopted',
    approved: false,
    approvedAt: null,
  };

  return {
    adopted: draft,
    state: {
      ...state,
      series: [...state.series, draft],
      aiSuggestedSeries: state.aiSuggestedSeries.map((s) =>
        s.id === suggestionId ? { ...s, suggestionStatus: 'approved' } : s,
      ),
    },
  };
}

export function dismissAiContentSeriesSuggestion(
  state: ContentStrategyState,
  suggestionId: string,
): ContentStrategyState {
  return {
    ...state,
    aiSuggestedSeries: state.aiSuggestedSeries.map((s) =>
      s.id === suggestionId ? { ...s, suggestionStatus: 'rejected' } : s,
    ),
  };
}

export function adoptAiDistributionSuggestion(
  state: ContentStrategyState,
  suggestionId: string,
  newId: string,
): { state: ContentStrategyState; adopted: DistributionApproachItem | null } {
  const suggestion = state.aiSuggestedDistribution.find((s) => s.id === suggestionId);
  if (!suggestion) return { state, adopted: null };

  const draft: DistributionApproachItem = {
    id: newId,
    platformName: suggestion.platformName,
    channelRole: suggestion.channelRole,
    platformConsiderations: suggestion.platformConsiderations,
    recommendedFrequency: suggestion.recommendedFrequency,
    contentMix: [...suggestion.contentMix],
    distributionApproach: suggestion.distributionApproach,
    repurposingOpportunities: [...suggestion.repurposingOpportunities],
    publishingConstraints: suggestion.publishingConstraints,
    source: 'ai_adopted',
    approved: false,
    approvedAt: null,
  };

  return {
    adopted: draft,
    state: {
      ...state,
      distribution: [...state.distribution, draft],
      aiSuggestedDistribution: state.aiSuggestedDistribution.map((s) =>
        s.id === suggestionId ? { ...s, suggestionStatus: 'approved' } : s,
      ),
    },
  };
}

export function dismissAiDistributionSuggestion(
  state: ContentStrategyState,
  suggestionId: string,
): ContentStrategyState {
  return {
    ...state,
    aiSuggestedDistribution: state.aiSuggestedDistribution.map((s) =>
      s.id === suggestionId ? { ...s, suggestionStatus: 'rejected' } : s,
    ),
  };
}

export function adoptAiGovernanceSuggestion(
  state: ContentStrategyState,
  suggestionId: string,
  newId: string,
): { state: ContentStrategyState; adopted: ContentGovernanceStandardItem | null } {
  const suggestion = state.aiSuggestedGovernance.find((s) => s.id === suggestionId);
  if (!suggestion) return { state, adopted: null };

  const draft: ContentGovernanceStandardItem = {
    id: newId,
    title: suggestion.title,
    category: suggestion.category,
    qualityStandards: [...suggestion.qualityStandards],
    brandVoiceCompliance: suggestion.brandVoiceCompliance,
    messagingConsistency: suggestion.messagingConsistency,
    editorialGuidelines: [...suggestion.editorialGuidelines],
    approvalConsiderations: suggestion.approvalConsiderations,
    performanceIndicators: [...suggestion.performanceIndicators],
    marketingObjectiveAlignment: suggestion.marketingObjectiveAlignment,
    source: 'ai_adopted',
    approved: false,
    approvedAt: null,
  };

  return {
    adopted: draft,
    state: {
      ...state,
      governance: [...state.governance, draft],
      aiSuggestedGovernance: state.aiSuggestedGovernance.map((s) =>
        s.id === suggestionId ? { ...s, suggestionStatus: 'approved' } : s,
      ),
    },
  };
}

export function dismissAiGovernanceSuggestion(
  state: ContentStrategyState,
  suggestionId: string,
): ContentStrategyState {
  return {
    ...state,
    aiSuggestedGovernance: state.aiSuggestedGovernance.map((s) =>
      s.id === suggestionId ? { ...s, suggestionStatus: 'rejected' } : s,
    ),
  };
}

// ============================================================================
// CASCADE-SAFE DELETIONS
// ============================================================================

export function removeContentObjectiveFromState(
  state: ContentStrategyState,
  id: string,
): ContentStrategyState {
  return {
    ...state,
    completedAt: null,
    approvedSummary: null,
    objectives: state.objectives.filter((o) => o.id !== id),
  };
}

export function removeContentPillarFromState(
  state: ContentStrategyState,
  id: string,
): ContentStrategyState {
  const removed = state.pillars.find((p) => p.id === id);
  const removedNameLower = removed?.name.trim().toLowerCase() ?? '';
  return {
    ...state,
    completedAt: null,
    approvedSummary: null,
    pillars: state.pillars.filter((p) => p.id !== id),
    themes: state.themes.map((t) => {
      const linked =
        t.associatedPillarId === id ||
        (removedNameLower && t.associatedPillarName.trim().toLowerCase() === removedNameLower);
      if (!linked) return t;
      return {
        ...t,
        associatedPillarId: '',
        associatedPillarName: '',
        approved: false,
        approvedAt: null,
      };
    }),
  };
}

export function removeContentThemeFromState(
  state: ContentStrategyState,
  id: string,
): ContentStrategyState {
  return {
    ...state,
    completedAt: null,
    approvedSummary: null,
    themes: state.themes.filter((t) => t.id !== id),
  };
}

export function removeContentFormatFromState(
  state: ContentStrategyState,
  id: string,
): ContentStrategyState {
  return {
    ...state,
    completedAt: null,
    approvedSummary: null,
    formats: state.formats.filter((f) => f.id !== id),
  };
}

export function removeContentSeriesFromState(
  state: ContentStrategyState,
  id: string,
): ContentStrategyState {
  return {
    ...state,
    completedAt: null,
    approvedSummary: null,
    series: state.series.filter((s) => s.id !== id),
  };
}

export function removeDistributionFromState(
  state: ContentStrategyState,
  id: string,
): ContentStrategyState {
  return {
    ...state,
    completedAt: null,
    approvedSummary: null,
    distribution: state.distribution.filter((d) => d.id !== id),
  };
}

export function removeGovernanceFromState(
  state: ContentStrategyState,
  id: string,
): ContentStrategyState {
  return {
    ...state,
    completedAt: null,
    approvedSummary: null,
    governance: state.governance.filter((g) => g.id !== id),
  };
}

// ============================================================================
// PROGRESS TRACKING & STRICT COMPLETION GATING
// ============================================================================

export type ContentSectionProgressStatus = 'not_started' | 'in_progress' | 'approved';

export interface ContentStrategyProgressSummary {
  totalSections: 6;
  approvedCount: number;
  inProgressCount: number;
  percentage: number;
  sectionStatuses: Record<ContentStrategySectionKey, ContentSectionProgressStatus>;
  approvedCounts: {
    objectives: number;
    pillars: number;
    themes: number;
    formats: number;
    series: number;
    distribution: number;
    governance: number;
  };
  pendingSuggestionsCount: number;
}

export function computeContentStrategyProgress(
  state: ContentStrategyState,
): ContentStrategyProgressSummary {
  const validApprovedObjectives = state.objectives.filter(
    (o) => o.approved && Object.keys(validateContentObjective(o)).length === 0,
  ).length;
  const validApprovedPillars = state.pillars.filter(
    (p) => p.approved && Object.keys(validateContentPillar(p, state.pillars)).length === 0,
  ).length;
  const validApprovedThemes = state.themes.filter(
    (t) =>
      t.approved &&
      Object.keys(validateContentTheme(t, state.pillars, state.themes)).length === 0,
  ).length;
  const validApprovedFormats = state.formats.filter(
    (f) => f.approved && Object.keys(validateContentFormat(f)).length === 0,
  ).length;
  const validApprovedSeries = state.series.filter(
    (s) => s.approved && Object.keys(validateContentSeries(s)).length === 0,
  ).length;
  const validApprovedDistribution = state.distribution.filter(
    (d) => d.approved && Object.keys(validateDistributionApproach(d)).length === 0,
  ).length;
  const validApprovedGovernance = state.governance.filter(
    (g) => g.approved && Object.keys(validateGovernanceStandard(g)).length === 0,
  ).length;

  const pendingOf = (list: readonly { suggestionStatus: SuggestionReviewStatus }[]) =>
    list.filter((s) => s.suggestionStatus === 'pending_review').length;

  const statusFor = (approvedCount: number, totalItems: number, pendingCount: number): ContentSectionProgressStatus => {
    if (approvedCount > 0) return 'approved';
    if (totalItems > 0 || pendingCount > 0) return 'in_progress';
    return 'not_started';
  };

  const formatsStatus: ContentSectionProgressStatus =
    validApprovedFormats > 0 && validApprovedSeries > 0
      ? 'approved'
      : state.formats.length > 0 ||
          state.series.length > 0 ||
          pendingOf(state.aiSuggestedFormats) > 0 ||
          pendingOf(state.aiSuggestedSeries) > 0
        ? 'in_progress'
        : 'not_started';

  const sectionStatuses: Record<ContentStrategySectionKey, ContentSectionProgressStatus> = {
    objectives: statusFor(
      validApprovedObjectives,
      state.objectives.length,
      pendingOf(state.aiSuggestedObjectives),
    ),
    pillars: statusFor(
      validApprovedPillars,
      state.pillars.length,
      pendingOf(state.aiSuggestedPillars),
    ),
    themes: statusFor(
      validApprovedThemes,
      state.themes.length,
      pendingOf(state.aiSuggestedThemes),
    ),
    formats: formatsStatus,
    distribution: statusFor(
      validApprovedDistribution,
      state.distribution.length,
      pendingOf(state.aiSuggestedDistribution),
    ),
    governance: statusFor(
      validApprovedGovernance,
      state.governance.length,
      pendingOf(state.aiSuggestedGovernance),
    ),
  };

  const values = Object.values(sectionStatuses);
  const approvedCount = values.filter((s) => s === 'approved').length;
  const inProgressCount = values.filter((s) => s === 'in_progress').length;
  const percentage = Math.round((approvedCount / 6) * 100);

  const pendingSuggestionsCount =
    pendingOf(state.aiSuggestedObjectives) +
    pendingOf(state.aiSuggestedPillars) +
    pendingOf(state.aiSuggestedThemes) +
    pendingOf(state.aiSuggestedFormats) +
    pendingOf(state.aiSuggestedSeries) +
    pendingOf(state.aiSuggestedDistribution) +
    pendingOf(state.aiSuggestedGovernance);

  return {
    totalSections: 6,
    approvedCount,
    inProgressCount,
    percentage,
    sectionStatuses,
    approvedCounts: {
      objectives: validApprovedObjectives,
      pillars: validApprovedPillars,
      themes: validApprovedThemes,
      formats: validApprovedFormats,
      series: validApprovedSeries,
      distribution: validApprovedDistribution,
      governance: validApprovedGovernance,
    },
    pendingSuggestionsCount,
  };
}

export function canCompleteContentStrategy(state: ContentStrategyState): {
  allowed: boolean;
  blockers: string[];
} {
  const progress = computeContentStrategyProgress(state);
  const blockers: string[] = [];

  if (progress.approvedCounts.objectives === 0) {
    blockers.push('Approve at least one valid Content Objective (Section 01).');
  }
  if (progress.approvedCounts.pillars === 0) {
    blockers.push('Approve at least one distinctive Content Pillar (Section 02).');
  }
  if (progress.approvedCounts.themes === 0) {
    blockers.push('Approve at least one Content Theme or Topic linked to a pillar (Section 03).');
  }
  if (progress.approvedCounts.formats === 0) {
    blockers.push('Approve at least one Content Format (Section 04).');
  }
  if (progress.approvedCounts.series === 0) {
    blockers.push('Approve at least one Recurring Content Series (Section 04).');
  }
  if (progress.approvedCounts.distribution === 0) {
    blockers.push('Approve at least one Platform Distribution & Publishing plan (Section 05).');
  }
  if (progress.approvedCounts.governance === 0) {
    blockers.push('Approve at least one Content Governance & Measurement standard (Section 06).');
  }

  return {
    allowed: blockers.length === 0,
    blockers,
  };
}

// ============================================================================
// HYDRATION & PERSISTENCE SERIALIZATION
// ============================================================================

function normalizeAiRun(raw: unknown): ContentAiRunState {
  if (!isPlainObject(raw)) return createEmptyContentAiRunState();
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
    aiSuggestionsSummary: isPlainObject(raw.aiSuggestionsSummary) ? raw.aiSuggestionsSummary : null,
  };
}

export function hydrateContentStrategyState(
  brand: Brand,
  moduleRecord: BrandStrategyModule | null | undefined,
  upstreamSnapshot: ContentStrategyUpstreamSnapshot | null = null,
): ContentStrategyState {
  const initial = createInitialContentStrategyState(brand, upstreamSnapshot);
  if (!moduleRecord) return initial;

  if (moduleRecord.brandId !== brand.id) {
    throw new ContentStrategyIsolationError(
      `Brand context isolation error: loaded strategy module belongs to brand "${moduleRecord.brandId}" rather than "${brand.id}".`,
    );
  }
  if (moduleRecord.moduleKey !== 'contentStrategy') {
    throw new ContentStrategyIsolationError(
      `Unexpected module key "${moduleRecord.moduleKey}" when hydrating Content Strategy.`,
    );
  }

  const content = moduleRecord.content ?? {};
  if (typeof content.brandId === 'string' && content.brandId && content.brandId !== brand.id) {
    throw new ContentStrategyIsolationError(
      `Persisted content strategy data belongs to brand "${content.brandId}" rather than "${brand.id}".`,
    );
  }

  const objectives: ContentObjectiveItem[] = (Array.isArray(content.objectives) ? content.objectives : [])
    .map((raw, idx): ContentObjectiveItem | null => {
      if (!isPlainObject(raw)) return null;
      return {
        id: asString(raw.id, `cobj-${idx + 1}`).trim() || `cobj-${idx + 1}`,
        title: asString(raw.title),
        level: normalizeObjectiveLevel(raw.level),
        description: asString(raw.description),
        targetAudienceOutcomes: asStringArray(raw.targetAudienceOutcomes),
        desiredAudienceActions: asStringArray(raw.desiredAudienceActions),
        alignedMarketingGoalTitle: asString(raw.alignedMarketingGoalTitle),
        alignedMarketingObjectiveTitle: asString(raw.alignedMarketingObjectiveTitle),
        source: normalizeSource(raw.source),
        approved: raw.approved === true,
        approvedAt: asNullableString(raw.approvedAt),
      };
    })
    .filter((item): item is ContentObjectiveItem => item !== null);

  const aiSuggestedObjectives: AiSuggestedContentObjectiveItem[] = (
    Array.isArray(content.aiSuggestedObjectives) ? content.aiSuggestedObjectives : []
  )
    .map((raw, idx): AiSuggestedContentObjectiveItem | null => {
      if (!isPlainObject(raw) || !asString(raw.title).trim()) return null;
      return {
        id: asString(raw.id, `ai-cobj-${idx + 1}`).trim() || `ai-cobj-${idx + 1}`,
        title: asString(raw.title).trim(),
        level: normalizeObjectiveLevel(raw.level),
        description: asString(raw.description).trim(),
        targetAudienceOutcomes: asStringArray(raw.targetAudienceOutcomes),
        desiredAudienceActions: asStringArray(raw.desiredAudienceActions),
        alignedMarketingGoalTitle: asString(raw.alignedMarketingGoalTitle).trim(),
        alignedMarketingObjectiveTitle: asString(raw.alignedMarketingObjectiveTitle).trim(),
        suggestionStatus: normalizeSuggestionStatus(raw.suggestionStatus),
      };
    })
    .filter((item): item is AiSuggestedContentObjectiveItem => item !== null);

  const pillars: ContentPillarItem[] = (Array.isArray(content.pillars) ? content.pillars : [])
    .map((raw, idx): ContentPillarItem | null => {
      if (!isPlainObject(raw)) return null;
      return {
        id: asString(raw.id, `cpillar-${idx + 1}`).trim() || `cpillar-${idx + 1}`,
        name: asString(raw.name),
        description: asString(raw.description),
        strategicPurpose: asString(raw.strategicPurpose),
        targetAudienceSegment: asString(raw.targetAudienceSegment),
        relevantInterestsAndPainPoints: asStringArray(raw.relevantInterestsAndPainPoints),
        keyMessages: asStringArray(raw.keyMessages),
        supportingTopics: asStringArray(raw.supportingTopics),
        alignedMarketingObjectiveTitle: asString(raw.alignedMarketingObjectiveTitle),
        source: normalizeSource(raw.source),
        approved: raw.approved === true,
        approvedAt: asNullableString(raw.approvedAt),
      };
    })
    .filter((item): item is ContentPillarItem => item !== null);

  const aiSuggestedPillars: AiSuggestedContentPillarItem[] = (
    Array.isArray(content.aiSuggestedPillars) ? content.aiSuggestedPillars : []
  )
    .map((raw, idx): AiSuggestedContentPillarItem | null => {
      if (!isPlainObject(raw) || !asString(raw.name).trim()) return null;
      return {
        id: asString(raw.id, `ai-cpillar-${idx + 1}`).trim() || `ai-cpillar-${idx + 1}`,
        name: asString(raw.name).trim(),
        description: asString(raw.description).trim(),
        strategicPurpose: asString(raw.strategicPurpose).trim(),
        targetAudienceSegment: asString(raw.targetAudienceSegment).trim(),
        relevantInterestsAndPainPoints: asStringArray(raw.relevantInterestsAndPainPoints),
        keyMessages: asStringArray(raw.keyMessages),
        supportingTopics: asStringArray(raw.supportingTopics),
        alignedMarketingObjectiveTitle: asString(raw.alignedMarketingObjectiveTitle).trim(),
        suggestionStatus: normalizeSuggestionStatus(raw.suggestionStatus),
      };
    })
    .filter((item): item is AiSuggestedContentPillarItem => item !== null);

  const themes: ContentThemeTopicItem[] = (Array.isArray(content.themes) ? content.themes : [])
    .map((raw, idx): ContentThemeTopicItem | null => {
      if (!isPlainObject(raw)) return null;
      return {
        id: asString(raw.id, `ctheme-${idx + 1}`).trim() || `ctheme-${idx + 1}`,
        title: asString(raw.title),
        description: asString(raw.description),
        associatedPillarId: asString(raw.associatedPillarId),
        associatedPillarName: asString(raw.associatedPillarName),
        audienceRelevance: asString(raw.audienceRelevance),
        addressedNeedOrAspiration: asString(raw.addressedNeedOrAspiration),
        communicationAngle: asString(raw.communicationAngle),
        alignedMarketingObjectiveTitle: asString(raw.alignedMarketingObjectiveTitle),
        source: normalizeSource(raw.source),
        approved: raw.approved === true,
        approvedAt: asNullableString(raw.approvedAt),
      };
    })
    .filter((item): item is ContentThemeTopicItem => item !== null);

  const aiSuggestedThemes: AiSuggestedContentThemeTopicItem[] = (
    Array.isArray(content.aiSuggestedThemes) ? content.aiSuggestedThemes : []
  )
    .map((raw, idx): AiSuggestedContentThemeTopicItem | null => {
      if (!isPlainObject(raw) || !asString(raw.title).trim()) return null;
      const pillarName = asString(raw.associatedPillarName).trim();
      const matched =
        pillars.find((p) => p.id === asString(raw.matchedPillarId).trim()) ??
        matchByLabel(pillarName, pillars, (p) => p.name);
      return {
        id: asString(raw.id, `ai-ctheme-${idx + 1}`).trim() || `ai-ctheme-${idx + 1}`,
        title: asString(raw.title).trim(),
        description: asString(raw.description).trim(),
        associatedPillarName: matched?.name ?? pillarName,
        matchedPillarId: matched?.id ?? '',
        audienceRelevance: asString(raw.audienceRelevance).trim(),
        addressedNeedOrAspiration: asString(raw.addressedNeedOrAspiration).trim(),
        communicationAngle: asString(raw.communicationAngle).trim(),
        alignedMarketingObjectiveTitle: asString(raw.alignedMarketingObjectiveTitle).trim(),
        suggestionStatus: normalizeSuggestionStatus(raw.suggestionStatus),
      };
    })
    .filter((item): item is AiSuggestedContentThemeTopicItem => item !== null);

  const formats: ContentFormatItem[] = (Array.isArray(content.formats) ? content.formats : [])
    .map((raw, idx): ContentFormatItem | null => {
      if (!isPlainObject(raw)) return null;
      return {
        id: asString(raw.id, `cformat-${idx + 1}`).trim() || `cformat-${idx + 1}`,
        formatName: asString(raw.formatName),
        purpose: asString(raw.purpose),
        suitablePlatforms: asStringArray(raw.suitablePlatforms),
        audienceSuitability: asString(raw.audienceSuitability),
        relatedPillarNames: asStringArray(raw.relatedPillarNames),
        source: normalizeSource(raw.source),
        approved: raw.approved === true,
        approvedAt: asNullableString(raw.approvedAt),
      };
    })
    .filter((item): item is ContentFormatItem => item !== null);

  const aiSuggestedFormats: AiSuggestedContentFormatItem[] = (
    Array.isArray(content.aiSuggestedFormats) ? content.aiSuggestedFormats : []
  )
    .map((raw, idx): AiSuggestedContentFormatItem | null => {
      if (!isPlainObject(raw) || !asString(raw.formatName).trim()) return null;
      return {
        id: asString(raw.id, `ai-cformat-${idx + 1}`).trim() || `ai-cformat-${idx + 1}`,
        formatName: asString(raw.formatName).trim(),
        purpose: asString(raw.purpose).trim(),
        suitablePlatforms: asStringArray(raw.suitablePlatforms),
        audienceSuitability: asString(raw.audienceSuitability).trim(),
        relatedPillarNames: asStringArray(raw.relatedPillarNames),
        suggestionStatus: normalizeSuggestionStatus(raw.suggestionStatus),
      };
    })
    .filter((item): item is AiSuggestedContentFormatItem => item !== null);

  const series: ContentSeriesItem[] = (Array.isArray(content.series) ? content.series : [])
    .map((raw, idx): ContentSeriesItem | null => {
      if (!isPlainObject(raw)) return null;
      return {
        id: asString(raw.id, `cseries-${idx + 1}`).trim() || `cseries-${idx + 1}`,
        seriesName: asString(raw.seriesName),
        description: asString(raw.description),
        formatName: asString(raw.formatName),
        suitablePlatforms: asStringArray(raw.suitablePlatforms),
        relatedPillarNames: asStringArray(raw.relatedPillarNames),
        audienceSuitability: asString(raw.audienceSuitability),
        cadenceHint: asString(raw.cadenceHint),
        source: normalizeSource(raw.source),
        approved: raw.approved === true,
        approvedAt: asNullableString(raw.approvedAt),
      };
    })
    .filter((item): item is ContentSeriesItem => item !== null);

  const aiSuggestedSeries: AiSuggestedContentSeriesItem[] = (
    Array.isArray(content.aiSuggestedSeries) ? content.aiSuggestedSeries : []
  )
    .map((raw, idx): AiSuggestedContentSeriesItem | null => {
      if (!isPlainObject(raw) || !asString(raw.seriesName).trim()) return null;
      return {
        id: asString(raw.id, `ai-cseries-${idx + 1}`).trim() || `ai-cseries-${idx + 1}`,
        seriesName: asString(raw.seriesName).trim(),
        description: asString(raw.description).trim(),
        formatName: asString(raw.formatName).trim(),
        suitablePlatforms: asStringArray(raw.suitablePlatforms),
        relatedPillarNames: asStringArray(raw.relatedPillarNames),
        audienceSuitability: asString(raw.audienceSuitability).trim(),
        cadenceHint: asString(raw.cadenceHint).trim(),
        suggestionStatus: normalizeSuggestionStatus(raw.suggestionStatus),
      };
    })
    .filter((item): item is AiSuggestedContentSeriesItem => item !== null);

  const distribution: DistributionApproachItem[] = (
    Array.isArray(content.distribution) ? content.distribution : []
  )
    .map((raw, idx): DistributionApproachItem | null => {
      if (!isPlainObject(raw)) return null;
      return {
        id: asString(raw.id, `cdist-${idx + 1}`).trim() || `cdist-${idx + 1}`,
        platformName: asString(raw.platformName),
        channelRole: asString(raw.channelRole),
        platformConsiderations: asString(raw.platformConsiderations),
        recommendedFrequency: asString(raw.recommendedFrequency),
        contentMix: asStringArray(raw.contentMix),
        distributionApproach: asString(raw.distributionApproach),
        repurposingOpportunities: asStringArray(raw.repurposingOpportunities),
        publishingConstraints: asString(raw.publishingConstraints),
        source: normalizeSource(raw.source),
        approved: raw.approved === true,
        approvedAt: asNullableString(raw.approvedAt),
      };
    })
    .filter((item): item is DistributionApproachItem => item !== null);

  const aiSuggestedDistribution: AiSuggestedDistributionApproachItem[] = (
    Array.isArray(content.aiSuggestedDistribution) ? content.aiSuggestedDistribution : []
  )
    .map((raw, idx): AiSuggestedDistributionApproachItem | null => {
      if (!isPlainObject(raw) || !asString(raw.platformName).trim()) return null;
      return {
        id: asString(raw.id, `ai-cdist-${idx + 1}`).trim() || `ai-cdist-${idx + 1}`,
        platformName: asString(raw.platformName).trim(),
        channelRole: asString(raw.channelRole).trim(),
        platformConsiderations: asString(raw.platformConsiderations).trim(),
        recommendedFrequency: asString(raw.recommendedFrequency).trim(),
        contentMix: asStringArray(raw.contentMix),
        distributionApproach: asString(raw.distributionApproach).trim(),
        repurposingOpportunities: asStringArray(raw.repurposingOpportunities),
        publishingConstraints: asString(raw.publishingConstraints).trim(),
        suggestionStatus: normalizeSuggestionStatus(raw.suggestionStatus),
      };
    })
    .filter((item): item is AiSuggestedDistributionApproachItem => item !== null);

  const governance: ContentGovernanceStandardItem[] = (
    Array.isArray(content.governance) ? content.governance : []
  )
    .map((raw, idx): ContentGovernanceStandardItem | null => {
      if (!isPlainObject(raw)) return null;
      return {
        id: asString(raw.id, `cgov-${idx + 1}`).trim() || `cgov-${idx + 1}`,
        title: asString(raw.title),
        category: normalizeGovernanceCategory(raw.category),
        qualityStandards: asStringArray(raw.qualityStandards),
        brandVoiceCompliance: asString(raw.brandVoiceCompliance),
        messagingConsistency: asString(raw.messagingConsistency),
        editorialGuidelines: asStringArray(raw.editorialGuidelines),
        approvalConsiderations: asString(raw.approvalConsiderations),
        performanceIndicators: asStringArray(raw.performanceIndicators),
        marketingObjectiveAlignment: asString(raw.marketingObjectiveAlignment),
        source: normalizeSource(raw.source),
        approved: raw.approved === true,
        approvedAt: asNullableString(raw.approvedAt),
      };
    })
    .filter((item): item is ContentGovernanceStandardItem => item !== null);

  const aiSuggestedGovernance: AiSuggestedContentGovernanceStandardItem[] = (
    Array.isArray(content.aiSuggestedGovernance) ? content.aiSuggestedGovernance : []
  )
    .map((raw, idx): AiSuggestedContentGovernanceStandardItem | null => {
      if (!isPlainObject(raw) || !asString(raw.title).trim()) return null;
      return {
        id: asString(raw.id, `ai-cgov-${idx + 1}`).trim() || `ai-cgov-${idx + 1}`,
        title: asString(raw.title).trim(),
        category: normalizeGovernanceCategory(raw.category),
        qualityStandards: asStringArray(raw.qualityStandards),
        brandVoiceCompliance: asString(raw.brandVoiceCompliance).trim(),
        messagingConsistency: asString(raw.messagingConsistency).trim(),
        editorialGuidelines: asStringArray(raw.editorialGuidelines),
        approvalConsiderations: asString(raw.approvalConsiderations).trim(),
        performanceIndicators: asStringArray(raw.performanceIndicators),
        marketingObjectiveAlignment: asString(raw.marketingObjectiveAlignment).trim(),
        suggestionStatus: normalizeSuggestionStatus(raw.suggestionStatus),
      };
    })
    .filter((item): item is AiSuggestedContentGovernanceStandardItem => item !== null);

  const editorialContext: EditorialConstraintsInput = isPlainObject(content.editorialContext)
    ? {
        publishingCapacity: asString(content.editorialContext.publishingCapacity),
        productionConstraints: asString(content.editorialContext.productionConstraints),
        editorialNotes: asString(content.editorialContext.editorialNotes),
      }
    : createEmptyEditorialContext();

  const persistedUpstream: ContentStrategyUpstreamSnapshot | null = isPlainObject(
    content.upstreamSnapshot,
  )
    ? {
        foundationApprovedAt: asNullableString(content.upstreamSnapshot.foundationApprovedAt),
        messagingApprovedAt: asNullableString(content.upstreamSnapshot.messagingApprovedAt),
        customerIntelUpdatedAt: asNullableString(content.upstreamSnapshot.customerIntelUpdatedAt),
        marketingStrategyApprovedAt: asNullableString(
          content.upstreamSnapshot.marketingStrategyApprovedAt,
        ),
        approvedPersonasCount:
          typeof content.upstreamSnapshot.approvedPersonasCount === 'number'
            ? content.upstreamSnapshot.approvedPersonasCount
            : 0,
        approvedInterestsCount:
          typeof content.upstreamSnapshot.approvedInterestsCount === 'number'
            ? content.upstreamSnapshot.approvedInterestsCount
            : 0,
        approvedMarketingGoalsCount:
          typeof content.upstreamSnapshot.approvedMarketingGoalsCount === 'number'
            ? content.upstreamSnapshot.approvedMarketingGoalsCount
            : 0,
        approvedMarketingObjectivesCount:
          typeof content.upstreamSnapshot.approvedMarketingObjectivesCount === 'number'
            ? content.upstreamSnapshot.approvedMarketingObjectivesCount
            : 0,
        approvedMarketingChannelsCount:
          typeof content.upstreamSnapshot.approvedMarketingChannelsCount === 'number'
            ? content.upstreamSnapshot.approvedMarketingChannelsCount
            : 0,
        approvedMarketingKpisCount:
          typeof content.upstreamSnapshot.approvedMarketingKpisCount === 'number'
            ? content.upstreamSnapshot.approvedMarketingKpisCount
            : 0,
        positioningStatement: asString(content.upstreamSnapshot.positioningStatement),
        coreValueProposition: asString(content.upstreamSnapshot.coreValueProposition),
        primaryChannelNames: asStringArray(content.upstreamSnapshot.primaryChannelNames),
        primaryPersonaNames: asStringArray(content.upstreamSnapshot.primaryPersonaNames),
      }
    : null;

  const isCompleted = moduleRecord.status === 'completed';
  const rawSummary =
    isCompleted && isPlainObject(content.approvedSummary)
      ? (content.approvedSummary as unknown as ContentStrategyApprovedSummary)
      : null;

  return {
    schemaVersion: 1,
    brandId: brand.id,
    upstreamSnapshot: upstreamSnapshot ?? persistedUpstream,
    editorialContext,
    objectives,
    aiSuggestedObjectives,
    pillars,
    aiSuggestedPillars,
    themes,
    aiSuggestedThemes,
    formats,
    aiSuggestedFormats,
    series,
    aiSuggestedSeries,
    distribution,
    aiSuggestedDistribution,
    governance,
    aiSuggestedGovernance,
    objectivesSynthesis: normalizeAiRun(content.objectivesSynthesis),
    pillarsSynthesis: normalizeAiRun(content.pillarsSynthesis),
    themesSynthesis: normalizeAiRun(content.themesSynthesis),
    formatsSynthesis: normalizeAiRun(content.formatsSynthesis),
    distributionSynthesis: normalizeAiRun(content.distributionSynthesis),
    governanceSynthesis: normalizeAiRun(content.governanceSynthesis),
    completedAt: isCompleted ? asNullableString(content.completedAt) : null,
    approvedSummary: rawSummary,
  };
}

export function buildContentStrategyUpsertPayload(
  state: ContentStrategyState,
  requestedStatus: ModuleStatus,
): UpsertBrandModuleInput {
  let completedAt = state.completedAt;
  let approvedSummary = state.approvedSummary;

  if (requestedStatus === 'completed') {
    const check = canCompleteContentStrategy(state);
    if (!check.allowed) {
      throw new Error(
        check.blockers[0] ??
          'All six Content Strategy sections must contain valid approved items before completing.',
      );
    }

    const nowIso = new Date().toISOString();
    completedAt = nowIso;
    approvedSummary = {
      objectives: state.objectives.filter((o) => o.approved),
      pillars: state.pillars.filter((p) => p.approved),
      themes: state.themes.filter((t) => t.approved),
      formats: state.formats.filter((f) => f.approved),
      series: state.series.filter((s) => s.approved),
      distribution: state.distribution.filter((d) => d.approved),
      governance: state.governance.filter((g) => g.approved),
      editorialContext: { ...state.editorialContext },
      approvedAt: nowIso,
    };
  } else {
    completedAt = null;
    approvedSummary = null;
  }

  const runs = [
    state.objectivesSynthesis,
    state.pillarsSynthesis,
    state.themesSynthesis,
    state.formatsSynthesis,
    state.distributionSynthesis,
    state.governanceSynthesis,
  ].filter((run) => run.generatedAt !== null);

  runs.sort((a, b) => (b.generatedAt ?? '').localeCompare(a.generatedAt ?? ''));
  const latestRun = runs[0] ?? null;

  return {
    status: requestedStatus,
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
