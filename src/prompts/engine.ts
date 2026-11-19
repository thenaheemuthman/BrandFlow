import type {
  AiGenerateRequest,
  AiGenerateResponse,
  Brand,
  BrandStrategyModule,
  ModuleStatus,
  StrategyModuleKey,
  UpsertBrandModuleInput,
} from '../types/brand.ts';
import {
  DEFAULT_PROMPT_REGISTRY,
  resolveExecutablePrompt,
} from './registry.ts';
import {
  BrandContextIsolationError,
  PromptCompilationError,
  type BuildVerifiedBrandContextInput,
  type CompiledPromptPayload,
  type PromptDefinition,
  type PromptExecutionResult,
  type PromptExecutionSuccess,
  type PromptFieldSchema,
  type PromptOutputStructure,
  type PromptRegistry,
  type VariableValidationResult,
  type VerifiedBrandContext,
} from './types.ts';

export const ENGINE_MAX_PROMPT_LENGTH = 12_000;
export const ENGINE_MAX_CONTEXT_LENGTH = 24_000;

const BRAND_CONTEXT_STRING_FIELDS = [
  'brandName',
  'businessDescription',
  'industry',
  'productsOrServices',
  'targetMarket',
  'primaryLocation',
  'websiteUrl',
  'socialLinks',
  'existingMission',
  'existingVision',
  'marketingChallenges',
  'businessGoals',
  'competitors',
  'additionalNotes',
] as const;

export type AiExecutor = (request: AiGenerateRequest) => Promise<AiGenerateResponse>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Ensures downstream prompts consuming strategy modules receive ONLY explicitly
 * approved facts (`approvedSummary` or approved sections) and never pending/rejected
 * AI suggestions from upstream drafts. Legacy flat fixtures without section state
 * continue to pass through unchanged.
 */
function sanitizeApprovedStrategyContent(
  moduleKey: StrategyModuleKey,
  status: BrandStrategyModule['status'],
  content: Record<string, unknown>,
): Record<string, unknown> {
  if (moduleKey === 'brandFoundation' || moduleKey === 'brandMessaging') {
    if (status === 'completed' && isRecord(content.approvedSummary)) {
      return {
        brandId: content.brandId,
        completedAt: content.completedAt ?? null,
        approvedSummary: content.approvedSummary,
      };
    }

    const sectionKeys =
      moduleKey === 'brandFoundation'
        ? ['purpose', 'mission', 'vision', 'coreValues', 'positioning']
        : ['coreValueProposition', 'messagingPillars', 'voiceAndTone', 'audienceAngles'];

    const hasStructuredSections = sectionKeys.some((key) => isRecord(content[key]));
    if (hasStructuredSections) {
      const filtered: Record<string, unknown> = {
        brandId: content.brandId,
        status,
      };
      let approvedSectionCount = 0;
      for (const key of sectionKeys) {
        const sec = content[key];
        if (!isRecord(sec) || sec.approved !== true) continue;
        approvedSectionCount += 1;
        const cleanSection = { ...sec };
        delete cleanSection.aiSuggestedStatement;
        delete cleanSection.aiSuggestedAttributes;
        delete cleanSection.aiSuggestedPillars;
        delete cleanSection.aiSuggestedGuardrails;
        delete cleanSection.aiSuggestedAngles;
        delete cleanSection.suggestionStatus;
        filtered[key] = cleanSection;
      }
      return approvedSectionCount > 0 ? filtered : {};
    }
  }

  if (moduleKey === 'customerIntelligence') {
    if (status === 'completed' && isRecord(content.approvedSummary)) {
      return {
        brandId: content.brandId,
        completedAt: content.completedAt ?? null,
        approvedSummary: content.approvedSummary,
      };
    }

    const hasStructuredLists =
      Array.isArray(content.personas) ||
      Array.isArray(content.interests) ||
      Array.isArray(content.aiSuggestedPersonas) ||
      Array.isArray(content.aiSuggestedInterests);

    if (hasStructuredLists) {
      const approvedPersonas = (Array.isArray(content.personas) ? content.personas : [])
        .filter((item): item is Record<string, unknown> => isRecord(item) && item.approved === true)
        .map((persona) => {
          const clean = { ...persona };
          delete clean.aiHypothesisNote;
          return clean;
        });

      const approvedInterests = (Array.isArray(content.interests) ? content.interests : [])
        .filter((item): item is Record<string, unknown> => isRecord(item) && item.approved === true);

      if (approvedPersonas.length === 0 && approvedInterests.length === 0) {
        return {};
      }

      return {
        brandId: content.brandId,
        status,
        personas: approvedPersonas,
        interests: approvedInterests,
      };
    }
  }

  return content;
}

