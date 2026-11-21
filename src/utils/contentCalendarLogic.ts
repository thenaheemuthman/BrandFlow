import type {
  AiErrorCategory,
  Brand,
  BrandStrategyModule,
  CalendarBatchSegment,
  CalendarGenerationState,
  CalendarWorkflowStatus,
  ContentCalendar,
  ContentCalendarItem,
  ContentCalendarSettings,
  ContentCalendarStatus,
  ContentStudioHandoffPayload,
  CreateContentCalendarItemInput,
  StrategyModuleKey,
  WorkspaceSection,
} from '../types/brand.ts';
import type { PromptExecutionResult } from '../prompts/types.ts';

export const CALENDAR_WORKFLOW_STATUSES: ReadonlyArray<{
  value: CalendarWorkflowStatus;
  label: string;
}> = [
  { value: 'planned', label: 'Planned' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'ready_for_review', label: 'Ready for Review' },
  { value: 'approved', label: 'Approved' },
  { value: 'published', label: 'Published' },
  { value: 'skipped', label: 'Skipped' },
];

export const CONTENT_CALENDAR_STATUSES: ReadonlyArray<{
  value: ContentCalendarStatus;
  label: string;
}> = [
  { value: 'draft', label: 'Draft' },
  { value: 'generating', label: 'Generating' },
  { value: 'partial', label: 'Partial (Action Needed)' },
  { value: 'active', label: 'Active' },
  { value: 'completed', label: 'Completed' },
  { value: 'archived', label: 'Archived' },
];

export const WEEKDAY_OPTIONS = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
] as const;

export interface CalendarPrerequisiteItem {
  moduleKey: StrategyModuleKey;
  section: WorkspaceSection;
  label: string;
  met: boolean;
  reason: string;
}

export interface CalendarPrerequisiteCheck {
  ready: boolean;
  items: CalendarPrerequisiteItem[];
  missingLabels: string[];
}

export interface ApprovedCalendarContext {
  approvedPlatforms: string[];
  platformFrequencyHints: Record<string, string>;
  approvedPillars: string[];
  approvedThemes: string[];
  approvedFormats: string[];
  approvedSeries: string[];
  approvedContentObjectives: string[];
  approvedMarketingObjectives: string[];
  approvedKpis: string[];
  approvedPersonas: string[];
  approvedInterests: string[];
  recommendedPostsPerWeek: number;
  recommendedFrequencyLabel: string;
}

export interface CalendarItemFilters {
  platform: string;
  pillar: string;
  format: string;
  status: string;
  query: string;
}

export interface CalendarStatsSummary {
  totalItems: number;
  byStatus: Record<CalendarWorkflowStatus, number>;
  byPlatform: Array<{ name: string; count: number }>;
  byPillar: Array<{ name: string; count: number }>;
  byFormat: Array<{ name: string; count: number }>;
  coveredDays: number;
  totalDays: number;
}

export interface MonthlyGridCell {
  isoDate: string;
  dayOfMonth: number;
  monthLabel: string;
  inCalendarWindow: boolean;
  items: ContentCalendarItem[];
}

export interface WeeklyCalendarGroup {
  weekNumber: number;
  label: string;
  startDate: string;
  endDate: string;
  days: Array<{
    isoDate: string;
    weekdayShort: string;
    displayDate: string;
    items: ContentCalendarItem[];
  }>;
  totalItems: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function cleanString(value: unknown): string {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
}

function uniqueStrings(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const val of values) {
    const cleaned = cleanString(val);
    if (!cleaned) continue;
    const key = cleaned.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(cleaned);
  }
  return out;
}

function getApprovedListFromModule(
  mod: BrandStrategyModule | undefined,
  key: string,
): Record<string, unknown>[] {
  if (!mod || !isRecord(mod.content)) return [];
  const summaryList =
    mod.status === 'completed' &&
    isRecord(mod.content.approvedSummary) &&
    Array.isArray(mod.content.approvedSummary[key])
      ? (mod.content.approvedSummary[key] as unknown[])
      : null;

  if (summaryList) {
    return summaryList.filter((entry): entry is Record<string, unknown> => isRecord(entry));
  }

  const directList = Array.isArray(mod.content[key]) ? (mod.content[key] as unknown[]) : [];
  return directList.filter(
    (entry): entry is Record<string, unknown> => isRecord(entry) && entry.approved === true,
  );
}

function hasApprovedFoundation(mod: BrandStrategyModule | undefined): boolean {
  if (!mod || mod.status === 'not_started' || !isRecord(mod.content)) return false;
  if (mod.status === 'completed' && isRecord(mod.content.approvedSummary)) return true;
  const sectionKeys = ['purpose', 'mission', 'vision', 'coreValues', 'positioning'];
  return sectionKeys.some((key) => {
    const sec = mod.content[key];
    return isRecord(sec) && sec.approved === true;
  });
}

function hasApprovedMessaging(mod: BrandStrategyModule | undefined): boolean {
  if (!mod || mod.status === 'not_started' || !isRecord(mod.content)) return false;
  if (mod.status === 'completed' && isRecord(mod.content.approvedSummary)) return true;
  const sectionKeys = ['coreValueProposition', 'messagingPillars', 'voiceAndTone', 'audienceAngles'];
  return sectionKeys.some((key) => {
    const sec = mod.content[key];
    return isRecord(sec) && sec.approved === true;
  });
}

