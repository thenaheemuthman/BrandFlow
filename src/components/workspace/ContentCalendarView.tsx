import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  List,
  Plus,
  RefreshCw,
  Search,
  Square,
  Trash2,
  Columns3,
  LayoutGrid,
} from 'lucide-react';
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
  ContentCalendarWithItems,
  ContentStudioHandoffPayload,
  CreateContentCalendarItemInput,
  UpdateContentCalendarItemInput,
  WorkspaceSection,
} from '../../types/brand';
import { api } from '../../services/api';
import { executeBrandPrompt } from '../../services/promptExecution';
import { isClassifiedAiError } from '../../services/promptResponseParser';
import { isUserCancelledError } from '../../services/apiResilience';
import {
  CALENDAR_WORKFLOW_STATUSES,
  CONTENT_CALENDAR_STATUSES,
  applyCalendarBatchOutput,
  buildCalendarBatchVariables,
  buildDuplicateItemInput,
  buildUpstreamSnapshot,
  computeCalendarStats,
  computeEndDate,
  createInitialGenerationState,
  evaluateCalendarPrerequisites,
  extractApprovedCalendarContext,
  filterCalendarItems,
  formatCalendarDisplayDate,
  planCalendarBatches,
  updateBatchStateInGeneration,
} from '../../utils/contentCalendarLogic';
import { ContentCalendarSetupPanel } from './ContentCalendarSetupPanel';
import {
  ContentCalendarBoard,
  type CalendarBoardViewMode,
} from './ContentCalendarBoard';
import { ContentCalendarItemDrawer } from './ContentCalendarItemDrawer';
import { ConfirmDialog } from '../common/ConfirmDialog';

interface ContentCalendarViewProps {
  brand: Brand;
  onCalendarChanged: () => void | Promise<void>;
  onToast: (type: 'success' | 'error', message: string) => void;
  onNavigateToSection: (section: WorkspaceSection) => void;
  onOpenInContentStudio?: (payload: ContentStudioHandoffPayload) => void;
}

function classifyClientError(err: unknown): {
  message: string;
  category: AiErrorCategory;
} {
  if (isUserCancelledError(err)) {
    return {
      message: 'Calendar generation was cancelled. Completed weeks were saved.',
      category: 'request_cancelled',
    };
  }
  if (isClassifiedAiError(err)) {
    return {
      message: err.message,
      category: err.errorCategory,
    };
  }
  const message =
    err instanceof Error && err.message.trim()
      ? err.message.trim()
      : 'Unable to complete AI calendar generation. Please try again.';
  return {
    message,
    category: /timed?\s*out/i.test(message)
      ? 'request_timeout'
      : /network|connection|reach/i.test(message)
        ? 'network_failure'
        : 'provider_unavailable',
  };
}

