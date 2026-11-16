import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import type {
  ActivityEvent,
  ActivityType,
  Brand,
  BrandFormInput,
  BrandModuleStatuses,
  BrandStrategyModule,
  ModuleStatus,
  Phase2AModuleKey,
  StorageStatus,
  StrategyModuleContent,
  StrategyModuleKey,
  UpsertBrandModuleInput,
  UserProfile,
} from '../src/types/brand.ts';

const DEFAULT_USER_ID = 'user-default';

const DEFAULT_PROFILE: UserProfile = {
  id: DEFAULT_USER_ID,
  fullName: 'Naheem Uthman',
  email: '',
  role: 'Brand Strategist',
  organization: 'BrandFlow Workspace',
};

function defaultModuleStatuses(): BrandModuleStatuses {
  return {
    brandFoundation: 'not_started',
    brandMessaging: 'not_started',
    customerIntelligence: 'not_started',
    marketingStrategy: 'not_started',
    contentStrategy: 'not_started',
    contentCalendar: 'not_started',
    contentStudio: 'not_started',
  };
}

function sanitizeInput(input: BrandFormInput): BrandFormInput {
  return {
    brandName: String(input.brandName ?? '').trim(),
    businessDescription: String(input.businessDescription ?? '').trim(),
    industry: String(input.industry ?? '').trim(),
    productsOrServices: String(input.productsOrServices ?? '').trim(),
    targetMarket: String(input.targetMarket ?? '').trim(),
    primaryLocation: String(input.primaryLocation ?? '').trim(),
    websiteUrl: String(input.websiteUrl ?? '').trim(),
    socialLinks: String(input.socialLinks ?? '').trim(),
    existingMission: String(input.existingMission ?? '').trim(),
    existingVision: String(input.existingVision ?? '').trim(),
    marketingChallenges: String(input.marketingChallenges ?? '').trim(),
    businessGoals: String(input.businessGoals ?? '').trim(),
    competitors: String(input.competitors ?? '').trim(),
    additionalNotes: String(input.additionalNotes ?? '').trim(),
  };
}

export function validateServerBrandInput(input: BrandFormInput): string | null {
  const clean = sanitizeInput(input);
  if (!clean.brandName || clean.brandName.length < 2) {
    return 'Brand name must be at least 2 characters.';
  }
  if (!clean.businessDescription || clean.businessDescription.length < 10) {
    return 'Business description must be at least 10 characters.';
  }
  if (!clean.industry) return 'Industry is required.';
  if (!clean.productsOrServices) return 'Products or services are required.';
  if (!clean.targetMarket) return 'Target market is required.';
  if (!clean.primaryLocation) return 'Primary business location is required.';

  if (clean.websiteUrl) {
    try {
      const parsed = new URL(clean.websiteUrl);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return 'Website URL must start with http:// or https://.';
      }
    } catch {
      return 'Website URL is invalid.';
    }
  }
  return null;
}

export class BrandAccessError extends Error {
  constructor(message = 'Brand not found or access denied.') {
    super(message);
    this.name = 'BrandAccessError';
  }
}

export class ModuleValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ModuleValidationError';
  }
}

export const PHASE_2A_MODULE_KEYS: readonly Phase2AModuleKey[] = [
  'brandFoundation',
  'brandMessaging',
];

export const STRATEGY_MODULE_KEYS: readonly StrategyModuleKey[] = [
  'brandFoundation',
  'brandMessaging',
  'customerIntelligence',
];

export const MODULE_STATUSES: readonly ModuleStatus[] = [
  'not_started',
  'in_progress',
  'completed',
];

const STRATEGY_MODULE_LABELS: Record<StrategyModuleKey, string> = {
  brandFoundation: 'Brand Foundation',
  brandMessaging: 'Brand Messaging',
  customerIntelligence: 'Customer Intelligence',
};

export function isValidPhase2AModuleKey(moduleKey: string): moduleKey is Phase2AModuleKey {
  return PHASE_2A_MODULE_KEYS.includes(moduleKey as Phase2AModuleKey);
}

export function isValidStrategyModuleKey(moduleKey: string): moduleKey is StrategyModuleKey {
  return STRATEGY_MODULE_KEYS.includes(moduleKey as StrategyModuleKey);
}

export function isValidModuleStatus(status: string): status is ModuleStatus {
  return MODULE_STATUSES.includes(status as ModuleStatus);
}

function assertValidModuleKey(moduleKey: string): asserts moduleKey is StrategyModuleKey {
  if (!isValidStrategyModuleKey(moduleKey)) {
    throw new ModuleValidationError(`Unsupported strategy module key: ${moduleKey}`);
  }
}

function assertValidModuleStatus(status: string): asserts status is ModuleStatus {
  if (!isValidModuleStatus(status)) {
    throw new ModuleValidationError(`Invalid module status: ${status}`);
  }
}