/**
 * Evaluates all five upstream strategy prerequisites strictly scoped to `brand.id`.
 * Never reads or trusts modules belonging to another brand.
 */
export function evaluateCalendarPrerequisites(
  brand: Brand,
  strategyModules: readonly BrandStrategyModule[],
): CalendarPrerequisiteCheck {
  const byKey = new Map<StrategyModuleKey, BrandStrategyModule>();
  for (const mod of strategyModules) {
    if (mod.brandId !== brand.id) continue;
    byKey.set(mod.moduleKey, mod);
  }

  const foundationMod = byKey.get('brandFoundation');
  const messagingMod = byKey.get('brandMessaging');
  const customerMod = byKey.get('customerIntelligence');
  const marketingMod = byKey.get('marketingStrategy');
  const contentMod = byKey.get('contentStrategy');

  const foundationReady = hasApprovedFoundation(foundationMod);
  const messagingReady = hasApprovedMessaging(messagingMod);

  const approvedPersonas = getApprovedListFromModule(customerMod, 'personas');
  const approvedInterests = getApprovedListFromModule(customerMod, 'interests');
  const customerReady = approvedPersonas.length > 0 && approvedInterests.length > 0;

  const approvedMktObjectives = getApprovedListFromModule(marketingMod, 'objectives');
  const approvedMktChannels = getApprovedListFromModule(marketingMod, 'channels');
  const marketingReady = approvedMktObjectives.length > 0 && approvedMktChannels.length > 0;

  const approvedContentObjectives = getApprovedListFromModule(contentMod, 'objectives');
  const approvedContentPillars = getApprovedListFromModule(contentMod, 'pillars');
  const approvedContentFormats = getApprovedListFromModule(contentMod, 'formats');
  const contentReady =
    approvedContentObjectives.length > 0 &&
    approvedContentPillars.length > 0 &&
    approvedContentFormats.length > 0;

  const items: CalendarPrerequisiteItem[] = [
    {
      moduleKey: 'brandFoundation',
      section: 'brand-foundation',
      label: 'Brand Foundation',
      met: foundationReady,
      reason: foundationReady
        ? 'Approved brand positioning and core identity available.'
        : 'Approve your Brand Foundation statements before building a calendar.',
    },
    {
      moduleKey: 'brandMessaging',
      section: 'brand-messaging',
      label: 'Brand Messaging',
      met: messagingReady,
      reason: messagingReady
        ? 'Approved value proposition, voice, and messaging pillars available.'
        : 'Approve your Brand Messaging guidelines before building a calendar.',
    },
    {
      moduleKey: 'customerIntelligence',
      section: 'customer-intelligence',
      label: 'Customer Intelligence',
      met: customerReady,
      reason: customerReady
        ? `${approvedPersonas.length} approved persona(s) and ${approvedInterests.length} interest cluster(s).`
        : 'Approve at least one Customer Persona and Audience Interest cluster.',
    },
    {
      moduleKey: 'marketingStrategy',
      section: 'marketing-strategy',
      label: 'Marketing Strategy',
      met: marketingReady,
      reason: marketingReady
        ? `${approvedMktObjectives.length} approved objective(s) and ${approvedMktChannels.length} channel(s).`
        : 'Approve Marketing Objectives and Marketing Channels first.',
    },
    {
      moduleKey: 'contentStrategy',
      section: 'content-strategy',
      label: 'Content Strategy',
      met: contentReady,
      reason: contentReady
        ? `${approvedContentObjectives.length} objective(s), ${approvedContentPillars.length} pillar(s), and ${approvedContentFormats.length} format(s) approved.`
        : 'Approve Content Objectives, Content Pillars, and Content Formats in Content Strategy.',
    },
  ];

  const missingLabels = items.filter((item) => !item.met).map((item) => item.label);
  return {
    ready: missingLabels.length === 0,
    items,
    missingLabels,
  };
}

function parseFrequencyNumber(text: string): number {
  const normalized = text.toLowerCase();
  const rangeMatch = normalized.match(/(\d+)\s*(?:-|to|–)\s*(\d+)\s*(?:x|times?|posts?|pieces?)?\s*(?:\/|per)\s*week/);
  if (rangeMatch) {
    return Math.max(1, Math.round((Number(rangeMatch[1]) + Number(rangeMatch[2])) / 2));
  }
  const perWeekMatch = normalized.match(/(\d+)\s*(?:x|times?|posts?|pieces?)?\s*(?:\/|per)\s*week/);
  if (perWeekMatch) {
    return Math.max(1, Number(perWeekMatch[1]));
  }
  if (/daily|every\s+day/.test(normalized)) return 5;
  if (/bi-?weekly|every\s+two\s+weeks/.test(normalized)) return 1;
  if (/weekly|once\s+a\s+week/.test(normalized)) return 1;
  return 0;
}

/**
 * Extracts approved upstream strategy elements strictly for `brand.id`
 * so calendar configuration and dropdown options never invent unapproved channels or pillars.
 */
