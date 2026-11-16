import type { PromptExecutionResult } from '../prompts/types.ts';
import type {
  Brand,
  BrandStrategyModule,
  ModuleStatus,
  UpsertBrandModuleInput,
} from '../types/brand.ts';
import {
  FoundationIsolationError,
  canCompleteBrandFoundation,
  checkSynthesisReadiness,
  hydrateBrandFoundationState,
  type CoreValueItem,
  type FoundationSectionKey,
  type SuggestionStatus,
} from './brandFoundationLogic.ts';

export type MessagingSectionKey =
  | 'coreValueProposition'
  | 'messagingPillars'
  | 'voiceAndTone'
  | 'audienceAngles';

export type MessagingStepKey = MessagingSectionKey | 'review';

export interface MessagingPillarItem {
  id: string;
  title: string;
  summary: string;
}

export interface AudienceAngleItem {
  id: string;
  audience: string;
  message: string;
}

export interface CoreValuePropositionSectionState {
  statement: string;
  aiSuggestedStatement: string | null;
  suggestionStatus: SuggestionStatus;
  approved: boolean;
  approvedAt: string | null;
}

export interface MessagingPillarsSectionState {
  pillars: MessagingPillarItem[];
  aiSuggestedPillars: MessagingPillarItem[];
  suggestionStatus: SuggestionStatus;
  approved: boolean;
  approvedAt: string | null;
}

export interface VoiceAndToneSectionState {
  attributes: string[];
  guardrails: string[];
  aiSuggestedAttributes: string[];
  aiSuggestedGuardrails: string[];
  suggestionStatus: SuggestionStatus;
  approved: boolean;
  approvedAt: string | null;
}

export interface AudienceAnglesSectionState {
  angles: AudienceAngleItem[];
  aiSuggestedAngles: AudienceAngleItem[];
  suggestionStatus: SuggestionStatus;
  approved: boolean;
  approvedAt: string | null;
}

export interface MessagingAiSynthesisState {
  promptId: string | null;
  promptVersion: string | null;
  sourceClassification: 'reconstructed' | 'original' | null;
  model: string | null;
  generatedAt: string | null;
  suppliedFactsUsed: string[];
  missingContextNotes: string[];
  aiSuggestionsSummary: Record<string, unknown> | null;
}

export interface ApprovedFoundationSnapshot {
  brandId: string;
  purposeStatement: string;
  missionStatement: string;
  visionStatement: string;
  coreValues: CoreValueItem[];
  positioningStatement: string;
  differentiationAttributes: string[];
  approvedAt: string | null;
}

export interface BrandMessagingState {
  schemaVersion: 1;
  brandId: string;
  foundationSnapshot: ApprovedFoundationSnapshot | null;
  coreValueProposition: CoreValuePropositionSectionState;
  messagingPillars: MessagingPillarsSectionState;
  voiceAndTone: VoiceAndToneSectionState;
  audienceAngles: AudienceAnglesSectionState;
  aiSynthesis: MessagingAiSynthesisState;
  completedAt: string | null;
  approvedSummary: {
    coreValueProposition: string;
    messagingPillars: MessagingPillarItem[];
    voiceAndTone: {
      attributes: string[];
      guardrails: string[];
    };
    audienceAngles: AudienceAngleItem[];
    approvedAt: string;
  } | null;
}

export const MESSAGING_SECTIONS: ReadonlyArray<{
  key: MessagingSectionKey;
  number: string;
  title: string;
  subtitle: string;
}> = [
  {
    key: 'coreValueProposition',
    number: '01',
    title: 'Core Value Proposition',
    subtitle: 'The primary promise of value anchored in approved Brand Foundation',
  },
  {
    key: 'messagingPillars',
    number: '02',
    title: 'Messaging Pillars',
    subtitle: 'At least two repeatable strategic themes with supporting proof narratives',
  },
  {
    key: 'voiceAndTone',
    number: '03',
    title: 'Voice & Tone',
    subtitle: 'Consistent brand voice attributes and clear communication guardrails',
  },
  {
    key: 'audienceAngles',
    number: '04',
    title: 'Audience Angles',
    subtitle: 'Tailored messaging angles mapped to priority customer segments',
  },
];

export type MessagingValidationErrors = Record<string, string>;