function sanitizeModuleContent(content: unknown): StrategyModuleContent {
  if (typeof content !== 'object' || content === null || Array.isArray(content)) {
    throw new ModuleValidationError('Strategy module content must be a JSON object.');
  }
  return JSON.parse(JSON.stringify(content)) as StrategyModuleContent;
}

function buildModuleActivity(
  status: ModuleStatus,
  moduleKey: StrategyModuleKey,
  brandName: string,
): { type: ActivityType; description: string } {
  const label = STRATEGY_MODULE_LABELS[moduleKey];
  if (status === 'completed') {
    return {
      type: 'module_completed',
      description: `Completed ${label} for ${brandName}`,
    };
  }
  if (status === 'in_progress') {
    return {
      type: 'module_updated',
      description: `Saved ${label} for ${brandName}`,
    };
  }
  return {
    type: 'module_updated',
    description: `Updated ${label} status for ${brandName}`,
  };
}

export interface StorageRepository {
  getStorageStatus(): StorageStatus;
  listBrands(): Promise<Brand[]>;
  getBrand(id: string, trackAccess?: boolean): Promise<Brand | null>;
  createBrand(input: BrandFormInput): Promise<Brand>;
  updateBrand(id: string, input: BrandFormInput): Promise<Brand | null>;
  deleteBrand(id: string): Promise<boolean>;
  listBrandModules(brandId: string): Promise<BrandStrategyModule[]>;
  getBrandModule(brandId: string, moduleKey: StrategyModuleKey): Promise<BrandStrategyModule | null>;
  upsertBrandModule(
    brandId: string,
    moduleKey: StrategyModuleKey,
    data: UpsertBrandModuleInput,
  ): Promise<BrandStrategyModule>;
  deleteBrandModule(brandId: string, moduleKey: StrategyModuleKey): Promise<boolean>;
  listActivities(brandId?: string): Promise<ActivityEvent[]>;
  getProfile(): Promise<UserProfile>;
  updateProfile(patch: Partial<UserProfile>): Promise<UserProfile>;
}

interface LocalDatabaseFile {
  brands: Brand[];
  activities: ActivityEvent[];
  profile: UserProfile;
  brandModules: BrandStrategyModule[];
}

export class LocalJsonStorageRepository implements StorageRepository {
  private readonly filePath: string;
  private readonly userId: string;
  private readonly userEmail: string;
  private writeQueue: Promise<void> = Promise.resolve();

  constructor(userId = DEFAULT_USER_ID, userEmail = '', dataDir = process.env.VERCEL
      ? path.join(os.tmpdir(), 'brandflow-data')
      : path.resolve(process.cwd(), '.data'),
  ) {
    this.userId = userId;
    this.userEmail = userEmail;
    this.filePath = path.join(dataDir, 'brandflow-db.json');
  }

  getStorageStatus(): StorageStatus {
    return getEnvironmentStorageStatus('local-file');
  }

  private async readDb(): Promise<LocalDatabaseFile> {
    try {
      const raw = await fs.readFile(this.filePath, 'utf-8');
      const parsed = JSON.parse(raw) as Partial<LocalDatabaseFile>;
      return {
        brands: Array.isArray(parsed.brands) ? parsed.brands : [],
        activities: Array.isArray(parsed.activities) ? parsed.activities : [],
        profile: parsed.profile ? { ...DEFAULT_PROFILE, ...parsed.profile, id: this.userId, email: this.userEmail || parsed.profile.email || DEFAULT_PROFILE.email } : { ...DEFAULT_PROFILE, id: this.userId, email: this.userEmail || DEFAULT_PROFILE.email },
        brandModules: Array.isArray(parsed.brandModules) ? parsed.brandModules : [],
      };
    } catch {
      const initial: LocalDatabaseFile = {
        brands: [],
        activities: [],
        profile: { ...DEFAULT_PROFILE, id: this.userId, email: this.userEmail || DEFAULT_PROFILE.email },
        brandModules: [],
      };
      await this.writeDb(initial);
      return initial;
    }
  }

  private async writeDb(data: LocalDatabaseFile): Promise<void> {
    const dir = path.dirname(this.filePath);
    await fs.mkdir(dir, { recursive: true });
    const tmpPath = `${this.filePath}.${crypto.randomUUID()}.tmp`;
    await fs.writeFile(tmpPath, JSON.stringify(data, null, 2), 'utf-8');
    await fs.rename(tmpPath, this.filePath);
  }

  private runSerialized<T>(fn: () => Promise<T>): Promise<T> {
    const result = this.writeQueue.then(fn, fn);
    this.writeQueue = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  private buildActivity(
    brandId: string | null,
    brandName: string,
    type: ActivityType,
    description: string,
  ): ActivityEvent {
    return {
      id: crypto.randomUUID(),
      userId: this.userId,
      brandId,
      brandName,
      type,
      description,
      createdAt: new Date().toISOString(),
    };
  }

  async listBrands(): Promise<Brand[]> {
    const db = await this.readDb();
    return [...db.brands].sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );
  }

