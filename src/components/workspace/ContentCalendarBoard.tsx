import { useMemo } from 'react';
import { Copy, Pencil, Plus, Trash2 } from 'lucide-react';
import type {
  CalendarWorkflowStatus,
  ContentCalendar,
  ContentCalendarItem,
} from '../../types/brand';
import {
  CALENDAR_WORKFLOW_STATUSES,
  buildMonthlyCalendarGrid,
  formatCalendarDisplayDate,
  groupItemsByWeek,
} from '../../utils/contentCalendarLogic';

export type CalendarBoardViewMode = 'monthly' | 'weekly' | 'list';

interface ContentCalendarBoardProps {
  calendar: ContentCalendar;
  items: ContentCalendarItem[];
  viewMode: CalendarBoardViewMode;
  busyItemId: string | null;
  onSelectItem: (item: ContentCalendarItem) => void;
  onQuickAddForDate: (isoDate: string) => void;
  onUpdateStatus: (item: ContentCalendarItem, nextStatus: CalendarWorkflowStatus) => Promise<void>;
  onDuplicateItem: (item: ContentCalendarItem) => Promise<void>;
  onRequestDeleteItem: (item: ContentCalendarItem) => void;
}

const STATUS_DOT_COLOR: Record<CalendarWorkflowStatus, string> = {
  planned: 'bg-slate-400',
  in_progress: 'bg-indigo-500',
  ready_for_review: 'bg-amber-500',
  approved: 'bg-emerald-500',
  published: 'bg-slate-900',
  skipped: 'bg-rose-400',
};

const STATUS_LABEL_MAP: Record<CalendarWorkflowStatus, string> = {
  planned: 'Planned',
  in_progress: 'In Progress',
  ready_for_review: 'Ready for Review',
  approved: 'Approved',
  published: 'Published',
  skipped: 'Skipped',
};

const DAY_HEADERS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