export class MessagingIsolationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MessagingIsolationError';
  }
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function asNullableString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean);
}

function asSuggestionStatus(value: unknown): SuggestionStatus {
  if (
    value === 'none' ||
    value === 'pending_review' ||
    value === 'approved' ||
    value === 'rejected'
  ) {
    return value;
  }
  return 'none';
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizePillars(raw: unknown, idPrefix = 'pillar'): MessagingPillarItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item): item is Record<string, unknown> => isPlainObject(item))
    .map((item, idx) => ({
      id: asString(item.id, `${idPrefix}-${idx + 1}`),
      title: asString(item.title),
      summary: asString(item.summary),
    }));
}

function normalizeAudienceAngles(raw: unknown, idPrefix = 'angle'): AudienceAngleItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item): item is Record<string, unknown> => isPlainObject(item))
    .map((item, idx) => ({
      id: asString(item.id, `${idPrefix}-${idx + 1}`),
      audience: asString(item.audience),
      message: asString(item.message),
    }));
}

export function createInitialBrandMessagingState(
  brand: Brand,
  foundationSnapshot: ApprovedFoundationSnapshot | null = null,
): BrandMessagingState {
  return {
    schemaVersion: 1,
    brandId: brand.id,
    foundationSnapshot,
    coreValueProposition: {
      statement: '',
      aiSuggestedStatement: null,
      suggestionStatus: 'none',
      approved: false,
      approvedAt: null,
    },
    messagingPillars: {
      pillars: [],
      aiSuggestedPillars: [],
      suggestionStatus: 'none',
      approved: false,
      approvedAt: null,
    },
    voiceAndTone: {
      attributes: [],
      guardrails: [],
      aiSuggestedAttributes: [],
      aiSuggestedGuardrails: [],
      suggestionStatus: 'none',
      approved: false,
      approvedAt: null,
    },
    audienceAngles: {
      angles: [],
      aiSuggestedAngles: [],
      suggestionStatus: 'none',
      approved: false,
      approvedAt: null,
    },
    aiSynthesis: {
      promptId: null,
      promptVersion: null,
      sourceClassification: null,
      model: null,
      generatedAt: null,
      suppliedFactsUsed: [],
      missingContextNotes: [],
      aiSuggestionsSummary: null,
    },
    completedAt: null,
    approvedSummary: null,
  };
}

export interface FoundationDependencyEvaluation {
  ready: boolean;
  status: ModuleStatus;
  reason: string | null;
  missingSections: FoundationSectionKey[];
  approvedFoundation: ApprovedFoundationSnapshot | null;
}

/**
 * Evaluates whether the active brand's Brand Foundation is completed, verified,
 * and safe to consume as Brand Messaging's strategic source of truth.
 * Uses only explicitly approved brand facts—never pending AI suggestions.
 */
export function evaluateFoundationDependency(
  brand: Brand,
  foundationModule: BrandStrategyModule | null | undefined,
): FoundationDependencyEvaluation {
  if (!foundationModule) {
    return {
      ready: false,
      status: 'not_started',
      reason:
        'Complete and approve Brand Foundation before generating Brand Messaging.',
      missingSections: ['purpose', 'mission', 'vision', 'coreValues', 'positioning'],
      approvedFoundation: null,
    };
  }

  if (foundationModule.brandId !== brand.id) {
    throw new MessagingIsolationError(
      `Brand context isolation error: Brand Foundation belongs to brand "${foundationModule.brandId}" rather than "${brand.id}".`,
    );
  }

  if (foundationModule.moduleKey !== 'brandFoundation') {
    throw new MessagingIsolationError(
      `Unexpected module key "${foundationModule.moduleKey}" when validating Brand Foundation dependency.`,
    );
  }

  let hydratedFoundation;
  try {
    hydratedFoundation = hydrateBrandFoundationState(brand, foundationModule);
  } catch (err) {
    if (err instanceof FoundationIsolationError) {
      throw new MessagingIsolationError(err.message);
    }
    throw err;
  }

  const completionCheck = canCompleteBrandFoundation(hydratedFoundation);
  if (foundationModule.status !== 'completed' || !completionCheck.allowed) {
    const missingText =
      completionCheck.incompleteSections.length > 0
        ? ` Unapproved or incomplete foundation sections: ${completionCheck.incompleteSections.join(', ')}.`
        : '';
    return {
      ready: false,
      status: foundationModule.status,
      reason: `Brand Foundation must be completed and all five sections approved before generating Brand Messaging.${missingText}`,
      missingSections: completionCheck.incompleteSections,
      approvedFoundation: null,
    };
  }

  // Strictly build snapshot from approved section values (never unapproved AI suggestions)
  const snapshot: ApprovedFoundationSnapshot = {
    brandId: brand.id,
    purposeStatement: hydratedFoundation.purpose.statement.trim(),
    missionStatement: hydratedFoundation.mission.statement.trim(),
    visionStatement: hydratedFoundation.vision.statement.trim(),
    coreValues: hydratedFoundation.coreValues.values.map((v) => ({
      id: v.id,
      name: v.name.trim(),
      behaviors: v.behaviors.trim(),
      whyItMatters: v.whyItMatters.trim(),
    })),
    positioningStatement: hydratedFoundation.positioning.statement.trim(),
    differentiationAttributes: [
      ...hydratedFoundation.positioning.differentiationAttributes,
    ],
    approvedAt: hydratedFoundation.completedAt ?? foundationModule.updatedAt,
  };

  return {
    ready: true,
    status: 'completed',
    reason: null,
    missingSections: [],
    approvedFoundation: snapshot,
  };
}

