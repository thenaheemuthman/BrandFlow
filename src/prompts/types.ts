import type {
  AllowedGeminiModel,
  Brand,
  BrandModuleKey,
  BrandStrategyModule,
  StrategyModuleKey,
} from '../types/brand.ts';

export type PromptStatus = 'draft' | 'active' | 'deprecated';

export type PromptSourceClassification = 'original' | 'reconstructed';

export type OriginalContentAvailability = 'supplied_verbatim' | 'missing_from_workspace';

export type PromptOutputFormat = 'json' | 'text';

export type PromptSchemaFieldType =
  | 'string'
  | 'string_array'
  | 'object'
  | 'object_array'
  | 'boolean'
  | 'number';

export interface PromptFieldSchema {
  readonly key: string;
  readonly type: PromptSchemaFieldType;
  readonly required: boolean;
  readonly description: string;
  readonly minItems?: number;
}

export interface PromptOutputStructure {
  readonly format: PromptOutputFormat;
  readonly schemaName: string;
  readonly description: string;
  readonly fields: readonly PromptFieldSchema[];
  readonly requireGroundedFactSeparation?: boolean;
  readonly geminiResponseSchema?: Record<string, unknown>;
}

export interface PromptModelConfig {
  readonly model: AllowedGeminiModel;
  readonly temperature?: number;
  readonly maxOutputTokens?: number;
}

export interface PromptMetadata {
  readonly createdAt: string;
  readonly createdBy: string;
  readonly updatedAt: string;
  readonly updatedBy: string;
  readonly changeNotes?: string;
}

export interface PromptDefinition {
  readonly promptId: string;
  readonly name: string;
  readonly description: string;
  readonly targetModule: BrandModuleKey;
  readonly version: string;
  readonly status: PromptStatus;
  readonly sourceClassification: PromptSourceClassification;
  readonly originalContentStatus?: OriginalContentAvailability;
  readonly systemInstructions: string;
  readonly userPromptTemplate: string;
  readonly requiredVariables: readonly string[];
  readonly optionalVariables: readonly string[];
  readonly expectedOutputStructure: PromptOutputStructure;
  readonly modelConfig: PromptModelConfig;
  readonly metadata: PromptMetadata;
}

export interface PromptRecord {
  readonly promptId: string;
  readonly activeVersion: PromptDefinition | null;
  readonly latestVersion: PromptDefinition;
  readonly versions: readonly PromptDefinition[];
}

export interface PromptRegistry {
  readonly recordsById: ReadonlyMap<string, PromptRecord>;
  readonly versionsByKey: ReadonlyMap<string, PromptDefinition>;
  readonly allDefinitions: readonly PromptDefinition[];
}

export interface VerifiedBrandContext {
  readonly brandId: string;
  readonly ownerUserId: string;
  readonly brandName: string;
  readonly suppliedFacts: Readonly<Record<string, string>>;
  readonly missingBrandFields: readonly string[];
  readonly approvedStrategyModules: Readonly<
    Partial<
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
    >
  >;
}

export interface BuildVerifiedBrandContextInput {
  expectedBrandId: string;
  expectedOwnerUserId?: string;
  brand: Brand | null | undefined;
  strategyModules?: readonly BrandStrategyModule[];
}

export interface VariableValidationResult {
  valid: boolean;
  missingVariables: string[];
  resolvedVariables: Record<string, string>;
}

export interface CompiledPromptPayload {
  promptId: string;
  promptVersion: string;
  targetModule: BrandModuleKey;
  sourceClassification: PromptSourceClassification;
  brandId: string;
  model: AllowedGeminiModel;
  compiledSystemInstructions: string;
  compiledUserPrompt: string;
  combinedPromptText: string;
  contextPayload: Record<string, unknown>;
}

export interface PromptExecutionMetadata {
  promptId: string;
  promptVersion: string;
  targetModule: BrandModuleKey;
  sourceClassification: PromptSourceClassification;
  brandId: string;
  model: AllowedGeminiModel;
  generatedAt: string;
}

export interface PromptExecutionSuccess<TOutput = Record<string, unknown>> {
  status: 'success';
  brandId: string;
  promptId: string;
  promptVersion: string;
  targetModule: BrandModuleKey;
  sourceClassification: PromptSourceClassification;
  model: AllowedGeminiModel;
  generatedAt: string;
  rawText: string;
  output: TOutput;
  metadata: PromptExecutionMetadata;
  canSave: true;
}

export interface PromptMissingInformationResult {
  status: 'missing_information';
  brandId: string;
  promptId: string;
  promptVersion: string;
  targetModule: BrandModuleKey;
  missingVariables: string[];
  message: string;
  canSave: false;
}

export interface PromptValidationErrorResult {
  status: 'validation_error';
  brandId: string;
  promptId: string;
  promptVersion: string;
  targetModule: BrandModuleKey;
  model: AllowedGeminiModel;
  generatedAt: string;
  error: string;
  errors: string[];
  canSave: false;
}

export type PromptExecutionResult<TOutput = Record<string, unknown>> =
  | PromptExecutionSuccess<TOutput>
  | PromptMissingInformationResult
  | PromptValidationErrorResult;

export class PromptRegistryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PromptRegistryError';
  }
}

export class PromptNotFoundError extends Error {
  readonly statusCode = 404;

  constructor(message: string) {
    super(message);
    this.name = 'PromptNotFoundError';
  }
}

export class PromptStatusError extends Error {
  readonly statusCode = 400;

  constructor(message: string) {
    super(message);
    this.name = 'PromptStatusError';
  }
}

export class BrandContextIsolationError extends Error {
  readonly statusCode = 400;

  constructor(message: string) {
    super(message);
    this.name = 'BrandContextIsolationError';
  }
}

export class PromptCompilationError extends Error {
  readonly statusCode = 400;

  constructor(message: string) {
    super(message);
    this.name = 'PromptCompilationError';
  }
}
