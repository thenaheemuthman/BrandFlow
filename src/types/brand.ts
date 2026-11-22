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

export type StrategyModuleKey =
  | Phase2AModuleKey
  | 'customerIntelligence'
  | 'marketingStrategy'
  | 'contentStrategy';

export type StrategyModuleContent = Record<string, unknown>;

export interface BrandStrategyModule {
  id: string;
  userId: string;
  brandId: string;
  moduleKey: StrategyModuleKey;
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

export type AllowedGeminiModel = 'gemini-4-hydrogen' | 'gemini-3.1-flash-lite';

export type AiResponseMimeType = 'application/json' | 'text/plain';

export type AiErrorCategory =
  | 'prompt_budget_exceeded'
  | 'missing_prerequisites'
  | 'authentication_failure'
  | 'rate_limited'
  | 'provider_unavailable'
  | 'request_timeout'
  | 'network_failure'
  | 'invalid_ai_response'
  | 'json_parse_failure'
  | 'persistence_failure'
  | 'request_cancelled';

export interface AiGenerateRequest {
  prompt: string;
  context?: string | Record<string, unknown>;
  model?: AllowedGeminiModel;
  responseMimeType?: AiResponseMimeType;
  responseSchema?: Record<string, unknown>;
}

export interface AiGenerateResponse {
  text: string;
  model: AllowedGeminiModel;
  generatedAt: string;
}

export type ContentCalendarStatus =
  | 'draft'
  | 'generating'
  | 'partial'
  | 'active'
  | 'completed'
  | 'archived';

export type CalendarWorkflowStatus =
  | 'planned'
  | 'in_progress'
  | 'ready_for_review'
  | 'approved'
  | 'published'
  | 'skipped';

export type CalendarItemSource = 'ai_generated' | 'edited_ai' | 'manual';

export interface ContentCalendarSettings {
  startDate: string; // YYYY-MM-DD
  durationDays: number; // default 30 (7..30)
  selectedPlatforms: string[];
  postsPerWeek: number;
  postingFrequencyLabel: string;
  preferredPostingDays: string[];
  preferredPostingTime: string;
  campaignObjectiveFocus: string;
  contentMixPreference: string;
  teamCapacityNote: string;
  specialDatesOrConstraints: string;
}

export interface CalendarBatchSegment {
  batchIndex: number;
  label: string;
  startDate: string;
  endDate: string;
  targetItemCount: number;
  status: 'pending' | 'running' | 'completed' | 'failed';
  itemCount: number;
  errorMessage?: string | null;
  errorCategory?: AiErrorCategory | null;
  completedAt?: string | null;
}

export interface CalendarGenerationState {
  totalBatches: number;
  completedBatches: number;
  batches: CalendarBatchSegment[];
  suppliedFactsUsed: string[];
  missingContextNotes: string[];
  researchCaveat: string;
  lastError?: string | null;
  lastErrorCategory?: AiErrorCategory | null;
}

export interface ContentCalendar {
  id: string;
  userId: string;
  brandId: string;
  name: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  durationDays: number;
  status: ContentCalendarStatus;
  settings: ContentCalendarSettings;
  upstreamSnapshot: Record<string, unknown>;
  generationState: CalendarGenerationState | null;
  promptId: string | null;
  promptVersion: string | null;
  model: string | null;
  generatedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ContentCalendarItem {
  id: string;
  userId: string;
  brandId: string;
  calendarId: string;
  scheduledDate: string; // YYYY-MM-DD
  suggestedTime: string;
  platform: string;
  title: string;
  contentPillar: string;
  contentTheme: string;
  contentFormat: string;
  contentSeries: string;
  targetAudience: string;
  audiencePainPoint: string;
  contentObjective: string;
  relatedMarketingObjective: string;
  coreMessage: string;
  suggestedAngle: string;
  intendedCta: string;
  relevantKpi: string;
  productionNotes: string;
  workflowStatus: CalendarWorkflowStatus;
  batchIndex: number | null;
  source: CalendarItemSource;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface ContentCalendarWithItems extends ContentCalendar {
  items: ContentCalendarItem[];
}

export interface CreateContentCalendarInput {
  name: string;
  startDate: string;
  endDate: string;
  durationDays?: number;
  status?: ContentCalendarStatus;
  settings: ContentCalendarSettings;
  upstreamSnapshot?: Record<string, unknown>;
  generationState?: CalendarGenerationState | null;
  promptId?: string | null;
  promptVersion?: string | null;
  model?: string | null;
  generatedAt?: string | null;
}

export interface UpdateContentCalendarInput {
  name?: string;
  startDate?: string;
  endDate?: string;
  durationDays?: number;
  status?: ContentCalendarStatus;
  settings?: ContentCalendarSettings;
  upstreamSnapshot?: Record<string, unknown>;
  generationState?: CalendarGenerationState | null;
  promptId?: string | null;
  promptVersion?: string | null;
  model?: string | null;
  generatedAt?: string | null;
}

export interface CreateContentCalendarItemInput {
  scheduledDate: string;
  suggestedTime?: string;
  platform: string;
  title: string;
  contentPillar: string;
  contentTheme?: string;
  contentFormat: string;
  contentSeries?: string;
  targetAudience: string;
  audiencePainPoint?: string;
  contentObjective: string;
  relatedMarketingObjective?: string;
  coreMessage: string;
  suggestedAngle?: string;
  intendedCta?: string;
  relevantKpi?: string;
  productionNotes?: string;
  workflowStatus?: CalendarWorkflowStatus;
  batchIndex?: number | null;
  source?: CalendarItemSource;
  sortOrder?: number;
}

export interface UpdateContentCalendarItemInput {
  scheduledDate?: string;
  suggestedTime?: string;
  platform?: string;
  title?: string;
  contentPillar?: string;
  contentTheme?: string;
  contentFormat?: string;
  contentSeries?: string;
  targetAudience?: string;
  audiencePainPoint?: string;
  contentObjective?: string;
  relatedMarketingObjective?: string;
  coreMessage?: string;
  suggestedAngle?: string;
  intendedCta?: string;
  relevantKpi?: string;
  productionNotes?: string;
  workflowStatus?: CalendarWorkflowStatus;
  batchIndex?: number | null;
  source?: CalendarItemSource;
  sortOrder?: number;
}

export interface ContentStudioHandoffPayload {
  schemaVersion: '1.0';
  brandId: string;
  brandName: string;
  calendarId: string;
  calendarName: string;
  calendarItemId: string;
  scheduledDate: string;
  suggestedTime: string;
  platform: string;
  title: string;
  contentPillar: string;
  contentTheme: string;
  contentFormat: string;
  contentSeries: string;
  targetAudience: string;
  audiencePainPoint: string;
  contentObjective: string;
  relatedMarketingObjective: string;
  coreMessage: string;
  suggestedAngle: string;
  intendedCta: string;
  relevantKpi: string;
  productionNotes: string;
  workflowStatus: CalendarWorkflowStatus;
}

// ============================================================================
// PHASE 2B: CONTENT STUDIO TYPES
// ============================================================================

export type ContentAssetStatus =
  | 'draft'
  | 'in_progress'
  | 'ready_for_review'
  | 'approved'
  | 'published'
  | 'archived';

export type ContentAssetFormatCategory =
  | 'social_post'
  | 'educational_post'
  | 'promotional_post'
  | 'story_post'
  | 'short_video_script'
  | 'carousel'
  | 'long_form_article'
  | 'platform_adaptation';

export type ContentAssetSource = 'ai_generated' | 'edited_ai' | 'manual';

export type ContentLengthPreference = 'short' | 'medium' | 'long';

export type ContentStudioRefinementAction =
  | 'regenerate'
  | 'refine_section'
  | 'alternative_hooks'
  | 'improve_clarity'
  | 'adjust_tone'
  | 'shorten'
  | 'expand'
  | 'adapt_platform';

export interface ContentCarouselSlide {
  slideNumber: number;
  headline: string;
  body: string;
  visualCue: string;
}

export interface ContentVideoScene {
  sceneNumber: number;
  visual: string;
  dialogue: string;
  durationHint: string;
}

export interface ContentArticleSection {
  heading: string;
  body: string;
}

export interface ContentAssetBody {
  hook: string;
  alternativeHooks: string[];
  mainCopy: string;
  cta: string;
  hashtags: string[];
  visualDirection: string;
  carouselSlides: ContentCarouselSlide[];
  videoScript: {
    hook: string;
    scenes: ContentVideoScene[];
    cta: string;
  } | null;
  articleSections: ContentArticleSection[];
  adaptationNotes: string;
  suppliedFactsUsed: string[];
  missingContextNotes: string[];
  researchCaveat: string;
}

export interface ContentStudioGenerationOptions {
  platform: string;
  formatCategory: ContentAssetFormatCategory;
  formatLabel: string;
  toneOfVoice: string;
  contentLength: ContentLengthPreference;
  primaryObjective: string;
  targetAudience: string;
  ctaPreference: string;
  additionalInstructions: string;
}

export interface ContentAssetVersion {
  id: string;
  userId: string;
  brandId: string;
  assetId: string;
  versionNumber: number;
  title: string;
  body: ContentAssetBody;
  changeSummary: string;
  actionType: string;
  source: ContentAssetSource;
  promptId: string | null;
  promptVersion: string | null;
  model: string | null;
  createdAt: string;
}

export interface ContentAsset {
  id: string;
  userId: string;
  brandId: string;
  calendarId: string | null;
  calendarItemId: string | null;
  title: string;
  platform: string;
  formatCategory: ContentAssetFormatCategory;
  formatLabel: string;
  contentPillar: string;
  contentTheme: string;
  targetAudience: string;
  contentObjective: string;
  toneOfVoice: string;
  contentLength: ContentLengthPreference;
  scheduledDate: string | null;
  workflowStatus: ContentAssetStatus;
  source: ContentAssetSource;
  currentVersionNumber: number;
  approvedVersionNumber: number | null;
  approvedAt: string | null;
  publishedAt: string | null;
  body: ContentAssetBody;
  generationOptions: ContentStudioGenerationOptions;
  handoffSnapshot: ContentStudioHandoffPayload | null;
  promptId: string | null;
  promptVersion: string | null;
  model: string | null;
  generatedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ContentAssetWithVersions extends ContentAsset {
  versions: ContentAssetVersion[];
}

export interface CreateContentAssetInput {
  calendarId?: string | null;
  calendarItemId?: string | null;
  title: string;
  platform: string;
  formatCategory: ContentAssetFormatCategory;
  formatLabel?: string;
  contentPillar?: string;
  contentTheme?: string;
  targetAudience?: string;
  contentObjective?: string;
  toneOfVoice?: string;
  contentLength?: ContentLengthPreference;
  scheduledDate?: string | null;
  workflowStatus?: ContentAssetStatus;
  source?: ContentAssetSource;
  body: ContentAssetBody;
  generationOptions?: ContentStudioGenerationOptions;
  handoffSnapshot?: ContentStudioHandoffPayload | null;
  changeSummary?: string;
  actionType?: string;
  promptId?: string | null;
  promptVersion?: string | null;
  model?: string | null;
  generatedAt?: string | null;
}

export interface UpdateContentAssetInput {
  title?: string;
  platform?: string;
  formatCategory?: ContentAssetFormatCategory;
  formatLabel?: string;
  contentPillar?: string;
  contentTheme?: string;
  targetAudience?: string;
  contentObjective?: string;
  toneOfVoice?: string;
  contentLength?: ContentLengthPreference;
  scheduledDate?: string | null;
  workflowStatus?: ContentAssetStatus;
  source?: ContentAssetSource;
  body?: ContentAssetBody;
  generationOptions?: ContentStudioGenerationOptions;
  promptId?: string | null;
  promptVersion?: string | null;
  model?: string | null;
  generatedAt?: string | null;
  createVersion?: boolean;
  changeSummary?: string;
  actionType?: string;
}

export interface CreateContentAssetVersionInput {
  title?: string;
  body: ContentAssetBody;
  changeSummary?: string;
  actionType?: string;
  source?: ContentAssetSource;
  workflowStatus?: ContentAssetStatus;
  promptId?: string | null;
  promptVersion?: string | null;
  model?: string | null;
  generatedAt?: string | null;
}


