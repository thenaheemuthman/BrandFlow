import type { BrandModuleKey } from '../types/brand.ts';
import {
  PromptNotFoundError,
  PromptRegistryError,
  PromptStatusError,
  type PromptDefinition,
  type PromptRecord,
  type PromptRegistry,
  type PromptSourceClassification,
  type PromptStatus,
} from './types.ts';

const ALLOWED_MODELS = new Set(['gemini-4-hydrogen', 'gemini-3.1-flash-lite']);
const TEMPLATE_PLACEHOLDER_REGEX = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== 'object') {
    return value;
  }
  if (!Object.isFrozen(value)) {
    Object.freeze(value);
  }
  for (const key of Object.keys(value as Record<string, unknown>)) {
    deepFreeze((value as Record<string, unknown>)[key]);
  }
  return value;
}

function makeVersionKey(promptId: string, version: string): string {
  return `${promptId}@@${version}`;
}

export function extractTemplateVariables(template: string): string[] {
  const found = new Set<string>();
  const regex = new RegExp(TEMPLATE_PLACEHOLDER_REGEX.source, 'g');
  let match: RegExpExecArray | null;
  while ((match = regex.exec(template)) !== null) {
    if (match[1]) {
      found.add(match[1]);
    }
  }
  return Array.from(found);
}

function validatePromptDefinition(def: PromptDefinition): void {
  if (!def.promptId || !def.promptId.trim()) {
    throw new PromptRegistryError('Prompt definition requires a non-empty promptId.');
  }
  if (!def.name || !def.name.trim()) {
    throw new PromptRegistryError(`Prompt "${def.promptId}" requires a human-readable name.`);
  }
  if (!def.version || !def.version.trim()) {
    throw new PromptRegistryError(`Prompt "${def.promptId}" requires a version number.`);
  }
  if (!ALLOWED_MODELS.has(def.modelConfig.model)) {
    throw new PromptRegistryError(
      `Prompt "${def.promptId}@${def.version}" specifies unsupported model "${def.modelConfig.model}".`,
    );
  }

  if (def.sourceClassification === 'original' && !def.originalContentStatus) {
    throw new PromptRegistryError(
      `Original prompt "${def.promptId}@${def.version}" must declare originalContentStatus.`,
    );
  }

  if (
    def.sourceClassification === 'original' &&
    def.originalContentStatus === 'missing_from_workspace' &&
    def.status !== 'draft'
  ) {
    throw new PromptRegistryError(
      `Original prompt "${def.promptId}@${def.version}" is missing verbatim source wording and must remain in draft status.`,
    );
  }

  if (def.status === 'active') {
    if (!def.systemInstructions.trim() || !def.userPromptTemplate.trim()) {
      throw new PromptRegistryError(
        `Active prompt "${def.promptId}@${def.version}" must define systemInstructions and userPromptTemplate.`,
      );
    }
  }

  const requiredSet = new Set(def.requiredVariables);
  const optionalSet = new Set(def.optionalVariables);
  for (const key of requiredSet) {
    if (optionalSet.has(key)) {
      throw new PromptRegistryError(
        `Prompt "${def.promptId}@${def.version}" lists "${key}" in both requiredVariables and optionalVariables.`,
      );
    }
  }

  const templateVars = extractTemplateVariables(def.userPromptTemplate);
  for (const key of templateVars) {
    if (!requiredSet.has(key) && !optionalSet.has(key)) {
      throw new PromptRegistryError(
        `Prompt "${def.promptId}@${def.version}" references undeclared template variable "{{${key}}}".`,
      );
    }
  }
}

export function createPromptRegistry(definitions: readonly PromptDefinition[]): PromptRegistry {
  const versionsByKey = new Map<string, PromptDefinition>();
  const grouped = new Map<string, PromptDefinition[]>();

  for (const rawDef of definitions) {
    validatePromptDefinition(rawDef);
    const frozenDef = deepFreeze(structuredClone(rawDef));
    const versionKey = makeVersionKey(frozenDef.promptId, frozenDef.version);

    if (versionsByKey.has(versionKey)) {
      throw new PromptRegistryError(
        `Duplicate prompt version "${frozenDef.promptId}@${frozenDef.version}" cannot overwrite an existing immutable version.`,
      );
    }

    versionsByKey.set(versionKey, frozenDef);
    const list = grouped.get(frozenDef.promptId) ?? [];
    list.push(frozenDef);
    grouped.set(frozenDef.promptId, list);
  }

  const recordsById = new Map<string, PromptRecord>();
  const allDefinitions: PromptDefinition[] = [];

  for (const [promptId, versions] of grouped.entries()) {
    const activeVersions = versions.filter((v) => v.status === 'active');
    if (activeVersions.length > 1) {
      throw new PromptRegistryError(
        `Prompt "${promptId}" cannot have multiple active versions simultaneously.`,
      );
    }

    const frozenVersions = deepFreeze([...versions]);
    const activeVersion = activeVersions[0] ?? null;
    const latestVersion = frozenVersions[frozenVersions.length - 1];

    recordsById.set(
      promptId,
      deepFreeze({
        promptId,
        activeVersion,
        latestVersion,
        versions: frozenVersions,
      }),
    );

    allDefinitions.push(...frozenVersions);
  }

  return deepFreeze({
    recordsById,
    versionsByKey,
    allDefinitions,
  });
}

export function registerPromptVersion(
  registry: PromptRegistry,
  nextDefinition: PromptDefinition,
): PromptRegistry {
  const versionKey = makeVersionKey(nextDefinition.promptId, nextDefinition.version);
  if (registry.versionsByKey.has(versionKey)) {
    throw new PromptRegistryError(
      `Cannot overwrite existing immutable prompt version "${nextDefinition.promptId}@${nextDefinition.version}".`,
    );
  }
  return createPromptRegistry([...registry.allDefinitions, nextDefinition]);
}

/**
 * Default centralized prompt definitions for BrandFlow AI.
 *
 * Original prompts (Core Values Discovery, Core Values Refinement, Brand Messaging Options):
 * Their complete verbatim source text was not present in the repository assets, so they are
 * registered strictly in `draft` status with `originalContentStatus: 'missing_from_workspace'`
 * and empty templates rather than inventing or mislabeling reconstructed wording as original.
 *
 * Reconstructed active prompts (`brand_foundation_synthesis`, `brand_messaging_framework`):
 * Explicitly labeled `sourceClassification: 'reconstructed'` so Phase 2A structured execution
 * works without masquerading as original supplied prompts.
 */