export function buildVerifiedBrandContext(
  input: BuildVerifiedBrandContextInput,
): VerifiedBrandContext {
  const expectedBrandId = input.expectedBrandId.trim();
  if (!expectedBrandId) {
    throw new BrandContextIsolationError('An explicit brandId is required for prompt execution.');
  }

  const brand = input.brand;
  if (!brand) {
    throw new BrandContextIsolationError(
      `Verified brand record for brand "${expectedBrandId}" was not provided.`,
    );
  }

  if (brand.id !== expectedBrandId) {
    throw new BrandContextIsolationError(
      `Brand context isolation violation: expected brand "${expectedBrandId}" but received context for "${brand.id}".`,
    );
  }

  const expectedOwnerUserId = input.expectedOwnerUserId?.trim();
  if (expectedOwnerUserId && brand.userId !== expectedOwnerUserId) {
    throw new BrandContextIsolationError(
      `Brand ownership isolation violation: brand "${expectedBrandId}" does not belong to the active owner.`,
    );
  }

  const suppliedFacts: Record<string, string> = {};
  const missingBrandFields: string[] = [];

  for (const field of BRAND_CONTEXT_STRING_FIELDS) {
    const rawValue = brand[field];
    const trimmed = typeof rawValue === 'string' ? rawValue.trim() : '';
    if (trimmed) {
      suppliedFacts[field] = trimmed;
    } else {
      missingBrandFields.push(field);
    }
  }

  const approvedStrategyModules: Partial<
    Record<
      StrategyModuleKey,
      {
        readonly moduleKey: StrategyModuleKey;
        readonly status: BrandStrategyModule['status'];
        readonly promptId: string | null;
        readonly promptVersion: string | null;
        readonly content: Record<string, unknown>;
        readonly updatedAt: string;
      }
    >
  > = {};

  for (const mod of input.strategyModules ?? []) {
    if (mod.brandId !== expectedBrandId) {
      throw new BrandContextIsolationError(
        `Strategy module isolation violation: module "${mod.moduleKey}" belongs to brand "${mod.brandId}", not "${expectedBrandId}".`,
      );
    }
    if (expectedOwnerUserId && mod.userId !== expectedOwnerUserId) {
      throw new BrandContextIsolationError(
        `Strategy module ownership violation: module "${mod.moduleKey}" does not belong to the active owner.`,
      );
    }
    if (brand.userId && mod.userId !== brand.userId) {
      throw new BrandContextIsolationError(
        `Strategy module owner mismatch for brand "${expectedBrandId}".`,
      );
    }
    if (mod.status === 'not_started') {
      continue;
    }

    const sanitizedContent = sanitizeApprovedStrategyContent(
      mod.moduleKey,
      mod.status,
      mod.content,
    );
    if (Object.keys(sanitizedContent).length === 0) {
      continue;
    }

    approvedStrategyModules[mod.moduleKey] = Object.freeze({
      moduleKey: mod.moduleKey,
      status: mod.status,
      promptId: mod.promptId,
      promptVersion: mod.promptVersion,
      content: sanitizedContent,
      updatedAt: mod.updatedAt,
    });
  }

  return Object.freeze({
    brandId: brand.id,
    ownerUserId: brand.userId,
    brandName: brand.brandName.trim(),
    suppliedFacts: Object.freeze(suppliedFacts),
    missingBrandFields: Object.freeze(missingBrandFields),
    approvedStrategyModules: Object.freeze(approvedStrategyModules),
  });
}

function serializeModuleForVariable(
  mod:
    | {
        status: BrandStrategyModule['status'];
        promptId: string | null;
        promptVersion: string | null;
        content: Record<string, unknown>;
      }
    | undefined,
): string | undefined {
  if (!mod || !mod.content || Object.keys(mod.content).length === 0) {
    return undefined;
  }
  return JSON.stringify({
    status: mod.status,
    promptId: mod.promptId,
    promptVersion: mod.promptVersion,
    content: mod.content,
  });
}

