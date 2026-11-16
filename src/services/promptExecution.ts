import { api } from './api.ts';
import {
  DEFAULT_PROMPT_REGISTRY,
  executePrompt,
  type PromptExecutionResult,
  type PromptRegistry,
} from '../prompts/index.ts';

export interface ExecuteBrandPromptInput {
  brandId: string;
  promptId: string;
  version?: string;
  variables?: Record<string, unknown>;
  includeApprovedModules?: boolean;
  expectedOwnerUserId?: string;
  registry?: PromptRegistry;
}

/**
 * Browser-safe prompt execution helper.
 * Executes registered prompts through the authoritative server-side endpoint
 * (`POST /api/brands/:id/prompts/execute`), which enforces owner authorization,
 * server-side brand isolation, active prompt status, and structured output validation.
 * When a custom non-default registry is supplied (e.g., isolated tests), falls back to
 * `executePrompt` via `api.generateAiContent` (`POST /api/ai/generate`).
 */
export async function executeBrandPrompt(
  input: ExecuteBrandPromptInput,
): Promise<PromptExecutionResult> {
  const brandId = input.brandId.trim();

  if (input.registry && input.registry !== DEFAULT_PROMPT_REGISTRY) {
    const [{ brand }, modulesResponse] = await Promise.all([
      api.getBrand(brandId, false),
      input.includeApprovedModules
        ? api.listStrategyModules(brandId)
        : Promise.resolve({ modules: [] }),
    ]);

    return executePrompt({
      promptId: input.promptId,
      version: input.version,
      brandId,
      brand,
      expectedOwnerUserId: input.expectedOwnerUserId,
      strategyModules: modulesResponse.modules,
      variables: input.variables,
      registry: input.registry,
      executeAi: (request) => api.generateAiContent(request),
    });
  }

  return api.executeBrandPrompt(brandId, {
    promptId: input.promptId,
    version: input.version,
    variables: input.variables,
    includeApprovedModules: input.includeApprovedModules,
  });
}