export const DEFAULT_PROMPT_DEFINITIONS: readonly PromptDefinition[] = [
  {
    promptId: 'brand_foundation_core_values_discovery',
    name: 'Core Values Discovery',
    description:
      'Original prompt slot for discovering foundational brand core values. Complete original verbatim wording is missing from project assets and must be added before publishing.',
    targetModule: 'brandFoundation',
    version: '1.0.0-draft',
    status: 'draft',
    sourceClassification: 'original',
    originalContentStatus: 'missing_from_workspace',
    systemInstructions: '',
    userPromptTemplate: '',
    requiredVariables: ['brandName', 'businessDescription', 'industry', 'targetMarket'],
    optionalVariables: [
      'productsOrServices',
      'primaryLocation',
      'existingMission',
      'existingVision',
      'additionalNotes',
    ],
    expectedOutputStructure: {
      format: 'json',
      schemaName: 'CoreValuesDiscoveryOutput',
      description: 'Core value candidates grounded in verified workspace facts.',
      requireGroundedFactSeparation: true,
      fields: [
        {
          key: 'suppliedFactsUsed',
          type: 'string_array',
          required: true,
          description: 'Facts sourced strictly from verified brand profile inputs.',
          minItems: 1,
        },
        {
          key: 'aiSuggestions',
          type: 'object',
          required: true,
          description: 'AI-generated core value recommendations and rationale.',
        },
        {
          key: 'discoveredValues',
          type: 'object_array',
          required: true,
          description: 'Proposed core values with workspace-grounded rationale.',
          minItems: 3,
        },
      ],
    },
    modelConfig: {
      model: 'gemini-4-hydrogen',
      temperature: 0.4,
      maxOutputTokens: 2048,
    },
    metadata: {
      createdAt: '2026-11-15T00:00:00.000Z',
      createdBy: 'brandflow-system',
      updatedAt: '2026-11-15T00:00:00.000Z',
      updatedBy: 'brandflow-system',
      changeNotes:
        'Reserved original prompt slot; kept in draft because verbatim original wording was not present in the workspace.',
    },
  },
  {
    promptId: 'brand_foundation_core_values_refinement',
    name: 'Core Values Refinement',
    description:
      'Original prompt slot for refining selected core values into clear principles and brand behaviors. Complete original verbatim wording is missing from project assets and must be added before publishing.',
    targetModule: 'brandFoundation',
    version: '1.0.0-draft',
    status: 'draft',
    sourceClassification: 'original',
    originalContentStatus: 'missing_from_workspace',
    systemInstructions: '',
    userPromptTemplate: '',
    requiredVariables: ['brandName', 'businessDescription', 'candidateCoreValues'],
    optionalVariables: [
      'industry',
      'targetMarket',
      'existingMission',
      'existingVision',
      'additionalNotes',
    ],
    expectedOutputStructure: {
      format: 'json',
      schemaName: 'CoreValuesRefinementOutput',
      description: 'Refined core values with definitions and behavioral standards.',
      requireGroundedFactSeparation: true,
      fields: [
        {
          key: 'suppliedFactsUsed',
          type: 'string_array',
          required: true,
          description: 'Facts and selected value inputs supplied by the user.',
          minItems: 1,
        },
        {
          key: 'aiSuggestions',
          type: 'object',
          required: true,
          description: 'AI-proposed refinements and operating behaviors.',
        },
        {
          key: 'refinedValues',
          type: 'object_array',
          required: true,
          description: 'Refined core value statements and behavioral proof.',
          minItems: 1,
        },
      ],
    },
    modelConfig: {
      model: 'gemini-4-hydrogen',
      temperature: 0.35,
      maxOutputTokens: 2048,
    },
    metadata: {
      createdAt: '2026-11-15T00:00:00.000Z',
      createdBy: 'brandflow-system',
      updatedAt: '2026-11-15T00:00:00.000Z',
      updatedBy: 'brandflow-system',
      changeNotes:
        'Reserved original prompt slot; kept in draft because verbatim original wording was not present in the workspace.',
    },
  },
  {
    promptId: 'brand_messaging_options',
    name: 'Brand Messaging Options',
    description:
      'Original prompt slot for generating strategic brand messaging options. Complete original verbatim wording is missing from project assets and must be added before publishing.',
    targetModule: 'brandMessaging',
    version: '1.0.0-draft',
    status: 'draft',
    sourceClassification: 'original',
    originalContentStatus: 'missing_from_workspace',
    systemInstructions: '',
    userPromptTemplate: '',
    requiredVariables: [
      'brandName',
      'businessDescription',
      'industry',
      'productsOrServices',
      'targetMarket',
    ],
    optionalVariables: [
      'primaryLocation',
      'approvedBrandFoundation',
      'businessGoals',
      'marketingChallenges',
      'competitors',
      'additionalNotes',
    ],
    expectedOutputStructure: {
      format: 'json',
      schemaName: 'BrandMessagingOptionsOutput',
      description: 'Multiple messaging options grounded in verified brand facts.',
      requireGroundedFactSeparation: true,
      fields: [
        {
          key: 'suppliedFactsUsed',
          type: 'string_array',
          required: true,
          description: 'Verified facts drawn strictly from the brand profile and foundation.',
          minItems: 1,
        },
        {
          key: 'aiSuggestions',
          type: 'object',
          required: true,
          description: 'AI-generated messaging directions for owner selection.',
        },
        {
          key: 'messagingOptions',
          type: 'object_array',
          required: true,
          description: 'Distinct messaging option sets with positioning hooks.',
          minItems: 2,
        },
      ],
    },
    modelConfig: {
      model: 'gemini-4-hydrogen',
      temperature: 0.45,
      maxOutputTokens: 2048,
    },
    metadata: {
      createdAt: '2026-11-15T00:00:00.000Z',
      createdBy: 'brandflow-system',
      updatedAt: '2026-11-15T00:00:00.000Z',
      updatedBy: 'brandflow-system',
      changeNotes:
        'Reserved original prompt slot; kept in draft because verbatim original wording was not present in the workspace.',
    },
  },
  {
    promptId: 'brand_foundation_synthesis',
    name: 'Brand Foundation Synthesis',
    description:
      'Reconstructed prompt that synthesizes brand purpose, mission, vision, positioning statement, and differentiation attributes from verified workspace profile data.',
    targetModule: 'brandFoundation',
    version: '1.0.0',
    status: 'active',
    sourceClassification: 'reconstructed',
    systemInstructions: [
      'You are the BrandFlow AI senior brand strategist.',
      'Use ONLY the verified brand facts provided in the context for factual claims about the company.',
      'Never invent customer metrics, revenue numbers, testimonials, awards, URLs, or facts not present in supplied input.',
      'Clearly separate verified supplied facts used (suppliedFactsUsed) from AI-generated strategic recommendations (aiSuggestions).',
      'Respond with valid JSON only matching the requested output schema, without markdown prose outside JSON.',
    ].join(' '),
    userPromptTemplate: [
      'Develop a structured Brand Foundation draft for {{brandName}} ({{industry}}, {{primaryLocation}}).',
      '',
      'Verified Brand Profile:',
      '- Business Description: {{businessDescription}}',
      '- Products or Services: {{productsOrServices}}',
      '- Target Market: {{targetMarket}}',
      '- Existing Mission: {{existingMission}}',
      '- Existing Vision: {{existingVision}}',
      '- Business Goals: {{businessGoals}}',
      '- Marketing Challenges: {{marketingChallenges}}',
      '- Competitors: {{competitors}}',
      '- Additional Notes: {{additionalNotes}}',
      '',
      'Return a single JSON object with keys: suppliedFactsUsed (array of strings), missingContextNotes (array of strings), aiSuggestions (object summarizing rationale and open validation questions), purpose (string), missionStatement (string), visionStatement (string), positioningStatement (string), and differentiationAttributes (array of 2-5 concise strings).',
    ].join('\n'),
    requiredVariables: [
      'brandName',
      'businessDescription',
      'industry',
      'productsOrServices',
      'targetMarket',
      'primaryLocation',
    ],
    optionalVariables: [
      'websiteUrl',
      'socialLinks',
      'existingMission',
      'existingVision',
      'marketingChallenges',
      'businessGoals',
      'competitors',
      'additionalNotes',
    ],
    expectedOutputStructure: {
      format: 'json',
      schemaName: 'BrandFoundationSynthesisOutput',
      description: 'Structured Brand Foundation strategy output with explicit fact/suggestion separation.',
      requireGroundedFactSeparation: true,
      fields: [
        {
          key: 'suppliedFactsUsed',
          type: 'string_array',
          required: true,
          description: 'Facts explicitly grounded in the brand profile.',
          minItems: 1,
        },
        {
          key: 'missingContextNotes',
          type: 'string_array',
          required: true,
          description: 'Optional fields that were not provided and should not be assumed.',
        },
        {
          key: 'aiSuggestions',
          type: 'object',
          required: true,
          description: 'Strategic rationale and recommendations clearly marked as AI suggestions.',
        },
        {
          key: 'purpose',
          type: 'string',
          required: true,
          description: 'Concise brand purpose statement.',
        },
        {
          key: 'missionStatement',
          type: 'string',
          required: true,
          description: 'Actionable mission statement.',
        },
        {
          key: 'visionStatement',
          type: 'string',
          required: true,
          description: 'Long-term vision statement.',
        },
        {
          key: 'positioningStatement',
          type: 'string',
          required: true,
          description: 'Clear competitive positioning statement.',
        },
        {
          key: 'differentiationAttributes',
          type: 'string_array',
          required: true,
          description: 'Core attributes that differentiate the brand.',
          minItems: 2,
        },
      ],
    },
    modelConfig: {
      model: 'gemini-4-hydrogen',
      temperature: 0.35,
      maxOutputTokens: 2048,
    },
    metadata: {
      createdAt: '2026-11-15T00:00:00.000Z',
      createdBy: 'brandflow-system',
      updatedAt: '2026-11-15T00:00:00.000Z',
      updatedBy: 'brandflow-system',
      changeNotes: 'Initial reconstructed active prompt for Brand Foundation synthesis.',
    },
  },
  {
    promptId: 'brand_messaging_framework',
    name: 'Brand Messaging Framework',
    description:
      'Reconstructed prompt that translates verified brand context and optional approved Brand Foundation into a structured messaging framework.',
    targetModule: 'brandMessaging',
    version: '1.0.0',
    status: 'active',
    sourceClassification: 'reconstructed',
    systemInstructions: [
      'You are the BrandFlow AI senior messaging strategist.',
      'Anchor every claim strictly in verified workspace facts and any approved Brand Foundation module from the same brand workspace.',
      'Never reference or extrapolate facts from external brands or missing profile fields.',
      'Explicitly distinguish verified supplied facts (suppliedFactsUsed) from AI-generated messaging proposals (aiSuggestions).',
      'Respond with valid JSON only matching the requested output schema, without markdown prose outside JSON.',
    ].join(' '),
    userPromptTemplate: [
      'Develop a structured Brand Messaging Framework for {{brandName}} ({{industry}}, {{primaryLocation}}).',
      '',
      'Verified Brand Profile:',
      '- Business Description: {{businessDescription}}',
      '- Products or Services: {{productsOrServices}}',
      '- Target Market: {{targetMarket}}',
      '- Marketing Challenges: {{marketingChallenges}}',
      '- Business Goals: {{businessGoals}}',
      '- Competitors: {{competitors}}',
      '- Additional Notes: {{additionalNotes}}',
      '',
      'Approved Brand Foundation (Same Brand Only):',
      '{{approvedBrandFoundation}}',
      '',
      'Return a single JSON object with keys: suppliedFactsUsed (array of strings), missingContextNotes (array of strings), aiSuggestions (object with editorial recommendations), coreValueProposition (string), messagingPillars (array of at least 2 objects with title and summary), voiceAndTone (object with attributes and guardrails), and audienceAngles (array of at least 1 object with audience and message).',
    ].join('\n'),
    requiredVariables: [
      'brandName',
      'businessDescription',
      'industry',
      'productsOrServices',
      'targetMarket',
      'primaryLocation',
    ],
    optionalVariables: [
      'approvedBrandFoundation',
      'websiteUrl',
      'existingMission',
      'existingVision',
      'marketingChallenges',
      'businessGoals',
      'competitors',
      'additionalNotes',
    ],
    expectedOutputStructure: {
      format: 'json',
      schemaName: 'BrandMessagingFrameworkOutput',
      description: 'Structured Brand Messaging framework with explicit fact/suggestion separation.',
      requireGroundedFactSeparation: true,
      fields: [
        {
          key: 'suppliedFactsUsed',
          type: 'string_array',
          required: true,
          description: 'Facts explicitly grounded in the brand profile or foundation.',
          minItems: 1,
        },
        {
          key: 'missingContextNotes',
          type: 'string_array',
          required: true,
          description: 'Missing optional context fields noted transparently.',
        },
        {
          key: 'aiSuggestions',
          type: 'object',
          required: true,
          description: 'AI-proposed messaging guidance and testing notes.',
        },
        {
          key: 'coreValueProposition',
          type: 'string',
          required: true,
          description: 'Primary value proposition statement.',
        },
        {
          key: 'messagingPillars',
          type: 'object_array',
          required: true,
          description: 'Key strategic messaging pillars.',
          minItems: 2,
        },
        {
          key: 'voiceAndTone',
          type: 'object',
          required: true,
          description: 'Voice traits and tone guardrails.',
        },
        {
          key: 'audienceAngles',
          type: 'object_array',
          required: true,
          description: 'Audience-specific messaging angles.',
          minItems: 1,
        },
      ],
    },
    modelConfig: {
      model: 'gemini-4-hydrogen',
      temperature: 0.4,
      maxOutputTokens: 2048,
    },
    metadata: {
      createdAt: '2026-11-15T00:00:00.000Z',
      createdBy: 'brandflow-system',
      updatedAt: '2026-11-15T00:00:00.000Z',
      updatedBy: 'brandflow-system',
      changeNotes: 'Initial reconstructed active prompt for Brand Messaging framework.',
    },
  },
  {
    promptId: 'customer_personas_synthesis',
    name: 'Customer Personas Synthesis',
    description:
      'Reconstructed prompt that generates grounded customer persona hypotheses using verified brand profile facts plus approved Brand Foundation and Brand Messaging.',
    targetModule: 'customerIntelligence',
    version: '1.0.0',
    status: 'active',
    sourceClassification: 'reconstructed',
    systemInstructions: [
      'You are the BrandFlow AI customer intelligence researcher.',
      'Ground every persona hypothesis strictly in verified workspace facts and the approved Brand Foundation and Brand Messaging from the same brand workspace.',
      'Clearly distinguish supplied verified facts (suppliedFactsUsed) from AI-generated audience hypotheses (aiSuggestions and personas).',
      'Include a clear researchCaveat reminding the strategist that AI persona hypotheses are not verified empirical customer interviews until reviewed and approved.',
      'Do NOT invent irrelevant demographic attributes (such as age, income, or education) unless directly relevant to purchasing or product usage; omit or leave empty irrelevant demographic fields and set demographicsRelevant: false when not applicable.',
      'Respond with valid JSON only matching the requested output schema, without markdown prose outside JSON.',
    ].join(' '),
    userPromptTemplate: [
      'Develop 2 to 4 actionable Customer Persona hypotheses for {{brandName}} ({{industry}}, {{primaryLocation}}).',
      '',
      'Verified Brand Profile:',
      '- Business Description: {{businessDescription}}',
      '- Products or Services: {{productsOrServices}}',
      '- Target Market: {{targetMarket}}',
      '- Marketing Challenges: {{marketingChallenges}}',
      '- Business Goals: {{businessGoals}}',
      '- Competitors: {{competitors}}',
      '- Additional Notes: {{additionalNotes}}',
      '',
      'Approved Brand Foundation (Same Brand Only):',
      '{{approvedBrandFoundation}}',
      '',
      'Approved Brand Messaging (Same Brand Only):',
      '{{approvedBrandMessaging}}',
      '',
      'Return a single JSON object with keys:',
      '- suppliedFactsUsed (array of strings citing exact verified inputs used)',
      '- missingContextNotes (array of strings noting gaps or assumptions to validate)',
      '- researchCaveat (string explicitly stating these personas are AI-generated hypotheses requiring strategist review)',
      '- aiSuggestions (object with segmentationRationale and validationQuestions array)',
      '- personas (array of 2-4 objects, each with: name, roleOrSegment, summary, goals (array), painPoints (array), motivations (array), objections (array), purchasingTriggers (array), decisionFactors (array), informationSources (array), communicationPreferences (array), demographicsRelevant (boolean), demographics (object with optional ageRange, location, incomeOrBudget, occupationOrRole, educationOrExperience, lifestyleOrContext strings only when relevant)).',
    ].join('\n'),
    requiredVariables: [
      'brandName',
      'businessDescription',
      'industry',
      'productsOrServices',
      'targetMarket',
      'primaryLocation',
      'approvedBrandFoundation',
      'approvedBrandMessaging',
    ],
    optionalVariables: [
      'websiteUrl',
      'marketingChallenges',
      'businessGoals',
      'competitors',
      'additionalNotes',
    ],
    expectedOutputStructure: {
      format: 'json',
      schemaName: 'CustomerPersonasOutput',
      description: 'Structured customer persona hypotheses with grounded fact/hypothesis separation and optional demographics.',
      requireGroundedFactSeparation: true,
      fields: [
        {
          key: 'suppliedFactsUsed',
          type: 'string_array',
          required: true,
          description: 'Facts explicitly grounded in the brand profile and approved upstream modules.',
          minItems: 1,
        },
        {
          key: 'missingContextNotes',
          type: 'string_array',
          required: true,
          description: 'Information gaps or assumptions flagged for validation.',
        },
        {
          key: 'researchCaveat',
          type: 'string',
          required: true,
          description: 'Explicit caveat distinguishing AI hypotheses from verified customer research.',
        },
        {
          key: 'aiSuggestions',
          type: 'object',
          required: true,
          description: 'Segmentation rationale and recommended validation questions.',
        },
        {
          key: 'personas',
          type: 'object_array',
          required: true,
          description: 'Structured customer persona hypotheses.',
          minItems: 1,
        },
      ],
    },
    modelConfig: {
      model: 'gemini-4-hydrogen',
      temperature: 0.4,
      maxOutputTokens: 3072,
    },
    metadata: {
      createdAt: '2026-11-16T00:00:00.000Z',
      createdBy: 'brandflow-system',
      updatedAt: '2026-11-16T00:00:00.000Z',
      updatedBy: 'brandflow-system',
      changeNotes: 'Initial reconstructed active prompt for Customer Personas synthesis in Phase 2B.',
    },
  },
  {
    promptId: 'customer_audience_interests',
    name: 'Audience Interests & Purchase Drivers',
    description:
      'Reconstructed prompt that generates structured audience interest themes linked to approved Customer Personas, Brand Foundation, and Brand Messaging.',
    targetModule: 'customerIntelligence',
    version: '1.0.0',
    status: 'active',
    sourceClassification: 'reconstructed',
    systemInstructions: [
      'You are the BrandFlow AI audience intelligence strategist.',
      'Derive audience interest clusters strictly from verified brand profile facts, approved Brand Foundation, approved Brand Messaging, and approved Customer Personas from the same brand workspace.',
      'Link every interest theme directly to one or more names from approvedCustomerPersonas.',
      'Explicitly separate verified facts (suppliedFactsUsed) from AI-generated interest hypotheses (aiSuggestions and interests).',
      'Respond with valid JSON only matching the requested output schema, without markdown prose outside JSON.',
    ].join(' '),
    userPromptTemplate: [
      'Identify 2 to 5 structured Audience Interest clusters for {{brandName}} ({{industry}}) aligned to its approved Customer Personas.',
      '',
      'Verified Brand Profile:',
      '- Products or Services: {{productsOrServices}}',
      '- Target Market: {{targetMarket}}',
      '- Primary Location: {{primaryLocation}}',
      '- Marketing Challenges: {{marketingChallenges}}',
      '- Business Goals: {{businessGoals}}',
      '- Competitors: {{competitors}}',
      '- Additional Notes: {{additionalNotes}}',
      '',
      'Approved Brand Foundation:',
      '{{approvedBrandFoundation}}',
      '',
      'Approved Brand Messaging:',
      '{{approvedBrandMessaging}}',
      '',
      'Approved Customer Personas (Same Brand Only):',
      '{{approvedCustomerPersonas}}',
      '',
      'Return a single JSON object with keys:',
      '- suppliedFactsUsed (array of strings)',
      '- missingContextNotes (array of strings)',
      '- researchCaveat (string explicitly stating these interests are AI hypotheses until approved)',
      '- aiSuggestions (object with priorityThemesSummary and contentOpportunityNotes)',
      '- interests (array of 2-5 objects, each with: topic, linkedPersonaNames (array matching approved persona names), frequentQuestions (array), problemsToSolve (array), contentConsumed (array), searchTopics (array), productOrServiceInterests (array), purchaseTriggers (array), concernsOrObjections (array), seasonalOrSituationalInterests (array)).',
    ].join('\n'),
    requiredVariables: [
      'brandName',
      'industry',
      'productsOrServices',
      'targetMarket',
      'approvedBrandFoundation',
      'approvedBrandMessaging',
      'approvedCustomerPersonas',
    ],
    optionalVariables: [
      'primaryLocation',
      'marketingChallenges',
      'businessGoals',
      'competitors',
      'additionalNotes',
    ],
    expectedOutputStructure: {
      format: 'json',
      schemaName: 'CustomerAudienceInterestsOutput',
      description: 'Audience interest insights connected to approved customer personas.',
      requireGroundedFactSeparation: true,
      fields: [
        {
          key: 'suppliedFactsUsed',
          type: 'string_array',
          required: true,
          description: 'Verified inputs grounded in brand profile, foundation, messaging, and approved personas.',
          minItems: 1,
        },
        {
          key: 'missingContextNotes',
          type: 'string_array',
          required: true,
          description: 'Gaps noted where first-party audience data would strengthen accuracy.',
        },
        {
          key: 'researchCaveat',
          type: 'string',
          required: true,
          description: 'Explicit caveat that generated interest clusters are AI hypotheses.',
        },
        {
          key: 'aiSuggestions',
          type: 'object',
          required: true,
          description: 'High-level audience interest synthesis notes.',
        },
        {
          key: 'interests',
          type: 'object_array',
          required: true,
          description: 'Structured audience interest clusters linked to approved personas.',
          minItems: 2,
        },
      ],
    },
    modelConfig: {
      model: 'gemini-4-hydrogen',
      temperature: 0.4,
      maxOutputTokens: 3072,
    },
    metadata: {
      createdAt: '2026-11-16T00:00:00.000Z',
      createdBy: 'brandflow-system',
      updatedAt: '2026-11-16T00:00:00.000Z',
      updatedBy: 'brandflow-system',
      changeNotes: 'Initial reconstructed active prompt for Customer Audience Interests in Phase 2B.',
    },
  },
  {
    promptId: 'marketing_strategy_goals_objectives',
    name: 'Marketing Strategy — SMART Goals & Objectives',
    description:
      'Reconstructed prompt that generates grounded SMART marketing goals and supporting marketing objectives from verified brand context and approved upstream strategy.',
    targetModule: 'marketingStrategy',
    version: '1.0.0',
    status: 'active',
    sourceClassification: 'reconstructed',
    systemInstructions: [
      'You are the BrandFlow AI senior marketing strategist.',
      'Ground every SMART goal and marketing objective strictly in verified brand profile facts and approved Brand Foundation, Brand Messaging, Customer Personas, and Audience Interests from this exact brand workspace.',
      'NEVER invent historical performance, baseline conversion rates, revenue figures, budgets, staffing, or operational capacity.',
      'When baseline metrics, budget, or team capacity are not provided, state transparently in targetValue or missingContextNotes that a baseline or user target must be established rather than fabricating numbers.',
      'Clearly separate verified facts used (suppliedFactsUsed) from AI strategic recommendations (aiSuggestions, goals, objectives).',
      'Respond with valid JSON only matching the requested output schema, without markdown prose outside JSON.',
    ].join(' '),
    userPromptTemplate: [
      'Develop 2 to 4 SMART Marketing Goals and 3 to 5 supporting Marketing Objectives for {{brandName}} ({{industry}}, {{primaryLocation}}).',
      '',
      'Verified Brand Profile:',
      '- Business Description: {{businessDescription}}',
      '- Products or Services: {{productsOrServices}}',
      '- Target Market: {{targetMarket}}',
      '- Business Goals: {{businessGoals}}',
      '- Marketing Challenges: {{marketingChallenges}}',
      '- Competitors: {{competitors}}',
      '- User-Supplied Business Constraints & Baselines: {{businessConstraints}}',
      '- Additional Notes: {{additionalNotes}}',
      '',
      'Approved Customer Personas (Same Brand Only):',
      '{{approvedCustomerPersonas}}',
      '',
      'Approved Audience Interests (Same Brand Only):',
      '{{approvedAudienceInterests}}',
      '',
      'Also consult approvedBrandFoundation and approvedBrandMessaging provided in the verified context payload.',
      '',
      'Return a single JSON object with keys:',
      '- suppliedFactsUsed (array of strings citing exact verified inputs used)',
      '- missingContextNotes (array of strings flagging missing baselines, budget, staffing, or timeline details)',
      '- researchCaveat (string stating these goals and objectives are AI strategic recommendations requiring owner review and approval)',
      '- aiSuggestions (object with strategicFocusSummary string and inputQuestionsForOwner array of strings)',
      '- goals (array of 2-4 objects, each with: title, description, strategicRationale, targetAudience, supportingBusinessObjective, successMetrics (array of non-empty strings), targetValue (string — never fabricate unsupported revenue/conversion baselines; state "Baseline to be established" or qualitative milestone if no baseline supplied), measurementPeriod, recommendedTimeframe)',
      '- objectives (array of 3-5 objects, each with: title, description, intendedBusinessOutcome, targetAudience, supportingGoalTitle (must match one of the returned goals titles), measurementCriteria, priority ("high" | "medium" | "low")).',
    ].join('\n'),
    requiredVariables: [
      'brandName',
      'businessDescription',
      'industry',
      'productsOrServices',
      'targetMarket',
      'primaryLocation',
      'approvedBrandFoundation',
      'approvedBrandMessaging',
      'approvedCustomerPersonas',
      'approvedAudienceInterests',
    ],
    optionalVariables: [
      'websiteUrl',
      'socialLinks',
      'businessGoals',
      'marketingChallenges',
      'competitors',
      'businessConstraints',
      'additionalNotes',
    ],
    expectedOutputStructure: {
      format: 'json',
      schemaName: 'MarketingGoalsObjectivesOutput',
      description: 'SMART marketing goals and aligned marketing objectives grounded in verified upstream strategy.',
      requireGroundedFactSeparation: true,
      fields: [
        {
          key: 'suppliedFactsUsed',
          type: 'string_array',
          required: true,
          description: 'Verified inputs grounded in brand profile and approved upstream modules.',
          minItems: 1,
        },
        {
          key: 'missingContextNotes',
          type: 'string_array',
          required: true,
          description: 'Missing baseline, budget, staffing, or operational assumptions flagged transparently.',
        },
        {
          key: 'researchCaveat',
          type: 'string',
          required: true,
          description: 'Explicit caveat distinguishing AI recommendations from approved strategy.',
        },
        {
          key: 'aiSuggestions',
          type: 'object',
          required: true,
          description: 'Strategic prioritization notes and questions for owner confirmation.',
        },
        {
          key: 'goals',
          type: 'object_array',
          required: true,
          description: 'Structured SMART marketing goals.',
          minItems: 2,
        },
        {
          key: 'objectives',
          type: 'object_array',
          required: true,
          description: 'Structured marketing objectives supporting the SMART goals.',
          minItems: 2,
        },
      ],
      geminiResponseSchema: {
        type: 'OBJECT',
        properties: {
          suppliedFactsUsed: {
            type: 'ARRAY',
            items: { type: 'STRING' },
          },
          missingContextNotes: {
            type: 'ARRAY',
            items: { type: 'STRING' },
          },
          researchCaveat: { type: 'STRING' },
          aiSuggestions: {
            type: 'OBJECT',
            properties: {
              strategicFocusSummary: { type: 'STRING' },
              inputQuestionsForOwner: {
                type: 'ARRAY',
                items: { type: 'STRING' },
              },
            },
            required: ['strategicFocusSummary', 'inputQuestionsForOwner'],
          },
          goals: {
            type: 'ARRAY',
            items: {
              type: 'OBJECT',
              properties: {
                title: { type: 'STRING' },
                description: { type: 'STRING' },
                strategicRationale: { type: 'STRING' },
                targetAudience: { type: 'STRING' },
                supportingBusinessObjective: { type: 'STRING' },
                successMetrics: {
                  type: 'ARRAY',
                  items: { type: 'STRING' },
                },
                targetValue: { type: 'STRING' },
                measurementPeriod: { type: 'STRING' },
                recommendedTimeframe: { type: 'STRING' },
              },
              required: [
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
            },
          },
          objectives: {
            type: 'ARRAY',
            items: {
              type: 'OBJECT',
              properties: {
                title: { type: 'STRING' },
                description: { type: 'STRING' },
                intendedBusinessOutcome: { type: 'STRING' },
                targetAudience: { type: 'STRING' },
                supportingGoalTitle: { type: 'STRING' },
                measurementCriteria: { type: 'STRING' },
                priority: { type: 'STRING', enum: ['high', 'medium', 'low'] },
              },
              required: [
                'title',
                'description',
                'intendedBusinessOutcome',
                'targetAudience',
                'supportingGoalTitle',
                'measurementCriteria',
                'priority',
              ],
            },
          },
        },
        required: [
          'suppliedFactsUsed',
          'missingContextNotes',
          'researchCaveat',
          'aiSuggestions',
          'goals',
          'objectives',
        ],
      },
    },
    modelConfig: {
      model: 'gemini-4-hydrogen',
      temperature: 0.35,
      maxOutputTokens: 3072,
    },
    metadata: {
      createdAt: '2026-11-18T00:00:00.000Z',
      createdBy: 'brandflow-system',
      updatedAt: '2026-11-18T00:00:00.000Z',
      updatedBy: 'brandflow-system',
      changeNotes: 'Initial reconstructed active prompt for Marketing Strategy SMART Goals & Objectives in Phase 2B.',
    },
  },
  {
    promptId: 'marketing_strategy_channels_tactics',
    name: 'Marketing Strategy — Channels & Execution Tactics',
    description:
      'Reconstructed prompt that recommends justified marketing channels and specific, execution-ready tactics grounded in approved goals, objectives, personas, and audience interests.',
    targetModule: 'marketingStrategy',
    version: '1.0.0',
    status: 'active',
    sourceClassification: 'reconstructed',
    systemInstructions: [
      'You are the BrandFlow AI senior marketing channel and growth strategist.',
      'Recommend marketing channels ONLY when justified by approved Customer Personas, Audience Interests, Brand Foundation, Brand Messaging, and approved Marketing Goals & Objectives — never pick generic channels based solely on popularity.',
      'Every tactic MUST be concrete and execution-ready (specific format, audience, message angle, execution steps, cadence, and success metric). Avoid vague clichés such as "post consistently on social media" or "do SEO".',
      'NEVER invent ad budgets, historical ROAS, staffing headcount, or guaranteed conversion rates.',
      'Clearly separate supplied facts used (suppliedFactsUsed) from AI recommendations (aiSuggestions, channels, tactics).',
      'Respond with valid JSON only matching the requested output schema, without markdown prose outside JSON.',
    ].join(' '),
    userPromptTemplate: [
      'Recommend 3 to 5 prioritized Marketing Channels and 4 to 6 specific Marketing Tactics for {{brandName}} ({{industry}}, {{primaryLocation}}).',
      '',
      'Verified Brand Context:',
      '- Products or Services: {{productsOrServices}}',
      '- Target Market: {{targetMarket}}',
      '- Marketing Challenges: {{marketingChallenges}}',
      '- Competitors: {{competitors}}',
      '- User-Supplied Business Constraints: {{businessConstraints}}',
      '- Additional Notes: {{additionalNotes}}',
      '',
      'Approved Marketing Goals (Same Brand Only):',
      '{{approvedMarketingGoals}}',
      '',
      'Approved Marketing Objectives (Same Brand Only):',
      '{{approvedMarketingObjectives}}',
      '',
      'Approved Customer Personas (Same Brand Only):',
      '{{approvedCustomerPersonas}}',
      '',
      'Approved Audience Interests (Same Brand Only):',
      '{{approvedAudienceInterests}}',
      '',
      'Also consult approvedBrandFoundation and approvedBrandMessaging provided in the verified context payload.',
      '',
      'Return a single JSON object with keys:',
      '- suppliedFactsUsed (array of strings)',
      '- missingContextNotes (array of strings flagging missing budget, channel access, or staffing inputs)',
      '- researchCaveat (string stating these channels and tactics are AI recommendations requiring owner approval)',
      '- aiSuggestions (object with channelMixRationale string and tradeOffNotes array of strings)',
      '- channels (array of 3-5 objects, each with: channelName, strategicRationale, relevantAudience, recommendedUse, expectedContribution, priority ("primary" | "secondary" | "experimental"), supportingObjectiveTitle)',
      '- tactics (array of 4-6 objects, each with: tacticName, description, supportingObjectiveTitle, recommendedChannelName (must match a channelName above), targetAudience, executionGuidance (concrete step-by-step execution direction), suggestedFrequency, successMetric, priority ("high" | "medium" | "low")).',
    ].join('\n'),
    requiredVariables: [
      'brandName',
      'industry',
      'productsOrServices',
      'targetMarket',
      'approvedBrandFoundation',
      'approvedBrandMessaging',
      'approvedCustomerPersonas',
      'approvedAudienceInterests',
      'approvedMarketingGoals',
      'approvedMarketingObjectives',
    ],
    optionalVariables: [
      'primaryLocation',
      'websiteUrl',
      'socialLinks',
      'marketingChallenges',
      'competitors',
      'businessConstraints',
      'additionalNotes',
    ],
    expectedOutputStructure: {
      format: 'json',
      schemaName: 'MarketingChannelsTacticsOutput',
      description: 'Evidence-based channel selections and specific execution-ready tactics linked to approved objectives.',
      requireGroundedFactSeparation: true,
      fields: [
        {
          key: 'suppliedFactsUsed',
          type: 'string_array',
          required: true,
          description: 'Verified inputs grounded in approved strategy and personas.',
          minItems: 1,
        },
        {
          key: 'missingContextNotes',
          type: 'string_array',
          required: true,
          description: 'Budget, staffing, or channel-access gaps flagged transparently.',
        },
        {
          key: 'researchCaveat',
          type: 'string',
          required: true,
          description: 'Explicit caveat distinguishing AI recommendations from approved decisions.',
        },
        {
          key: 'aiSuggestions',
          type: 'object',
          required: true,
          description: 'Channel mix prioritization rationale and trade-off notes.',
        },
        {
          key: 'channels',
          type: 'object_array',
          required: true,
          description: 'Justified marketing channels linked to approved objectives.',
          minItems: 2,
        },
        {
          key: 'tactics',
          type: 'object_array',
          required: true,
          description: 'Specific, execution-ready marketing tactics linked to objectives and channels.',
          minItems: 2,
        },
      ],
      geminiResponseSchema: {
        type: 'OBJECT',
        properties: {
          suppliedFactsUsed: {
            type: 'ARRAY',
            items: { type: 'STRING' },
            description: 'Non-empty strings citing verified brand facts and approved upstream inputs used.',
          },
          missingContextNotes: {
            type: 'ARRAY',
            items: { type: 'STRING' },
            description: 'Non-empty strings flagging missing budget, channel access, or staffing context.',
          },
          researchCaveat: {
            type: 'STRING',
            description: 'Explicit caveat stating these channels and tactics are AI recommendations requiring owner approval.',
          },
          aiSuggestions: {
            type: 'OBJECT',
            properties: {
              channelMixRationale: {
                type: 'STRING',
                description: 'Concise rationale explaining how the recommended channel mix fits the approved objectives and personas.',
              },
              tradeOffNotes: {
                type: 'ARRAY',
                items: { type: 'STRING' },
                description: 'Key trade-offs, capacity considerations, or exclusions noted for the brand owner.',
              },
            },
            required: ['channelMixRationale', 'tradeOffNotes'],
          },
          channels: {
            type: 'ARRAY',
            items: {
              type: 'OBJECT',
              properties: {
                channelName: { type: 'STRING' },
                strategicRationale: { type: 'STRING' },
                relevantAudience: { type: 'STRING' },
                recommendedUse: { type: 'STRING' },
                expectedContribution: { type: 'STRING' },
                priority: { type: 'STRING', enum: ['primary', 'secondary', 'experimental'] },
                supportingObjectiveTitle: { type: 'STRING' },
              },
              required: [
                'channelName',
                'strategicRationale',
                'relevantAudience',
                'recommendedUse',
                'expectedContribution',
                'priority',
                'supportingObjectiveTitle',
              ],
            },
          },
          tactics: {
            type: 'ARRAY',
            items: {
              type: 'OBJECT',
              properties: {
                tacticName: { type: 'STRING' },
                description: { type: 'STRING' },
                supportingObjectiveTitle: { type: 'STRING' },
                recommendedChannelName: { type: 'STRING' },
                targetAudience: { type: 'STRING' },
                executionGuidance: { type: 'STRING' },
                suggestedFrequency: { type: 'STRING' },
                successMetric: { type: 'STRING' },
                priority: { type: 'STRING', enum: ['high', 'medium', 'low'] },
              },
              required: [
                'tacticName',
                'description',
                'supportingObjectiveTitle',
                'recommendedChannelName',
                'targetAudience',
                'executionGuidance',
                'suggestedFrequency',
                'successMetric',
                'priority',
              ],
            },
          },
        },
        required: [
          'suppliedFactsUsed',
          'missingContextNotes',
          'researchCaveat',
          'aiSuggestions',
          'channels',
          'tactics',
        ],
      },
    },
    modelConfig: {
      model: 'gemini-4-hydrogen',
      temperature: 0.4,
      maxOutputTokens: 3072,
    },
    metadata: {
      createdAt: '2026-11-18T00:00:00.000Z',
      createdBy: 'brandflow-system',
      updatedAt: '2026-11-18T00:00:00.000Z',
      updatedBy: 'brandflow-system',
      changeNotes: 'Initial reconstructed active prompt for Marketing Strategy Channels & Tactics in Phase 2B.',
    },
  },
  {
    promptId: 'marketing_strategy_kpis',
    name: 'Marketing Strategy — KPIs & Measurement Framework',
    description:
      'Reconstructed prompt that defines leading and lagging KPIs, measurement methods, and reporting cadences aligned to approved objectives, channels, and tactics without fabricating baselines.',
    targetModule: 'marketingStrategy',
    version: '1.0.0',
    status: 'active',
    sourceClassification: 'reconstructed',
    systemInstructions: [
      'You are the BrandFlow AI marketing analytics and measurement strategist.',
      'Define clear, decision-useful leading and lagging KPIs directly tied to the brand’s approved Marketing Objectives, Channels, and Tactics.',
      'NEVER invent historical baselines, current traffic/conversion numbers, or guaranteed performance projections. Where baseline performance is not supplied, state explicitly in baselineNote that a baseline must be captured first.',
      'Clearly separate supplied verified facts (suppliedFactsUsed) from AI measurement recommendations (aiSuggestions and kpis).',
      'Respond with valid JSON only matching the requested output schema, without markdown prose outside JSON.',
    ].join(' '),
    userPromptTemplate: [
      'Design a structured KPI & Measurement Framework (4 to 7 KPIs balancing leading and lagging indicators) for {{brandName}} ({{industry}}).',
      '',
      'Verified Brand Context:',
      '- Products or Services: {{productsOrServices}}',
      '- Target Market: {{targetMarket}}',
      '- Business Goals: {{businessGoals}}',
      '- Marketing Challenges: {{marketingChallenges}}',
      '- User-Supplied Business Constraints & Baselines: {{businessConstraints}}',
      '- Additional Notes: {{additionalNotes}}',
      '',
      'Approved Marketing Goals:',
      '{{approvedMarketingGoals}}',
      '',
      'Approved Marketing Objectives:',
      '{{approvedMarketingObjectives}}',
      '',
      'Approved Marketing Channels:',
      '{{approvedMarketingChannels}}',
      '',
      'Approved Marketing Tactics:',
      '{{approvedMarketingTactics}}',
      '',
      'Return a single JSON object with keys:',
      '- suppliedFactsUsed (array of strings)',
      '- missingContextNotes (array of strings noting missing analytics tooling or baseline data)',
      '- researchCaveat (string stating these KPIs are AI measurement recommendations and do not assume unverified baselines)',
      '- aiSuggestions (object with measurementGovernanceNote string and instrumentationChecklist array of strings)',
      '- kpis (array of 4-7 objects, each with: kpiName, description, whatItMeasures, relatedObjectiveTitle (must match an approved objective title), measurementMethod, reportingFrequency, classification ("leading" | "lagging"), baselineNote (string clearly indicating if baseline needs to be established)).',
    ].join('\n'),
    requiredVariables: [
      'brandName',
      'industry',
      'productsOrServices',
      'targetMarket',
      'approvedBrandFoundation',
      'approvedBrandMessaging',
      'approvedCustomerPersonas',
      'approvedAudienceInterests',
      'approvedMarketingGoals',
      'approvedMarketingObjectives',
      'approvedMarketingChannels',
      'approvedMarketingTactics',
    ],
    optionalVariables: [
      'primaryLocation',
      'businessGoals',
      'marketingChallenges',
      'businessConstraints',
      'additionalNotes',
    ],
    expectedOutputStructure: {
      format: 'json',
      schemaName: 'MarketingKpisOutput',
      description: 'Leading and lagging KPIs with measurement methods and explicit baseline-establishment notes.',
      requireGroundedFactSeparation: true,
      fields: [
        {
          key: 'suppliedFactsUsed',
          type: 'string_array',
          required: true,
          description: 'Verified inputs grounded in approved goals, objectives, channels, and tactics.',
          minItems: 1,
        },
        {
          key: 'missingContextNotes',
          type: 'string_array',
          required: true,
          description: 'Analytics or baseline gaps transparently flagged.',
        },
        {
          key: 'researchCaveat',
          type: 'string',
          required: true,
          description: 'Explicit caveat distinguishing AI measurement proposals from baseline facts.',
        },
        {
          key: 'aiSuggestions',
          type: 'object',
          required: true,
          description: 'Measurement governance guidance and instrumentation checklist.',
        },
        {
          key: 'kpis',
          type: 'object_array',
          required: true,
          description: 'Structured leading and lagging KPIs.',
          minItems: 2,
        },
      ],
      geminiResponseSchema: {
        type: 'OBJECT',
        properties: {
          suppliedFactsUsed: {
            type: 'ARRAY',
            items: { type: 'STRING' },
          },
          missingContextNotes: {
            type: 'ARRAY',
            items: { type: 'STRING' },
          },
          researchCaveat: { type: 'STRING' },
          aiSuggestions: {
            type: 'OBJECT',
            properties: {
              measurementGovernanceNote: { type: 'STRING' },
              instrumentationChecklist: {
                type: 'ARRAY',
                items: { type: 'STRING' },
              },
            },
            required: ['measurementGovernanceNote', 'instrumentationChecklist'],
          },
          kpis: {
            type: 'ARRAY',
            items: {
              type: 'OBJECT',
              properties: {
                kpiName: { type: 'STRING' },
                description: { type: 'STRING' },
                whatItMeasures: { type: 'STRING' },
                relatedObjectiveTitle: { type: 'STRING' },
                measurementMethod: { type: 'STRING' },
                reportingFrequency: { type: 'STRING' },
                classification: { type: 'STRING', enum: ['leading', 'lagging'] },
                baselineNote: { type: 'STRING' },
              },
              required: [
                'kpiName',
                'description',
                'whatItMeasures',
                'relatedObjectiveTitle',
                'measurementMethod',
                'reportingFrequency',
                'classification',
                'baselineNote',
              ],
            },
          },
        },
        required: [
          'suppliedFactsUsed',
          'missingContextNotes',
          'researchCaveat',
          'aiSuggestions',
          'kpis',
        ],
      },
    },
    modelConfig: {
      model: 'gemini-4-hydrogen',
      temperature: 0.3,
      maxOutputTokens: 2560,
    },
    metadata: {
      createdAt: '2026-11-18T00:00:00.000Z',
      createdBy: 'brandflow-system',
      updatedAt: '2026-11-18T00:00:00.000Z',
      updatedBy: 'brandflow-system',
      changeNotes: 'Initial reconstructed active prompt for Marketing Strategy KPIs & Measurement in Phase 2B.',
    },
  },
  {
    promptId: 'marketing_strategy_roadmap',
    name: 'Marketing Strategy — Implementation Roadmap',
    description:
      'Reconstructed prompt that sequences approved marketing objectives, channels, and tactics into a phased implementation roadmap without inventing budgets, staffing, or unsupported deadlines.',
    targetModule: 'marketingStrategy',
    version: '1.0.0',
    status: 'active',
    sourceClassification: 'reconstructed',
    systemInstructions: [
      'You are the BrandFlow AI marketing operations and implementation strategist.',
      'Organize the brand’s approved Marketing Objectives, Channels, and Tactics into a practical, sequenced phased roadmap (e.g., Phase 1: Foundation & Setup, Phase 2: Initial Launch & Validation, Phase 3: Optimization & Scale).',
      'NEVER invent budgets, staffing headcount, or arbitrary calendar deadlines not supported by user input. Use relative timeframes (e.g., "Weeks 1–4" or "Phase 1 — contingent on owner capacity") and flag decisions requiring owner confirmation in decisionInputNeeded.',
      'Clearly separate verified supplied facts (suppliedFactsUsed) from AI roadmap recommendations (aiSuggestions and roadmapItems).',
      'Respond with valid JSON only matching the requested output schema, without markdown prose outside JSON.',
    ].join(' '),
    userPromptTemplate: [
      'Create a phased Implementation Roadmap (5 to 8 sequenced activities across 3 phases) for {{brandName}} ({{industry}}).',
      '',
      'Verified Brand Context:',
      '- Products or Services: {{productsOrServices}}',
      '- Target Market: {{targetMarket}}',
      '- Marketing Challenges: {{marketingChallenges}}',
      '- User-Supplied Business Constraints & Timeline: {{businessConstraints}}',
      '- Additional Notes: {{additionalNotes}}',
      '',
      'Approved Marketing Goals:',
      '{{approvedMarketingGoals}}',
      '',
      'Approved Marketing Objectives:',
      '{{approvedMarketingObjectives}}',
      '',
      'Approved Marketing Channels:',
      '{{approvedMarketingChannels}}',
      '',
      'Approved Marketing Tactics:',
      '{{approvedMarketingTactics}}',
      '',
      'Return a single JSON object with keys:',
      '- suppliedFactsUsed (array of strings)',
      '- missingContextNotes (array of strings noting budget, resourcing, or scheduling decisions needed)',
      '- researchCaveat (string stating this roadmap is an AI sequencing proposal pending owner capacity confirmation)',
      '- aiSuggestions (object with sequencingRationale string and keyRisksToConfirm array of strings)',
      '- roadmapItems (array of 5-8 objects, each with: phase (e.g. "Phase 1: Foundation & Setup", "Phase 2: Launch & Validation", "Phase 3: Optimization & Scale"), activity, description, supportingObjectiveTitle, channel, priority ("high" | "medium" | "low"), suggestedTimeframe (relative timeframe only unless user supplied dates), dependencies (array of strings), successIndicator, decisionInputNeeded (string flagging budget/staffing/approval input needed from owner, or empty string if none)).',
    ].join('\n'),
    requiredVariables: [
      'brandName',
      'industry',
      'productsOrServices',
      'targetMarket',
      'approvedBrandFoundation',
      'approvedBrandMessaging',
      'approvedCustomerPersonas',
      'approvedAudienceInterests',
      'approvedMarketingGoals',
      'approvedMarketingObjectives',
      'approvedMarketingChannels',
      'approvedMarketingTactics',
    ],
    optionalVariables: [
      'primaryLocation',
      'marketingChallenges',
      'businessConstraints',
      'additionalNotes',
    ],
    expectedOutputStructure: {
      format: 'json',
      schemaName: 'MarketingRoadmapOutput',
      description: 'Phased implementation roadmap with dependencies, success indicators, and explicit owner decision flags.',
      requireGroundedFactSeparation: true,
      fields: [
        {
          key: 'suppliedFactsUsed',
          type: 'string_array',
          required: true,
          description: 'Verified inputs grounded in approved strategy.',
          minItems: 1,
        },
        {
          key: 'missingContextNotes',
          type: 'string_array',
          required: true,
          description: 'Budget, staffing, and scheduling assumptions flagged for user confirmation.',
        },
        {
          key: 'researchCaveat',
          type: 'string',
          required: true,
          description: 'Explicit caveat distinguishing AI sequencing from committed schedules.',
        },
        {
          key: 'aiSuggestions',
          type: 'object',
          required: true,
          description: 'Sequencing rationale and operational risks to confirm.',
        },
        {
          key: 'roadmapItems',
          type: 'object_array',
          required: true,
          description: 'Phased implementation roadmap activities.',
          minItems: 3,
        },
      ],
      geminiResponseSchema: {
        type: 'OBJECT',
        properties: {
          suppliedFactsUsed: {
            type: 'ARRAY',
            items: { type: 'STRING' },
          },
          missingContextNotes: {
            type: 'ARRAY',
            items: { type: 'STRING' },
          },
          researchCaveat: { type: 'STRING' },
          aiSuggestions: {
            type: 'OBJECT',
            properties: {
              sequencingRationale: { type: 'STRING' },
              keyRisksToConfirm: {
                type: 'ARRAY',
                items: { type: 'STRING' },
              },
            },
            required: ['sequencingRationale', 'keyRisksToConfirm'],
          },
          roadmapItems: {
            type: 'ARRAY',
            items: {
              type: 'OBJECT',
              properties: {
                phase: { type: 'STRING' },
                activity: { type: 'STRING' },
                description: { type: 'STRING' },
                supportingObjectiveTitle: { type: 'STRING' },
                channel: { type: 'STRING' },
                priority: { type: 'STRING', enum: ['high', 'medium', 'low'] },
                suggestedTimeframe: { type: 'STRING' },
                dependencies: {
                  type: 'ARRAY',
                  items: { type: 'STRING' },
                },
                successIndicator: { type: 'STRING' },
                decisionInputNeeded: { type: 'STRING' },
              },
              required: [
                'phase',
                'activity',
                'description',
                'supportingObjectiveTitle',
                'channel',
                'priority',
                'suggestedTimeframe',
                'dependencies',
                'successIndicator',
                'decisionInputNeeded',
              ],
            },
          },
        },
        required: [
          'suppliedFactsUsed',
          'missingContextNotes',
          'researchCaveat',
          'aiSuggestions',
          'roadmapItems',
        ],
      },
    },
    modelConfig: {
      model: 'gemini-4-hydrogen',
      temperature: 0.35,
      maxOutputTokens: 2800,
    },
    metadata: {
      createdAt: '2026-11-18T00:00:00.000Z',
      createdBy: 'brandflow-system',
      updatedAt: '2026-11-18T00:00:00.000Z',
      updatedBy: 'brandflow-system',
      changeNotes: 'Initial reconstructed active prompt for Marketing Strategy Implementation Roadmap in Phase 2B.',
    },
  },
];

export const DEFAULT_PROMPT_REGISTRY: PromptRegistry = createPromptRegistry(
  DEFAULT_PROMPT_DEFINITIONS,
);

export function getPromptById(
  promptId: string,
  registry: PromptRegistry = DEFAULT_PROMPT_REGISTRY,
): PromptRecord | undefined {
  return registry.recordsById.get(promptId.trim());
}

export function getPromptVersion(
  promptId: string,
  version: string,
  registry: PromptRegistry = DEFAULT_PROMPT_REGISTRY,
): PromptDefinition | undefined {
  return registry.versionsByKey.get(makeVersionKey(promptId.trim(), version.trim()));
}

export function listPromptVersions(
  promptId: string,
  registry: PromptRegistry = DEFAULT_PROMPT_REGISTRY,
): readonly PromptDefinition[] {
  return registry.recordsById.get(promptId.trim())?.versions ?? [];
}

export function listPrompts(
  filter?: {
    targetModule?: BrandModuleKey;
    status?: PromptStatus;
    sourceClassification?: PromptSourceClassification;
  },
  registry: PromptRegistry = DEFAULT_PROMPT_REGISTRY,
): readonly PromptDefinition[] {
  return registry.allDefinitions.filter((def) => {
    if (filter?.targetModule && def.targetModule !== filter.targetModule) return false;
    if (filter?.status && def.status !== filter.status) return false;
    if (
      filter?.sourceClassification &&
      def.sourceClassification !== filter.sourceClassification
    ) {
      return false;
    }
    return true;
  });
}

export function resolveActivePromptVersion(
  promptId: string,
  registry: PromptRegistry = DEFAULT_PROMPT_REGISTRY,
): PromptDefinition {
  const normalizedId = promptId.trim();
  const record = registry.recordsById.get(normalizedId);
  if (!record) {
    throw new PromptNotFoundError(`Prompt "${normalizedId}" is not registered.`);
  }
  if (!record.activeVersion) {
    const statuses = record.versions.map((v) => `${v.version} (${v.status})`).join(', ');
    throw new PromptStatusError(
      `Prompt "${normalizedId}" has no active published version available for execution. Available versions: ${statuses}.`,
    );
  }
  return record.activeVersion;
}

export function resolveExecutablePrompt(
  promptId: string,
  requestedVersion?: string,
  registry: PromptRegistry = DEFAULT_PROMPT_REGISTRY,
): PromptDefinition {
  const normalizedId = promptId.trim();
  if (!requestedVersion || !requestedVersion.trim()) {
    return resolveActivePromptVersion(normalizedId, registry);
  }

  const normalizedVersion = requestedVersion.trim();
  const record = registry.recordsById.get(normalizedId);
  if (!record) {
    throw new PromptNotFoundError(`Prompt "${normalizedId}" is not registered.`);
  }

  const candidate = registry.versionsByKey.get(makeVersionKey(normalizedId, normalizedVersion));
  if (!candidate) {
    throw new PromptNotFoundError(
      `Prompt "${normalizedId}" version "${normalizedVersion}" does not exist.`,
    );
  }

  if (candidate.status === 'draft') {
    throw new PromptStatusError(
      `Prompt "${normalizedId}@${normalizedVersion}" is a draft and cannot be executed.`,
    );
  }

  if (candidate.status === 'deprecated') {
    throw new PromptStatusError(
      `Prompt "${normalizedId}@${normalizedVersion}" is deprecated and cannot be selected for new executions.`,
    );
  }

  return candidate;
}
