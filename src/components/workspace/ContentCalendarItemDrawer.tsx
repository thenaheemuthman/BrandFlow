import { useMemo, useState } from 'react';
import { Copy, PenTool, Trash2, X } from 'lucide-react';
import type {
  Brand,
  CalendarWorkflowStatus,
  ContentCalendar,
  ContentCalendarItem,
  CreateContentCalendarItemInput,
  UpdateContentCalendarItemInput,
} from '../../types/brand';
import {
  CALENDAR_WORKFLOW_STATUSES,
  buildContentStudioHandoffPayload,
  validateCalendarItemInput,
  type ApprovedCalendarContext,
} from '../../utils/contentCalendarLogic';

interface ContentCalendarItemDrawerProps {
  mode: 'create' | 'edit';
  brand: Brand;
  calendar: ContentCalendar;
  approvedContext: ApprovedCalendarContext;
  initialItem?: ContentCalendarItem | null;
  defaultDate?: string;
  saving: boolean;
  onSaveCreate: (input: CreateContentCalendarItemInput) => Promise<void>;
  onSaveUpdate: (itemId: string, patch: UpdateContentCalendarItemInput) => Promise<void>;
  onDuplicate?: (item: ContentCalendarItem) => Promise<void>;
  onDelete?: (item: ContentCalendarItem) => void;
  onClose: () => void;
}

