import type { PromptExecutionResult } from '../prompts/types.ts';
import type {
  Brand,
  BrandStrategyModule,
  ModuleStatus,
  UpsertBrandModuleInput,
} from '../types/brand.ts';

export type FoundationSectionKey =
  | 'purpose'
  | 'mission'
  | 'vision'
  | 'coreValues'
  | 'positioning';

export type FoundationStepKey = FoundationSectionKey | 'review';

export type SuggestionStatus = 'none' | 'pending_review' | 'approved' | 'rejected';

export interface PurposeSectionState {
  problemAddressed: string;
  peopleServed: string;
  positiveChange: string;
  statement: string;
  aiSuggestedStatement: string | null;
  suggestionStatus: SuggestionStatus;
  approved: boolean;
  approvedAt: string | null;
}

export interface MissionSectionState {
  whatBusinessDoes: string;
  whoItServes: string;
  howItServes: string;
  valueDelivered: string;
  statement: string;
  aiSuggestedStatement: string | null;
  suggestionStatus: SuggestionStatus;
  approved: boolean;
  approvedAt: string | null;
}

export interface VisionSectionState {
  futureCreated: string;
  longTermAmbition: string;
  impactAchieved: string;
  statement: string;
  aiSuggestedStatement: string | null;
  suggestionStatus: SuggestionStatus;
  approved: boolean;
  approvedAt: string | null;
}

export interface CoreValueItem {
  id: string;
  name: string;
  behaviors: string;
  whyItMatters: string;
}

export interface CoreValuesSectionState {
  values: CoreValueItem[];
  approved: boolean;
  approvedAt: string | null;
}

export interface PositioningSectionState {
  targetMarket: string;
  primaryCustomer: string;
  customerProblem: string;
  brandSolution: string;
  differentiatingAdvantage: string;
  competitiveDistinction: string;
  mainValueDelivered: string;
  differentiationAttributes: string[];
  aiSuggestedAttributes: string[];
  statement: string;
  aiSuggestedStatement: string | null;
  suggestionStatus: SuggestionStatus;
  approved: boolean;
  approvedAt: string | null;
}

export interface FoundationAiSynthesisState {
  promptId: string | null;
  promptVersion: string | null;
  sourceClassification: 'reconstructed' | 'original' | null;
  model: string | null;
  generatedAt: string | null;
  suppliedFactsUsed: string[];
  missingContextNotes: string[];
  aiSuggestionsSummary: Record<string, unknown> | null;
}

export interface BrandFoundationState {
  schemaVersion: 1;
  brandId: string;
  userSourceFacts: Record<string, string>;
  purpose: PurposeSectionState;
  mission: MissionSectionState;
  vision: VisionSectionState;
  coreValues: CoreValuesSectionState;
  positioning: PositioningSectionState;
  aiSynthesis: FoundationAiSynthesisState;
  completedAt: string | null;
  approvedSummary: {
    purposeStatement: string;
    missionStatement: string;
    visionStatement: string;
    coreValues: CoreValueItem[];
    positioningStatement: string;
    differentiationAttributes: string[];
    approvedAt: string;
  } | null;
}

export const FOUNDATION_SECTIONS: ReadonlyArray<{
  key: FoundationSectionKey;
  number: string;
  title: string;
  subtitle: string;
}> = [
  {
    key: 'purpose',
    number: '01',
    title: 'Brand Purpose',
    subtitle: 'Why the brand exists beyond making money',
  },
  {
    key: 'mission',
    number: '02',
    title: 'Mission Statement',
    subtitle: 'What you do, who you serve, and the value delivered',
  },
  {
    key: 'vision',
    number: '03',
    title: 'Vision Statement',
    subtitle: 'The long-term future and impact the brand seeks',
  },
  {
    key: 'coreValues',
    number: '04',
    title: 'Core Values',
    subtitle: 'Non-negotiable principles and everyday behaviors',
  },
  {
    key: 'positioning',
    number: '05',
    title: 'Brand Positioning',
    subtitle: 'Clear differentiation and competitive stance',
  },
];

export type SectionValidationErrors = Record<string, string>;

export class FoundationIsolationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FoundationIsolationError';
  }
}