export function buildPromptVariableMap(
  verifiedContext: VerifiedBrandContext,
  extraVariables?: Record<string, unknown>,
): Record<string, string> {
  const resolved: Record<string, string> = {};

  for (const [key, value] of Object.entries(verifiedContext.suppliedFacts)) {
    if (value.trim()) {
      resolved[key] = value.trim();
    }
  }

  const foundationVar = serializeModuleForVariable(
    verifiedContext.approvedStrategyModules.brandFoundation,
  );
  if (foundationVar) {
    resolved.approvedBrandFoundation = foundationVar;
  }

  const messagingVar = serializeModuleForVariable(
    verifiedContext.approvedStrategyModules.brandMessaging,
  );
  if (messagingVar) {
    resolved.approvedBrandMessaging = messagingVar;
  }

  const customerIntelMod = verifiedContext.approvedStrategyModules.customerIntelligence;
  if (customerIntelMod && isRecord(customerIntelMod.content)) {
    const summaryPersonas =
      isRecord(customerIntelMod.content.approvedSummary) &&
      Array.isArray(customerIntelMod.content.approvedSummary.personas)
        ? customerIntelMod.content.approvedSummary.personas
        : null;
    const directPersonas = Array.isArray(customerIntelMod.content.personas)
      ? customerIntelMod.content.personas
      : null;
    const verifiedPersonas = summaryPersonas ?? directPersonas;
    if (verifiedPersonas && verifiedPersonas.length > 0) {
      resolved.approvedCustomerPersonas = JSON.stringify(verifiedPersonas);
    }
  }

  if (extraVariables) {
    const protectedFactKeys = new Set<string>([
      'brandName',
      'businessDescription',
      'industry',
      'productsOrServices',
      'targetMarket',
      'primaryLocation',
    ]);

    for (const [key, rawValue] of Object.entries(extraVariables)) {
      if (rawValue === undefined || rawValue === null) continue;
      if (protectedFactKeys.has(key) && resolved[key]) continue;
      if (key === 'approvedBrandFoundation' && resolved.approvedBrandFoundation) continue;
      if (key === 'approvedBrandMessaging' && resolved.approvedBrandMessaging) continue;
      if (key === 'approvedCustomerPersonas' && resolved.approvedCustomerPersonas) continue;

      let serializedValue = '';
      if (typeof rawValue === 'string') {
        serializedValue = rawValue.trim();
      } else if (Array.isArray(rawValue) || typeof rawValue === 'object') {
        const serialized = JSON.stringify(rawValue);
        if (serialized && serialized !== '[]' && serialized !== '{}') {
          serializedValue = serialized;
        }
      } else {
        serializedValue = String(rawValue);
      }

      if (!serializedValue) continue;
      if (key === 'additionalNotes' && resolved.additionalNotes) {
        resolved.additionalNotes = `${resolved.additionalNotes} | ${serializedValue}`;
      } else {
        resolved[key] = serializedValue;
      }
    }
  }

  return resolved;
}

export function validateRequiredVariables(
  definition: PromptDefinition,
  variables: Record<string, string>,
): VariableValidationResult {
  const resolvedVariables: Record<string, string> = {};
  const missingVariables: string[] = [];

  for (const key of definition.requiredVariables) {
    const val = typeof variables[key] === 'string' ? variables[key].trim() : '';
    if (!val) {
      missingVariables.push(key);
    } else {
      resolvedVariables[key] = val;
    }
  }

  for (const key of definition.optionalVariables) {
    const val = typeof variables[key] === 'string' ? variables[key].trim() : '';
    resolvedVariables[key] = val || 'Not provided';
  }

  return {
    valid: missingVariables.length === 0,
    missingVariables,
    resolvedVariables,
  };
}

const MODULE_TEMPLATE_VARIABLES: Record<StrategyModuleKey, string> = {
  brandFoundation: 'approvedBrandFoundation',
  brandMessaging: 'approvedBrandMessaging',
  customerIntelligence: 'approvedCustomerPersonas',
};

