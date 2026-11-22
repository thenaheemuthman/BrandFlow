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
  CalendarItemSource,
  CalendarWorkflowStatus,
  ContentAsset,
  ContentAssetBody,
  ContentAssetFormatCategory,
  ContentAssetSource,
  ContentAssetStatus,
  ContentAssetVersion,
  ContentAssetWithVersions,
  ContentCalendar,
  ContentCalendarItem,
  ContentCalendarStatus,
  ContentCalendarWithItems,
  ContentLengthPreference,
  ContentStudioGenerationOptions,
  ContentStudioHandoffPayload,
  CreateContentAssetInput,
  CreateContentAssetVersionInput,
  CreateContentCalendarInput,
  CreateContentCalendarItemInput,
  ModuleStatus,
  Phase2AModuleKey,
  StorageStatus,
  StrategyModuleContent,
  StrategyModuleKey,
  UpdateContentAssetInput,
  UpdateContentCalendarInput,
  UpdateContentCalendarItemInput,
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

export class CalendarValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CalendarValidationError';
  }
}

export class ContentAssetValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ContentAssetValidationError';
  }
}

export const CONTENT_ASSET_STATUSES: readonly ContentAssetStatus[] = [
  'draft',
  'in_progress',
  'ready_for_review',
  'approved',
  'published',
  'archived',
];

export const CONTENT_ASSET_FORMAT_CATEGORIES: readonly ContentAssetFormatCategory[] = [
  'social_post',
  'educational_post',
  'promotional_post',
  'story_post',
  'short_video_script',
  'carousel',
  'long_form_article',
  'platform_adaptation',
];

export const CONTENT_ASSET_SOURCES: readonly ContentAssetSource[] = [
  'ai_generated',
  'edited_ai',
  'manual',
];

export const CONTENT_LENGTH_PREFERENCES: readonly ContentLengthPreference[] = [
  'short',
  'medium',
  'long',
];

export function isValidContentAssetStatus(value: string): value is ContentAssetStatus {
  return CONTENT_ASSET_STATUSES.includes(value as ContentAssetStatus);
}

export function isValidContentAssetFormatCategory(
  value: string,
): value is ContentAssetFormatCategory {
  return CONTENT_ASSET_FORMAT_CATEGORIES.includes(value as ContentAssetFormatCategory);
}

export function isValidContentAssetSource(value: string): value is ContentAssetSource {
  return CONTENT_ASSET_SOURCES.includes(value as ContentAssetSource);
}

export function isValidContentLengthPreference(
  value: string,
): value is ContentLengthPreference {
  return CONTENT_LENGTH_PREFERENCES.includes(value as ContentLengthPreference);
}

function sanitizeAssetBody(raw: unknown): ContentAssetBody {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new ContentAssetValidationError('body must be a valid JSON object.');
  }
  const obj = raw as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
  const strArr = (v: unknown) =>
    Array.isArray(v)
      ? v.filter((x): x is string => typeof x === 'string' && x.trim().length > 0).map((x) => x.trim())
      : [];

  const carouselSlides = Array.isArray(obj.carouselSlides)
    ? obj.carouselSlides
        .filter((s): s is Record<string, unknown> => typeof s === 'object' && s !== null && !Array.isArray(s))
        .map((s, idx) => ({
          slideNumber:
            typeof s.slideNumber === 'number' && Number.isFinite(s.slideNumber) && s.slideNumber > 0
              ? Math.round(s.slideNumber)
              : idx + 1,
          headline: str(s.headline),
          body: str(s.body),
          visualCue: str(s.visualCue),
        }))
    : [];

  let videoScript: ContentAssetBody['videoScript'] = null;
  if (typeof obj.videoScript === 'object' && obj.videoScript !== null && !Array.isArray(obj.videoScript)) {
    const vs = obj.videoScript as Record<string, unknown>;
    const scenes = Array.isArray(vs.scenes)
      ? vs.scenes
          .filter((sc): sc is Record<string, unknown> => typeof sc === 'object' && sc !== null && !Array.isArray(sc))
          .map((sc, idx) => ({
            sceneNumber:
              typeof sc.sceneNumber === 'number' && Number.isFinite(sc.sceneNumber) && sc.sceneNumber > 0
                ? Math.round(sc.sceneNumber)
                : idx + 1,
            visual: str(sc.visual),
            dialogue: str(sc.dialogue),
            durationHint: str(sc.durationHint),
          }))
      : [];
    videoScript = {
      hook: str(vs.hook),
      scenes,
      cta: str(vs.cta),
    };
  }

  const articleSections = Array.isArray(obj.articleSections)
    ? obj.articleSections
        .filter((sec): sec is Record<string, unknown> => typeof sec === 'object' && sec !== null && !Array.isArray(sec))
        .map((sec) => ({
          heading: str(sec.heading),
          body: str(sec.body),
        }))
    : [];

  return {
    hook: str(obj.hook),
    alternativeHooks: strArr(obj.alternativeHooks),
    mainCopy: str(obj.mainCopy),
    cta: str(obj.cta),
    hashtags: strArr(obj.hashtags),
    visualDirection: str(obj.visualDirection),
    carouselSlides,
    videoScript,
    articleSections,
    adaptationNotes: str(obj.adaptationNotes),
    suppliedFactsUsed: strArr(obj.suppliedFactsUsed),
    missingContextNotes: strArr(obj.missingContextNotes),
    researchCaveat: str(obj.researchCaveat),
  };
}

function defaultGenerationOptions(
  platform: string,
  formatCategory: ContentAssetFormatCategory,
  formatLabel: string,
  toneOfVoice: string,
  contentLength: ContentLengthPreference,
  contentObjective: string,
  targetAudience: string,
): ContentStudioGenerationOptions {
  return {
    platform,
    formatCategory,
    formatLabel,
    toneOfVoice,
    contentLength,
    primaryObjective: contentObjective,
    targetAudience,
    ctaPreference: '',
    additionalInstructions: '',
  };
}

function deriveContentStudioMetrics(
  assets: readonly Pick<ContentAsset, 'workflowStatus'>[],
): {
  moduleStatus: ModuleStatus;
  contentPiecesCount: number;
  pendingApprovalsCount: number;
} {
  const nonArchived = assets.filter((a) => a.workflowStatus !== 'archived');
  const contentPiecesCount = nonArchived.length;
  const pendingApprovalsCount = nonArchived.filter(
    (a) => a.workflowStatus === 'ready_for_review',
  ).length;
  let moduleStatus: ModuleStatus = 'not_started';
  if (assets.some((a) => a.workflowStatus === 'approved' || a.workflowStatus === 'published')) {
    moduleStatus = 'completed';
  } else if (assets.length > 0) {
    moduleStatus = 'in_progress';
  }
  return { moduleStatus, contentPiecesCount, pendingApprovalsCount };
}

export const CONTENT_CALENDAR_STATUSES: readonly ContentCalendarStatus[] = [
  'draft',
  'generating',
  'partial',
  'active',
  'completed',
  'archived',
];

export const CALENDAR_WORKFLOW_STATUSES: readonly CalendarWorkflowStatus[] = [
  'planned',
  'in_progress',
  'ready_for_review',
  'approved',
  'published',
  'skipped',
];

export const CALENDAR_ITEM_SOURCES: readonly CalendarItemSource[] = [
  'ai_generated',
  'edited_ai',
  'manual',
];

export function isValidContentCalendarStatus(value: string): value is ContentCalendarStatus {
  return CONTENT_CALENDAR_STATUSES.includes(value as ContentCalendarStatus);
}

export function isValidCalendarWorkflowStatus(value: string): value is CalendarWorkflowStatus {
  return CALENDAR_WORKFLOW_STATUSES.includes(value as CalendarWorkflowStatus);
}

export function isValidCalendarItemSource(value: string): value is CalendarItemSource {
  return CALENDAR_ITEM_SOURCES.includes(value as CalendarItemSource);
}