export function extractVerifiedSourceFacts(brand: Brand): Record<string, string> {
  const candidateFields: Array<[string, string | undefined]> = [
    ['brandName', brand.brandName],
    ['businessDescription', brand.businessDescription],
    ['industry', brand.industry],
    ['productsOrServices', brand.productsOrServices],
    ['targetMarket', brand.targetMarket],
    ['primaryLocation', brand.primaryLocation],
    ['websiteUrl', brand.websiteUrl],
    ['existingMission', brand.existingMission],
    ['existingVision', brand.existingVision],
    ['marketingChallenges', brand.marketingChallenges],
    ['businessGoals', brand.businessGoals],
    ['competitors', brand.competitors],
  ];

  const facts: Record<string, string> = {};
  for (const [key, value] of candidateFields) {
    const trimmed = typeof value === 'string' ? value.trim() : '';
    if (trimmed) {
      facts[key] = trimmed;
    }
  }
  return facts;
}

export function createInitialBrandFoundationState(brand: Brand): BrandFoundationState {
  const userSourceFacts = extractVerifiedSourceFacts(brand);

  return {
    schemaVersion: 1,
    brandId: brand.id,
    userSourceFacts,
    purpose: {
      problemAddressed: brand.marketingChallenges?.trim() ?? '',
      peopleServed: brand.targetMarket?.trim() ?? '',
      positiveChange: brand.businessGoals?.trim() ?? '',
      statement: '',
      aiSuggestedStatement: null,
      suggestionStatus: 'none',
      approved: false,
      approvedAt: null,
    },
    mission: {
      whatBusinessDoes: brand.businessDescription?.trim() ?? '',
      whoItServes: brand.targetMarket?.trim() ?? '',
      howItServes: brand.productsOrServices?.trim() ?? '',
      valueDelivered: '',
      statement: brand.existingMission?.trim() ?? '',
      aiSuggestedStatement: null,
      suggestionStatus: 'none',
      approved: false,
      approvedAt: null,
    },
    vision: {
      futureCreated: '',
      longTermAmbition: brand.businessGoals?.trim() ?? '',
      impactAchieved: '',
      statement: brand.existingVision?.trim() ?? '',
      aiSuggestedStatement: null,
      suggestionStatus: 'none',
      approved: false,
      approvedAt: null,
    },
    coreValues: {
      values: [],
      approved: false,
      approvedAt: null,
    },
    positioning: {
      targetMarket: brand.targetMarket?.trim() ?? '',
      primaryCustomer: '',
      customerProblem: brand.marketingChallenges?.trim() ?? '',
      brandSolution: brand.productsOrServices?.trim() ?? '',
      differentiatingAdvantage: '',
      competitiveDistinction: brand.competitors?.trim() ?? '',
      mainValueDelivered: '',
      differentiationAttributes: [],
      aiSuggestedAttributes: [],
      statement: '',
      aiSuggestedStatement: null,
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

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function asNullableString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string');
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

function normalizeCoreValueItems(raw: unknown): CoreValueItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
    .map((item, index) => ({
      id: asString(item.id, `value-${index + 1}`),
      name: asString(item.name),
      behaviors: asString(item.behaviors),
      whyItMatters: asString(item.whyItMatters),
    }));
}

export function hydrateBrandFoundationState(
  brand: Brand,
  moduleRecord: BrandStrategyModule | null | undefined,
): BrandFoundationState {
  const initial = createInitialBrandFoundationState(brand);
  if (!moduleRecord) {
    return initial;
  }

  if (moduleRecord.brandId !== brand.id) {
    throw new FoundationIsolationError(
      `Brand context isolation error: loaded strategy module belongs to brand "${moduleRecord.brandId}" rather than "${brand.id}".`,
    );
  }

  if (moduleRecord.moduleKey !== 'brandFoundation') {
    throw new FoundationIsolationError(
      `Unexpected module key "${moduleRecord.moduleKey}" when hydrating Brand Foundation.`,
    );
  }

  const content = moduleRecord.content ?? {};
  if (typeof content.brandId === 'string' && content.brandId && content.brandId !== brand.id) {
    throw new FoundationIsolationError(
      `Persisted foundation content belongs to brand "${content.brandId}" rather than "${brand.id}".`,
    );
  }

  const rawPurpose = (content.purpose ?? {}) as Record<string, unknown>;
  const rawMission = (content.mission ?? {}) as Record<string, unknown>;
  const rawVision = (content.vision ?? {}) as Record<string, unknown>;
  const rawCoreValues = (content.coreValues ?? {}) as Record<string, unknown>;
  const rawPositioning = (content.positioning ?? {}) as Record<string, unknown>;
  const rawAi = (content.aiSynthesis ?? {}) as Record<string, unknown>;

  return {
    schemaVersion: 1,
    brandId: brand.id,
    userSourceFacts:
      typeof content.userSourceFacts === 'object' &&
      content.userSourceFacts !== null &&
      !Array.isArray(content.userSourceFacts)
        ? { ...initial.userSourceFacts, ...(content.userSourceFacts as Record<string, string>) }
        : initial.userSourceFacts,
    purpose: {
      problemAddressed: asString(rawPurpose.problemAddressed, initial.purpose.problemAddressed),
      peopleServed: asString(rawPurpose.peopleServed, initial.purpose.peopleServed),
      positiveChange: asString(rawPurpose.positiveChange, initial.purpose.positiveChange),
      statement: asString(rawPurpose.statement, initial.purpose.statement),
      aiSuggestedStatement: asNullableString(rawPurpose.aiSuggestedStatement),
      suggestionStatus: asSuggestionStatus(rawPurpose.suggestionStatus),
      approved: rawPurpose.approved === true,
      approvedAt: asNullableString(rawPurpose.approvedAt),
    },
    mission: {
      whatBusinessDoes: asString(rawMission.whatBusinessDoes, initial.mission.whatBusinessDoes),
      whoItServes: asString(rawMission.whoItServes, initial.mission.whoItServes),
      howItServes: asString(rawMission.howItServes, initial.mission.howItServes),
      valueDelivered: asString(rawMission.valueDelivered, initial.mission.valueDelivered),
      statement: asString(rawMission.statement, initial.mission.statement),
      aiSuggestedStatement: asNullableString(rawMission.aiSuggestedStatement),
      suggestionStatus: asSuggestionStatus(rawMission.suggestionStatus),
      approved: rawMission.approved === true,
      approvedAt: asNullableString(rawMission.approvedAt),
    },
    vision: {
      futureCreated: asString(rawVision.futureCreated, initial.vision.futureCreated),
      longTermAmbition: asString(rawVision.longTermAmbition, initial.vision.longTermAmbition),
      impactAchieved: asString(rawVision.impactAchieved, initial.vision.impactAchieved),
      statement: asString(rawVision.statement, initial.vision.statement),
      aiSuggestedStatement: asNullableString(rawVision.aiSuggestedStatement),
      suggestionStatus: asSuggestionStatus(rawVision.suggestionStatus),
      approved: rawVision.approved === true,
      approvedAt: asNullableString(rawVision.approvedAt),
    },
    coreValues: {
      values: normalizeCoreValueItems(rawCoreValues.values),
      approved: rawCoreValues.approved === true,
      approvedAt: asNullableString(rawCoreValues.approvedAt),
    },
    positioning: {
      targetMarket: asString(rawPositioning.targetMarket, initial.positioning.targetMarket),
      primaryCustomer: asString(rawPositioning.primaryCustomer, initial.positioning.primaryCustomer),
      customerProblem: asString(rawPositioning.customerProblem, initial.positioning.customerProblem),
      brandSolution: asString(rawPositioning.brandSolution, initial.positioning.brandSolution),
      differentiatingAdvantage: asString(
        rawPositioning.differentiatingAdvantage,
        initial.positioning.differentiatingAdvantage,
      ),
      competitiveDistinction: asString(
        rawPositioning.competitiveDistinction,
        initial.positioning.competitiveDistinction,
      ),
      mainValueDelivered: asString(
        rawPositioning.mainValueDelivered,
        initial.positioning.mainValueDelivered,
      ),
      differentiationAttributes: asStringArray(rawPositioning.differentiationAttributes),
      aiSuggestedAttributes: asStringArray(rawPositioning.aiSuggestedAttributes),
      statement: asString(rawPositioning.statement, initial.positioning.statement),
      aiSuggestedStatement: asNullableString(rawPositioning.aiSuggestedStatement),
      suggestionStatus: asSuggestionStatus(rawPositioning.suggestionStatus),
      approved: rawPositioning.approved === true,
      approvedAt: asNullableString(rawPositioning.approvedAt),
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
      aiSuggestionsSummary:
        typeof rawAi.aiSuggestionsSummary === 'object' &&
        rawAi.aiSuggestionsSummary !== null &&
        !Array.isArray(rawAi.aiSuggestionsSummary)
          ? (rawAi.aiSuggestionsSummary as Record<string, unknown>)
          : null,
    },
    completedAt: asNullableString(content.completedAt),
    approvedSummary:
      typeof content.approvedSummary === 'object' &&
      content.approvedSummary !== null &&
      !Array.isArray(content.approvedSummary)
        ? (content.approvedSummary as BrandFoundationState['approvedSummary'])
        : null,
  };
}

export function checkSynthesisReadiness(brand: Brand): {
  ready: boolean;
  missingFields: string[];
} {
  const requiredFields: Array<[string, string | undefined]> = [
    ['brandName', brand.brandName],
    ['businessDescription', brand.businessDescription],
    ['industry', brand.industry],
    ['productsOrServices', brand.productsOrServices],
    ['targetMarket', brand.targetMarket],
    ['primaryLocation', brand.primaryLocation],
  ];

  const missingFields = requiredFields
    .filter(([, val]) => typeof val !== 'string' || !val.trim())
    .map(([key]) => key);

  return {
    ready: missingFields.length === 0,
    missingFields,
  };
}

export function buildFoundationPromptVariables(
  state: BrandFoundationState,
): Record<string, string> {
  const notes: string[] = [];
  if (state.purpose.problemAddressed.trim()) {
    notes.push(`Problem addressed: ${state.purpose.problemAddressed.trim()}`);
  }
  if (state.purpose.positiveChange.trim()) {
    notes.push(`Positive change sought: ${state.purpose.positiveChange.trim()}`);
  }
  if (state.mission.valueDelivered.trim()) {
    notes.push(`Mission value delivered: ${state.mission.valueDelivered.trim()}`);
  }
  if (state.vision.futureCreated.trim()) {
    notes.push(`Future envisioned: ${state.vision.futureCreated.trim()}`);
  }
  if (state.positioning.differentiatingAdvantage.trim()) {
    notes.push(`Differentiating advantage: ${state.positioning.differentiatingAdvantage.trim()}`);
  }

  return {
    ...(notes.length > 0 ? { additionalNotes: notes.join(' | ') } : {}),
  };
}

export function hasAnyApprovedSection(state: BrandFoundationState): boolean {
  return (
    state.purpose.approved ||
    state.mission.approved ||
    state.vision.approved ||
    state.coreValues.approved ||
    state.positioning.approved
  );
}

/**
 * Applies structured AI synthesis output to Brand Foundation state.
 * Safeguard: NEVER overwrites user-approved section statements unless `overwriteApproved` is explicitly true.
 * Even when a user has manually drafted a statement without approving it yet, AI suggestions remain separated
 * in `aiSuggestedStatement` (with `suggestionStatus: 'pending_review'`) so original user input is preserved.
 */
export function applyAiSynthesisResult(
  current: BrandFoundationState,
  executionResult: PromptExecutionResult,
  options?: { overwriteApproved?: boolean },
): BrandFoundationState {
  if (executionResult.status !== 'success') {
    return current;
  }

  const output = executionResult.output;
  const overwriteApproved = options?.overwriteApproved === true;

  const nextPurposeSuggestion = asNullableString(output.purpose);
  const nextMissionSuggestion = asNullableString(output.missionStatement);
  const nextVisionSuggestion = asNullableString(output.visionStatement);
  const nextPositioningSuggestion = asNullableString(output.positioningStatement);
  const nextSuggestedAttributes = asStringArray(output.differentiationAttributes);

  const shouldApplySectionSuggestion = (
    approved: boolean,
    suggestion: string | null,
  ): boolean => Boolean(suggestion) && (!approved || overwriteApproved);

  const resetAnyApproved =
    overwriteApproved &&
    ((current.purpose.approved && Boolean(nextPurposeSuggestion)) ||
      (current.mission.approved && Boolean(nextMissionSuggestion)) ||
      (current.vision.approved && Boolean(nextVisionSuggestion)) ||
      (current.positioning.approved && Boolean(nextPositioningSuggestion)));

  return {
    ...current,
    ...(resetAnyApproved ? { completedAt: null, approvedSummary: null } : {}),
    purpose: {
      ...current.purpose,
      aiSuggestedStatement: shouldApplySectionSuggestion(
        current.purpose.approved,
        nextPurposeSuggestion,
      )
        ? nextPurposeSuggestion
        : current.purpose.aiSuggestedStatement,
      suggestionStatus: shouldApplySectionSuggestion(
        current.purpose.approved,
        nextPurposeSuggestion,
      )
        ? 'pending_review'
        : current.purpose.suggestionStatus,
      ...(overwriteApproved && current.purpose.approved && nextPurposeSuggestion
        ? { approved: false, approvedAt: null }
        : {}),
    },
    mission: {
      ...current.mission,
      aiSuggestedStatement: shouldApplySectionSuggestion(
        current.mission.approved,
        nextMissionSuggestion,
      )
        ? nextMissionSuggestion
        : current.mission.aiSuggestedStatement,
      suggestionStatus: shouldApplySectionSuggestion(
        current.mission.approved,
        nextMissionSuggestion,
      )
        ? 'pending_review'
        : current.mission.suggestionStatus,
      ...(overwriteApproved && current.mission.approved && nextMissionSuggestion
        ? { approved: false, approvedAt: null }
        : {}),
    },
    vision: {
      ...current.vision,
      aiSuggestedStatement: shouldApplySectionSuggestion(
        current.vision.approved,
        nextVisionSuggestion,
      )
        ? nextVisionSuggestion
        : current.vision.aiSuggestedStatement,
      suggestionStatus: shouldApplySectionSuggestion(
        current.vision.approved,
        nextVisionSuggestion,
      )
        ? 'pending_review'
        : current.vision.suggestionStatus,
      ...(overwriteApproved && current.vision.approved && nextVisionSuggestion
        ? { approved: false, approvedAt: null }
        : {}),
    },
    positioning: {
      ...current.positioning,
      aiSuggestedStatement: shouldApplySectionSuggestion(
        current.positioning.approved,
        nextPositioningSuggestion,
      )
        ? nextPositioningSuggestion
        : current.positioning.aiSuggestedStatement,
      aiSuggestedAttributes:
        !current.positioning.approved || overwriteApproved
          ? nextSuggestedAttributes
          : current.positioning.aiSuggestedAttributes,
      suggestionStatus: shouldApplySectionSuggestion(
        current.positioning.approved,
        nextPositioningSuggestion,
      )
        ? 'pending_review'
        : current.positioning.suggestionStatus,
      ...(overwriteApproved && current.positioning.approved && nextPositioningSuggestion
        ? { approved: false, approvedAt: null }
        : {}),
    },
    aiSynthesis: {
      promptId: executionResult.metadata.promptId,
      promptVersion: executionResult.metadata.promptVersion,
      sourceClassification: executionResult.metadata.sourceClassification,
      model: executionResult.metadata.model,
      generatedAt: executionResult.metadata.generatedAt,
      suppliedFactsUsed: asStringArray(output.suppliedFactsUsed),
      missingContextNotes: asStringArray(output.missingContextNotes),
      aiSuggestionsSummary:
        typeof output.aiSuggestions === 'object' &&
        output.aiSuggestions !== null &&
        !Array.isArray(output.aiSuggestions)
          ? (output.aiSuggestions as Record<string, unknown>)
          : null,
    },
  };
}

export function buildProposedStatementDraft(
  section: Exclude<FoundationSectionKey, 'coreValues'>,
  state: BrandFoundationState,
  brandName: string,
): string {
  const safeBrand = brandName.trim() || 'This brand';
  if (section === 'purpose') {
    const p = state.purpose;
    if (!p.problemAddressed.trim() || !p.peopleServed.trim() || !p.positiveChange.trim()) {
      return '';
    }
    return `${safeBrand} exists to address ${p.problemAddressed.trim()} for ${p.peopleServed.trim()}, creating ${p.positiveChange.trim()}.`;
  }
  if (section === 'mission') {
    const m = state.mission;
    if (
      !m.whatBusinessDoes.trim() ||
      !m.whoItServes.trim() ||
      !m.howItServes.trim() ||
      !m.valueDelivered.trim()
    ) {
      return '';
    }
    return `${safeBrand} serves ${m.whoItServes.trim()} by providing ${m.whatBusinessDoes.trim()} through ${m.howItServes.trim()} to deliver ${m.valueDelivered.trim()}.`;
  }
  if (section === 'vision') {
    const v = state.vision;
    if (!v.futureCreated.trim() || !v.longTermAmbition.trim() || !v.impactAchieved.trim()) {
      return '';
    }
    return `We envision ${v.futureCreated.trim()}, driven by our long-term ambition to ${v.longTermAmbition.trim()} and achieve ${v.impactAchieved.trim()}.`;
  }

  const pos = state.positioning;
  if (
    !pos.targetMarket.trim() ||
    !pos.primaryCustomer.trim() ||
    !pos.customerProblem.trim() ||
    !pos.brandSolution.trim() ||
    !pos.differentiatingAdvantage.trim() ||
    !pos.mainValueDelivered.trim()
  ) {
    return '';
  }
  return `For ${pos.primaryCustomer.trim()} in ${pos.targetMarket.trim()} facing ${pos.customerProblem.trim()}, ${safeBrand} provides ${pos.brandSolution.trim()} with ${pos.differentiatingAdvantage.trim()}${
    pos.competitiveDistinction.trim() ? ` (unlike ${pos.competitiveDistinction.trim()})` : ''
  }, delivering ${pos.mainValueDelivered.trim()}.`;
}

export function validateFoundationSection(
  section: FoundationSectionKey,
  state: BrandFoundationState,
): SectionValidationErrors {
  const errors: SectionValidationErrors = {};

  if (section === 'purpose') {
    if (!state.purpose.problemAddressed.trim()) {
      errors.problemAddressed = 'Describe the problem the brand exists to address.';
    }
    if (!state.purpose.peopleServed.trim()) {
      errors.peopleServed = 'Specify who the brand exists to serve.';
    }
    if (!state.purpose.positiveChange.trim()) {
      errors.positiveChange = 'Describe the positive change the brand wants to create.';
    }
    if (!state.purpose.statement.trim()) {
      errors.statement = 'Review, edit, or adopt a purpose statement before approving.';
    }
    return errors;
  }

  if (section === 'mission') {
    if (!state.mission.whatBusinessDoes.trim()) {
      errors.whatBusinessDoes = 'Describe what the business does.';
    }
    if (!state.mission.whoItServes.trim()) {
      errors.whoItServes = 'Specify who the brand serves.';
    }
    if (!state.mission.howItServes.trim()) {
      errors.howItServes = 'Explain how the brand serves its audience.';
    }
    if (!state.mission.valueDelivered.trim()) {
      errors.valueDelivered = 'State the tangible value delivered.';
    }
    if (!state.mission.statement.trim()) {
      errors.statement = 'Review, edit, or adopt a mission statement before approving.';
    }
    return errors;
  }

  if (section === 'vision') {
    if (!state.vision.futureCreated.trim()) {
      errors.futureCreated = 'Describe the future the brand wants to create.';
    }
    if (!state.vision.longTermAmbition.trim()) {
      errors.longTermAmbition = 'Capture the brand’s long-term ambition.';
    }
    if (!state.vision.impactAchieved.trim()) {
      errors.impactAchieved = 'Specify the long-term impact the brand hopes to achieve.';
    }
    if (!state.vision.statement.trim()) {
      errors.statement = 'Review, edit, or adopt a vision statement before approving.';
    }
    return errors;
  }

  if (section === 'coreValues') {
    if (state.coreValues.values.length === 0) {
      errors.values = 'Add at least one core value with behaviors and rationale.';
      return errors;
    }
    const incompleteIndex = state.coreValues.values.findIndex(
      (item) =>
        !item.name.trim() || !item.behaviors.trim() || !item.whyItMatters.trim(),
    );
    if (incompleteIndex >= 0) {
      errors.values = `Complete name, demonstrating behaviors, and why it matters for Core Value #${incompleteIndex + 1}.`;
    }
    return errors;
  }

  // positioning
  if (!state.positioning.targetMarket.trim()) {
    errors.targetMarket = 'Target market is required.';
  }
  if (!state.positioning.primaryCustomer.trim()) {
    errors.primaryCustomer = 'Primary customer profile is required.';
  }
  if (!state.positioning.customerProblem.trim()) {
    errors.customerProblem = 'Customer problem is required.';
  }
  if (!state.positioning.brandSolution.trim()) {
    errors.brandSolution = 'Brand solution is required.';
  }
  if (!state.positioning.differentiatingAdvantage.trim()) {
    errors.differentiatingAdvantage = 'Differentiating advantage is required.';
  }
  if (!state.positioning.competitiveDistinction.trim()) {
    errors.competitiveDistinction = 'Competitive distinction is required.';
  }
  if (!state.positioning.mainValueDelivered.trim()) {
    errors.mainValueDelivered = 'Main value delivered is required.';
  }
  if (!state.positioning.statement.trim()) {
    errors.statement = 'Review, edit, or adopt a positioning statement before approving.';
  }
  return errors;
}

export interface FoundationProgressSummary {
  approvedCount: number;
  totalSections: number;
  percentage: number;
  allSectionsApproved: boolean;
  sectionStatuses: Record<FoundationSectionKey, 'approved' | 'in_progress' | 'not_started'>;
}

function computeSingleSectionStatus(
  approved: boolean,
  hasAnyInput: boolean,
): 'approved' | 'in_progress' | 'not_started' {
  if (approved) return 'approved';
  return hasAnyInput ? 'in_progress' : 'not_started';
}

export function computeFoundationProgress(
  state: BrandFoundationState,
): FoundationProgressSummary {
  const sectionStatuses: Record<FoundationSectionKey, 'approved' | 'in_progress' | 'not_started'> = {
    purpose: computeSingleSectionStatus(
      state.purpose.approved,
      Boolean(
        state.purpose.statement.trim() ||
          state.purpose.problemAddressed.trim() ||
          state.purpose.aiSuggestedStatement,
      ),
    ),
    mission: computeSingleSectionStatus(
      state.mission.approved,
      Boolean(
        state.mission.statement.trim() ||
          state.mission.valueDelivered.trim() ||
          state.mission.aiSuggestedStatement,
      ),
    ),
    vision: computeSingleSectionStatus(
      state.vision.approved,
      Boolean(
        state.vision.statement.trim() ||
          state.vision.futureCreated.trim() ||
          state.vision.aiSuggestedStatement,
      ),
    ),
    coreValues: computeSingleSectionStatus(
      state.coreValues.approved,
      state.coreValues.values.length > 0,
    ),
    positioning: computeSingleSectionStatus(
      state.positioning.approved,
      Boolean(
        state.positioning.statement.trim() ||
          state.positioning.primaryCustomer.trim() ||
          state.positioning.aiSuggestedStatement,
      ),
    ),
  };

  const approvedCount = Object.values(sectionStatuses).filter((s) => s === 'approved').length;
  const totalSections = FOUNDATION_SECTIONS.length;

  return {
    approvedCount,
    totalSections,
    percentage: Math.round((approvedCount / totalSections) * 100),
    allSectionsApproved: approvedCount === totalSections,
    sectionStatuses,
  };
}

export function canCompleteBrandFoundation(state: BrandFoundationState): {
  allowed: boolean;
  incompleteSections: FoundationSectionKey[];
} {
  const incompleteSections: FoundationSectionKey[] = [];
  for (const section of FOUNDATION_SECTIONS) {
    const isApproved = state[section.key].approved;
    const errors = validateFoundationSection(section.key, state);
    if (!isApproved || Object.keys(errors).length > 0) {
      incompleteSections.push(section.key);
    }
  }
  return {
    allowed: incompleteSections.length === 0,
    incompleteSections,
  };
}

export function buildFoundationUpsertPayload(
  state: BrandFoundationState,
  targetStatus: ModuleStatus,
  nowIso = new Date().toISOString(),
): UpsertBrandModuleInput {
  if (targetStatus === 'completed') {
    const check = canCompleteBrandFoundation(state);
    if (!check.allowed) {
      throw new Error(
        `Cannot complete Brand Foundation until all required sections are reviewed and approved (${check.incompleteSections.join(', ')}).`,
      );
    }
  }

  const nextState: BrandFoundationState =
    targetStatus === 'completed'
      ? {
          ...state,
          completedAt: nowIso,
          approvedSummary: {
            purposeStatement: state.purpose.statement.trim(),
            missionStatement: state.mission.statement.trim(),
            visionStatement: state.vision.statement.trim(),
            coreValues: state.coreValues.values.map((v) => ({
              id: v.id,
              name: v.name.trim(),
              behaviors: v.behaviors.trim(),
              whyItMatters: v.whyItMatters.trim(),
            })),
            positioningStatement: state.positioning.statement.trim(),
            differentiationAttributes: [...state.positioning.differentiationAttributes],
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