export interface MessagingGenerationReadiness {
  ready: boolean;
  foundationReady: boolean;
  profileReady: boolean;
  missingProfileFields: string[];
  missingFoundationSections: FoundationSectionKey[];
  foundationStatus: ModuleStatus;
  reason: string | null;
  approvedFoundation: ApprovedFoundationSnapshot | null;
}

export function checkMessagingGenerationReadiness(
  brand: Brand,
  foundationModule: BrandStrategyModule | null | undefined,
): MessagingGenerationReadiness {
  const foundationCheck = evaluateFoundationDependency(brand, foundationModule);
  const profileCheck = checkSynthesisReadiness(brand);

  if (!foundationCheck.ready) {
    return {
      ready: false,
      foundationReady: false,
      profileReady: profileCheck.ready,
      missingProfileFields: profileCheck.missingFields,
      missingFoundationSections: foundationCheck.missingSections,
      foundationStatus: foundationCheck.status,
      reason: foundationCheck.reason,
      approvedFoundation: null,
    };
  }

  if (!profileCheck.ready) {
    return {
      ready: false,
      foundationReady: true,
      profileReady: false,
      missingProfileFields: profileCheck.missingFields,
      missingFoundationSections: [],
      foundationStatus: foundationCheck.status,
      reason: `Required brand profile fields are missing before calling Gemini: ${profileCheck.missingFields.join(', ')}.`,
      approvedFoundation: foundationCheck.approvedFoundation,
    };
  }

  return {
    ready: true,
    foundationReady: true,
    profileReady: true,
    missingProfileFields: [],
    missingFoundationSections: [],
    foundationStatus: foundationCheck.status,
    reason: null,
    approvedFoundation: foundationCheck.approvedFoundation,
  };
}

export function buildMessagingPromptVariables(
  brand: Brand,
  approvedFoundation: ApprovedFoundationSnapshot,
  _state?: BrandMessagingState,
): Record<string, string> {
  if (approvedFoundation.brandId !== brand.id) {
    throw new MessagingIsolationError(
      `Cannot build messaging prompt variables from foundation belonging to brand "${approvedFoundation.brandId}".`,
    );
  }

  // Pass strictly approved foundation facts (not pending AI suggestions)
  const sanitizedApprovedFoundation = {
    brandId: approvedFoundation.brandId,
    approvedAt: approvedFoundation.approvedAt,
    purposeStatement: approvedFoundation.purposeStatement,
    missionStatement: approvedFoundation.missionStatement,
    visionStatement: approvedFoundation.visionStatement,
    coreValues: approvedFoundation.coreValues.map((v) => ({
      name: v.name,
      behaviors: v.behaviors,
      whyItMatters: v.whyItMatters,
    })),
    positioningStatement: approvedFoundation.positioningStatement,
    differentiationAttributes: approvedFoundation.differentiationAttributes,
  };

  return {
    approvedBrandFoundation: JSON.stringify(sanitizedApprovedFoundation),
  };
}