export function extractApprovedCalendarContext(
  brand: Brand,
  strategyModules: readonly BrandStrategyModule[],
): ApprovedCalendarContext {
  const byKey = new Map<StrategyModuleKey, BrandStrategyModule>();
  for (const mod of strategyModules) {
    if (mod.brandId !== brand.id) continue;
    byKey.set(mod.moduleKey, mod);
  }

  const customerMod = byKey.get('customerIntelligence');
  const marketingMod = byKey.get('marketingStrategy');
  const contentMod = byKey.get('contentStrategy');

  const distribution = getApprovedListFromModule(contentMod, 'distribution');
  const channels = getApprovedListFromModule(marketingMod, 'channels');
  const pillars = getApprovedListFromModule(contentMod, 'pillars');
  const themes = getApprovedListFromModule(contentMod, 'themes');
  const formats = getApprovedListFromModule(contentMod, 'formats');
  const series = getApprovedListFromModule(contentMod, 'series');
  const contentObjectives = getApprovedListFromModule(contentMod, 'objectives');
  const mktObjectives = getApprovedListFromModule(marketingMod, 'objectives');
  const kpis = getApprovedListFromModule(marketingMod, 'kpis');
  const personas = getApprovedListFromModule(customerMod, 'personas');
  const interests = getApprovedListFromModule(customerMod, 'interests');

  const platformFrequencyHints: Record<string, string> = {};
  const distributionPlatforms: string[] = [];
  let inferredWeeklyPosts = 0;

  for (const item of distribution) {
    const platform = cleanString(item.platformName);
    if (!platform) continue;
    distributionPlatforms.push(platform);
    const freq = cleanString(item.recommendedFrequency);
    if (freq) {
      platformFrequencyHints[platform] = freq;
      inferredWeeklyPosts += parseFrequencyNumber(freq);
    }
  }

  const marketingPlatforms = channels
    .map((c) => cleanString(c.channelName))
    .filter(Boolean);

  const approvedPlatforms = uniqueStrings([...distributionPlatforms, ...marketingPlatforms]);

  // Clamp conservative practical default (3 to 7 posts/week) based on approved distribution cadence.
  const recommendedPostsPerWeek =
    inferredWeeklyPosts > 0
      ? Math.min(7, Math.max(2, inferredWeeklyPosts))
      : Math.min(5, Math.max(3, approvedPlatforms.length || 3));

  const recommendedFrequencyLabel =
    inferredWeeklyPosts > 0
      ? `${recommendedPostsPerWeek} posts/week (derived from approved distribution plan)`
      : `${recommendedPostsPerWeek} posts/week (balanced starter cadence across approved channels)`;

  return {
    approvedPlatforms,
    platformFrequencyHints,
    approvedPillars: uniqueStrings(pillars.map((p) => cleanString(p.name))),
    approvedThemes: uniqueStrings(themes.map((t) => cleanString(t.title))),
    approvedFormats: uniqueStrings(formats.map((f) => cleanString(f.formatName))),
    approvedSeries: uniqueStrings(series.map((s) => cleanString(s.seriesName))),
    approvedContentObjectives: uniqueStrings(contentObjectives.map((o) => cleanString(o.title))),
    approvedMarketingObjectives: uniqueStrings(mktObjectives.map((o) => cleanString(o.title))),
    approvedKpis: uniqueStrings(kpis.map((k) => cleanString(k.kpiName))),
    approvedPersonas: uniqueStrings(personas.map((p) => cleanString(p.name))),
    approvedInterests: uniqueStrings(interests.map((i) => cleanString(i.topic))),
    recommendedPostsPerWeek,
    recommendedFrequencyLabel,
  };
}

export function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m - 1 &&
    dt.getUTCDate() === d
  );
}

