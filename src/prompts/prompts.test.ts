import test from 'node:test';
import assert from 'node:assert/strict';
import type { Brand, BrandStrategyModule } from '../types/brand.ts';
import { parsePromptExecutionResponse } from '../services/promptResponseParser.ts';
import { optimizeContentStrategyPromptVariables } from './contentContextBudget.ts';
import {
  CONTENT_CALENDAR_PROMPT_TARGET_BUDGET,
  optimizeContentCalendarPromptVariables,
} from './calendarContextBudget.ts';
import {
  CONTENT_STUDIO_PROMPT_TARGET_BUDGET,
  optimizeContentStudioPromptVariables,
} from './studioContextBudget.ts';
import {
  BrandContextIsolationError,
  DEFAULT_PROMPT_DEFINITIONS,
  DEFAULT_PROMPT_REGISTRY,
  ENGINE_MAX_CONTEXT_LENGTH,
  ENGINE_MAX_PROMPT_LENGTH,
  PromptNotFoundError,
  PromptRegistryError,
  PromptStatusError,
  buildPromptVariableMap,
  buildStrategyModuleUpsertInput,
  buildVerifiedBrandContext,
  compactApprovedList,
  compilePromptTemplate,
  createPromptRegistry,
  executePrompt,
  getPromptById,
  getPromptVersion,
  listPromptVersions,
  listPrompts,
  parseStructuredJsonResponse,
  registerPromptVersion,
  resolveActivePromptVersion,
  resolveExecutablePrompt,
  validateRequiredVariables,
  validateStructuredOutput,
  type PromptDefinition,
} from './index.ts';

function makeBrand(overrides: Partial<Brand> = {}): Brand {
  return {
    id: 'brand-alpha-1',
    userId: 'owner-1',
    brandName: 'Solstice Health',
    businessDescription: 'Preventive biomarker diagnostics and personalized longevity plans.',
    industry: 'Health & Wellness',
    productsOrServices: 'Quarterly biomarker panels and clinician-led coaching',
    targetMarket: 'Proactive adults ages 30 to 55',
    primaryLocation: 'Austin, TX',
    websiteUrl: 'https://solstice.example.com',
    socialLinks: '',
    existingMission: 'Make preventive health actionable.',
    existingVision: '',
    marketingChallenges: 'Building clinical trust online.',
    businessGoals: 'Grow annual memberships.',
    competitors: 'Generic telehealth clinics',
    additionalNotes: '',
    moduleStatuses: {
      brandFoundation: 'not_started',
      brandMessaging: 'not_started',
      customerIntelligence: 'not_started',
      marketingStrategy: 'not_started',
      contentStrategy: 'not_started',
      contentCalendar: 'not_started',
      contentStudio: 'not_started',
    },
    contentPiecesCount: 0,
    pendingApprovalsCount: 0,
    createdAt: '2026-11-15T00:00:00.000Z',
    updatedAt: '2026-11-15T00:00:00.000Z',
    lastAccessedAt: '2026-11-15T00:00:00.000Z',
    ...overrides,
  };
}

function makeStrategyModule(
  overrides: Partial<BrandStrategyModule> = {},
): BrandStrategyModule {
  return {
    id: 'mod-alpha-foundation',
    userId: 'owner-1',
    brandId: 'brand-alpha-1',
    moduleKey: 'brandFoundation',
    status: 'completed',
    content: {
      purpose: 'Empower preventive longevity decisions.',
      positioningStatement: 'Clinician-guided preventive diagnostics.',
    },
    promptId: 'brand_foundation_synthesis',
    promptVersion: '1.0.0',
    model: 'gemini-4-hydrogen',
    generatedAt: '2026-11-15T01:00:00.000Z',
    createdAt: '2026-11-15T01:00:00.000Z',
    updatedAt: '2026-11-15T01:00:00.000Z',
    ...overrides,
  };
}

function makeCustomPrompt(overrides: Partial<PromptDefinition> = {}): PromptDefinition {
  return {
    promptId: 'custom_test_prompt',
    name: 'Custom Test Prompt',
    description: 'Unit test prompt definition.',
    targetModule: 'brandFoundation',
    version: '1.0.0',
    status: 'active',
    sourceClassification: 'reconstructed',
    systemInstructions: 'Return strictly grounded JSON.',
    userPromptTemplate: 'Brand: {{brandName}} in {{industry}}. Extra: {{optionalNote}}.',
    requiredVariables: ['brandName', 'industry'],
    optionalVariables: ['optionalNote'],
    expectedOutputStructure: {
      format: 'json',
      schemaName: 'TestOutput',
      description: 'Test JSON schema',
      requireGroundedFactSeparation: true,
      fields: [
        {
          key: 'suppliedFactsUsed',
          type: 'string_array',
          required: true,
          description: 'Facts used',
          minItems: 1,
        },
        {
          key: 'aiSuggestions',
          type: 'object',
          required: true,
          description: 'AI recommendations',
        },
        {
          key: 'summary',
          type: 'string',
          required: true,
          description: 'Summary text',
        },
      ],
    },
    modelConfig: {
      model: 'gemini-4-hydrogen',
      temperature: 0.3,
    },
    metadata: {
      createdAt: '2026-11-15T00:00:00.000Z',
      createdBy: 'test-suite',
      updatedAt: '2026-11-15T00:00:00.000Z',
      updatedBy: 'test-suite',
    },
    ...overrides,
  };
}

test('default registry registers original slots safely as draft and reconstructed prompts as active', () => {
  const promptIds = Array.from(DEFAULT_PROMPT_REGISTRY.recordsById.keys());
  assert.equal(new Set(promptIds).size, promptIds.length);
  assert.equal(promptIds.includes('brand_foundation_core_values_discovery'), true);
  assert.equal(promptIds.includes('brand_foundation_core_values_refinement'), true);
  assert.equal(promptIds.includes('brand_messaging_options'), true);
  assert.equal(promptIds.includes('brand_foundation_synthesis'), true);
  assert.equal(promptIds.includes('brand_messaging_framework'), true);

  const originals = listPrompts({ sourceClassification: 'original' });
  assert.equal(originals.length, 3);
  for (const original of originals) {
    assert.equal(original.status, 'draft');
    assert.equal(original.originalContentStatus, 'missing_from_workspace');
    assert.equal(original.systemInstructions, '');
    assert.equal(original.userPromptTemplate, '');
  }

  const reconstructed = listPrompts({ sourceClassification: 'reconstructed' });
  assert.equal(reconstructed.length, 17);
  for (const item of reconstructed) {
    assert.equal(item.status, 'active');
  }
  assert.equal(promptIds.includes('customer_personas_synthesis'), true);
  assert.equal(promptIds.includes('customer_audience_interests'), true);
  assert.equal(promptIds.includes('marketing_strategy_goals_objectives'), true);
  assert.equal(promptIds.includes('marketing_strategy_channels_tactics'), true);
  assert.equal(promptIds.includes('marketing_strategy_kpis'), true);
  assert.equal(promptIds.includes('marketing_strategy_roadmap'), true);
  assert.equal(promptIds.includes('content_strategy_objectives'), true);
  assert.equal(promptIds.includes('content_strategy_pillars'), true);
  assert.equal(promptIds.includes('content_strategy_themes'), true);
  assert.equal(promptIds.includes('content_strategy_formats'), true);
  assert.equal(promptIds.includes('content_strategy_distribution'), true);
  assert.equal(promptIds.includes('content_strategy_governance'), true);
  assert.equal(promptIds.includes('content_calendar_weekly_batch'), true);
  assert.equal(promptIds.includes('content_studio_generate_asset'), true);
  assert.equal(promptIds.includes('content_studio_refine_asset'), true);
});

test('registry rejects duplicate versions, multiple active versions, missing-original active status, and undeclared template vars', () => {
  const v1 = makeCustomPrompt({ version: '1.0.0', status: 'active' });
  assert.throws(
    () => createPromptRegistry([v1, makeCustomPrompt({ version: '1.0.0', status: 'deprecated' })]),
    PromptRegistryError,
  );

  assert.throws(
    () => createPromptRegistry([v1, makeCustomPrompt({ version: '1.1.0', status: 'active' })]),
    PromptRegistryError,
  );

  assert.throws(
    () =>
      createPromptRegistry([
        makeCustomPrompt({
          sourceClassification: 'original',
          originalContentStatus: 'missing_from_workspace',
          status: 'active',
        }),
      ]),
    PromptRegistryError,
  );

  assert.throws(
    () =>
      createPromptRegistry([
        makeCustomPrompt({
          userPromptTemplate: 'Hello {{undeclaredVariable}}',
        }),
      ]),
    PromptRegistryError,
  );
});

test('immutable prompt versioning supports historical retrieval, active resolution, and refuses overwrites', () => {
  const v1Deprecated = makeCustomPrompt({
    version: '1.0.0',
    status: 'deprecated',
    userPromptTemplate: 'Legacy template for {{brandName}} ({{industry}}): {{optionalNote}}',
  });
  const v2Active = makeCustomPrompt({
    version: '2.0.0',
    status: 'active',
    userPromptTemplate: 'Active v2 template for {{brandName}} ({{industry}}): {{optionalNote}}',
  });
  const v3Draft = makeCustomPrompt({
    version: '3.0.0-draft',
    status: 'draft',
    userPromptTemplate: 'Draft v3 template for {{brandName}} ({{industry}}): {{optionalNote}}',
  });

  const registry = createPromptRegistry([v1Deprecated, v2Active, v3Draft]);

  const record = getPromptById('custom_test_prompt', registry);
  assert.ok(record);
  assert.equal(record.versions.length, 3);
  assert.equal(record.activeVersion?.version, '2.0.0');

  const historical = getPromptVersion('custom_test_prompt', '1.0.0', registry);
  assert.equal(historical?.status, 'deprecated');
  assert.match(historical?.userPromptTemplate ?? '', /Legacy template/);

  const active = resolveActivePromptVersion('custom_test_prompt', registry);
  assert.equal(active.version, '2.0.0');
  assert.equal(Object.isFrozen(active), true);

  assert.equal(listPromptVersions('custom_test_prompt', registry).length, 3);

  assert.throws(
    () =>
      registerPromptVersion(
        registry,
        makeCustomPrompt({ version: '2.0.0', status: 'active' }),
      ),
    PromptRegistryError,
  );

  const v2Deprecated = makeCustomPrompt({ version: '2.1.0', status: 'deprecated' });
  const updatedRegistry = registerPromptVersion(registry, v2Deprecated);
  assert.equal(listPromptVersions('custom_test_prompt', updatedRegistry).length, 4);
  assert.equal(listPromptVersions('custom_test_prompt', registry).length, 3);
});

test('draft and deprecated prompts cannot be selected or executed', async () => {
  const registry = createPromptRegistry([
    ...DEFAULT_PROMPT_DEFINITIONS,
    makeCustomPrompt({
      promptId: 'deprecated_only_prompt',
      version: '1.0.0',
      status: 'deprecated',
    }),
  ]);

  assert.throws(
    () => resolveActivePromptVersion('brand_foundation_core_values_discovery', registry),
    PromptStatusError,
  );
  assert.throws(
    () => resolveExecutablePrompt('brand_foundation_core_values_discovery', '1.0.0-draft', registry),
    PromptStatusError,
  );
  assert.throws(
    () => resolveActivePromptVersion('deprecated_only_prompt', registry),
    PromptStatusError,
  );
  assert.throws(
    () => resolveExecutablePrompt('deprecated_only_prompt', '1.0.0', registry),
    PromptStatusError,
  );
  assert.throws(() => resolveActivePromptVersion('non_existent_prompt'), PromptNotFoundError);

  let executorCalled = false;
  await assert.rejects(
    () =>
      executePrompt({
        promptId: 'brand_foundation_core_values_discovery',
        brandId: 'brand-alpha-1',
        brand: makeBrand(),
        registry,
        executeAi: async () => {
          executorCalled = true;
          return { text: '{}', model: 'gemini-4-hydrogen', generatedAt: '2026-11-15T00:00:00.000Z' };
        },
      }),
    PromptStatusError,
  );
  assert.equal(executorCalled, false);
});

test('required variable validation and template compilation distinguish provided vs missing fields', () => {
  const brand = makeBrand({ existingVision: '', additionalNotes: '' });
  const verified = buildVerifiedBrandContext({
    expectedBrandId: brand.id,
    expectedOwnerUserId: brand.userId,
    brand,
  });

  const foundationPrompt = resolveActivePromptVersion('brand_foundation_synthesis');
  const variableMap = buildPromptVariableMap(verified);
  const validation = validateRequiredVariables(foundationPrompt, variableMap);

  assert.equal(validation.valid, true);
  assert.deepEqual(validation.missingVariables, []);

  const compiled = compilePromptTemplate(foundationPrompt, verified);
  assert.equal(compiled.promptId, 'brand_foundation_synthesis');
  assert.equal(compiled.promptVersion, '1.0.0');
  assert.equal(compiled.model, 'gemini-4-hydrogen');
  assert.match(compiled.compiledUserPrompt, /Solstice Health/);
  assert.match(compiled.compiledUserPrompt, /- Existing Vision: Not provided/);
  assert.equal(compiled.compiledUserPrompt.includes('{{'), false);
});

test('missing required brand information returns structured missing_information response without calling Gemini', async () => {
  const incompleteBrand = makeBrand({
    targetMarket: '   ',
    productsOrServices: '',
  });

  let geminiCalled = false;
  const result = await executePrompt({
    promptId: 'brand_foundation_synthesis',
    brandId: incompleteBrand.id,
    brand: incompleteBrand,
    expectedOwnerUserId: incompleteBrand.userId,
    executeAi: async () => {
      geminiCalled = true;
      return { text: '{}', model: 'gemini-4-hydrogen', generatedAt: '2026-11-15T00:00:00.000Z' };
    },
  });

  assert.equal(geminiCalled, false);
  assert.equal(result.status, 'missing_information');
  if (result.status === 'missing_information') {
    assert.deepEqual(result.missingVariables, ['productsOrServices', 'targetMarket']);
    assert.equal(result.canSave, false);
    assert.throws(() => buildStrategyModuleUpsertInput(result), /Cannot save strategy module/);
  }
});

test('brand context isolation blocks cross-brand records, cross-owner records, and foreign strategy modules', () => {
  const brandAlpha = makeBrand({ id: 'brand-alpha-1', userId: 'owner-1' });
  const foreignModule = makeStrategyModule({
    id: 'mod-beta-foundation',
    brandId: 'brand-beta-2',
    userId: 'owner-1',
  });
  const foreignOwnerModule = makeStrategyModule({
    id: 'mod-other-owner',
    brandId: 'brand-alpha-1',
    userId: 'owner-2',
  });

  assert.throws(
    () =>
      buildVerifiedBrandContext({
        expectedBrandId: 'brand-beta-2',
        brand: brandAlpha,
      }),
    BrandContextIsolationError,
  );

  assert.throws(
    () =>
      buildVerifiedBrandContext({
        expectedBrandId: brandAlpha.id,
        expectedOwnerUserId: 'owner-2',
        brand: brandAlpha,
      }),
    BrandContextIsolationError,
  );

  assert.throws(
    () =>
      buildVerifiedBrandContext({
        expectedBrandId: brandAlpha.id,
        expectedOwnerUserId: 'owner-1',
        brand: brandAlpha,
        strategyModules: [foreignModule],
      }),
    BrandContextIsolationError,
  );

  assert.throws(
    () =>
      buildVerifiedBrandContext({
        expectedBrandId: brandAlpha.id,
        expectedOwnerUserId: 'owner-1',
        brand: brandAlpha,
        strategyModules: [foreignOwnerModule],
      }),
    BrandContextIsolationError,
  );

  assert.throws(
    () =>
      buildVerifiedBrandContext({
        expectedBrandId: brandAlpha.id,
        brand: null,
      }),
    BrandContextIsolationError,
  );
});

