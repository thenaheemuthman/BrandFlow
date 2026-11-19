import {
  ArrowRight,
  CalendarDays,
  Compass,
  FileText,
  Globe,
  Layers,
  LayoutGrid,
  MapPin,
  MessageSquareText,
  Pencil,
  PenTool,
  Settings,
  Target,
  Trash2,
  Users,
  Clock,
} from 'lucide-react';
import type {
  ActivityEvent,
  Brand,
  BrandFormInput,
  BrandStrategyModule,
  WorkspaceSection,
} from '../../types/brand';
import type { AppRoute } from '../../utils/router';
import {
  STRATEGY_MODULES,
  computeBrandProgress,
  formatDateTime,
  formatModuleStatusLabel,
  formatShortDate,
} from '../../utils/brandLogic';
import { UpcomingModuleState } from '../common/UpcomingModuleState';
import { BrandFormView } from '../brands/BrandFormView';
import { BrandFoundationView } from './BrandFoundationView';
import { BrandMessagingView } from './BrandMessagingView';
import { CustomerIntelligenceView } from './CustomerIntelligenceView';
import { MarketingStrategyView } from './MarketingStrategyView';

interface BrandWorkspaceViewProps {
  brand: Brand;
  activities: ActivityEvent[];
  section: WorkspaceSection;
  submitting: boolean;
  serverError: string | null;
  onSelectSection: (section: WorkspaceSection) => void;
  onNavigate: (route: AppRoute) => void;
  onUpdateBrand: (input: BrandFormInput) => Promise<void>;
  onModuleSaved: (module: BrandStrategyModule) => void | Promise<void>;
  onToast: (type: 'success' | 'error', message: string) => void;
  onRequestDelete: (brand: Brand) => void;
  onDirtyChange: (dirty: boolean) => void;
}

const WORKSPACE_NAV: Array<{
  id: WorkspaceSection;
  label: string;
  icon: typeof LayoutGrid;
}> = [
  { id: 'overview', label: 'Overview', icon: LayoutGrid },
  { id: 'brand-foundation', label: 'Brand Foundation', icon: Compass },
  { id: 'brand-messaging', label: 'Brand Messaging', icon: MessageSquareText },
  { id: 'customer-intelligence', label: 'Customer Intelligence', icon: Users },
  { id: 'marketing-strategy', label: 'Marketing Strategy', icon: Target },
  { id: 'content-strategy', label: 'Content Strategy', icon: Layers },
  { id: 'content-calendar', label: 'Content Calendar', icon: CalendarDays },
  { id: 'content-studio', label: 'Content Studio', icon: PenTool },
  { id: 'brand-settings', label: 'Brand Settings', icon: Settings },
];

const UPCOMING_MODULE_COPY: Record<
  Exclude<WorkspaceSection, 'overview' | 'brand-settings'>,
  {
    title: string;
    icon: typeof Compass;
    description: string;
    capabilities: string[];
  }
