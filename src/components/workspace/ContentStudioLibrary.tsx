import { useMemo, useState } from 'react';
import {
  Archive,
  CalendarDays,
  Copy,
  FileText,
  Pencil,
  Search,
  Trash2,
} from 'lucide-react';
import type { ContentAsset, ContentAssetStatus } from '../../types/brand';
import {
  CONTENT_ASSET_FORMAT_CATEGORIES,
  CONTENT_ASSET_STATUSES,
  filterContentAssets,
  getFormatCategoryLabel,
} from '../../utils/contentStudioLogic';

interface ContentStudioLibraryProps {
  assets: ContentAsset[];
  activeAssetId: string | null;
  busyAssetId: string | null;
  onOpenAsset: (assetId: string) => void;
  onDuplicateAsset: (asset: ContentAsset) => Promise<void>;
  onToggleArchive: (asset: ContentAsset) => Promise<void>;
  onRequestDeleteAsset: (asset: ContentAsset) => void;
  onCreateNewDraft: () => void;
}

const STATUS_TEXT_CLASS: Record<ContentAssetStatus, string> = {
  draft: 'text-slate-600',
  in_progress: 'text-indigo-700',
  ready_for_review: 'text-amber-700 font-medium',
  approved: 'text-emerald-700 font-medium',
  published: 'text-slate-900 font-semibold',
  archived: 'text-slate-400',
};

function getStatusLabel(status: ContentAssetStatus): string {
  return CONTENT_ASSET_STATUSES.find((s) => s.value === status)?.label ?? status;
}