  async getBrand(id: string, trackAccess = false): Promise<Brand | null> {
    return this.runSerialized(async () => {
      const db = await this.readDb();
      const index = db.brands.findIndex((b) => b.id === id);
      if (index === -1) return null;

      if (trackAccess) {
        const now = new Date().toISOString();
        const brand = db.brands[index];
        db.brands[index] = {
          ...brand,
          lastAccessedAt: now,
        };
        const recentSameAccess = db.activities.find(
          (a) =>
            a.brandId === brand.id &&
            a.type === 'workspace_accessed' &&
            Date.now() - new Date(a.createdAt).getTime() < 5 * 60 * 1000,
        );
        if (!recentSameAccess) {
          db.activities.unshift(
            this.buildActivity(
              brand.id,
              brand.brandName,
              'workspace_accessed',
              `Opened ${brand.brandName} workspace`,
            ),
          );
          db.activities = db.activities.slice(0, 50);
        }
        await this.writeDb(db);
        return db.brands[index];
      }

      return db.brands[index];
    });
  }

  async createBrand(input: BrandFormInput): Promise<Brand> {
    return this.runSerialized(async () => {
      const db = await this.readDb();
      const clean = sanitizeInput(input);
      const now = new Date().toISOString();
      const brand: Brand = {
        id: crypto.randomUUID(),
        userId: this.userId,
        brandName: clean.brandName,
        businessDescription: clean.businessDescription,
        industry: clean.industry,
        productsOrServices: clean.productsOrServices,
        targetMarket: clean.targetMarket,
        primaryLocation: clean.primaryLocation,
        websiteUrl: clean.websiteUrl ?? '',
        socialLinks: clean.socialLinks ?? '',
        existingMission: clean.existingMission ?? '',
        existingVision: clean.existingVision ?? '',
        marketingChallenges: clean.marketingChallenges ?? '',
        businessGoals: clean.businessGoals ?? '',
        competitors: clean.competitors ?? '',
        additionalNotes: clean.additionalNotes ?? '',
        moduleStatuses: defaultModuleStatuses(),
        contentPiecesCount: 0,
        pendingApprovalsCount: 0,
        createdAt: now,
        updatedAt: now,
        lastAccessedAt: now,
      };

      db.brands.unshift(brand);
      db.activities.unshift(
        this.buildActivity(
          brand.id,
          brand.brandName,
          'brand_created',
          `Created brand ${brand.brandName}`,
        ),
      );
      db.activities = db.activities.slice(0, 50);
      await this.writeDb(db);
      return brand;
    });
  }

  async updateBrand(id: string, input: BrandFormInput): Promise<Brand | null> {
    return this.runSerialized(async () => {
      const db = await this.readDb();
      const index = db.brands.findIndex((b) => b.id === id);
      if (index === -1) return null;

      const clean = sanitizeInput(input);
      const existing = db.brands[index];
      const now = new Date().toISOString();
      const updated: Brand = {
        ...existing,
        brandName: clean.brandName,
        businessDescription: clean.businessDescription,
        industry: clean.industry,
        productsOrServices: clean.productsOrServices,
        targetMarket: clean.targetMarket,
        primaryLocation: clean.primaryLocation,
        websiteUrl: clean.websiteUrl ?? '',
        socialLinks: clean.socialLinks ?? '',
        existingMission: clean.existingMission ?? '',
        existingVision: clean.existingVision ?? '',
        marketingChallenges: clean.marketingChallenges ?? '',
        businessGoals: clean.businessGoals ?? '',
        competitors: clean.competitors ?? '',
        additionalNotes: clean.additionalNotes ?? '',
        updatedAt: now,
      };

      db.brands[index] = updated;
      db.activities.unshift(
        this.buildActivity(
          updated.id,
          updated.brandName,
          'brand_updated',
          `Updated brand details for ${updated.brandName}`,
        ),
      );
      db.activities = db.activities.slice(0, 50);
      await this.writeDb(db);
      return updated;
    });
  }

  async deleteBrand(id: string): Promise<boolean> {
    return this.runSerialized(async () => {
      const db = await this.readDb();
      const existing = db.brands.find((b) => b.id === id && b.userId === this.userId);
      if (!existing) return false;

      db.brands = db.brands.filter((b) => b.id !== id);
      db.brandModules = db.brandModules.filter((m) => m.brandId !== id);
      db.activities.unshift(
        this.buildActivity(
          null,
          existing.brandName,
          'brand_deleted',
          `Deleted brand ${existing.brandName}`,
        ),
      );
      db.activities = db.activities.slice(0, 50);
      await this.writeDb(db);
      return true;
    });
  }