> = {
  'brand-foundation': {
    title: 'Brand Foundation',
    icon: Compass,
    description:
      'Establish the core strategic identity of this brand based on the business profile captured in Phase 1.',
    capabilities: [
      'Structured brand purpose, mission, and vision refinement',
      'Core brand values and differentiation attributes',
      'Market positioning statement aligned with competitive context',
    ],
  },
  'brand-messaging': {
    title: 'Brand Messaging',
    icon: MessageSquareText,
    description:
      'Translate foundational positioning into consistent messaging frameworks across channels.',
    capabilities: [
      'Core value proposition hierarchy and proof points',
      'Brand voice, tone guardrails, and vocabulary standards',
      'Audience-specific messaging angles and objection handling',
    ],
  },
  'customer-intelligence': {
    title: 'Customer Intelligence',
    icon: Users,
    description:
      'Organize buyer research, ideal customer profiles, and decision-making triggers for this brand.',
    capabilities: [
      'Ideal Customer Profile (ICP) segmentation and firmographics',
      'Detailed buyer personas with goals, frustrations, and triggers',
      'Buyer journey mapping from awareness to conversion',
    ],
  },
  'marketing-strategy': {
    title: 'Marketing Strategy',
    icon: Target,
    description:
      'Define measurable marketing objectives, priority channels, and campaign focus areas.',
    capabilities: [
      'SMART marketing goals linked directly to business objectives',
      'Channel prioritization matrix and funnel stage allocation',
      'Quarterly campaign themes and conversion hypotheses',
    ],
  },
  'content-strategy': {
    title: 'Content Strategy',
    icon: Layers,
    description:
      'Build a repeatable editorial architecture connecting brand messaging to audience needs.',
    capabilities: [
      'Core content pillars and strategic topic clusters',
      'Format mix and channel-specific publishing cadence',
      'Content governance and quality benchmarks',
    ],
  },
  'content-calendar': {
    title: 'Content Calendar',
    icon: CalendarDays,
    description:
      'Plan and coordinate a structured 30-day publishing schedule mapped to your content pillars.',
    capabilities: [
      '30-day calendar planning board across active channels',
      'Topic assignments tied to funnel stages and campaigns',
      'Draft-to-approval status tracking per scheduled slot',
    ],
  },
  'content-studio': {
    title: 'Content Studio',
    icon: PenTool,
    description:
      'Produce, review, and refine marketing content anchored in this brand’s strategy and writing style.',
    capabilities: [
      'Channel-ready long-form and social content production',
      'Writing style enforcement and revision workflows',
      'Editorial approval queue and asset export',
    ],
  },
};