test('structured output validation parses fenced JSON, rejects malformed/incomplete JSON, and blocks saving invalid output', async () => {
  const foundationPrompt = resolveActivePromptVersion('brand_foundation_synthesis');

  const malformed = parseStructuredJsonResponse('Not valid JSON {oops');
  assert.ok(malformed.error);

  const fencedValid = validateStructuredOutput(
    [
      '```json',
      JSON.stringify({
        suppliedFactsUsed: ['Solstice Health operates in Austin, TX'],
        missingContextNotes: ['existingVision was not provided'],
        aiSuggestions: { rationale: 'Focus on clinical clarity.' },
        purpose: 'Make preventive care understandable and proactive.',
        missionStatement: 'Deliver clinician-guided biomarker insights.',
        visionStatement: 'A world where preventive health comes before crisis care.',
        positioningStatement: 'For proactive adults in Austin seeking clarity.',
        differentiationAttributes: ['Clinician-led', 'Preventive biomarker focus'],
      }),
      '```',
    ].join('\n'),
    foundationPrompt.expectedOutputStructure,
  );
  assert.equal(fencedValid.valid, true);
  assert.equal(fencedValid.errors.length, 0);

  // Missing required field + missing grounded separation fails cleanly
  const incompleteBrand = makeBrand();
  const invalidResult = await executePrompt({
    promptId: 'brand_foundation_synthesis',
    brandId: incompleteBrand.id,
    brand: incompleteBrand,
    executeAi: async () => ({
      text: JSON.stringify({
        purpose: 'Only one field returned',
      }),
      model: 'gemini-4-hydrogen',
      generatedAt: '2026-11-15T02:00:00.000Z',
    }),
  });

  assert.equal(invalidResult.status, 'validation_error');
  assert.equal(invalidResult.canSave, false);
  assert.throws(
    () => buildStrategyModuleUpsertInput(invalidResult),
    /Cannot save strategy module/,
  );
});

test('executePrompt executes via mocked Gemini integration, preserves brand isolation, and returns persistence metadata', async () => {
  const brand = makeBrand();
  const foundationModule = makeStrategyModule({ brandId: brand.id, userId: brand.userId });

  let seenPrompt = '';
  let seenContext: Record<string, unknown> | undefined;
  let seenModel = '';

  const result = await executePrompt({
    promptId: 'brand_messaging_framework',
    brandId: brand.id,
    brand,
    expectedOwnerUserId: brand.userId,
    strategyModules: [foundationModule],
    executeAi: async (req) => {
      seenPrompt = req.prompt;
      seenContext = req.context as Record<string, unknown>;
      seenModel = req.model ?? '';
      return {
        text: JSON.stringify({
          suppliedFactsUsed: [
            'Brand Name: Solstice Health',
            'Approved Brand Foundation purpose used',
          ],
          missingContextNotes: ['existingVision not provided'],
          aiSuggestions: { note: 'Test messaging pillars in landing page hero.' },
          coreValueProposition: 'Clinician-guided preventive biomarker plans for Austin adults.',
          messagingPillars: [
            { title: 'Clarity', summary: 'Plain-language biomarker analysis.' },
            { title: 'Prevention', summary: 'Act early with quarterly tracking.' },
          ],
          voiceAndTone: { attributes: ['Calm', 'Evidence-led'], guardrails: ['Avoid hype'] },
          audienceAngles: [
            { audience: 'Proactive adults 30-55', message: 'See trends before symptoms start.' },
          ],
        }),
        model: 'gemini-4-hydrogen',
        generatedAt: '2026-11-15T03:30:00.000Z',
      };
    },
  });

  assert.equal(result.status, 'success');
  assert.equal(result.canSave, true);
  assert.equal(seenModel, 'gemini-4-hydrogen');
  assert.match(seenPrompt, /Solstice Health/);
  assert.equal(seenContext?.brandId, brand.id);

  if (result.status === 'success') {
    assert.deepEqual(result.metadata, {
      promptId: 'brand_messaging_framework',
      promptVersion: '1.0.0',
      targetModule: 'brandMessaging',
      sourceClassification: 'reconstructed',
      brandId: brand.id,
      model: 'gemini-4-hydrogen',
      generatedAt: '2026-11-15T03:30:00.000Z',
    });

    const upsertPayload = buildStrategyModuleUpsertInput(result, 'in_progress');
    assert.equal(upsertPayload.status, 'in_progress');
    assert.equal(upsertPayload.promptId, 'brand_messaging_framework');
    assert.equal(upsertPayload.promptVersion, '1.0.0');
    assert.equal(upsertPayload.model, 'gemini-4-hydrogen');
    assert.equal(upsertPayload.generatedAt, '2026-11-15T03:30:00.000Z');
    assert.ok(upsertPayload.content?.coreValueProposition);
  }
});

test('buildVerifiedBrandContext strips unapproved AI suggestions from brandFoundation context', () => {
  const brand = makeBrand();
  const foundationWithSuggestions = makeStrategyModule({
    brandId: brand.id,
    userId: brand.userId,
    status: 'completed',
    content: {
      brandId: brand.id,
      purpose: {
        statement: 'Approved Purpose Text',
        aiSuggestedStatement: 'UNAPPROVED SUGGESTION MUST NOT LEAK',
        suggestionStatus: 'pending_review',
        approved: true,
      },
      mission: {
        statement: 'Draft Mission Only',
        aiSuggestedStatement: 'ANOTHER UNAPPROVED SUGGESTION',
        approved: false,
      },
      aiSynthesis: {
        aiSuggestionsSummary: { internalNote: 'DO NOT LEAK' },
      },
    },
  });

  const verified = buildVerifiedBrandContext({
    expectedBrandId: brand.id,
    expectedOwnerUserId: brand.userId,
    brand,
    strategyModules: [foundationWithSuggestions],
  });

  const serialized = JSON.stringify(verified.approvedStrategyModules.brandFoundation);
  assert.match(serialized, /Approved Purpose Text/);
  assert.equal(serialized.includes('UNAPPROVED SUGGESTION MUST NOT LEAK'), false);
  assert.equal(serialized.includes('Draft Mission Only'), false);
  assert.equal(serialized.includes('DO NOT LEAK'), false);
});

test('reopened in_progress modules ignore stale approvedSummary and emit nothing when zero sections are approved', () => {
  const brand = makeBrand();
  const reopenedWithNoApproved = makeStrategyModule({
    brandId: brand.id,
    userId: brand.userId,
    moduleKey: 'brandFoundation',
    status: 'in_progress',
    content: {
      brandId: brand.id,
      completedAt: null,
      approvedSummary: {
        purpose: 'STALE SUMMARY MUST NEVER LEAK',
      },
      purpose: {
        statement: 'Draft unapproved purpose',
        aiSuggestedStatement: 'UNAPPROVED SUGGESTION',
        approved: false,
      },
    },
  });

  const verifiedNone = buildVerifiedBrandContext({
    expectedBrandId: brand.id,
    expectedOwnerUserId: brand.userId,
    brand,
    strategyModules: [reopenedWithNoApproved],
  });
  assert.equal(verifiedNone.approvedStrategyModules.brandFoundation, undefined);

  const reopenedPartial = makeStrategyModule({
    brandId: brand.id,
    userId: brand.userId,
    moduleKey: 'brandFoundation',
    status: 'in_progress',
    content: {
      brandId: brand.id,
      approvedSummary: {
        mission: 'STALE UNAPPROVED MISSION SUMMARY',
      },
      purpose: {
        statement: 'Currently Approved Purpose',
        aiSuggestedStatement: 'HIDDEN_AI_SUGGESTION',
        approved: true,
      },
      mission: {
        statement: 'Unapproved Reopened Mission',
        approved: false,
      },
    },
  });

  const verifiedPartial = buildVerifiedBrandContext({
    expectedBrandId: brand.id,
    expectedOwnerUserId: brand.userId,
    brand,
    strategyModules: [reopenedPartial],
  });
  const serialized = JSON.stringify(verifiedPartial.approvedStrategyModules.brandFoundation);
  assert.match(serialized, /Currently Approved Purpose/);
  assert.equal(serialized.includes('STALE UNAPPROVED MISSION SUMMARY'), false);
  assert.equal(serialized.includes('Unapproved Reopened Mission'), false);
  assert.equal(serialized.includes('HIDDEN_AI_SUGGESTION'), false);
});

test('completed brandFoundation and brandMessaging sanitize together within size limits and protect core variables', () => {
  const brand = makeBrand();
  const completedFoundation = makeStrategyModule({
    id: 'mod-f',
    brandId: brand.id,
    userId: brand.userId,
    moduleKey: 'brandFoundation',
    status: 'completed',
    content: {
      brandId: brand.id,
      completedAt: '2026-11-15T10:00:00.000Z',
      approvedSummary: {
        purpose: 'Approved Foundation Purpose',
        mission: 'Approved Foundation Mission',
        vision: 'Approved Foundation Vision',
        coreValues: [{ name: 'Clinical Rigor', behaviors: 'Cite lab limits', whyItMatters: 'Trust' }],
        positioning: 'Physician-backed biomarker clarity.',
        differentiationAttributes: ['Clinician-led'],
      },
      purpose: {
        statement: 'Approved Foundation Purpose',
        aiSuggestedStatement: 'SHOULD_NOT_LEAK_FOUNDATION_SUGGESTION',
        approved: true,
      },
    },
  });

  const completedMessaging = makeStrategyModule({
    id: 'mod-m',
    brandId: brand.id,
    userId: brand.userId,
    moduleKey: 'brandMessaging',
    status: 'completed',
    promptId: 'brand_messaging_framework',
    content: {
      brandId: brand.id,
      completedAt: '2026-11-15T11:00:00.000Z',
      approvedSummary: {
        coreValueProposition: 'Approved Messaging Core Value Prop',
        messagingPillars: [{ title: 'Clarity', summary: 'Plain-language plans' }],
        voiceAndTone: { attributes: ['Calm'], guardrails: ['No hype'] },
        audienceAngles: [{ audience: 'Austin adults', message: 'See trends early.' }],
      },
      coreValueProposition: {
        statement: 'Approved Messaging Core Value Prop',
        aiSuggestedStatement: 'SHOULD_NOT_LEAK_MESSAGING_SUGGESTION',
        approved: true,
      },
    },
  });

  const verified = buildVerifiedBrandContext({
    expectedBrandId: brand.id,
    expectedOwnerUserId: brand.userId,
    brand,
    strategyModules: [completedFoundation, completedMessaging],
  });

  const serializedContext = JSON.stringify(verified);
  assert.ok(serializedContext.length < 24_000);
  assert.match(serializedContext, /Approved Foundation Purpose/);
  assert.match(serializedContext, /Approved Messaging Core Value Prop/);
  assert.equal(serializedContext.includes('SHOULD_NOT_LEAK_FOUNDATION_SUGGESTION'), false);
  assert.equal(serializedContext.includes('SHOULD_NOT_LEAK_MESSAGING_SUGGESTION'), false);

  const vars = buildPromptVariableMap(verified, {
    brandName: 'Spoofed Brand Name',
    industry: 'Spoofed Industry',
    approvedBrandFoundation: 'Spoofed Foundation Override',
    approvedBrandMessaging: 'Spoofed Messaging Override',
    additionalNotes: 'Focus on Austin Q1 launch.',
  });

  assert.equal(vars.brandName, 'Solstice Health');
  assert.equal(vars.industry, 'Health & Wellness');
  assert.match(vars.approvedBrandFoundation, /Approved Foundation Purpose/);
  assert.match(vars.approvedBrandMessaging, /Approved Messaging Core Value Prop/);
  assert.equal(vars.additionalNotes, 'Focus on Austin Q1 launch.');
});

test('customerIntelligence sanitization exposes only approved personas to customer_audience_interests and blocks spoofing', async () => {
  const brand = makeBrand();
  const foundationModule = makeStrategyModule({
    id: 'mod-f-ci',
    brandId: brand.id,
    userId: brand.userId,
    moduleKey: 'brandFoundation',
    status: 'completed',
    content: {
      brandId: brand.id,
      approvedSummary: {
        purposeStatement: 'Preventive clarity.',
        missionStatement: 'Deliver clinician-guided biomarkers.',
        visionStatement: 'Proactive healthcare.',
        coreValues: [{ name: 'Rigor', behaviors: 'Cite ranges', whyItMatters: 'Trust' }],
        positioningStatement: 'Physician-backed clarity.',
        differentiationAttributes: ['Clinician-led'],
      },
    },
  });
  const messagingModule = makeStrategyModule({
    id: 'mod-m-ci',
    brandId: brand.id,
    userId: brand.userId,
    moduleKey: 'brandMessaging',
    status: 'completed',
    content: {
      brandId: brand.id,
      approvedSummary: {
        coreValueProposition: 'Clear action plans from quarterly labs.',
        messagingPillars: [
          { title: 'Clarity', summary: 'Plain language' },
          { title: 'Action', summary: 'Step-by-step plans' },
        ],
        voiceAndTone: { attributes: ['Calm'], guardrails: ['No hype'] },
        audienceAngles: [{ audience: 'Founders', message: 'Save time.' }],
      },
    },
  });
  const customerIntelModule = makeStrategyModule({
    id: 'mod-ci-1',
    brandId: brand.id,
    userId: brand.userId,
    moduleKey: 'customerIntelligence',
    status: 'in_progress',
    content: {
      brandId: brand.id,
      personas: [
        {
          id: 'persona-approved',
          name: 'Verified Founder Buyer',
          roleOrSegment: 'Founder',
          summary: 'Wants fast biomarker interpretation.',
          aiHypothesisNote: 'INTERNAL_HYPOTHESIS_NOTE_DO_NOT_LEAK',
          approved: true,
        },
        {
          id: 'persona-draft',
          name: 'UNAPPROVED_DRAFT_PERSONA_DO_NOT_LEAK',
          roleOrSegment: 'Draft',
          summary: 'Should never enter approvedCustomerPersonas.',
          approved: false,
        },
      ],
      aiSuggestedPersonas: [
        { id: 'sugg-1', name: 'PENDING_AI_SUGGESTION_DO_NOT_LEAK', suggestionStatus: 'pending_review' },
      ],
    },
  });

  const verified = buildVerifiedBrandContext({
    expectedBrandId: brand.id,
    expectedOwnerUserId: brand.userId,
    brand,
    strategyModules: [foundationModule, messagingModule, customerIntelModule],
  });

  const vars = buildPromptVariableMap(verified, {
    approvedCustomerPersonas: 'SPOOFED_CLIENT_PERSONA_OVERRIDE',
  });

  assert.match(vars.approvedCustomerPersonas, /Verified Founder Buyer/);
  assert.equal(vars.approvedCustomerPersonas.includes('UNAPPROVED_DRAFT_PERSONA_DO_NOT_LEAK'), false);
  assert.equal(vars.approvedCustomerPersonas.includes('PENDING_AI_SUGGESTION_DO_NOT_LEAK'), false);
  assert.equal(vars.approvedCustomerPersonas.includes('INTERNAL_HYPOTHESIS_NOTE_DO_NOT_LEAK'), false);
  assert.equal(vars.approvedCustomerPersonas.includes('SPOOFED_CLIENT_PERSONA_OVERRIDE'), false);

  let seenResponseMimeType: string | undefined;
  let seenContextObj: Record<string, unknown> | undefined;

  const execResult = await executePrompt({
    promptId: 'customer_audience_interests',
    brandId: brand.id,
    brand,
    expectedOwnerUserId: brand.userId,
    strategyModules: [foundationModule, messagingModule, customerIntelModule],
    executeAi: async (req) => {
      seenResponseMimeType = req.responseMimeType;
      seenContextObj = req.context as Record<string, unknown>;
      assert.match(req.prompt, /Verified Founder Buyer/);
      assert.equal(req.prompt.includes('UNAPPROVED_DRAFT_PERSONA_DO_NOT_LEAK'), false);
      return {
        text: JSON.stringify({
          suppliedFactsUsed: ['Verified Founder Buyer'],
          missingContextNotes: [],
          researchCaveat: 'AI interest hypotheses require review.',
          aiSuggestions: { note: 'Prioritize executive clarity.' },
          interests: [
            {
              topic: 'Metabolic Biomarker Clarity',
              linkedPersonaNames: ['Verified Founder Buyer'],
              frequentQuestions: ['Which markers predict energy drops?'],
            },
            {
              topic: 'Clinician Review Speed',
              linkedPersonaNames: ['Verified Founder Buyer'],
              frequentQuestions: ['How long until MD review?'],
            },
          ],
        }),
        model: 'gemini-4-hydrogen',
        generatedAt: '2026-11-16T02:00:00.000Z',
      };
    },
  });

  assert.equal(execResult.status, 'success');
  assert.equal(execResult.targetModule, 'customerIntelligence');
  assert.equal(seenResponseMimeType, 'application/json');
  // Context payload should keep brandId/grounding metadata without duplicating already-interpolated modules
  assert.equal(seenContextObj?.brandId, brand.id);
  assert.equal(seenContextObj?.approvedStrategyModules, undefined);
  assert.equal(seenContextObj?.supplementalApprovedModules, undefined);
});