export function ContentStudioLibrary({
  assets,
  activeAssetId,
  busyAssetId,
  onOpenAsset,
  onDuplicateAsset,
  onToggleArchive,
  onRequestDeleteAsset,
  onCreateNewDraft,
}: ContentStudioLibraryProps) {
  const [query, setQuery] = useState('');
  const [platformFilter, setPlatformFilter] = useState('all');
  const [formatFilter, setFormatFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const platformOptions = useMemo(() => {
    const set = new Set<string>();
    for (const asset of assets) {
      if (asset.platform) set.add(asset.platform);
    }
    return Array.from(set).sort();
  }, [assets]);

  const filtered = useMemo(
    () =>
      filterContentAssets(assets, {
        query,
        platform: platformFilter,
        formatCategory: formatFilter,
        status: statusFilter,
        dateFrom,
        dateTo,
      }),
    [assets, query, platformFilter, formatFilter, statusFilter, dateFrom, dateTo],
  );

  const hasFilters =
    query.trim().length > 0 ||
    platformFilter !== 'all' ||
    formatFilter !== 'all' ||
    statusFilter !== 'all' ||
    dateFrom.length > 0 ||
    dateTo.length > 0;

  const clearFilters = () => {
    setQuery('');
    setPlatformFilter('all');
    setFormatFilter('all');
    setStatusFilter('all');
    setDateFrom('');
    setDateTo('');
  };

  return (
    <div className="space-y-4">
      {/* Filter & Search Bar */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
          <div className="relative md:col-span-4">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
              strokeWidth={1.75}
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search titles, hooks, copy, or pillars..."
              aria-label="Search content assets"
              className="w-full min-h-[40px] rounded-lg border border-slate-200 bg-white pl-9 pr-3 py-2 text-sm text-slate-800 focus:border-blue-600 focus:outline-none"
            />
          </div>

          <select
            value={platformFilter}
            onChange={(e) => setPlatformFilter(e.target.value)}
            aria-label="Filter by platform"
            className="md:col-span-2 min-h-[40px] rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-600 focus:outline-none"
          >
            <option value="all">All Platforms</option>
            {platformOptions.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>

          <select
            value={formatFilter}
            onChange={(e) => setFormatFilter(e.target.value)}
            aria-label="Filter by format"
            className="md:col-span-3 min-h-[40px] rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-600 focus:outline-none"
          >
            <option value="all">All Formats</option>
            {CONTENT_ASSET_FORMAT_CATEGORIES.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            aria-label="Filter by status"
            className="md:col-span-3 min-h-[40px] rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-600 focus:outline-none"
          >
            <option value="all">All Statuses</option>
            {CONTENT_ASSET_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span>Date window:</span>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              aria-label="Filter from date"
              className="min-h-[34px] rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-700 tabular-nums focus:border-blue-600 focus:outline-none"
            />
            <span>to</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              aria-label="Filter to date"
              className="min-h-[34px] rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-700 tabular-nums focus:border-blue-600 focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-3 text-xs text-slate-500">
            <span className="tabular-nums">
              Showing {filtered.length} of {assets.length} assets
            </span>
            {hasFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="font-medium text-blue-700 hover:underline"
              >
                Clear Filters
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Asset List */}
      {assets.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white px-6 py-12 text-center space-y-3">
          <FileText className="mx-auto h-7 w-7 text-slate-400" strokeWidth={1.5} />
          <div>
            <p className="text-sm font-semibold text-slate-900">
              No content assets created yet
            </p>
            <p className="mt-1 text-sm text-slate-500 max-w-md mx-auto">
              Select a 30-Day Content Calendar entry or start a standalone draft to generate brand-aligned content.
            </p>
          </div>
          <button
            type="button"
            onClick={onCreateNewDraft}
            className="inline-flex min-h-[40px] items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Create First Content Asset
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white px-6 py-10 text-center space-y-2">
          <p className="text-sm font-semibold text-slate-900">
            No content assets match your filters
          </p>
          <button
            type="button"
            onClick={clearFilters}
            className="text-xs font-medium text-blue-700 hover:underline"
          >
            Reset all filters
          </button>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white divide-y divide-slate-200 overflow-hidden">
          {filtered.map((asset) => {
            const isBusy = busyAssetId === asset.id;
            const isSelected = activeAssetId === asset.id;
            return (
              <div
                key={asset.id}
                className={`p-4 sm:px-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between transition-colors ${
                  isSelected ? 'bg-blue-50/40' : 'hover:bg-slate-50/70'
                }`}
              >
                <div className="min-w-0 flex-1">
                  <button
                    type="button"
                    onClick={() => onOpenAsset(asset.id)}
                    className="text-left text-sm font-semibold text-slate-900 hover:text-blue-700 transition-colors line-clamp-1"
                  >
                    {asset.title}
                  </button>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500">
                    <span className={STATUS_TEXT_CLASS[asset.workflowStatus]}>
                      {getStatusLabel(asset.workflowStatus)}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>{asset.platform}</span>
                    <span aria-hidden="true">·</span>
                    <span>
                      {asset.formatLabel || getFormatCategoryLabel(asset.formatCategory)}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="tabular-nums">v{asset.currentVersionNumber}</span>
                    {asset.scheduledDate && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="inline-flex items-center gap-1 tabular-nums">
                          <CalendarDays className="h-3 w-3 text-slate-400" strokeWidth={1.75} />
                          {asset.scheduledDate}
                        </span>
                      </>
                    )}
                    {asset.contentPillar && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="truncate max-w-[200px]">{asset.contentPillar}</span>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => onOpenAsset(asset.id)}
                    className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 whitespace-nowrap shrink-0"
                  >
                    <Pencil className="h-3.5 w-3.5" strokeWidth={1.75} />
                    <span>Open</span>
                  </button>

                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => void onDuplicateAsset(asset)}
                    className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 whitespace-nowrap shrink-0"
                    title="Duplicate asset as draft"
                  >
                    <Copy className="h-3.5 w-3.5" strokeWidth={1.75} />
                    <span className="hidden sm:inline">Duplicate</span>
                  </button>

                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => void onToggleArchive(asset)}
                    className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 whitespace-nowrap shrink-0"
                    title={asset.workflowStatus === 'archived' ? 'Restore to draft' : 'Archive asset'}
                  >
                    <Archive className="h-3.5 w-3.5" strokeWidth={1.75} />
                    <span className="hidden sm:inline">
                      {asset.workflowStatus === 'archived' ? 'Restore' : 'Archive'}
                    </span>
                  </button>

                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => onRequestDeleteAsset(asset)}
                    aria-label={`Delete ${asset.title}`}
                    className="inline-flex min-h-[36px] items-center justify-center rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-500 hover:border-rose-200 hover:text-rose-600 disabled:opacity-50 shrink-0"
                  >
                    <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