export function BrandWorkspaceView({
  brand,
  activities,
  section,
  submitting,
  serverError,
  onSelectSection,
  onNavigate,
  onUpdateBrand,
  onModuleSaved,
  onToast,
  onRequestDelete,
  onDirtyChange,
}: BrandWorkspaceViewProps) {
  const progress = computeBrandProgress(brand);

  return (
    <div className="space-y-6">
      {/* Workspace Header */}
      <section className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-start">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl truncate">
            {brand.brandName}
          </h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-slate-500 sm:text-sm">
            <span>{brand.industry}</span>
            <span className="inline-flex items-center gap-1.5">
              <span aria-hidden="true">·</span>
              <MapPin className="h-3.5 w-3.5 text-slate-400" strokeWidth={1.75} />
              <span>{brand.primaryLocation}</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span aria-hidden="true">·</span>
              <span>
                Last updated{' '}
                <span className="font-mono tabular-nums">
                  {formatShortDate(brand.updatedAt)}
                </span>
              </span>
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => onSelectSection('brand-settings')}
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 hover:text-slate-900 whitespace-nowrap shrink-0"
          >
            <Pencil className="h-3.5 w-3.5" strokeWidth={1.75} />
            <span>Edit Brand</span>
          </button>
        </div>
      </section>

      {/* Workspace Navigation + Content */}
      <div className="flex flex-col gap-8 lg:flex-row">
        {/* Mobile / Tablet Section Selector & Horizontal Nav */}
        <div className="lg:hidden">
          <label htmlFor="workspace-section-select" className="sr-only">
            Workspace Section
          </label>
          <select
            id="workspace-section-select"
            value={section}
            onChange={(e) => onSelectSection(e.target.value as WorkspaceSection)}
            className="min-h-[44px] w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-900 focus:border-blue-600 focus:outline-none"
          >
            {WORKSPACE_NAV.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </div>

        {/* Desktop Secondary Workspace Sidebar */}
        <nav
          aria-label="Brand Workspace Sections"
          className="hidden lg:block lg:w-56 lg:shrink-0"
        >
          <ul className="space-y-1">
            {WORKSPACE_NAV.map((item) => {
              const Icon = item.icon;
              const isActive = section === item.id;
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => onSelectSection(item.id)}
                    aria-current={isActive ? 'page' : undefined}
                    className={`flex min-h-[40px] w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-blue-50/80 text-blue-700'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    }`}
                  >
                    <Icon
                      className={`h-4 w-4 shrink-0 ${
                        isActive ? 'text-blue-600' : 'text-slate-400'
                      }`}
                      strokeWidth={1.75}
                    />
                    <span className="truncate whitespace-nowrap">{item.label}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Active Workspace Panel */}
        <div className="min-w-0 flex-1">
          {section === 'overview' && (
            <div className="space-y-6">
              {/* Brand Profile Summary */}
              <section className="rounded-xl border border-slate-200 bg-white p-6">
                <h2 className="text-base font-semibold text-slate-900">
                  Brand Summary
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-slate-700">
                  {brand.businessDescription}
                </p>

                <dl className="mt-5 grid grid-cols-1 gap-4 border-t border-slate-100 pt-5 sm:grid-cols-2">
                  <div>
                    <dt className="text-xs font-medium text-slate-500">
                      Target Market
                    </dt>
                    <dd className="mt-1 text-sm text-slate-900">
                      {brand.targetMarket}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium text-slate-500">
                      Products or Services
                    </dt>
                    <dd className="mt-1 text-sm text-slate-900">
                      {brand.productsOrServices}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium text-slate-500">
                      Website
                    </dt>
                    <dd className="mt-1 text-sm text-slate-900">
                      {brand.websiteUrl ? (
                        <a
                          href={brand.websiteUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-blue-600 hover:underline"
                        >
                          <Globe className="h-3.5 w-3.5" strokeWidth={1.75} />
                          <span className="truncate">{brand.websiteUrl}</span>
                        </a>
                      ) : (
                        <span className="text-slate-400">Not provided</span>
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium text-slate-500">
                      Social Channels
                    </dt>
                    <dd className="mt-1 text-sm text-slate-900">
                      {brand.socialLinks || (
                        <span className="text-slate-400">Not provided</span>
                      )}
                    </dd>
                  </div>
                </dl>

                {(brand.existingMission ||
                  brand.existingVision ||
                  brand.businessGoals ||
                  brand.marketingChallenges ||
                  brand.competitors) && (
                  <dl className="mt-5 grid grid-cols-1 gap-4 border-t border-slate-100 pt-5 sm:grid-cols-2">
                    {brand.existingMission && (
                      <div>
                        <dt className="text-xs font-medium text-slate-500">
                          Existing Mission
                        </dt>
                        <dd className="mt-1 text-sm text-slate-800">
                          {brand.existingMission}
                        </dd>
                      </div>
                    )}
                    {brand.existingVision && (
                      <div>
                        <dt className="text-xs font-medium text-slate-500">
                          Existing Vision
                        </dt>
                        <dd className="mt-1 text-sm text-slate-800">
                          {brand.existingVision}
                        </dd>
                      </div>
                    )}
                    {brand.businessGoals && (
                      <div>
                        <dt className="text-xs font-medium text-slate-500">
                          Business Goals
                        </dt>
                        <dd className="mt-1 text-sm text-slate-800">
                          {brand.businessGoals}
                        </dd>
                      </div>
                    )}
                    {brand.marketingChallenges && (
                      <div>
                        <dt className="text-xs font-medium text-slate-500">
                          Marketing Challenges
                        </dt>
                        <dd className="mt-1 text-sm text-slate-800">
                          {brand.marketingChallenges}
                        </dd>
                      </div>
                    )}
                    {brand.competitors && (
                      <div className="sm:col-span-2">
                        <dt className="text-xs font-medium text-slate-500">
                          Competitors
                        </dt>
                        <dd className="mt-1 text-sm text-slate-800">
                          {brand.competitors}
                        </dd>
                      </div>
                    )}
                  </dl>
                )}
              </section>

              {/* Three Status Overview Cards */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="rounded-xl border border-slate-200 bg-white p-5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-slate-500">
                      Strategy Status
                    </span>
                    <Layers className="h-4 w-4 text-slate-400" strokeWidth={1.75} />
                  </div>
                  <p className="mt-2.5 text-base font-semibold text-slate-900">
                    {progress.strategyStatusLabel}
                  </p>
                  <p className="mt-1 font-mono text-xs text-slate-500 tabular-nums">
                    {progress.completedCount} of {progress.totalModules} modules complete
                  </p>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-slate-500">
                      Content Strategy
                    </span>
                    <FileText className="h-4 w-4 text-slate-400" strokeWidth={1.75} />
                  </div>
                  <p className="mt-2.5 text-base font-semibold text-slate-900">
                    {progress.contentStatusLabel}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Available in Phase 2
                  </p>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-slate-500">
                      Content Calendar
                    </span>
                    <CalendarDays className="h-4 w-4 text-slate-400" strokeWidth={1.75} />
                  </div>
                  <p className="mt-2.5 text-base font-semibold text-slate-900">
                    {progress.calendarStatusLabel}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    30-day planner opens in Phase 2
                  </p>
                </div>
              </div>

              {/* Workflow Progress Stages */}
              <section className="rounded-xl border border-slate-200 bg-white p-6">
                <div className="flex flex-col justify-between gap-3 border-b border-slate-100 pb-4 sm:flex-row sm:items-center">
                  <div>
                    <h2 className="text-base font-semibold text-slate-900">
                      Brand Workflow Progress
                    </h2>
                    <p className="mt-0.5 text-xs text-slate-500">
                      Sequential modules connecting brand intake to content execution
                    </p>
                  </div>
                  <span className="font-mono text-sm font-semibold text-slate-900 tabular-nums">
                    {progress.percentage}% complete
                  </span>
                </div>

                <ol className="mt-2 divide-y divide-slate-100">
                  {STRATEGY_MODULES.map((mod, idx) => {
                    const status = brand.moduleStatuses[mod.key] ?? 'not_started';
                    return (
                      <li
                        key={mod.key}
                        className="flex flex-col justify-between gap-3 py-3.5 sm:flex-row sm:items-center"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2.5">
                            <span className="font-mono text-xs font-medium text-slate-400 tabular-nums">
                              0{idx + 1}
                            </span>
                            <span className="text-sm font-medium text-slate-900">
                              {mod.label}
                            </span>
                            <span aria-hidden="true" className="text-slate-300">
                              ·
                            </span>
                            <span className="text-xs text-slate-500">
                              {formatModuleStatusLabel(status)}
                            </span>
                          </div>
                          <p className="mt-0.5 pl-6 text-xs text-slate-500">
                            {mod.shortDescription}
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            onSelectSection(mod.section as WorkspaceSection)
                          }
                          className="ml-6 inline-flex min-h-[36px] items-center gap-1 self-start rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 hover:text-slate-900 sm:ml-0 sm:self-auto whitespace-nowrap shrink-0"
                        >
                          <span>Open module</span>
                          <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.75} />
                        </button>
                      </li>
                    );
                  })}
                </ol>
              </section>

              {/* Recent Workspace Activity */}
              <section className="rounded-xl border border-slate-200 bg-white p-6">
                <h2 className="text-base font-semibold text-slate-900">
                  Workspace Activity
                </h2>
                {activities.length === 0 ? (
                  <div className="mt-4 flex items-center gap-2.5 text-sm text-slate-500">
                    <Clock className="h-4 w-4 text-slate-400" strokeWidth={1.75} />
                    <span>No activity recorded for this workspace yet.</span>
                  </div>
                ) : (
                  <ul className="mt-3 divide-y divide-slate-100">
                    {activities.slice(0, 6).map((act) => (
                      <li
                        key={act.id}
                        className="flex flex-col justify-between gap-1 py-2.5 sm:flex-row sm:items-center"
                      >
                        <span className="text-sm text-slate-800">
                          {act.description}
                        </span>
                        <span className="font-mono text-xs text-slate-500 tabular-nums shrink-0">
                          {formatDateTime(act.createdAt)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          )}

          {section === 'brand-foundation' && (
            <BrandFoundationView
              key={brand.id}
              brand={brand}
              onModuleSaved={onModuleSaved}
              onToast={onToast}
              onNavigateToBrandSettings={() => onSelectSection('brand-settings')}
            />
          )}

          {section === 'brand-messaging' && (
            <BrandMessagingView
              key={brand.id}
              brand={brand}
              onModuleSaved={onModuleSaved}
              onToast={onToast}
              onNavigateToBrandFoundation={() => onSelectSection('brand-foundation')}
              onNavigateToBrandSettings={() => onSelectSection('brand-settings')}
            />
          )}

          {section === 'customer-intelligence' && (
            <CustomerIntelligenceView
              key={brand.id}
              brand={brand}
              onModuleSaved={onModuleSaved}
              onToast={onToast}
              onNavigateToBrandFoundation={() => onSelectSection('brand-foundation')}
              onNavigateToBrandMessaging={() => onSelectSection('brand-messaging')}
              onNavigateToBrandSettings={() => onSelectSection('brand-settings')}
            />
          )}

          {section === 'marketing-strategy' && (
            <MarketingStrategyView
              key={brand.id}
              brand={brand}
              onModuleSaved={onModuleSaved}
              onToast={onToast}
              onNavigateToBrandFoundation={() => onSelectSection('brand-foundation')}
              onNavigateToBrandMessaging={() => onSelectSection('brand-messaging')}
              onNavigateToCustomerIntelligence={() =>
                onSelectSection('customer-intelligence')
              }
              onNavigateToBrandSettings={() => onSelectSection('brand-settings')}
            />
          )}

          {section !== 'overview' &&
            section !== 'brand-settings' &&
            section !== 'brand-foundation' &&
            section !== 'brand-messaging' &&
            section !== 'customer-intelligence' &&
            section !== 'marketing-strategy' && (
            <UpcomingModuleState
              icon={UPCOMING_MODULE_COPY[section].icon}
              title={UPCOMING_MODULE_COPY[section].title}
              phaseLabel="Upcoming Module — Planned for Phase 2"
              description={UPCOMING_MODULE_COPY[section].description}
              plannedCapabilities={UPCOMING_MODULE_COPY[section].capabilities}
              primaryActionLabel="Back to Workspace Overview"
              onPrimaryAction={() => onSelectSection('overview')}
            />
          )}

          {section === 'brand-settings' && (
            <div className="space-y-8">
              <BrandFormView
                mode="edit"
                initialBrand={brand}
                embedded={true}
                submitting={submitting}
                serverError={serverError}
                onDirtyChange={onDirtyChange}
                onSubmit={onUpdateBrand}
                onCancel={() => onSelectSection('overview')}
              />

              <section className="mx-auto max-w-3xl rounded-xl border border-red-200 bg-white p-6">
                <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                  <div>
                    <h2 className="text-base font-semibold text-slate-900">
                      Delete Brand Workspace
                    </h2>
                    <p className="mt-1 text-sm text-slate-600">
                      Permanently remove {brand.brandName} and its workspace records. This action cannot be undone.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onRequestDelete(brand)}
                    aria-label={`Delete ${brand.brandName}`}
                    className="inline-flex min-h-[42px] items-center justify-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 transition-colors hover:bg-red-100 whitespace-nowrap shrink-0"
                  >
                    <Trash2 className="h-4 w-4" strokeWidth={1.75} />
                    <span>Delete Brand</span>
                  </button>
                </div>
              </section>

              <div className="mx-auto max-w-3xl">
                <button
                  type="button"
                  onClick={() => onNavigate({ view: 'brands' })}
                  className="text-sm font-medium text-slate-600 hover:text-slate-900"
                >
                  Return to all brands
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