function extractTemplateVariableNames(template: string): Set<string> {
  const names = new Set<string>();
  const matches = template.matchAll(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g);
  for (const match of matches) {
    if (match[1]) {
      names.add(match[1]);
    }
  }
  return names;
}

export function buildApprovedContextPayload(
  verifiedContext: VerifiedBrandContext,
  definition?: PromptDefinition,
): Record<string, unknown> {
  if (!definition) {
    return {
      brandId: verifiedContext.brandId,
      brandName: verifiedContext.brandName,
      groundingPolicy:
        'Use only suppliedFacts and approvedStrategyModules from this exact brand workspace. Do not invent facts for missingBrandFields.',
      suppliedFacts: verifiedContext.suppliedFacts,
      missingBrandFields: verifiedContext.missingBrandFields,
      approvedStrategyModules: verifiedContext.approvedStrategyModules,
    };
  }

  const embeddedVars = extractTemplateVariableNames(definition.userPromptTemplate);

  // Only include facts and approved modules not already interpolated into userPromptTemplate
  // to avoid duplicating large JSON payloads in Gemini requests.
  const supplementalFacts: Record<string, string> = {};
  for (const [key, value] of Object.entries(verifiedContext.suppliedFacts)) {
    if (!embeddedVars.has(key)) {
      supplementalFacts[key] = value;
    }
  }

  const supplementalModules: Record<string, unknown> = {};
  for (const [moduleKey, mod] of Object.entries(verifiedContext.approvedStrategyModules)) {
    if (!mod) continue;
    const templateVar = MODULE_TEMPLATE_VARIABLES[moduleKey as StrategyModuleKey];
    if (!templateVar || !embeddedVars.has(templateVar)) {
      supplementalModules[moduleKey] = mod;
    }
  }

  const payload: Record<string, unknown> = {
    brandId: verifiedContext.brandId,
    brandName: verifiedContext.brandName,
    groundingPolicy:
      'Use only verified brand facts and approved upstream strategy from this exact brand workspace. Do not invent facts for missingBrandFields.',
    missingBrandFields: verifiedContext.missingBrandFields,
  };

  if (Object.keys(supplementalFacts).length > 0) {
    payload.supplementalFacts = supplementalFacts;
  }
  if (Object.keys(supplementalModules).length > 0) {
    payload.supplementalApprovedModules = supplementalModules;
  }

  return payload;
}

export function compilePromptTemplate(
  definition: PromptDefinition,
  verifiedContext: VerifiedBrandContext,
  extraVariables?: Record<string, unknown>,
): CompiledPromptPayload {
  if (definition.status !== 'active') {
    throw new PromptCompilationError(
      `Prompt "${definition.promptId}@${definition.version}" has status "${definition.status}" and cannot be compiled for execution.`,
    );
  }

  const variableMap = buildPromptVariableMap(verifiedContext, extraVariables);
  const validation = validateRequiredVariables(definition, variableMap);
  if (!validation.valid) {
    throw new PromptCompilationError(
      `Missing required variables for "${definition.promptId}": ${validation.missingVariables.join(', ')}.`,
    );
  }

  const compiledUserPrompt = definition.userPromptTemplate.replace(
    /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g,
    (_fullMatch, key: string) => validation.resolvedVariables[key] ?? 'Not provided',
  );

  const outputFormatInstruction =
    definition.expectedOutputStructure.format === 'json'
      ? `Output Format Requirement: Respond with valid JSON only (schema: ${definition.expectedOutputStructure.schemaName}). Required fields: ${definition.expectedOutputStructure.fields
          .filter((f) => f.required)
          .map((f) => `${f.key} (${f.type})`)
          .join(', ')}.`
      : '';

  const compiledSystemInstructions = [
    definition.systemInstructions.trim(),
    outputFormatInstruction,
  ]
    .filter(Boolean)
    .join('\n');

  const combinedPromptText = `${compiledSystemInstructions}\n\n${compiledUserPrompt}`.trim();
  if (combinedPromptText.length > ENGINE_MAX_PROMPT_LENGTH) {
    throw new PromptCompilationError(
      `Compiled prompt exceeds the ${ENGINE_MAX_PROMPT_LENGTH}-character server limit.`,
    );
  }

  const contextPayload = buildApprovedContextPayload(verifiedContext, definition);
  const serializedContext = JSON.stringify(contextPayload);
  if (serializedContext.length > ENGINE_MAX_CONTEXT_LENGTH) {
    throw new PromptCompilationError(
      `Verified brand context exceeds the ${ENGINE_MAX_CONTEXT_LENGTH}-character server limit.`,
    );
  }

  return {
    promptId: definition.promptId,
    promptVersion: definition.version,
    targetModule: definition.targetModule,
    sourceClassification: definition.sourceClassification,
    brandId: verifiedContext.brandId,
    model: definition.modelConfig.model,
    compiledSystemInstructions,
    compiledUserPrompt,
    combinedPromptText,
    contextPayload,
  };
}

