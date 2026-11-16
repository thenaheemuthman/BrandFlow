import { supabase } from '../lib/supabase';
import type {
  ActivityEvent,
  AiGenerateRequest,
  AiGenerateResponse,
  Brand,
  BrandFormInput,
  BrandStrategyModule,
  StrategyModuleKey,
  UpsertBrandModuleInput,
  UserProfile,
  WorkspaceOverviewResponse,
} from '../types/brand';
import type { PromptExecutionResult } from '../prompts/types';

async function requestJson<T>(url: string, options?: RequestInit): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('Please sign in to continue.');
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
      ...(options?.headers ?? {}),
    },
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message =
      typeof data?.error === 'string' && data.error
        ? data.error
        : `Request failed with status ${response.status}`;
    throw new Error(message);
  }
  return data as T;
}

export const api = {
  getWorkspaceOverview(): Promise<WorkspaceOverviewResponse> {
    return requestJson<WorkspaceOverviewResponse>('/api/workspace/overview');
  },

  listBrands(): Promise<{ brands: Brand[] }> {
    return requestJson<{ brands: Brand[] }>('/api/brands');
  },

  getBrand(
    brandId: string,
    trackAccess = false,
  ): Promise<{ brand: Brand; activities: ActivityEvent[] }> {
    const query = trackAccess ? '?trackAccess=true' : '';
    return requestJson<{ brand: Brand; activities: ActivityEvent[] }>(
      `/api/brands/${encodeURIComponent(brandId)}${query}`,
    );
  },

  createBrand(input: BrandFormInput): Promise<{ brand: Brand }> {
    return requestJson<{ brand: Brand }>('/api/brands', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  updateBrand(brandId: string, input: BrandFormInput): Promise<{ brand: Brand }> {
    return requestJson<{ brand: Brand }>(
      `/api/brands/${encodeURIComponent(brandId)}`,
      {
        method: 'PUT',
        body: JSON.stringify(input),
      },
    );
  },

  deleteBrand(brandId: string): Promise<{ deleted: boolean }> {
    return requestJson<{ deleted: boolean }>(
      `/api/brands/${encodeURIComponent(brandId)}`,
      {
        method: 'DELETE',
      },
    );
  },

  listStrategyModules(brandId: string): Promise<{ modules: BrandStrategyModule[] }> {
    return requestJson<{ modules: BrandStrategyModule[] }>(
      `/api/brands/${encodeURIComponent(brandId)}/strategy-modules`,
    );
  },

  getStrategyModule(
    brandId: string,
    moduleKey: StrategyModuleKey,
  ): Promise<{ module: BrandStrategyModule }> {
    return requestJson<{ module: BrandStrategyModule }>(
      `/api/brands/${encodeURIComponent(brandId)}/strategy-modules/${encodeURIComponent(moduleKey)}`,
    );
  },

  upsertStrategyModule(
    brandId: string,
    moduleKey: StrategyModuleKey,
    input: UpsertBrandModuleInput,
  ): Promise<{ module: BrandStrategyModule }> {
    return requestJson<{ module: BrandStrategyModule }>(
      `/api/brands/${encodeURIComponent(brandId)}/strategy-modules/${encodeURIComponent(moduleKey)}`,
      {
        method: 'PUT',
        body: JSON.stringify(input),
      },
    );
  },

  deleteStrategyModule(
    brandId: string,
    moduleKey: StrategyModuleKey,
  ): Promise<{ deleted: boolean }> {
    return requestJson<{ deleted: boolean }>(
      `/api/brands/${encodeURIComponent(brandId)}/strategy-modules/${encodeURIComponent(moduleKey)}`,
      {
        method: 'DELETE',
      },
    );
  },

  updateProfile(patch: Partial<UserProfile>): Promise<{ profile: UserProfile }> {
    return requestJson<{ profile: UserProfile }>('/api/profile', {
      method: 'PUT',
      body: JSON.stringify(patch),
    });
  },

  generateAiContent(input: AiGenerateRequest): Promise<AiGenerateResponse> {
    return requestJson<AiGenerateResponse>('/api/ai/generate', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  async executeBrandPrompt(
    brandId: string,
    input: {
      promptId: string;
      version?: string;
      variables?: Record<string, unknown>;
      includeApprovedModules?: boolean;
    },
  ): Promise<PromptExecutionResult> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error('Please sign in to continue.');

    const response = await fetch(
      `/api/brands/${encodeURIComponent(brandId)}/prompts/execute`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(input),
      },
    );

    const data = await response.json().catch(() => ({}));

    if (
      response.ok ||
      (response.status === 422 && data?.status === 'missing_information') ||
      (response.status === 502 && data?.status === 'validation_error')
    ) {
      return data as PromptExecutionResult;
    }

    const message =
      typeof data?.error === 'string' && data.error
        ? data.error
        : `Request failed with status ${response.status}`;
    throw new Error(message);
  },
};