export function ContentCalendarView({
  brand,
  onCalendarChanged,
  onToast,
  onNavigateToSection,
  onOpenInContentStudio,
}: ContentCalendarViewProps) {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [strategyModules, setStrategyModules] = useState<BrandStrategyModule[]>([]);
  const [calendars, setCalendars] = useState<ContentCalendar[]>([]);
  const [activeCalendar, setActiveCalendar] = useState<ContentCalendarWithItems | null>(null);
  const [loadingCalendarDetail, setLoadingCalendarDetail] = useState(false);

  const [showSetupPanel, setShowSetupPanel] = useState(false);
  const [viewMode, setViewMode] = useState<CalendarBoardViewMode>('monthly');

  // Filter state
  const [platformFilter, setPlatformFilter] = useState('all');
  const [pillarFilter, setPillarFilter] = useState('all');
  const [formatFilter, setFormatFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Generation & in-flight guards
  const [generating, setGenerating] = useState(false);
  const [activeBatchIndex, setActiveBatchIndex] = useState<number | null>(null);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const inFlightRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Item drawer & modals
  const [drawerState, setDrawerState] = useState<
    | { open: false }
    | { open: true; mode: 'create'; defaultDate: string }
    | { open: true; mode: 'edit'; item: ContentCalendarItem }
  >({ open: false });
  const [savingItem, setSavingItem] = useState(false);
  const [busyItemId, setBusyItemId] = useState<string | null>(null);
  const [itemToDelete, setItemToDelete] = useState<ContentCalendarItem | null>(null);
  const [calendarToDelete, setCalendarToDelete] = useState<ContentCalendar | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadCalendarDetail = useCallback(
    async (calendarId: string) => {
      setLoadingCalendarDetail(true);
      try {
        const { calendar } = await api.getContentCalendar(brand.id, calendarId);
        setActiveCalendar(calendar);
      } catch (err) {
        onToast(
          'error',
          err instanceof Error ? err.message : 'Failed to load content calendar details.',
        );
      } finally {
        setLoadingCalendarDetail(false);
      }
    },
    [brand.id, onToast],
  );

  const loadWorkspaceData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [modulesRes, calendarsRes] = await Promise.all([
        api.listStrategyModules(brand.id),
        api.listContentCalendars(brand.id),
      ]);
      const brandModules = modulesRes.modules.filter((m) => m.brandId === brand.id);
      const brandCalendars = calendarsRes.calendars.filter((c) => c.brandId === brand.id);
      setStrategyModules(brandModules);
      setCalendars(brandCalendars);

      if (brandCalendars.length > 0) {
        const { calendar } = await api.getContentCalendar(brand.id, brandCalendars[0].id);
        setActiveCalendar(calendar);
        setShowSetupPanel(false);
      } else {
        setActiveCalendar(null);
        setShowSetupPanel(true);
      }
    } catch (err) {
      setLoadError(
        err instanceof Error ? err.message : 'Failed to load Content Calendar workspace.',
      );
    } finally {
      setLoading(false);
    }
  }, [brand.id]);

  useEffect(() => {
    setActiveCalendar(null);
    setCalendars([]);
    setGenerationError(null);
    void loadWorkspaceData();
    return () => {
      abortControllerRef.current?.abort();
    };
  }, [brand.id, loadWorkspaceData]);

  const prerequisites = useMemo(
    () => evaluateCalendarPrerequisites(brand, strategyModules),
    [brand, strategyModules],
  );

  const approvedContext = useMemo(
    () => extractApprovedCalendarContext(brand, strategyModules),
    [brand, strategyModules],
  );

  const activeItems = activeCalendar?.items ?? [];

  const filteredItems = useMemo(
    () =>
      filterCalendarItems(activeItems, {
        platform: platformFilter,
        pillar: pillarFilter,
        format: formatFilter,
        status: statusFilter,
        query: searchQuery,
      }),
    [activeItems, platformFilter, pillarFilter, formatFilter, statusFilter, searchQuery],
  );

  const stats = useMemo(
    () => (activeCalendar ? computeCalendarStats(activeCalendar, activeItems) : null),
    [activeCalendar, activeItems],
  );

  const filterPlatformOptions = useMemo(() => {
    const set = new Set<string>(approvedContext.approvedPlatforms);
    for (const item of activeItems) if (item.platform) set.add(item.platform);
    return Array.from(set).sort();
  }, [approvedContext.approvedPlatforms, activeItems]);

  const filterPillarOptions = useMemo(() => {
    const set = new Set<string>(approvedContext.approvedPillars);
    for (const item of activeItems) if (item.contentPillar) set.add(item.contentPillar);
    return Array.from(set).sort();
  }, [approvedContext.approvedPillars, activeItems]);

  const filterFormatOptions = useMemo(() => {
    const set = new Set<string>(approvedContext.approvedFormats);
    for (const item of activeItems) if (item.contentFormat) set.add(item.contentFormat);
    return Array.from(set).sort();
  }, [approvedContext.approvedFormats, activeItems]);

  const hasActiveFilters =
    platformFilter !== 'all' ||
    pillarFilter !== 'all' ||
    formatFilter !== 'all' ||
    statusFilter !== 'all' ||
    searchQuery.trim().length > 0;

  const clearFilters = () => {
    setPlatformFilter('all');
    setPillarFilter('all');
    setFormatFilter('all');
    setStatusFilter('all');
    setSearchQuery('');
  };

  /**
   * Executes one or more pending/failed weekly batches sequentially for a calendar.
   * Persists each completed batch immediately so partial progress is never lost,
   * and NEVER marks a calendar `active` unless every batch succeeds.
   */
  const runWeeklyBatches = useCallback(
    async (
      calendarRecord: ContentCalendar,
      initialState: CalendarGenerationState,
      initialItems: ContentCalendarItem[],
      targetBatchIndices: number[],
    ) => {
      if (inFlightRef.current) return;
      inFlightRef.current = true;
      setGenerating(true);
      setGenerationError(null);

      const controller = new AbortController();
      abortControllerRef.current = controller;

      let workingCalendar: ContentCalendar = calendarRecord;
      let workingState: CalendarGenerationState = initialState;
      let workingItems: ContentCalendarItem[] = [...initialItems];
      let anyBatchFailed = false;
      let lastModelUsed: string | null = calendarRecord.model;
      let lastPromptVersion: string | null = calendarRecord.promptVersion;

      try {
        for (const batchIdx of targetBatchIndices) {
          if (controller.signal.aborted) break;

          const batch: CalendarBatchSegment | undefined = workingState.batches.find(
            (b) => b.batchIndex === batchIdx,
          );
          if (!batch) continue;

          setActiveBatchIndex(batchIdx);

          const runningUpdate = updateBatchStateInGeneration(workingState, batchIdx, {
            status: 'running',
            errorMessage: null,
            errorCategory: null,
          });
          workingState = runningUpdate.nextState;

          const runningCalRes = await api.updateContentCalendar(brand.id, workingCalendar.id, {
            status: 'generating',
            generationState: workingState,
          });
          workingCalendar = runningCalRes.calendar;
          setActiveCalendar({ ...workingCalendar, items: workingItems });
          setCalendars((prev) =>
            prev.map((c) => (c.id === workingCalendar.id ? workingCalendar : c)),
          );

          try {
            // Exclude items from the batch being regenerated so deduplication compares against other weeks only.
            const otherWeeksItems = workingItems.filter((item) => item.batchIndex !== batchIdx);
            const variables = buildCalendarBatchVariables(
              workingCalendar.settings,
              batch,
              otherWeeksItems,
            );

            const result = await executeBrandPrompt({
              brandId: brand.id,
              promptId: 'content_calendar_weekly_batch',
              includeApprovedModules: true,
              variables,
              signal: controller.signal,
            });

            if (result.status !== 'success') {
              const errMsg =
                result.status === 'missing_information'
                  ? result.message
                  : result.error || 'AI returned an invalid calendar batch response.';
              throw new Error(errMsg);
            }

            const applied = applyCalendarBatchOutput({
              result,
              batch,
              settings: workingCalendar.settings,
              approvedContext,
              existingItems: otherWeeksItems,
            });

            const savedRes = await api.saveCalendarBatchItems(
              brand.id,
              workingCalendar.id,
              applied.items,
              batchIdx,
            );

            workingItems = [...otherWeeksItems, ...savedRes.items].sort(
              (a, b) =>
                a.scheduledDate.localeCompare(b.scheduledDate) || a.sortOrder - b.sortOrder,
            );
            lastModelUsed = result.model;
            lastPromptVersion = result.promptVersion;

            const completedUpdate = updateBatchStateInGeneration(
              workingState,
              batchIdx,
              {
                status: 'completed',
                itemCount: savedRes.items.length,
                errorMessage: null,
                errorCategory: null,
                completedAt: new Date().toISOString(),
              },
              {
                suppliedFactsUsed: applied.suppliedFactsUsed,
                missingContextNotes: applied.missingContextNotes,
                researchCaveat: applied.researchCaveat,
                lastError: null,
                lastErrorCategory: null,
              },
            );
            workingState = completedUpdate.nextState;

            const savedCalRes = await api.updateContentCalendar(brand.id, workingCalendar.id, {
              status: completedUpdate.derivedCalendarStatus,
              generationState: workingState,
              promptId: 'content_calendar_weekly_batch',
              promptVersion: lastPromptVersion,
              model: lastModelUsed,
              generatedAt: new Date().toISOString(),
            });
            workingCalendar = savedCalRes.calendar;
            setActiveCalendar({ ...workingCalendar, items: workingItems });
            setCalendars((prev) =>
              prev.map((c) => (c.id === workingCalendar.id ? workingCalendar : c)),
            );
          } catch (batchErr) {
            anyBatchFailed = true;
            const classified = classifyClientError(batchErr);
            setGenerationError(`${batch.label}: ${classified.message}`);

            const failedUpdate = updateBatchStateInGeneration(
              workingState,
              batchIdx,
              {
                status: 'failed',
                errorMessage: classified.message,
                errorCategory: classified.category,
              },
              {
                lastError: `${batch.label}: ${classified.message}`,
                lastErrorCategory: classified.category,
              },
            );
            workingState = failedUpdate.nextState;

            try {
              const partialCalRes = await api.updateContentCalendar(brand.id, workingCalendar.id, {
                status: 'partial',
                generationState: workingState,
              });
              workingCalendar = partialCalRes.calendar;
              setActiveCalendar({ ...workingCalendar, items: workingItems });
              setCalendars((prev) =>
                prev.map((c) => (c.id === workingCalendar.id ? workingCalendar : c)),
              );
            } catch {
              // Keep local partial state visible even if status persistence fails.
            }

            if (classified.category === 'request_cancelled') {
              onToast('error', classified.message);
              break;
            }
            // Stop further batches on first failure so user can inspect and resume cleanly.
            onToast('error', `${batch.label} failed: ${classified.message}`);
            break;
          }
        }

        await onCalendarChanged();

        if (!anyBatchFailed && !controller.signal.aborted) {
          onToast(
            'success',
            `Generated ${workingItems.length} scheduled entries across ${workingState.totalBatches} weekly batches.`,
          );
        }
      } finally {
        inFlightRef.current = false;
        abortControllerRef.current = null;
        setGenerating(false);
        setActiveBatchIndex(null);
      }
    },
    [approvedContext, brand.id, onCalendarChanged, onToast],
  );

  const handleGenerateNewCalendar = async (
    name: string,
    settings: ContentCalendarSettings,
  ) => {
    if (inFlightRef.current) return;
    setGenerationError(null);
    try {
      const endDate = computeEndDate(settings.startDate, settings.durationDays);
      const batches = planCalendarBatches(settings);
      const initialState = createInitialGenerationState(batches);
      const snapshot = buildUpstreamSnapshot(brand, strategyModules, approvedContext);

      const { calendar } = await api.createContentCalendar(brand.id, {
        name,
        startDate: settings.startDate,
        endDate,
        durationDays: settings.durationDays,
        status: 'generating',
        settings,
        upstreamSnapshot: snapshot,
        generationState: initialState,
        promptId: 'content_calendar_weekly_batch',
      });

      setCalendars((prev) => [calendar, ...prev]);
      setActiveCalendar({ ...calendar, items: [] });
      setShowSetupPanel(false);
      clearFilters();

      await runWeeklyBatches(
        calendar,
        initialState,
        [],
        batches.map((b) => b.batchIndex),
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to initialize content calendar.';
      setGenerationError(msg);
      onToast('error', msg);
    }
  };

  const handleCreateBlankCalendar = async (
    name: string,
    settings: ContentCalendarSettings,
  ) => {
    if (inFlightRef.current) return;
    try {
      const endDate = computeEndDate(settings.startDate, settings.durationDays);
      const snapshot = buildUpstreamSnapshot(brand, strategyModules, approvedContext);
      const { calendar } = await api.createContentCalendar(brand.id, {
        name,
        startDate: settings.startDate,
        endDate,
        durationDays: settings.durationDays,
        status: 'draft',
        settings,
        upstreamSnapshot: snapshot,
      });
      setCalendars((prev) => [calendar, ...prev]);
      setActiveCalendar({ ...calendar, items: [] });
      setShowSetupPanel(false);
      clearFilters();
      await onCalendarChanged();
      onToast('success', `Created empty calendar "${calendar.name}".`);
    } catch (err) {
      onToast('error', err instanceof Error ? err.message : 'Failed to create calendar.');
    }
  };

  const handleResumeRemainingBatches = async () => {
    if (!activeCalendar || !activeCalendar.generationState || inFlightRef.current) return;
    const remaining = activeCalendar.generationState.batches
      .filter((b) => b.status !== 'completed')
      .map((b) => b.batchIndex);
    if (remaining.length === 0) return;

    await runWeeklyBatches(
      activeCalendar,
      activeCalendar.generationState,
      activeCalendar.items,
      remaining,
    );
  };

  const handleRetrySingleBatch = async (batchIndex: number) => {
    if (!activeCalendar || !activeCalendar.generationState || inFlightRef.current) return;
    await runWeeklyBatches(
      activeCalendar,
      activeCalendar.generationState,
      activeCalendar.items,
      [batchIndex],
    );
  };

  const handleCancelGeneration = () => {
    abortControllerRef.current?.abort();
  };

  const handleUpdateCalendarStatus = async (nextStatus: ContentCalendarStatus) => {
    if (!activeCalendar || generating) return;
    try {
      const { calendar } = await api.updateContentCalendar(brand.id, activeCalendar.id, {
        status: nextStatus,
      });
      setActiveCalendar((prev) => (prev ? { ...calendar, items: prev.items } : null));
      setCalendars((prev) => prev.map((c) => (c.id === calendar.id ? calendar : c)));
      await onCalendarChanged();
      onToast('success', `Calendar status updated to ${nextStatus}.`);
    } catch (err) {
      onToast('error', err instanceof Error ? err.message : 'Failed to update calendar status.');
    }
  };

  const handleConfirmDeleteCalendar = async () => {
    if (!calendarToDelete) return;
    setDeleting(true);
    try {
      const removedId = calendarToDelete.id;
      await api.deleteContentCalendar(brand.id, removedId);
      const remaining = calendars.filter((c) => c.id !== removedId);
      setCalendars(remaining);
      setCalendarToDelete(null);

      if (remaining.length > 0) {
        await loadCalendarDetail(remaining[0].id);
      } else {
        setActiveCalendar(null);
        setShowSetupPanel(true);
      }
      await onCalendarChanged();
      onToast('success', `Deleted calendar "${calendarToDelete.name}".`);
    } catch (err) {
      onToast('error', err instanceof Error ? err.message : 'Failed to delete calendar.');
    } finally {
      setDeleting(false);
    }
  };

  const handleSaveCreateItem = async (input: CreateContentCalendarItemInput) => {
    if (!activeCalendar) return;
    setSavingItem(true);
    try {
      const { item } = await api.createCalendarItem(brand.id, activeCalendar.id, input);
      setActiveCalendar((prev) =>
        prev
          ? {
              ...prev,
              items: [...prev.items, item].sort(
                (a, b) =>
                  a.scheduledDate.localeCompare(b.scheduledDate) || a.sortOrder - b.sortOrder,
              ),
            }
          : null,
      );
      setDrawerState({ open: false });
      onToast('success', `Added "${item.title}" to calendar.`);
    } catch (err) {
      onToast('error', err instanceof Error ? err.message : 'Failed to add calendar entry.');
    } finally {
      setSavingItem(false);
    }
  };

  const handleSaveUpdateItem = async (
    itemId: string,
    patch: UpdateContentCalendarItemInput,
  ) => {
    if (!activeCalendar) return;
    setSavingItem(true);
    try {
      const { item } = await api.updateCalendarItem(brand.id, activeCalendar.id, itemId, patch);
      setActiveCalendar((prev) =>
        prev
          ? {
              ...prev,
              items: prev.items
                .map((existing) => (existing.id === item.id ? item : existing))
                .sort(
                  (a, b) =>
                    a.scheduledDate.localeCompare(b.scheduledDate) || a.sortOrder - b.sortOrder,
                ),
            }
          : null,
      );
      setDrawerState({ open: false });
      onToast('success', `Saved changes to "${item.title}".`);
    } catch (err) {
      onToast('error', err instanceof Error ? err.message : 'Failed to save calendar entry.');
    } finally {
      setSavingItem(false);
    }
  };

  const handleQuickStatusUpdate = async (
    item: ContentCalendarItem,
    nextStatus: CalendarWorkflowStatus,
  ) => {
    if (!activeCalendar) return;
    setBusyItemId(item.id);
    try {
      const { item: updated } = await api.updateCalendarItem(
        brand.id,
        activeCalendar.id,
        item.id,
        { workflowStatus: nextStatus },
      );
      setActiveCalendar((prev) =>
        prev
          ? {
              ...prev,
              items: prev.items.map((existing) =>
                existing.id === updated.id ? updated : existing,
              ),
            }
          : null,
      );
    } catch (err) {
      onToast('error', err instanceof Error ? err.message : 'Failed to update status.');
    } finally {
      setBusyItemId(null);
    }
  };

  const handleDuplicateItem = async (item: ContentCalendarItem) => {
    if (!activeCalendar) return;
    setBusyItemId(item.id);
    try {
      const duplicateInput = buildDuplicateItemInput(item, activeCalendar.endDate);
      const { item: created } = await api.createCalendarItem(
        brand.id,
        activeCalendar.id,
        duplicateInput,
      );
      setActiveCalendar((prev) =>
        prev
          ? {
              ...prev,
              items: [...prev.items, created].sort(
                (a, b) =>
                  a.scheduledDate.localeCompare(b.scheduledDate) || a.sortOrder - b.sortOrder,
              ),
            }
          : null,
      );
      setDrawerState({ open: false });
      onToast('success', `Duplicated "${item.title}".`);
    } catch (err) {
      onToast('error', err instanceof Error ? err.message : 'Failed to duplicate entry.');
    } finally {
      setBusyItemId(null);
    }
  };

  const handleConfirmDeleteItem = async () => {
    if (!activeCalendar || !itemToDelete) return;
    setDeleting(true);
    try {
      await api.deleteCalendarItem(brand.id, activeCalendar.id, itemToDelete.id);
      setActiveCalendar((prev) =>
        prev
          ? {
              ...prev,
              items: prev.items.filter((existing) => existing.id !== itemToDelete.id),
            }
          : null,
      );
      if (drawerState.open && drawerState.mode === 'edit' && drawerState.item.id === itemToDelete.id) {
        setDrawerState({ open: false });
      }
      onToast('success', `Removed "${itemToDelete.title}".`);
      setItemToDelete(null);
    } catch (err) {
      onToast('error', err instanceof Error ? err.message : 'Failed to delete entry.');
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-600">
        Loading 30-Day Content Calendar for {brand.brandName}…
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6">
        <p className="text-sm font-semibold text-red-900">Unable to load Content Calendar</p>
        <p className="mt-1 text-sm text-red-800">{loadError}</p>
        <button
          type="button"
          onClick={() => void loadWorkspaceData()}
          className="mt-4 inline-flex min-h-[38px] items-center gap-2 rounded-lg bg-red-700 px-3.5 py-2 text-xs font-medium text-white hover:bg-red-800"
        >
          <RefreshCw className="h-3.5 w-3.5" strokeWidth={1.75} />
          <span>Retry</span>
        </button>
      </div>
    );
  }

  // Upstream Strategy Prerequisites Gate
  if (!prerequisites.ready) {
    return (
      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-amber-200 bg-amber-50 text-amber-700">
            <AlertCircle className="h-5 w-5" strokeWidth={1.75} />
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-amber-700">
              Upstream Strategy Required
            </p>
            <h2 className="mt-0.5 text-lg font-semibold text-slate-900">
              Complete Approved Strategy Before Generating a 30-Day Calendar
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              The Content Calendar consumes only approved strategy records for{' '}
              <span className="font-medium text-slate-900">{brand.brandName}</span>. Complete and
              approve the missing modules below so every scheduled slot is strategically grounded.
            </p>
          </div>
        </div>

        <div className="mt-6 divide-y divide-slate-100 rounded-lg border border-slate-200">
          {prerequisites.items.map((item) => (
            <div
              key={item.moduleKey}
              className="flex flex-col justify-between gap-3 px-4 py-3.5 sm:flex-row sm:items-center"
            >
              <div className="flex items-start gap-3">
                {item.met ? (
                  <CheckCircle2
                    className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600"
                    strokeWidth={2}
                  />
                ) : (
                  <AlertCircle
                    className="mt-0.5 h-4 w-4 shrink-0 text-amber-600"
                    strokeWidth={2}
                  />
                )}
                <div>
                  <p className="text-sm font-semibold text-slate-900">{item.label}</p>
                  <p className="mt-0.5 text-xs text-slate-600">{item.reason}</p>
                </div>
              </div>
              {!item.met && (
                <button
                  type="button"
                  onClick={() => onNavigateToSection(item.section)}
                  className="inline-flex min-h-[36px] items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-50 whitespace-nowrap shrink-0"
                >
                  <span>Open {item.label}</span>
                  <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.75} />
                </button>
              )}
            </div>
          ))}
        </div>
      </section>
    );
  }

  const genState = activeCalendar?.generationState ?? null;
  const incompleteBatches =
    genState?.batches.filter((b) => b.status !== 'completed') ?? [];

  return (
    <div className="space-y-6">
      {/* Top Toolbar: Calendar Switcher & Primary Actions */}
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span className="font-semibold uppercase tracking-wider text-indigo-600">
                30-Day Content Calendar
              </span>
              {activeCalendar && (
                <>
                  <span>·</span>
                  <span className="tabular-nums">
                    {formatCalendarDisplayDate(activeCalendar.startDate)} –{' '}
                    {formatCalendarDisplayDate(activeCalendar.endDate)}
                  </span>
                  <span>·</span>
                  <span className="capitalize">{activeCalendar.status}</span>
                </>
              )}
            </div>

            <div className="mt-1.5 flex flex-wrap items-center gap-3">
              {calendars.length > 0 ? (
                <select
                  aria-label="Select content calendar"
                  value={activeCalendar?.id ?? ''}
                  disabled={generating || loadingCalendarDetail}
                  onChange={(e) => {
                    const nextId = e.target.value;
                    setShowSetupPanel(false);
                    setGenerationError(null);
                    clearFilters();
                    void loadCalendarDetail(nextId);
                  }}
                  className="max-w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-900 focus:border-indigo-500 focus:outline-none"
                >
                  {calendars.map((cal) => (
                    <option key={cal.id} value={cal.id}>
                      {cal.name} ({cal.startDate})
                    </option>
                  ))}
                </select>
              ) : (
                <h2 className="text-lg font-semibold text-slate-900">
                  {brand.brandName} Publishing Roadmap
                </h2>
              )}

              {activeCalendar && (
                <select
                  aria-label="Calendar lifecycle status"
                  value={activeCalendar.status}
                  disabled={generating}
                  onChange={(e) =>
                    void handleUpdateCalendarStatus(e.target.value as ContentCalendarStatus)
                  }
                  className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-800 focus:border-indigo-500 focus:outline-none"
                >
                  {CONTENT_CALENDAR_STATUSES.map((st) => (
                    <option key={st.value} value={st.value}>
                      {st.label}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {activeCalendar && !showSetupPanel && (
              <button
                type="button"
                disabled={generating}
                onClick={() =>
                  setDrawerState({
                    open: true,
                    mode: 'create',
                    defaultDate: activeCalendar.startDate,
                  })
                }
                className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-50 whitespace-nowrap"
              >
                <Plus className="h-4 w-4" strokeWidth={1.75} />
                <span>Add Entry</span>
              </button>
            )}

            <button
              type="button"
              disabled={generating}
              onClick={() => setShowSetupPanel((prev) => !prev)}
              className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 whitespace-nowrap"
            >
              <CalendarDays className="h-4 w-4" strokeWidth={1.75} />
              <span>{showSetupPanel ? 'Back to Calendar' : 'New 30-Day Calendar'}</span>
            </button>

            {activeCalendar && !showSetupPanel && (
              <button
                type="button"
                disabled={generating}
                onClick={() => setCalendarToDelete(activeCalendar)}
                aria-label={`Delete calendar ${activeCalendar.name}`}
                className="inline-flex h-[38px] w-[38px] items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:border-red-200 hover:bg-red-50 hover:text-red-700 disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" strokeWidth={1.75} />
              </button>
            )}
          </div>
        </div>

        {/* Summary Metric Strip (Zero pill clutter, tabular numerals) */}
        {stats && !showSetupPanel && (
          <div className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-100 pt-4 sm:grid-cols-5">
            <div>
              <p className="text-xs text-slate-500">Scheduled Entries</p>
              <p className="mt-0.5 text-lg font-semibold tabular-nums text-slate-900">
                {stats.totalItems}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Days Covered</p>
              <p className="mt-0.5 text-lg font-semibold tabular-nums text-slate-900">
                {stats.coveredDays} / {stats.totalDays}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Planned</p>
              <p className="mt-0.5 text-lg font-semibold tabular-nums text-slate-900">
                {stats.byStatus.planned}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Review / Approved</p>
              <p className="mt-0.5 text-lg font-semibold tabular-nums text-slate-900">
                {stats.byStatus.ready_for_review + stats.byStatus.approved}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Published</p>
              <p className="mt-0.5 text-lg font-semibold tabular-nums text-slate-900">
                {stats.byStatus.published}
              </p>
            </div>
          </div>
        )}
      </section>

      {/* Setup Panel (New Calendar Configuration) */}
      {showSetupPanel && (
        <ContentCalendarSetupPanel
          brandName={brand.brandName}
          approvedContext={approvedContext}
          generating={generating}
          onGenerate={handleGenerateNewCalendar}
          onCreateBlank={handleCreateBlankCalendar}
          onCancel={activeCalendar ? () => setShowSetupPanel(false) : undefined}
        />
      )}

      {/* Batch Generation Progress & Safe Partial-Failure Recovery Banner */}
      {!showSetupPanel && activeCalendar && genState && (generating || incompleteBatches.length > 0 || generationError) && (
        <section
          aria-label="Weekly batch generation status"
          className={`rounded-xl border p-5 ${
            generationError || activeCalendar.status === 'partial'
              ? 'border-amber-200 bg-amber-50/60'
              : 'border-indigo-200 bg-indigo-50/40'
          }`}
        >
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <p className="text-sm font-semibold text-slate-900 tabular-nums">
                {generating
                  ? `Generating Weekly Batch ${(activeBatchIndex ?? 0) + 1} of ${genState.totalBatches}…`
                  : `Partial Calendar Saved (${genState.completedBatches} of ${genState.totalBatches} weeks complete)`}
              </p>
              <p className="mt-0.5 text-xs text-slate-600">
                {generationError ??
                  'Completed batches are safely persisted. Resume remaining batches without overwriting completed weeks.'}
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {generating ? (
                <button
                  type="button"
                  onClick={handleCancelGeneration}
                  className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-50"
                >
                  <Square className="h-3 w-3" strokeWidth={2} />
                  <span>Stop After Current</span>
                </button>
              ) : (
                incompleteBatches.length > 0 && (
                  <button
                    type="button"
                    onClick={() => void handleResumeRemainingBatches()}
                    className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-slate-800"
                  >
                    <RefreshCw className="h-3.5 w-3.5" strokeWidth={1.75} />
                    <span>Resume Failed Batches ({incompleteBatches.length})</span>
                  </button>
                )
              )}
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {genState.batches.map((batch) => (
              <div
                key={batch.batchIndex}
                className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs"
              >
                <div className="min-w-0">
                  <p className="truncate font-semibold text-slate-900">{batch.label}</p>
                  <p className="mt-0.5 capitalize text-slate-500 tabular-nums">
                    {batch.status}
                    {batch.status === 'completed' ? ` · ${batch.itemCount} entries` : ''}
                  </p>
                </div>
                {!generating && batch.status === 'failed' && (
                  <button
                    type="button"
                    onClick={() => void handleRetrySingleBatch(batch.batchIndex)}
                    className="text-xs font-medium text-indigo-600 hover:text-indigo-700 whitespace-nowrap"
                  >
                    Retry
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Active Calendar Controls + Board */}
      {!showSetupPanel && activeCalendar && (
        <>
          {/* Filter, Search & View Mode Toolbar */}
          <section className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              {/* View Mode Switcher */}
              <div
                role="tablist"
                aria-label="Calendar view mode"
                className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 self-start"
              >
                {(
                  [
                    { id: 'monthly', label: 'Monthly', icon: LayoutGrid },
                    { id: 'weekly', label: 'Weekly', icon: Columns3 },
                    { id: 'list', label: 'List', icon: List },
                  ] as const
                ).map(({ id, label, icon: Icon }) => {
                  const active = viewMode === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() => setViewMode(id)}
                      className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                        active
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
                      <span>{label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Search & Filter Selects */}
              <div className="flex flex-1 flex-wrap items-center gap-2 lg:justify-end">
                <div className="relative min-w-[180px] flex-1 sm:max-w-[240px]">
                  <Search
                    className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400"
                    strokeWidth={1.75}
                  />
                  <input
                    type="search"
                    aria-label="Search calendar entries"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search title, brief, theme…"
                    className="w-full rounded-lg border border-slate-200 bg-white py-1.5 pl-8 pr-3 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none"
                  />
                </div>

                <select
                  aria-label="Filter by platform"
                  value={platformFilter}
                  onChange={(e) => setPlatformFilter(e.target.value)}
                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 focus:border-indigo-500 focus:outline-none"
                >
                  <option value="all">All Platforms</option>
                  {filterPlatformOptions.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>

                <select
                  aria-label="Filter by content pillar"
                  value={pillarFilter}
                  onChange={(e) => setPillarFilter(e.target.value)}
                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 focus:border-indigo-500 focus:outline-none"
                >
                  <option value="all">All Pillars</option>
                  {filterPillarOptions.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>

                <select
                  aria-label="Filter by format"
                  value={formatFilter}
                  onChange={(e) => setFormatFilter(e.target.value)}
                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 focus:border-indigo-500 focus:outline-none"
                >
                  <option value="all">All Formats</option>
                  {filterFormatOptions.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>

                <select
                  aria-label="Filter by workflow status"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 focus:border-indigo-500 focus:outline-none"
                >
                  <option value="all">All Statuses</option>
                  {CALENDAR_WORKFLOW_STATUSES.map((st) => (
                    <option key={st.value} value={st.value}>
                      {st.label}
                    </option>
                  ))}
                </select>

                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="text-xs font-medium text-indigo-600 hover:text-indigo-700 whitespace-nowrap"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
          </section>

          {loadingCalendarDetail ? (
            <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-600">
              Loading scheduled entries…
            </div>
          ) : (
            <ContentCalendarBoard
              calendar={activeCalendar}
              items={filteredItems}
              viewMode={viewMode}
              busyItemId={busyItemId}
              onSelectItem={(item) => setDrawerState({ open: true, mode: 'edit', item })}
              onQuickAddForDate={(isoDate) =>
                setDrawerState({ open: true, mode: 'create', defaultDate: isoDate })
              }
              onUpdateStatus={handleQuickStatusUpdate}
              onDuplicateItem={handleDuplicateItem}
              onRequestDeleteItem={(item) => setItemToDelete(item)}
            />
          )}

          {/* Grounding & Research Caveat Footer */}
          {genState?.researchCaveat && (
            <p className="text-xs text-slate-500">{genState.researchCaveat}</p>
          )}
        </>
      )}

      {/* Create / Edit Item Drawer */}
      {drawerState.open && activeCalendar && (
        <ContentCalendarItemDrawer
          mode={drawerState.mode}
          brand={brand}
          calendar={activeCalendar}
          approvedContext={approvedContext}
          initialItem={drawerState.mode === 'edit' ? drawerState.item : null}
          defaultDate={drawerState.mode === 'create' ? drawerState.defaultDate : undefined}
          saving={savingItem}
          onSaveCreate={handleSaveCreateItem}
          onSaveUpdate={handleSaveUpdateItem}
          onDuplicate={handleDuplicateItem}
          onDelete={(item) => setItemToDelete(item)}
          onOpenInContentStudio={onOpenInContentStudio}
          onClose={() => setDrawerState({ open: false })}
        />
      )}

      {/* Delete Entry Confirmation */}
      <ConfirmDialog
        open={Boolean(itemToDelete)}
        title="Delete Calendar Entry"
        description={`Remove "${itemToDelete?.title ?? ''}" from this calendar? This action cannot be undone.`}
        confirmLabel="Delete Entry"
        variant="danger"
        busy={deleting}
        onConfirm={() => void handleConfirmDeleteItem()}
        onCancel={() => setItemToDelete(null)}
      />

      {/* Delete Calendar Confirmation */}
      <ConfirmDialog
        open={Boolean(calendarToDelete)}
        title="Delete Content Calendar"
        description={`Permanently delete "${calendarToDelete?.name ?? ''}" and all of its scheduled entries?`}
        confirmLabel="Delete Calendar"
        variant="danger"
        busy={deleting}
        onConfirm={() => void handleConfirmDeleteCalendar()}
        onCancel={() => setCalendarToDelete(null)}
      />
    </div>
  );
}