function stripJsonCodeFence(rawText: string): string {
  const trimmed = rawText.trim();
  const fenceMatch = trimmed.match(/^```(?:json)?\s*\r?\n([\s\S]*?)\r?\n```$/i);
  if (fenceMatch && typeof fenceMatch[1] === 'string') {
    return fenceMatch[1].trim();
  }
  return trimmed;
}

export function parseStructuredJsonResponse(rawText: string): {
  data?: Record<string, unknown>;
  error?: string;
} {
  const cleaned = stripJsonCodeFence(rawText);
  if (!cleaned) {
    return { error: 'AI returned an empty structured response.' };
  }

  try {
    const parsed: unknown = JSON.parse(cleaned);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return { error: 'AI response must be a JSON object matching the expected output structure.' };
    }
    return { data: parsed as Record<string, unknown> };
  } catch {
    return { error: 'AI returned malformed JSON that could not be parsed safely.' };
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validateField(
  record: Record<string, unknown>,
  field: PromptFieldSchema,
): string | null {
  const value = record[field.key];
  if (value === undefined || value === null) {
    return field.required ? `Missing required output field "${field.key}".` : null;
  }

  switch (field.type) {
    case 'string':
      if (typeof value !== 'string' || (field.required && !value.trim())) {
        return `Field "${field.key}" must be a non-empty string.`;
      }
      return null;
    case 'string_array':
      if (
        !Array.isArray(value) ||
        value.some((item) => typeof item !== 'string' || !item.trim())
      ) {
        return `Field "${field.key}" must be an array of non-empty strings.`;
      }
      if (typeof field.minItems === 'number' && value.length < field.minItems) {
        return `Field "${field.key}" must include at least ${field.minItems} item(s).`;
      }
      return null;
    case 'object':
      if (!isPlainObject(value)) {
        return `Field "${field.key}" must be a JSON object.`;
      }
      return null;
    case 'object_array':
      if (!Array.isArray(value) || value.some((item) => !isPlainObject(item))) {
        return `Field "${field.key}" must be an array of JSON objects.`;
      }
      if (typeof field.minItems === 'number' && value.length < field.minItems) {
        return `Field "${field.key}" must include at least ${field.minItems} item(s).`;
      }
      return null;
    case 'boolean':
      if (typeof value !== 'boolean') {
        return `Field "${field.key}" must be a boolean.`;
      }
      return null;
    case 'number':
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        return `Field "${field.key}" must be a finite number.`;
      }
      return null;
    default:
      return null;
  }
}

export function validateStructuredOutput(
  rawText: string,
  structure: PromptOutputStructure,
): {
  valid: boolean;
  data?: Record<string, unknown>;
  errors: string[];
  safeError?: string;
} {
  if (structure.format === 'text') {
    const trimmed = rawText.trim();
    if (!trimmed) {
      return {
        valid: false,
        errors: ['AI returned an empty text response.'],
        safeError: 'AI returned an empty response.',
      };
    }
    return {
      valid: true,
      data: { text: trimmed },
      errors: [],
    };
  }

  const parsed = parseStructuredJsonResponse(rawText);
  if (parsed.error || !parsed.data) {
    const msg = parsed.error ?? 'Malformed structured JSON response.';
    return {
      valid: false,
      errors: [msg],
      safeError: msg,
    };
  }

  const errors: string[] = [];
  for (const field of structure.fields) {
    const err = validateField(parsed.data, field);
    if (err) {
      errors.push(err);
    }
  }

  if (structure.requireGroundedFactSeparation) {
    const hasFacts = Array.isArray(parsed.data.suppliedFactsUsed);
    const hasSuggestions = isPlainObject(parsed.data.aiSuggestions);
    if (!hasFacts || !hasSuggestions) {
      errors.push(
        'Structured output must separate suppliedFactsUsed (array) from aiSuggestions (object).',
      );
    }
  }

  if (errors.length > 0) {
    return {
      valid: false,
      errors,
      safeError: `Generated output failed ${structure.schemaName} validation: ${errors[0]}`,
    };
  }

  return {
    valid: true,
    data: parsed.data,
    errors: [],
  };
}

