import { useMemo, useState } from 'react';
import {
  ArrowRight,
  Briefcase,
  Pencil,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import type { Brand } from '../../types/brand';
import type { AppRoute } from '../../utils/router';
import {
  BRAND_INDUSTRIES,
  computeBrandProgress,
  filterAndSortBrands,
  formatShortDate,
  type BrandSortOption,
} from '../../utils/brandLogic';

interface MyBrandsViewProps {
  brands: Brand[];
  loading: boolean;
  onNavigate: (route: AppRoute) => void;
  onRequestDelete: (brand: Brand) => void;
}

export function MyBrandsView({
  brands,
  loading,
  onNavigate,
  onRequestDelete,
}: MyBrandsViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [industryFilter, setIndustryFilter] = useState('all');
  const [sortBy, setSortBy] = useState<BrandSortOption>('updated');

  const availableIndustries = useMemo(() => {
    const set = new Set<string>(BRAND_INDUSTRIES);
    brands.forEach((b) => {
      if (b.industry) set.add(b.industry);
    });
    return Array.from(set);
  }, [brands]);

  const filteredBrands = useMemo(
    () => filterAndSortBrands(brands, searchQuery, industryFilter, sortBy),
    [brands, searchQuery, industryFilter, sortBy],
  );

  const hasFilters = searchQuery.trim() !== '' || industryFilter !== 'all';

  if (loading) {
    return (
      <div className="space-y-6" aria-busy="true" aria-label="Loading brands">
        <div className="h-14 animate-pulse rounded-xl border border-slate-200 bg-slate-50" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-56 animate-pulse rounded-xl border border-slate-200 bg-slate-50"
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            My Brands
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Each brand operates in its own isolated workspace for strategy, messaging, and content execution.
          </p>
        </div>

        <button
          type="button"
          onClick={() => onNavigate({ view: 'brand-new' })}
          className="inline-flex min-h-[42px] items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 whitespace-nowrap shrink-0"
        >
          <Plus className="h-4 w-4" strokeWidth={2} />
          <span>Create New Brand</span>
        </button>
      </div>

      {brands.length === 0 ? (
        <section className="rounded-xl border border-dashed border-slate-300 bg-slate-50/50 px-6 py-14 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500">
            <Briefcase className="h-6 w-6" strokeWidth={1.75} />
          </div>
          <h2 className="mt-4 text-lg font-semibold text-slate-900">
            Create your first brand workspace
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-slate-600">
            Start by capturing your brand name, business overview, products, and target market. You can refine or update these details anytime.
          </p>
          <div className="mt-6">
            <button
              type="button"
              onClick={() => onNavigate({ view: 'brand-new' })}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 whitespace-nowrap shrink-0"
            >
              <Plus className="h-4 w-4" strokeWidth={2} />
              <span>Create New Brand</span>
            </button>
          </div>
        </section>
      ) : (
        <>
          {/* Filter & Search Bar */}
          <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <label htmlFor="brands-search" className="sr-only">
                Search brands
              </label>
              <Search
                className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400"
                strokeWidth={1.75}
              />
              <input
                id="brands-search"
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by brand name, market, or location..."
                className="min-h-[40px] w-full rounded-lg border border-slate-200 bg-white py-2 pr-3 pl-9 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none"
              />
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div>
                <label htmlFor="brands-industry-filter" className="sr-only">
                  Filter by industry
                </label>
                <select
                  id="brands-industry-filter"
                  value={industryFilter}
                  onChange={(e) => setIndustryFilter(e.target.value)}
                  className="min-h-[40px] w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-blue-600 focus:outline-none sm:w-48"
                >
                  <option value="all">All industries</option>
                  {availableIndustries.map((ind) => (
                    <option key={ind} value={ind}>
                      {ind}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="brands-sort" className="sr-only">
                  Sort brands
                </label>
                <select
                  id="brands-sort"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as BrandSortOption)}
                  className="min-h-[40px] w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-blue-600 focus:outline-none sm:w-44"
                >
                  <option value="updated">Recently updated</option>
                  <option value="accessed">Recently accessed</option>
                  <option value="name">Alphabetical (A–Z)</option>
                  <option value="created">Newest created</option>
                </select>
              </div>
            </div>
          </div>

          {filteredBrands.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white px-6 py-12 text-center">
              <p className="text-base font-medium text-slate-900">
                No matching brands found
              </p>
              <p className="mt-1 text-sm text-slate-500">
                Try adjusting your search query or industry filter.
              </p>
              {hasFilters && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setIndustryFilter('all');
                  }}
                  className="mt-4 inline-flex min-h-[40px] items-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Clear filters
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
              {filteredBrands.map((brand) => {
                const progress = computeBrandProgress(brand);
                return (
                  <article
                    key={brand.id}
                    className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 transition-all hover:border-slate-300 hover:shadow-xs"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <h2 className="text-lg font-semibold tracking-tight text-slate-900 truncate">
                          {brand.brandName}
                        </h2>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() =>
                              onNavigate({
                                view: 'brand-edit',
                                brandId: brand.id,
                              })
                            }
                            aria-label={`Edit ${brand.brandName}`}
                            title="Edit brand information"
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
                          >
                            <Pencil className="h-4 w-4" strokeWidth={1.75} />
                          </button>
                          <button
                            type="button"
                            onClick={() => onRequestDelete(brand)}
                            aria-label={`Delete ${brand.brandName}`}
                            title="Delete brand"
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-red-50 hover:text-red-600"
                          >
                            <Trash2 className="h-4 w-4" strokeWidth={1.75} />
                          </button>
                        </div>
                      </div>

                      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500">
                        <span>{brand.industry}</span>
                        <span aria-hidden="true">·</span>
                        <span>{brand.primaryLocation}</span>
                      </div>

                      <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-slate-600">
                        {brand.businessDescription}
                      </p>

                      <div className="mt-4 border-t border-slate-100 pt-3 text-xs text-slate-500">
                        <span className="font-medium text-slate-700">Target market: </span>
                        <span className="line-clamp-1">{brand.targetMarket}</span>
                      </div>
                    </div>

                    <div className="mt-5 border-t border-slate-100 pt-4">
                      <div className="flex items-center justify-between text-xs text-slate-600">
                        <span>
                          Updated{' '}
                          <span className="font-mono tabular-nums">
                            {formatShortDate(brand.updatedAt)}
                          </span>
                        </span>
                        <span className="font-mono font-medium text-slate-700 tabular-nums">
                          {progress.percentage}% complete
                        </span>
                      </div>

                      <div
                        className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100"
                        role="progressbar"
                        aria-valuenow={progress.percentage}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-label={`Workspace progress for ${brand.brandName}`}
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
                          aria-label={`Open workspace for ${brand.brandName}`}
                          className="inline-flex min-h-[42px] w-full items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-800 transition-colors hover:border-slate-300 hover:bg-slate-50 whitespace-nowrap"
                        >
                          <span>Open Workspace</span>
                          <ArrowRight className="h-4 w-4 text-slate-500" strokeWidth={1.75} />
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
