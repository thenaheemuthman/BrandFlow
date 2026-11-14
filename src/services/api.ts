import type {
  ActivityEvent,
  Brand,
  BrandFormInput,
  UserProfile,
  WorkspaceOverviewResponse,
} from '../types/brand';

async function requestJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
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

  updateProfile(patch: Partial<UserProfile>): Promise<{ profile: UserProfile }> {
    return requestJson<{ profile: UserProfile }>('/api/profile', {
      method: 'PUT',
      body: JSON.stringify(patch),
    });
  },
};