export function ContentCalendarItemDrawer({
  mode,
  brand,
  calendar,
  approvedContext,
  initialItem,
  defaultDate,
  saving,
  onSaveCreate,
  onSaveUpdate,
  onDuplicate,
  onDelete,
  onClose,
}: ContentCalendarItemDrawerProps) {
  const allowedPlatforms = useMemo(() => {
    const base =
      calendar.settings.selectedPlatforms.length > 0
        ? calendar.settings.selectedPlatforms
        : approvedContext.approvedPlatforms;
    if (initialItem?.platform && !base.includes(initialItem.platform)) {
      return [...base, initialItem.platform];
    }
    return base;
  }, [calendar.settings.selectedPlatforms, approvedContext.approvedPlatforms, initialItem]);

  const [scheduledDate, setScheduledDate] = useState(
    initialItem?.scheduledDate ?? defaultDate ?? calendar.startDate,
  );
  const [suggestedTime, setSuggestedTime] = useState(
    initialItem?.suggestedTime ?? calendar.settings.preferredPostingTime ?? '09:00 AM',
  );
  const [platform, setPlatform] = useState(
    initialItem?.platform ?? allowedPlatforms[0] ?? '',
  );
  const [workflowStatus, setWorkflowStatus] = useState<CalendarWorkflowStatus>(
    initialItem?.workflowStatus ?? 'planned',
  );
  const [title, setTitle] = useState(initialItem?.title ?? '');
  const [contentPillar, setContentPillar] = useState(
    initialItem?.contentPillar ?? approvedContext.approvedPillars[0] ?? '',
  );
  const [contentTheme, setContentTheme] = useState(
    initialItem?.contentTheme ?? approvedContext.approvedThemes[0] ?? '',
  );
  const [contentFormat, setContentFormat] = useState(
    initialItem?.contentFormat ?? approvedContext.approvedFormats[0] ?? '',
  );
  const [contentSeries, setContentSeries] = useState(initialItem?.contentSeries ?? '');
  const [targetAudience, setTargetAudience] = useState(
    initialItem?.targetAudience ?? approvedContext.approvedPersonas[0] ?? '',
  );
  const [audiencePainPoint, setAudiencePainPoint] = useState(
    initialItem?.audiencePainPoint ?? '',
  );
  const [contentObjective, setContentObjective] = useState(
    initialItem?.contentObjective ?? approvedContext.approvedContentObjectives[0] ?? '',
  );
  const [relatedMarketingObjective, setRelatedMarketingObjective] = useState(
    initialItem?.relatedMarketingObjective ??
      approvedContext.approvedMarketingObjectives[0] ??
      '',
  );
  const [coreMessage, setCoreMessage] = useState(initialItem?.coreMessage ?? '');
  const [suggestedAngle, setSuggestedAngle] = useState(initialItem?.suggestedAngle ?? '');
  const [intendedCta, setIntendedCta] = useState(initialItem?.intendedCta ?? '');
  const [relevantKpi, setRelevantKpi] = useState(
    initialItem?.relevantKpi ?? approvedContext.approvedKpis[0] ?? '',
  );
  const [productionNotes, setProductionNotes] = useState(initialItem?.productionNotes ?? '');
  const [error, setError] = useState<string | null>(null);
  const [showStudioHandoff, setShowStudioHandoff] = useState(false);

  const handoffPayload = useMemo(() => {
    if (mode !== 'edit' || !initialItem) return null;
    try {
      return buildContentStudioHandoffPayload(brand, calendar, initialItem);
    } catch {
      return null;
    }
  }, [mode, brand, calendar, initialItem]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;

    const payload: CreateContentCalendarItemInput = {
      scheduledDate,
      suggestedTime: suggestedTime.trim(),
      platform: platform.trim(),
      title: title.trim(),
      contentPillar: contentPillar.trim(),
      contentTheme: contentTheme.trim(),
      contentFormat: contentFormat.trim(),
      contentSeries: contentSeries.trim(),
      targetAudience: targetAudience.trim(),
      audiencePainPoint: audiencePainPoint.trim(),
      contentObjective: contentObjective.trim(),
      relatedMarketingObjective: relatedMarketingObjective.trim(),
      coreMessage: coreMessage.trim(),
      suggestedAngle: suggestedAngle.trim(),
      intendedCta: intendedCta.trim(),
      relevantKpi: relevantKpi.trim(),
      productionNotes: productionNotes.trim(),
      workflowStatus,
      source: mode === 'create' ? 'manual' : undefined,
    };

    const validationError = validateCalendarItemInput(payload, allowedPlatforms);
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    if (mode === 'create') {
      await onSaveCreate(payload);
    } else if (initialItem) {
      await onSaveUpdate(initialItem.id, payload);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="calendar-item-drawer-title"
      className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-[1px]"
    >
      <div className="flex h-full w-full max-w-2xl flex-col bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 border-b border-slate-200 px-6 py-4">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wider text-indigo-600">
              {mode === 'create' ? 'New Calendar Entry' : 'Calendar Planning Brief'}
            </p>
            <h2
              id="calendar-item-drawer-title"
              className="mt-0.5 truncate text-base font-semibold text-slate-900"
            >
              {mode === 'create' ? 'Add Scheduled Content Slot' : initialItem?.title}
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close entry drawer"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-900"
          >
            <X className="h-4 w-4" strokeWidth={1.75} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {error && (
            <div
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
            >
              {error}
            </div>
          )}

          {/* Schedule & Platform Row */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="item-date" className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
                Scheduled Date
              </label>
              <input
                id="item-date"
                type="date"
                required
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm tabular-nums text-slate-900 focus:border-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="item-time" className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
                Suggested Time
              </label>
              <input
                id="item-time"
                type="text"
                value={suggestedTime}
                onChange={(e) => setSuggestedTime(e.target.value)}
                placeholder="e.g., 09:00 AM"
                className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="item-platform" className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
                Platform (Approved Channels)
              </label>
              <select
                id="item-platform"
                required
                value={platform}
                onChange={(e) => setPlatform(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none"
              >
                {allowedPlatforms.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="item-status" className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
                Workflow Status
              </label>
              <select
                id="item-status"
                value={workflowStatus}
                onChange={(e) => setWorkflowStatus(e.target.value as CalendarWorkflowStatus)}
                className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none"
              >
                {CALENDAR_WORKFLOW_STATUSES.map((st) => (
                  <option key={st.value} value={st.value}>
                    {st.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Title & Core Message */}
          <div>
            <label htmlFor="item-title" className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
              Content Title / Working Headline
            </label>
            <input
              id="item-title"
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Concise, specific topic title"
              className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="item-core-message" className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
              Core Message / Planning Brief
            </label>
            <textarea
              id="item-core-message"
              rows={3}
              required
              value={coreMessage}
              onChange={(e) => setCoreMessage(e.target.value)}
              placeholder="Key strategic takeaway for Content Studio drafting (not full copy)."
              className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none"
            />
          </div>

          {/* Strategy Alignment Fields */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="item-pillar" className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
                Content Pillar
              </label>
              <input
                id="item-pillar"
                list="approved-pillars-list"
                required
                value={contentPillar}
                onChange={(e) => setContentPillar(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none"
              />
              <datalist id="approved-pillars-list">
                {approvedContext.approvedPillars.map((p) => (
                  <option key={p} value={p} />
                ))}
              </datalist>
            </div>

            <div>
              <label htmlFor="item-format" className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
                Content Format
              </label>
              <input
                id="item-format"
                list="approved-formats-list"
                required
                value={contentFormat}
                onChange={(e) => setContentFormat(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none"
              />
              <datalist id="approved-formats-list">
                {approvedContext.approvedFormats.map((f) => (
                  <option key={f} value={f} />
                ))}
              </datalist>
            </div>

            <div>
              <label htmlFor="item-theme" className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
                Content Theme
              </label>
              <input
                id="item-theme"
                list="approved-themes-list"
                value={contentTheme}
                onChange={(e) => setContentTheme(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none"
              />
              <datalist id="approved-themes-list">
                {approvedContext.approvedThemes.map((t) => (
                  <option key={t} value={t} />
                ))}
              </datalist>
            </div>

            <div>
              <label htmlFor="item-series" className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
                Content Series (Optional)
              </label>
              <input
                id="item-series"
                list="approved-series-list"
                value={contentSeries}
                onChange={(e) => setContentSeries(e.target.value)}
                placeholder="Optional recurring series"
                className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none"
              />
              <datalist id="approved-series-list">
                {approvedContext.approvedSeries.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
            </div>

            <div>
              <label htmlFor="item-audience" className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
                Target Audience / Persona
              </label>
              <input
                id="item-audience"
                list="approved-personas-list"
                value={targetAudience}
                onChange={(e) => setTargetAudience(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none"
              />
              <datalist id="approved-personas-list">
                {approvedContext.approvedPersonas.map((p) => (
                  <option key={p} value={p} />
                ))}
              </datalist>
            </div>

            <div>
              <label htmlFor="item-pain" className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
                Audience Pain Point / Interest
              </label>
              <input
                id="item-pain"
                value={audiencePainPoint}
                onChange={(e) => setAudiencePainPoint(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="item-content-obj" className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
                Content Objective
              </label>
              <input
                id="item-content-obj"
                list="approved-content-obj-list"
                value={contentObjective}
                onChange={(e) => setContentObjective(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none"
              />
              <datalist id="approved-content-obj-list">
                {approvedContext.approvedContentObjectives.map((o) => (
                  <option key={o} value={o} />
                ))}
              </datalist>
            </div>

            <div>
              <label htmlFor="item-mkt-obj" className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
                Related Marketing Objective
              </label>
              <input
                id="item-mkt-obj"
                list="approved-mkt-obj-list"
                value={relatedMarketingObjective}
                onChange={(e) => setRelatedMarketingObjective(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none"
              />
              <datalist id="approved-mkt-obj-list">
                {approvedContext.approvedMarketingObjectives.map((o) => (
                  <option key={o} value={o} />
                ))}
              </datalist>
            </div>
          </div>

          {/* Angle, CTA, KPI & Production Notes */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="item-angle" className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
                Suggested Angle / Hook Direction
              </label>
              <input
                id="item-angle"
                value={suggestedAngle}
                onChange={(e) => setSuggestedAngle(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="item-cta" className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
                Intended Call to Action
              </label>
              <input
                id="item-cta"
                value={intendedCta}
                onChange={(e) => setIntendedCta(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="item-kpi" className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
                Relevant KPI
              </label>
              <input
                id="item-kpi"
                list="approved-kpis-list"
                value={relevantKpi}
                onChange={(e) => setRelevantKpi(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none"
              />
              <datalist id="approved-kpis-list">
                {approvedContext.approvedKpis.map((k) => (
                  <option key={k} value={k} />
                ))}
              </datalist>
            </div>

            <div>
              <label htmlFor="item-notes" className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
                Production Notes
              </label>
              <input
                id="item-notes"
                value={productionNotes}
                onChange={(e) => setProductionNotes(e.target.value)}
                placeholder="Assets, proof points, or visual cue"
                className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Future Content Studio Integration Boundary (Read-Only Handoff Preview) */}
          {mode === 'edit' && handoffPayload && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <PenTool className="h-4 w-4 text-indigo-600" strokeWidth={1.75} />
                  <span className="text-sm font-semibold text-slate-900">
                    Content Studio Handoff Ready
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowStudioHandoff((v) => !v)}
                  className="text-xs font-medium text-indigo-600 hover:text-indigo-700"
                >
                  {showStudioHandoff ? 'Hide handoff metadata' : 'Inspect handoff brief'}
                </button>
              </div>
              <p className="mt-1 text-xs text-slate-600">
                This entry holds stable Brand, Calendar, and Slot identifiers for future one-click
                draft generation in Content Studio (next module).
              </p>
              {showStudioHandoff && (
                <div className="mt-3 rounded-md border border-slate-200 bg-white p-3 text-xs text-slate-700 space-y-1 font-mono">
                  <div>calendarItemId: {handoffPayload.calendarItemId}</div>
                  <div>calendarId: {handoffPayload.calendarId}</div>
                  <div>brandId: {handoffPayload.brandId}</div>
                  <div>
                    schedule: {handoffPayload.scheduledDate} · {handoffPayload.platform} ·{' '}
                    {handoffPayload.contentFormat}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Footer Buttons */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4">
            <div className="flex items-center gap-2">
              {mode === 'edit' && initialItem && onDuplicate && (
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => onDuplicate(initialItem)}
                  className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  <Copy className="h-3.5 w-3.5" strokeWidth={1.75} />
                  <span>Duplicate</span>
                </button>
              )}
              {mode === 'edit' && initialItem && onDelete && (
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => onDelete(initialItem)}
                  className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 disabled:opacity-50"
                >
                  <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                  <span>Delete</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={saving}
                onClick={onClose}
                className="inline-flex min-h-[40px] items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex min-h-[40px] items-center justify-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
              >
                {saving
                  ? 'Saving…'
                  : mode === 'create'
                    ? 'Add to Calendar'
                    : 'Save Changes'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
