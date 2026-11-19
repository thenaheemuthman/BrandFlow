import test from 'node:test';
import assert from 'node:assert/strict';
import type { Brand, BrandStrategyModule } from '../types/brand.ts';
import {
  BrandContextIsolationError,
  DEFAULT_PROMPT_DEFINITIONS,
  DEFAULT_PROMPT_REGISTRY,
  PromptNotFoundError,
  PromptRegistryError,
  PromptStatusError,
  buildPromptVariableMap,
  buildStrategyModuleUpsertInput,
  buildVerifiedBrandContext,
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
  assert.equal(reconstructed.length, 4);
  for (const item of reconstructed) {
    assert.equal(item.status, 'active');
  }
  assert.equal(promptIds.includes('customer_personas_synthesis'), true);
  assert.equal(promptIds.includes('customer_audience_interests'), true);
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
