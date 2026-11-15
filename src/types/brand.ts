export type ModuleStatus = 'not_started' | 'in_progress' | 'completed';

export type BrandModuleKey =
  | 'brandFoundation'
  | 'brandMessaging'
  | 'customerIntelligence'
  | 'marketingStrategy'
  | 'contentStrategy'
  | 'contentCalendar'
  | 'contentStudio';

export type WorkspaceSection =
  | 'overview'
  | 'brand-foundation'
  | 'brand-messaging'
  | 'customer-intelligence'
  | 'marketing-strategy'
  | 'content-strategy'
  | 'content-calendar'
  | 'content-studio'
  | 'brand-settings';

export type BrandModuleStatuses = Record<BrandModuleKey, ModuleStatus>;

export interface Brand {
  id: string;
  userId: string;
  brandName: string;
  businessDescription: string;
  industry: string;
  productsOrServices: string;
  targetMarket: string;
  primaryLocation: string;
  websiteUrl: string;
  socialLinks: string;
  existingMission: string;
  existingVision: string;
  marketingChallenges: string;
  businessGoals: string;
  competitors: string;
  additionalNotes: string;
  moduleStatuses: BrandModuleStatuses;
  contentPiecesCount: number;
  pendingApprovalsCount: number;
  createdAt: string;
  updatedAt: string;
  lastAccessedAt: string;
}

export interface BrandFormInput {
  brandName: string;
  businessDescription: string;
  industry: string;
  productsOrServices: string;
  targetMarket: string;
  primaryLocation: string;
  websiteUrl?: string;
  socialLinks?: string;
  existingMission?: string;
  existingVision?: string;
  marketingChallenges?: string;
  businessGoals?: string;
  competitors?: string;
  additionalNotes?: string;
}

export type BrandValidationErrors = Partial<Record<keyof BrandFormInput, string>>;

export type Phase2AModuleKey = 'brandFoundation' | 'brandMessaging';

export type StrategyModuleContent = Record<string, unknown>;

export interface BrandStrategyModule {
  id: string;
  userId: string;
  brandId: string;
  moduleKey: Phase2AModuleKey;
  status: ModuleStatus;
  content: StrategyModuleContent;
  promptId: string | null;
  promptVersion: string | null;
  model: string | null;
  generatedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UpsertBrandModuleInput {
  status?: ModuleStatus;
  content?: StrategyModuleContent;
  promptId?: string | null;
  promptVersion?: string | null;
  model?: string | null;
  generatedAt?: string | null;
}

export type ActivityType =
  | 'brand_created'
  | 'brand_updated'
  | 'workspace_accessed'
  | 'brand_deleted'
  | 'module_updated'
  | 'module_completed';

export interface ActivityEvent {
  id: string;
  userId: string;
  brandId: string | null;
  brandName: string;
  type: ActivityType;
  description: string;
  createdAt: string;
}

export interface UserProfile {
  id: string;
  fullName: string;
  email: string;
  role: string;
  organization: string;
}

export interface StorageStatus {
  mode: 'supabase' | 'local-file';
  persisted: boolean;
  supabaseConfigured: boolean;
  geminiConfigured: boolean;
  requiredEnvVars: Array<{
    key: string;
    configured: boolean;
    purpose: string;
  }>;
}

export interface WorkspaceOverviewResponse {
  brands: Brand[];
  activities: ActivityEvent[];
  profile: UserProfile;
  storage: StorageStatus;
}