test('marketingStrategy sanitization exposes only approved strategy items, blocks unconditional spoofing, and executes modular prompts with JSON MIME type', async () => {
  const brand = makeBrand();
  const foundationModule = makeStrategyModule({
    id: 'mod-f-ms',
    brandId: brand.id,
    userId: brand.userId,
    moduleKey: 'brandFoundation',
    status: 'completed',
    content: {
      brandId: brand.id,
      approvedSummary: {
        purpose: 'Preventive clarity.',
        mission: 'Clinician-led biomarkers.',
        vision: 'Proactive longevity.',
        positioningStatement: 'Physician-backed biomarker clarity.',
        differentiationAttributes: ['Clinician-led'],
      },
    },
  });
  const messagingModule = makeStrategyModule({
    id: 'mod-m-ms',
    brandId: brand.id,
    userId: brand.userId,
    moduleKey: 'brandMessaging',
    status: 'completed',
    content: {
      brandId: brand.id,
      approvedSummary: {
        coreValueProposition: 'Clear action plans from quarterly labs.',
        messagingPillars: [{ title: 'Clarity', summary: 'Plain language' }],
        voiceAndTone: { attributes: ['Calm'], guardrails: ['No hype'] },
        audienceAngles: [{ audience: 'Founders', message: 'Save time.' }],
      },
    },
  });
  const customerIntelModule = makeStrategyModule({
    id: 'mod-ci-ms',
    brandId: brand.id,
    userId: brand.userId,
    moduleKey: 'customerIntelligence',
    status: 'completed',
    content: {
      brandId: brand.id,
      approvedSummary: {
        personas: [
          {
            id: 'p1',
            name: 'Austin Founder Persona',
            roleOrSegment: 'Founder',
            summary: 'Wants fast biomarker interpretation.',
          },
        ],
        interests: [
          {
            id: 'i1',
            topic: 'Metabolic Biomarker Clarity',
            linkedPersonaIds: ['p1'],
            frequentQuestions: ['Which markers predict energy drops?'],
          },
        ],
      },
    },
  });
  const marketingModule = makeStrategyModule({
    id: 'mod-ms-1',
    brandId: brand.id,
    userId: brand.userId,
    moduleKey: 'marketingStrategy',
    status: 'in_progress',
    content: {
      brandId: brand.id,
      goals: [
        {
          id: 'g1',
          title: 'Approved Consultation Goal',
          approved: true,
          aiHypothesisNote: 'INTERNAL_MS_NOTE_DO_NOT_LEAK',
        },
        {
          id: 'g2',
          title: 'UNAPPROVED_DRAFT_GOAL_DO_NOT_LEAK',
          approved: false,
        },
      ],
      objectives: [
        {
          id: 'o1',
          title: 'Approved Clinical Authority Objective',
          approved: true,
        },
      ],
      aiSuggestedGoals: [
        { id: 'sg1', title: 'PENDING_AI_GOAL_DO_NOT_LEAK', suggestionStatus: 'pending_review' },
      ],
    },
  });

  // 1. Unconditional anti-spoofing: even when marketingStrategy is absent on server,
  // client cannot spoof approvedMarketingGoals or approvedAudienceInterests via extraVariables.
  const verifiedWithoutMs = buildVerifiedBrandContext({
    expectedBrandId: brand.id,
    expectedOwnerUserId: brand.userId,
    brand,
    strategyModules: [foundationModule, messagingModule],
  });
  const spoofAttemptVars = buildPromptVariableMap(verifiedWithoutMs, {
    approvedCustomerPersonas: 'SPOOFED_PERSONAS',
    approvedAudienceInterests: 'SPOOFED_INTERESTS',
    approvedMarketingGoals: 'SPOOFED_GOALS',
    approvedMarketingObjectives: 'SPOOFED_OBJECTIVES',
    approvedMarketingChannels: 'SPOOFED_CHANNELS',
    approvedMarketingTactics: 'SPOOFED_TACTICS',
    businessConstraints: 'Organic-first Q1 pilot',
  });
  assert.equal(spoofAttemptVars.approvedCustomerPersonas, undefined);
  assert.equal(spoofAttemptVars.approvedAudienceInterests, undefined);
  assert.equal(spoofAttemptVars.approvedMarketingGoals, undefined);
  assert.equal(spoofAttemptVars.approvedMarketingObjectives, undefined);
  assert.equal(spoofAttemptVars.approvedMarketingChannels, undefined);
  assert.equal(spoofAttemptVars.approvedMarketingTactics, undefined);
  assert.equal(spoofAttemptVars.businessConstraints, 'Organic-first Q1 pilot');

  // 2. Approved-only sanitization for marketingStrategy + customerIntelligence
  const verifiedFull = buildVerifiedBrandContext({
    expectedBrandId: brand.id,
    expectedOwnerUserId: brand.userId,
    brand,
    strategyModules: [foundationModule, messagingModule, customerIntelModule, marketingModule],
  });
  const vars = buildPromptVariableMap(verifiedFull, {
    approvedMarketingGoals: 'SPOOFED_OVERRIDE',
  });
  assert.match(vars.approvedAudienceInterests, /Metabolic Biomarker Clarity/);
  assert.match(vars.approvedMarketingGoals, /Approved Consultation Goal/);
  assert.match(vars.approvedMarketingObjectives, /Approved Clinical Authority Objective/);
  assert.equal(vars.approvedMarketingGoals.includes('UNAPPROVED_DRAFT_GOAL_DO_NOT_LEAK'), false);
  assert.equal(vars.approvedMarketingGoals.includes('PENDING_AI_GOAL_DO_NOT_LEAK'), false);
  assert.equal(vars.approvedMarketingGoals.includes('INTERNAL_MS_NOTE_DO_NOT_LEAK'), false);
  assert.equal(vars.approvedMarketingGoals.includes('SPOOFED_OVERRIDE'), false);

  // 3. Execute marketing_strategy_channels_tactics and verify deduplication + JSON MIME type
  let capturedPrompt = '';
  let capturedContext: Record<string, unknown> | undefined;
  let capturedMime: string | undefined;

  const execResult = await executePrompt({
    promptId: 'marketing_strategy_channels_tactics',
    brandId: brand.id,
    brand,
    expectedOwnerUserId: brand.userId,
    strategyModules: [foundationModule, messagingModule, customerIntelModule, marketingModule],
    variables: { businessConstraints: 'Organic-first pilot' },
    executeAi: async (req) => {
      capturedPrompt = req.prompt;
      capturedContext = req.context as Record<string, unknown>;
      capturedMime = req.responseMimeType;
      return {
        text: JSON.stringify({
          suppliedFactsUsed: ['Austin Founder Persona', 'Approved Consultation Goal'],
          missingContextNotes: ['Monthly paid media cap not supplied'],
          researchCaveat: 'AI channel and tactic recommendations require owner approval.',
          aiSuggestions: { channelMixRationale: 'Focus on executive credibility channels.' },
          channels: [
            {
              channelName: 'LinkedIn Executive Content',
              strategicRationale: 'Austin Founder Persona reads peer-vetted clinician posts on LinkedIn.',
              relevantAudience: 'Austin Founder Persona',
              recommendedUse: 'Weekly biomarker breakdowns',
              expectedContribution: 'Drives high-trust discovery clicks',
              priority: 'primary',
              supportingObjectiveTitle: 'Approved Clinical Authority Objective',
            },
            {
              channelName: 'Clinician Email Briefing',
              strategicRationale: 'Matches preferred concise email communication format.',
              relevantAudience: 'Austin Founder Persona',
              recommendedUse: 'Bi-weekly lab Q&A',
              expectedContribution: 'Nurtures consultation bookings',
              priority: 'primary',
              supportingObjectiveTitle: 'Approved Clinical Authority Objective',
            },
          ],
          tactics: [
            {
              tacticName: 'Weekly MD ApoB & Metabolic Marker Carousel',
              description: 'Publish evidence-cited slide breakdowns of key biomarkers.',
              supportingObjectiveTitle: 'Approved Clinical Authority Objective',
              recommendedChannelName: 'LinkedIn Executive Content',
              targetAudience: 'Austin Founder Persona',
              executionGuidance: 'Lead MD outlines 5 cited slides each Tuesday linking to Austin briefing page.',
              suggestedFrequency: 'Weekly',
              successMetric: 'Briefing page opt-ins',
              priority: 'high',
            },
            {
              tacticName: 'Bi-Weekly Clinician Q&A Email Dispatch',
              description: 'Answer one top founder lab question per email.',
              supportingObjectiveTitle: 'Approved Clinical Authority Objective',
              recommendedChannelName: 'Clinician Email Briefing',
              targetAudience: 'Austin Founder Persona',
              executionGuidance: 'Send 400-word clinician note with clear action checklist and booking CTA.',
              suggestedFrequency: 'Bi-weekly',
              successMetric: 'Discovery booking clicks',
              priority: 'high',
            },
          ],
        }),
        model: 'gemini-4-hydrogen',
        generatedAt: '2026-11-18T03:00:00.000Z',
      };
    },
  });

  assert.equal(execResult.status, 'success');
  assert.equal(execResult.targetModule, 'marketingStrategy');
  assert.equal(capturedMime, 'application/json');
  assert.match(capturedPrompt, /Approved Consultation Goal/);
  assert.match(capturedPrompt, /Metabolic Biomarker Clarity/);
  assert.match(capturedPrompt, /Organic-first pilot/);
  // Foundation & Messaging sit cleanly in supplementalApprovedModules without duplicating Personas/MarketingStrategy
  const supp = capturedContext?.supplementalApprovedModules as Record<string, unknown> | undefined;
  assert.ok(supp?.brandFoundation);
  assert.ok(supp?.brandMessaging);
  assert.equal(supp?.customerIntelligence, undefined);
  assert.equal(supp?.marketingStrategy, undefined);
});

test('compactApprovedList strips internal metadata/empty objects, rejects unapproved records, and preserves relationships', () => {
  const compactedPersonas = compactApprovedList(
    [
      {
        id: 'persona-uuid-1',
        name: 'B2B Agency Founder',
        roleOrSegment: 'Founder',
        summary: '  Wants repeatable inbound pipeline.  ',
        painPoints: ['Feast-or-famine referrals', 'feast-or-famine referrals', '   ', 'Generic agency copy'],
        informationSources: ['LinkedIn', 'Operator Newsletters'],
        demographicsRelevant: false,
        demographics: { ageRange: '30-50' },
        source: 'ai_adopted',
        approved: true,
        approvedAt: '2026-11-18T00:00:00.000Z',
        aiHypothesisNote: 'INTERNAL_NOTE_STRIPPED',
      },
      {
        id: 'persona-uuid-2',
        name: 'UNAPPROVED_PERSONA_EXCLUDED',
        approved: false,
      },
      {
        id: 'persona-uuid-3',
        name: 'Enterprise Ops Director',
        demographicsRelevant: true,
        demographics: { location: 'North America', emptyField: '   ' },
        approved: true,
      },
    ],
    { kind: 'persona' },
  );

  assert.equal(compactedPersonas.length, 2);
  assert.equal(compactedPersonas[0].id, undefined);
  assert.equal(compactedPersonas[0].approved, undefined);
  assert.equal(compactedPersonas[0].approvedAt, undefined);
  assert.equal(compactedPersonas[0].source, undefined);
  assert.equal(compactedPersonas[0].aiHypothesisNote, undefined);
  assert.equal(compactedPersonas[0].demographicsRelevant, undefined);
  assert.equal(compactedPersonas[0].demographics, undefined);
  assert.deepEqual(compactedPersonas[0].painPoints, ['Feast-or-famine referrals', 'Generic agency copy']);
  assert.deepEqual(compactedPersonas[1].demographics, { location: 'North America' });

  const compactedTactics = compactApprovedList(
    [
      {
        id: 'tactic-uuid-1',
        tacticName: 'Weekly Positioning Tear-Down',
        priority: 'high',
        supportingObjectiveId: 'obj-uuid-1',
        supportingObjectiveTitle: 'Capture High-Intent Founder Attention',
        recommendedChannelId: 'ch-uuid-1',
        recommendedChannelName: 'LinkedIn Executive Editorial',
        approved: true,
      },
    ],
    { kind: 'tactic' },
  );

  assert.equal(compactedTactics.length, 1);
  assert.equal(compactedTactics[0].id, undefined);
  assert.equal(compactedTactics[0].supportingObjectiveId, undefined);
  assert.equal(compactedTactics[0].recommendedChannelId, undefined);
  assert.equal(compactedTactics[0].supportingObjectiveTitle, 'Capture High-Intent Founder Attention');
  assert.equal(compactedTactics[0].recommendedChannelName, 'LinkedIn Executive Editorial');
});

