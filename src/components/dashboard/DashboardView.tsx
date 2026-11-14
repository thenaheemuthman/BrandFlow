import {
  ArrowRight,
  Briefcase,
  CheckSquare,
  Feather,
  FileText,
  Layers,
  PenTool,
  Plus,
  Clock,
} from 'lucide-react';
import type { ActivityEvent, Brand, UserProfile } from '../../types/brand';
import type { AppRoute } from '../../utils/router';
import {
  computeBrandProgress,
  computeDashboardMetrics,
  formatDateTime,
  formatShortDate,
} from '../../utils/brandLogic';

interface DashboardViewProps {
  brands: Brand[];
  activities: ActivityEvent[];
  profile: UserProfile;
  loading: boolean;
  onNavigate: (route: AppRoute) => void;
}

export function DashboardView({
  brands,
  activities,
  profile,
  loading,
  onNavigate,
}: DashboardViewProps) {
  const firstName = profile.fullName.trim().split(/\s+/)[0] || 'there';
  const metrics = computeDashboardMetrics(brands);

  const recentBrands = [...brands]
    .sort(
      (a, b) =>
        new Date(b.lastAccessedAt || b.updatedAt).getTime() -
        new Date(a.lastAccessedAt || a.updatedAt).getTime(),
    )
    .slice(0, 4);

  const recentActivities = activities.slice(0, 6);

  const summaryCards = [
    {
      label: 'Total Brands',
      value: metrics.totalBrands,
      helper: metrics.totalBrands === 0 ? 'No brands added yet' : 'Active brand workspaces',
      icon: Briefcase,
    },
    {
      label: 'Strategies Created',
      value: metrics.strategiesCreated,
      helper:
        metrics.strategiesCreated === 0
          ? 'Strategy modules available in Phase 2'
          : 'Brands with completed strategy modules',
      icon: Layers,
    },
    {
      label: 'Content Pieces Generated',
      value: metrics.contentPiecesGenerated,
      helper:
        metrics.contentPiecesGenerated === 0
          ? 'Content Studio generation starts in Phase 2'
          : 'Drafted & published assets',
      icon: FileText,
    },
    {
      label: 'Pending Approvals',
      value: metrics.pendingApprovals,
      helper:
        metrics.pendingApprovals === 0
          ? 'No content awaiting review'
          : 'Items waiting for sign-off',
      icon: CheckSquare,
    },
  ];

  const quickActions = [
    {
      label: 'Create a brand',
      description: 'Set up a new brand workspace',
      icon: Plus,
      route: { view: 'brand-new' } as AppRoute,
    },
    {
      label: 'View all brands',
      description: 'Browse and manage existing brands',
      icon: Briefcase,
      route: { view: 'brands' } as AppRoute,
    },
    {
      label: 'Open Content Studio',
      description: 'Preview upcoming content tools',
      icon: PenTool,
      route: { view: 'content-studio' } as AppRoute,
    },
    {
      label: 'Manage Writing Styles',
      description: 'Review voice and tone foundations',
      icon: Feather,
      route: { view: 'writing-styles' } as AppRoute,
    },
  ];

  if (loading) {
    return (
      <div className="space-y-8" aria-busy="true" aria-label="Loading dashboard">
        <div className="h-32 animate-pulse rounded-xl border border-slate-200 bg-slate-50" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-28 animate-pulse rounded-xl border border-slate-200 bg-slate-50"
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Welcome Section */}
      <section className="rounded-xl border border-slate-200 bg-slate-50/50 p-6 sm:p-8">
        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-center">
          <div className="max-w-2xl">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl text-balance">
              Welcome back, {firstName}
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-slate-600 sm:text-base">
              BrandFlow AI connects brand strategy to content execution. Organize each brand in its own workspace, capture core positioning inputs, and prepare your strategic roadmap.
            </p>
          </div>

          <div className="shrink-0">
            <button
              type="button"
              onClick={() => onNavigate({ view: 'brand-new' })}
              className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white shadow-xs transition-colors hover:bg-blue-700 whitespace-nowrap shrink-0"
            >
              <Plus className="h-4 w-4" strokeWidth={2} />
              <span>Create New Brand</span>
            </button>
          </div>
        </div>
      </section>

      {/* Four Overview Summary Cards */}
      <section aria-label="Workspace Summary">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {summaryCards.map((card) => {
            const Icon = card.icon;
            return (
              <div
                key={card.label}
                className="rounded-xl border border-slate-200 bg-white p-5 transition-colors hover:border-slate-300"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium text-slate-600">
                    {card.label}
                  </span>
                  <Icon
                    className="h-[18px] w-[18px] shrink-0 text-slate-400"
                    strokeWidth={1.75}
                  />
                </div>
                <p className="mt-3 font-display text-3xl font-semibold tracking-tight text-slate-900 tabular-nums">
                  {card.value}
                </p>
                <p className="mt-1.5 text-xs text-slate-500">{card.helper}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Main Content Split: Recent Brands + Quick Actions / Activity */}
      <div className="grid grid-cols-1 gap-8 xl:grid-cols-3">
        {/* Recent Brands */}
        <section className="xl:col-span-2" aria-labelledby="recent-brands-heading">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2
                id="recent-brands-heading"
                className="text-lg font-semibold tracking-tight text-slate-900"
              >
                Recent Brands
              </h2>
              <p className="mt-0.5 text-sm text-slate-500">
                Recently created or accessed brand workspaces
              </p>
            </div>
            {brands.length > 0 && (
              <button
                type="button"
                onClick={() => onNavigate({ view: 'brands' })}
                className="inline-flex min-h-[36px] items-center gap-1 text-sm font-medium text-blue-600 transition-colors hover:text-blue-700 whitespace-nowrap shrink-0"
              >
                <span>View all</span>
                <ArrowRight className="h-4 w-4" strokeWidth={1.75} />
              </button>
            )}
          </div>

          {recentBrands.length === 0 ? (
            <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-slate-50/40 p-8 text-center">
              <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500">
                <Briefcase className="h-5 w-5" strokeWidth={1.75} />
              </div>
              <h3 className="mt-4 text-base font-semibold text-slate-900">
                No brands created yet
              </h3>
              <p className="mx-auto mt-1.5 max-w-md text-sm text-slate-600">
                Create your first brand profile to unlock its dedicated workspace and begin structuring your brand foundation.
              </p>
              <div className="mt-5">
                <button
                  type="button"
                  onClick={() => onNavigate({ view: 'brand-new' })}
                  className="inline-flex min-h-[42px] items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-800 transition-colors hover:bg-slate-50 whitespace-nowrap shrink-0"
                >
                  <Plus className="h-4 w-4 text-blue-600" strokeWidth={2} />
                  <span>Create Your First Brand</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
              {recentBrands.map((brand) => {
                const progress = computeBrandProgress(brand);
                return (
                  <article
                    key={brand.id}
                    className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 transition-all hover:border-slate-300 hover:shadow-xs"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-3">
                        <h3 className="text-base font-semibold text-slate-900 truncate">
                          {brand.brandName}
                        </h3>
                      </div>

                      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500">
                        <span>{brand.industry}</span>
                        <span aria-hidden="true">·</span>
                        <span>Updated {formatShortDate(brand.updatedAt)}</span>
                      </div>

                      <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-slate-600">
                        {brand.businessDescription}
                      </p>
                    </div>

                    <div className="mt-5 border-t border-slate-100 pt-4">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-slate-600">
                          Strategy progress
                        </span>
                        <span className="font-mono font-medium text-slate-700 tabular-nums">
                          {progress.percentage}%
                        </span>
                      </div>
                      <div
                        className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100"
                        role="progressbar"
                        aria-valuenow={progress.percentage}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-label={`Strategy progress for ${brand.brandName}`}
                      >
                        <div
                          className="h-full rounded-full bg-blue-600 transition-all"
                          style={{ width: `${progress.percentage}%` }}
                        />
                      </div>

                      <div className="mt-4">
                        <button
                          type="button"
                          onClick={() =>
                            onNavigate({
                              view: 'brand-workspace',
                              brandId: brand.id,
                              section: 'overview',
                            })
                          }
                          aria-label={`Open Workspace for ${brand.brandName}`}
                          className="inline-flex min-h-[40px] w-full items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-800 transition-colors hover:border-slate-300 hover:bg-slate-50 whitespace-nowrap"
                        >
                          <span>Open Workspace</span>
                          <ArrowRight className="h-3.5 w-3.5 text-slate-500" strokeWidth={1.75} />
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        {/* Right Column: Quick Actions + Recent Activity */}
        <div className="space-y-8">
          <section aria-labelledby="quick-actions-heading">
            <h2
              id="quick-actions-heading"
              className="text-lg font-semibold tracking-tight text-slate-900"
            >
              Quick Actions
            </h2>
            <div className="mt-4 divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
              {quickActions.map((action) => {
                const Icon = action.icon;
                return (
                  <button
                    key={action.label}
                    type="button"
                    onClick={() => onNavigate(action.route)}
                    className="flex min-h-[56px] w-full items-center justify-between gap-3 px-4 py-3.5 text-left transition-colors first:rounded-t-xl last:rounded-b-xl hover:bg-slate-50"
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <Icon
                        className="mt-0.5 h-4 w-4 shrink-0 text-blue-600"
                        strokeWidth={1.75}
                      />
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-slate-900">
                          {action.label}
                        </div>
                        <div className="text-xs text-slate-500">
                          {action.description}
                        </div>
                      </div>
                    </div>
                    <ArrowRight
                      className="h-4 w-4 shrink-0 text-slate-400"
                      strokeWidth={1.75}
                    />
                  </button>
                );
              })}
            </div>
          </section>

          <section aria-labelledby="recent-activity-heading">
            <h2
              id="recent-activity-heading"
              className="text-lg font-semibold tracking-tight text-slate-900"
            >
              Recent Activity
            </h2>
            <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
              {recentActivities.length === 0 ? (
                <div className="py-6 text-center">
                  <Clock
                    className="mx-auto h-5 w-5 text-slate-300"
                    strokeWidth={1.75}
                  />
                  <p className="mt-2 text-sm font-medium text-slate-700">
                    No activity recorded yet
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Actions such as creating brands or opening workspaces will appear here.
                  </p>
                </div>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {recentActivities.map((event) => (
                    <li key={event.id} className="py-3 first:pt-1 last:pb-1">
                      <p className="text-sm text-slate-800">{event.description}</p>
                      <p className="mt-0.5 font-mono text-xs text-slate-500 tabular-nums">
                        {formatDateTime(event.createdAt)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
