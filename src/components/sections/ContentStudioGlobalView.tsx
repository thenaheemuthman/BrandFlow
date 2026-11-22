import { useState } from 'react';
import { ArrowRight, CalendarDays, PenTool, Plus } from 'lucide-react';
import type { Brand } from '../../types/brand';
import type { AppRoute } from '../../utils/router';
import { formatModuleStatusLabel, formatShortDate } from '../../utils/brandLogic';

interface ContentStudioGlobalViewProps {
  brands: Brand[];
  onNavigate: (route: AppRoute) => void;
}

export function ContentStudioGlobalView({
  brands,
  onNavigate,
}: ContentStudioGlobalViewProps) {
  const [selectedBrandId, setSelectedBrandId] = useState<string>(
    brands[0]?.id ?? '',
  );

  const selectedBrand = brands.find((b) => b.id === selectedBrandId) ?? brands[0];

  const totalAssets = brands.reduce((sum, b) => sum + (b.contentPiecesCount ?? 0), 0);
  const totalPendingReview = brands.reduce(
    (sum, b) => sum + (b.pendingApprovalsCount ?? 0),
    0,
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Content Studio
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Select a brand workspace to generate, refine, and approve strategy-grounded content assets.
          </p>
        </div>

        {brands.length > 0 && selectedBrand && (
          <div className="flex flex-wrap items-center gap-3">
            <label
              htmlFor="studio-brand-select"
              className="text-xs font-medium text-slate-500 whitespace-nowrap"
            >
              Quick launch
            </label>
            <select
              id="studio-brand-select"
              value={selectedBrand.id}
              onChange={(e) => setSelectedBrandId(e.target.value)}
              className="min-h-[40px] rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-indigo-600 focus:outline-none"
            >
              {brands.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.brandName}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() =>
                onNavigate({
                  view: 'brand-workspace',
                  brandId: selectedBrand.id,
                  section: 'content-studio',
                })
              }
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 whitespace-nowrap shrink-0"
            >
              <PenTool className="h-3.5 w-3.5" strokeWidth={1.75} />
              <span>Open Content Studio</span>
              <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.75} />
            </button>
          </div>
        )}
      </div>

      {brands.length === 0 ? (
        <section className="rounded-xl border border-slate-200 bg-white p-8 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
            <PenTool className="h-5 w-5" strokeWidth={1.75} />
          </div>
          <h2 className="mt-4 text-base font-semibold text-slate-900">
            No brand workspaces yet
          </h2>
          <p className="mx-auto mt-1.5 max-w-md text-sm text-slate-600">
            Create your first brand profile to unlock Content Studio drafting, calendar handoffs, and approval workflows.
          </p>
          <button
            type="button"
            onClick={() => onNavigate({ view: 'brand-new' })}
            className="mt-5 inline-flex min-h-[40px] items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700"
          >
            <Plus className="h-4 w-4" strokeWidth={1.75} />
            <span>Create First Brand</span>
          </button>
        </section>
      ) : (
        <>
          {/* Cross-Brand Studio Totals */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <p className="text-xs font-medium text-slate-500">Brand Workspaces</p>
              <p className="mt-2 font-mono text-2xl font-bold text-slate-900 tabular-nums">
                {brands.length}
              </p>
              <p className="mt-1 text-xs text-slate-500">Strictly isolated per brand</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <p className="text-xs font-medium text-slate-500">Total Content Assets</p>
              <p className="mt-2 font-mono text-2xl font-bold text-slate-900 tabular-nums">
                {totalAssets}
              </p>
              <p className="mt-1 text-xs text-slate-500">Active drafts, approved &amp; published</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <p className="text-xs font-medium text-slate-500">Awaiting Review</p>
              <p className="mt-2 font-mono text-2xl font-bold text-slate-900 tabular-nums">
                {totalPendingReview}
              </p>
              <p className="mt-1 text-xs text-slate-500">Explicit human approval required</p>
            </div>
          </div>

          {/* Brand Studio Directory */}
          <section className="rounded-xl border border-slate-200 bg-white divide-y divide-slate-100">
            {brands.map((brand) => {
              const studioStatus = brand.moduleStatuses?.contentStudio ?? 'not_started';
              const calendarStatus = brand.moduleStatuses?.contentCalendar ?? 'not_started';
              return (
                <div
                  key={brand.id}
                  className="flex flex-col justify-between gap-4 p-5 sm:flex-row sm:items-center"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                      <h2 className="text-base font-semibold text-slate-900 truncate">
                        {brand.brandName}
                      </h2>
                      <span aria-hidden="true" className="text-slate-300">
                        ·
                      </span>
                      <span className="text-xs font-medium text-slate-600">
                        {formatModuleStatusLabel(studioStatus)}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      {brand.industry} ·{' '}
                      <span className="font-mono tabular-nums">
                        {brand.contentPiecesCount ?? 0}
                      </span>{' '}
                      assets ·{' '}
                      <span className="font-mono tabular-nums">
                        {brand.pendingApprovalsCount ?? 0}
                      </span>{' '}
                      pending review · Calendar {formatModuleStatusLabel(calendarStatus)} · Updated{' '}
                      <span className="font-mono tabular-nums">
                        {formatShortDate(brand.updatedAt)}
                      </span>
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() =>
                        onNavigate({
                          view: 'brand-workspace',
                          brandId: brand.id,
                          section: 'content-calendar',
                        })
                      }
                      className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 whitespace-nowrap"
                    >
                      <CalendarDays className="h-3.5 w-3.5 text-slate-500" strokeWidth={1.75} />
                      <span>Calendar</span>
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        onNavigate({
                          view: 'brand-workspace',
                          brandId: brand.id,
                          section: 'content-studio',
                        })
                      }
                      className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-slate-800 whitespace-nowrap"
                    >
                      <PenTool className="h-3.5 w-3.5" strokeWidth={1.75} />
                      <span>Open Content Studio</span>
                      <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.75} />
                    </button>
                  </div>
                </div>
              );
            })}
          </section>
        </>
      )}
    </div>
  );
}