export interface ExecutePromptInput {
  promptId: string;
  version?: string;
  brandId: string;
  brand: Brand | null | undefined;
  expectedOwnerUserId?: string;
  strategyModules?: readonly BrandStrategyModule[];
  variables?: Record<string, unknown>;
  registry?: PromptRegistry;
  executeAi: AiExecutor;
}

export async function executePrompt(
  input: ExecutePromptInput,
): Promise<PromptExecutionResult> {
  const registry = input.registry ?? DEFAULT_PROMPT_REGISTRY;
  const definition = resolveExecutablePrompt(input.promptId, input.version, registry);

  const verifiedContext = buildVerifiedBrandContext({
    expectedBrandId: input.brandId,
    expectedOwnerUserId: input.expectedOwnerUserId,
    brand: input.brand,
    strategyModules: input.strategyModules,
  });

  const variableMap = buildPromptVariableMap(verifiedContext, input.variables);
  const variableCheck = validateRequiredVariables(definition, variableMap);

  if (!variableCheck.valid) {
    return {
      status: 'missing_information',
      brandId: verifiedContext.brandId,
      promptId: definition.promptId,
      promptVersion: definition.version,
      targetModule: definition.targetModule,
      missingVariables: variableCheck.missingVariables,
      message: `Cannot run "${definition.name}" because required brand information is missing: ${variableCheck.missingVariables.join(', ')}.`,
      canSave: false,
    };
  }

  const compiled = compilePromptTemplate(definition, verifiedContext, input.variables);

  const aiResponse = await input.executeAi({
    prompt: compiled.combinedPromptText,
    context: compiled.contextPayload,
    model: compiled.model,
    responseMimeType:
      definition.expectedOutputStructure.format === 'json'
        ? 'application/json'
        : undefined,
  });

  const outputCheck = validateStructuredOutput(
    aiResponse.text,
    definition.expectedOutputStructure,
  );

  if (!outputCheck.valid || !outputCheck.data) {
    return {
      status: 'validation_error',
      brandId: verifiedContext.brandId,
      promptId: definition.promptId,
      promptVersion: definition.version,
      targetModule: definition.targetModule,
      model: aiResponse.model,
      generatedAt: aiResponse.generatedAt,
      error: outputCheck.safeError ?? 'AI output failed structured validation.',
      errors: outputCheck.errors,
      canSave: false,
    };
  }

  const metadata = {
    promptId: definition.promptId,
    promptVersion: definition.version,
    targetModule: definition.targetModule,
    sourceClassification: definition.sourceClassification,
    brandId: verifiedContext.brandId,
    model: aiResponse.model,
    generatedAt: aiResponse.generatedAt,
  };

  return {
    status: 'success',
    brandId: verifiedContext.brandId,
    promptId: definition.promptId,
    promptVersion: definition.version,
    targetModule: definition.targetModule,
    sourceClassification: definition.sourceClassification,
    model: aiResponse.model,
    generatedAt: aiResponse.generatedAt,
    rawText: aiResponse.text,
    output: outputCheck.data,
    metadata,
    canSave: true,
  };
}

export function buildStrategyModuleUpsertInput(
  result: PromptExecutionResult,
  status: ModuleStatus = 'in_progress',
): UpsertBrandModuleInput {
  if (result.status !== 'success' || !result.canSave) {
    throw new PromptCompilationError(
      'Cannot save strategy module from an invalid or incomplete prompt execution result.',
    );
  }

  const successResult = result as PromptExecutionSuccess;
  return {
    status,
    content: successResult.output,
    promptId: successResult.metadata.promptId,
    promptVersion: successResult.metadata.promptVersion,
    model: successResult.metadata.model,
    generatedAt: successResult.metadata.generatedAt,
  };
}
