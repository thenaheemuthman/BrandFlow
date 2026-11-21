import { useMemo, useState } from 'react';
import { CalendarDays, Sparkles, SlidersHorizontal } from 'lucide-react';
import type { ContentCalendarSettings } from '../../types/brand';
import {
  WEEKDAY_OPTIONS,
  buildDefaultCalendarName,
  buildDefaultCalendarSettings,
  computeEndDate,
  formatCalendarDisplayDate,
  planCalendarBatches,
  type ApprovedCalendarContext,
} from '../../utils/contentCalendarLogic';

interface ContentCalendarSetupPanelProps {
  brandName: string;
  approvedContext: ApprovedCalendarContext;
  generating: boolean;
  onGenerate: (name: string, settings: ContentCalendarSettings) => Promise<void>;
  onCreateBlank: (name: string, settings: ContentCalendarSettings) => Promise<void>;
  onCancel?: () => void;
}

export function ContentCalendarSetupPanel({
  brandName,
  approvedContext,
  generating,
  onGenerate,
  onCreateBlank,
  onCancel,
}: ContentCalendarSetupPanelProps) {
  const defaultSettings = useMemo(
    () => buildDefaultCalendarSettings(approvedContext),
    [approvedContext],
  );

  const [name, setName] = useState(() =>
    buildDefaultCalendarName(brandName, defaultSettings.startDate),
  );
  const [startDate, setStartDate] = useState(defaultSettings.startDate);
  const [durationDays, setDurationDays] = useState(defaultSettings.durationDays);
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(
    defaultSettings.selectedPlatforms,
  );
  const [postsPerWeek, setPostsPerWeek] = useState(defaultSettings.postsPerWeek);
  const [preferredPostingDays, setPreferredPostingDays] = useState<string[]>(
    defaultSettings.preferredPostingDays,
  );
  const [preferredPostingTime, setPreferredPostingTime] = useState(
    defaultSettings.preferredPostingTime,
  );
  const [campaignObjectiveFocus, setCampaignObjectiveFocus] = useState(
    defaultSettings.campaignObjectiveFocus,
  );
  const [contentMixPreference, setContentMixPreference] = useState(
    defaultSettings.contentMixPreference,
  );
  const [teamCapacityNote, setTeamCapacityNote] = useState('');
  const [specialDatesOrConstraints, setSpecialDatesOrConstraints] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const currentSettings: ContentCalendarSettings = useMemo(
    () => ({
      startDate,
      durationDays,
      selectedPlatforms,
      postsPerWeek,
      postingFrequencyLabel: `${postsPerWeek} posts per week across ${selectedPlatforms.length || 1} channel(s)`,
      preferredPostingDays,
      preferredPostingTime: preferredPostingTime.trim() || '09:00 AM',
      campaignObjectiveFocus: campaignObjectiveFocus.trim(),
      contentMixPreference: contentMixPreference.trim(),
      teamCapacityNote: teamCapacityNote.trim(),
      specialDatesOrConstraints: specialDatesOrConstraints.trim(),
    }),
    [
      startDate,
      durationDays,
      selectedPlatforms,
      postsPerWeek,
      preferredPostingDays,
      preferredPostingTime,
      campaignObjectiveFocus,
      contentMixPreference,
      teamCapacityNote,
      specialDatesOrConstraints,
    ],
  );

  const endDate = useMemo(
    () => computeEndDate(startDate, durationDays),
    [startDate, durationDays],
  );

  const plannedBatches = useMemo(
    () => planCalendarBatches(currentSettings),
    [currentSettings],
  );

  const totalPlannedItems = plannedBatches.reduce((sum, b) => sum + b.targetItemCount, 0);

  const togglePlatform = (platform: string) => {
    setSelectedPlatforms((prev) =>
      prev.includes(platform) ? prev.filter((p) => p !== platform) : [...prev, platform],
    );
    setValidationError(null);
  };

  const toggleDay = (day: string) => {
    setPreferredPostingDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day],
    );
  };

  const validateBeforeSubmit = (): boolean => {
    if (!name.trim() || name.trim().length < 2) {
      setValidationError('Enter a calendar name (at least 2 characters).');
      return false;
    }
    if (selectedPlatforms.length === 0) {
      setValidationError('Select at least one approved marketing channel.');
      return false;
    }
    setValidationError(null);
    return true;
  };

  const handleGenerateClick = async () => {
    if (generating || !validateBeforeSubmit()) return;
    await onGenerate(name.trim(), currentSettings);
  };

  const handleQuickDefaultsClick = async () => {
    if (generating) return;
    const quickSettings = buildDefaultCalendarSettings(approvedContext, startDate);
    if (quickSettings.selectedPlatforms.length === 0) {
      setValidationError('No approved marketing channels found in upstream strategy.');
      return;
    }
    const quickName = name.trim() || buildDefaultCalendarName(brandName, quickSettings.startDate);
    await onGenerate(quickName, quickSettings);
  };

  const handleCreateBlankClick = async () => {
    if (generating || !validateBeforeSubmit()) return;
    await onCreateBlank(name.trim(), currentSettings);
  };

  return (
    <section
      aria-label="Configure 30-Day Content Calendar"
      className="rounded-xl border border-slate-200 bg-white p-6"
    >
      <div className="flex flex-col justify-between gap-4 border-b border-slate-100 pb-5 sm:flex-row sm:items-start">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-indigo-600">
            New Publishing Roadmap
          </p>
          <h2 className="mt-1 text-lg font-semibold text-slate-900">
            Configure 30-Day Content Calendar
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Defaults are derived strictly from {brandName}’s approved Marketing Channels and Content
            Strategy. Adjust schedule preferences or generate right away.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            disabled={generating || approvedContext.approvedPlatforms.length === 0}
            onClick={handleQuickDefaultsClick}
            className="inline-flex min-h-[40px] items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50 whitespace-nowrap"
          >
            <Sparkles className="h-4 w-4" strokeWidth={1.75} />
            <span>Generate with Recommended Defaults</span>
          </button>
          {onCancel && (
            <button
              type="button"
              disabled={generating}
              onClick={onCancel}
              className="inline-flex min-h-[40px] items-center justify-center rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50 whitespace-nowrap"
            >
              Cancel
            </button>
          )}
        </div>
      </div>

      {validationError && (
        <div
          role="alert"
          className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          {validationError}
        </div>
      )}

      <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
        <div>
          <label htmlFor="cal-name" className="block text-sm font-medium text-slate-700">
            Calendar Name
          </label>
          <input
            id="cal-name"
            type="text"
            value={name}
            disabled={generating}
            onChange={(e) => {
              setName(e.target.value);
              setValidationError(null);
            }}
            placeholder="e.g., Dec 2026 30-Day Calendar"
            className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:bg-slate-50"
          />
        </div>

        <div>
          <label htmlFor="cal-start-date" className="block text-sm font-medium text-slate-700">
            Start Date
          </label>
          <input
            id="cal-start-date"
            type="date"
            value={startDate}
            disabled={generating}
            onChange={(e) => setStartDate(e.target.value)}
            className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm tabular-nums text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:bg-slate-50"
          />
          <p className="mt-1 text-xs tabular-nums text-slate-500">
            Covers {formatCalendarDisplayDate(startDate)} – {formatCalendarDisplayDate(endDate)}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="cal-duration" className="block text-sm font-medium text-slate-700">
              Duration (Days)
            </label>
            <select
              id="cal-duration"
              value={durationDays}
              disabled={generating}
              onChange={(e) => setDurationDays(Number(e.target.value))}
              className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm tabular-nums text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:bg-slate-50"
            >
              <option value={30}>30 Days</option>
              <option value={21}>21 Days</option>
              <option value={14}>14 Days</option>
              <option value={7}>7 Days</option>
            </select>
          </div>

          <div>
            <label htmlFor="cal-posts-week" className="block text-sm font-medium text-slate-700">
              Posts / Week
            </label>
            <select
              id="cal-posts-week"
              value={postsPerWeek}
              disabled={generating}
              onChange={(e) => setPostsPerWeek(Number(e.target.value))}
              className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm tabular-nums text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:bg-slate-50"
            >
              {[2, 3, 4, 5, 6, 7].map((count) => (
                <option key={count} value={count}>
                  {count} / week
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Approved Channels Selection */}
      <div className="mt-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <span className="text-sm font-medium text-slate-700">
            Approved Platforms ({selectedPlatforms.length} selected)
          </span>
          <span className="text-xs text-slate-500">
            Restricted strictly to channels approved in Marketing &amp; Content Strategy
          </span>
        </div>
        <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {approvedContext.approvedPlatforms.map((platform) => {
            const checked = selectedPlatforms.includes(platform);
            const hint = approvedContext.platformFrequencyHints[platform];
            return (
              <label
                key={platform}
                className={`flex cursor-pointer items-start gap-2.5 rounded-lg border px-3.5 py-2.5 text-sm transition-colors ${
                  checked
                    ? 'border-indigo-300 bg-indigo-50/50 text-slate-900'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={generating}
                  onChange={() => togglePlatform(platform)}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="min-w-0">
                  <span className="block font-medium text-slate-900">{platform}</span>
                  {hint && <span className="block text-xs text-slate-500">{hint}</span>}
                </span>
              </label>
            );
          })}
        </div>
      </div>

      {/* Preferred Days & Time */}
      <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-3">
        <div className="md:col-span-2">
          <span className="block text-sm font-medium text-slate-700">Preferred Publishing Days</span>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {WEEKDAY_OPTIONS.map((day) => {
              const active = preferredPostingDays.includes(day);
              return (
                <button
                  key={day}
                  type="button"
                  disabled={generating}
                  onClick={() => toggleDay(day)}
                  aria-pressed={active}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                    active
                      ? 'border-slate-900 bg-slate-900 text-white'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {day.slice(0, 3)}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label htmlFor="cal-pref-time" className="block text-sm font-medium text-slate-700">
            Preferred Publishing Time
          </label>
          <input
            id="cal-pref-time"
            type="text"
            value={preferredPostingTime}
            disabled={generating}
            onChange={(e) => setPreferredPostingTime(e.target.value)}
            placeholder="e.g., 09:00 AM"
            className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:bg-slate-50"
          />
        </div>
      </div>

      {/* Optional Strategic Focus & Constraints Toggle */}
      <div className="mt-5 border-t border-slate-100 pt-4">
        <button
          type="button"
          onClick={() => setShowAdvanced((v) => !v)}
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-700 hover:text-slate-900"
        >
          <SlidersHorizontal className="h-4 w-4 text-slate-500" strokeWidth={1.75} />
          <span>
            {showAdvanced
              ? 'Hide optional campaign focus & capacity constraints'
              : 'Optional: campaign focus, content mix, team capacity, special dates'}
          </span>
        </button>

        {showAdvanced && (
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label htmlFor="cal-focus" className="block text-sm font-medium text-slate-700">
                Campaign or Objective Focus
              </label>
              <input
                id="cal-focus"
                type="text"
                value={campaignObjectiveFocus}
                disabled={generating}
                onChange={(e) => setCampaignObjectiveFocus(e.target.value)}
                placeholder="e.g., Emphasize founder authority and demo conversions"
                className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>

            <div>
              <label htmlFor="cal-mix" className="block text-sm font-medium text-slate-700">
                Content Mix Preference
              </label>
              <input
                id="cal-mix"
                type="text"
                value={contentMixPreference}
                disabled={generating}
                onChange={(e) => setContentMixPreference(e.target.value)}
                placeholder="e.g., 50% educational, 30% authority, 20% conversion"
                className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>

            <div>
              <label htmlFor="cal-capacity" className="block text-sm font-medium text-slate-700">
                Team Capacity / Production Constraints
              </label>
              <input
                id="cal-capacity"
                type="text"
                value={teamCapacityNote}
                disabled={generating}
                onChange={(e) => setTeamCapacityNote(e.target.value)}
                placeholder="e.g., Solo founder — limit video shoots to once per week"
                className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>

            <div>
              <label htmlFor="cal-dates" className="block text-sm font-medium text-slate-700">
                Special Dates, Launches, or Blackout Windows
              </label>
              <input
                id="cal-dates"
                type="text"
                value={specialDatesOrConstraints}
                disabled={generating}
                onChange={(e) => setSpecialDatesOrConstraints(e.target.value)}
                placeholder="e.g., Skip public holiday on the 15th; Q4 webinar on the 22nd"
                className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>
          </div>
        )}
      </div>

      {/* Batch Execution Preview & Submit Actions */}
      <div className="mt-6 flex flex-col justify-between gap-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3.5 sm:flex-row sm:items-center">
        <div className="flex items-start gap-2.5 text-xs text-slate-600">
          <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" strokeWidth={1.75} />
          <div>
            <p className="font-medium text-slate-900 tabular-nums">
              {plannedBatches.length} weekly batches · ~{totalPlannedItems} structured planning entries
            </p>
            <p className="mt-0.5 text-slate-600">
              Generated week by week and persisted after each batch so progress is never lost.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            disabled={generating}
            onClick={handleCreateBlankClick}
            className="inline-flex min-h-[40px] items-center justify-center rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 whitespace-nowrap"
          >
            Create Empty Calendar
          </button>
          <button
            type="button"
            disabled={generating}
            onClick={handleGenerateClick}
            className="inline-flex min-h-[40px] items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 whitespace-nowrap"
          >
            <Sparkles className="h-4 w-4" strokeWidth={1.75} />
            <span>{generating ? 'Generating…' : 'Generate AI 30-Day Calendar'}</span>
          </button>
        </div>
      </div>
    </section>
  );
}