export function ContentCalendarBoard({
  calendar,
  items,
  viewMode,
  busyItemId,
  onSelectItem,
  onQuickAddForDate,
  onUpdateStatus,
  onDuplicateItem,
  onRequestDeleteItem,
}: ContentCalendarBoardProps) {
  const monthlyCells = useMemo(
    () => buildMonthlyCalendarGrid(calendar, items),
    [calendar, items],
  );

  const weeklyGroups = useMemo(
    () => groupItemsByWeek(calendar, items),
    [calendar, items],
  );

  if (items.length === 0 && viewMode === 'list') {
    return (
      <div className="rounded-xl border border-slate-200 bg-white px-6 py-12 text-center">
        <p className="text-sm font-medium text-slate-900">No calendar entries match your current view.</p>
        <p className="mt-1 text-sm text-slate-500">
          Adjust your filters or add a new scheduled entry to this calendar.
        </p>
      </div>
    );
  }

  if (viewMode === 'monthly') {
    return (
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        {/* Desktop 7-column calendar grid */}
        <div className="hidden md:block">
          <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50">
            {DAY_HEADERS.map((day) => (
              <div
                key={day}
                className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-slate-500"
              >
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 divide-x divide-y divide-slate-200">
            {monthlyCells.map((cell) => {
              const visibleItems = cell.items.slice(0, 2);
              const overflowCount = Math.max(0, cell.items.length - visibleItems.length);
              return (
                <div
                  key={cell.isoDate}
                  className={`min-h-[126px] p-2.5 flex flex-col ${
                    cell.inCalendarWindow ? 'bg-white' : 'bg-slate-50/70'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span
                      className={`text-xs font-semibold tabular-nums ${
                        cell.inCalendarWindow ? 'text-slate-900' : 'text-slate-400'
                      }`}
                    >
                      {cell.monthLabel} {cell.dayOfMonth}
                    </span>
                    {cell.inCalendarWindow && (
                      <button
                        type="button"
                        aria-label={`Add entry for ${cell.isoDate}`}
                        onClick={() => onQuickAddForDate(cell.isoDate)}
                        className="rounded p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                      >
                        <Plus className="h-3.5 w-3.5" strokeWidth={1.75} />
                      </button>
                    )}
                  </div>

                  <div className="mt-2 flex-1 space-y-1.5">
                    {visibleItems.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => onSelectItem(item)}
                        className="w-full rounded-md border border-slate-200 bg-slate-50/70 px-2 py-1.5 text-left transition-colors hover:border-indigo-300 hover:bg-indigo-50/40"
                      >
                        <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500">
                          <span
                            className={`h-1.5 w-1.5 shrink-0 rounded-full ${STATUS_DOT_COLOR[item.workflowStatus]}`}
                          />
                          <span className="truncate">{item.platform}</span>
                        </div>
                        <p className="mt-0.5 line-clamp-2 text-xs font-medium leading-snug text-slate-900">
                          {item.title}
                        </p>
                      </button>
                    ))}

                    {overflowCount > 0 && (
                      <button
                        type="button"
                        onClick={() => onSelectItem(cell.items[2])}
                        className="w-full rounded px-2 py-1 text-left text-xs font-medium text-indigo-600 hover:bg-indigo-50"
                      >
                        +{overflowCount} more scheduled
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Mobile stacked day view (prevents horizontal overflow on narrow screens) */}
        <div className="divide-y divide-slate-200 md:hidden">
          {monthlyCells
            .filter((cell) => cell.inCalendarWindow)
            .map((cell) => (
              <div key={cell.isoDate} className="p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold tabular-nums text-slate-900">
                    {formatCalendarDisplayDate(cell.isoDate)}
                  </span>
                  <button
                    type="button"
                    onClick={() => onQuickAddForDate(cell.isoDate)}
                    className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-700"
                  >
                    <Plus className="h-3.5 w-3.5" strokeWidth={1.75} />
                    <span>Add</span>
                  </button>
                </div>

                {cell.items.length === 0 ? (
                  <p className="mt-1.5 text-xs text-slate-400">No entries scheduled</p>
                ) : (
                  <div className="mt-2.5 space-y-2">
                    {cell.items.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => onSelectItem(item)}
                        className="w-full rounded-lg border border-slate-200 bg-slate-50/70 p-3 text-left transition-colors hover:border-indigo-300"
                      >
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                          <span
                            className={`h-2 w-2 rounded-full ${STATUS_DOT_COLOR[item.workflowStatus]}`}
                          />
                          <span className="font-medium text-slate-700">{item.platform}</span>
                          <span>·</span>
                          <span>{STATUS_LABEL_MAP[item.workflowStatus]}</span>
                        </div>
                        <p className="mt-1 text-sm font-medium text-slate-900">{item.title}</p>
                        <p className="mt-0.5 text-xs text-slate-500">
                          {item.contentPillar} · {item.contentFormat}
                        </p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
        </div>
      </div>
    );
  }

  if (viewMode === 'weekly') {
    return (
      <div className="space-y-6">
        {weeklyGroups.map((group) => (
          <section
            key={group.weekNumber}
            className="rounded-xl border border-slate-200 bg-white overflow-hidden"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-5 py-3">
              <h3 className="text-sm font-semibold text-slate-900">{group.label}</h3>
              <span className="text-xs font-medium tabular-nums text-slate-600">
                {group.totalItems} {group.totalItems === 1 ? 'entry' : 'entries'}
              </span>
            </div>

            <div className="divide-y divide-slate-100">
              {group.days.map((day) => (
                <div key={day.isoDate} className="px-5 py-3.5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-baseline gap-2">
                      <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                        {day.weekdayShort}
                      </span>
                      <span className="text-sm font-semibold tabular-nums text-slate-900">
                        {day.displayDate}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => onQuickAddForDate(day.isoDate)}
                      className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-indigo-600"
                    >
                      <Plus className="h-3.5 w-3.5" strokeWidth={1.75} />
                      <span>Add entry</span>
                    </button>
                  </div>

                  {day.items.length === 0 ? (
                    <p className="mt-1.5 text-xs text-slate-400">Open slot</p>
                  ) : (
                    <div className="mt-2.5 space-y-2.5">
                      {day.items.map((item) => {
                        const isBusy = busyItemId === item.id;
                        return (
                          <div
                            key={item.id}
                            className="flex flex-col justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3.5 transition-colors hover:border-slate-300 sm:flex-row sm:items-start"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                                <span className="font-semibold text-slate-900">{item.platform}</span>
                                <span>·</span>
                                <span>{item.contentFormat}</span>
                                <span>·</span>
                                <span>{item.contentPillar}</span>
                                {item.suggestedTime && (
                                  <>
                                    <span>·</span>
                                    <span className="tabular-nums">{item.suggestedTime}</span>
                                  </>
                                )}
                              </div>
                              <button
                                type="button"
                                onClick={() => onSelectItem(item)}
                                className="mt-1 text-left text-sm font-semibold text-slate-900 hover:text-indigo-600"
                              >
                                {item.title}
                              </button>
                              <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-600">
                                {item.coreMessage}
                              </p>
                              <p className="mt-1.5 text-xs text-slate-500">
                                Audience: <span className="text-slate-700">{item.targetAudience}</span>
                                {item.intendedCta && (
                                  <>
                                    {' '}· CTA: <span className="text-slate-700">{item.intendedCta}</span>
                                  </>
                                )}
                              </p>
                            </div>

                            <div className="flex flex-wrap items-center gap-2 shrink-0">
                              <select
                                aria-label={`Status for ${item.title}`}
                                value={item.workflowStatus}
                                disabled={isBusy}
                                onChange={(e) =>
                                  onUpdateStatus(item, e.target.value as CalendarWorkflowStatus)
                                }
                                className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-800 focus:border-indigo-500 focus:outline-none"
                              >
                                {CALENDAR_WORKFLOW_STATUSES.map((st) => (
                                  <option key={st.value} value={st.value}>
                                    {st.label}
                                  </option>
                                ))}
                              </select>

                              <button
                                type="button"
                                onClick={() => onSelectItem(item)}
                                aria-label={`Edit ${item.title}`}
                                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                              >
                                <Pencil className="h-3.5 w-3.5" strokeWidth={1.75} />
                              </button>
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => onDuplicateItem(item)}
                                aria-label={`Duplicate ${item.title}`}
                                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 disabled:opacity-50"
                              >
                                <Copy className="h-3.5 w-3.5" strokeWidth={1.75} />
                              </button>
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => onRequestDeleteItem(item)}
                                aria-label={`Delete ${item.title}`}
                                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:border-red-200 hover:bg-red-50 hover:text-red-700 disabled:opacity-50"
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
              ))}
            </div>
          </section>
        ))}
      </div>
    );
  }

  // List View
  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500">
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Platform</th>
              <th className="px-4 py-3">Title &amp; Brief</th>
              <th className="px-4 py-3">Pillar &amp; Format</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map((item) => {
              const isBusy = busyItemId === item.id;
              return (
                <tr key={item.id} className="hover:bg-slate-50/70">
                  <td className="px-4 py-3.5 align-top whitespace-nowrap">
                    <div className="font-medium tabular-nums text-slate-900">
                      {formatCalendarDisplayDate(item.scheduledDate)}
                    </div>
                    {item.suggestedTime && (
                      <div className="mt-0.5 text-xs tabular-nums text-slate-500">
                        {item.suggestedTime}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3.5 align-top whitespace-nowrap font-medium text-slate-800">
                    {item.platform}
                  </td>
                  <td className="px-4 py-3.5 align-top max-w-sm">
                    <button
                      type="button"
                      onClick={() => onSelectItem(item)}
                      className="text-left font-semibold text-slate-900 hover:text-indigo-600"
                    >
                      {item.title}
                    </button>
                    <p className="mt-0.5 line-clamp-2 text-xs text-slate-600">
                      {item.coreMessage}
                    </p>
                  </td>
                  <td className="px-4 py-3.5 align-top">
                    <div className="text-xs font-medium text-slate-800">{item.contentPillar}</div>
                    <div className="mt-0.5 text-xs text-slate-500">
                      {item.contentFormat}
                      {item.contentSeries ? ` · ${item.contentSeries}` : ''}
                    </div>
                  </td>
                  <td className="px-4 py-3.5 align-top whitespace-nowrap">
                    <select
                      aria-label={`Status for ${item.title}`}
                      value={item.workflowStatus}
                      disabled={isBusy}
                      onChange={(e) =>
                        onUpdateStatus(item, e.target.value as CalendarWorkflowStatus)
                      }
                      className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-800 focus:border-indigo-500 focus:outline-none"
                    >
                      {CALENDAR_WORKFLOW_STATUSES.map((st) => (
                        <option key={st.value} value={st.value}>
                          {st.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3.5 align-top text-right whitespace-nowrap">
                    <div className="inline-flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => onSelectItem(item)}
                        aria-label={`Edit ${item.title}`}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-white hover:text-slate-900"
                      >
                        <Pencil className="h-3.5 w-3.5" strokeWidth={1.75} />
                      </button>
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => onDuplicateItem(item)}
                        aria-label={`Duplicate ${item.title}`}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-white hover:text-slate-900 disabled:opacity-50"
                      >
                        <Copy className="h-3.5 w-3.5" strokeWidth={1.75} />
                      </button>
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => onRequestDeleteItem(item)}
                        aria-label={`Delete ${item.title}`}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:border-red-200 hover:bg-red-50 hover:text-red-700 disabled:opacity-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