export function isValidIsoDateString(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

function sanitizeCalendarItemInput(
  input: CreateContentCalendarItemInput,
): CreateContentCalendarItemInput {
  const scheduledDate = String(input.scheduledDate ?? '').trim();
  if (!isValidIsoDateString(scheduledDate)) {
    throw new CalendarValidationError('scheduledDate must be a valid YYYY-MM-DD date.');
  }
  const platform = String(input.platform ?? '').trim();
  if (!platform) {
    throw new CalendarValidationError('platform is required.');
  }
  const title = String(input.title ?? '').trim();
  if (!title || title.length < 2) {
    throw new CalendarValidationError('title must be at least 2 characters.');
  }
  const workflowStatus: CalendarWorkflowStatus = input.workflowStatus ?? 'planned';
  if (!isValidCalendarWorkflowStatus(workflowStatus)) {
    throw new CalendarValidationError(`Invalid workflowStatus: ${workflowStatus}`);
  }
  const source: CalendarItemSource = input.source ?? 'ai_generated';
  if (!isValidCalendarItemSource(source)) {
    throw new CalendarValidationError(`Invalid calendar item source: ${source}`);
  }
  return {
    scheduledDate,
    suggestedTime: String(input.suggestedTime ?? '').trim(),
    platform,
    title,
    contentPillar: String(input.contentPillar ?? '').trim(),
    contentTheme: String(input.contentTheme ?? '').trim(),
    contentFormat: String(input.contentFormat ?? '').trim(),
    contentSeries: String(input.contentSeries ?? '').trim(),
    targetAudience: String(input.targetAudience ?? '').trim(),
    audiencePainPoint: String(input.audiencePainPoint ?? '').trim(),
    contentObjective: String(input.contentObjective ?? '').trim(),
    relatedMarketingObjective: String(input.relatedMarketingObjective ?? '').trim(),
    coreMessage: String(input.coreMessage ?? '').trim(),
    suggestedAngle: String(input.suggestedAngle ?? '').trim(),
    intendedCta: String(input.intendedCta ?? '').trim(),
    relevantKpi: String(input.relevantKpi ?? '').trim(),
    productionNotes: String(input.productionNotes ?? '').trim(),
    workflowStatus,
    batchIndex: typeof input.batchIndex === 'number' && Number.isInteger(input.batchIndex)
      ? input.batchIndex
      : null,
    source,
    sortOrder: typeof input.sortOrder === 'number' && Number.isFinite(input.sortOrder)
      ? Math.round(input.sortOrder)
      : 0,
  };
}

function deriveContentCalendarModuleStatus(
  calendars: readonly Pick<ContentCalendar, 'status'>[],
): ModuleStatus {
  if (calendars.length === 0) return 'not_started';
  if (calendars.some((c) => c.status === 'active' || c.status === 'completed')) {
    return 'completed';
  }
  return 'in_progress';
}

export const PHASE_2A_MODULE_KEYS: readonly Phase2AModuleKey[] = [
  'brandFoundation',
  'brandMessaging',
];

export const STRATEGY_MODULE_KEYS: readonly StrategyModuleKey[] = [
  'brandFoundation',
  'brandMessaging',
  'customerIntelligence',
  'marketingStrategy',
  'contentStrategy',
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
  marketingStrategy: 'Marketing Strategy',
  contentStrategy: 'Content Strategy',
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
  listContentCalendars(brandId: string): Promise<ContentCalendar[]>;
  getContentCalendar(brandId: string, calendarId: string): Promise<ContentCalendarWithItems | null>;
  createContentCalendar(
    brandId: string,
    input: CreateContentCalendarInput,
  ): Promise<ContentCalendar>;
  updateContentCalendar(
    brandId: string,
    calendarId: string,
    patch: UpdateContentCalendarInput,
  ): Promise<ContentCalendar | null>;
  deleteContentCalendar(brandId: string, calendarId: string): Promise<boolean>;
  createContentCalendarItems(
    brandId: string,
    calendarId: string,
    items: CreateContentCalendarItemInput[],
    replaceBatchIndex?: number | null,
  ): Promise<ContentCalendarItem[]>;
  createContentCalendarItem(
    brandId: string,
    calendarId: string,
    input: CreateContentCalendarItemInput,
  ): Promise<ContentCalendarItem>;
  updateContentCalendarItem(
    brandId: string,
    calendarId: string,
    itemId: string,
    patch: UpdateContentCalendarItemInput,
  ): Promise<ContentCalendarItem | null>;
  deleteContentCalendarItem(
    brandId: string,
    calendarId: string,
    itemId: string,
  ): Promise<boolean>;
  listContentAssets(brandId: string): Promise<ContentAsset[]>;
  getContentAsset(brandId: string, assetId: string): Promise<ContentAssetWithVersions | null>;
  createContentAsset(brandId: string, input: CreateContentAssetInput): Promise<ContentAssetWithVersions>;
  updateContentAsset(
    brandId: string,
    assetId: string,
    patch: UpdateContentAssetInput,
  ): Promise<ContentAssetWithVersions | null>;
  createContentAssetVersion(
    brandId: string,
    assetId: string,
    input: CreateContentAssetVersionInput,
  ): Promise<ContentAssetWithVersions | null>;
  deleteContentAsset(brandId: string, assetId: string): Promise<boolean>;
  listActivities(brandId?: string): Promise<ActivityEvent[]>;
  getProfile(): Promise<UserProfile>;
  updateProfile(patch: Partial<UserProfile>): Promise<UserProfile>;
}

interface LocalDatabaseFile {
  brands: Brand[];
  activities: ActivityEvent[];
  profile: UserProfile;
  brandModules: BrandStrategyModule[];
  contentCalendars: ContentCalendar[];
  contentCalendarItems: ContentCalendarItem[];
  contentAssets: ContentAsset[];
  contentAssetVersions: ContentAssetVersion[];
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
        contentCalendars: Array.isArray(parsed.contentCalendars) ? parsed.contentCalendars : [],
        contentCalendarItems: Array.isArray(parsed.contentCalendarItems) ? parsed.contentCalendarItems : [],
        contentAssets: Array.isArray(parsed.contentAssets) ? parsed.contentAssets : [],
        contentAssetVersions: Array.isArray(parsed.contentAssetVersions) ? parsed.contentAssetVersions : [],
      };
    } catch {
      const initial: LocalDatabaseFile = {
        brands: [],
        activities: [],
        profile: { ...DEFAULT_PROFILE, id: this.userId, email: this.userEmail || DEFAULT_PROFILE.email },
        brandModules: [],
        contentCalendars: [],
        contentCalendarItems: [],
        contentAssets: [],
        contentAssetVersions: [],
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
      db.contentCalendars = db.contentCalendars.filter((c) => c.brandId !== id);
      db.contentCalendarItems = db.contentCalendarItems.filter((item) => item.brandId !== id);
      db.contentAssets = db.contentAssets.filter((a) => a.brandId !== id);
      db.contentAssetVersions = db.contentAssetVersions.filter((v) => v.brandId !== id);
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

  private syncLocalCalendarModuleStatus(db: LocalDatabaseFile, brandIndex: number, now: string) {
    const brand = db.brands[brandIndex];
    const brandCalendars = db.contentCalendars.filter(
      (c) => c.brandId === brand.id && c.userId === this.userId,
    );
    const derivedStatus = deriveContentCalendarModuleStatus(brandCalendars);
    db.brands[brandIndex] = {
      ...brand,
      moduleStatuses: {
        ...defaultModuleStatuses(),
        ...(brand.moduleStatuses ?? defaultModuleStatuses()),
        contentCalendar: derivedStatus,
      },
      updatedAt: now,
    };
  }

  async listContentCalendars(brandId: string): Promise<ContentCalendar[]> {
    const db = await this.readDb();
    this.requireOwnedBrand(db, brandId);
    return db.contentCalendars
      .filter((c) => c.brandId === brandId && c.userId === this.userId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async getContentCalendar(
    brandId: string,
    calendarId: string,
  ): Promise<ContentCalendarWithItems | null> {
    const db = await this.readDb();
    this.requireOwnedBrand(db, brandId);
    const calendar = db.contentCalendars.find(
      (c) => c.id === calendarId && c.brandId === brandId && c.userId === this.userId,
    );
    if (!calendar) return null;
    const items = db.contentCalendarItems
      .filter(
        (item) =>
          item.calendarId === calendarId &&
          item.brandId === brandId &&
          item.userId === this.userId,
      )
      .sort(
        (a, b) =>
          a.scheduledDate.localeCompare(b.scheduledDate) ||
          a.sortOrder - b.sortOrder ||
          a.createdAt.localeCompare(b.createdAt),
      );
    return { ...calendar, items };
  }

  async createContentCalendar(
    brandId: string,
    input: CreateContentCalendarInput,
  ): Promise<ContentCalendar> {
    const name = String(input.name ?? '').trim();
    if (!name || name.length < 2) {
      throw new CalendarValidationError('Calendar name must be at least 2 characters.');
    }
    const startDate = String(input.startDate ?? '').trim();
    const endDate = String(input.endDate ?? '').trim();
    if (!isValidIsoDateString(startDate) || !isValidIsoDateString(endDate)) {
      throw new CalendarValidationError('startDate and endDate must be valid YYYY-MM-DD dates.');
    }
    if (endDate < startDate) {
      throw new CalendarValidationError('endDate cannot be earlier than startDate.');
    }
    const status: ContentCalendarStatus = input.status ?? 'draft';
    if (!isValidContentCalendarStatus(status)) {
      throw new CalendarValidationError(`Invalid calendar status: ${status}`);
    }

    return this.runSerialized(async () => {
      const db = await this.readDb();
      const { brand, index: brandIndex } = this.requireOwnedBrand(db, brandId);
      const now = new Date().toISOString();
      const record: ContentCalendar = {
        id: crypto.randomUUID(),
        userId: this.userId,
        brandId,
        name,
        startDate,
        endDate,
        durationDays: Math.min(90, Math.max(1, Math.round(input.durationDays ?? 30))),
        status,
        settings: JSON.parse(JSON.stringify(input.settings)),
        upstreamSnapshot: input.upstreamSnapshot
          ? JSON.parse(JSON.stringify(input.upstreamSnapshot))
          : {},
        generationState: input.generationState
          ? JSON.parse(JSON.stringify(input.generationState))
          : null,
        promptId: input.promptId ?? null,
        promptVersion: input.promptVersion ?? null,
        model: input.model ?? null,
        generatedAt: input.generatedAt ?? null,
        createdAt: now,
        updatedAt: now,
      };
      db.contentCalendars.unshift(record);
      this.syncLocalCalendarModuleStatus(db, brandIndex, now);
      db.activities.unshift(
        this.buildActivity(
          brand.id,
          brand.brandName,
          'module_updated',
          `Created Content Calendar "${record.name}" for ${brand.brandName}`,
        ),
      );
      db.activities = db.activities.slice(0, 50);
      await this.writeDb(db);
      return record;
    });
  }

  async updateContentCalendar(
    brandId: string,
    calendarId: string,
    patch: UpdateContentCalendarInput,
  ): Promise<ContentCalendar | null> {
    if (patch.status !== undefined && !isValidContentCalendarStatus(patch.status)) {
      throw new CalendarValidationError(`Invalid calendar status: ${patch.status}`);
    }
    if (patch.startDate !== undefined && !isValidIsoDateString(patch.startDate)) {
      throw new CalendarValidationError('startDate must be a valid YYYY-MM-DD date.');
    }
    if (patch.endDate !== undefined && !isValidIsoDateString(patch.endDate)) {
      throw new CalendarValidationError('endDate must be a valid YYYY-MM-DD date.');
    }

    return this.runSerialized(async () => {
      const db = await this.readDb();
      const { brand, index: brandIndex } = this.requireOwnedBrand(db, brandId);
      const idx = db.contentCalendars.findIndex(
        (c) => c.id === calendarId && c.brandId === brandId && c.userId === this.userId,
      );
      if (idx === -1) return null;

      const existing = db.contentCalendars[idx];
      const nextStart = patch.startDate ?? existing.startDate;
      const nextEnd = patch.endDate ?? existing.endDate;
      if (nextEnd < nextStart) {
        throw new CalendarValidationError('endDate cannot be earlier than startDate.');
      }
      const now = new Date().toISOString();
      const updated: ContentCalendar = {
        ...existing,
        name: patch.name !== undefined ? patch.name.trim() || existing.name : existing.name,
        startDate: nextStart,
        endDate: nextEnd,
        durationDays:
          patch.durationDays !== undefined
            ? Math.min(90, Math.max(1, Math.round(patch.durationDays)))
            : existing.durationDays,
        status: patch.status ?? existing.status,
        settings:
          patch.settings !== undefined
            ? JSON.parse(JSON.stringify(patch.settings))
            : existing.settings,
        upstreamSnapshot:
          patch.upstreamSnapshot !== undefined
            ? JSON.parse(JSON.stringify(patch.upstreamSnapshot))
            : existing.upstreamSnapshot,
        generationState:
          patch.generationState !== undefined
            ? patch.generationState
              ? JSON.parse(JSON.stringify(patch.generationState))
              : null
            : existing.generationState,
        promptId: patch.promptId !== undefined ? patch.promptId : existing.promptId,
        promptVersion:
          patch.promptVersion !== undefined ? patch.promptVersion : existing.promptVersion,
        model: patch.model !== undefined ? patch.model : existing.model,
        generatedAt: patch.generatedAt !== undefined ? patch.generatedAt : existing.generatedAt,
        updatedAt: now,
      };
      db.contentCalendars[idx] = updated;
      this.syncLocalCalendarModuleStatus(db, brandIndex, now);

      if (patch.status === 'active' || patch.status === 'completed') {
        db.activities.unshift(
          this.buildActivity(
            brand.id,
            brand.brandName,
            'module_completed',
            `Finalized Content Calendar "${updated.name}" for ${brand.brandName}`,
          ),
        );
        db.activities = db.activities.slice(0, 50);
      }

      await this.writeDb(db);
      return updated;
    });
  }

  async deleteContentCalendar(brandId: string, calendarId: string): Promise<boolean> {
    return this.runSerialized(async () => {
      const db = await this.readDb();
      const { brand, index: brandIndex } = this.requireOwnedBrand(db, brandId);
      const idx = db.contentCalendars.findIndex(
        (c) => c.id === calendarId && c.brandId === brandId && c.userId === this.userId,
      );
      if (idx === -1) return false;
      const removed = db.contentCalendars[idx];
      db.contentCalendars.splice(idx, 1);
      db.contentCalendarItems = db.contentCalendarItems.filter(
        (item) => !(item.calendarId === calendarId && item.brandId === brandId),
      );
      const now = new Date().toISOString();
      this.syncLocalCalendarModuleStatus(db, brandIndex, now);
      db.activities.unshift(
        this.buildActivity(
          brand.id,
          brand.brandName,
          'module_updated',
          `Deleted Content Calendar "${removed.name}" for ${brand.brandName}`,
        ),
      );
      db.activities = db.activities.slice(0, 50);
      await this.writeDb(db);
      return true;
    });
  }

  async createContentCalendarItems(
    brandId: string,
    calendarId: string,
    items: CreateContentCalendarItemInput[],
    replaceBatchIndex?: number | null,
  ): Promise<ContentCalendarItem[]> {
    const sanitized = items.map((item) => sanitizeCalendarItemInput(item));

    return this.runSerialized(async () => {
      const db = await this.readDb();
      this.requireOwnedBrand(db, brandId);
      const calendarIdx = db.contentCalendars.findIndex(
        (c) => c.id === calendarId && c.brandId === brandId && c.userId === this.userId,
      );
      if (calendarIdx === -1) {
        throw new CalendarValidationError('Content calendar not found for this brand.');
      }

      if (typeof replaceBatchIndex === 'number' && Number.isInteger(replaceBatchIndex)) {
        db.contentCalendarItems = db.contentCalendarItems.filter(
          (item) =>
            !(
              item.calendarId === calendarId &&
              item.brandId === brandId &&
              item.userId === this.userId &&
              item.batchIndex === replaceBatchIndex
            ),
        );
      }

      const now = new Date().toISOString();
      const created: ContentCalendarItem[] = sanitized.map((entry) => ({
        id: crypto.randomUUID(),
        userId: this.userId,
        brandId,
        calendarId,
        scheduledDate: entry.scheduledDate,
        suggestedTime: entry.suggestedTime ?? '',
        platform: entry.platform,
        title: entry.title,
        contentPillar: entry.contentPillar,
        contentTheme: entry.contentTheme ?? '',
        contentFormat: entry.contentFormat,
        contentSeries: entry.contentSeries ?? '',
        targetAudience: entry.targetAudience,
        audiencePainPoint: entry.audiencePainPoint ?? '',
        contentObjective: entry.contentObjective,
        relatedMarketingObjective: entry.relatedMarketingObjective ?? '',
        coreMessage: entry.coreMessage,
        suggestedAngle: entry.suggestedAngle ?? '',
        intendedCta: entry.intendedCta ?? '',
        relevantKpi: entry.relevantKpi ?? '',
        productionNotes: entry.productionNotes ?? '',
        workflowStatus: entry.workflowStatus ?? 'planned',
        batchIndex: entry.batchIndex ?? null,
        source: entry.source ?? 'ai_generated',
        sortOrder: entry.sortOrder ?? 0,
        createdAt: now,
        updatedAt: now,
      }));

      db.contentCalendarItems.push(...created);
      db.contentCalendars[calendarIdx] = {
        ...db.contentCalendars[calendarIdx],
        updatedAt: now,
      };
      await this.writeDb(db);
      return created;
    });
  }

  async createContentCalendarItem(
    brandId: string,
    calendarId: string,
    input: CreateContentCalendarItemInput,
  ): Promise<ContentCalendarItem> {
    const [created] = await this.createContentCalendarItems(brandId, calendarId, [input]);
    return created;
  }

  async updateContentCalendarItem(
    brandId: string,
    calendarId: string,
    itemId: string,
    patch: UpdateContentCalendarItemInput,
  ): Promise<ContentCalendarItem | null> {
    if (patch.scheduledDate !== undefined && !isValidIsoDateString(patch.scheduledDate)) {
      throw new CalendarValidationError('scheduledDate must be a valid YYYY-MM-DD date.');
    }
    if (patch.workflowStatus !== undefined && !isValidCalendarWorkflowStatus(patch.workflowStatus)) {
      throw new CalendarValidationError(`Invalid workflowStatus: ${patch.workflowStatus}`);
    }
    if (patch.source !== undefined && !isValidCalendarItemSource(patch.source)) {
      throw new CalendarValidationError(`Invalid source: ${patch.source}`);
    }

    return this.runSerialized(async () => {
      const db = await this.readDb();
      this.requireOwnedBrand(db, brandId);
      const calExists = db.contentCalendars.some(
        (c) => c.id === calendarId && c.brandId === brandId && c.userId === this.userId,
      );
      if (!calExists) return null;

      const idx = db.contentCalendarItems.findIndex(
        (item) =>
          item.id === itemId &&
          item.calendarId === calendarId &&
          item.brandId === brandId &&
          item.userId === this.userId,
      );
      if (idx === -1) return null;

      const existing = db.contentCalendarItems[idx];
      const now = new Date().toISOString();
      const updated: ContentCalendarItem = {
        ...existing,
        scheduledDate: patch.scheduledDate ?? existing.scheduledDate,
        suggestedTime:
          patch.suggestedTime !== undefined ? patch.suggestedTime.trim() : existing.suggestedTime,
        platform: patch.platform !== undefined ? patch.platform.trim() || existing.platform : existing.platform,
        title: patch.title !== undefined ? patch.title.trim() || existing.title : existing.title,
        contentPillar:
          patch.contentPillar !== undefined ? patch.contentPillar.trim() : existing.contentPillar,
        contentTheme:
          patch.contentTheme !== undefined ? patch.contentTheme.trim() : existing.contentTheme,
        contentFormat:
          patch.contentFormat !== undefined ? patch.contentFormat.trim() : existing.contentFormat,
        contentSeries:
          patch.contentSeries !== undefined ? patch.contentSeries.trim() : existing.contentSeries,
        targetAudience:
          patch.targetAudience !== undefined ? patch.targetAudience.trim() : existing.targetAudience,
        audiencePainPoint:
          patch.audiencePainPoint !== undefined
            ? patch.audiencePainPoint.trim()
            : existing.audiencePainPoint,
        contentObjective:
          patch.contentObjective !== undefined
            ? patch.contentObjective.trim()
            : existing.contentObjective,
        relatedMarketingObjective:
          patch.relatedMarketingObjective !== undefined
            ? patch.relatedMarketingObjective.trim()
            : existing.relatedMarketingObjective,
        coreMessage:
          patch.coreMessage !== undefined ? patch.coreMessage.trim() : existing.coreMessage,
        suggestedAngle:
          patch.suggestedAngle !== undefined ? patch.suggestedAngle.trim() : existing.suggestedAngle,
        intendedCta:
          patch.intendedCta !== undefined ? patch.intendedCta.trim() : existing.intendedCta,
        relevantKpi:
          patch.relevantKpi !== undefined ? patch.relevantKpi.trim() : existing.relevantKpi,
        productionNotes:
          patch.productionNotes !== undefined
            ? patch.productionNotes.trim()
            : existing.productionNotes,
        workflowStatus: patch.workflowStatus ?? existing.workflowStatus,
        batchIndex: patch.batchIndex !== undefined ? patch.batchIndex : existing.batchIndex,
        source:
          patch.source ??
          (existing.source === 'ai_generated' ? 'edited_ai' : existing.source),
        sortOrder:
          patch.sortOrder !== undefined && Number.isFinite(patch.sortOrder)
            ? Math.round(patch.sortOrder)
            : existing.sortOrder,
        updatedAt: now,
      };
      db.contentCalendarItems[idx] = updated;
      await this.writeDb(db);
      return updated;
    });
  }

  async deleteContentCalendarItem(
    brandId: string,
    calendarId: string,
    itemId: string,
  ): Promise<boolean> {
    return this.runSerialized(async () => {
      const db = await this.readDb();
      this.requireOwnedBrand(db, brandId);
      const idx = db.contentCalendarItems.findIndex(
        (item) =>
          item.id === itemId &&
          item.calendarId === calendarId &&
          item.brandId === brandId &&
          item.userId === this.userId,
      );
      if (idx === -1) return false;
      db.contentCalendarItems.splice(idx, 1);
      await this.writeDb(db);
      return true;
    });
  }

  private syncLocalContentStudioMetrics(db: LocalDatabaseFile, brandId: string, now: string) {
    const brandIdx = db.brands.findIndex((b) => b.id === brandId && b.userId === this.userId);
    if (brandIdx === -1) return;
    const brandAssets = db.contentAssets.filter(
      (a) => a.brandId === brandId && a.userId === this.userId,
    );
    const { moduleStatus, contentPiecesCount, pendingApprovalsCount } =
      deriveContentStudioMetrics(brandAssets);
    const existingBrand = db.brands[brandIdx];
    db.brands[brandIdx] = {
      ...existingBrand,
      contentPiecesCount,
      pendingApprovalsCount,
      moduleStatuses: {
        ...defaultModuleStatuses(),
        ...(existingBrand.moduleStatuses ?? defaultModuleStatuses()),
        contentStudio: moduleStatus,
      },
      updatedAt: now,
    };
  }

  async listContentAssets(brandId: string): Promise<ContentAsset[]> {
    const db = await this.readDb();
    this.requireOwnedBrand(db, brandId);
    return db.contentAssets
      .filter((a) => a.brandId === brandId && a.userId === this.userId)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }

  async getContentAsset(
    brandId: string,
    assetId: string,
  ): Promise<ContentAssetWithVersions | null> {
    const db = await this.readDb();
    this.requireOwnedBrand(db, brandId);
    const asset = db.contentAssets.find(
      (a) => a.id === assetId && a.brandId === brandId && a.userId === this.userId,
    );
    if (!asset) return null;
    const versions = db.contentAssetVersions
      .filter((v) => v.assetId === assetId && v.brandId === brandId && v.userId === this.userId)
      .sort((a, b) => b.versionNumber - a.versionNumber);
    return { ...asset, versions };
  }

  async createContentAsset(
    brandId: string,
    input: CreateContentAssetInput,
  ): Promise<ContentAssetWithVersions> {
    const title = String(input.title ?? '').trim();
    if (!title || title.length < 2) {
      throw new ContentAssetValidationError('Asset title must be at least 2 characters.');
    }
    const platform = String(input.platform ?? '').trim();
    if (!platform) {
      throw new ContentAssetValidationError('Platform is required.');
    }
    const formatCategory: ContentAssetFormatCategory = input.formatCategory ?? 'social_post';
    if (!isValidContentAssetFormatCategory(formatCategory)) {
      throw new ContentAssetValidationError(`Invalid formatCategory: ${formatCategory}`);
    }
    const workflowStatus: ContentAssetStatus = input.workflowStatus ?? 'draft';
    if (!isValidContentAssetStatus(workflowStatus)) {
      throw new ContentAssetValidationError(`Invalid workflowStatus: ${workflowStatus}`);
    }
    const source: ContentAssetSource = input.source ?? 'ai_generated';
    if (!isValidContentAssetSource(source)) {
      throw new ContentAssetValidationError(`Invalid source: ${source}`);
    }
    const contentLength: ContentLengthPreference = input.contentLength ?? 'medium';
    if (!isValidContentLengthPreference(contentLength)) {
      throw new ContentAssetValidationError(`Invalid contentLength: ${contentLength}`);
    }
    const scheduledDate =
      input.scheduledDate && String(input.scheduledDate).trim()
        ? String(input.scheduledDate).trim()
        : null;
    if (scheduledDate && !isValidIsoDateString(scheduledDate)) {
      throw new ContentAssetValidationError('scheduledDate must be a valid YYYY-MM-DD date.');
    }
    const body = sanitizeAssetBody(input.body);

    return this.runSerialized(async () => {
      const db = await this.readDb();
      const brand = this.requireOwnedBrand(db, brandId);

      const calendarId = input.calendarId ? String(input.calendarId).trim() : null;
      const calendarItemId = input.calendarItemId ? String(input.calendarItemId).trim() : null;

      if (calendarId) {
        const cal = db.contentCalendars.find(
          (c) => c.id === calendarId && c.brandId === brandId && c.userId === this.userId,
        );
        if (!cal) {
          throw new ContentAssetValidationError(
            'Linked content calendar does not belong to this brand.',
          );
        }
      }
      if (calendarItemId) {
        const item = db.contentCalendarItems.find(
          (ci) => ci.id === calendarItemId && ci.brandId === brandId && ci.userId === this.userId,
        );
        if (!item) {
          throw new ContentAssetValidationError(
            'Linked content calendar entry does not belong to this brand.',
          );
        }
        if (calendarId && item.calendarId !== calendarId) {
          throw new ContentAssetValidationError(
            'Linked calendar entry does not belong to the specified calendar.',
          );
        }
      }

      const now = new Date().toISOString();
      const formatLabel = String(input.formatLabel ?? '').trim();
      const toneOfVoice = String(input.toneOfVoice ?? '').trim();
      const contentObjective = String(input.contentObjective ?? '').trim();
      const targetAudience = String(input.targetAudience ?? '').trim();

      const asset: ContentAsset = {
        id: crypto.randomUUID(),
        userId: this.userId,
        brandId,
        calendarId,
        calendarItemId,
        title,
        platform,
        formatCategory,
        formatLabel,
        contentPillar: String(input.contentPillar ?? '').trim(),
        contentTheme: String(input.contentTheme ?? '').trim(),
        targetAudience,
        contentObjective,
        toneOfVoice,
        contentLength,
        scheduledDate,
        workflowStatus,
        source,
        currentVersionNumber: 1,
        approvedVersionNumber: workflowStatus === 'approved' ? 1 : null,
        approvedAt: workflowStatus === 'approved' ? now : null,
        publishedAt: workflowStatus === 'published' ? now : null,
        body,
        generationOptions:
          input.generationOptions ??
          defaultGenerationOptions(
            platform,
            formatCategory,
            formatLabel,
            toneOfVoice,
            contentLength,
            contentObjective,
            targetAudience,
          ),
        handoffSnapshot: input.handoffSnapshot ?? null,
        promptId: input.promptId ?? null,
        promptVersion: input.promptVersion ?? null,
        model: input.model ?? null,
        generatedAt: input.generatedAt ?? null,
        createdAt: now,
        updatedAt: now,
      };

      const version: ContentAssetVersion = {
        id: crypto.randomUUID(),
        userId: this.userId,
        brandId,
        assetId: asset.id,
        versionNumber: 1,
        title: asset.title,
        body: asset.body,
        changeSummary: String(input.changeSummary ?? 'Initial draft created').trim(),
        actionType: String(input.actionType ?? 'initial').trim(),
        source: asset.source,
        promptId: asset.promptId,
        promptVersion: asset.promptVersion,
        model: asset.model,
        createdAt: now,
      };

      db.contentAssets.unshift(asset);
      db.contentAssetVersions.unshift(version);
      this.syncLocalContentStudioMetrics(db, brandId, now);
      db.activities.unshift(
        this.buildActivity(
          brand.brand.id,
          brand.brand.brandName,
          'module_updated',
          `Created Content Studio asset "${asset.title}" for ${brand.brand.brandName}`,
        ),
      );
      db.activities = db.activities.slice(0, 50);
      await this.writeDb(db);
      return { ...asset, versions: [version] };
    });
  }

  async updateContentAsset(
    brandId: string,
    assetId: string,
    patch: UpdateContentAssetInput,
  ): Promise<ContentAssetWithVersions | null> {
    if (patch.formatCategory !== undefined && !isValidContentAssetFormatCategory(patch.formatCategory)) {
      throw new ContentAssetValidationError(`Invalid formatCategory: ${patch.formatCategory}`);
    }
    if (patch.workflowStatus !== undefined && !isValidContentAssetStatus(patch.workflowStatus)) {
      throw new ContentAssetValidationError(`Invalid workflowStatus: ${patch.workflowStatus}`);
    }
    if (patch.source !== undefined && !isValidContentAssetSource(patch.source)) {
      throw new ContentAssetValidationError(`Invalid source: ${patch.source}`);
    }
    if (patch.contentLength !== undefined && !isValidContentLengthPreference(patch.contentLength)) {
      throw new ContentAssetValidationError(`Invalid contentLength: ${patch.contentLength}`);
    }
    if (
      patch.scheduledDate !== undefined &&
      patch.scheduledDate !== null &&
      patch.scheduledDate !== '' &&
      !isValidIsoDateString(patch.scheduledDate)
    ) {
      throw new ContentAssetValidationError('scheduledDate must be a valid YYYY-MM-DD date.');
    }
    const sanitizedBody = patch.body !== undefined ? sanitizeAssetBody(patch.body) : undefined;

    return this.runSerialized(async () => {
      const db = await this.readDb();
      const brand = this.requireOwnedBrand(db, brandId);
      const idx = db.contentAssets.findIndex(
        (a) => a.id === assetId && a.brandId === brandId && a.userId === this.userId,
      );
      if (idx === -1) return null;

      const existing = db.contentAssets[idx];
      const now = new Date().toISOString();

      const isProtectedStatus =
        existing.workflowStatus === 'approved' || existing.workflowStatus === 'published';
      const shouldSnapshotVersion =
        sanitizedBody !== undefined && (patch.createVersion === true || isProtectedStatus);

      let nextVersionNumber = existing.currentVersionNumber;
      const nextTitle =
        patch.title !== undefined ? patch.title.trim() || existing.title : existing.title;
      const nextBody = sanitizedBody ?? existing.body;
      const nextSource: ContentAssetSource =
        patch.source ??
        (sanitizedBody !== undefined && existing.source === 'ai_generated'
          ? 'edited_ai'
          : existing.source);

      if (shouldSnapshotVersion) {
        const existingVersions = db.contentAssetVersions.filter(
          (v) => v.assetId === assetId && v.brandId === brandId && v.userId === this.userId,
        );
        const maxVer = existingVersions.reduce((acc, v) => Math.max(acc, v.versionNumber), 0);
        nextVersionNumber = Math.max(existing.currentVersionNumber, maxVer) + 1;
        const version: ContentAssetVersion = {
          id: crypto.randomUUID(),
          userId: this.userId,
          brandId,
          assetId,
          versionNumber: nextVersionNumber,
          title: nextTitle,
          body: nextBody,
          changeSummary: String(
            patch.changeSummary ??
              (isProtectedStatus
                ? 'Edited previously approved asset (preserved approved snapshot)'
                : 'Saved new draft version'),
          ).trim(),
          actionType: String(patch.actionType ?? 'manual_edit').trim(),
          source: nextSource,
          promptId: patch.promptId !== undefined ? patch.promptId : existing.promptId,
          promptVersion:
            patch.promptVersion !== undefined ? patch.promptVersion : existing.promptVersion,
          model: patch.model !== undefined ? patch.model : existing.model,
          createdAt: now,
        };
        db.contentAssetVersions.unshift(version);
      }

      const nextStatus: ContentAssetStatus =
        patch.workflowStatus ??
        (sanitizedBody !== undefined && isProtectedStatus ? 'in_progress' : existing.workflowStatus);

      const updated: ContentAsset = {
        ...existing,
        title: nextTitle,
        platform:
          patch.platform !== undefined
            ? patch.platform.trim() || existing.platform
            : existing.platform,
        formatCategory: patch.formatCategory ?? existing.formatCategory,
        formatLabel:
          patch.formatLabel !== undefined ? patch.formatLabel.trim() : existing.formatLabel,
        contentPillar:
          patch.contentPillar !== undefined ? patch.contentPillar.trim() : existing.contentPillar,
        contentTheme:
          patch.contentTheme !== undefined ? patch.contentTheme.trim() : existing.contentTheme,
        targetAudience:
          patch.targetAudience !== undefined
            ? patch.targetAudience.trim()
            : existing.targetAudience,
        contentObjective:
          patch.contentObjective !== undefined
            ? patch.contentObjective.trim()
            : existing.contentObjective,
        toneOfVoice:
          patch.toneOfVoice !== undefined ? patch.toneOfVoice.trim() : existing.toneOfVoice,
        contentLength: patch.contentLength ?? existing.contentLength,
        scheduledDate:
          patch.scheduledDate !== undefined
            ? patch.scheduledDate && patch.scheduledDate.trim()
              ? patch.scheduledDate.trim()
              : null
            : existing.scheduledDate,
        workflowStatus: nextStatus,
        source: nextSource,
        currentVersionNumber: nextVersionNumber,
        approvedVersionNumber:
          nextStatus === 'approved'
            ? nextVersionNumber
            : existing.approvedVersionNumber,
        approvedAt:
          nextStatus === 'approved' && existing.workflowStatus !== 'approved'
            ? now
            : existing.approvedAt,
        publishedAt:
          nextStatus === 'published' && existing.workflowStatus !== 'published'
            ? now
            : existing.publishedAt,
        body: nextBody,
        generationOptions: patch.generationOptions ?? existing.generationOptions,
        promptId: patch.promptId !== undefined ? patch.promptId : existing.promptId,
        promptVersion:
          patch.promptVersion !== undefined ? patch.promptVersion : existing.promptVersion,
        model: patch.model !== undefined ? patch.model : existing.model,
        generatedAt: patch.generatedAt !== undefined ? patch.generatedAt : existing.generatedAt,
        updatedAt: now,
      };

      db.contentAssets[idx] = updated;
      this.syncLocalContentStudioMetrics(db, brandId, now);

      if (patch.workflowStatus && patch.workflowStatus !== existing.workflowStatus) {
        db.activities.unshift(
          this.buildActivity(
            brand.brand.id,
            brand.brand.brandName,
            patch.workflowStatus === 'approved' ? 'module_completed' : 'module_updated',
            `Marked Content Studio asset "${updated.title}" as ${patch.workflowStatus.replace(/_/g, ' ')}`,
          ),
        );
        db.activities = db.activities.slice(0, 50);
      }

      await this.writeDb(db);
      const versions = db.contentAssetVersions
        .filter((v) => v.assetId === assetId && v.brandId === brandId && v.userId === this.userId)
        .sort((a, b) => b.versionNumber - a.versionNumber);
      return { ...updated, versions };
    });
  }

  async createContentAssetVersion(
    brandId: string,
    assetId: string,
    input: CreateContentAssetVersionInput,
  ): Promise<ContentAssetWithVersions | null> {
    if (input.source !== undefined && !isValidContentAssetSource(input.source)) {
      throw new ContentAssetValidationError(`Invalid source: ${input.source}`);
    }
    if (input.workflowStatus !== undefined && !isValidContentAssetStatus(input.workflowStatus)) {
      throw new ContentAssetValidationError(`Invalid workflowStatus: ${input.workflowStatus}`);
    }
    const body = sanitizeAssetBody(input.body);

    return this.runSerialized(async () => {
      const db = await this.readDb();
      this.requireOwnedBrand(db, brandId);
      const idx = db.contentAssets.findIndex(
        (a) => a.id === assetId && a.brandId === brandId && a.userId === this.userId,
      );
      if (idx === -1) return null;

      const existing = db.contentAssets[idx];
      const existingVersions = db.contentAssetVersions.filter(
        (v) => v.assetId === assetId && v.brandId === brandId && v.userId === this.userId,
      );
      const maxVer = existingVersions.reduce((acc, v) => Math.max(acc, v.versionNumber), 0);
      const nextVersionNumber = Math.max(existing.currentVersionNumber, maxVer) + 1;
      const now = new Date().toISOString();
      const nextTitle = input.title?.trim() || existing.title;
      const nextSource: ContentAssetSource = input.source ?? 'edited_ai';
      const isProtectedStatus =
        existing.workflowStatus === 'approved' || existing.workflowStatus === 'published';
      const nextStatus: ContentAssetStatus =
        input.workflowStatus ?? (isProtectedStatus ? 'in_progress' : existing.workflowStatus);

      const version: ContentAssetVersion = {
        id: crypto.randomUUID(),
        userId: this.userId,
        brandId,
        assetId,
        versionNumber: nextVersionNumber,
        title: nextTitle,
        body,
        changeSummary: String(input.changeSummary ?? `Version ${nextVersionNumber} saved`).trim(),
        actionType: String(input.actionType ?? 'refinement').trim(),
        source: nextSource,
        promptId: input.promptId !== undefined ? input.promptId : existing.promptId,
        promptVersion:
          input.promptVersion !== undefined ? input.promptVersion : existing.promptVersion,
        model: input.model !== undefined ? input.model : existing.model,
        createdAt: now,
      };

      const updated: ContentAsset = {
        ...existing,
        title: nextTitle,
        body,
        source: nextSource,
        workflowStatus: nextStatus,
        currentVersionNumber: nextVersionNumber,
        promptId: version.promptId,
        promptVersion: version.promptVersion,
        model: version.model,
        generatedAt: input.generatedAt !== undefined ? input.generatedAt : existing.generatedAt,
        updatedAt: now,
      };

      db.contentAssetVersions.unshift(version);
      db.contentAssets[idx] = updated;
      this.syncLocalContentStudioMetrics(db, brandId, now);
      await this.writeDb(db);

      const versions = db.contentAssetVersions
        .filter((v) => v.assetId === assetId && v.brandId === brandId && v.userId === this.userId)
        .sort((a, b) => b.versionNumber - a.versionNumber);
      return { ...updated, versions };
    });
  }

  async deleteContentAsset(brandId: string, assetId: string): Promise<boolean> {
    return this.runSerialized(async () => {
      const db = await this.readDb();
      this.requireOwnedBrand(db, brandId);
      const idx = db.contentAssets.findIndex(
        (a) => a.id === assetId && a.brandId === brandId && a.userId === this.userId,
      );
      if (idx === -1) return false;
      db.contentAssets.splice(idx, 1);
      db.contentAssetVersions = db.contentAssetVersions.filter((v) => v.assetId !== assetId);
      this.syncLocalContentStudioMetrics(db, brandId, new Date().toISOString());
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

  private async syncSupabaseCalendarModuleStatus(brand: Brand, now: string): Promise<void> {
    const calendars = await this.listContentCalendars(brand.id);
    const derivedStatus = deriveContentCalendarModuleStatus(calendars);
    const nextStatuses: BrandModuleStatuses = {
      ...defaultModuleStatuses(),
      ...(brand.moduleStatuses ?? defaultModuleStatuses()),
      contentCalendar: derivedStatus,
    };
    await this.request(
      `brands?id=eq.${encodeURIComponent(brand.id)}&user_id=eq.${encodeURIComponent(this.userId)}`,
      {
        method: 'PATCH',
        body: JSON.stringify({
          module_statuses: nextStatuses,
          updated_at: now,
        }),
      },
    );
  }

  private mapSupabaseRowToCalendar(row: Record<string, unknown>): ContentCalendar {
    return {
      id: String(row.id),
      userId: String(row.user_id),
      brandId: String(row.brand_id),
      name: String(row.name ?? ''),
      startDate: String(row.start_date ?? ''),
      endDate: String(row.end_date ?? ''),
      durationDays: Number(row.duration_days ?? 30),
      status: (row.status as ContentCalendarStatus) ?? 'draft',
      settings: (row.settings as ContentCalendar['settings']) ?? {
        startDate: String(row.start_date ?? ''),
        durationDays: Number(row.duration_days ?? 30),
        selectedPlatforms: [],
        postsPerWeek: 4,
        postingFrequencyLabel: '',
        preferredPostingDays: [],
        preferredPostingTime: '',
        campaignObjectiveFocus: '',
        contentMixPreference: '',
        teamCapacityNote: '',
        specialDatesOrConstraints: '',
      },
      upstreamSnapshot: (row.upstream_snapshot as Record<string, unknown>) ?? {},
      generationState: (row.generation_state as ContentCalendar['generationState']) ?? null,
      promptId: (row.prompt_id as string | null) ?? null,
      promptVersion: (row.prompt_version as string | null) ?? null,
      model: (row.model as string | null) ?? null,
      generatedAt: (row.generated_at as string | null) ?? null,
      createdAt: String(row.created_at ?? ''),
      updatedAt: String(row.updated_at ?? ''),
    };
  }

  private mapSupabaseRowToCalendarItem(row: Record<string, unknown>): ContentCalendarItem {
    return {
      id: String(row.id),
      userId: String(row.user_id),
      brandId: String(row.brand_id),
      calendarId: String(row.calendar_id),
      scheduledDate: String(row.scheduled_date ?? ''),
      suggestedTime: String(row.suggested_time ?? ''),
      platform: String(row.platform ?? ''),
      title: String(row.title ?? ''),
      contentPillar: String(row.content_pillar ?? ''),
      contentTheme: String(row.content_theme ?? ''),
      contentFormat: String(row.content_format ?? ''),
      contentSeries: String(row.content_series ?? ''),
      targetAudience: String(row.target_audience ?? ''),
      audiencePainPoint: String(row.audience_pain_point ?? ''),
      contentObjective: String(row.content_objective ?? ''),
      relatedMarketingObjective: String(row.related_marketing_objective ?? ''),
      coreMessage: String(row.core_message ?? ''),
      suggestedAngle: String(row.suggested_angle ?? ''),
      intendedCta: String(row.intended_cta ?? ''),
      relevantKpi: String(row.relevant_kpi ?? ''),
      productionNotes: String(row.production_notes ?? ''),
      workflowStatus: (row.workflow_status as CalendarWorkflowStatus) ?? 'planned',
      batchIndex: typeof row.batch_index === 'number' ? row.batch_index : null,
      source: (row.source as CalendarItemSource) ?? 'ai_generated',
      sortOrder: typeof row.sort_order === 'number' ? row.sort_order : 0,
      createdAt: String(row.created_at ?? ''),
      updatedAt: String(row.updated_at ?? ''),
    };
  }

  async listContentCalendars(brandId: string): Promise<ContentCalendar[]> {
    await this.requireOwnedBrand(brandId);
    const rows = await this.request<Record<string, unknown>[]>(
      `content_calendars?brand_id=eq.${encodeURIComponent(brandId)}&user_id=eq.${encodeURIComponent(this.userId)}&select=*&order=updated_at.desc`,
    );
    return rows.map((row) => this.mapSupabaseRowToCalendar(row));
  }

  async getContentCalendar(
    brandId: string,
    calendarId: string,
  ): Promise<ContentCalendarWithItems | null> {
    await this.requireOwnedBrand(brandId);
    const rows = await this.request<Record<string, unknown>[]>(
      `content_calendars?id=eq.${encodeURIComponent(calendarId)}&brand_id=eq.${encodeURIComponent(brandId)}&user_id=eq.${encodeURIComponent(this.userId)}&select=*`,
    );
    if (!rows[0]) return null;
    const calendar = this.mapSupabaseRowToCalendar(rows[0]);
    const itemRows = await this.request<Record<string, unknown>[]>(
      `content_calendar_items?calendar_id=eq.${encodeURIComponent(calendarId)}&brand_id=eq.${encodeURIComponent(brandId)}&user_id=eq.${encodeURIComponent(this.userId)}&select=*&order=scheduled_date.asc,sort_order.asc,created_at.asc`,
    );
    return {
      ...calendar,
      items: itemRows.map((row) => this.mapSupabaseRowToCalendarItem(row)),
    };
  }

  async createContentCalendar(
    brandId: string,
    input: CreateContentCalendarInput,
  ): Promise<ContentCalendar> {
    const brand = await this.requireOwnedBrand(brandId);
    const name = String(input.name ?? '').trim();
    if (!name || name.length < 2) {
      throw new CalendarValidationError('Calendar name must be at least 2 characters.');
    }
    const startDate = String(input.startDate ?? '').trim();
    const endDate = String(input.endDate ?? '').trim();
    if (!isValidIsoDateString(startDate) || !isValidIsoDateString(endDate)) {
      throw new CalendarValidationError('startDate and endDate must be valid YYYY-MM-DD dates.');
    }
    if (endDate < startDate) {
      throw new CalendarValidationError('endDate cannot be earlier than startDate.');
    }
    const status: ContentCalendarStatus = input.status ?? 'draft';
    if (!isValidContentCalendarStatus(status)) {
      throw new CalendarValidationError(`Invalid calendar status: ${status}`);
    }

    const now = new Date().toISOString();
    const rows = await this.request<Record<string, unknown>[]>('content_calendars', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({
        user_id: this.userId,
        brand_id: brandId,
        name,
        start_date: startDate,
        end_date: endDate,
        duration_days: Math.min(90, Math.max(1, Math.round(input.durationDays ?? 30))),
        status,
        settings: input.settings,
        upstream_snapshot: input.upstreamSnapshot ?? {},
        generation_state: input.generationState ?? null,
        prompt_id: input.promptId ?? null,
        prompt_version: input.promptVersion ?? null,
        model: input.model ?? null,
        generated_at: input.generatedAt ?? null,
      }),
    });
    const created = this.mapSupabaseRowToCalendar(rows[0]);
    await this.syncSupabaseCalendarModuleStatus(brand, now);
    await this.request('brand_activities', {
      method: 'POST',
      body: JSON.stringify({
        user_id: this.userId,
        brand_id: brand.id,
        brand_name: brand.brandName,
        type: 'module_updated',
        description: `Created Content Calendar "${created.name}" for ${brand.brandName}`,
      }),
    });
    return created;
  }

  async updateContentCalendar(
    brandId: string,
    calendarId: string,
    patch: UpdateContentCalendarInput,
  ): Promise<ContentCalendar | null> {
    const brand = await this.requireOwnedBrand(brandId);
    if (patch.status !== undefined && !isValidContentCalendarStatus(patch.status)) {
      throw new CalendarValidationError(`Invalid calendar status: ${patch.status}`);
    }
    if (patch.startDate !== undefined && !isValidIsoDateString(patch.startDate)) {
      throw new CalendarValidationError('startDate must be a valid YYYY-MM-DD date.');
    }
    if (patch.endDate !== undefined && !isValidIsoDateString(patch.endDate)) {
      throw new CalendarValidationError('endDate must be a valid YYYY-MM-DD date.');
    }

    const body: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (patch.name !== undefined) body.name = patch.name.trim();
    if (patch.startDate !== undefined) body.start_date = patch.startDate;
    if (patch.endDate !== undefined) body.end_date = patch.endDate;
    if (patch.durationDays !== undefined) {
      body.duration_days = Math.min(90, Math.max(1, Math.round(patch.durationDays)));
    }
    if (patch.status !== undefined) body.status = patch.status;
    if (patch.settings !== undefined) body.settings = patch.settings;
    if (patch.upstreamSnapshot !== undefined) body.upstream_snapshot = patch.upstreamSnapshot;
    if (patch.generationState !== undefined) body.generation_state = patch.generationState;
    if (patch.promptId !== undefined) body.prompt_id = patch.promptId;
    if (patch.promptVersion !== undefined) body.prompt_version = patch.promptVersion;
    if (patch.model !== undefined) body.model = patch.model;
    if (patch.generatedAt !== undefined) body.generated_at = patch.generatedAt;

    const rows = await this.request<Record<string, unknown>[]>(
      `content_calendars?id=eq.${encodeURIComponent(calendarId)}&brand_id=eq.${encodeURIComponent(brandId)}&user_id=eq.${encodeURIComponent(this.userId)}`,
      {
        method: 'PATCH',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify(body),
      },
    );
    if (!rows[0]) return null;
    const updated = this.mapSupabaseRowToCalendar(rows[0]);
    await this.syncSupabaseCalendarModuleStatus(brand, new Date().toISOString());
    return updated;
  }

  async deleteContentCalendar(brandId: string, calendarId: string): Promise<boolean> {
    const brand = await this.requireOwnedBrand(brandId);
    const existing = await this.getContentCalendar(brandId, calendarId);
    if (!existing) return false;
    await this.request(
      `content_calendars?id=eq.${encodeURIComponent(calendarId)}&brand_id=eq.${encodeURIComponent(brandId)}&user_id=eq.${encodeURIComponent(this.userId)}`,
      { method: 'DELETE' },
    );
    await this.syncSupabaseCalendarModuleStatus(brand, new Date().toISOString());
    return true;
  }

  async createContentCalendarItems(
    brandId: string,
    calendarId: string,
    items: CreateContentCalendarItemInput[],
    replaceBatchIndex?: number | null,
  ): Promise<ContentCalendarItem[]> {
    await this.requireOwnedBrand(brandId);
    const calRows = await this.request<Record<string, unknown>[]>(
      `content_calendars?id=eq.${encodeURIComponent(calendarId)}&brand_id=eq.${encodeURIComponent(brandId)}&user_id=eq.${encodeURIComponent(this.userId)}&select=id`,
    );
    if (!calRows[0]) {
      throw new CalendarValidationError('Content calendar not found for this brand.');
    }

    const sanitized = items.map((item) => sanitizeCalendarItemInput(item));

    if (typeof replaceBatchIndex === 'number' && Number.isInteger(replaceBatchIndex)) {
      await this.request(
        `content_calendar_items?calendar_id=eq.${encodeURIComponent(calendarId)}&brand_id=eq.${encodeURIComponent(brandId)}&user_id=eq.${encodeURIComponent(this.userId)}&batch_index=eq.${replaceBatchIndex}`,
        { method: 'DELETE' },
      );
    }

    if (sanitized.length === 0) return [];

    const rows = await this.request<Record<string, unknown>[]>('content_calendar_items', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify(
        sanitized.map((entry) => ({
          user_id: this.userId,
          brand_id: brandId,
          calendar_id: calendarId,
          scheduled_date: entry.scheduledDate,
          suggested_time: entry.suggestedTime ?? '',
          platform: entry.platform,
          title: entry.title,
          content_pillar: entry.contentPillar,
          content_theme: entry.contentTheme ?? '',
          content_format: entry.contentFormat,
          content_series: entry.contentSeries ?? '',
          target_audience: entry.targetAudience,
          audience_pain_point: entry.audiencePainPoint ?? '',
          content_objective: entry.contentObjective,
          related_marketing_objective: entry.relatedMarketingObjective ?? '',
          core_message: entry.coreMessage,
          suggested_angle: entry.suggestedAngle ?? '',
          intended_cta: entry.intendedCta ?? '',
          relevant_kpi: entry.relevantKpi ?? '',
          production_notes: entry.productionNotes ?? '',
          workflow_status: entry.workflowStatus ?? 'planned',
          batch_index: entry.batchIndex ?? null,
          source: entry.source ?? 'ai_generated',
          sort_order: entry.sortOrder ?? 0,
        })),
      ),
    });

    return rows.map((row) => this.mapSupabaseRowToCalendarItem(row));
  }

  async createContentCalendarItem(
    brandId: string,
    calendarId: string,
    input: CreateContentCalendarItemInput,
  ): Promise<ContentCalendarItem> {
    const [created] = await this.createContentCalendarItems(brandId, calendarId, [input]);
    return created;
  }

  async updateContentCalendarItem(
    brandId: string,
    calendarId: string,
    itemId: string,
    patch: UpdateContentCalendarItemInput,
  ): Promise<ContentCalendarItem | null> {
    await this.requireOwnedBrand(brandId);
    if (patch.scheduledDate !== undefined && !isValidIsoDateString(patch.scheduledDate)) {
      throw new CalendarValidationError('scheduledDate must be a valid YYYY-MM-DD date.');
    }
    if (patch.workflowStatus !== undefined && !isValidCalendarWorkflowStatus(patch.workflowStatus)) {
      throw new CalendarValidationError(`Invalid workflowStatus: ${patch.workflowStatus}`);
    }
    if (patch.source !== undefined && !isValidCalendarItemSource(patch.source)) {
      throw new CalendarValidationError(`Invalid source: ${patch.source}`);
    }

    const body: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (patch.scheduledDate !== undefined) body.scheduled_date = patch.scheduledDate;
    if (patch.suggestedTime !== undefined) body.suggested_time = patch.suggestedTime.trim();
    if (patch.platform !== undefined) body.platform = patch.platform.trim();
    if (patch.title !== undefined) body.title = patch.title.trim();
    if (patch.contentPillar !== undefined) body.content_pillar = patch.contentPillar.trim();
    if (patch.contentTheme !== undefined) body.content_theme = patch.contentTheme.trim();
    if (patch.contentFormat !== undefined) body.content_format = patch.contentFormat.trim();
    if (patch.contentSeries !== undefined) body.content_series = patch.contentSeries.trim();
    if (patch.targetAudience !== undefined) body.target_audience = patch.targetAudience.trim();
    if (patch.audiencePainPoint !== undefined) {
      body.audience_pain_point = patch.audiencePainPoint.trim();
    }
    if (patch.contentObjective !== undefined) {
      body.content_objective = patch.contentObjective.trim();
    }
    if (patch.relatedMarketingObjective !== undefined) {
      body.related_marketing_objective = patch.relatedMarketingObjective.trim();
    }
    if (patch.coreMessage !== undefined) body.core_message = patch.coreMessage.trim();
    if (patch.suggestedAngle !== undefined) body.suggested_angle = patch.suggestedAngle.trim();
    if (patch.intendedCta !== undefined) body.intended_cta = patch.intendedCta.trim();
    if (patch.relevantKpi !== undefined) body.relevant_kpi = patch.relevantKpi.trim();
    if (patch.productionNotes !== undefined) body.production_notes = patch.productionNotes.trim();
    if (patch.workflowStatus !== undefined) body.workflow_status = patch.workflowStatus;
    if (patch.batchIndex !== undefined) body.batch_index = patch.batchIndex;
    if (patch.source !== undefined) body.source = patch.source;
    if (patch.sortOrder !== undefined) body.sort_order = Math.round(patch.sortOrder);

    const rows = await this.request<Record<string, unknown>[]>(
      `content_calendar_items?id=eq.${encodeURIComponent(itemId)}&calendar_id=eq.${encodeURIComponent(calendarId)}&brand_id=eq.${encodeURIComponent(brandId)}&user_id=eq.${encodeURIComponent(this.userId)}`,
      {
        method: 'PATCH',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify(body),
      },
    );
    if (!rows[0]) return null;
    return this.mapSupabaseRowToCalendarItem(rows[0]);
  }

  async deleteContentCalendarItem(
    brandId: string,
    calendarId: string,
    itemId: string,
  ): Promise<boolean> {
    await this.requireOwnedBrand(brandId);
    const existing = await this.request<Record<string, unknown>[]>(
      `content_calendar_items?id=eq.${encodeURIComponent(itemId)}&calendar_id=eq.${encodeURIComponent(calendarId)}&brand_id=eq.${encodeURIComponent(brandId)}&user_id=eq.${encodeURIComponent(this.userId)}&select=id`,
    );
    if (!existing[0]) return false;
    await this.request(
      `content_calendar_items?id=eq.${encodeURIComponent(itemId)}&calendar_id=eq.${encodeURIComponent(calendarId)}&brand_id=eq.${encodeURIComponent(brandId)}&user_id=eq.${encodeURIComponent(this.userId)}`,
      { method: 'DELETE' },
    );
    return true;
  }

  private async syncSupabaseContentStudioMetrics(brand: Brand, now: string): Promise<void> {
    const assets = await this.listContentAssets(brand.id);
    const { moduleStatus, contentPiecesCount, pendingApprovalsCount } =
      deriveContentStudioMetrics(assets);
    const nextStatuses: BrandModuleStatuses = {
      ...defaultModuleStatuses(),
      ...(brand.moduleStatuses ?? defaultModuleStatuses()),
      contentStudio: moduleStatus,
    };
    await this.request(
      `brands?id=eq.${encodeURIComponent(brand.id)}&user_id=eq.${encodeURIComponent(this.userId)}`,
      {
        method: 'PATCH',
        body: JSON.stringify({
          module_statuses: nextStatuses,
          content_pieces_count: contentPiecesCount,
          pending_approvals_count: pendingApprovalsCount,
          updated_at: now,
        }),
      },
    );
  }

  private mapSupabaseRowToContentAsset(row: Record<string, unknown>): ContentAsset {
    const formatCategory = isValidContentAssetFormatCategory(String(row.format_category ?? ''))
      ? (row.format_category as ContentAssetFormatCategory)
      : 'social_post';
    const contentLength = isValidContentLengthPreference(String(row.content_length ?? ''))
      ? (row.content_length as ContentLengthPreference)
      : 'medium';
    const platform = String(row.platform ?? '');
    const formatLabel = String(row.format_label ?? '');
    const toneOfVoice = String(row.tone_of_voice ?? '');
    const contentObjective = String(row.content_objective ?? '');
    const targetAudience = String(row.target_audience ?? '');
    const rawBody =
      typeof row.body === 'object' && row.body !== null && !Array.isArray(row.body)
        ? sanitizeAssetBody(row.body)
        : sanitizeAssetBody({});
    const rawOpts =
      typeof row.generation_options === 'object' &&
      row.generation_options !== null &&
      !Array.isArray(row.generation_options)
        ? (row.generation_options as ContentStudioGenerationOptions)
        : defaultGenerationOptions(
            platform,
            formatCategory,
            formatLabel,
            toneOfVoice,
            contentLength,
            contentObjective,
            targetAudience,
          );

    return {
      id: String(row.id),
      userId: String(row.user_id),
      brandId: String(row.brand_id),
      calendarId: (row.calendar_id as string | null) ?? null,
      calendarItemId: (row.calendar_item_id as string | null) ?? null,
      title: String(row.title ?? ''),
      platform,
      formatCategory,
      formatLabel,
      contentPillar: String(row.content_pillar ?? ''),
      contentTheme: String(row.content_theme ?? ''),
      targetAudience,
      contentObjective,
      toneOfVoice,
      contentLength,
      scheduledDate: (row.scheduled_date as string | null) ?? null,
      workflowStatus: isValidContentAssetStatus(String(row.workflow_status ?? ''))
        ? (row.workflow_status as ContentAssetStatus)
        : 'draft',
      source: isValidContentAssetSource(String(row.source ?? ''))
        ? (row.source as ContentAssetSource)
        : 'ai_generated',
      currentVersionNumber:
        typeof row.current_version_number === 'number' ? row.current_version_number : 1,
      approvedVersionNumber:
        typeof row.approved_version_number === 'number' ? row.approved_version_number : null,
      approvedAt: (row.approved_at as string | null) ?? null,
      publishedAt: (row.published_at as string | null) ?? null,
      body: rawBody,
      generationOptions: rawOpts,
      handoffSnapshot: (row.handoff_snapshot as ContentStudioHandoffPayload | null) ?? null,
      promptId: (row.prompt_id as string | null) ?? null,
      promptVersion: (row.prompt_version as string | null) ?? null,
      model: (row.model as string | null) ?? null,
      generatedAt: (row.generated_at as string | null) ?? null,
      createdAt: String(row.created_at ?? ''),
      updatedAt: String(row.updated_at ?? ''),
    };
  }

  private mapSupabaseRowToContentAssetVersion(row: Record<string, unknown>): ContentAssetVersion {
    return {
      id: String(row.id),
      userId: String(row.user_id),
      brandId: String(row.brand_id),
      assetId: String(row.asset_id),
      versionNumber: typeof row.version_number === 'number' ? row.version_number : 1,
      title: String(row.title ?? ''),
      body:
        typeof row.body === 'object' && row.body !== null && !Array.isArray(row.body)
          ? sanitizeAssetBody(row.body)
          : sanitizeAssetBody({}),
      changeSummary: String(row.change_summary ?? ''),
      actionType: String(row.action_type ?? 'initial'),
      source: isValidContentAssetSource(String(row.source ?? ''))
        ? (row.source as ContentAssetSource)
        : 'ai_generated',
      promptId: (row.prompt_id as string | null) ?? null,
      promptVersion: (row.prompt_version as string | null) ?? null,
      model: (row.model as string | null) ?? null,
      createdAt: String(row.created_at ?? ''),
    };
  }

  async listContentAssets(brandId: string): Promise<ContentAsset[]> {
    await this.requireOwnedBrand(brandId);
    const rows = await this.request<Record<string, unknown>[]>(
      `content_assets?brand_id=eq.${encodeURIComponent(brandId)}&user_id=eq.${encodeURIComponent(this.userId)}&select=*&order=updated_at.desc`,
    );
    return rows.map((row) => this.mapSupabaseRowToContentAsset(row));
  }

  async getContentAsset(
    brandId: string,
    assetId: string,
  ): Promise<ContentAssetWithVersions | null> {
    await this.requireOwnedBrand(brandId);
    const rows = await this.request<Record<string, unknown>[]>(
      `content_assets?id=eq.${encodeURIComponent(assetId)}&brand_id=eq.${encodeURIComponent(brandId)}&user_id=eq.${encodeURIComponent(this.userId)}&select=*`,
    );
    if (!rows[0]) return null;
    const asset = this.mapSupabaseRowToContentAsset(rows[0]);
    const versionRows = await this.request<Record<string, unknown>[]>(
      `content_asset_versions?asset_id=eq.${encodeURIComponent(assetId)}&brand_id=eq.${encodeURIComponent(brandId)}&user_id=eq.${encodeURIComponent(this.userId)}&select=*&order=version_number.desc`,
    );
    return {
      ...asset,
      versions: versionRows.map((v) => this.mapSupabaseRowToContentAssetVersion(v)),
    };
  }

  async createContentAsset(
    brandId: string,
    input: CreateContentAssetInput,
  ): Promise<ContentAssetWithVersions> {
    const brand = await this.requireOwnedBrand(brandId);
    const title = String(input.title ?? '').trim();
    if (!title || title.length < 2) {
      throw new ContentAssetValidationError('Asset title must be at least 2 characters.');
    }
    const platform = String(input.platform ?? '').trim();
    if (!platform) {
      throw new ContentAssetValidationError('Platform is required.');
    }
    const formatCategory: ContentAssetFormatCategory = input.formatCategory ?? 'social_post';
    if (!isValidContentAssetFormatCategory(formatCategory)) {
      throw new ContentAssetValidationError(`Invalid formatCategory: ${formatCategory}`);
    }
    const workflowStatus: ContentAssetStatus = input.workflowStatus ?? 'draft';
    if (!isValidContentAssetStatus(workflowStatus)) {
      throw new ContentAssetValidationError(`Invalid workflowStatus: ${workflowStatus}`);
    }
    const source: ContentAssetSource = input.source ?? 'ai_generated';
    if (!isValidContentAssetSource(source)) {
      throw new ContentAssetValidationError(`Invalid source: ${source}`);
    }
    const contentLength: ContentLengthPreference = input.contentLength ?? 'medium';
    if (!isValidContentLengthPreference(contentLength)) {
      throw new ContentAssetValidationError(`Invalid contentLength: ${contentLength}`);
    }
    const scheduledDate =
      input.scheduledDate && String(input.scheduledDate).trim()
        ? String(input.scheduledDate).trim()
        : null;
    if (scheduledDate && !isValidIsoDateString(scheduledDate)) {
      throw new ContentAssetValidationError('scheduledDate must be a valid YYYY-MM-DD date.');
    }
    const body = sanitizeAssetBody(input.body);

    const calendarId = input.calendarId ? String(input.calendarId).trim() : null;
    const calendarItemId = input.calendarItemId ? String(input.calendarItemId).trim() : null;

    if (calendarId) {
      const calRows = await this.request<Record<string, unknown>[]>(
        `content_calendars?id=eq.${encodeURIComponent(calendarId)}&brand_id=eq.${encodeURIComponent(brandId)}&user_id=eq.${encodeURIComponent(this.userId)}&select=id`,
      );
      if (!calRows[0]) {
        throw new ContentAssetValidationError(
          'Linked content calendar does not belong to this brand.',
        );
      }
    }
    if (calendarItemId) {
      const itemRows = await this.request<Record<string, unknown>[]>(
        `content_calendar_items?id=eq.${encodeURIComponent(calendarItemId)}&brand_id=eq.${encodeURIComponent(brandId)}&user_id=eq.${encodeURIComponent(this.userId)}&select=id,calendar_id`,
      );
      if (!itemRows[0]) {
        throw new ContentAssetValidationError(
          'Linked content calendar entry does not belong to this brand.',
        );
      }
      if (calendarId && String(itemRows[0].calendar_id) !== calendarId) {
        throw new ContentAssetValidationError(
          'Linked calendar entry does not belong to the specified calendar.',
        );
      }
    }

    const now = new Date().toISOString();
    const formatLabel = String(input.formatLabel ?? '').trim();
    const toneOfVoice = String(input.toneOfVoice ?? '').trim();
    const contentObjective = String(input.contentObjective ?? '').trim();
    const targetAudience = String(input.targetAudience ?? '').trim();
    const generationOptions =
      input.generationOptions ??
      defaultGenerationOptions(
        platform,
        formatCategory,
        formatLabel,
        toneOfVoice,
        contentLength,
        contentObjective,
        targetAudience,
      );

    const rows = await this.request<Record<string, unknown>[]>('content_assets', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({
        user_id: this.userId,
        brand_id: brandId,
        calendar_id: calendarId,
        calendar_item_id: calendarItemId,
        title,
        platform,
        format_category: formatCategory,
        format_label: formatLabel,
        content_pillar: String(input.contentPillar ?? '').trim(),
        content_theme: String(input.contentTheme ?? '').trim(),
        target_audience: targetAudience,
        content_objective: contentObjective,
        tone_of_voice: toneOfVoice,
        content_length: contentLength,
        scheduled_date: scheduledDate,
        workflow_status: workflowStatus,
        source,
        current_version_number: 1,
        approved_version_number: workflowStatus === 'approved' ? 1 : null,
        approved_at: workflowStatus === 'approved' ? now : null,
        published_at: workflowStatus === 'published' ? now : null,
        body,
        generation_options: generationOptions,
        handoff_snapshot: input.handoffSnapshot ?? null,
        prompt_id: input.promptId ?? null,
        prompt_version: input.promptVersion ?? null,
        model: input.model ?? null,
        generated_at: input.generatedAt ?? null,
      }),
    });

    const created = this.mapSupabaseRowToContentAsset(rows[0]);
    const verRows = await this.request<Record<string, unknown>[]>('content_asset_versions', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({
        user_id: this.userId,
        brand_id: brandId,
        asset_id: created.id,
        version_number: 1,
        title: created.title,
        body: created.body,
        change_summary: String(input.changeSummary ?? 'Initial draft created').trim(),
        action_type: String(input.actionType ?? 'initial').trim(),
        source: created.source,
        prompt_id: created.promptId,
        prompt_version: created.promptVersion,
        model: created.model,
      }),
    });

    await this.syncSupabaseContentStudioMetrics(brand, now);
    await this.request('brand_activities', {
      method: 'POST',
      body: JSON.stringify({
        user_id: this.userId,
        brand_id: brand.id,
        brand_name: brand.brandName,
        type: 'module_updated',
        description: `Created Content Studio asset "${created.title}" for ${brand.brandName}`,
      }),
    });

    return {
      ...created,
      versions: verRows.map((v) => this.mapSupabaseRowToContentAssetVersion(v)),
    };
  }

  async updateContentAsset(
    brandId: string,
    assetId: string,
    patch: UpdateContentAssetInput,
  ): Promise<ContentAssetWithVersions | null> {
    const brand = await this.requireOwnedBrand(brandId);
    if (patch.formatCategory !== undefined && !isValidContentAssetFormatCategory(patch.formatCategory)) {
      throw new ContentAssetValidationError(`Invalid formatCategory: ${patch.formatCategory}`);
    }
    if (patch.workflowStatus !== undefined && !isValidContentAssetStatus(patch.workflowStatus)) {
      throw new ContentAssetValidationError(`Invalid workflowStatus: ${patch.workflowStatus}`);
    }
    if (patch.source !== undefined && !isValidContentAssetSource(patch.source)) {
      throw new ContentAssetValidationError(`Invalid source: ${patch.source}`);
    }
    if (patch.contentLength !== undefined && !isValidContentLengthPreference(patch.contentLength)) {
      throw new ContentAssetValidationError(`Invalid contentLength: ${patch.contentLength}`);
    }
    if (
      patch.scheduledDate !== undefined &&
      patch.scheduledDate !== null &&
      patch.scheduledDate !== '' &&
      !isValidIsoDateString(patch.scheduledDate)
    ) {
      throw new ContentAssetValidationError('scheduledDate must be a valid YYYY-MM-DD date.');
    }

    const existingWithVersions = await this.getContentAsset(brandId, assetId);
    if (!existingWithVersions) return null;

    const sanitizedBody = patch.body !== undefined ? sanitizeAssetBody(patch.body) : undefined;
    const now = new Date().toISOString();
    const isProtectedStatus =
      existingWithVersions.workflowStatus === 'approved' ||
      existingWithVersions.workflowStatus === 'published';
    const shouldSnapshotVersion =
      sanitizedBody !== undefined && (patch.createVersion === true || isProtectedStatus);

    let nextVersionNumber = existingWithVersions.currentVersionNumber;
    const nextTitle =
      patch.title !== undefined
        ? patch.title.trim() || existingWithVersions.title
        : existingWithVersions.title;
    const nextBody = sanitizedBody ?? existingWithVersions.body;
    const nextSource: ContentAssetSource =
      patch.source ??
      (sanitizedBody !== undefined && existingWithVersions.source === 'ai_generated'
        ? 'edited_ai'
        : existingWithVersions.source);

    if (shouldSnapshotVersion) {
      const maxVer = existingWithVersions.versions.reduce(
        (acc, v) => Math.max(acc, v.versionNumber),
        0,
      );
      nextVersionNumber = Math.max(existingWithVersions.currentVersionNumber, maxVer) + 1;
      await this.request('content_asset_versions', {
        method: 'POST',
        body: JSON.stringify({
          user_id: this.userId,
          brand_id: brandId,
          asset_id: assetId,
          version_number: nextVersionNumber,
          title: nextTitle,
          body: nextBody,
          change_summary: String(
            patch.changeSummary ??
              (isProtectedStatus
                ? 'Edited previously approved asset (preserved approved snapshot)'
                : 'Saved new draft version'),
          ).trim(),
          action_type: String(patch.actionType ?? 'manual_edit').trim(),
          source: nextSource,
          prompt_id:
            patch.promptId !== undefined ? patch.promptId : existingWithVersions.promptId,
          prompt_version:
            patch.promptVersion !== undefined
              ? patch.promptVersion
              : existingWithVersions.promptVersion,
          model: patch.model !== undefined ? patch.model : existingWithVersions.model,
        }),
      });
    }

    const nextStatus: ContentAssetStatus =
      patch.workflowStatus ??
      (sanitizedBody !== undefined && isProtectedStatus
        ? 'in_progress'
        : existingWithVersions.workflowStatus);

    const bodyPatch: Record<string, unknown> = {
      updated_at: now,
      title: nextTitle,
      workflow_status: nextStatus,
      source: nextSource,
      current_version_number: nextVersionNumber,
    };
    if (patch.platform !== undefined) bodyPatch.platform = patch.platform.trim();
    if (patch.formatCategory !== undefined) bodyPatch.format_category = patch.formatCategory;
    if (patch.formatLabel !== undefined) bodyPatch.format_label = patch.formatLabel.trim();
    if (patch.contentPillar !== undefined) bodyPatch.content_pillar = patch.contentPillar.trim();
    if (patch.contentTheme !== undefined) bodyPatch.content_theme = patch.contentTheme.trim();
    if (patch.targetAudience !== undefined) bodyPatch.target_audience = patch.targetAudience.trim();
    if (patch.contentObjective !== undefined) {
      bodyPatch.content_objective = patch.contentObjective.trim();
    }
    if (patch.toneOfVoice !== undefined) bodyPatch.tone_of_voice = patch.toneOfVoice.trim();
    if (patch.contentLength !== undefined) bodyPatch.content_length = patch.contentLength;
    if (patch.scheduledDate !== undefined) {
      bodyPatch.scheduled_date =
        patch.scheduledDate && patch.scheduledDate.trim() ? patch.scheduledDate.trim() : null;
    }
    if (sanitizedBody !== undefined) bodyPatch.body = nextBody;
    if (patch.generationOptions !== undefined) {
      bodyPatch.generation_options = patch.generationOptions;
    }
    if (patch.promptId !== undefined) bodyPatch.prompt_id = patch.promptId;
    if (patch.promptVersion !== undefined) bodyPatch.prompt_version = patch.promptVersion;
    if (patch.model !== undefined) bodyPatch.model = patch.model;
    if (patch.generatedAt !== undefined) bodyPatch.generated_at = patch.generatedAt;
    if (nextStatus === 'approved') {
      bodyPatch.approved_version_number = nextVersionNumber;
      if (existingWithVersions.workflowStatus !== 'approved') {
        bodyPatch.approved_at = now;
      }
    }
    if (nextStatus === 'published' && existingWithVersions.workflowStatus !== 'published') {
      bodyPatch.published_at = now;
    }

    await this.request(
      `content_assets?id=eq.${encodeURIComponent(assetId)}&brand_id=eq.${encodeURIComponent(brandId)}&user_id=eq.${encodeURIComponent(this.userId)}`,
      {
        method: 'PATCH',
        body: JSON.stringify(bodyPatch),
      },
    );

    await this.syncSupabaseContentStudioMetrics(brand, now);
    return this.getContentAsset(brandId, assetId);
  }

  async createContentAssetVersion(
    brandId: string,
    assetId: string,
    input: CreateContentAssetVersionInput,
  ): Promise<ContentAssetWithVersions | null> {
    const brand = await this.requireOwnedBrand(brandId);
    if (input.source !== undefined && !isValidContentAssetSource(input.source)) {
      throw new ContentAssetValidationError(`Invalid source: ${input.source}`);
    }
    if (input.workflowStatus !== undefined && !isValidContentAssetStatus(input.workflowStatus)) {
      throw new ContentAssetValidationError(`Invalid workflowStatus: ${input.workflowStatus}`);
    }
    const existing = await this.getContentAsset(brandId, assetId);
    if (!existing) return null;

    const body = sanitizeAssetBody(input.body);
    const maxVer = existing.versions.reduce((acc, v) => Math.max(acc, v.versionNumber), 0);
    const nextVersionNumber = Math.max(existing.currentVersionNumber, maxVer) + 1;
    const now = new Date().toISOString();
    const nextTitle = input.title?.trim() || existing.title;
    const nextSource: ContentAssetSource = input.source ?? 'edited_ai';
    const isProtectedStatus =
      existing.workflowStatus === 'approved' || existing.workflowStatus === 'published';
    const nextStatus: ContentAssetStatus =
      input.workflowStatus ?? (isProtectedStatus ? 'in_progress' : existing.workflowStatus);

    await this.request('content_asset_versions', {
      method: 'POST',
      body: JSON.stringify({
        user_id: this.userId,
        brand_id: brandId,
        asset_id: assetId,
        version_number: nextVersionNumber,
        title: nextTitle,
        body,
        change_summary: String(input.changeSummary ?? `Version ${nextVersionNumber} saved`).trim(),
        action_type: String(input.actionType ?? 'refinement').trim(),
        source: nextSource,
        prompt_id: input.promptId !== undefined ? input.promptId : existing.promptId,
        prompt_version:
          input.promptVersion !== undefined ? input.promptVersion : existing.promptVersion,
        model: input.model !== undefined ? input.model : existing.model,
      }),
    });

    await this.request(
      `content_assets?id=eq.${encodeURIComponent(assetId)}&brand_id=eq.${encodeURIComponent(brandId)}&user_id=eq.${encodeURIComponent(this.userId)}`,
      {
        method: 'PATCH',
        body: JSON.stringify({
          title: nextTitle,
          body,
          source: nextSource,
          workflow_status: nextStatus,
          current_version_number: nextVersionNumber,
          prompt_id: input.promptId !== undefined ? input.promptId : existing.promptId,
          prompt_version:
            input.promptVersion !== undefined ? input.promptVersion : existing.promptVersion,
          model: input.model !== undefined ? input.model : existing.model,
          generated_at: input.generatedAt !== undefined ? input.generatedAt : existing.generatedAt,
          updated_at: now,
        }),
      },
    );

    await this.syncSupabaseContentStudioMetrics(brand, now);
    return this.getContentAsset(brandId, assetId);
  }

  async deleteContentAsset(brandId: string, assetId: string): Promise<boolean> {
    const brand = await this.requireOwnedBrand(brandId);
    const existing = await this.getContentAsset(brandId, assetId);
    if (!existing) return false;
    await this.request(
      `content_assets?id=eq.${encodeURIComponent(assetId)}&brand_id=eq.${encodeURIComponent(brandId)}&user_id=eq.${encodeURIComponent(this.userId)}`,
      { method: 'DELETE' },
    );
    await this.syncSupabaseContentStudioMetrics(brand, new Date().toISOString());
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