export function formatUtcDateIso(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getTodayIsoDate(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function parseIsoDateUtc(isoDate: string): Date {
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function addDaysIso(isoDate: string, deltaDays: number): string {
  const dt = parseIsoDateUtc(isoDate);
  dt.setUTCDate(dt.getUTCDate() + deltaDays);
  return formatUtcDateIso(dt);
}

export function diffDaysInclusive(startIso: string, endIso: string): number {
  const start = parseIsoDateUtc(startIso).getTime();
  const end = parseIsoDateUtc(endIso).getTime();
  return Math.floor((end - start) / 86_400_000) + 1;
}

export function computeEndDate(startDate: string, durationDays = 30): string {
  const safeDuration = Math.min(90, Math.max(1, Math.round(durationDays)));
  return addDaysIso(startDate, safeDuration - 1);
}

export function formatCalendarDisplayDate(isoDate: string): string {
  if (!isValidIsoDate(isoDate)) return isoDate;
  const dt = parseIsoDateUtc(isoDate);
  return dt.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export function getWeekdayName(isoDate: string): string {
  const dt = parseIsoDateUtc(isoDate);
  const names = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return names[dt.getUTCDay()] ?? 'Monday';
}

export function buildDefaultCalendarSettings(
  approvedContext: ApprovedCalendarContext,
  startDate = getTodayIsoDate(),
): ContentCalendarSettings {
  const safeStart = isValidIsoDate(startDate) ? startDate : getTodayIsoDate();
  const selectedPlatforms = approvedContext.approvedPlatforms.slice(0, 4);
  const postsPerWeek = approvedContext.recommendedPostsPerWeek;
  const preferredPostingDays =
    postsPerWeek >= 5
      ? ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
      : postsPerWeek === 4
        ? ['Monday', 'Tuesday', 'Thursday', 'Friday']
        : ['Tuesday', 'Thursday', 'Saturday'];

  return {
    startDate: safeStart,
    durationDays: 30,
    selectedPlatforms,
    postsPerWeek,
    postingFrequencyLabel: approvedContext.recommendedFrequencyLabel,
    preferredPostingDays,
    preferredPostingTime: '09:00 AM',
    campaignObjectiveFocus: approvedContext.approvedContentObjectives[0] ?? '',
    contentMixPreference: 'Balanced across approved content pillars and formats',
    teamCapacityNote: '',
    specialDatesOrConstraints: '',
  };
}

export function buildDefaultCalendarName(brandName: string, startDate: string): string {
  if (!isValidIsoDate(startDate)) return `${brandName} — 30-Day Content Calendar`;
  const dt = parseIsoDateUtc(startDate);
  const monthYear = dt.toLocaleDateString('en-US', {
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
  return `${monthYear} 30-Day Calendar`;
}

export function buildUpstreamSnapshot(
  brand: Brand,
  strategyModules: readonly BrandStrategyModule[],
  approvedContext: ApprovedCalendarContext,
): Record<string, unknown> {
  const moduleSummary: Record<string, { status: string; updatedAt: string }> = {};
  for (const mod of strategyModules) {
    if (mod.brandId !== brand.id) continue;
    moduleSummary[mod.moduleKey] = {
      status: mod.status,
      updatedAt: mod.updatedAt,
    };
  }
  return {
    capturedAt: new Date().toISOString(),
    brandId: brand.id,
    modules: moduleSummary,
    approvedCounts: {
      platforms: approvedContext.approvedPlatforms.length,
      pillars: approvedContext.approvedPillars.length,
      themes: approvedContext.approvedThemes.length,
      formats: approvedContext.approvedFormats.length,
      series: approvedContext.approvedSeries.length,
      contentObjectives: approvedContext.approvedContentObjectives.length,
      marketingObjectives: approvedContext.approvedMarketingObjectives.length,
      personas: approvedContext.approvedPersonas.length,
    },
  };
}

/**
 * Splits a calendar window (default 30 days) into non-overlapping weekly batches.
 * For 30 days:
 *   Batch 1: Days 1–7   (7 days)
 *   Batch 2: Days 8–14  (7 days)
 *   Batch 3: Days 15–21 (7 days)
 *   Batch 4: Days 22–30 (9 days)
 * Ensures complete contiguous coverage with bounded item counts per batch so each AI call stays fast and reliable.
 */
export function planCalendarBatches(
  settings: ContentCalendarSettings,
): CalendarBatchSegment[] {
  const durationDays = Math.min(30, Math.max(7, Math.round(settings.durationDays || 30)));
  const startDate = isValidIsoDate(settings.startDate) ? settings.startDate : getTodayIsoDate();
  const postsPerWeek = Math.min(10, Math.max(1, Math.round(settings.postsPerWeek || 4)));

  const ranges: Array<{ startOffset: number; endOffset: number }> = [];
  let cursor = 0;
  while (cursor < durationDays) {
    const remaining = durationDays - cursor;
    // Merge trailing 1–3 days into the final weekly batch (e.g., Days 22–30 = 9 days for 30-day calendar)
    const span = remaining <= 10 ? remaining : 7;
    ranges.push({ startOffset: cursor, endOffset: cursor + span - 1 });
    cursor += span;
  }

  return ranges.map((range, idx) => {
    const segStart = addDaysIso(startDate, range.startOffset);
    const segEnd = addDaysIso(startDate, range.endOffset);
    const daySpan = range.endOffset - range.startOffset + 1;
    const scaledCount = Math.round((postsPerWeek * daySpan) / 7);
    const targetItemCount = Math.min(8, Math.max(2, scaledCount));

    return {
      batchIndex: idx,
      label: `Week ${idx + 1} (Days ${range.startOffset + 1}–${range.endOffset + 1})`,
      startDate: segStart,
      endDate: segEnd,
      targetItemCount,
      status: 'pending',
      itemCount: 0,
      errorMessage: null,
      errorCategory: null,
      completedAt: null,
    };
  });
}

export function createInitialGenerationState(
  batches: readonly CalendarBatchSegment[],
): CalendarGenerationState {
  return {
    totalBatches: batches.length,
    completedBatches: 0,
    batches: batches.map((b) => ({ ...b })),
    suppliedFactsUsed: [],
    missingContextNotes: [],
    researchCaveat: '',
    lastError: null,
    lastErrorCategory: null,
  };
}

export function updateBatchStateInGeneration(
  state: CalendarGenerationState,
  batchIndex: number,
  patch: Partial<CalendarBatchSegment>,
  extra?: {
    suppliedFactsUsed?: string[];
    missingContextNotes?: string[];
    researchCaveat?: string;
    lastError?: string | null;
    lastErrorCategory?: AiErrorCategory | null;
  },
): {
  nextState: CalendarGenerationState;
  derivedCalendarStatus: ContentCalendarStatus;
} {
  const nextBatches = state.batches.map((batch) =>
    batch.batchIndex === batchIndex ? { ...batch, ...patch } : batch,
  );
  const completedBatches = nextBatches.filter((b) => b.status === 'completed').length;
  const anyFailed = nextBatches.some((b) => b.status === 'failed');
  const anyRunning = nextBatches.some((b) => b.status === 'running');
  const allCompleted = nextBatches.length > 0 && completedBatches === nextBatches.length;

  let derivedCalendarStatus: ContentCalendarStatus = 'draft';
  if (allCompleted) {
    derivedCalendarStatus = 'active';
  } else if (anyRunning) {
    derivedCalendarStatus = 'generating';
  } else if (anyFailed) {
    derivedCalendarStatus = 'partial';
  } else if (completedBatches > 0) {
    derivedCalendarStatus = 'partial';
  }

  const nextState: CalendarGenerationState = {
    totalBatches: nextBatches.length,
    completedBatches,
    batches: nextBatches,
    suppliedFactsUsed: uniqueStrings([
      ...state.suppliedFactsUsed,
      ...(extra?.suppliedFactsUsed ?? []),
    ]).slice(0, 12),
    missingContextNotes: uniqueStrings([
      ...state.missingContextNotes,
      ...(extra?.missingContextNotes ?? []),
    ]).slice(0, 10),
    researchCaveat: extra?.researchCaveat || state.researchCaveat,
    lastError: extra?.lastError !== undefined ? extra.lastError : state.lastError ?? null,
    lastErrorCategory:
      extra?.lastErrorCategory !== undefined
        ? extra.lastErrorCategory
        : state.lastErrorCategory ?? null,
  };

  return { nextState, derivedCalendarStatus };
}

export function buildCalendarBatchVariables(
  settings: ContentCalendarSettings,
  batch: CalendarBatchSegment,
  previouslyScheduledItems: readonly Pick<
    ContentCalendarItem,
    'scheduledDate' | 'platform' | 'title' | 'contentPillar'
  >[],
): Record<string, unknown> {
  const previousCompact = previouslyScheduledItems.slice(-24).map((item) => ({
    date: item.scheduledDate,
    platform: item.platform,
    pillar: item.contentPillar,
    title: item.title,
  }));

  return {
    calendarBatchPlan: {
      batchLabel: batch.label,
      startDate: batch.startDate,
      endDate: batch.endDate,
      targetItemCount: batch.targetItemCount,
      selectedPlatforms: settings.selectedPlatforms,
      preferredDays: settings.preferredPostingDays,
      preferredTime: settings.preferredPostingTime || '09:00 AM',
      postingFrequency:
        settings.postingFrequencyLabel || `${settings.postsPerWeek} posts per week`,
      campaignObjectiveFocus: settings.campaignObjectiveFocus || '',
      contentMixPreference: settings.contentMixPreference || '',
      teamCapacityNote: settings.teamCapacityNote || '',
      specialDatesOrConstraints: settings.specialDatesOrConstraints || '',
    },
    previouslyScheduledSummary: previousCompact,
  };
}

function clampDateIntoBatchWindow(
  rawDate: string,
  batch: CalendarBatchSegment,
  preferredDays: readonly string[],
  slotIndex: number,
): string {
  if (isValidIsoDate(rawDate) && rawDate >= batch.startDate && rawDate <= batch.endDate) {
    return rawDate;
  }

  const totalDays = Math.max(1, diffDaysInclusive(batch.startDate, batch.endDate));
  const candidateDates: string[] = [];
  const preferredSet = new Set(preferredDays.map((d) => d.toLowerCase()));

  for (let offset = 0; offset < totalDays; offset += 1) {
    const iso = addDaysIso(batch.startDate, offset);
    if (preferredSet.size === 0 || preferredSet.has(getWeekdayName(iso).toLowerCase())) {
      candidateDates.push(iso);
    }
  }

  const pool =
    candidateDates.length > 0
      ? candidateDates
      : Array.from({ length: totalDays }, (_, offset) => addDaysIso(batch.startDate, offset));

  return pool[slotIndex % pool.length] ?? batch.startDate;
}

function resolveAllowedPlatform(
  rawPlatform: string,
  allowedPlatforms: readonly string[],
  platformCounts: Map<string, number>,
): string {
  const cleaned = cleanString(rawPlatform);
  const exact = allowedPlatforms.find((p) => p.toLowerCase() === cleaned.toLowerCase());
  if (exact) return exact;

  const partial = allowedPlatforms.find(
    (p) =>
      cleaned &&
      (p.toLowerCase().includes(cleaned.toLowerCase()) ||
        cleaned.toLowerCase().includes(p.toLowerCase())),
  );
  if (partial) return partial;

  // Pick the least-used approved platform so channel mix stays balanced without inventing channels.
  let chosen = allowedPlatforms[0] ?? cleaned;
  let minCount = Number.POSITIVE_INFINITY;
  for (const platform of allowedPlatforms) {
    const count = platformCounts.get(platform.toLowerCase()) ?? 0;
    if (count < minCount) {
      minCount = count;
      chosen = platform;
    }
  }
  return chosen;
}

/**
 * Validates, deduplicates, and normalizes AI-generated weekly batch output
 * into persistence-ready `CreateContentCalendarItemInput[]`.
 * Enforces:
 * - Only approved `selectedPlatforms` are permitted.
 * - Every `scheduledDate` falls inside the batch window.
 * - No duplicate titles vs previously scheduled items or within the batch.
 * - Every generated item starts with `workflowStatus: 'planned'` (never auto-published).
 */
export function applyCalendarBatchOutput(params: {
  result: PromptExecutionResult;
  batch: CalendarBatchSegment;
  settings: ContentCalendarSettings;
  approvedContext: ApprovedCalendarContext;
  existingItems: readonly Pick<ContentCalendarItem, 'title' | 'platform' | 'scheduledDate'>[];
}): {
  items: CreateContentCalendarItemInput[];
  suppliedFactsUsed: string[];
  missingContextNotes: string[];
  researchCaveat: string;
} {
  const { result, batch, settings, approvedContext, existingItems } = params;
  if (result.status !== 'success') {
    throw new Error(
      result.status === 'missing_information'
        ? result.message
        : result.error || 'AI calendar batch output failed validation.',
    );
  }

  const output = result.output;
  const rawItems = Array.isArray(output.items) ? output.items : [];
  const allowedPlatforms =
    settings.selectedPlatforms.length > 0
      ? settings.selectedPlatforms
      : approvedContext.approvedPlatforms;

  if (allowedPlatforms.length === 0) {
    throw new Error('Select at least one approved marketing channel before generating a calendar.');
  }

  const seenTitleKeys = new Set<string>(
    existingItems.map((item) => cleanString(item.title).toLowerCase()).filter(Boolean),
  );
  const platformCounts = new Map<string, number>();
  for (const item of existingItems) {
    const key = cleanString(item.platform).toLowerCase();
    if (key) platformCounts.set(key, (platformCounts.get(key) ?? 0) + 1);
  }

  const normalized: CreateContentCalendarItemInput[] = [];

  for (let idx = 0; idx < rawItems.length; idx += 1) {
    const raw = rawItems[idx];
    if (!isRecord(raw)) continue;

    let title = cleanString(raw.title);
    if (!title) continue;

    const titleKey = title.toLowerCase();
    if (seenTitleKeys.has(titleKey)) {
      const angle = cleanString(raw.suggestedAngle);
      if (angle && !seenTitleKeys.has(`${titleKey}::${angle.toLowerCase()}`)) {
        title = `${title} (${angle.slice(0, 42).replace(/[.,;:]+$/, '')})`;
      } else {
        continue;
      }
    }
    seenTitleKeys.add(title.toLowerCase());

    const platform = resolveAllowedPlatform(
      cleanString(raw.platform),
      allowedPlatforms,
      platformCounts,
    );
    platformCounts.set(platform.toLowerCase(), (platformCounts.get(platform.toLowerCase()) ?? 0) + 1);

    const scheduledDate = clampDateIntoBatchWindow(
      cleanString(raw.scheduledDate),
      batch,
      settings.preferredPostingDays,
      idx,
    );

    const contentPillar =
      cleanString(raw.contentPillar) || approvedContext.approvedPillars[0] || 'Core Editorial Pillar';
    const contentFormat =
      cleanString(raw.contentFormat) || approvedContext.approvedFormats[0] || 'Editorial Post';
    const targetAudience =
      cleanString(raw.targetAudience) || approvedContext.approvedPersonas[0] || 'Core Target Audience';
    const contentObjective =
      cleanString(raw.contentObjective) ||
      approvedContext.approvedContentObjectives[0] ||
      'Build audience trust';

    normalized.push({
      scheduledDate,
      suggestedTime: cleanString(raw.suggestedTime) || settings.preferredPostingTime || '09:00 AM',
      platform,
      title,
      contentPillar,
      contentTheme: cleanString(raw.contentTheme) || approvedContext.approvedThemes[0] || '',
      contentFormat,
      contentSeries: cleanString(raw.contentSeries),
      targetAudience,
      audiencePainPoint: cleanString(raw.audiencePainPoint),
      contentObjective,
      relatedMarketingObjective:
        cleanString(raw.relatedMarketingObjective) ||
        approvedContext.approvedMarketingObjectives[0] ||
        '',
      coreMessage: cleanString(raw.coreMessage) || title,
      suggestedAngle: cleanString(raw.suggestedAngle),
      intendedCta: cleanString(raw.intendedCta),
      relevantKpi: cleanString(raw.relevantKpi) || approvedContext.approvedKpis[0] || '',
      productionNotes: cleanString(raw.productionNotes),
      workflowStatus: 'planned',
      batchIndex: batch.batchIndex,
      source: 'ai_generated',
      sortOrder: idx,
    });
  }

  if (normalized.length === 0) {
    throw new Error(
      `AI returned no valid, non-duplicate entries for ${batch.label}. Please retry this batch.`,
    );
  }

  normalized.sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate) || (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

  const suppliedFactsUsed = Array.isArray(output.suppliedFactsUsed)
    ? output.suppliedFactsUsed.map(cleanString).filter(Boolean)
    : [];
  const missingContextNotes = Array.isArray(output.missingContextNotes)
    ? output.missingContextNotes.map(cleanString).filter(Boolean)
    : [];
  const researchCaveat =
    cleanString(output.researchCaveat) ||
    'These calendar entries are AI planning drafts and require owner review before content production.';

  return {
    items: normalized,
    suppliedFactsUsed,
    missingContextNotes,
    researchCaveat,
  };
}

export function validateCalendarItemInput(
  input: Partial<CreateContentCalendarItemInput>,
  allowedPlatforms?: readonly string[],
): string | null {
  if (!cleanString(input.title) || cleanString(input.title).length < 3) {
    return 'Content title must be at least 3 characters.';
  }
  if (!input.scheduledDate || !isValidIsoDate(input.scheduledDate)) {
    return 'Scheduled date must be a valid YYYY-MM-DD date.';
  }
  const platform = cleanString(input.platform);
  if (!platform) {
    return 'Platform is required.';
  }
  if (
    allowedPlatforms &&
    allowedPlatforms.length > 0 &&
    !allowedPlatforms.some((p) => p.toLowerCase() === platform.toLowerCase())
  ) {
    return `Platform "${platform}" is not in this brand's approved channels (${allowedPlatforms.join(', ')}).`;
  }
  if (!cleanString(input.contentPillar)) {
    return 'Content pillar is required.';
  }
  if (!cleanString(input.contentFormat)) {
    return 'Content format is required.';
  }
  if (!cleanString(input.coreMessage)) {
    return 'Core message / brief is required.';
  }
  return null;
}

export function buildDuplicateItemInput(
  sourceItem: ContentCalendarItem,
  calendarEndDate: string,
): CreateContentCalendarItemInput {
  const nextDay = addDaysIso(sourceItem.scheduledDate, 1);
  const scheduledDate = nextDay <= calendarEndDate ? nextDay : sourceItem.scheduledDate;

  return {
    scheduledDate,
    suggestedTime: sourceItem.suggestedTime,
    platform: sourceItem.platform,
    title: `${sourceItem.title} (Copy)`,
    contentPillar: sourceItem.contentPillar,
    contentTheme: sourceItem.contentTheme,
    contentFormat: sourceItem.contentFormat,
    contentSeries: sourceItem.contentSeries,
    targetAudience: sourceItem.targetAudience,
    audiencePainPoint: sourceItem.audiencePainPoint,
    contentObjective: sourceItem.contentObjective,
    relatedMarketingObjective: sourceItem.relatedMarketingObjective,
    coreMessage: sourceItem.coreMessage,
    suggestedAngle: sourceItem.suggestedAngle,
    intendedCta: sourceItem.intendedCta,
    relevantKpi: sourceItem.relevantKpi,
    productionNotes: sourceItem.productionNotes,
    workflowStatus: 'planned',
    batchIndex: sourceItem.batchIndex,
    source: 'manual',
    sortOrder: sourceItem.sortOrder + 1,
  };
}

export function filterCalendarItems(
  items: readonly ContentCalendarItem[],
  filters: CalendarItemFilters,
): ContentCalendarItem[] {
  const platform = filters.platform.trim().toLowerCase();
  const pillar = filters.pillar.trim().toLowerCase();
  const format = filters.format.trim().toLowerCase();
  const status = filters.status.trim().toLowerCase();
  const query = filters.query.trim().toLowerCase();

  return items
    .filter((item) => {
      if (platform && platform !== 'all' && item.platform.toLowerCase() !== platform) return false;
      if (pillar && pillar !== 'all' && item.contentPillar.toLowerCase() !== pillar) return false;
      if (format && format !== 'all' && item.contentFormat.toLowerCase() !== format) return false;
      if (status && status !== 'all' && item.workflowStatus.toLowerCase() !== status) return false;
      if (query) {
        const haystack = [
          item.title,
          item.platform,
          item.contentPillar,
          item.contentTheme,
          item.contentFormat,
          item.contentSeries,
          item.targetAudience,
          item.coreMessage,
          item.suggestedAngle,
          item.intendedCta,
          item.scheduledDate,
        ]
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      return true;
    })
    .sort(
      (a, b) =>
        a.scheduledDate.localeCompare(b.scheduledDate) ||
        a.sortOrder - b.sortOrder ||
        a.title.localeCompare(b.title),
    );
}

export function computeCalendarStats(
  calendar: ContentCalendar,
  items: readonly ContentCalendarItem[],
): CalendarStatsSummary {
  const byStatus: Record<CalendarWorkflowStatus, number> = {
    planned: 0,
    in_progress: 0,
    ready_for_review: 0,
    approved: 0,
    published: 0,
    skipped: 0,
  };
  const platformMap = new Map<string, number>();
  const pillarMap = new Map<string, number>();
  const formatMap = new Map<string, number>();
  const coveredDateSet = new Set<string>();

  for (const item of items) {
    byStatus[item.workflowStatus] = (byStatus[item.workflowStatus] ?? 0) + 1;
    if (item.platform) platformMap.set(item.platform, (platformMap.get(item.platform) ?? 0) + 1);
    if (item.contentPillar) {
      pillarMap.set(item.contentPillar, (pillarMap.get(item.contentPillar) ?? 0) + 1);
    }
    if (item.contentFormat) {
      formatMap.set(item.contentFormat, (formatMap.get(item.contentFormat) ?? 0) + 1);
    }
    if (item.scheduledDate) coveredDateSet.add(item.scheduledDate);
  }

  const toSortedArray = (map: Map<string, number>) =>
    Array.from(map.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

  return {
    totalItems: items.length,
    byStatus,
    byPlatform: toSortedArray(platformMap),
    byPillar: toSortedArray(pillarMap),
    byFormat: toSortedArray(formatMap),
    coveredDays: coveredDateSet.size,
    totalDays: Math.max(1, diffDaysInclusive(calendar.startDate, calendar.endDate)),
  };
}

/**
 * Builds a Monday-first calendar grid spanning all full weeks that intersect `[startDate, endDate]`.
 */
export function buildMonthlyCalendarGrid(
  calendar: Pick<ContentCalendar, 'startDate' | 'endDate'>,
  items: readonly ContentCalendarItem[],
): MonthlyGridCell[] {
  if (!isValidIsoDate(calendar.startDate) || !isValidIsoDate(calendar.endDate)) {
    return [];
  }

  const itemsByDate = new Map<string, ContentCalendarItem[]>();
  for (const item of items) {
    const existing = itemsByDate.get(item.scheduledDate) ?? [];
    existing.push(item);
    itemsByDate.set(item.scheduledDate, existing);
  }

  const startDt = parseIsoDateUtc(calendar.startDate);
  const startDayOfWeek = (startDt.getUTCDay() + 6) % 7; // Monday = 0 .. Sunday = 6
  const gridStartIso = addDaysIso(calendar.startDate, -startDayOfWeek);

  const endDt = parseIsoDateUtc(calendar.endDate);
  const endDayOfWeek = (endDt.getUTCDay() + 6) % 7;
  const gridEndIso = addDaysIso(calendar.endDate, 6 - endDayOfWeek);

  const totalCells = Math.max(7, diffDaysInclusive(gridStartIso, gridEndIso));
  const cells: MonthlyGridCell[] = [];

  for (let offset = 0; offset < totalCells; offset += 1) {
    const isoDate = addDaysIso(gridStartIso, offset);
    const dt = parseIsoDateUtc(isoDate);
    const monthLabel = dt.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' });
    cells.push({
      isoDate,
      dayOfMonth: dt.getUTCDate(),
      monthLabel,
      inCalendarWindow: isoDate >= calendar.startDate && isoDate <= calendar.endDate,
      items: itemsByDate.get(isoDate) ?? [],
    });
  }

  return cells;
}

export function groupItemsByWeek(
  calendar: Pick<ContentCalendar, 'startDate' | 'endDate'>,
  items: readonly ContentCalendarItem[],
): WeeklyCalendarGroup[] {
  if (!isValidIsoDate(calendar.startDate) || !isValidIsoDate(calendar.endDate)) {
    return [];
  }

  const itemsByDate = new Map<string, ContentCalendarItem[]>();
  for (const item of items) {
    const existing = itemsByDate.get(item.scheduledDate) ?? [];
    existing.push(item);
    itemsByDate.set(item.scheduledDate, existing);
  }

  const totalDays = Math.max(1, diffDaysInclusive(calendar.startDate, calendar.endDate));
  const groups: WeeklyCalendarGroup[] = [];
  let cursor = 0;
  let weekNumber = 1;

  while (cursor < totalDays) {
    const remaining = totalDays - cursor;
    const span = remaining <= 10 ? remaining : 7;
    const segStart = addDaysIso(calendar.startDate, cursor);
    const segEnd = addDaysIso(calendar.startDate, cursor + span - 1);
    const days: WeeklyCalendarGroup['days'] = [];
    let totalItems = 0;

    for (let i = 0; i < span; i += 1) {
      const isoDate = addDaysIso(segStart, i);
      const dt = parseIsoDateUtc(isoDate);
      const dayItems = itemsByDate.get(isoDate) ?? [];
      totalItems += dayItems.length;
      days.push({
        isoDate,
        weekdayShort: dt.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' }),
        displayDate: dt.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          timeZone: 'UTC',
        }),
        items: dayItems,
      });
    }

    groups.push({
      weekNumber,
      label: `Week ${weekNumber} · ${formatCalendarDisplayDate(segStart)} – ${formatCalendarDisplayDate(segEnd)}`,
      startDate: segStart,
      endDate: segEnd,
      days,
      totalItems,
    });

    cursor += span;
    weekNumber += 1;
  }

  return groups;
}

/**
 * Prepares a stable, future-proof Content Studio handoff payload from a calendar item.
 * Scope boundary: does NOT invoke Content Studio or generate full copy in Phase 2B.
 */
export function buildContentStudioHandoffPayload(
  brand: Pick<Brand, 'id' | 'brandName'>,
  calendar: Pick<ContentCalendar, 'id' | 'name' | 'brandId'>,
  item: ContentCalendarItem,
): ContentStudioHandoffPayload {
  if (calendar.brandId !== brand.id || item.brandId !== brand.id || item.calendarId !== calendar.id) {
    throw new Error('Cannot prepare Content Studio handoff across mismatched brand or calendar IDs.');
  }

  return {
    schemaVersion: '1.0',
    brandId: brand.id,
    brandName: brand.brandName,
    calendarId: calendar.id,
    calendarName: calendar.name,
    calendarItemId: item.id,
    scheduledDate: item.scheduledDate,
    suggestedTime: item.suggestedTime,
    platform: item.platform,
    title: item.title,
    contentPillar: item.contentPillar,
    contentTheme: item.contentTheme,
    contentFormat: item.contentFormat,
    contentSeries: item.contentSeries,
    targetAudience: item.targetAudience,
    audiencePainPoint: item.audiencePainPoint,
    contentObjective: item.contentObjective,
    relatedMarketingObjective: item.relatedMarketingObjective,
    coreMessage: item.coreMessage,
    suggestedAngle: item.suggestedAngle,
    intendedCta: item.intendedCta,
    relevantKpi: item.relevantKpi,
    productionNotes: item.productionNotes,
    workflowStatus: item.workflowStatus,
  };
}