test('regression: marketing_strategy_channels_tactics stays below 12000-char limit under large combined upstream context without duplication or unapproved leakage', () => {
  // Confirm server limit constant has NOT been raised or bypassed
  assert.equal(ENGINE_MAX_PROMPT_LENGTH, 12_000);
  assert.equal(ENGINE_MAX_CONTEXT_LENGTH, 24_000);

  const now = '2026-11-18T00:00:00.000Z';
  const brand = makeBrand({
    id: 'brand-large-ctx-1',
    userId: 'owner-1',
    brandName: 'The Naheem Uthman',
    businessDescription:
      'Strategic brand consulting and AI-enabled content operations advisory helping B2B service founders turn scattered marketing into repeatable growth systems.',
    industry: 'Brand Strategy & B2B Marketing Advisory',
    productsOrServices:
      'Brand Strategy Sprints, Executive Thought Leadership Systems, Content Operations Retainers, and AI Workflow Audits',
    targetMarket:
      'B2B founders, agency principals, and solo consultants earning $250k to $5M annually who struggle to translate expertise into consistent inbound pipeline',
    primaryLocation: 'Lagos, Nigeria & Global Remote (UK/US/EMEA)',
    marketingChallenges:
      'Inconsistent content output, difficulty differentiating from generic marketing agencies, and limited founder time to manage multi-channel campaigns.',
    businessGoals:
      'Build a predictable pipeline of qualified strategy sprint and advisory retainer inquiries over the next two quarters.',
    competitors: 'Generic social media agencies, fractional CMO consultancies, DIY AI copywriting tools',
    additionalNotes:
      'Prefer high-trust authority channels and transparent proof-driven education over hype.',
  });

  const foundationModule = makeStrategyModule({
    id: 'mod-f-large',
    brandId: brand.id,
    userId: brand.userId,
    moduleKey: 'brandFoundation',
    status: 'completed',
    content: {
      schemaVersion: 1,
      brandId: brand.id,
      completedAt: now,
      approvedSummary: {
        purposeStatement: 'VERBOSE_PURPOSE_NOT_NEEDED_FOR_CHANNELS_SELECTION '.repeat(12),
        missionStatement: 'VERBOSE_MISSION_NOT_NEEDED_FOR_CHANNELS_SELECTION '.repeat(12),
        visionStatement: 'VERBOSE_VISION_NOT_NEEDED_FOR_CHANNELS_SELECTION '.repeat(12),
        coreValues: [
          { id: 'v1', name: 'Strategic Clarity', behaviors: 'Start from verified insight', whyItMatters: 'Saves spend' },
        ],
        positioningStatement:
          'For B2B founders tired of fragmented marketing, The Naheem Uthman turns domain expertise into structured brand strategy and compounding inbound demand.',
        differentiationAttributes: ['Strategy-first architecture', 'Founder-feasible workflows'],
        approvedAt: now,
      },
    },
  });

  const messagingModule = makeStrategyModule({
    id: 'mod-m-large',
    brandId: brand.id,
    userId: brand.userId,
    moduleKey: 'brandMessaging',
    status: 'completed',
    content: {
      schemaVersion: 1,
      brandId: brand.id,
      completedAt: now,
      approvedSummary: {
        coreValueProposition:
          'Transform scattered founder expertise into a clear positioning architecture and predictable B2B inbound content engine.',
        messagingPillars: [
          { id: 'p1', title: 'Clarity Before Channels', summary: 'Fix positioning before content distribution.' },
          { id: 'p2', title: 'Proof-Led Authority', summary: 'Demonstrate real frameworks and case breakdowns.' },
        ],
        voiceAndTone: {
          attributes: ['Sharp', 'Consultative', 'Practical'],
          guardrails: ['No empty guru hype', 'No fabricated revenue promises'],
        },
        audienceAngles: [
          { id: 'a1', audience: 'B2B Service Founders', message: 'Turn expertise into repeatable inbound demand.' },
        ],
        approvedAt: now,
      },
    },
  });

  const approvedPersonas = Array.from({ length: 6 }, (_, idx) => {
    const i = idx + 1;
    return {
      id: `persona-uuid-000${i}`,
      name: `Approved Persona ${i}: Growth-Stage B2B Founder`,
      roleOrSegment: `B2B Consultancy Principal Segment ${i}`,
      summary:
        'Experienced domain expert whose revenue comes mostly from word-of-mouth referrals and who wants predictable inbound demand without becoming a full-time social media influencer.',
      goals: [
        `Build consistent inbound discovery calls for segment ${i}`,
        'Articulate a sharp market position that commands premium retainers',
        'Run a lean repeatable weekly content workflow in under 4 hours',
      ],
      painPoints: [
        `Unpredictable referral pipeline in segment ${i}`,
        'Previous agency retainers produced generic content that failed to convert decision-makers',
        'Struggling to translate complex client delivery into concise public thought leadership',
      ],
      motivations: ['Long-term business stability and pricing power'],
      objections: ['Skeptical of marketing consultants who promise overnight viral leads'],
      purchasingTriggers: [
        'Losing a major referral client or hitting a pipeline plateau',
        'Launching a higher-ticket advisory offer that requires stronger market positioning',
      ],
      decisionFactors: ['Demonstrated strategic depth in public frameworks', 'Low founder time overhead'],
      informationSources: [
        'LinkedIn executive feeds',
        'Long-form B2B strategy newsletters',
        'Founder podcasts and peer Slack communities',
      ],
      communicationPreferences: ['Concise analytical breakdowns', 'Real-world case tear-downs'],
      demographicsRelevant: false,
      demographics: {},
      source: 'ai_adopted',
      approved: true,
      approvedAt: now,
    };
  });

  const approvedInterests = Array.from({ length: 10 }, (_, idx) => {
    const i = idx + 1;
    return {
      id: `interest-uuid-000${i}`,
      topic: `Approved Interest Cluster ${i}: B2B Positioning & Pipeline Architecture`,
      linkedPersonaIds: ['persona-uuid-0001', 'persona-uuid-0002'],
      frequentQuestions: [
        'How do I stand out when every competitor claims similar outcomes?',
        'What content formats actually influence B2B buyers before they book a call?',
      ],
      problemsToSolve: [
        `Generic brand messaging blending into market ${i}`,
        'Posting content that gets peer likes but zero buyer inquiries',
        'Lack of structured workflow from strategy to weekly publishing',
      ],
      contentConsumed: [
        'Deep-dive LinkedIn carousels and text frameworks',
        'Weekly strategic operator newsletters',
        'Before-and-after messaging tear-downs',
      ],
      searchTopics: [
        `b2b brand positioning framework ${i}`,
        'founder led marketing strategy b2b',
        'generate inbound consulting leads without cold outreach',
      ],
      productOrServiceInterests: ['Brand strategy sprints', 'Messaging architecture playbooks'],
      purchaseTriggers: ['Preparing for a flagship offer launch', 'Pipeline plateau'],
      concernsOrObjections: ['Sounding overly salesy or robotic'],
      seasonalOrSituationalInterests: ['Q1 annual planning resets'],
      source: 'ai_adopted',
      approved: true,
      approvedAt: now,
    };
  });

  const customerIntelModule = makeStrategyModule({
    id: 'mod-ci-large',
    brandId: brand.id,
    userId: brand.userId,
    moduleKey: 'customerIntelligence',
    status: 'in_progress',
    content: {
      schemaVersion: 1,
      brandId: brand.id,
      personas: [
        ...approvedPersonas,
        {
          id: 'persona-unapproved',
          name: 'UNAPPROVED_PERSONA_MUST_NOT_APPEAR',
          summary: 'Draft persona that must never leak',
          approved: false,
        },
      ],
      interests: [
        ...approvedInterests,
        {
          id: 'interest-unapproved',
          topic: 'UNAPPROVED_INTEREST_MUST_NOT_APPEAR',
          approved: false,
        },
      ],
      aiSuggestedPersonas: [{ id: 'sp-1', name: 'PENDING_SUGGESTED_PERSONA_MUST_NOT_APPEAR' }],
      aiSuggestedInterests: [{ id: 'si-1', topic: 'PENDING_SUGGESTED_INTEREST_MUST_NOT_APPEAR' }],
    },
  });

  const approvedGoals = Array.from({ length: 6 }, (_, idx) => {
    const i = idx + 1;
    return {
      id: `goal-uuid-000${i}`,
      title: `SMART Goal ${i}: Build Predictable Inbound Pipeline`,
      description:
        'Generate qualified inbound inquiries from B2B service founders and consultancy partners through proof-led strategic positioning content.',
      strategicRationale:
        'Directly addresses the core referral dependency challenge while leveraging verified founder expertise.',
      targetAudience: 'B2B service founders and consultancy managing partners ($250k-$5M)',
      supportingBusinessObjective: 'Build a predictable pipeline of qualified strategy sprint inquiries.',
      successMetrics: ['Qualified strategy sprint discovery calls booked', 'Inbound framework inquiries'],
      targetValue: 'Establish 30-day baseline first',
      measurementPeriod: 'Monthly tracking with quarterly strategic review',
      recommendedTimeframe: 'Next 2 quarters',
      source: 'ai_adopted',
      approved: true,
      approvedAt: now,
    };
  });

  const approvedObjectives = [
    {
      id: 'obj-low-1',
      title: 'Low Priority Objective: Repurpose Archived Notes',
      description: 'Repurpose older archived workshop notes into reference guides.',
      intendedBusinessOutcome: 'Maintain archive visibility.',
      targetAudience: 'Existing followers',
      supportingGoalId: 'goal-uuid-0006',
      supportingGoalTitle: 'SMART Goal 6: Build Predictable Inbound Pipeline',
      measurementCriteria: 'Archive views per quarter.',
      priority: 'low',
      approved: true,
      approvedAt: now,
    },
    ...Array.from({ length: 5 }, (_, idx) => {
      const i = idx + 1;
      return {
        id: `obj-high-${i}`,
        title: `High Priority Objective ${i}: Convert B2B Founders Into Strategy Sprints`,
        description:
          'Consistently publish concrete positioning tear-downs and structured B2B demand frameworks that move buyers to direct inquiry.',
        intendedBusinessOutcome:
          'Increase qualified executive inbound conversations while reducing reliance on unpredictable referrals.',
        targetAudience: 'B2B founders and boutique agency principals',
        supportingGoalId: 'goal-uuid-0001',
        supportingGoalTitle: 'SMART Goal 1: Build Predictable Inbound Pipeline',
        measurementCriteria: 'Qualified inbound discovery calls attributed to published frameworks.',
        priority: i <= 3 ? 'high' : 'medium',
        approved: true,
        approvedAt: now,
      };
    }),
  ];

  const marketingModule = makeStrategyModule({
    id: 'mod-ms-large',
    brandId: brand.id,
    userId: brand.userId,
    moduleKey: 'marketingStrategy',
    status: 'in_progress',
    content: {
      schemaVersion: 1,
      brandId: brand.id,
      goals: [
        ...approvedGoals,
        { id: 'goal-unapproved', title: 'UNAPPROVED_GOAL_MUST_NOT_APPEAR', approved: false },
      ],
      objectives: [
        ...approvedObjectives,
        { id: 'obj-unapproved', title: 'UNAPPROVED_OBJECTIVE_MUST_NOT_APPEAR', approved: false },
      ],
      aiSuggestedGoals: [{ id: 'sg-1', title: 'PENDING_AI_GOAL_MUST_NOT_APPEAR' }],
      aiSuggestedObjectives: [{ id: 'so-1', title: 'PENDING_AI_OBJECTIVE_MUST_NOT_APPEAR' }],
      channels: [],
      tactics: [],
      kpis: [],
      roadmapItems: [],
    },
  });

  // Verify the raw combined payload genuinely reproduces the >12,000-character overflow condition
  const unoptimizedSize =
    JSON.stringify(approvedPersonas).length +
    JSON.stringify(approvedInterests).length +
    JSON.stringify(approvedGoals).length +
    JSON.stringify(approvedObjectives).length;
  assert.ok(
    unoptimizedSize > ENGINE_MAX_PROMPT_LENGTH,
    `Expected unoptimized upstream payload (${unoptimizedSize}) to exceed ${ENGINE_MAX_PROMPT_LENGTH} chars to reproduce the bug`,
  );

  const verified = buildVerifiedBrandContext({
    expectedBrandId: brand.id,
    expectedOwnerUserId: brand.userId,
    brand,
    strategyModules: [foundationModule, messagingModule, customerIntelModule, marketingModule],
  });

  const def = resolveExecutablePrompt('marketing_strategy_channels_tactics');
  const compiled = compilePromptTemplate(def, verified, {
    businessConstraints: 'Organic-first lean team (3 hrs/week)',
    // Echoing brand.additionalNotes must NOT produce duplicate "note | note"
    additionalNotes: brand.additionalNotes,
    // Spoofing attempts must still be blocked
    approvedMarketingObjectives: 'SPOOFED_OBJECTIVE_OVERRIDE',
    approvedCustomerPersonas: 'SPOOFED_PERSONA_OVERRIDE',
  });

  // 1. Prompt and context stay comfortably within unchanged server limits
  assert.ok(
    compiled.combinedPromptText.length < ENGINE_MAX_PROMPT_LENGTH,
    `Expected compiled prompt (${compiled.combinedPromptText.length}) < ${ENGINE_MAX_PROMPT_LENGTH}`,
  );
  const serializedCtx = JSON.stringify(compiled.contextPayload);
  assert.ok(
    serializedCtx.length < ENGINE_MAX_CONTEXT_LENGTH,
    `Expected contextPayload (${serializedCtx.length}) < ${ENGINE_MAX_CONTEXT_LENGTH}`,
  );

  // 2. Priority 1 (high-priority approved objectives) preserved ahead of low-priority items, with goal linkage intact
  const highIdx = compiled.compiledUserPrompt.indexOf('High Priority Objective 1');
  const lowIdx = compiled.compiledUserPrompt.indexOf('Low Priority Objective');
  assert.ok(highIdx !== -1, 'High priority approved objective must be preserved');
  if (lowIdx !== -1) {
    assert.ok(highIdx < lowIdx, 'High priority objectives must be prioritized ahead of low priority objectives');
  }
  assert.match(compiled.compiledUserPrompt, /SMART Goal 1: Build Predictable Inbound Pipeline/);

  // 3. Approved persona names & channel cues and approved interest topics remain present
  assert.match(compiled.compiledUserPrompt, /Approved Persona 1/);
  assert.match(compiled.compiledUserPrompt, /LinkedIn executive feeds/);
  assert.match(compiled.compiledUserPrompt, /Approved Interest Cluster 1/);

  // 4. Duplicate elimination: additionalNotes appears once (not "note | note") and no module duplication in contextPayload
  const noteOccurrences = compiled.compiledUserPrompt.split(
    'Prefer high-trust authority channels and transparent proof-driven education over hype.',
  ).length - 1;
  assert.equal(noteOccurrences, 1, 'additionalNotes must not be duplicated');

  const supp = compiled.contextPayload.supplementalApprovedModules as Record<string, unknown>;
  assert.ok(supp?.brandFoundation);
  assert.ok(supp?.brandMessaging);
  assert.equal(supp?.customerIntelligence, undefined);
  assert.equal(supp?.marketingStrategy, undefined);
  const serializedSupp = JSON.stringify(supp);
  assert.match(serializedSupp, /structured brand strategy and compounding inbound demand/);
  assert.match(serializedSupp, /Clarity Before Channels/);
  assert.match(serializedSupp, /Consultative/);
  assert.equal(serializedSupp.includes('VERBOSE_PURPOSE_NOT_NEEDED'), false);
  assert.equal(serializedSupp.includes('VERBOSE_MISSION_NOT_NEEDED'), false);
  assert.equal(serializedSupp.includes('VERBOSE_VISION_NOT_NEEDED'), false);

  // 5. Strict approved-only & anti-spoofing guarantees
  for (const forbidden of [
    'UNAPPROVED_PERSONA_MUST_NOT_APPEAR',
    'UNAPPROVED_INTEREST_MUST_NOT_APPEAR',
    'PENDING_SUGGESTED_PERSONA_MUST_NOT_APPEAR',
    'PENDING_SUGGESTED_INTEREST_MUST_NOT_APPEAR',
    'UNAPPROVED_GOAL_MUST_NOT_APPEAR',
    'UNAPPROVED_OBJECTIVE_MUST_NOT_APPEAR',
    'PENDING_AI_GOAL_MUST_NOT_APPEAR',
    'PENDING_AI_OBJECTIVE_MUST_NOT_APPEAR',
    'SPOOFED_OBJECTIVE_OVERRIDE',
    'SPOOFED_PERSONA_OVERRIDE',
  ]) {
    assert.equal(compiled.combinedPromptText.includes(forbidden), false, `Forbidden string leaked into prompt: ${forbidden}`);
    assert.equal(serializedCtx.includes(forbidden), false, `Forbidden string leaked into context: ${forbidden}`);
  }

  // 6. Cross-brand isolation remains strictly enforced
  const foreignModule = makeStrategyModule({
    id: 'mod-foreign',
    brandId: 'brand-other-999',
    userId: brand.userId,
    moduleKey: 'marketingStrategy',
  });
  assert.throws(
    () =>
      buildVerifiedBrandContext({
        expectedBrandId: brand.id,
        expectedOwnerUserId: brand.userId,
        brand,
        strategyModules: [foundationModule, messagingModule, customerIntelModule, foreignModule],
      }),
    BrandContextIsolationError,
  );
});

test('regression: parsePromptExecutionResponse never collapses preview Nginx 200 HTML into {} and surfaces sanitized errors', () => {
  // Exact failure reproduced in Google AI Studio preview when Nginx intercepts 502/503/504 with /warmup.html as HTTP 200 OK
  assert.throws(
    () =>
      parsePromptExecutionResponse({
        ok: true,
        status: 200,
        contentType: 'text/html; charset=utf-8',
        bodyText: '<!doctype html><html><head><title>Starting Server...</title></head><body>Starting Server...</body></html>',
      }),
    /temporary server gateway response instead of JSON/i,
  );

  // HTTP 500 JSON returned behind preview Nginx surfaces real sanitized error message
  assert.throws(
    () =>
      parsePromptExecutionResponse({
        ok: false,
        status: 500,
        contentType: 'application/json',
        bodyText: JSON.stringify({
          error: 'AI generation timed out. Please try again.',
          upstreamStatus: 504,
        }),
      }),
    /AI generation timed out\. Please try again\./,
  );

  // HTTP 422 validation_error returns structured validation_error result cleanly
  const valErr = parsePromptExecutionResponse({
    ok: false,
    status: 422,
    contentType: 'application/json',
    bodyText: JSON.stringify({
      status: 'validation_error',
      brandId: 'b-1',
      promptId: 'marketing_strategy_channels_tactics',
      promptVersion: '1.0.0',
      targetModule: 'marketingStrategy',
      model: 'gemini-4-hydrogen',
      generatedAt: '2026-11-19T00:00:00.000Z',
      error: 'Generated output failed MarketingChannelsTacticsOutput validation: Missing required output field "channels".',
      errors: ['Missing required output field "channels".'],
      canSave: false,
    }),
  });
  assert.equal(valErr.status, 'validation_error');
  assert.equal(valErr.canSave, false);

  // HTTP 200 success returns structured success result cleanly
  const okResult = parsePromptExecutionResponse({
    ok: true,
    status: 200,
    contentType: 'application/json',
    bodyText: JSON.stringify({
      status: 'success',
      brandId: 'b-1',
      promptId: 'marketing_strategy_channels_tactics',
      promptVersion: '1.0.0',
      targetModule: 'marketingStrategy',
      sourceClassification: 'reconstructed',
      model: 'gemini-4-hydrogen',
      generatedAt: '2026-11-19T00:00:00.000Z',
      rawText: '{}',
      output: { channels: [], tactics: [] },
      metadata: {
        promptId: 'marketing_strategy_channels_tactics',
        promptVersion: '1.0.0',
        targetModule: 'marketingStrategy',
        sourceClassification: 'reconstructed',
        brandId: 'b-1',
        model: 'gemini-4-hydrogen',
        generatedAt: '2026-11-19T00:00:00.000Z',
      },
      canSave: true,
    }),
  });
  assert.equal(okResult.status, 'success');
  assert.equal(okResult.canSave, true);

  // Single-line markdown JSON fence parses cleanly without weakening field validation
  const def = resolveExecutablePrompt('marketing_strategy_channels_tactics');
  assert.ok(def.expectedOutputStructure.geminiResponseSchema);
  const singleLineValid = validateStructuredOutput(
    '```json {"suppliedFactsUsed":["Fact 1"],"missingContextNotes":[],"researchCaveat":"AI draft","aiSuggestions":{"channelMixRationale":"Focused","tradeOffNotes":[]},"channels":[{"channelName":"LinkedIn"},{"channelName":"Email"}],"tactics":[{"tacticName":"T1"},{"tacticName":"T2"}]} ```',
    def.expectedOutputStructure,
  );
  assert.equal(singleLineValid.valid, true);
});

