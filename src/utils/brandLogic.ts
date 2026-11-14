import type {
  Brand,
  BrandFormInput,
  BrandModuleKey,
  BrandModuleStatuses,
  BrandValidationErrors,
} from '../types/brand';

export const BRAND_INDUSTRIES = [
  'B2B SaaS & Software',
  'E-Commerce & Retail',
  'Health & Wellness',
  'Financial Services',
  'Education & EdTech',
  'Professional Services & Consulting',
  'Consumer Technology',
  'Food & Beverage',
  'Real Estate & Architecture',
  'Media & Publishing',
  'Sustainability & CleanTech',
  'Other',
] as const;

export const STRATEGY_MODULES: Array<{
  key: BrandModuleKey;
  section: string;
  label: string;
  shortDescription: string;
}> = [
  {
    key: 'brandFoundation',
    section: 'brand-foundation',
    label: 'Brand Foundation',
    shortDescription: 'Purpose, mission, vision, core values, and brand positioning statement.',
  },
  {
    key: 'brandMessaging',
    section: 'brand-messaging',
    label: 'Brand Messaging',
    shortDescription: 'Value proposition hierarchy, voice guidelines, and messaging pillars.',
  },
  {
    key: 'customerIntelligence',
    section: 'customer-intelligence',
    label: 'Customer Intelligence',
    shortDescription: 'Ideal customer profiles, buyer personas, pain points, and decision triggers.',
  },
  {
    key: 'marketingStrategy',
    section: 'marketing-strategy',
    label: 'Marketing Strategy',
    shortDescription: 'SMART marketing objectives, channel prioritization, and campaign themes.',
  },
  {
    key: 'contentStrategy',
    section: 'content-strategy',
    label: 'Content Strategy',
    shortDescription: 'Editorial pillars, format mix, cadence targets, and topic clusters.',
  },
  {
    key: 'contentCalendar',
    section: 'content-calendar',
    label: 'Content Calendar',
    shortDescription: '30-day scheduled publishing roadmap aligned to strategic pillars.',
  },
  {
    key: 'contentStudio',
    section: 'content-studio',
    label: 'Content Studio',
    shortDescription: 'Long-form and social content production, review workflows, and approvals.',
  },
];