export function hydrateBrandMessagingState(
  brand: Brand,
  moduleRecord: BrandStrategyModule | null | undefined,
  approvedFoundation: ApprovedFoundationSnapshot | null = null,
): BrandMessagingState {
  const initial = createInitialBrandMessagingState(brand, approvedFoundation);
  if (!moduleRecord) {
    return initial;
  }

  if (moduleRecord.brandId !== brand.id) {
    throw new MessagingIsolationError(
      `Brand context isolation error: loaded messaging module belongs to brand "${moduleRecord.brandId}" rather than "${brand.id}".`,
    );
  }

  if (moduleRecord.moduleKey !== 'brandMessaging') {
    throw new MessagingIsolationError(
      `Unexpected module key "${moduleRecord.moduleKey}" when hydrating Brand Messaging.`,
    );
  }

  const content = moduleRecord.content ?? {};
  if (typeof content.brandId === 'string' && content.brandId && content.brandId !== brand.id) {
    throw new MessagingIsolationError(
      `Persisted messaging content belongs to brand "${content.brandId}" rather than "${brand.id}".`,
    );
  }

  const rawCore = isPlainObject(content.coreValueProposition)
    ? content.coreValueProposition
    : {};
  const rawPillars = isPlainObject(content.messagingPillars) ? content.messagingPillars : {};
  const rawVoice = isPlainObject(content.voiceAndTone) ? content.voiceAndTone : {};
  const rawAngles = isPlainObject(content.audienceAngles) ? content.audienceAngles : {};
  const rawAi = isPlainObject(content.aiSynthesis) ? content.aiSynthesis : {};

  let resolvedSnapshot = approvedFoundation;
  if (!resolvedSnapshot && isPlainObject(content.foundationSnapshot)) {
    const snap = content.foundationSnapshot;
    const snapBrandId = asString(snap.brandId);
    if (snapBrandId && snapBrandId !== brand.id) {
      throw new MessagingIsolationError(
        `Persisted foundation snapshot belongs to brand "${snapBrandId}" rather than "${brand.id}".`,
      );
    }
    resolvedSnapshot = {
      brandId: brand.id,
      purposeStatement: asString(snap.purposeStatement),
      missionStatement: asString(snap.missionStatement),
      visionStatement: asString(snap.visionStatement),
      coreValues: Array.isArray(snap.coreValues)
        ? snap.coreValues
            .filter((item): item is Record<string, unknown> => isPlainObject(item))
            .map((v, idx) => ({
              id: asString(v.id, `val-${idx + 1}`),
              name: asString(v.name),
              behaviors: asString(v.behaviors),
              whyItMatters: asString(v.whyItMatters),
            }))
        : [],
      positioningStatement: asString(snap.positioningStatement),
      differentiationAttributes: asStringArray(snap.differentiationAttributes),
      approvedAt: asNullableString(snap.approvedAt),
    };
  }

  return {
    schemaVersion: 1,
    brandId: brand.id,
    foundationSnapshot: resolvedSnapshot,
    coreValueProposition: {
      statement: asString(rawCore.statement, initial.coreValueProposition.statement),
      aiSuggestedStatement: asNullableString(rawCore.aiSuggestedStatement),
      suggestionStatus: asSuggestionStatus(rawCore.suggestionStatus),
      approved: rawCore.approved === true,
      approvedAt: asNullableString(rawCore.approvedAt),
    },
    messagingPillars: {
      pillars: normalizePillars(rawPillars.pillars, 'pillar'),
      aiSuggestedPillars: normalizePillars(rawPillars.aiSuggestedPillars, 'ai-pillar'),
      suggestionStatus: asSuggestionStatus(rawPillars.suggestionStatus),
      approved: rawPillars.approved === true,
      approvedAt: asNullableString(rawPillars.approvedAt),
    },
    voiceAndTone: {
      attributes: asStringArray(rawVoice.attributes),
      guardrails: asStringArray(rawVoice.guardrails),
      aiSuggestedAttributes: asStringArray(rawVoice.aiSuggestedAttributes),
      aiSuggestedGuardrails: asStringArray(rawVoice.aiSuggestedGuardrails),
      suggestionStatus: asSuggestionStatus(rawVoice.suggestionStatus),
      approved: rawVoice.approved === true,
      approvedAt: asNullableString(rawVoice.approvedAt),
    },
    audienceAngles: {
      angles: normalizeAudienceAngles(rawAngles.angles, 'angle'),
      aiSuggestedAngles: normalizeAudienceAngles(rawAngles.aiSuggestedAngles, 'ai-angle'),
      suggestionStatus: asSuggestionStatus(rawAngles.suggestionStatus),
      approved: rawAngles.approved === true,
      approvedAt: asNullableString(rawAngles.approvedAt),
    },
    aiSynthesis: {
      promptId: asNullableString(rawAi.promptId) ?? moduleRecord.promptId ?? null,
      promptVersion: asNullableString(rawAi.promptVersion) ?? moduleRecord.promptVersion ?? null,
      sourceClassification:
        rawAi.sourceClassification === 'reconstructed' || rawAi.sourceClassification === 'original'
          ? rawAi.sourceClassification
          : null,
      model: asNullableString(rawAi.model) ?? moduleRecord.model ?? null,
      generatedAt: asNullableString(rawAi.generatedAt) ?? moduleRecord.generatedAt ?? null,
      suppliedFactsUsed: asStringArray(rawAi.suppliedFactsUsed),
      missingContextNotes: asStringArray(rawAi.missingContextNotes),
      aiSuggestionsSummary: isPlainObject(rawAi.aiSuggestionsSummary)
        ? rawAi.aiSuggestionsSummary
        : null,
    },
    completedAt: asNullableString(content.completedAt),
    approvedSummary: isPlainObject(content.approvedSummary)
      ? (content.approvedSummary as BrandMessagingState['approvedSummary'])
      : null,
  };
}