function buildMarketingBudgetFixture(scale: 'realistic' | 'heavy' | 'extreme') {
  const now = '2026-11-19T00:00:00.000Z';
  const counts =
    scale === 'realistic'
      ? { personas: 4, interests: 6, goals: 4, objectives: 5, channels: 5, tactics: 6 }
      : scale === 'heavy'
        ? { personas: 6, interests: 10, goals: 6, objectives: 10, channels: 8, tactics: 12 }
        : { personas: 8, interests: 12, goals: 8, objectives: 12, channels: 10, tactics: 16 };

  const brand = makeBrand({
    id: `brand-ms-budget-${scale}`,
    userId: 'owner-1',
    brandName: 'The Naheem Uthman',
    businessDescription:
      'Strategic brand consulting and AI-enabled content operations advisory helping B2B service founders turn scattered marketing into repeatable growth systems.',
    industry: 'Brand Strategy & B2B Marketing Advisory',
    productsOrServices:
      'Brand Strategy Sprints, Executive Thought Leadership Systems, Content Operations Retainers, and AI Workflow Audits',
    targetMarket:
      'B2B founders, agency principals, and solo consultants earning $250k to $5M annually who struggle to translate expertise into consistent inbound pipeline',
    primaryLocation: 'Lagos, Nigeria & Global Remote (UK/US/EMEA)',
    websiteUrl: 'https://thenaheemuthman.example',
    socialLinks: 'https://linkedin.com/in/thenaheemuthman',
    existingMission: 'LEGACY_MISSION_SHOULD_NOT_BLOAT_CONTEXT',
    existingVision: 'LEGACY_VISION_SHOULD_NOT_BLOAT_CONTEXT',
    marketingChallenges:
      'Inconsistent content output, difficulty differentiating from generic agencies, and limited founder hours for multi-channel execution.',
    businessGoals:
      'Build a predictable pipeline of qualified strategy sprint and advisory retainer inquiries over the next two quarters.',
    competitors: 'Generic social media agencies, fractional CMO consultancies',
    additionalNotes:
      'Prefer high-trust authority channels and transparent proof-driven education over hype.',
  });

  const foundationModule = makeStrategyModule({
    id: `mod-f-${scale}`,
    brandId: brand.id,
    userId: brand.userId,
    moduleKey: 'brandFoundation',
    status: 'completed',
    content: {
      brandId: brand.id,
      completedAt: now,
      approvedSummary: {
        purposeStatement: 'VERBOSE_PURPOSE_EXCLUDED_FROM_DOWNSTREAM_PROMPTS '.repeat(12),
        missionStatement: 'VERBOSE_MISSION_EXCLUDED_FROM_DOWNSTREAM_PROMPTS '.repeat(12),
        visionStatement: 'VERBOSE_VISION_EXCLUDED_FROM_DOWNSTREAM_PROMPTS '.repeat(12),
        positioningStatement:
          'For B2B founders tired of fragmented marketing, The Naheem Uthman turns domain expertise into structured brand strategy and compounding inbound demand.',
        differentiationAttributes: ['Strategy-first architecture', 'Founder-feasible workflows'],
      },
    },
  });

  const messagingModule = makeStrategyModule({
    id: `mod-m-${scale}`,
    brandId: brand.id,
    userId: brand.userId,
    moduleKey: 'brandMessaging',
    status: 'completed',
    content: {
      brandId: brand.id,
      completedAt: now,
      approvedSummary: {
        coreValueProposition:
          'Transform scattered founder expertise into a clear positioning architecture and predictable B2B inbound content engine.',
        messagingPillars: [
          { id: 'p1', title: 'Clarity Before Channels', summary: 'Fix positioning before content distribution.' },
          { id: 'p2', title: 'Proof-Led Authority', summary: 'Demonstrate real strategic frameworks instead of hype.' },
        ],
        voiceAndTone: {
          attributes: ['Sharp', 'Consultative'],
          guardrails: ['No fabricated revenue promises'],
        },
        audienceAngles: [
          { id: 'a1', audience: 'B2B Service Founders', message: 'Turn domain expertise into repeatable inbound demand.' },
        ],
      },
    },
  });

  const personas = Array.from({ length: counts.personas }, (_, idx) => {
    const i = idx + 1;
    return {
      id: `persona-id-${i}`,
      name: `Approved Persona ${i}: Growth-Stage B2B Founder`,
      roleOrSegment: `Consultancy Principal Segment ${i}`,
      summary:
        'LENGTHY_PERSONA_NARRATIVE_EXCLUDED_FROM_KPI_AND_ROADMAP Experienced domain expert seeking predictable inbound pipeline without becoming a full-time influencer.',
      goals: [
        `Build consistent inbound discovery calls for segment ${i}`,
        'Articulate a sharp market position that commands premium retainers',
      ],
      painPoints: [
        `Unpredictable referral pipeline in segment ${i}`,
        'Generic agency retainers failed to convert decision-makers',
      ],
      purchasingTriggers: ['Hitting a referral plateau', 'Launching a flagship sprint offer'],
      decisionFactors: ['Demonstrated strategic depth in public frameworks', 'Low founder overhead'],
      informationSources: ['LinkedIn executive feeds', 'Long-form B2B strategy newsletters'],
      demographicsRelevant: false,
      demographics: { ageRange: '30-50' },
      approved: true,
      approvedAt: now,
    };
  });

  const interests = Array.from({ length: counts.interests }, (_, idx) => {
    const i = idx + 1;
    return {
      id: `interest-id-${i}`,
      topic: `Approved Interest Cluster ${i}: B2B Positioning & Pipeline Architecture`,
      frequentQuestions: ['How do I stand out when competitors claim similar outcomes?'],
      problemsToSolve: [
        `Generic brand messaging blending into market ${i}`,
        'Posting content that gets peer likes but zero buyer inquiries',
      ],
      contentConsumed: ['Deep-dive LinkedIn carousels', 'Weekly operator newsletters'],
      searchTopics: [`b2b brand positioning framework ${i}`, 'founder led marketing strategy b2b'],
      productOrServiceInterests: ['Brand strategy sprints', 'Messaging architecture playbooks'],
      purchaseTriggers: ['Preparing for a flagship offer launch', 'Pipeline plateau'],
      concernsOrObjections: ['Sounding overly salesy'],
      approved: true,
      approvedAt: now,
    };
  });

  const customerIntelModule = makeStrategyModule({
    id: `mod-ci-${scale}`,
    brandId: brand.id,
    userId: brand.userId,
    moduleKey: 'customerIntelligence',
    status: 'completed',
    content: {
      brandId: brand.id,
      completedAt: now,
      personas: [
        ...personas,
        { id: 'persona-unapproved', name: 'UNAPPROVED_PERSONA_MUST_NOT_LEAK', approved: false },
      ],
      interests: [
        ...interests,
        { id: 'interest-unapproved', topic: 'UNAPPROVED_INTEREST_MUST_NOT_LEAK', approved: false },
      ],
    },
  });

  const goals = Array.from({ length: counts.goals }, (_, idx) => {
    const i = idx + 1;
    return {
      id: `goal-id-${i}`,
      title: `SMART Goal ${i}: Build Predictable Inbound Advisory Pipeline`,
      description: `Detailed multi-sentence goal description for track ${i} establishing an authority-led organic acquisition engine generating qualified discovery bookings without paid ad dependence.`,
      strategicRationale: `Verbose strategic rationale for goal ${i} addressing referral dependence across segment ${i}.`,
      targetAudience: `Approved Persona ${Math.min(i, counts.personas)}: Growth-Stage B2B Founder`,
      supportingBusinessObjective: 'Increase qualified strategy sprint and advisory retainer inquiries.',
      successMetrics: [
        `Qualified inbound discovery calls booked per month (Track ${i})`,
        'Newsletter subscriber-to-consultation conversion rate',
      ],
      targetValue: 'Baseline to be established in Weeks 1-4 before setting percentage targets.',
      measurementPeriod: 'Monthly review with quarterly audit',
      recommendedTimeframe: 'Next 2 quarters (6 months)',
      approved: true,
      approvedAt: now,
    };
  });

  const objectives = Array.from({ length: counts.objectives }, (_, idx) => {
    const i = idx + 1;
    const priority = i <= 2 ? 'high' : i <= 5 ? 'medium' : 'low';
    return {
      id: `obj-id-${i}`,
      title: `${priority === 'high' ? 'High' : priority === 'medium' ? 'Medium' : 'Low'} Priority Objective ${i}: Establish Proof-Driven Authority`,
      description: `Detailed objective narrative ${i} explaining teardown publishing and diagnostic landing-page workflows.`,
      intendedBusinessOutcome: `Drive recurring high-intent consultation inquiries from decision-making B2B founders in track ${i}.`,
      targetAudience: `Approved Persona ${Math.min(i, counts.personas)}: Growth-Stage B2B Founder`,
      supportingGoalId: `goal-id-${(idx % counts.goals) + 1}`,
      // Intentionally leave supportingGoalTitle blank on Objective 1 to verify ID-based relationship backfill
      supportingGoalTitle:
        i === 1 ? '' : `SMART Goal ${(idx % counts.goals) + 1}: Build Predictable Inbound Advisory Pipeline`,
      measurementCriteria: `Track engaged decision-maker profile visits and qualified discovery bookings for objective ${i}.`,
      priority,
      approved: true,
      approvedAt: now,
    };
  });

  const channels = Array.from({ length: counts.channels }, (_, idx) => {
    const i = idx + 1;
    const priority = i <= 2 ? 'primary' : i <= 4 ? 'secondary' : 'experimental';
    return {
      id: `ch-id-${i}`,
      channelName: `Channel ${i}: LinkedIn Executive Editorial`,
      strategicRationale: `Long strategic rationale justifying channel ${i} based on founder reading habits and trust signals.`,
      relevantAudience: `Approved Persona ${Math.min(i, counts.personas)}: Growth-Stage B2B Founder`,
      recommendedUse: `Publish structured messaging teardowns and strategic diagnostic frameworks for channel ${i}.`,
      expectedContribution: `Generates top-of-funnel founder awareness and referral clicks into diagnostic booking flow for channel ${i}.`,
      priority,
      supportingObjectiveId: `obj-id-${(idx % counts.objectives) + 1}`,
      // Leave supportingObjectiveTitle blank on Channel 1 to verify ID-based relationship backfill
      supportingObjectiveTitle:
        i === 1
          ? ''
          : `${((idx % counts.objectives) + 1) <= 2 ? 'High' : ((idx % counts.objectives) + 1) <= 5 ? 'Medium' : 'Low'} Priority Objective ${(idx % counts.objectives) + 1}: Establish Proof-Driven Authority`,
      approved: true,
      approvedAt: now,
    };
  });

  const tactics = Array.from({ length: counts.tactics }, (_, idx) => {
    const i = idx + 1;
    const priority = i <= 3 ? 'high' : i <= 7 ? 'medium' : 'low';
    return {
      id: `tactic-id-${i}`,
      tacticName: `Tactic ${i}: Weekly Positioning Teardown Series`,
      description: `Publish a concrete before-and-after breakdown dissecting how an anonymized B2B consultancy sharpened its positioning in track ${i}.`,
      supportingObjectiveId: `obj-id-${(idx % counts.objectives) + 1}`,
      supportingObjectiveTitle:
        i === 1
          ? ''
          : `${((idx % counts.objectives) + 1) <= 2 ? 'High' : ((idx % counts.objectives) + 1) <= 5 ? 'Medium' : 'Low'} Priority Objective ${(idx % counts.objectives) + 1}: Establish Proof-Driven Authority`,
      recommendedChannelId: `ch-id-${(idx % counts.channels) + 1}`,
      recommendedChannelName: i === 1 ? '' : `Channel ${(idx % counts.channels) + 1}: LinkedIn Executive Editorial`,
      targetAudience: `Approved Persona ${Math.min(i, counts.personas)}: Growth-Stage B2B Founder`,
      executionGuidance: `VERBOSE_EXECUTION_GUIDANCE_EXCLUDED_FROM_KPIS Step 1: Select buyer pain point ${i}. Step 2: Draft 6-slide teardown with concrete rewrites. Step 3: Publish Tuesday 9am with diagnostic worksheet link and engage commenters for track ${i}.`,
      suggestedFrequency: 'Weekly (Tuesdays)',
      successMetric: `Qualified diagnostic worksheet downloads per teardown (Track ${i})`,
      priority,
      approved: true,
      approvedAt: now,
    };
  });

  const marketingModule = makeStrategyModule({
    id: `mod-ms-${scale}`,
    brandId: brand.id,
    userId: brand.userId,
    moduleKey: 'marketingStrategy',
    status: 'in_progress',
    content: {
      brandId: brand.id,
      goals: [
        ...goals,
        { id: 'g-unapproved', title: 'UNAPPROVED_GOAL_MUST_NOT_LEAK', approved: false },
      ],
      objectives: [
        ...objectives,
        { id: 'o-unapproved', title: 'UNAPPROVED_OBJECTIVE_MUST_NOT_LEAK', approved: false },
      ],
      channels: [
        ...channels,
        { id: 'ch-unapproved', channelName: 'UNAPPROVED_CHANNEL_MUST_NOT_LEAK', approved: false },
      ],
      tactics: [
        ...tactics,
        { id: 't-unapproved', tacticName: 'UNAPPROVED_TACTIC_MUST_NOT_LEAK', approved: false },
      ],
      aiSuggestedGoals: [{ id: 'sg', title: 'PENDING_AI_GOAL_MUST_NOT_LEAK' }],
      aiSuggestedKpis: [{ id: 'sk', kpiName: 'PENDING_AI_KPI_MUST_NOT_LEAK' }],
      aiSuggestedRoadmapItems: [{ id: 'sr', activity: 'PENDING_AI_ROADMAP_MUST_NOT_LEAK' }],
    },
  });

  const businessConstraints =
    scale === 'extreme'
      ? [
          'Budget: Lean organic-first ($0-$500/month tooling)',
          'Team Capacity: Founder 4 hrs/week + 1 part-time editor 6 hrs/week',
          'Known Baselines: 420 newsletter subscribers at 38% open rate; analytics attribution baseline not yet captured',
          'Target Timeline: Next 2 quarters (24 weeks) with Phase 1 foundation in Weeks 1-4',
          `Additional Constraints: ${'Maintain strict founder-feasible weekly systems without cold spam or inflated daily posting promises. '.repeat(14)}`,
        ].join(' | ')
      : [
          'Budget: Lean organic-first ($0-$500/month tooling)',
          'Team Capacity: Founder 4 hrs/week + 1 part-time editor 6 hrs/week',
          'Known Baselines: 420 newsletter subscribers at 38% open rate; analytics attribution baseline not yet captured',
          'Target Timeline: Next 2 quarters (24 weeks) with Phase 1 foundation in Weeks 1-4',
          'Additional Constraints: Prioritize sustainable weekly workflows over daily posting.',
        ].join(' | ');

  return {
    brand,
    modules: [foundationModule, messagingModule, customerIntelModule, marketingModule],
    extraVariables: {
      businessConstraints,
      additionalNotes: brand.additionalNotes,
      // Spoofing attempts must always be blocked
      approvedMarketingGoals: 'SPOOFED_GOALS_OVERRIDE',
      approvedMarketingObjectives: 'SPOOFED_OBJECTIVES_OVERRIDE',
      approvedMarketingChannels: 'SPOOFED_CHANNELS_OVERRIDE',
      approvedMarketingTactics: 'SPOOFED_TACTICS_OVERRIDE',
      approvedCustomerPersonas: 'SPOOFED_PERSONAS_OVERRIDE',
      approvedAudienceInterests: 'SPOOFED_INTERESTS_OVERRIDE',
    },
  };
}

function assertAllPromptJsonBlocksValid(compiledUserPrompt: string, headings: readonly string[]) {
  for (const heading of headings) {
    const startIdx = compiledUserPrompt.indexOf(`${heading}\n`);
    assert.ok(startIdx !== -1, `Expected section heading "${heading}" in compiled prompt`);
    const afterHeading = compiledUserPrompt.slice(startIdx + heading.length + 1);
    const lineEnd = afterHeading.indexOf('\n');
    const jsonLine = (lineEnd === -1 ? afterHeading : afterHeading.slice(0, lineEnd)).trim();
    const parsed = JSON.parse(jsonLine) as unknown;
    assert.ok(Array.isArray(parsed) && parsed.length > 0, `Expected non-empty JSON array under "${heading}"`);
  }
}