export function createDefaultModuleStatuses(): BrandModuleStatuses {
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

export function normalizeBrandInput(input: BrandFormInput): BrandFormInput {
  return {
    brandName: input.brandName.trim(),
    businessDescription: input.businessDescription.trim(),
    industry: input.industry.trim(),
    productsOrServices: input.productsOrServices.trim(),
    targetMarket: input.targetMarket.trim(),
    primaryLocation: input.primaryLocation.trim(),
    websiteUrl: (input.websiteUrl ?? '').trim(),
    socialLinks: (input.socialLinks ?? '').trim(),
    existingMission: (input.existingMission ?? '').trim(),
    existingVision: (input.existingVision ?? '').trim(),
    marketingChallenges: (input.marketingChallenges ?? '').trim(),
    businessGoals: (input.businessGoals ?? '').trim(),
    competitors: (input.competitors ?? '').trim(),
    additionalNotes: (input.additionalNotes ?? '').trim(),
  };
}

export function isValidHttpUrl(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return true;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function validateBrandForm(input: BrandFormInput): BrandValidationErrors {
  const errors: BrandValidationErrors = {};
  const normalized = normalizeBrandInput(input);

  if (!normalized.brandName) {
    errors.brandName = 'Brand name is required.';
  } else if (normalized.brandName.length < 2) {
    errors.brandName = 'Brand name must be at least 2 characters.';
  }

  if (!normalized.businessDescription) {
    errors.businessDescription = 'Business description is required.';
  } else if (normalized.businessDescription.length < 10) {
    errors.businessDescription = 'Please provide at least 10 characters describing the business.';
  }

  if (!normalized.industry) {
    errors.industry = 'Please select or enter an industry category.';
  }

  if (!normalized.productsOrServices) {
    errors.productsOrServices = 'Products or services are required.';
  }

  if (!normalized.targetMarket) {
    errors.targetMarket = 'Target market is required.';
  }

  if (!normalized.primaryLocation) {
    errors.primaryLocation = 'Primary business location is required.';
  }

  if (normalized.websiteUrl && !isValidHttpUrl(normalized.websiteUrl)) {
    errors.websiteUrl = 'Enter a valid URL starting with http:// or https://.';
  }

  return errors;
}

export function hasValidationErrors(errors: BrandValidationErrors): boolean {
  return Object.keys(errors).length > 0;
}

export interface BrandProgressSummary {
  completedCount: number;
  inProgressCount: number;
  totalModules: number;
  percentage: number;
  strategyStatusLabel: string;
  contentStatusLabel: string;
  calendarStatusLabel: string;
}

const CORE_STRATEGY_KEYS: BrandModuleKey[] = [
  'brandFoundation',
  'brandMessaging',
  'customerIntelligence',
  'marketingStrategy',
];

export function computeBrandProgress(brand: Brand): BrandProgressSummary {
  const statuses = brand.moduleStatuses ?? createDefaultModuleStatuses();
  const keys = Object.keys(statuses) as BrandModuleKey[];
  const totalModules = keys.length;

  let completedCount = 0;
  let inProgressCount = 0;

  for (const key of keys) {
    if (statuses[key] === 'completed') {
      completedCount += 1;
    } else if (statuses[key] === 'in_progress') {
      inProgressCount += 1;
    }
  }

  const percentage =
    totalModules === 0 ? 0 : Math.round((completedCount / totalModules) * 100);

  const strategyCompleted = CORE_STRATEGY_KEYS.filter(
    (k) => statuses[k] === 'completed',
  ).length;
  const strategyInProgress = CORE_STRATEGY_KEYS.some(
    (k) => statuses[k] === 'in_progress',
  );

  let strategyStatusLabel = 'Not started';
  if (strategyCompleted === CORE_STRATEGY_KEYS.length) {
    strategyStatusLabel = 'Completed';
  } else if (strategyCompleted > 0 || strategyInProgress) {
    strategyStatusLabel = `${strategyCompleted} of ${CORE_STRATEGY_KEYS.length} modules complete`;
  }

  const contentStatusLabel = formatModuleStatusLabel(statuses.contentStrategy);
  const calendarStatusLabel = formatModuleStatusLabel(statuses.contentCalendar);

  return {
    completedCount,
    inProgressCount,
    totalModules,
    percentage,
    strategyStatusLabel,
    contentStatusLabel,
    calendarStatusLabel,
  };
}

export function formatModuleStatusLabel(
  status: 'not_started' | 'in_progress' | 'completed',
): string {
  switch (status) {
    case 'completed':
      return 'Completed';
    case 'in_progress':
      return 'In progress';
    default:
      return 'Not started';
  }
}

export interface DashboardMetrics {
  totalBrands: number;
  strategiesCreated: number;
  contentPiecesGenerated: number;
  pendingApprovals: number;
}

export function computeDashboardMetrics(brands: Brand[]): DashboardMetrics {
  let strategiesCreated = 0;
  let contentPiecesGenerated = 0;
  let pendingApprovals = 0;

  for (const brand of brands) {
    const statuses = brand.moduleStatuses ?? createDefaultModuleStatuses();
    const hasStrategy = CORE_STRATEGY_KEYS.some((k) => statuses[k] === 'completed');
    if (hasStrategy) {
      strategiesCreated += 1;
    }
    contentPiecesGenerated += brand.contentPiecesCount ?? 0;
    pendingApprovals += brand.pendingApprovalsCount ?? 0;
  }

  return {
    totalBrands: brands.length,
    strategiesCreated,
    contentPiecesGenerated,
    pendingApprovals,
  };
}

export type BrandSortOption = 'updated' | 'accessed' | 'name' | 'created';

export function filterAndSortBrands(
  brands: Brand[],
  query: string,
  industry: string,
  sortBy: BrandSortOption = 'updated',
): Brand[] {
  const normalizedQuery = query.trim().toLowerCase();
  const normalizedIndustry = industry.trim().toLowerCase();

  const filtered = brands.filter((brand) => {
    const matchesIndustry =
      !normalizedIndustry ||
      normalizedIndustry === 'all' ||
      brand.industry.toLowerCase() === normalizedIndustry;

    if (!matchesIndustry) return false;

    if (!normalizedQuery) return true;

    const haystack = [
      brand.brandName,
      brand.businessDescription,
      brand.industry,
      brand.targetMarket,
      brand.primaryLocation,
      brand.productsOrServices,
    ]
      .join(' ')
      .toLowerCase();

    return haystack.includes(normalizedQuery);
  });

  return [...filtered].sort((a, b) => {
    if (sortBy === 'name') {
      return a.brandName.localeCompare(b.brandName);
    }
    if (sortBy === 'created') {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    }
    if (sortBy === 'accessed') {
      return (
        new Date(b.lastAccessedAt || b.updatedAt).getTime() -
        new Date(a.lastAccessedAt || a.updatedAt).getTime()
      );
    }
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });
}

export function formatShortDate(isoString: string): string {
  if (!isoString) return '—';
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatDateTime(isoString: string): string {
  if (!isoString) return '—';
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function isFormDirty(
  current: BrandFormInput,
  initial: BrandFormInput,
): boolean {
  const a = normalizeBrandInput(current);
  const b = normalizeBrandInput(initial);
  return (
    a.brandName !== b.brandName ||
    a.businessDescription !== b.businessDescription ||
    a.industry !== b.industry ||
    a.productsOrServices !== b.productsOrServices ||
    a.targetMarket !== b.targetMarket ||
    a.primaryLocation !== b.primaryLocation ||
    a.websiteUrl !== b.websiteUrl ||
    a.socialLinks !== b.socialLinks ||
    a.existingMission !== b.existingMission ||
    a.existingVision !== b.existingVision ||
    a.marketingChallenges !== b.marketingChallenges ||
    a.businessGoals !== b.businessGoals ||
    a.competitors !== b.competitors ||
    a.additionalNotes !== b.additionalNotes
  );
}