export interface ValidatedMessagingAiPayload {
  coreValueProposition: string;
  messagingPillars: MessagingPillarItem[];
  voiceAndTone: {
    attributes: string[];
    guardrails: string[];
  };
  audienceAngles: AudienceAngleItem[];
  suppliedFactsUsed: string[];
  missingContextNotes: string[];
  aiSuggestionsSummary: Record<string, unknown>;
}

/**
 * Deeply validates structured output returned by `brand_messaging_framework`
 * beyond top-level schema types before exposing suggestions or saving metadata.
 */
export function validateMessagingFrameworkOutput(output: Record<string, unknown>): {
  valid: boolean;
  data?: ValidatedMessagingAiPayload;
  errors: string[];
  safeError?: string;
} {
  const errors: string[] = [];

  const coreValueProposition = asString(output.coreValueProposition).trim();
  if (!coreValueProposition) {
    errors.push('AI output is missing a non-empty coreValueProposition statement.');
  }

  const rawPillars = Array.isArray(output.messagingPillars) ? output.messagingPillars : [];
  const validPillars: MessagingPillarItem[] = rawPillars
    .filter((item): item is Record<string, unknown> => isPlainObject(item))
    .map((item, idx) => ({
      id: `ai-pillar-${idx + 1}`,
      title: asString(item.title).trim(),
      summary: asString(item.summary).trim(),
    }))
    .filter((p) => Boolean(p.title && p.summary));

  if (validPillars.length < 2) {
    errors.push(
      'AI output must include at least 2 complete messagingPillars with title and summary.',
    );
  }

  const rawVoice = isPlainObject(output.voiceAndTone) ? output.voiceAndTone : null;
  const attributes = rawVoice ? asStringArray(rawVoice.attributes) : [];
  const guardrails = rawVoice ? asStringArray(rawVoice.guardrails) : [];
  if (!rawVoice || attributes.length === 0 || guardrails.length === 0) {
    errors.push(
      'AI output voiceAndTone must include at least one attribute and one guardrail.',
    );
  }

  const rawAngles = Array.isArray(output.audienceAngles) ? output.audienceAngles : [];
  const validAngles: AudienceAngleItem[] = rawAngles
    .filter((item): item is Record<string, unknown> => isPlainObject(item))
    .map((item, idx) => ({
      id: `ai-angle-${idx + 1}`,
      audience: asString(item.audience).trim(),
      message: asString(item.message).trim(),
    }))
    .filter((a) => Boolean(a.audience && a.message));

  if (validAngles.length < 1) {
    errors.push(
      'AI output must include at least 1 complete audienceAngle with audience and message.',
    );
  }

  const suppliedFactsUsed = asStringArray(output.suppliedFactsUsed);
  if (suppliedFactsUsed.length === 0) {
    errors.push('AI output must list suppliedFactsUsed grounded in verified brand context.');
  }

  const aiSuggestionsSummary = isPlainObject(output.aiSuggestions) ? output.aiSuggestions : null;
  if (!aiSuggestionsSummary) {
    errors.push('AI output must include an aiSuggestions object.');
  }

  if (errors.length > 0 || !aiSuggestionsSummary) {
    return {
      valid: false,
      errors,
      safeError: errors[0] ?? 'Generated messaging output failed schema validation.',
    };
  }

  return {
    valid: true,
    errors: [],
    data: {
      coreValueProposition,
      messagingPillars: validPillars,
      voiceAndTone: { attributes, guardrails },
      audienceAngles: validAngles,
      suppliedFactsUsed,
      missingContextNotes: asStringArray(output.missingContextNotes),
      aiSuggestionsSummary,
    },
  };
}