test('regression: marketing_strategy_kpis stays under 12000-char limit across realistic, heavy, and extreme context while preserving goals, objectives, baselines, relationships, and isolation', () => {
  assert.equal(ENGINE_MAX_PROMPT_LENGTH, 12_000);
  assert.equal(ENGINE_MAX_CONTEXT_LENGTH, 24_000);

  for (const scale of ['realistic', 'heavy', 'extreme'] as const) {
    const { brand, modules, extraVariables } = buildMarketingBudgetFixture(scale);
    const verified = buildVerifiedBrandContext({
      expectedBrandId: brand.id,
      expectedOwnerUserId: brand.userId,
      brand,
      strategyModules: modules,
    });

    const def = resolveExecutablePrompt('marketing_strategy_kpis');
    const rawVars = buildPromptVariableMap(verified, extraVariables);
    const rawLen =
      rawVars.approvedMarketingGoals.length +
      rawVars.approvedMarketingObjectives.length +
      rawVars.approvedMarketingChannels.length +
      rawVars.approvedMarketingTactics.length;
    assert.ok(
      rawLen > ENGINE_MAX_PROMPT_LENGTH,
      `Expected raw KPI variables (${rawLen}) to exceed ${ENGINE_MAX_PROMPT_LENGTH} to reproduce overflow (${scale})`,
    );

    const compiled = compilePromptTemplate(def, verified, extraVariables);
    const serializedCtx = JSON.stringify(compiled.contextPayload);

    assert.ok(
      compiled.combinedPromptText.length < ENGINE_MAX_PROMPT_LENGTH,
      `Expected KPI compiled prompt (${compiled.combinedPromptText.length}) < ${ENGINE_MAX_PROMPT_LENGTH} (${scale})`,
    );
    assert.ok(
      serializedCtx.length < ENGINE_MAX_CONTEXT_LENGTH,
      `Expected KPI contextPayload (${serializedCtx.length}) < ${ENGINE_MAX_CONTEXT_LENGTH} (${scale})`,
    );

    // Every interpolated approved strategy section must remain valid non-empty JSON
    assertAllPromptJsonBlocksValid(compiled.compiledUserPrompt, [
      'Approved Marketing Goals:',
      'Approved Marketing Objectives:',
      'Approved Marketing Channels:',
      'Approved Marketing Tactics:',
    ]);

    // Preserves KPI priorities: goal titles, metrics, target values, timeframes, objective links (backfilled), known baselines
    assert.match(compiled.compiledUserPrompt, /SMART Goal 1: Build Predictable Inbound Advisory Pipeline/);
    assert.match(compiled.compiledUserPrompt, /Qualified inbound discovery calls booked per month/);
    assert.match(compiled.compiledUserPrompt, /Baseline to be established in Weeks 1-4/);
    assert.match(compiled.compiledUserPrompt, /Next 2 quarters/);
    assert.match(compiled.compiledUserPrompt, /High Priority Objective 1: Establish Proof-Driven Authority/);
    assert.match(compiled.compiledUserPrompt, /Known Baselines: 420 newsletter subscribers/);
    assert.match(compiled.compiledUserPrompt, /Channel 1: LinkedIn Executive Editorial/);

    // Excludes lengthy tactical executionGuidance and verbose persona descriptions
    assert.equal(compiled.combinedPromptText.includes('VERBOSE_EXECUTION_GUIDANCE_EXCLUDED_FROM_KPIS'), false);
    assert.equal(serializedCtx.includes('LENGTHY_PERSONA_NARRATIVE_EXCLUDED_FROM_KPI_AND_ROADMAP'), false);
    assert.equal(serializedCtx.includes('VERBOSE_PURPOSE_EXCLUDED_FROM_DOWNSTREAM_PROMPTS'), false);

    // Deduplication of additionalNotes
    const noteCount =
      compiled.compiledUserPrompt.split(
        'Prefer high-trust authority channels and transparent proof-driven education over hype.',
      ).length - 1;
    assert.equal(noteCount, 1);

    // Strict approved-only & anti-spoofing guarantees
    for (const forbidden of [
      'UNAPPROVED_GOAL_MUST_NOT_LEAK',
      'UNAPPROVED_OBJECTIVE_MUST_NOT_LEAK',
      'UNAPPROVED_CHANNEL_MUST_NOT_LEAK',
      'UNAPPROVED_TACTIC_MUST_NOT_LEAK',
      'PENDING_AI_GOAL_MUST_NOT_LEAK',
      'PENDING_AI_KPI_MUST_NOT_LEAK',
      'SPOOFED_GOALS_OVERRIDE',
      'SPOOFED_OBJECTIVES_OVERRIDE',
      'SPOOFED_CHANNELS_OVERRIDE',
      'SPOOFED_TACTICS_OVERRIDE',
      'goal-id-1',
      'obj-id-1',
    ]) {
      assert.equal(compiled.combinedPromptText.includes(forbidden), false, `Forbidden token leaked into KPI prompt: ${forbidden}`);
      assert.equal(serializedCtx.includes(forbidden), false, `Forbidden token leaked into KPI context: ${forbidden}`);
    }
  }
});

test('regression: marketing_strategy_roadmap stays under 12000-char limit across realistic, heavy, and extreme context while preserving objectives, priorities, channels, tactics, timelines, and isolation', () => {
  for (const scale of ['realistic', 'heavy', 'extreme'] as const) {
    const { brand, modules, extraVariables } = buildMarketingBudgetFixture(scale);
    const verified = buildVerifiedBrandContext({
      expectedBrandId: brand.id,
      expectedOwnerUserId: brand.userId,
      brand,
      strategyModules: modules,
    });

    const def = resolveExecutablePrompt('marketing_strategy_roadmap');
    const compiled = compilePromptTemplate(def, verified, extraVariables);
    const serializedCtx = JSON.stringify(compiled.contextPayload);

    assert.ok(
      compiled.combinedPromptText.length < ENGINE_MAX_PROMPT_LENGTH,
      `Expected Roadmap compiled prompt (${compiled.combinedPromptText.length}) < ${ENGINE_MAX_PROMPT_LENGTH} (${scale})`,
    );
    assert.ok(
      serializedCtx.length < ENGINE_MAX_CONTEXT_LENGTH,
      `Expected Roadmap contextPayload (${serializedCtx.length}) < ${ENGINE_MAX_CONTEXT_LENGTH} (${scale})`,
    );

    assertAllPromptJsonBlocksValid(compiled.compiledUserPrompt, [
      'Approved Marketing Goals:',
      'Approved Marketing Objectives:',
      'Approved Marketing Channels:',
      'Approved Marketing Tactics:',
    ]);

    // Preserves Roadmap priorities: high-priority objectives first, goal timeframes, channel names, tactic descriptions & metrics, timeline/capacity constraints
    const highIdx = compiled.compiledUserPrompt.indexOf('High Priority Objective 1');
    const lowIdx = compiled.compiledUserPrompt.indexOf('Low Priority Objective');
    assert.ok(highIdx !== -1, 'High priority objective must be preserved in Roadmap');
    if (lowIdx !== -1) {
      assert.ok(highIdx < lowIdx, 'High priority objectives must appear before low priority objectives in Roadmap');
    }
    assert.match(compiled.compiledUserPrompt, /SMART Goal 1: Build Predictable Inbound Advisory Pipeline/);
    assert.match(compiled.compiledUserPrompt, /Next 2 quarters/);
    assert.match(compiled.compiledUserPrompt, /Channel 1: LinkedIn Executive Editorial/);
    assert.match(compiled.compiledUserPrompt, /Tactic 1: Weekly Positioning Teardown Series/);
    assert.match(compiled.compiledUserPrompt, /Target Timeline: Next 2 quarters/);

    // Excludes unrelated persona details & legacy profile bloat from supplementalApprovedModules
    const supp = compiled.contextPayload.supplementalApprovedModules as Record<string, unknown>;
    assert.equal(supp?.customerIntelligence, undefined);
    assert.equal(serializedCtx.includes('LENGTHY_PERSONA_NARRATIVE_EXCLUDED_FROM_KPI_AND_ROADMAP'), false);
    assert.equal(serializedCtx.includes('LEGACY_MISSION_SHOULD_NOT_BLOAT_CONTEXT'), false);

    // Approved-only & anti-spoofing
    for (const forbidden of [
      'UNAPPROVED_GOAL_MUST_NOT_LEAK',
      'UNAPPROVED_OBJECTIVE_MUST_NOT_LEAK',
      'UNAPPROVED_CHANNEL_MUST_NOT_LEAK',
      'UNAPPROVED_TACTIC_MUST_NOT_LEAK',
      'PENDING_AI_ROADMAP_MUST_NOT_LEAK',
      'SPOOFED_TACTICS_OVERRIDE',
    ]) {
      assert.equal(compiled.combinedPromptText.includes(forbidden), false, `Forbidden token leaked into Roadmap prompt: ${forbidden}`);
      assert.equal(serializedCtx.includes(forbidden), false, `Forbidden token leaked into Roadmap context: ${forbidden}`);
    }
  }
});

test('regression: marketing_strategy_goals_objectives stays under 12000-char prompt and 24000-char context limits across realistic, heavy, extreme, and missing-optional-field cases', () => {
  for (const scale of ['realistic', 'heavy', 'extreme'] as const) {
    const { brand, modules, extraVariables } = buildMarketingBudgetFixture(scale);
    const verified = buildVerifiedBrandContext({
      expectedBrandId: brand.id,
      expectedOwnerUserId: brand.userId,
      brand,
      strategyModules: modules,
    });

    const def = resolveExecutablePrompt('marketing_strategy_goals_objectives');
    const compiled = compilePromptTemplate(def, verified, extraVariables);
    const serializedCtx = JSON.stringify(compiled.contextPayload);

    assert.ok(
      compiled.combinedPromptText.length < ENGINE_MAX_PROMPT_LENGTH,
      `Expected Goals & Objectives compiled prompt (${compiled.combinedPromptText.length}) < ${ENGINE_MAX_PROMPT_LENGTH} (${scale})`,
    );
    assert.ok(
      serializedCtx.length < ENGINE_MAX_CONTEXT_LENGTH,
      `Expected Goals & Objectives contextPayload (${serializedCtx.length}) < ${ENGINE_MAX_CONTEXT_LENGTH} (${scale})`,
    );

    assertAllPromptJsonBlocksValid(compiled.compiledUserPrompt, [
      'Approved Customer Personas (Same Brand Only):',
      'Approved Audience Interests (Same Brand Only):',
    ]);

    // Positioning & Value Proposition preserved in supplementalApprovedModules without verbose purpose/mission/vision
    const supp = compiled.contextPayload.supplementalApprovedModules as Record<string, unknown>;
    assert.ok(supp?.brandFoundation);
    assert.ok(supp?.brandMessaging);
    assert.ok(supp?.marketingStrategy); // compact existing approved goal/objective titles only
    assert.equal(serializedCtx.includes('VERBOSE_PURPOSE_EXCLUDED_FROM_DOWNSTREAM_PROMPTS'), false);
    assert.equal(serializedCtx.includes('VERBOSE_EXECUTION_GUIDANCE_EXCLUDED_FROM_KPIS'), false);
    assert.equal(compiled.combinedPromptText.includes('UNAPPROVED_PERSONA_MUST_NOT_LEAK'), false);
    assert.equal(compiled.combinedPromptText.includes('UNAPPROVED_INTEREST_MUST_NOT_LEAK'), false);
    assert.equal(compiled.combinedPromptText.includes('SPOOFED_PERSONAS_OVERRIDE'), false);
  }

  // Missing optional fields handled cleanly without errors
  const { brand, modules } = buildMarketingBudgetFixture('realistic');
  const minimalBrand = makeBrand({
    ...brand,
    marketingChallenges: '',
    businessGoals: '',
    competitors: '',
    additionalNotes: '',
    websiteUrl: '',
    socialLinks: '',
  });
  const verifiedMinimal = buildVerifiedBrandContext({
    expectedBrandId: minimalBrand.id,
    expectedOwnerUserId: minimalBrand.userId,
    brand: minimalBrand,
    strategyModules: modules.slice(0, 3), // No existing marketingStrategy yet
  });
  const compiledMinimal = compilePromptTemplate(
    resolveExecutablePrompt('marketing_strategy_goals_objectives'),
    verifiedMinimal,
  );
  assert.ok(compiledMinimal.combinedPromptText.length < ENGINE_MAX_PROMPT_LENGTH);
  assert.match(compiledMinimal.compiledUserPrompt, /Business Goals: Not provided/);

  // Pathological oversized required brand field returns clear actionable error rather than bypassing 12000 limit
  const oversizedBrand = makeBrand({
    ...brand,
    businessDescription: 'Very long business narrative sentence. '.repeat(350),
  });
  const verifiedOversized = buildVerifiedBrandContext({
    expectedBrandId: oversizedBrand.id,
    expectedOwnerUserId: oversizedBrand.userId,
    brand: oversizedBrand,
    strategyModules: modules.slice(0, 3),
  });
  assert.throws(
    () =>
      compilePromptTemplate(
        resolveExecutablePrompt('marketing_strategy_goals_objectives'),
        verifiedOversized,
      ),
    /Compiled prompt exceeds the 12000-character server limit/i,
  );
});

