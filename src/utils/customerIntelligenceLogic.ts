import type { PromptExecutionResult } from '../prompts/types.ts';
import type {
  Brand,
  BrandStrategyModule,
  ModuleStatus,
  UpsertBrandModuleInput,
} from '../types/brand.ts';
import type { FoundationSectionKey } from './brandFoundationLogic.ts';
import {
  MESSAGING_SECTIONS,
  MessagingIsolationError,
  canCompleteBrandMessaging,
  evaluateFoundationDependency,
  hydrateBrandMessagingState,
  type ApprovedFoundationSnapshot,
  type MessagingPillarItem,
  type MessagingSectionKey,
  type AudienceAngleItem,
} from './brandMessagingLogic.ts';

export type CustomerIntelStepKey = 'personas' | 'audienceInterests' | 'review';
export type SuggestionStatus = 'none' | 'pending_review' | 'approved' | 'rejected';
export type IntelligenceItemSource = 'manual' | 'ai_adopted' | 'edited_ai';

export interface CustomerDemographicFields {
  ageRange: string;
  location: string;
  incomeOrBudget: string;
  occupationOrRole: string;
  educationOrExperience: string;
  lifestyleOrContext: string;
}

export interface CustomerPersonaItem {
  id: string;
  name: string;
  roleOrSegment: string;
  summary: string;
  goals: string[];
  painPoints: string[];
  motivations: string[];
  objections: string[];
  purchasingTriggers: string[];
  decisionFactors: string[];
  informationSources: string[];
  communicationPreferences: string[];
  demographicsRelevant: boolean;
  demographics: CustomerDemographicFields;
  source: IntelligenceItemSource;
  aiHypothesisNote: string | null;
  approved: boolean;
  approvedAt: string | null;
}

export interface AiSuggestedPersonaItem {
  id: string;
  name: string;
  roleOrSegment: string;
  summary: string;
  goals: string[];
  painPoints: string[];
  motivations: string[];
  objections: string[];
  purchasingTriggers: string[];
  decisionFactors: string[];
  informationSources: string[];
  communicationPreferences: string[];
  demographicsRelevant: boolean;
  demographics: CustomerDemographicFields;
  suggestionStatus: Exclude<SuggestionStatus, 'none'>;
}

export interface AudienceInterestItem {
  id: string;
  topic: string;
  linkedPersonaIds: string[];
  frequentQuestions: string[];
  problemsToSolve: string[];
  contentConsumed: string[];
  searchTopics: string[];
  productOrServiceInterests: string[];
  purchaseTriggers: string[];
  concernsOrObjections: string[];
  seasonalOrSituationalInterests: string[];
  source: IntelligenceItemSource;
  approved: boolean;
  approvedAt: string | null;
}

export interface AiSuggestedInterestItem {
  id: string;
  topic: string;
  linkedPersonaNames: string[];
  matchedPersonaIds: string[];
  frequentQuestions: string[];
  problemsToSolve: string[];
  contentConsumed: string[];
  searchTopics: string[];
  productOrServiceInterests: string[];
  purchaseTriggers: string[];
  concernsOrObjections: string[];
  seasonalOrSituationalInterests: string[];
  suggestionStatus: Exclude<SuggestionStatus, 'none'>;
}

export interface ApprovedMessagingSnapshot {
  coreValueProposition: string;
  messagingPillars: MessagingPillarItem[];
  voiceAndTone: {
    attributes: string[];
    guardrails: string[];
  };
  audienceAngles: AudienceAngleItem[];
  approvedAt: string;
}

export interface CustomerIntelUpstreamSnapshot {
  foundationApprovedAt: string | null;
  messagingApprovedAt: string | null;
  targetMarketSummary: string;
  positioningStatement: string;
  coreValueProposition: string;
}

export interface CustomerIntelAiRunState {
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

export interface CustomerIntelligenceApprovedSummary {
  personas: CustomerPersonaItem[];
  interests: AudienceInterestItem[];
  approvedAt: string;
}

export interface CustomerIntelligenceState {
  schemaVersion: 1;
  brandId: string;
  upstreamSnapshot: CustomerIntelUpstreamSnapshot | null;
  personas: CustomerPersonaItem[];
  aiSuggestedPersonas: AiSuggestedPersonaItem[];
  interests: AudienceInterestItem[];
  aiSuggestedInterests: AiSuggestedInterestItem[];
  personaSynthesis: CustomerIntelAiRunState;
  interestSynthesis: CustomerIntelAiRunState;
  completedAt: string | null;
  approvedSummary: CustomerIntelligenceApprovedSummary | null;
}

export type CustomerIntelValidationErrors = Record<string, string>;

export class CustomerIntelligenceIsolationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CustomerIntelligenceIsolationError';
  }
}

export const CUSTOMER_INTEL_SECTIONS: ReadonlyArray<{
  key: 'personas' | 'audienceInterests';
  number: string;
  title: string;
  subtitle: string;
}> = [
  {
    key: 'personas',
    number: '01',
    title: 'Customer Personas',
    subtitle: 'Structured buyer profiles separating hypotheses from approved segments',
  },
  {
    key: 'audienceInterests',
    number: '02',
    title: 'Audience Interests',
    subtitle: 'Questions, problems, search topics, content habits, and purchase triggers',
  },
];

export function createEmptyDemographics(): CustomerDemographicFields {
  return {
    ageRange: '',
    location: '',
    incomeOrBudget: '',
    occupationOrRole: '',
    educationOrExperience: '',
    lifestyleOrContext: '',
  };
}