export function hasAnyApprovedMessagingSection(state: BrandMessagingState): boolean {
  return (
    state.coreValueProposition.approved ||
    state.messagingPillars.approved ||
    state.voiceAndTone.approved ||
    state.audienceAngles.approved
  );
}

/**
 * Applies validated `brand_messaging_framework` suggestions into Brand Messaging state.
 * Safeguards:
 * - Rejects invalid/non-success output without changing state.
 * - Never overwrites user-approved messaging unless `overwriteApproved` is explicitly true.
 * - Even when `overwriteApproved` is true, only resets targeted sections (`targetSections`)
 *   and still holds AI output inside `aiSuggested*` rather than overwriting user-written content directly.
 */
export function applyAiMessagingResult(
  current: BrandMessagingState,
  executionResult: PromptExecutionResult,
  options?: {
    overwriteApproved?: boolean;
    targetSections?: MessagingSectionKey[];
  },
): {
  state: BrandMessagingState;
  applied: boolean;
  error?: string;
} {
  if (executionResult.status !== 'success') {
    return {
      state: current,
      applied: false,
      error:
        executionResult.status === 'validation_error'
          ? executionResult.error
          : executionResult.message,
    };
  }

  if (executionResult.brandId !== current.brandId) {
    throw new MessagingIsolationError(
      `AI execution result belongs to brand "${executionResult.brandId}" rather than "${current.brandId}".`,
    );
  }

  const validation = validateMessagingFrameworkOutput(executionResult.output);
  if (!validation.valid || !validation.data) {
    return {
      state: current,
      applied: false,
      error: validation.safeError ?? 'Generated messaging output failed validation.',
    };
  }

  const data = validation.data;
  const overwriteApproved = options?.overwriteApproved === true;
  const targetSet = options?.targetSections ? new Set(options.targetSections) : null;

  const canUpdateSection = (section: MessagingSectionKey, approved: boolean): boolean => {
    if (targetSet && !targetSet.has(section)) {
      return false;
    }
    return !approved || overwriteApproved;
  };

  const updateCore = canUpdateSection(
    'coreValueProposition',
    current.coreValueProposition.approved,
  );
  const updatePillars = canUpdateSection('messagingPillars', current.messagingPillars.approved);
  const updateVoice = canUpdateSection('voiceAndTone', current.voiceAndTone.approved);
  const updateAngles = canUpdateSection('audienceAngles', current.audienceAngles.approved);

  const resetAnyApproved =
    overwriteApproved &&
    ((updateCore && current.coreValueProposition.approved) ||
      (updatePillars && current.messagingPillars.approved) ||
      (updateVoice && current.voiceAndTone.approved) ||
      (updateAngles && current.audienceAngles.approved));

  const nextState: BrandMessagingState = {
    ...current,
    completedAt: resetAnyApproved ? null : current.completedAt,
    approvedSummary: resetAnyApproved ? null : current.approvedSummary,
    coreValueProposition: updateCore
      ? {
          ...current.coreValueProposition,
          aiSuggestedStatement: data.coreValueProposition,
          suggestionStatus: 'pending_review',
          ...(overwriteApproved && current.coreValueProposition.approved
            ? { approved: false, approvedAt: null }
            : {}),
        }
      : current.coreValueProposition,
    messagingPillars: updatePillars
      ? {
          ...current.messagingPillars,
          aiSuggestedPillars: data.messagingPillars,
          suggestionStatus: 'pending_review',
          ...(overwriteApproved && current.messagingPillars.approved
            ? { approved: false, approvedAt: null }
            : {}),
        }
      : current.messagingPillars,
    voiceAndTone: updateVoice
      ? {
          ...current.voiceAndTone,
          aiSuggestedAttributes: data.voiceAndTone.attributes,
          aiSuggestedGuardrails: data.voiceAndTone.guardrails,
          suggestionStatus: 'pending_review',
          ...(overwriteApproved && current.voiceAndTone.approved
            ? { approved: false, approvedAt: null }
            : {}),
        }
      : current.voiceAndTone,
    audienceAngles: updateAngles
      ? {
          ...current.audienceAngles,
          aiSuggestedAngles: data.audienceAngles,
          suggestionStatus: 'pending_review',
          ...(overwriteApproved && current.audienceAngles.approved
            ? { approved: false, approvedAt: null }
            : {}),
        }
      : current.audienceAngles,
    aiSynthesis: {
      promptId: executionResult.metadata.promptId,
      promptVersion: executionResult.metadata.promptVersion,
      sourceClassification: executionResult.metadata.sourceClassification,
      model: executionResult.metadata.model,
      generatedAt: executionResult.metadata.generatedAt,
      suppliedFactsUsed: data.suppliedFactsUsed,
      missingContextNotes: data.missingContextNotes,
      aiSuggestionsSummary: data.aiSuggestionsSummary,
    },
  };

  return {
    state: nextState,
    applied: true,
  };
}