test('Phase 2B Content Strategy: all 6 prompts compile under 12000/24000 limits across realistic, heavy, and extreme contexts with valid JSON, native schemas, approved-only isolation, and anti-spoofing', () => {
  assert.equal(ENGINE_MAX_PROMPT_LENGTH, 12_000);
  assert.equal(ENGINE_MAX_CONTEXT_LENGTH, 24_000);

  const contentPromptIds = [
    'content_strategy_objectives',
    'content_strategy_pillars',
    'content_strategy_themes',
    'content_strategy_formats',
    'content_strategy_distribution',
    'content_strategy_governance',
  ] as const;

  const scales: Array<'realistic' | 'heavy' | 'extreme'> = ['realistic', 'heavy', 'extreme'];

  for (const scale of scales) {
    const { brand, modules } = buildMarketingBudgetFixture(scale);
    const repeatCount = scale === 'extreme' ? 8 : scale === 'heavy' ? 5 : 2;
    const filler =
      scale === 'extreme'
        ? ' Detailed strategic narrative covering multi-quarter editorial nuance and audience alignment.'.repeat(6)
        : scale === 'heavy'
          ? ' Extended rationale explaining audience fit and channel relevance.'.repeat(2)
          : '';

    const contentStrategyModule = makeStrategyModule({
      id: `mod-cs-${scale}`,
      brandId: brand.id,
      userId: brand.userId,
      moduleKey: 'contentStrategy',
      status: 'in_progress',
      content: {
        brandId: brand.id,
        objectives: [
          ...Array.from({ length: repeatCount }, (_, i) => ({
            id: `cobj-${i + 1}`,
            title: `Content Objective ${i + 1}: Build Operator Authority`,
            level: i === 0 ? 'primary' : 'supporting',
            description: `Demonstrate structured diagnostic clarity.${filler}`,
            targetAudienceOutcomes: ['Spot positioning gaps early', 'Understand category proof'],
            desiredAudienceActions: ['Subscribe to weekly teardown', 'Request diagnostic session'],
            alignedMarketingGoalTitle: 'SMART Goal 1: Build Predictable Inbound Advisory Pipeline',
            alignedMarketingObjectiveTitle: 'High Priority Objective 1',
            approved: true,
          })),
          {
            id: 'cobj-unapproved',
            title: 'UNAPPROVED_CONTENT_OBJECTIVE_MUST_NOT_LEAK',
            approved: false,
          },
        ],
        aiSuggestedObjectives: [
          {
            id: 'ai-cobj-1',
            title: 'PENDING_AI_CONTENT_OBJECTIVE_MUST_NOT_LEAK',
            suggestionStatus: 'pending_review',
          },
        ],
        pillars: [
          ...Array.from({ length: repeatCount }, (_, i) => ({
            id: `cpil-${i + 1}`,
            name: `Brand Pillar ${i + 1}: Diagnostic Positioning Proof`,
            description: `Concrete teardowns of real B2B positioning breakdowns.${filler}`,
            strategicPurpose: 'Establish credible advisor voice.',
            targetAudienceSegment: 'Persona 1: B2B SaaS Founder',
            relevantInterestsAndPainPoints: ['Generic agency positioning', 'Stalled pipeline'],
            keyMessages: ['Proof beats generic agency claims'],
            supportingTopics: ['Messaging audits', 'ICP sharpness'],
            alignedMarketingObjectiveTitle: 'High Priority Objective 1',
            approved: true,
          })),
          {
            id: 'cpil-unapproved',
            name: 'UNAPPROVED_CONTENT_PILLAR_MUST_NOT_LEAK',
            approved: false,
          },
        ],
        themes: [
          ...Array.from({ length: repeatCount }, (_, i) => ({
            id: `cthm-${i + 1}`,
            title: `Theme ${i + 1}: Messaging Teardown Benchmarks`,
            description: `Compare high-converting vs generic B2B landing pages.${filler}`,
            associatedPillarId: 'cpil-1',
            associatedPillarName: 'Brand Pillar 1: Diagnostic Positioning Proof',
            audienceRelevance: 'Directly answers founder messaging objections.',
            addressedNeedOrAspiration: 'Differentiate from larger competitors',
            communicationAngle: 'Before-and-after diagnostic comparison',
            alignedMarketingObjectiveTitle: 'High Priority Objective 1',
            approved: true,
          })),
          {
            id: 'cthm-unapproved',
            title: 'UNAPPROVED_CONTENT_THEME_MUST_NOT_LEAK',
            approved: false,
          },
        ],
        formats: [
          ...Array.from({ length: repeatCount }, (_, i) => ({
            id: `cfmt-${i + 1}`,
            formatName: `Format ${i + 1}: Annotated Teardown Carousel`,
            purpose: `Make strategic frameworks scannable in 60 seconds.${filler}`,
            suitablePlatforms: ['Channel 1: LinkedIn Executive Editorial'],
            audienceSuitability: 'Built for time-pressed B2B founders.',
            relatedPillarNames: ['Brand Pillar 1: Diagnostic Positioning Proof'],
            approved: true,
          })),
          {
            id: 'cfmt-unapproved',
            formatName: 'UNAPPROVED_CONTENT_FORMAT_MUST_NOT_LEAK',
            approved: false,
          },
        ],
        series: [
          ...Array.from({ length: repeatCount }, (_, i) => ({
            id: `cser-${i + 1}`,
            seriesName: `Series ${i + 1}: Tuesday Teardown Brief`,
            description: `Weekly positioning audit of a live B2B SaaS homepage.${filler}`,
            formatName: 'Format 1: Annotated Teardown Carousel',
            suitablePlatforms: ['Channel 1: LinkedIn Executive Editorial'],
            relatedPillarNames: ['Brand Pillar 1: Diagnostic Positioning Proof'],
            audienceSuitability: 'B2B founders and marketing leads',
            cadenceHint: 'Weekly',
            approved: true,
          })),
          {
            id: 'cser-unapproved',
            seriesName: 'UNAPPROVED_CONTENT_SERIES_MUST_NOT_LEAK',
            approved: false,
          },
        ],
        distribution: [
          ...Array.from({ length: repeatCount }, (_, i) => ({
            id: `cdist-${i + 1}`,
            platformName: `Channel ${i + 1}: LinkedIn Executive Editorial`,
            channelRole: 'Primary authority channel',
            platformConsiderations: `Lead with visual proof on slide 1.${filler}`,
            recommendedFrequency: '2 posts/week',
            contentMix: ['1 Teardown Carousel', '1 Operator Insight Post'],
            distributionApproach: 'Publish Tuesday/Thursday mornings with briefing CTA.',
            repurposingOpportunities: ['Convert top carousel into newsletter essay'],
            publishingConstraints: 'Founder review 48h prior',
            approved: true,
          })),
          {
            id: 'cdist-unapproved',
            platformName: 'UNAPPROVED_DISTRIBUTION_MUST_NOT_LEAK',
            approved: false,
          },
        ],
      },
    });

    const enrichedModules = modules.map((mod) => {
      if (mod.moduleKey !== 'marketingStrategy') return mod;
      const existingContent = (mod.content ?? {}) as Record<string, unknown>;
      return {
        ...mod,
        status: 'completed' as const,
        content: {
          ...existingContent,
          kpis: [
            ...Array.from({ length: repeatCount }, (_, i) => ({
              id: `kpi-${i + 1}`,
              kpiName: `KPI ${i + 1}: Qualified Diagnostic Inquiries from Editorial`,
              description: `Tracks qualified inbound consultations attributed to editorial content.${filler}`,
              whatItMeasures: 'Weekly newsletter signups and diagnostic bookings via UTM tags',
              relatedObjectiveId: `obj-id-${(i % 2) + 1}`,
              relatedObjectiveTitle: `High Priority Objective ${(i % 2) + 1}: Establish Proof-Driven Authority`,
              measurementMethod: 'UTM tracking in CRM booking form',
              reportingFrequency: 'Monthly',
              classification: i % 2 === 0 ? 'leading' : 'lagging',
              baselineNote: 'Baseline established in first 30 days.',
              approved: true,
            })),
            {
              id: 'kpi-unapproved',
              kpiName: 'UNAPPROVED_KPI_MUST_NOT_LEAK',
              approved: false,
            },
          ],
          roadmapItems: [
            {
              id: 'rm-1',
              phase: 'Phase 1: Foundation',
              activity: 'Instrument UTM attribution and publish weekly positioning teardowns',
              description: 'Establish baseline editorial cadence and attribution.',
              supportingObjectiveTitle: 'High Priority Objective 1: Establish Proof-Driven Authority',
              channel: 'Channel 1: LinkedIn Executive Editorial',
              priority: 'high',
              suggestedTimeframe: 'Weeks 1-4',
              approved: true,
            },
          ],
        },
      };
    });

    const verified = buildVerifiedBrandContext({
      expectedBrandId: brand.id,
      expectedOwnerUserId: brand.userId,
      brand,
      strategyModules: [...enrichedModules, contentStrategyModule],
    });

    const extraVariables = {
      contentConstraints:
        'Publishing Capacity: 2 LinkedIn posts/wk + 1 bi-weekly newsletter | Production Constraints: Written + visual carousels only',
      approvedContentObjectives: 'SPOOFED_CONTENT_OBJECTIVES_OVERRIDE',
      approvedContentPillars: 'SPOOFED_CONTENT_PILLARS_OVERRIDE',
      approvedContentThemes: 'SPOOFED_CONTENT_THEMES_OVERRIDE',
      approvedContentFormats: 'SPOOFED_CONTENT_FORMATS_OVERRIDE',
      approvedContentSeries: 'SPOOFED_CONTENT_SERIES_OVERRIDE',
      approvedContentDistribution: 'SPOOFED_CONTENT_DISTRIBUTION_OVERRIDE',
      approvedMarketingKpis: 'SPOOFED_MARKETING_KPIS_OVERRIDE',
    };

    for (const promptId of contentPromptIds) {
      const def = resolveExecutablePrompt(promptId);
      assert.equal(def.targetModule, 'contentStrategy');
      assert.equal(def.modelConfig.model, 'gemini-4-hydrogen');
      assert.ok(
        def.expectedOutputStructure.geminiResponseSchema,
        `${promptId} must define native geminiResponseSchema`,
      );

      const compiled = compilePromptTemplate(def, verified, extraVariables);
      const serializedCtx = JSON.stringify(compiled.contextPayload);

      assert.ok(
        compiled.combinedPromptText.length < ENGINE_MAX_PROMPT_LENGTH,
        `${promptId} (${scale}) prompt length ${compiled.combinedPromptText.length} must stay < ${ENGINE_MAX_PROMPT_LENGTH}`,
      );
      assert.ok(
        compiled.combinedPromptText.length <= 8_500,
        `${promptId} (${scale}) prompt length ${compiled.combinedPromptText.length} should stay compact (<= 8500 chars) to avoid Gemini latency timeouts`,
      );
      assert.ok(
        serializedCtx.length < ENGINE_MAX_CONTEXT_LENGTH,
        `${promptId} (${scale}) context length ${serializedCtx.length} must stay < ${ENGINE_MAX_CONTEXT_LENGTH}`,
      );
      assert.ok(
        serializedCtx.length <= 4_000,
        `${promptId} (${scale}) supplemental context length ${serializedCtx.length} should stay lean (<= 4000 chars) without duplicating prompt variables`,
      );

      // Verify determinism
      const compiledRepeat = compilePromptTemplate(def, verified, extraVariables);
      assert.equal(compiled.combinedPromptText, compiledRepeat.combinedPromptText);

      // Verify zero unapproved leakage and zero client spoofing
      for (const forbidden of [
        'UNAPPROVED_CONTENT_OBJECTIVE_MUST_NOT_LEAK',
        'PENDING_AI_CONTENT_OBJECTIVE_MUST_NOT_LEAK',
        'UNAPPROVED_CONTENT_PILLAR_MUST_NOT_LEAK',
        'UNAPPROVED_CONTENT_THEME_MUST_NOT_LEAK',
        'UNAPPROVED_CONTENT_FORMAT_MUST_NOT_LEAK',
        'UNAPPROVED_CONTENT_SERIES_MUST_NOT_LEAK',
        'UNAPPROVED_DISTRIBUTION_MUST_NOT_LEAK',
        'UNAPPROVED_GOAL_MUST_NOT_LEAK',
        'UNAPPROVED_PERSONA_MUST_NOT_LEAK',
        'SPOOFED_CONTENT_OBJECTIVES_OVERRIDE',
        'SPOOFED_CONTENT_PILLARS_OVERRIDE',
        'SPOOFED_CONTENT_THEMES_OVERRIDE',
        'SPOOFED_CONTENT_FORMATS_OVERRIDE',
        'SPOOFED_CONTENT_SERIES_OVERRIDE',
        'SPOOFED_CONTENT_DISTRIBUTION_OVERRIDE',
        'SPOOFED_MARKETING_KPIS_OVERRIDE',
      ]) {
        assert.equal(
          compiled.combinedPromptText.includes(forbidden),
          false,
          `${promptId} (${scale}) leaked forbidden token ${forbidden}`,
        );
        assert.equal(
          serializedCtx.includes(forbidden),
          false,
          `${promptId} (${scale}) context leaked forbidden token ${forbidden}`,
        );
      }

      // Every optimized variable that starts with '[' or '{' must remain valid JSON (zero mid-string truncation)
      const baseVars = buildPromptVariableMap(verified, extraVariables);
      const optimizedVars = optimizeContentStrategyPromptVariables(
        def,
        verified,
        compiled.compiledSystemInstructions,
        baseVars,
      );
      for (const [k, v] of Object.entries(optimizedVars)) {
        const trimmed = v.trim();
        if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
          assert.doesNotThrow(
            () => JSON.parse(trimmed),
            `${promptId} (${scale}) variable ${k} must remain valid JSON after budget compression`,
          );
        }
      }
    }
  }
});

test('Phase 2B Content Calendar weekly batch prompt compiles within strict budget across realistic/heavy/extreme fixtures, prevents unapproved/spoofed data, and executes end-to-end', async () => {
  assert.equal(ENGINE_MAX_PROMPT_LENGTH, 12_000);
  assert.equal(ENGINE_MAX_CONTEXT_LENGTH, 24_000);
  assert.equal(CONTENT_CALENDAR_PROMPT_TARGET_BUDGET, 9_200);

  const def = resolveExecutablePrompt('content_calendar_weekly_batch');
  assert.equal(def.version, '1.0.0');
  assert.equal(def.status, 'active');
  assert.equal(def.targetModule, 'contentCalendar');
  assert.equal(def.modelConfig.model, 'gemini-4-hydrogen');
  assert.ok(def.expectedOutputStructure.geminiResponseSchema);

  for (const scale of ['realistic', 'heavy', 'extreme'] as const) {
    const { brand, modules: strategyModules } = buildMarketingBudgetFixture(scale);
    const now = '2026-11-21T00:00:00.000Z';
    const counts =
      scale === 'realistic'
        ? { pillars: 4, themes: 6, formats: 5, series: 3, dist: 3, prev: 6 }
        : scale === 'heavy'
          ? { pillars: 6, themes: 10, formats: 8, series: 5, dist: 5, prev: 15 }
          : { pillars: 10, themes: 16, formats: 12, series: 8, dist: 8, prev: 24 };

    const contentStrategyModule = makeStrategyModule({
      id: `mod-cal-cs-${scale}`,
      brandId: brand.id,
      userId: brand.userId,
      moduleKey: 'contentStrategy',
      status: 'completed',
      content: {
        brandId: brand.id,
        objectives: [
          {
            id: 'cobj-1',
            title: 'Establish Proof-Led B2B Positioning Authority',
            level: 'primary',
            alignedMarketingObjectiveTitle: 'High Priority Objective 1: Convert B2B Founders',
            desiredAudienceActions: ['Bookmark positioning framework', 'Request strategy sprint brief'],
            approved: true,
          },
          {
            id: 'cobj-unapproved',
            title: 'UNAPPROVED_CAL_CONTENT_OBJ_DO_NOT_LEAK',
            approved: false,
          },
        ],
        pillars: [
          ...Array.from({ length: counts.pillars }, (_, i) => ({
            id: `cp-${i + 1}`,
            name: `Approved Pillar ${i + 1}: B2B Positioning & Demand Systems`,
            targetAudienceSegment: 'Growth-Stage B2B Founder',
            strategicPurpose:
              'Show concrete strategic breakdowns and before-and-after messaging diagnostics that move B2B buyers to inquire.',
            keyMessages: [`Key insight ${i + 1}: Clarity precedes consistent pipeline growth.`],
            alignedMarketingObjectiveTitle: 'High Priority Objective 1: Convert B2B Founders',
            approved: true,
          })),
          { id: 'cp-unapproved', name: 'UNAPPROVED_CAL_PILLAR_DO_NOT_LEAK', approved: false },
        ],
        themes: [
          ...Array.from({ length: counts.themes }, (_, i) => ({
            id: `ct-${i + 1}`,
            title: `Approved Theme ${i + 1}: Positioning Teardown Series`,
            associatedPillarName: `Approved Pillar ${(i % counts.pillars) + 1}: B2B Positioning & Demand Systems`,
            communicationAngle: 'Contrast generic agency copy with concrete proof-led positioning frameworks.',
            approved: true,
          })),
          { id: 'ct-unapproved', title: 'UNAPPROVED_CAL_THEME_DO_NOT_LEAK', approved: false },
        ],
        formats: [
          ...Array.from({ length: counts.formats }, (_, i) => ({
            id: `cf-${i + 1}`,
            formatName: `Approved Format ${i + 1}: Structured Breakdown`,
            suitablePlatforms: ['LinkedIn', 'Email Newsletter'],
            purpose: 'Deliver concise executive frameworks in under 3 minutes.',
            approved: true,
          })),
          { id: 'cf-unapproved', formatName: 'UNAPPROVED_CAL_FORMAT_DO_NOT_LEAK', approved: false },
        ],
        series: Array.from({ length: counts.series }, (_, i) => ({
          id: `cs-${i + 1}`,
          seriesName: `Approved Series ${i + 1}: Weekly Positioning Clinic`,
          formatName: 'Approved Format 1: Structured Breakdown',
          suitablePlatforms: ['LinkedIn'],
          cadenceHint: 'Weekly on Tuesdays',
          approved: true,
        })),
        distribution: [
          ...Array.from({ length: counts.dist }, (_, i) => ({
            id: `cd-${i + 1}`,
            platformName: i === 0 ? 'LinkedIn' : i === 1 ? 'Email Newsletter' : `Approved Channel ${i + 1}`,
            recommendedFrequency: i === 0 ? '3x per week' : '1x per week',
            contentMix: ['Framework carousels', 'Operator essays'],
            approved: true,
          })),
          { id: 'cd-unapproved', platformName: 'UNAPPROVED_CAL_DIST_DO_NOT_LEAK', approved: false },
        ],
        createdAt: now,
      },
    });

    const verified = buildVerifiedBrandContext({
      expectedBrandId: brand.id,
      expectedOwnerUserId: brand.userId,
      brand,
      strategyModules: [...strategyModules, contentStrategyModule],
    });

    const extraVariables = {
      calendarBatchPlan: {
        batchLabel: 'Week 4 (Days 22–30)',
        startDate: '2026-12-22',
        endDate: '2026-12-30',
        targetItemCount: 5,
        selectedPlatforms: ['LinkedIn', 'Email Newsletter'],
        preferredDays: ['Monday', 'Tuesday', 'Thursday', 'Friday'],
        preferredTime: '09:00 AM',
        postingFrequency: '4 posts/week',
        campaignObjectiveFocus: 'Establish Proof-Led B2B Positioning Authority',
        contentMixPreference: 'Balanced across approved content pillars and formats',
        teamCapacityNote: 'Lean solo founder review workflow (3 hours/week)',
        specialDatesOrConstraints: 'Avoid hard promotional push on Dec 25; keep tone thoughtful.',
      },
      previouslyScheduledSummary: Array.from({ length: counts.prev }, (_, i) => ({
        date: `2026-12-${String((i % 21) + 1).padStart(2, '0')}`,
        platform: i % 2 === 0 ? 'LinkedIn' : 'Email Newsletter',
        pillar: `Approved Pillar ${(i % counts.pillars) + 1}: B2B Positioning & Demand Systems`,
        title: `Previously Scheduled Post ${i + 1}: Turning Expertise Into Inbound Pipeline`,
      })),
      // Spoofing attempts against protected upstream variables must be ignored
      approvedContentPillars: 'SPOOFED_CAL_PILLARS',
      approvedMarketingSummary: 'SPOOFED_CAL_MARKETING',
      approvedAudienceSummary: 'SPOOFED_CAL_AUDIENCE',
    };

    const compiled = compilePromptTemplate(def, verified, extraVariables);
    const serializedCtx = JSON.stringify(compiled.contextPayload);

    assert.ok(
      compiled.combinedPromptText.length < ENGINE_MAX_PROMPT_LENGTH,
      `Calendar (${scale}) prompt length ${compiled.combinedPromptText.length} must stay < ${ENGINE_MAX_PROMPT_LENGTH}`,
    );
    assert.ok(
      compiled.combinedPromptText.length <= CONTENT_CALENDAR_PROMPT_TARGET_BUDGET,
      `Calendar (${scale}) prompt length ${compiled.combinedPromptText.length} must stay <= ${CONTENT_CALENDAR_PROMPT_TARGET_BUDGET}`,
    );
    assert.ok(
      serializedCtx.length < ENGINE_MAX_CONTEXT_LENGTH,
      `Calendar (${scale}) context length ${serializedCtx.length} must stay < ${ENGINE_MAX_CONTEXT_LENGTH}`,
    );

    // Deterministic output across repeated compilations
    const compiledAgain = compilePromptTemplate(def, verified, extraVariables);
    assert.equal(compiled.combinedPromptText, compiledAgain.combinedPromptText);

    // All JSON-like optimized variables remain syntactically valid JSON
    const baseVars = buildPromptVariableMap(verified, extraVariables);
    const optVars = optimizeContentCalendarPromptVariables(
      def,
      verified,
      compiled.compiledSystemInstructions,
      baseVars,
    );
    for (const [k, v] of Object.entries(optVars)) {
      const trimmed = v.trim();
      if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
        assert.doesNotThrow(
          () => JSON.parse(trimmed),
          `Calendar (${scale}) variable ${k} must remain valid JSON`,
        );
      }
    }

    // Zero unapproved leakage and zero spoofing
    for (const forbidden of [
      'UNAPPROVED_CAL_CONTENT_OBJ_DO_NOT_LEAK',
      'UNAPPROVED_CAL_PILLAR_DO_NOT_LEAK',
      'UNAPPROVED_CAL_THEME_DO_NOT_LEAK',
      'UNAPPROVED_CAL_FORMAT_DO_NOT_LEAK',
      'UNAPPROVED_CAL_DIST_DO_NOT_LEAK',
      'SPOOFED_CAL_PILLARS',
      'SPOOFED_CAL_MARKETING',
      'SPOOFED_CAL_AUDIENCE',
    ]) {
      assert.equal(compiled.combinedPromptText.includes(forbidden), false);
      assert.equal(serializedCtx.includes(forbidden), false);
    }

    // Verify executePrompt succeeds end-to-end on realistic fixture
    if (scale === 'realistic') {
      const execResult = await executePrompt({
        promptId: 'content_calendar_weekly_batch',
        brandId: brand.id,
        brand,
        expectedOwnerUserId: brand.userId,
        strategyModules: [...strategyModules, contentStrategyModule],
        variables: extraVariables,
        executeAi: async (req) => {
          assert.equal(req.responseMimeType, 'application/json');
          assert.ok(req.responseSchema);
          assert.ok(req.prompt.length <= CONTENT_CALENDAR_PROMPT_TARGET_BUDGET);
          return {
            text: JSON.stringify({
              suppliedFactsUsed: ['Approved Pillar 1', 'LinkedIn'],
              missingContextNotes: [],
              researchCaveat: 'Review planned entries before drafting.',
              aiSuggestions: {
                batchSummary: 'Balanced positioning diagnostics across LinkedIn and Email.',
                pacingNotes: ['Spaced Tuesday/Thursday posts to respect founder capacity.'],
              },
              items: [
                {
                  scheduledDate: '2026-12-22',
                  suggestedTime: '09:00 AM',
                  platform: 'LinkedIn',
                  title: 'Year-End B2B Positioning Diagnostic',
                  contentPillar: 'Approved Pillar 1: B2B Positioning & Demand Systems',
                  contentTheme: 'Approved Theme 1: Positioning Teardown Series',
                  contentFormat: 'Approved Format 1: Structured Breakdown',
                  contentSeries: 'Approved Series 1: Weekly Positioning Clinic',
                  targetAudience: 'Approved Persona 1: Growth-Stage B2B Founder',
                  audiencePainPoint: 'Unpredictable referral pipeline',
                  contentObjective: 'Establish Proof-Led B2B Positioning Authority',
                  relatedMarketingObjective: 'High Priority Objective 1: Convert B2B Founders',
                  coreMessage: 'Audit positioning clarity before planning Q1 campaigns.',
                  suggestedAngle: '5-minute executive self-check',
                  intendedCta: 'Save this checklist for Q1 planning',
                  relevantKpi: 'Qualified Discovery Calls',
                  productionNotes: 'Keep slide copy crisp and verifiable.',
                },
              ],
            }),
            model: 'gemini-4-hydrogen',
            generatedAt: now,
          };
        },
      });
      assert.equal(execResult.status, 'success');
      assert.equal(execResult.targetModule, 'contentCalendar');
    }
  }
});