  private requireOwnedBrand(
    db: LocalDatabaseFile,
    brandId: string,
  ): { brand: Brand; index: number } {
    const index = db.brands.findIndex(
      (b) => b.id === brandId && b.userId === this.userId,
    );
    if (index === -1) {
      throw new BrandAccessError('Brand not found or access denied.');
    }
    return { brand: db.brands[index], index };
  }

  async listBrandModules(brandId: string): Promise<BrandStrategyModule[]> {
    const db = await this.readDb();
    this.requireOwnedBrand(db, brandId);
    return db.brandModules
      .filter((m) => m.brandId === brandId && m.userId === this.userId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  async getBrandModule(
    brandId: string,
    moduleKey: StrategyModuleKey,
  ): Promise<BrandStrategyModule | null> {
    assertValidModuleKey(moduleKey);
    const db = await this.readDb();
    this.requireOwnedBrand(db, brandId);
    return (
      db.brandModules.find(
        (m) =>
          m.brandId === brandId &&
          m.moduleKey === moduleKey &&
          m.userId === this.userId,
      ) ?? null
    );
  }

  async upsertBrandModule(
    brandId: string,
    moduleKey: StrategyModuleKey,
    data: UpsertBrandModuleInput,
  ): Promise<BrandStrategyModule> {
    assertValidModuleKey(moduleKey);
    if (data.status !== undefined) {
      assertValidModuleStatus(data.status);
    }
    const sanitizedContent =
      data.content !== undefined ? sanitizeModuleContent(data.content) : undefined;

    return this.runSerialized(async () => {
      const db = await this.readDb();
      const { brand, index: brandIndex } = this.requireOwnedBrand(db, brandId);
      const now = new Date().toISOString();

      const existingIndex = db.brandModules.findIndex(
        (m) =>
          m.brandId === brandId &&
          m.moduleKey === moduleKey &&
          m.userId === this.userId,
      );
      const existing = existingIndex !== -1 ? db.brandModules[existingIndex] : null;
      const nextStatus: ModuleStatus = data.status ?? existing?.status ?? 'not_started';

      const moduleRecord: BrandStrategyModule = {
        id: existing?.id ?? crypto.randomUUID(),
        userId: this.userId,
        brandId,
        moduleKey,
        status: nextStatus,
        content: sanitizedContent ?? existing?.content ?? {},
        promptId: data.promptId !== undefined ? data.promptId : (existing?.promptId ?? null),
        promptVersion:
          data.promptVersion !== undefined
            ? data.promptVersion
            : (existing?.promptVersion ?? null),
        model: data.model !== undefined ? data.model : (existing?.model ?? null),
        generatedAt:
          data.generatedAt !== undefined
            ? data.generatedAt
            : (existing?.generatedAt ?? null),
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      };

      if (existingIndex !== -1) {
        db.brandModules[existingIndex] = moduleRecord;
      } else {
        db.brandModules.push(moduleRecord);
      }

      const nextStatuses: BrandModuleStatuses = {
        ...defaultModuleStatuses(),
        ...(brand.moduleStatuses ?? defaultModuleStatuses()),
        [moduleKey]: nextStatus,
      };

      db.brands[brandIndex] = {
        ...brand,
        moduleStatuses: nextStatuses,
        updatedAt: now,
      };

      const activity = buildModuleActivity(nextStatus, moduleKey, brand.brandName);
      db.activities.unshift(
        this.buildActivity(brand.id, brand.brandName, activity.type, activity.description),
      );
      db.activities = db.activities.slice(0, 50);

      await this.writeDb(db);
      return moduleRecord;
    });
  }

  async deleteBrandModule(
    brandId: string,
    moduleKey: StrategyModuleKey,
  ): Promise<boolean> {
    assertValidModuleKey(moduleKey);

    return this.runSerialized(async () => {
      const db = await this.readDb();
      const { brand, index: brandIndex } = this.requireOwnedBrand(db, brandId);

      const existingIndex = db.brandModules.findIndex(
        (m) =>
          m.brandId === brandId &&
          m.moduleKey === moduleKey &&
          m.userId === this.userId,
      );
      if (existingIndex === -1) return false;

      db.brandModules.splice(existingIndex, 1);

      const now = new Date().toISOString();
      const nextStatuses: BrandModuleStatuses = {
        ...defaultModuleStatuses(),
        ...(brand.moduleStatuses ?? defaultModuleStatuses()),
        [moduleKey]: 'not_started',
      };

      db.brands[brandIndex] = {
        ...brand,
        moduleStatuses: nextStatuses,
        updatedAt: now,
      };

      db.activities.unshift(
        this.buildActivity(
          brand.id,
          brand.brandName,
          'module_updated',
          `Removed ${STRATEGY_MODULE_LABELS[moduleKey]} for ${brand.brandName}`,
        ),
      );
      db.activities = db.activities.slice(0, 50);

      await this.writeDb(db);
      return true;
    });
  }

  async listActivities(brandId?: string): Promise<ActivityEvent[]> {
    const db = await this.readDb();
    const list = brandId
      ? db.activities.filter((a) => a.brandId === brandId)
      : db.activities;
    return list.slice(0, 20);
  }

  async getProfile(): Promise<UserProfile> {
    const db = await this.readDb();
    return db.profile;
  }

  async updateProfile(patch: Partial<UserProfile>): Promise<UserProfile> {
    return this.runSerialized(async () => {
      const db = await this.readDb();
      db.profile = {
        ...db.profile,
        fullName: patch.fullName !== undefined ? patch.fullName.trim() || db.profile.fullName : db.profile.fullName,
        email: patch.email !== undefined ? patch.email.trim() || db.profile.email : db.profile.email,
        role: patch.role !== undefined ? patch.role.trim() || db.profile.role : db.profile.role,
        organization: patch.organization !== undefined ? patch.organization.trim() || db.profile.organization : db.profile.organization,
      };
      await this.writeDb(db);
      return db.profile;
    });
  }
}

interface SupabaseBrandRow {
  id: string;
  user_id: string;
  brand_name: string;
  business_description: string;
  industry: string;
  products_or_services: string;
  target_market: string;
  primary_location: string;
  website_url: string;
  social_links: string;
  existing_mission: string;
  existing_vision: string;
  marketing_challenges: string;
  business_goals: string;
  competitors: string;
  additional_notes: string;
  module_statuses: BrandModuleStatuses;
  content_pieces_count: number;
  pending_approvals_count: number;
  created_at: string;
  updated_at: string;
  last_accessed_at: string;
}

function mapSupabaseRowToBrand(row: SupabaseBrandRow): Brand {
  return {
    id: row.id,
    userId: row.user_id,
    brandName: row.brand_name,
    businessDescription: row.business_description,
    industry: row.industry,
    productsOrServices: row.products_or_services,
    targetMarket: row.target_market,
    primaryLocation: row.primary_location,
    websiteUrl: row.website_url ?? '',
    socialLinks: row.social_links ?? '',
    existingMission: row.existing_mission ?? '',
    existingVision: row.existing_vision ?? '',
    marketingChallenges: row.marketing_challenges ?? '',
    businessGoals: row.business_goals ?? '',
    competitors: row.competitors ?? '',
    additionalNotes: row.additional_notes ?? '',
    moduleStatuses: row.module_statuses ?? defaultModuleStatuses(),
    contentPiecesCount: row.content_pieces_count ?? 0,
    pendingApprovalsCount: row.pending_approvals_count ?? 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastAccessedAt: row.last_accessed_at,
  };
}

interface SupabaseBrandModuleRow {
  id: string;
  user_id: string;
  brand_id: string;
  module_key: StrategyModuleKey;
  status: ModuleStatus;
  content: StrategyModuleContent;
  prompt_id: string | null;
  prompt_version: string | null;
  model: string | null;
  generated_at: string | null;
  created_at: string;
  updated_at: string;
}

function mapSupabaseRowToBrandModule(row: SupabaseBrandModuleRow): BrandStrategyModule {
  return {
    id: row.id,
    userId: row.user_id,
    brandId: row.brand_id,
    moduleKey: row.module_key,
    status: row.status,
    content: row.content ?? {},
    promptId: row.prompt_id ?? null,
    promptVersion: row.prompt_version ?? null,
    model: row.model ?? null,
    generatedAt: row.generated_at ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class SupabaseStorageRepository implements StorageRepository {
  private readonly baseUrl: string;
  private readonly anonKey: string;
  private readonly accessToken: string;
  private readonly userId: string;
  private readonly userEmail: string;

  constructor(supabaseUrl: string, anonKey: string, accessToken: string, userId: string, userEmail: string) {
    this.baseUrl = supabaseUrl.replace(/\/+$/, '');
    this.anonKey = anonKey;
    this.accessToken = accessToken;
    this.userId = userId;
    this.userEmail = userEmail;
  }

  getStorageStatus(): StorageStatus {
    return getEnvironmentStorageStatus('supabase');
  }

  private async request<T>(
    tablePath: string,
    options: RequestInit = {},
  ): Promise<T> {
    const res = await fetch(`${this.baseUrl}/rest/v1/${tablePath}`, {
      ...options,
      headers: {
        apikey: this.anonKey,
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
        ...(options.headers ?? {}),
      },
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Supabase request failed (${res.status}): ${body}`);
    }
    if (res.status === 204) return undefined as T;
    const text = await res.text();
    return text ? (JSON.parse(text) as T) : (undefined as T);
  }

  async listBrands(): Promise<Brand[]> {
    const rows = await this.request<SupabaseBrandRow[]>(
      'brands?select=*&order=updated_at.desc',
    );
    return rows.map(mapSupabaseRowToBrand);
  }

  async getBrand(id: string, trackAccess = false): Promise<Brand | null> {
    const rows = await this.request<SupabaseBrandRow[]>(
      `brands?id=eq.${encodeURIComponent(id)}&select=*`,
    );
    const row = rows[0];
    if (!row) return null;

    if (trackAccess) {
      const now = new Date().toISOString();
      await this.request(`brands?id=eq.${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ last_accessed_at: now }),
      });
      await this.request('brand_activities', {
        method: 'POST',
        body: JSON.stringify({
          user_id: this.userId,
          brand_id: row.id,
          brand_name: row.brand_name,
          type: 'workspace_accessed',
          description: `Opened ${row.brand_name} workspace`,
        }),
      });
      row.last_accessed_at = now;
    }

    return mapSupabaseRowToBrand(row);
  }

  async createBrand(input: BrandFormInput): Promise<Brand> {
    const clean = sanitizeInput(input);
    const rows = await this.request<SupabaseBrandRow[]>('brands', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({
        user_id: this.userId,
        brand_name: clean.brandName,
        business_description: clean.businessDescription,
        industry: clean.industry,
        products_or_services: clean.productsOrServices,
        target_market: clean.targetMarket,
        primary_location: clean.primaryLocation,
        website_url: clean.websiteUrl ?? '',
        social_links: clean.socialLinks ?? '',
        existing_mission: clean.existingMission ?? '',
        existing_vision: clean.existingVision ?? '',
        marketing_challenges: clean.marketingChallenges ?? '',
        business_goals: clean.businessGoals ?? '',
        competitors: clean.competitors ?? '',
        additional_notes: clean.additionalNotes ?? '',
        module_statuses: defaultModuleStatuses(),
      }),
    });
    const created = mapSupabaseRowToBrand(rows[0]);
    await this.request('brand_activities', {
      method: 'POST',
      body: JSON.stringify({
        user_id: this.userId,
        brand_id: created.id,
        brand_name: created.brandName,
        type: 'brand_created',
        description: `Created brand ${created.brandName}`,
      }),
    });
    return created;
  }

  async updateBrand(id: string, input: BrandFormInput): Promise<Brand | null> {
    const clean = sanitizeInput(input);
    const rows = await this.request<SupabaseBrandRow[]>(
      `brands?id=eq.${encodeURIComponent(id)}`,
      {
        method: 'PATCH',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify({
          brand_name: clean.brandName,
          business_description: clean.businessDescription,
          industry: clean.industry,
          products_or_services: clean.productsOrServices,
          target_market: clean.targetMarket,
          primary_location: clean.primaryLocation,
          website_url: clean.websiteUrl ?? '',
          social_links: clean.socialLinks ?? '',
          existing_mission: clean.existingMission ?? '',
          existing_vision: clean.existingVision ?? '',
          marketing_challenges: clean.marketingChallenges ?? '',
          business_goals: clean.businessGoals ?? '',
          competitors: clean.competitors ?? '',
          additional_notes: clean.additionalNotes ?? '',
          updated_at: new Date().toISOString(),
        }),
      },
    );
    if (!rows[0]) return null;
    const updated = mapSupabaseRowToBrand(rows[0]);
    await this.request('brand_activities', {
      method: 'POST',
      body: JSON.stringify({
        user_id: this.userId,
        brand_id: updated.id,
        brand_name: updated.brandName,
        type: 'brand_updated',
        description: `Updated brand details for ${updated.brandName}`,
      }),
    });
    return updated;
  }

  async deleteBrand(id: string): Promise<boolean> {
    const existing = await this.getBrand(id, false);
    if (!existing) return false;
    await this.request(`brands?id=eq.${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    await this.request('brand_activities', {
      method: 'POST',
      body: JSON.stringify({
        user_id: this.userId,
        brand_id: null,
        brand_name: existing.brandName,
        type: 'brand_deleted',
        description: `Deleted brand ${existing.brandName}`,
      }),
    });
    return true;
  }

  private async requireOwnedBrand(brandId: string): Promise<Brand> {
    const brand = await this.getBrand(brandId, false);
    if (!brand || brand.userId !== this.userId) {
      throw new BrandAccessError('Brand not found or access denied.');
    }
    return brand;
  }

  async listBrandModules(brandId: string): Promise<BrandStrategyModule[]> {
    await this.requireOwnedBrand(brandId);
    const rows = await this.request<SupabaseBrandModuleRow[]>(
      `brand_strategy_modules?brand_id=eq.${encodeURIComponent(brandId)}&user_id=eq.${encodeURIComponent(this.userId)}&select=*&order=created_at.asc`,
    );
    return rows.map(mapSupabaseRowToBrandModule);
  }

  async getBrandModule(
    brandId: string,
    moduleKey: StrategyModuleKey,
  ): Promise<BrandStrategyModule | null> {
    assertValidModuleKey(moduleKey);
    await this.requireOwnedBrand(brandId);
    const rows = await this.request<SupabaseBrandModuleRow[]>(
      `brand_strategy_modules?brand_id=eq.${encodeURIComponent(brandId)}&module_key=eq.${encodeURIComponent(moduleKey)}&user_id=eq.${encodeURIComponent(this.userId)}&select=*`,
    );
    return rows[0] ? mapSupabaseRowToBrandModule(rows[0]) : null;
  }

  async upsertBrandModule(
    brandId: string,
    moduleKey: StrategyModuleKey,
    data: UpsertBrandModuleInput,
  ): Promise<BrandStrategyModule> {
    assertValidModuleKey(moduleKey);
    if (data.status !== undefined) {
      assertValidModuleStatus(data.status);
    }
    const sanitizedContent =
      data.content !== undefined ? sanitizeModuleContent(data.content) : undefined;

    const brand = await this.requireOwnedBrand(brandId);
    const existingRows = await this.request<SupabaseBrandModuleRow[]>(
      `brand_strategy_modules?brand_id=eq.${encodeURIComponent(brandId)}&module_key=eq.${encodeURIComponent(moduleKey)}&user_id=eq.${encodeURIComponent(this.userId)}&select=*`,
    );
    const existing = existingRows[0] ? mapSupabaseRowToBrandModule(existingRows[0]) : null;

    const now = new Date().toISOString();
    const nextStatus: ModuleStatus = data.status ?? existing?.status ?? 'not_started';
    const nextContent = sanitizedContent ?? existing?.content ?? {};
    const nextPromptId =
      data.promptId !== undefined ? data.promptId : (existing?.promptId ?? null);
    const nextPromptVersion =
      data.promptVersion !== undefined
        ? data.promptVersion
        : (existing?.promptVersion ?? null);
    const nextModel = data.model !== undefined ? data.model : (existing?.model ?? null);
    const nextGeneratedAt =
      data.generatedAt !== undefined
        ? data.generatedAt
        : (existing?.generatedAt ?? null);

    let savedRow: SupabaseBrandModuleRow;
    if (existing) {
      const updatedRows = await this.request<SupabaseBrandModuleRow[]>(
        `brand_strategy_modules?id=eq.${encodeURIComponent(existing.id)}&user_id=eq.${encodeURIComponent(this.userId)}`,
        {
          method: 'PATCH',
          headers: { Prefer: 'return=representation' },
          body: JSON.stringify({
            status: nextStatus,
            content: nextContent,
            prompt_id: nextPromptId,
            prompt_version: nextPromptVersion,
            model: nextModel,
            generated_at: nextGeneratedAt,
            updated_at: now,
          }),
        },
      );
      savedRow = updatedRows[0];
    } else {
      const insertedRows = await this.request<SupabaseBrandModuleRow[]>(
        'brand_strategy_modules?on_conflict=brand_id,module_key',
        {
          method: 'POST',
          headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
          body: JSON.stringify({
            user_id: this.userId,
            brand_id: brandId,
            module_key: moduleKey,
            status: nextStatus,
            content: nextContent,
            prompt_id: nextPromptId,
            prompt_version: nextPromptVersion,
            model: nextModel,
            generated_at: nextGeneratedAt,
            updated_at: now,
          }),
        },
      );
      savedRow = insertedRows[0];
    }

    const nextStatuses: BrandModuleStatuses = {
      ...defaultModuleStatuses(),
      ...(brand.moduleStatuses ?? defaultModuleStatuses()),
      [moduleKey]: nextStatus,
    };

    await this.request(
      `brands?id=eq.${encodeURIComponent(brandId)}&user_id=eq.${encodeURIComponent(this.userId)}`,
      {
        method: 'PATCH',
        body: JSON.stringify({
          module_statuses: nextStatuses,
          updated_at: now,
        }),
      },
    );

    const activity = buildModuleActivity(nextStatus, moduleKey, brand.brandName);
    await this.request('brand_activities', {
      method: 'POST',
      body: JSON.stringify({
        user_id: this.userId,
        brand_id: brand.id,
        brand_name: brand.brandName,
        type: activity.type,
        description: activity.description,
      }),
    });

    return mapSupabaseRowToBrandModule(savedRow);
  }

  async deleteBrandModule(
    brandId: string,
    moduleKey: StrategyModuleKey,
  ): Promise<boolean> {
    assertValidModuleKey(moduleKey);
    const brand = await this.requireOwnedBrand(brandId);

    const deletedRows = await this.request<SupabaseBrandModuleRow[]>(
      `brand_strategy_modules?brand_id=eq.${encodeURIComponent(brandId)}&module_key=eq.${encodeURIComponent(moduleKey)}&user_id=eq.${encodeURIComponent(this.userId)}`,
      {
        method: 'DELETE',
        headers: { Prefer: 'return=representation' },
      },
    );

    if (!deletedRows || deletedRows.length === 0) {
      return false;
    }

    const now = new Date().toISOString();
    const nextStatuses: BrandModuleStatuses = {
      ...defaultModuleStatuses(),
      ...(brand.moduleStatuses ?? defaultModuleStatuses()),
      [moduleKey]: 'not_started',
    };

    await this.request(
      `brands?id=eq.${encodeURIComponent(brandId)}&user_id=eq.${encodeURIComponent(this.userId)}`,
      {
        method: 'PATCH',
        body: JSON.stringify({
          module_statuses: nextStatuses,
          updated_at: now,
        }),
      },
    );

    await this.request('brand_activities', {
      method: 'POST',
      body: JSON.stringify({
        user_id: this.userId,
        brand_id: brand.id,
        brand_name: brand.brandName,
        type: 'module_updated',
        description: `Removed ${STRATEGY_MODULE_LABELS[moduleKey]} for ${brand.brandName}`,
      }),
    });

    return true;
  }

  async listActivities(brandId?: string): Promise<ActivityEvent[]> {
    const filter = brandId ? `brand_id=eq.${encodeURIComponent(brandId)}&` : '';
    const rows = await this.request<
      Array<{
        id: string;
        user_id: string;
        brand_id: string | null;
        brand_name: string;
        type: ActivityType;
        description: string;
        created_at: string;
      }>
    >(`brand_activities?${filter}select=*&order=created_at.desc&limit=20`);
    return rows.map((r) => ({
      id: r.id,
      userId: r.user_id,
      brandId: r.brand_id,
      brandName: r.brand_name,
      type: r.type,
      description: r.description,
      createdAt: r.created_at,
    }));
  }

  async getProfile(): Promise<UserProfile> {
    const rows = await this.request<
      Array<{
        id: string;
        full_name: string;
        email: string;
        role: string;
        organization: string;
      }>
    >(`workspace_profiles?id=eq.${this.userId}&select=*`);
    if (!rows[0]) {
      const profile = { ...DEFAULT_PROFILE, id: this.userId, email: this.userEmail || DEFAULT_PROFILE.email };
      await this.request('workspace_profiles', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates' }, body: JSON.stringify({ id: profile.id, full_name: profile.fullName, email: profile.email, role: profile.role, organization: profile.organization }) });
      return profile;
    }
    return {
      id: rows[0].id,
      fullName: rows[0].full_name,
      email: rows[0].email,
      role: rows[0].role,
      organization: rows[0].organization,
    };
  }

  async updateProfile(patch: Partial<UserProfile>): Promise<UserProfile> {
    const current = await this.getProfile();
    const next: UserProfile = {
      ...current,
      fullName: patch.fullName?.trim() || current.fullName,
      email: patch.email?.trim() || current.email,
      role: patch.role?.trim() || current.role,
      organization: patch.organization?.trim() || current.organization,
    };
    await this.request('workspace_profiles', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates' },
      body: JSON.stringify({
        id: next.id,
        full_name: next.fullName,
        email: next.email,
        role: next.role,
        organization: next.organization,
        updated_at: new Date().toISOString(),
      }),
    });
    return next;
  }
}

export function getEnvironmentStorageStatus(
  mode: 'supabase' | 'local-file',
): StorageStatus {
  const hasUrl = Boolean(process.env.SUPABASE_URL?.trim());
  const hasAnon = Boolean(process.env.SUPABASE_ANON_KEY?.trim());
  const hasGemini = Boolean(
    process.env.GEMINI_API_KEY?.trim() &&
      process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY',
  );

  return {
    mode,
    persisted: mode === 'supabase' || !Boolean(process.env.VERCEL),
    supabaseConfigured: hasUrl && hasAnon,
    geminiConfigured: hasGemini,
    requiredEnvVars: [
      {
        key: 'SUPABASE_URL',
        configured: hasUrl,
        purpose: 'Project REST & PostgreSQL endpoint for Supabase persistence',
      },
      {
        key: 'SUPABASE_ANON_KEY',
        configured: hasAnon,
        purpose: 'Public Supabase key used with the signed-in user token and database row security',
      },
      {
        key: 'GEMINI_API_KEY',
        configured: hasGemini,
        purpose: 'Server-side Gemini API key for Phase 2+ AI strategy generation',
      },
    ],
  };
}

export function createStorageRepository(userId: string, accessToken: string, userEmail: string): StorageRepository {
  const supabaseUrl = process.env.SUPABASE_URL?.trim();
  const anonKey = process.env.SUPABASE_ANON_KEY?.trim();
  if (supabaseUrl && anonKey && accessToken) {
    return new SupabaseStorageRepository(supabaseUrl, anonKey, accessToken, userId, userEmail);
  }
  if (process.env.NODE_ENV === 'production' || process.env.VERCEL) {
    throw new Error('Cloud storage is not configured. Set SUPABASE_URL and SUPABASE_ANON_KEY.');
  }
  return new LocalJsonStorageRepository(userId, userEmail);
}