export function validateMessagingSection(
  section: MessagingSectionKey,
  state: BrandMessagingState,
): MessagingValidationErrors {
  const errors: MessagingValidationErrors = {};

  if (section === 'coreValueProposition') {
    if (!state.coreValueProposition.statement.trim()) {
      errors.statement =
        'Review, edit, or adopt a core value proposition statement before approving.';
    }
    return errors;
  }

  if (section === 'messagingPillars') {
    if (state.messagingPillars.pillars.length < 2) {
      errors.pillars = 'Add at least two strategic messaging pillars before approving.';
      return errors;
    }
    const incompleteIdx = state.messagingPillars.pillars.findIndex(
      (item) => !item.title.trim() || !item.summary.trim(),
    );
    if (incompleteIdx >= 0) {
      errors.pillars = `Complete both title and summary for Messaging Pillar #${incompleteIdx + 1}.`;
    }
    return errors;
  }

  if (section === 'voiceAndTone') {
    const validAttrs = state.voiceAndTone.attributes.filter((item) => item.trim().length > 0);
    const validGuardrails = state.voiceAndTone.guardrails.filter((item) => item.trim().length > 0);
    if (validAttrs.length === 0) {
      errors.attributes = 'Add at least one brand voice attribute.';
    }
    if (validGuardrails.length === 0) {
      errors.guardrails = 'Add at least one tone guardrail.';
    }
    return errors;
  }

  // audienceAngles
  if (state.audienceAngles.angles.length < 1) {
    errors.angles = 'Add at least one audience-specific messaging angle before approving.';
    return errors;
  }
  const incompleteAngleIdx = state.audienceAngles.angles.findIndex(
    (item) => !item.audience.trim() || !item.message.trim(),
  );
  if (incompleteAngleIdx >= 0) {
    errors.angles = `Complete both target audience and message for Audience Angle #${incompleteAngleIdx + 1}.`;
  }
  return errors;
}

export interface MessagingProgressSummary {
  approvedCount: number;
  totalSections: number;
  percentage: number;
  allSectionsApproved: boolean;
  sectionStatuses: Record<MessagingSectionKey, 'approved' | 'in_progress' | 'not_started'>;
}

function computeSingleStatus(
  approved: boolean,
  hasDraft: boolean,
): 'approved' | 'in_progress' | 'not_started' {
  if (approved) return 'approved';
  return hasDraft ? 'in_progress' : 'not_started';
}

