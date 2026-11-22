import { supabase } from '../lib/supabase';
import type {
  ActivityEvent,
  AiGenerateRequest,
  AiGenerateResponse,
  Brand,
  BrandFormInput,
  BrandStrategyModule,
  ContentAsset,
  ContentAssetWithVersions,
  ContentCalendar,
  ContentCalendarItem,
  ContentCalendarWithItems,
  CreateContentAssetInput,
  CreateContentAssetVersionInput,
  CreateContentCalendarInput,
  CreateContentCalendarItemInput,
  StrategyModuleKey,
  UpdateContentAssetInput,
  UpdateContentCalendarInput,
  UpdateContentCalendarItemInput,
  UpsertBrandModuleInput,
  UserProfile,
  WorkspaceOverviewResponse,
} from '../types/brand';
import type { PromptExecutionResult } from '../prompts/types';
import {
  fetchJsonWithResilience,
  fetchPromptExecutionWithResilience,
} from './apiResilience';

async function requestJson<T>(url: string, options?: RequestInit): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('Please sign in to continue.');
  return fetchJsonWithResilience<T>({
    url,
    init: {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
        ...(options?.headers ?? {}),
      },
    },
  });
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

  listContentCalendars(brandId: string): Promise<{ calendars: ContentCalendar[] }> {
    return requestJson<{ calendars: ContentCalendar[] }>(
      `/api/brands/${encodeURIComponent(brandId)}/calendars`,
    );
  },

  getContentCalendar(
    brandId: string,
    calendarId: string,
  ): Promise<{ calendar: ContentCalendarWithItems }> {
    return requestJson<{ calendar: ContentCalendarWithItems }>(
      `/api/brands/${encodeURIComponent(brandId)}/calendars/${encodeURIComponent(calendarId)}`,
    );
  },

  createContentCalendar(
    brandId: string,
    input: CreateContentCalendarInput,
  ): Promise<{ calendar: ContentCalendar }> {
    return requestJson<{ calendar: ContentCalendar }>(
      `/api/brands/${encodeURIComponent(brandId)}/calendars`,
      {
        method: 'POST',
        body: JSON.stringify(input),
      },
    );
  },

  updateContentCalendar(
    brandId: string,
    calendarId: string,
    patch: UpdateContentCalendarInput,
  ): Promise<{ calendar: ContentCalendar }> {
    return requestJson<{ calendar: ContentCalendar }>(
      `/api/brands/${encodeURIComponent(brandId)}/calendars/${encodeURIComponent(calendarId)}`,
      {
        method: 'PATCH',
        body: JSON.stringify(patch),
      },
    );
  },

  deleteContentCalendar(
    brandId: string,
    calendarId: string,
  ): Promise<{ deleted: boolean }> {
    return requestJson<{ deleted: boolean }>(
      `/api/brands/${encodeURIComponent(brandId)}/calendars/${encodeURIComponent(calendarId)}`,
      {
        method: 'DELETE',
      },
    );
  },

  saveCalendarBatchItems(
    brandId: string,
    calendarId: string,
    items: CreateContentCalendarItemInput[],
    replaceBatchIndex?: number | null,
  ): Promise<{ items: ContentCalendarItem[] }> {
    return requestJson<{ items: ContentCalendarItem[] }>(
      `/api/brands/${encodeURIComponent(brandId)}/calendars/${encodeURIComponent(calendarId)}/items/batch`,
      {
        method: 'POST',
        body: JSON.stringify({ items, replaceBatchIndex }),
      },
    );
  },

  createCalendarItem(
    brandId: string,
    calendarId: string,
    input: CreateContentCalendarItemInput,
  ): Promise<{ item: ContentCalendarItem }> {
    return requestJson<{ item: ContentCalendarItem }>(
      `/api/brands/${encodeURIComponent(brandId)}/calendars/${encodeURIComponent(calendarId)}/items`,
      {
        method: 'POST',
        body: JSON.stringify(input),
      },
    );
  },

  updateCalendarItem(
    brandId: string,
    calendarId: string,
    itemId: string,
    patch: UpdateContentCalendarItemInput,
  ): Promise<{ item: ContentCalendarItem }> {
    return requestJson<{ item: ContentCalendarItem }>(
      `/api/brands/${encodeURIComponent(brandId)}/calendars/${encodeURIComponent(calendarId)}/items/${encodeURIComponent(itemId)}`,
      {
        method: 'PATCH',
        body: JSON.stringify(patch),
      },
    );
  },

  deleteCalendarItem(
    brandId: string,
    calendarId: string,
    itemId: string,
  ): Promise<{ deleted: boolean }> {
    return requestJson<{ deleted: boolean }>(
      `/api/brands/${encodeURIComponent(brandId)}/calendars/${encodeURIComponent(calendarId)}/items/${encodeURIComponent(itemId)}`,
      {
        method: 'DELETE',
      },
    );
  },

  listContentAssets(brandId: string): Promise<{ assets: ContentAsset[] }> {
    return requestJson<{ assets: ContentAsset[] }>(
      `/api/brands/${encodeURIComponent(brandId)}/content-assets`,
    );
  },

  getContentAsset(
    brandId: string,
    assetId: string,
  ): Promise<{ asset: ContentAssetWithVersions }> {
    return requestJson<{ asset: ContentAssetWithVersions }>(
      `/api/brands/${encodeURIComponent(brandId)}/content-assets/${encodeURIComponent(assetId)}`,
    );
  },

  createContentAsset(
    brandId: string,
    input: CreateContentAssetInput,
  ): Promise<{ asset: ContentAssetWithVersions }> {
    return requestJson<{ asset: ContentAssetWithVersions }>(
      `/api/brands/${encodeURIComponent(brandId)}/content-assets`,
      {
        method: 'POST',
        body: JSON.stringify(input),
      },
    );
  },

  updateContentAsset(
    brandId: string,
    assetId: string,
    patch: UpdateContentAssetInput,
  ): Promise<{ asset: ContentAssetWithVersions }> {
    return requestJson<{ asset: ContentAssetWithVersions }>(
      `/api/brands/${encodeURIComponent(brandId)}/content-assets/${encodeURIComponent(assetId)}`,
      {
        method: 'PATCH',
        body: JSON.stringify(patch),
      },
    );
  },

  createContentAssetVersion(
    brandId: string,
    assetId: string,
    input: CreateContentAssetVersionInput,
  ): Promise<{ asset: ContentAssetWithVersions }> {
    return requestJson<{ asset: ContentAssetWithVersions }>(
      `/api/brands/${encodeURIComponent(brandId)}/content-assets/${encodeURIComponent(assetId)}/versions`,
      {
        method: 'POST',
        body: JSON.stringify(input),
      },
    );
  },

  deleteContentAsset(
    brandId: string,
    assetId: string,
  ): Promise<{ deleted: boolean }> {
    return requestJson<{ deleted: boolean }>(
      `/api/brands/${encodeURIComponent(brandId)}/content-assets/${encodeURIComponent(assetId)}`,
      {
        method: 'DELETE',
      },
    );
  },

  async executeBrandPrompt(
    brandId: string,
    input: {
      promptId: string;
      version?: string;
      variables?: Record<string, unknown>;
      includeApprovedModules?: boolean;
      signal?: AbortSignal;
    },
  ): Promise<PromptExecutionResult> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error('Please sign in to continue.');

    const { signal, ...body } = input;
    return fetchPromptExecutionWithResilience({
      url: `/api/brands/${encodeURIComponent(brandId)}/prompts/execute`,
      init: {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(body),
        signal,
      },
    });
  },
};