test('Phase 2B Content Studio prompts (generate & refine) stay under 9500 target / 12000 hard limit across realistic, heavy, and extreme fixtures with anti-spoofing and structured execution', async () => {
  assert.equal(ENGINE_MAX_PROMPT_LENGTH, 12_000);
  assert.equal(ENGINE_MAX_CONTEXT_LENGTH, 24_000);
  assert.equal(CONTENT_STUDIO_PROMPT_TARGET_BUDGET, 9_500);

  const now = '2026-11-21T00:00:00.000Z';

  for (const scale of ['realistic', 'heavy', 'extreme'] as const) {
    const { brand, modules: strategyModules } = buildMarketingBudgetFixture(scale);
    const repeatFactor = scale === 'realistic' ? 1 : scale === 'heavy' ? 4 : 12;

    const contentStrategyModule = makeStrategyModule({
      id: `mod-cs-studio-${scale}`,
      brandId: brand.id,
      userId: brand.userId,
      moduleKey: 'contentStrategy',
      status: 'completed',
      content: {
        brandId: brand.id,
        objectives: [
          {
            id: 'co-1',
            title: 'Establish Proof-Led Positioning Authority',
            approved: true,
          },
          {
            id: 'co-unapproved',
            title: 'UNAPPROVED_STUDIO_OBJ_DO_NOT_LEAK',
            approved: false,
          },
        ],
        pillars: Array.from({ length: 6 }, (_, idx) => ({
          id: `p-${idx + 1}`,
          name: `Approved Pillar ${idx + 1}: Positioning & Demand Systems`,
          description: `Core pillar detail ${idx + 1}. `.repeat(repeatFactor),
          approved: true,
        })),
        distributionChannels: [
          { id: 'd-1', channelName: 'LinkedIn', publishingFrequency: '3x/week', approved: true },
          { id: 'd-unapproved', channelName: 'UNAPPROVED_STUDIO_DIST_DO_NOT_LEAK', approved: false },
        ],
        governance: {
          qualityStandards: ['Never fabricate statistics', 'Maintain executive clarity'],
          brandConsistencyRules: ['Lead with verified frameworks'],
          approved: true,
        },
      },
    });

    const verified = buildVerifiedBrandContext({
      expectedBrandId: brand.id,
      expectedOwnerUserId: brand.userId,
      brand,
      strategyModules: [...strategyModules, contentStrategyModule],
    });

    const calendarBrief = {
      title: '5-Slide B2B Positioning Diagnostic',
      scheduledDate: '2026-12-03',
      platform: 'LinkedIn',
      contentPillar: 'Approved Pillar 1: Positioning & Demand Systems',
      contentTheme: 'Teardown Frameworks',
      contentFormat: 'LinkedIn Carousel',
      targetAudience: 'Approved Persona 1: Growth-Stage B2B Founder',
      audiencePainPoint: 'Unpredictable referral pipeline and blended messaging',
      contentObjective: 'Establish Proof-Led Positioning Authority',
      coreMessage: 'Clarify positioning before increasing publishing volume. '.repeat(repeatFactor),
      suggestedAngle: '5-minute executive diagnostic',
      intendedCta: 'Comment AUDIT for the scorecard',
      productionNotes: 'Keep every slide scannable and concrete. '.repeat(repeatFactor),
    };

    const generateVars: Record<string, unknown> = {
      studioGenerationOptions: JSON.stringify({
        platform: 'LinkedIn',
        formatCategory: 'carousel',
        formatLabel: 'LinkedIn Carousel',
        toneOfVoice: 'Direct, analytical, founder-practical',
        contentLength: 'medium',
        primaryObjective: 'Establish Proof-Led Positioning Authority',
        targetAudience: 'Approved Persona 1: Growth-Stage B2B Founder',
        ctaPreference: 'Comment AUDIT for the scorecard',
        platformGuidance: 'Slide 1 cover hook, Slides 2-5 concise takeaways, Slide 6 CTA.',
        additionalInstructions: 'Highlight verified positioning steps without fluff. '.repeat(repeatFactor),
      }),
      studioCalendarBrief: JSON.stringify(calendarBrief),
      // Spoofing attempts must be overwritten by server-verified brand/audience/strategy summaries
      studioBrandContext: 'SPOOFED_STUDIO_BRAND_CONTEXT',
      studioAudienceContext: 'SPOOFED_STUDIO_AUDIENCE_CONTEXT',
      studioStrategyContext: 'SPOOFED_STUDIO_STRATEGY_CONTEXT',
    };

    const genDef = resolveExecutablePrompt('content_studio_generate_asset');
    const genCompiled = compilePromptTemplate(genDef, verified, generateVars);
    const genCtxStr = JSON.stringify(genCompiled.contextPayload);

    assert.ok(
      genCompiled.combinedPromptText.length <= CONTENT_STUDIO_PROMPT_TARGET_BUDGET,
      `Studio generate (${scale}) prompt (${genCompiled.combinedPromptText.length}) must be <= ${CONTENT_STUDIO_PROMPT_TARGET_BUDGET}`,
    );
    assert.ok(genCompiled.combinedPromptText.length < ENGINE_MAX_PROMPT_LENGTH);
    assert.ok(genCtxStr.length < ENGINE_MAX_CONTEXT_LENGTH);

    // Determinism & valid JSON variable check
    const genBaseVars = buildPromptVariableMap(verified, generateVars);
    const genOptVars = optimizeContentStudioPromptVariables(
      genDef,
      verified,
      genCompiled.compiledSystemInstructions,
      genBaseVars,
    );
    for (const [k, v] of Object.entries(genOptVars)) {
      const trimmed = v.trim();
      if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
        assert.doesNotThrow(() => JSON.parse(trimmed), `Studio generate (${scale}) var ${k} must be valid JSON`);
      }
    }

    // Refine prompt test with large existing draft
    const refineVars: Record<string, unknown> = {
      ...generateVars,
      refinementAction: 'improve_clarity',
      targetTone: 'Sharper executive authority',
      refinementInstructions: 'Tighten slide headlines and strengthen Slide 1 hook. '.repeat(repeatFactor),
      selectedSectionText: 'Most B2B firms struggle to articulate differentiation. '.repeat(repeatFactor),
      existingDraft: JSON.stringify({
        title: '5-Slide B2B Positioning Diagnostic',
        hook: 'Most B2B firms do not have a posting problem. They have a positioning problem.',
        mainCopy: 'Before increasing publishing cadence, verify that buyers immediately understand your value. '.repeat(
          repeatFactor * 3,
        ),
        cta: 'Comment AUDIT for the scorecard.',
        hashtags: ['#B2BStrategy', '#BrandPositioning'],
        carouselSlides: Array.from({ length: 6 }, (_, i) => ({
          slideNumber: i + 1,
          headline: `Slide ${i + 1}: Positioning Step`,
          body: 'Concrete positioning lesson for B2B founders. '.repeat(repeatFactor),
          visualCue: 'Clean typographic slide',
        })),
      }),
    };

    const refineDef = resolveExecutablePrompt('content_studio_refine_asset');
    const refineCompiled = compilePromptTemplate(refineDef, verified, refineVars);
    const refineCtxStr = JSON.stringify(refineCompiled.contextPayload);

    assert.ok(
      refineCompiled.combinedPromptText.length <= CONTENT_STUDIO_PROMPT_TARGET_BUDGET,
      `Studio refine (${scale}) prompt (${refineCompiled.combinedPromptText.length}) must be <= ${CONTENT_STUDIO_PROMPT_TARGET_BUDGET}`,
    );
    assert.ok(refineCompiled.combinedPromptText.length < ENGINE_MAX_PROMPT_LENGTH);
    assert.ok(refineCtxStr.length < ENGINE_MAX_CONTEXT_LENGTH);

    // Zero unapproved leakage and zero spoofing across both prompts
    for (const forbidden of [
      'UNAPPROVED_STUDIO_OBJ_DO_NOT_LEAK',
      'UNAPPROVED_STUDIO_DIST_DO_NOT_LEAK',
      'SPOOFED_STUDIO_BRAND_CONTEXT',
      'SPOOFED_STUDIO_AUDIENCE_CONTEXT',
      'SPOOFED_STUDIO_STRATEGY_CONTEXT',
    ]) {
      assert.equal(genCompiled.combinedPromptText.includes(forbidden), false);
      assert.equal(genCtxStr.includes(forbidden), false);
      assert.equal(refineCompiled.combinedPromptText.includes(forbidden), false);
      assert.equal(refineCtxStr.includes(forbidden), false);
    }

    // End-to-end executePrompt verification on realistic fixture
    if (scale === 'realistic') {
      const genExec = await executePrompt({
        promptId: 'content_studio_generate_asset',
        brandId: brand.id,
        brand,
        expectedOwnerUserId: brand.userId,
        strategyModules: [...strategyModules, contentStrategyModule],
        variables: generateVars,
        executeAi: async (req) => {
          assert.equal(req.responseMimeType, 'application/json');
          assert.ok(req.responseSchema);
          assert.ok(req.prompt.length <= CONTENT_STUDIO_PROMPT_TARGET_BUDGET);
          return {
            text: JSON.stringify({
              suppliedFactsUsed: ['Brand Positioning', 'Approved Persona 1'],
              missingContextNotes: [],
              researchCaveat: 'AI draft requires explicit human review before publishing.',
              aiSuggestions: {
                creativeRationale: 'Focuses on buyer positioning clarity.',
                platformBestPracticesApplied: ['Crisp cover hook', 'Scannable slides'],
              },
              asset: {
                title: '5-Slide B2B Positioning Diagnostic',
                hook: 'Most B2B consultancies do not have a posting problem.',
                alternativeHooks: ['Fix positioning before scaling publishing volume.'],
                mainCopy: 'Use this 5-slide audit before planning next month’s content.',
                cta: 'Comment AUDIT for the full scorecard.',
                hashtags: ['#B2BStrategy', '#Positioning'],
                visualDirection: 'Clean editorial typography on light canvas',
                carouselSlides: [
                  { slideNumber: 1, headline: 'Stop Posting More', body: 'Fix positioning first.', visualCue: 'Bold cover' },
                ],
                adaptationNotes: 'Ready for LinkedIn native PDF upload.',
              },
            }),
            model: 'gemini-4-hydrogen',
            generatedAt: now,
          };
        },
      });
      assert.equal(genExec.status, 'success');
      assert.equal(genExec.targetModule, 'contentStudio');

      const refineExec = await executePrompt({
        promptId: 'content_studio_refine_asset',
        brandId: brand.id,
        brand,
        expectedOwnerUserId: brand.userId,
        strategyModules: [...strategyModules, contentStrategyModule],
        variables: refineVars,
        executeAi: async (req) => {
          assert.equal(req.responseMimeType, 'application/json');
          assert.ok(req.responseSchema);
          assert.ok(req.prompt.length <= CONTENT_STUDIO_PROMPT_TARGET_BUDGET);
          return {
            text: JSON.stringify({
              suppliedFactsUsed: ['Brand Positioning'],
              missingContextNotes: [],
              researchCaveat: 'AI-refined draft pending human review.',
              aiSuggestions: {
                changeSummary: 'Sharpened cover hook and tightened slide copy.',
                editorialNotes: ['Kept CTA intact.'],
              },
              asset: {
                title: '5-Slide B2B Positioning Diagnostic',
                hook: 'More content will not fix unclear positioning.',
                alternativeHooks: ['Your buyers cannot choose you if you sound like everyone else.'],
                mainCopy: 'Run this 5-minute diagnostic before publishing another post.',
                cta: 'Comment AUDIT for the scorecard.',
                hashtags: ['#B2BStrategy'],
                visualDirection: 'High-contrast slide deck',
              },
            }),
            model: 'gemini-4-hydrogen',
            generatedAt: now,
          };
        },
      });
      assert.equal(refineExec.status, 'success');
      assert.equal(refineExec.targetModule, 'contentStudio');
    }
  }
});