export function computeMessagingProgress(state: BrandMessagingState): MessagingProgressSummary {
  const sectionStatuses: Record<MessagingSectionKey, 'approved' | 'in_progress' | 'not_started'> = {
    coreValueProposition: computeSingleStatus(
      state.coreValueProposition.approved,
      Boolean(
        state.coreValueProposition.statement.trim() ||
          state.coreValueProposition.aiSuggestedStatement,
      ),
    ),
    messagingPillars: computeSingleStatus(
      state.messagingPillars.approved,
      state.messagingPillars.pillars.length > 0 ||
        state.messagingPillars.aiSuggestedPillars.length > 0,
    ),
    voiceAndTone: computeSingleStatus(
      state.voiceAndTone.approved,
      state.voiceAndTone.attributes.length > 0 ||
        state.voiceAndTone.guardrails.length > 0 ||
        state.voiceAndTone.aiSuggestedAttributes.length > 0 ||
        state.voiceAndTone.aiSuggestedGuardrails.length > 0,
    ),
    audienceAngles: computeSingleStatus(
      state.audienceAngles.approved,
      state.audienceAngles.angles.length > 0 ||
        state.audienceAngles.aiSuggestedAngles.length > 0,
    ),
  };

  const approvedCount = Object.values(sectionStatuses).filter((s) => s === 'approved').length;
  const totalSections = MESSAGING_SECTIONS.length;

  return {
    approvedCount,
    totalSections,
    percentage: Math.round((approvedCount / totalSections) * 100),
    allSectionsApproved: approvedCount === totalSections,
    sectionStatuses,
  };
}

export function canCompleteBrandMessaging(state: BrandMessagingState): {
  allowed: boolean;
  incompleteSections: MessagingSectionKey[];
  validationIssues: Partial<Record<MessagingSectionKey, MessagingValidationErrors>>;
} {
  const incompleteSections: MessagingSectionKey[] = [];
  const validationIssues: Partial<Record<MessagingSectionKey, MessagingValidationErrors>> = {};

  for (const section of MESSAGING_SECTIONS) {
    const isApproved = state[section.key].approved;
    const errors = validateMessagingSection(section.key, state);
    if (!isApproved || Object.keys(errors).length > 0) {
      incompleteSections.push(section.key);
      if (Object.keys(errors).length > 0) {
        validationIssues[section.key] = errors;
      }
    }
  }

  return {
    allowed: incompleteSections.length === 0,
    incompleteSections,
    validationIssues,
  };
}

export function buildMessagingUpsertPayload(
  state: BrandMessagingState,
  targetStatus: ModuleStatus,
  nowIso = new Date().toISOString(),
): UpsertBrandModuleInput {
  if (targetStatus === 'completed') {
    const check = canCompleteBrandMessaging(state);
    if (!check.allowed) {
      throw new Error(
        `Cannot complete Brand Messaging until all required components are reviewed and approved (${check.incompleteSections.join(', ')}).`,
      );
    }
  }

  const nextState: BrandMessagingState =
    targetStatus === 'completed'
      ? {
          ...state,
          completedAt: nowIso,
          approvedSummary: {
            coreValueProposition: state.coreValueProposition.statement.trim(),
            messagingPillars: state.messagingPillars.pillars.map((p) => ({
              id: p.id,
              title: p.title.trim(),
              summary: p.summary.trim(),
            })),
            voiceAndTone: {
              attributes: state.voiceAndTone.attributes
                .map((item) => item.trim())
                .filter(Boolean),
              guardrails: state.voiceAndTone.guardrails
                .map((item) => item.trim())
                .filter(Boolean),
            },
            audienceAngles: state.audienceAngles.angles.map((a) => ({
              id: a.id,
              audience: a.audience.trim(),
              message: a.message.trim(),
            })),
            approvedAt: nowIso,
          },
        }
      : {
          ...state,
          completedAt: null,
          approvedSummary: null,
        };

  return {
    status: targetStatus,
    content: nextState as unknown as Record<string, unknown>,
    promptId: nextState.aiSynthesis.promptId,
    promptVersion: nextState.aiSynthesis.promptVersion,
    model: nextState.aiSynthesis.model,
    generatedAt: nextState.aiSynthesis.generatedAt,
  };
}