export function createEmptyAiRunState(): CustomerIntelAiRunState {
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

export function createBlankPersona(id: string): CustomerPersonaItem {
  return {
    id,
    name: '',
    roleOrSegment: '',
    summary: '',
    goals: [],
    painPoints: [],
    motivations: [],
    objections: [],
    purchasingTriggers: [],
    decisionFactors: [],
    informationSources: [],
    communicationPreferences: [],
    demographicsRelevant: false,
    demographics: createEmptyDemographics(),
    source: 'manual',
    aiHypothesisNote: null,
    approved: false,
    approvedAt: null,
  };
}

export function createBlankAudienceInterest(
  id: string,
  defaultPersonaIds: string[] = [],
): AudienceInterestItem {
  return {
    id,
    topic: '',
    linkedPersonaIds: [...defaultPersonaIds],
    frequentQuestions: [],
    problemsToSolve: [],
    contentConsumed: [],
    searchTopics: [],
    productOrServiceInterests: [],
    purchaseTriggers: [],
    concernsOrObjections: [],
    seasonalOrSituationalInterests: [],
    source: 'manual',
    approved: false,
    approvedAt: null,
  };
}

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

function normalizeDemographics(raw: unknown): CustomerDemographicFields {
  if (!isPlainObject(raw)) return createEmptyDemographics();
  return {
    ageRange: asString(raw.ageRange).trim(),
    location: asString(raw.location).trim(),
    incomeOrBudget: asString(raw.incomeOrBudget).trim(),
    occupationOrRole: asString(raw.occupationOrRole).trim(),
    educationOrExperience: asString(raw.educationOrExperience).trim(),
    lifestyleOrContext: asString(raw.lifestyleOrContext).trim(),
  };
}

function hasAnyDemographicValue(demographics: CustomerDemographicFields): boolean {
  return Object.values(demographics).some((val) => val.trim().length > 0);
}

function normalizeItemSource(value: unknown): IntelligenceItemSource {
  if (value === 'manual' || value === 'ai_adopted' || value === 'edited_ai') {
    return value;
  }
  return 'manual';
}

function normalizeSuggestionReviewStatus(
  value: unknown,
): Exclude<SuggestionStatus, 'none'> {
  if (value === 'approved' || value === 'rejected' || value === 'pending_review') {
    return value;
  }
  return 'pending_review';
}

function normalizePersonaItem(raw: unknown, idx: number): CustomerPersonaItem | null {
  if (!isPlainObject(raw)) return null;
  const demographics = normalizeDemographics(raw.demographics);
  return {
    id: asString(raw.id, `persona-${idx + 1}`).trim() || `persona-${idx + 1}`,
    name: asString(raw.name),
    roleOrSegment: asString(raw.roleOrSegment),
    summary: asString(raw.summary),
    goals: asStringArray(raw.goals),
    painPoints: asStringArray(raw.painPoints),
    motivations: asStringArray(raw.motivations),
    objections: asStringArray(raw.objections),
    purchasingTriggers: asStringArray(raw.purchasingTriggers),
    decisionFactors: asStringArray(raw.decisionFactors),
    informationSources: asStringArray(raw.informationSources),
    communicationPreferences: asStringArray(raw.communicationPreferences),
    demographicsRelevant:
      typeof raw.demographicsRelevant === 'boolean'
        ? raw.demographicsRelevant
        : hasAnyDemographicValue(demographics),
    demographics,
    source: normalizeItemSource(raw.source),
    aiHypothesisNote: asNullableString(raw.aiHypothesisNote),
    approved: raw.approved === true,
    approvedAt: asNullableString(raw.approvedAt),
  };
}

function normalizeSuggestedPersonaItem(
  raw: unknown,
  idx: number,
): AiSuggestedPersonaItem | null {
  if (!isPlainObject(raw)) return null;
  const demographics = normalizeDemographics(raw.demographics);
  const name = asString(raw.name).trim();
  const summary = asString(raw.summary).trim();
  if (!name && !summary) return null;

  return {
    id: asString(raw.id, `ai-persona-${idx + 1}`).trim() || `ai-persona-${idx + 1}`,
    name: name || `Suggested Persona ${idx + 1}`,
    roleOrSegment: asString(raw.roleOrSegment).trim(),
    summary,
    goals: asStringArray(raw.goals),
    painPoints: asStringArray(raw.painPoints),
    motivations: asStringArray(raw.motivations),
    objections: asStringArray(raw.objections),
    purchasingTriggers: asStringArray(raw.purchasingTriggers),
    decisionFactors: asStringArray(raw.decisionFactors),
    informationSources: asStringArray(raw.informationSources),
    communicationPreferences: asStringArray(raw.communicationPreferences),
    demographicsRelevant:
      typeof raw.demographicsRelevant === 'boolean'
        ? raw.demographicsRelevant
        : hasAnyDemographicValue(demographics),
    demographics,
    suggestionStatus: normalizeSuggestionReviewStatus(raw.suggestionStatus),
  };
}

function normalizeInterestItem(raw: unknown, idx: number): AudienceInterestItem | null {
  if (!isPlainObject(raw)) return null;
  return {
    id: asString(raw.id, `interest-${idx + 1}`).trim() || `interest-${idx + 1}`,
    topic: asString(raw.topic),
    linkedPersonaIds: Array.from(new Set(asStringArray(raw.linkedPersonaIds))),
    frequentQuestions: asStringArray(raw.frequentQuestions),
    problemsToSolve: asStringArray(raw.problemsToSolve),
    contentConsumed: asStringArray(raw.contentConsumed),
    searchTopics: asStringArray(raw.searchTopics),
    productOrServiceInterests: asStringArray(raw.productOrServiceInterests),
    purchaseTriggers: asStringArray(raw.purchaseTriggers),
    concernsOrObjections: asStringArray(raw.concernsOrObjections),
    seasonalOrSituationalInterests: asStringArray(raw.seasonalOrSituationalInterests),
    source: normalizeItemSource(raw.source),
    approved: raw.approved === true,
    approvedAt: asNullableString(raw.approvedAt),
  };
}

function normalizeSuggestedInterestItem(
  raw: unknown,
  idx: number,
  personas: readonly CustomerPersonaItem[],
): AiSuggestedInterestItem | null {
  if (!isPlainObject(raw)) return null;
  const topic = asString(raw.topic).trim();
  if (!topic) return null;

  const linkedPersonaNames = asStringArray(raw.linkedPersonaNames);
  const explicitMatched = asStringArray(raw.matchedPersonaIds);
  const matchedPersonaIds =
    explicitMatched.length > 0
      ? explicitMatched.filter((id) => personas.some((p) => p.id === id))
      : matchPersonaIdsByNames(linkedPersonaNames, personas);

  return {
    id: asString(raw.id, `ai-interest-${idx + 1}`).trim() || `ai-interest-${idx + 1}`,
    topic,
    linkedPersonaNames,
    matchedPersonaIds,
    frequentQuestions: asStringArray(raw.frequentQuestions),
    problemsToSolve: asStringArray(raw.problemsToSolve),
    contentConsumed: asStringArray(raw.contentConsumed),
    searchTopics: asStringArray(raw.searchTopics),
    productOrServiceInterests: asStringArray(raw.productOrServiceInterests),
    purchaseTriggers: asStringArray(raw.purchaseTriggers),
    concernsOrObjections: asStringArray(raw.concernsOrObjections),
    seasonalOrSituationalInterests: asStringArray(raw.seasonalOrSituationalInterests),
    suggestionStatus: normalizeSuggestionReviewStatus(raw.suggestionStatus),
  };
}

function normalizeAiRunState(raw: unknown): CustomerIntelAiRunState {
  if (!isPlainObject(raw)) return createEmptyAiRunState();
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

export function matchPersonaIdsByNames(
  personaNames: readonly string[],
  personas: readonly CustomerPersonaItem[],
): string[] {
  const approvedOrAll = personas.filter((p) => p.approved);
  const searchPool = approvedOrAll.length > 0 ? approvedOrAll : personas;
  const matched = new Set<string>();

  for (const rawName of personaNames) {
    const normalizedTarget = rawName.trim().toLowerCase();
    if (!normalizedTarget) continue;

    const exact = searchPool.find((p) => p.name.trim().toLowerCase() === normalizedTarget);
    if (exact) {
      matched.add(exact.id);
      continue;
    }

    const partialMatches = searchPool.filter((p) => {
      const candidate = p.name.trim().toLowerCase();
      return (
        candidate.length > 0 &&
        (candidate.includes(normalizedTarget) || normalizedTarget.includes(candidate))
      );
    });
    if (partialMatches.length === 1) {
      matched.add(partialMatches[0].id);
    }
  }

  return Array.from(matched);
}

export function createInitialCustomerIntelligenceState(
  brand: Brand,
  upstreamSnapshot: CustomerIntelUpstreamSnapshot | null = null,
): CustomerIntelligenceState {
  return {
    schemaVersion: 1,
    brandId: brand.id,
    upstreamSnapshot,
    personas: [],
    aiSuggestedPersonas: [],
    interests: [],
    aiSuggestedInterests: [],
    personaSynthesis: createEmptyAiRunState(),
    interestSynthesis: createEmptyAiRunState(),
    completedAt: null,
    approvedSummary: null,
  };
}

export interface CustomerIntelligenceDependencyEvaluation {
  ready: boolean;
  foundationReady: boolean;
  messagingReady: boolean;
  foundationStatus: ModuleStatus;
  messagingStatus: ModuleStatus;
  missingFoundationSections: FoundationSectionKey[];
  missingMessagingSections: MessagingSectionKey[];
  approvedFoundation: ApprovedFoundationSnapshot | null;
  approvedMessaging: ApprovedMessagingSnapshot | null;
  upstreamSnapshot: CustomerIntelUpstreamSnapshot | null;
  reason: string | null;
}

/**
 * Verifies BOTH Brand Foundation AND Brand Messaging belong to the exact brand/owner
 * and are genuinely completed + approved before Customer Intelligence unlocks AI synthesis.
 */
export function evaluateCustomerIntelligenceDependencies(
  brand: Brand,
  strategyModules: readonly BrandStrategyModule[] | null | undefined,
): CustomerIntelligenceDependencyEvaluation {
  const list = strategyModules ?? [];
  for (const mod of list) {
    if (mod.brandId !== brand.id) {
      throw new CustomerIntelligenceIsolationError(
        `Brand context isolation error: module "${mod.moduleKey}" belongs to brand "${mod.brandId}" rather than "${brand.id}".`,
      );
    }
    if (brand.userId && mod.userId && mod.userId !== brand.userId) {
      throw new CustomerIntelligenceIsolationError(
        `Brand ownership isolation error: module "${mod.moduleKey}" does not belong to the active brand owner.`,
      );
    }
  }

  const foundationModule = list.find((m) => m.moduleKey === 'brandFoundation') ?? null;
  const messagingModule = list.find((m) => m.moduleKey === 'brandMessaging') ?? null;

  let foundationEval;
  try {
    foundationEval = evaluateFoundationDependency(brand, foundationModule);
  } catch (err) {
    if (err instanceof MessagingIsolationError) {
      throw new CustomerIntelligenceIsolationError(err.message);
    }
    throw err;
  }

  let messagingStatus: ModuleStatus = messagingModule?.status ?? 'not_started';
  let messagingReady = false;
  let missingMessagingSections: MessagingSectionKey[] = MESSAGING_SECTIONS.map((s) => s.key);
  let approvedMessaging: ApprovedMessagingSnapshot | null = null;
  let messagingReason: string | null = null;

  if (!messagingModule) {
    messagingReason =
      'Complete and approve Brand Messaging before generating Customer Intelligence.';
  } else {
    let hydratedMessaging;
    try {
      hydratedMessaging = hydrateBrandMessagingState(
        brand,
        messagingModule,
        foundationEval.approvedFoundation,
      );
    } catch (err) {
      if (err instanceof MessagingIsolationError) {
        throw new CustomerIntelligenceIsolationError(err.message);
      }
      throw err;
    }

    const msgCheck = canCompleteBrandMessaging(hydratedMessaging);
    missingMessagingSections = msgCheck.incompleteSections;

    if (messagingModule.status !== 'completed') {
      messagingReason =
        messagingModule.status === 'in_progress'
          ? 'Brand Messaging is still in progress. Approve and mark Brand Messaging completed before proceeding.'
          : 'Complete and approve Brand Messaging before generating Customer Intelligence.';
    } else if (!msgCheck.allowed) {
      messagingReason =
        'Brand Messaging has incomplete or unapproved components. Review and complete Brand Messaging first.';
    } else {
      messagingReady = true;
      const summary = hydratedMessaging.approvedSummary;
      approvedMessaging = {
        coreValueProposition:
          summary?.coreValueProposition ??
          hydratedMessaging.coreValueProposition.statement.trim(),
        messagingPillars:
          summary?.messagingPillars ?? hydratedMessaging.messagingPillars.pillars,
        voiceAndTone: summary?.voiceAndTone ?? {
          attributes: hydratedMessaging.voiceAndTone.attributes,
          guardrails: hydratedMessaging.voiceAndTone.guardrails,
        },
        audienceAngles: summary?.audienceAngles ?? hydratedMessaging.audienceAngles.angles,
        approvedAt:
          summary?.approvedAt ??
          hydratedMessaging.completedAt ??
          messagingModule.updatedAt,
      };
    }
  }

  const ready = foundationEval.ready && messagingReady;

  let reason: string | null = null;
  if (!foundationEval.ready && !messagingReady) {
    reason =
      'Complete and approve both Brand Foundation and Brand Messaging before running Customer Intelligence AI generation.';
  } else if (!foundationEval.ready) {
    reason = foundationEval.reason;
  } else if (!messagingReady) {
    reason = messagingReason;
  }

  const upstreamSnapshot: CustomerIntelUpstreamSnapshot | null =
    ready && foundationEval.approvedFoundation && approvedMessaging
      ? {
          foundationApprovedAt: foundationEval.approvedFoundation.approvedAt,
          messagingApprovedAt: approvedMessaging.approvedAt,
          targetMarketSummary: brand.targetMarket.trim(),
          positioningStatement: foundationEval.approvedFoundation.positioningStatement,
          coreValueProposition: approvedMessaging.coreValueProposition,
        }
      : null;

  return {
    ready,
    foundationReady: foundationEval.ready,
    messagingReady,
    foundationStatus: foundationEval.status,
    messagingStatus,
    missingFoundationSections: foundationEval.missingSections,
    missingMessagingSections,
    approvedFoundation: foundationEval.approvedFoundation,
    approvedMessaging,
    upstreamSnapshot,
    reason,
  };
}

export function checkPersonaGenerationReadiness(
  brand: Brand,
  strategyModules: readonly BrandStrategyModule[] | null | undefined,
): {
  ready: boolean;
  dependenciesReady: boolean;
  profileReady: boolean;
  missingProfileFields: string[];
  dependencyEvaluation: CustomerIntelligenceDependencyEvaluation;
  reason: string | null;
} {
  const dependencyEvaluation = evaluateCustomerIntelligenceDependencies(brand, strategyModules);

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

export function checkInterestGenerationReadiness(
  brand: Brand,
  strategyModules: readonly BrandStrategyModule[] | null | undefined,
  state: CustomerIntelligenceState,
): {
  ready: boolean;
  dependenciesReady: boolean;
  profileReady: boolean;
  hasApprovedPersonas: boolean;
  approvedPersonasCount: number;
  missingProfileFields: string[];
  dependencyEvaluation: CustomerIntelligenceDependencyEvaluation;
  reason: string | null;
} {
  const base = checkPersonaGenerationReadiness(brand, strategyModules);
  const validApprovedPersonas = state.personas.filter(
    (p) => p.approved && Object.keys(validatePersona(p)).length === 0,
  );
  const hasApprovedPersonas = validApprovedPersonas.length > 0;
  const ready = base.ready && hasApprovedPersonas;

  let reason = base.reason;
  if (!reason && !hasApprovedPersonas) {
    reason =
      'Approve at least one complete Customer Persona before generating AI Audience Interests.';
  }

  return {
    ready,
    dependenciesReady: base.dependenciesReady,
    profileReady: base.profileReady,
    hasApprovedPersonas,
    approvedPersonasCount: validApprovedPersonas.length,
    missingProfileFields: base.missingProfileFields,
    dependencyEvaluation: base.dependencyEvaluation,
    reason,
  };
}

export function validatePersona(persona: CustomerPersonaItem): CustomerIntelValidationErrors {
  const errors: CustomerIntelValidationErrors = {};
  if (!persona.name.trim()) {
    errors.name = 'Persona name is required.';
  }
  if (!persona.roleOrSegment.trim()) {
    errors.roleOrSegment = 'Specify the role, segment, or buyer archetype.';
  }
  if (!persona.summary.trim()) {
    errors.summary = 'Provide a short summary describing this customer persona.';
  }
  if (persona.goals.filter((g) => g.trim()).length === 0) {
    errors.goals = 'Add at least one customer goal.';
  }
  if (persona.painPoints.filter((p) => p.trim()).length === 0) {
    errors.painPoints = 'Add at least one pain point or frustration.';
  }
  if (persona.purchasingTriggers.filter((t) => t.trim()).length === 0) {
    errors.purchasingTriggers = 'Add at least one purchasing trigger.';
  }
  if (persona.decisionFactors.filter((d) => d.trim()).length === 0) {
    errors.decisionFactors = 'Add at least one key purchasing decision factor.';
  }
  return errors;
}

export function countInterestSignals(interest: AudienceInterestItem): number {
  return (
    interest.frequentQuestions.filter((v) => v.trim()).length +
    interest.problemsToSolve.filter((v) => v.trim()).length +
    interest.contentConsumed.filter((v) => v.trim()).length +
    interest.searchTopics.filter((v) => v.trim()).length +
    interest.productOrServiceInterests.filter((v) => v.trim()).length +
    interest.purchaseTriggers.filter((v) => v.trim()).length +
    interest.concernsOrObjections.filter((v) => v.trim()).length +
    interest.seasonalOrSituationalInterests.filter((v) => v.trim()).length
  );
}

export function validateAudienceInterest(
  interest: AudienceInterestItem,
  personas: readonly CustomerPersonaItem[],
): CustomerIntelValidationErrors {
  const errors: CustomerIntelValidationErrors = {};
  if (!interest.topic.trim()) {
    errors.topic = 'Interest theme or topic name is required.';
  }

  const personaIdSet = new Set(personas.map((p) => p.id));
  const validLinkedIds = interest.linkedPersonaIds.filter((id) => personaIdSet.has(id));
  if (validLinkedIds.length === 0) {
    errors.linkedPersonaIds = 'Link this interest to at least one customer persona.';
  }

  if (countInterestSignals(interest) === 0) {
    errors.signals =
      'Add at least one insight across questions, problems, content consumed, search topics, product interests, triggers, objections, or seasonal interests.';
  }

  return errors;
}

export function buildCustomerIntelPromptVariables(
  brand: Brand,
  state: CustomerIntelligenceState,
): Record<string, string> {
  const notes: string[] = [];
  if (brand.additionalNotes?.trim()) {
    notes.push(brand.additionalNotes.trim());
  }
  const approvedPersonas = state.personas.filter((p) => p.approved);
  if (approvedPersonas.length > 0) {
    notes.push(
      `Existing approved personas: ${approvedPersonas.map((p) => `${p.name} (${p.roleOrSegment})`).join('; ')}`,
    );
  }
  return notes.length > 0 ? { additionalNotes: notes.join(' | ') } : {};
}

export function applyAiPersonasResult(
  current: CustomerIntelligenceState,
  executionResult: PromptExecutionResult,
): { applied: boolean; state: CustomerIntelligenceState; error?: string } {
  if (executionResult.status !== 'success') {
    return { applied: false, state: current, error: 'Prompt execution did not succeed.' };
  }

  const output = executionResult.output;
  const rawPersonas = Array.isArray(output.personas) ? output.personas : [];
  const parsedSuggestions = rawPersonas
    .map((item, idx) =>
      normalizeSuggestedPersonaItem(
        isPlainObject(item)
          ? { ...item, id: asString(item.id, `ai-persona-${Date.now()}-${idx + 1}`) }
          : item,
        idx,
      ),
    )
    .filter((item): item is AiSuggestedPersonaItem => item !== null)
    .map((item) => ({
      ...item,
      suggestionStatus: 'pending_review' as const,
    }));

  if (parsedSuggestions.length === 0) {
    return {
      applied: false,
      state: current,
      error: 'AI returned no structured customer persona hypotheses.',
    };
  }

  // Safeguard: AI generation NEVER modifies or removes existing user-curated / approved personas.
  return {
    applied: true,
    state: {
      ...current,
      aiSuggestedPersonas: parsedSuggestions,
      personaSynthesis: {
        promptId: executionResult.metadata.promptId,
        promptVersion: executionResult.metadata.promptVersion,
        sourceClassification: executionResult.metadata.sourceClassification,
        model: executionResult.metadata.model,
        generatedAt: executionResult.metadata.generatedAt,
        researchCaveat:
          asNullableString(output.researchCaveat) ??
          'AI-generated persona hypotheses based on supplied brand strategy; validate with real customer evidence before treating as empirical research.',
        suppliedFactsUsed: asStringArray(output.suppliedFactsUsed),
        missingContextNotes: asStringArray(output.missingContextNotes),
        aiSuggestionsSummary: isPlainObject(output.aiSuggestions) ? output.aiSuggestions : null,
      },
    },
  };
}

export function applyAiInterestsResult(
  current: CustomerIntelligenceState,
  executionResult: PromptExecutionResult,
): { applied: boolean; state: CustomerIntelligenceState; error?: string } {
  if (executionResult.status !== 'success') {
    return { applied: false, state: current, error: 'Prompt execution did not succeed.' };
  }

  const output = executionResult.output;
  const rawInterests = Array.isArray(output.interests) ? output.interests : [];
  const parsedSuggestions = rawInterests
    .map((item, idx) =>
      normalizeSuggestedInterestItem(
        isPlainObject(item)
          ? { ...item, id: asString(item.id, `ai-interest-${Date.now()}-${idx + 1}`) }
          : item,
        idx,
        current.personas,
      ),
    )
    .filter((item): item is AiSuggestedInterestItem => item !== null)
    .map((item) => ({
      ...item,
      suggestionStatus: 'pending_review' as const,
    }));

  if (parsedSuggestions.length === 0) {
    return {
      applied: false,
      state: current,
      error: 'AI returned no structured audience interest hypotheses.',
    };
  }

  // Safeguard: AI generation NEVER overwrites or deletes existing user-approved interests.
  return {
    applied: true,
    state: {
      ...current,
      aiSuggestedInterests: parsedSuggestions,
      interestSynthesis: {
        promptId: executionResult.metadata.promptId,
        promptVersion: executionResult.metadata.promptVersion,
        sourceClassification: executionResult.metadata.sourceClassification,
        model: executionResult.metadata.model,
        generatedAt: executionResult.metadata.generatedAt,
        researchCaveat:
          asNullableString(output.researchCaveat) ??
          'AI-generated audience interest hypotheses derived from brand strategy and approved personas.',
        suppliedFactsUsed: asStringArray(output.suppliedFactsUsed),
        missingContextNotes: asStringArray(output.missingContextNotes),
        aiSuggestionsSummary: isPlainObject(output.aiSuggestions) ? output.aiSuggestions : null,
      },
    },
  };
}

export function adoptAiPersonaSuggestion(
  state: CustomerIntelligenceState,
  suggestionId: string,
  newPersonaId: string,
): { state: CustomerIntelligenceState; adoptedPersona: CustomerPersonaItem | null } {
  const suggestion = state.aiSuggestedPersonas.find((s) => s.id === suggestionId);
  if (!suggestion) {
    return { state, adoptedPersona: null };
  }

  const adoptedPersona: CustomerPersonaItem = {
    id: newPersonaId,
    name: suggestion.name,
    roleOrSegment: suggestion.roleOrSegment,
    summary: suggestion.summary,
    goals: [...suggestion.goals],
    painPoints: [...suggestion.painPoints],
    motivations: [...suggestion.motivations],
    objections: [...suggestion.objections],
    purchasingTriggers: [...suggestion.purchasingTriggers],
    decisionFactors: [...suggestion.decisionFactors],
    informationSources: [...suggestion.informationSources],
    communicationPreferences: [...suggestion.communicationPreferences],
    demographicsRelevant: suggestion.demographicsRelevant,
    demographics: { ...suggestion.demographics },
    source: 'ai_adopted',
    aiHypothesisNote:
      state.personaSynthesis.researchCaveat ??
      'Adopted from AI persona hypothesis; verify and approve before completion.',
    approved: false,
    approvedAt: null,
  };

  return {
    adoptedPersona,
    state: {
      ...state,
      completedAt: null,
      approvedSummary: null,
      personas: [...state.personas, adoptedPersona],
      aiSuggestedPersonas: state.aiSuggestedPersonas.map((item) =>
        item.id === suggestionId ? { ...item, suggestionStatus: 'approved' } : item,
      ),
    },
  };
}

export function dismissAiPersonaSuggestion(
  state: CustomerIntelligenceState,
  suggestionId: string,
): CustomerIntelligenceState {
  return {
    ...state,
    aiSuggestedPersonas: state.aiSuggestedPersonas.map((item) =>
      item.id === suggestionId ? { ...item, suggestionStatus: 'rejected' } : item,
    ),
  };
}

export function adoptAiInterestSuggestion(
  state: CustomerIntelligenceState,
  suggestionId: string,
  newInterestId: string,
): { state: CustomerIntelligenceState; adoptedInterest: AudienceInterestItem | null } {
  const suggestion = state.aiSuggestedInterests.find((s) => s.id === suggestionId);
  if (!suggestion) {
    return { state, adoptedInterest: null };
  }

  const validPersonaIds = new Set(state.personas.map((p) => p.id));
  const resolvedIds = suggestion.matchedPersonaIds.filter((id) => validPersonaIds.has(id));
  const fallbackApprovedPersona = state.personas.find((p) => p.approved) ?? state.personas[0];
  const linkedPersonaIds =
    resolvedIds.length > 0
      ? resolvedIds
      : fallbackApprovedPersona
        ? [fallbackApprovedPersona.id]
        : [];

  const adoptedInterest: AudienceInterestItem = {
    id: newInterestId,
    topic: suggestion.topic,
    linkedPersonaIds,
    frequentQuestions: [...suggestion.frequentQuestions],
    problemsToSolve: [...suggestion.problemsToSolve],
    contentConsumed: [...suggestion.contentConsumed],
    searchTopics: [...suggestion.searchTopics],
    productOrServiceInterests: [...suggestion.productOrServiceInterests],
    purchaseTriggers: [...suggestion.purchaseTriggers],
    concernsOrObjections: [...suggestion.concernsOrObjections],
    seasonalOrSituationalInterests: [...suggestion.seasonalOrSituationalInterests],
    source: 'ai_adopted',
    approved: false,
    approvedAt: null,
  };

  return {
    adoptedInterest,
    state: {
      ...state,
      completedAt: null,
      approvedSummary: null,
      interests: [...state.interests, adoptedInterest],
      aiSuggestedInterests: state.aiSuggestedInterests.map((item) =>
        item.id === suggestionId ? { ...item, suggestionStatus: 'approved' } : item,
      ),
    },
  };
}

export function dismissAiInterestSuggestion(
  state: CustomerIntelligenceState,
  suggestionId: string,
): CustomerIntelligenceState {
  return {
    ...state,
    aiSuggestedInterests: state.aiSuggestedInterests.map((item) =>
      item.id === suggestionId ? { ...item, suggestionStatus: 'rejected' } : item,
    ),
  };
}

export function removePersonaFromState(
  state: CustomerIntelligenceState,
  personaId: string,
): CustomerIntelligenceState {
  const nextPersonas = state.personas.filter((p) => p.id !== personaId);
  const nextInterests = state.interests.map((interest) => {
    const nextLinked = interest.linkedPersonaIds.filter((id) => id !== personaId);
    const lostLastLink = interest.linkedPersonaIds.includes(personaId) && nextLinked.length === 0;
    return {
      ...interest,
      linkedPersonaIds: nextLinked,
      ...(lostLastLink ? { approved: false, approvedAt: null } : {}),
    };
  });

  const nextSuggestedInterests = state.aiSuggestedInterests.map((item) => ({
    ...item,
    matchedPersonaIds: item.matchedPersonaIds.filter((id) => id !== personaId),
  }));

  return {
    ...state,
    completedAt: null,
    approvedSummary: null,
    personas: nextPersonas,
    interests: nextInterests,
    aiSuggestedInterests: nextSuggestedInterests,
  };
}

export function removeInterestFromState(
  state: CustomerIntelligenceState,
  interestId: string,
): CustomerIntelligenceState {
  return {
    ...state,
    completedAt: null,
    approvedSummary: null,
    interests: state.interests.filter((item) => item.id !== interestId),
  };
}

export function hasAnyApprovedCustomerIntelligence(
  state: CustomerIntelligenceState,
): boolean {
  return (
    state.personas.some((p) => p.approved) ||
    state.interests.some((i) => i.approved) ||
    state.personaSynthesis.generatedAt !== null ||
    state.interestSynthesis.generatedAt !== null
  );
}

export interface CustomerIntelligenceProgressSummary {
  approvedCount: number;
  totalSections: number;
  percentage: number;
  allSectionsApproved: boolean;
  approvedPersonasCount: number;
  totalPersonasCount: number;
  pendingPersonaSuggestionsCount: number;
  approvedInterestsCount: number;
  totalInterestsCount: number;
  pendingInterestSuggestionsCount: number;
  sectionStatuses: Record<'personas' | 'audienceInterests', 'approved' | 'in_progress' | 'not_started'>;
}

export function computeCustomerIntelligenceProgress(
  state: CustomerIntelligenceState,
): CustomerIntelligenceProgressSummary {
  const validApprovedPersonas = state.personas.filter(
    (p) => p.approved && Object.keys(validatePersona(p)).length === 0,
  );
  const validApprovedPersonaIds = new Set(validApprovedPersonas.map((p) => p.id));

  const validApprovedInterests = state.interests.filter(
    (i) =>
      i.approved &&
      Object.keys(validateAudienceInterest(i, state.personas)).length === 0 &&
      i.linkedPersonaIds.some((id) => validApprovedPersonaIds.has(id)),
  );

  const personasStatus: 'approved' | 'in_progress' | 'not_started' =
    validApprovedPersonas.length > 0
      ? 'approved'
      : state.personas.length > 0 || state.aiSuggestedPersonas.length > 0
        ? 'in_progress'
        : 'not_started';

  const interestsStatus: 'approved' | 'in_progress' | 'not_started' =
    validApprovedInterests.length > 0
      ? 'approved'
      : state.interests.length > 0 || state.aiSuggestedInterests.length > 0
        ? 'in_progress'
        : 'not_started';

  const approvedCount =
    (personasStatus === 'approved' ? 1 : 0) + (interestsStatus === 'approved' ? 1 : 0);

  return {
    approvedCount,
    totalSections: 2,
    percentage: Math.round((approvedCount / 2) * 100),
    allSectionsApproved: approvedCount === 2,
    approvedPersonasCount: validApprovedPersonas.length,
    totalPersonasCount: state.personas.length,
    pendingPersonaSuggestionsCount: state.aiSuggestedPersonas.filter(
      (s) => s.suggestionStatus === 'pending_review',
    ).length,
    approvedInterestsCount: validApprovedInterests.length,
    totalInterestsCount: state.interests.length,
    pendingInterestSuggestionsCount: state.aiSuggestedInterests.filter(
      (s) => s.suggestionStatus === 'pending_review',
    ).length,
    sectionStatuses: {
      personas: personasStatus,
      audienceInterests: interestsStatus,
    },
  };
}

export function canCompleteCustomerIntelligence(state: CustomerIntelligenceState): {
  allowed: boolean;
  blockers: string[];
  approvedPersonasCount: number;
  approvedInterestsCount: number;
  unapprovedPersonaCount: number;
  unapprovedInterestCount: number;
} {
  const blockers: string[] = [];

  const approvedPersonas = state.personas.filter((p) => p.approved);
  const invalidApprovedPersona = approvedPersonas.find(
    (p) => Object.keys(validatePersona(p)).length > 0,
  );
  if (approvedPersonas.length === 0) {
    blockers.push('Approve at least one complete Customer Persona.');
  } else if (invalidApprovedPersona) {
    blockers.push(
      `Approved persona "${invalidApprovedPersona.name || 'Untitled'}" is missing required behavioral or decision details.`,
    );
  }

  const approvedPersonaIds = new Set(
    approvedPersonas
      .filter((p) => Object.keys(validatePersona(p)).length === 0)
      .map((p) => p.id),
  );

  const approvedInterests = state.interests.filter((i) => i.approved);
  if (approvedInterests.length === 0) {
    blockers.push('Approve at least one Audience Interest cluster linked to an approved persona.');
  } else {
    for (const interest of approvedInterests) {
      const errs = validateAudienceInterest(interest, state.personas);
      if (Object.keys(errs).length > 0) {
        blockers.push(
          `Approved interest "${interest.topic || 'Untitled'}" is incomplete: ${Object.values(errs)[0]}`,
        );
        break;
      }
      if (!interest.linkedPersonaIds.some((id) => approvedPersonaIds.has(id))) {
        blockers.push(
          `Approved interest "${interest.topic || 'Untitled'}" must be linked to at least one approved persona.`,
        );
        break;
      }
    }
  }

  return {
    allowed: blockers.length === 0,
    blockers,
    approvedPersonasCount: approvedPersonas.length,
    approvedInterestsCount: approvedInterests.length,
    unapprovedPersonaCount: state.personas.filter((p) => !p.approved).length,
    unapprovedInterestCount: state.interests.filter((i) => !i.approved).length,
  };
}

export function hydrateCustomerIntelligenceState(
  brand: Brand,
  moduleRecord: BrandStrategyModule | null | undefined,
  upstreamSnapshot: CustomerIntelUpstreamSnapshot | null = null,
): CustomerIntelligenceState {
  const initial = createInitialCustomerIntelligenceState(brand, upstreamSnapshot);
  if (!moduleRecord) {
    return initial;
  }

  if (moduleRecord.brandId !== brand.id) {
    throw new CustomerIntelligenceIsolationError(
      `Brand context isolation error: loaded strategy module belongs to brand "${moduleRecord.brandId}" rather than "${brand.id}".`,
    );
  }

  if (moduleRecord.moduleKey !== 'customerIntelligence') {
    throw new CustomerIntelligenceIsolationError(
      `Unexpected module key "${moduleRecord.moduleKey}" when hydrating Customer Intelligence.`,
    );
  }

  const content = moduleRecord.content ?? {};
  if (typeof content.brandId === 'string' && content.brandId && content.brandId !== brand.id) {
    throw new CustomerIntelligenceIsolationError(
      `Persisted customer intelligence content belongs to brand "${content.brandId}" rather than "${brand.id}".`,
    );
  }

  const personas = (Array.isArray(content.personas) ? content.personas : [])
    .map((item, idx) => normalizePersonaItem(item, idx))
    .filter((item): item is CustomerPersonaItem => item !== null);

  const aiSuggestedPersonas = (
    Array.isArray(content.aiSuggestedPersonas) ? content.aiSuggestedPersonas : []
  )
    .map((item, idx) => normalizeSuggestedPersonaItem(item, idx))
    .filter((item): item is AiSuggestedPersonaItem => item !== null);

  const interests = (Array.isArray(content.interests) ? content.interests : [])
    .map((item, idx) => normalizeInterestItem(item, idx))
    .filter((item): item is AudienceInterestItem => item !== null);

  const aiSuggestedInterests = (
    Array.isArray(content.aiSuggestedInterests) ? content.aiSuggestedInterests : []
  )
    .map((item, idx) => normalizeSuggestedInterestItem(item, idx, personas))
    .filter((item): item is AiSuggestedInterestItem => item !== null);

  const storedUpstream = isPlainObject(content.upstreamSnapshot)
    ? ({
        foundationApprovedAt: asNullableString(content.upstreamSnapshot.foundationApprovedAt),
        messagingApprovedAt: asNullableString(content.upstreamSnapshot.messagingApprovedAt),
        targetMarketSummary: asString(content.upstreamSnapshot.targetMarketSummary),
        positioningStatement: asString(content.upstreamSnapshot.positioningStatement),
        coreValueProposition: asString(content.upstreamSnapshot.coreValueProposition),
      } satisfies CustomerIntelUpstreamSnapshot)
    : null;

  const approvedSummary =
    moduleRecord.status === 'completed' && isPlainObject(content.approvedSummary)
      ? ({
          personas: (Array.isArray(content.approvedSummary.personas)
            ? content.approvedSummary.personas
            : []
          )
            .map((item, idx) => normalizePersonaItem(item, idx))
            .filter((item): item is CustomerPersonaItem => item !== null),
          interests: (Array.isArray(content.approvedSummary.interests)
            ? content.approvedSummary.interests
            : []
          )
            .map((item, idx) => normalizeInterestItem(item, idx))
            .filter((item): item is AudienceInterestItem => item !== null),
          approvedAt:
            asNullableString(content.approvedSummary.approvedAt) ??
            asNullableString(content.completedAt) ??
            moduleRecord.updatedAt,
        } satisfies CustomerIntelligenceApprovedSummary)
      : null;

  return {
    schemaVersion: 1,
    brandId: brand.id,
    upstreamSnapshot: upstreamSnapshot ?? storedUpstream,
    personas,
    aiSuggestedPersonas,
    interests,
    aiSuggestedInterests,
    personaSynthesis: normalizeAiRunState(content.personaSynthesis),
    interestSynthesis: normalizeAiRunState(content.interestSynthesis),
    completedAt: asNullableString(content.completedAt),
    approvedSummary,
  };
}

export function buildCustomerIntelligenceUpsertPayload(
  state: CustomerIntelligenceState,
  targetStatus: ModuleStatus,
  nowIso = new Date().toISOString(),
): UpsertBrandModuleInput {
  if (targetStatus === 'completed') {
    const check = canCompleteCustomerIntelligence(state);
    if (!check.allowed) {
      throw new Error(
        check.blockers[0] ??
          'Cannot complete Customer Intelligence until at least one approved persona and linked approved interest exist.',
      );
    }
  }

  const approvedPersonas = state.personas.filter((p) => p.approved);
  const approvedPersonaIds = new Set(approvedPersonas.map((p) => p.id));
  const approvedInterests = state.interests.filter(
    (i) => i.approved && i.linkedPersonaIds.some((id) => approvedPersonaIds.has(id)),
  );

  const nextState: CustomerIntelligenceState =
    targetStatus === 'completed'
      ? {
          ...state,
          completedAt: nowIso,
          approvedSummary: {
            personas: approvedPersonas.map((p) => ({
              ...p,
              aiHypothesisNote: null,
            })),
            interests: approvedInterests.map((i) => ({
              ...i,
              linkedPersonaIds: i.linkedPersonaIds.filter((id) => approvedPersonaIds.has(id)),
            })),
            approvedAt: nowIso,
          },
        }
      : {
          ...state,
          completedAt: null,
          approvedSummary: null,
        };

  // Track most recent AI execution metadata on the strategy module row if present
  const latestMeta =
    nextState.interestSynthesis.generatedAt && nextState.interestSynthesis.promptId
      ? nextState.interestSynthesis
      : nextState.personaSynthesis;

  return {
    status: targetStatus,
    content: nextState as unknown as Record<string, unknown>,
    promptId: latestMeta.promptId,
    promptVersion: latestMeta.promptVersion,
    model: latestMeta.model,
    generatedAt: latestMeta.generatedAt,
  };
}
