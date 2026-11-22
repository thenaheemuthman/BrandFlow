import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  CalendarDays,
  FilePlus2,
  FolderOpen,
  PenTool,
  RefreshCw,
  Square,
  Sparkles,
} from 'lucide-react';
import type {
  AiErrorCategory,
  Brand,
  BrandStrategyModule,
  ContentAsset,
  ContentAssetBody,
  ContentAssetFormatCategory,
  ContentAssetStatus,
  ContentAssetVersion,
  ContentAssetWithVersions,
  ContentCalendarItem,
  ContentCalendarWithItems,
  ContentLengthPreference,
  ContentStudioGenerationOptions,
  ContentStudioHandoffPayload,
  ContentStudioRefinementAction,
  WorkspaceSection,
} from '../../types/brand';
import { api } from '../../services/api';
import { executeBrandPrompt } from '../../services/promptExecution';
import { isClassifiedAiError } from '../../services/promptResponseParser';
import { isUserCancelledError } from '../../services/apiResilience';
import { buildContentStudioHandoffPayload } from '../../utils/contentCalendarLogic';
import {
  CONTENT_ASSET_FORMAT_CATEGORIES,
  CONTENT_LENGTH_OPTIONS,
  applyStudioGenerateOutput,
  applyStudioRefineOutput,
  buildDefaultGenerationOptions,
  buildDuplicateAssetInput,
  buildStudioGenerateVariables,
  buildStudioRefineVariables,
  computeStudioStats,
  createEmptyAssetBody,
  extractStudioApprovedContext,
  getFormatCategoryLabel,
  validateContentStudioHandoffPayload,
} from '../../utils/contentStudioLogic';
import { ContentStudioEditor } from './ContentStudioEditor';
import { ContentStudioLibrary } from './ContentStudioLibrary';
import { ConfirmDialog } from '../common/ConfirmDialog';

interface ContentStudioViewProps {
  brand: Brand;
  initialHandoff?: ContentStudioHandoffPayload | null;
  onClearHandoff?: () => void;
  onStudioChanged: () => void | Promise<void>;
  onToast: (type: 'success' | 'error', message: string) => void;
  onNavigateToSection: (section: WorkspaceSection) => void;
}

type StudioTab = 'studio' | 'library';

function classifyStudioAiError(err: unknown): {
  message: string;
  category: AiErrorCategory;
} {
  if (isUserCancelledError(err)) {
    return {
      message: 'AI generation was cancelled. Your existing drafts remain untouched.',
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
      : 'Unable to complete AI content generation. Please try again.';
  return {
    message,
    category: /rate\s*limit|quota|429/i.test(message)
      ? 'rate_limited'
      : /timed?\s*out/i.test(message)
        ? 'request_timeout'
        : /network|connection|reach/i.test(message)
          ? 'network_failure'
          : 'provider_unavailable',
  };
}

export function ContentStudioView({
  brand,
  initialHandoff,
  onClearHandoff,
  onStudioChanged,
  onToast,
  onNavigateToSection,
}: ContentStudioViewProps) {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [strategyModules, setStrategyModules] = useState<BrandStrategyModule[]>([]);
  const [calendarWithItems, setCalendarWithItems] = useState<ContentCalendarWithItems | null>(null);
  const [assets, setAssets] = useState<ContentAsset[]>([]);
  const [activeAsset, setActiveAsset] = useState<ContentAssetWithVersions | null>(null);
  const [loadingAsset, setLoadingAsset] = useState(false);

  const [activeTab, setActiveTab] = useState<StudioTab>('studio');
  const [activeHandoff, setActiveHandoff] = useState<ContentStudioHandoffPayload | null>(null);
  const [showComposer, setShowComposer] = useState(true);

  const [options, setOptions] = useState<ContentStudioGenerationOptions>({
    platform: 'LinkedIn',
    formatCategory: 'social_post',
    formatLabel: 'Social Media Post',
    toneOfVoice: 'Clear, authoritative, and audience-focused',
    contentLength: 'medium',
    primaryObjective: 'Educate and build audience trust',
    targetAudience: 'Core target customers',
    ctaPreference: 'Invite thoughtful engagement or next step',
    additionalInstructions: '',
  });
  const [standaloneTitle, setStandaloneTitle] = useState('');

  // In-flight & mutation states
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [refining, setRefining] = useState(false);
  const [activeRefineAction, setActiveRefineAction] =
    useState<ContentStudioRefinementAction | null>(null);
  const [refineError, setRefineError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [busyAssetId, setBusyAssetId] = useState<string | null>(null);
  const [assetToDelete, setAssetToDelete] = useState<ContentAsset | null>(null);
  const [deleting, setDeleting] = useState(false);

  const inFlightRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const approvedContext = useMemo(
    () => extractStudioApprovedContext(brand, strategyModules),
    [brand, strategyModules],
  );

  const stats = useMemo(() => computeStudioStats(assets), [assets]);

  const calendarEntries = useMemo(() => {
    const items = calendarWithItems?.items ?? [];
    return items.filter((item) => item.workflowStatus !== 'skipped');
  }, [calendarWithItems]);

  const loadWorkspaceData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [modulesRes, calendarsRes, assetsRes] = await Promise.all([
        api.listStrategyModules(brand.id),
        api.listContentCalendars(brand.id),
        api.listContentAssets(brand.id),
      ]);

      const brandModules = modulesRes.modules.filter((m) => m.brandId === brand.id);
      const brandCalendars = calendarsRes.calendars.filter((c) => c.brandId === brand.id);
      const brandAssets = assetsRes.assets.filter((a) => a.brandId === brand.id);

      setStrategyModules(brandModules);
      setAssets(brandAssets);

      let loadedCal: ContentCalendarWithItems | null = null;
      if (brandCalendars.length > 0) {
        const { calendar } = await api.getContentCalendar(brand.id, brandCalendars[0].id);
        loadedCal = calendar;
      }
      setCalendarWithItems(loadedCal);

      const ctx = extractStudioApprovedContext(brand, brandModules);

      // Validate and apply incoming handoff payload from Content Calendar
      if (initialHandoff) {
        const check = validateContentStudioHandoffPayload(initialHandoff, brand.id);
        if (check.valid && check.payload) {
          setActiveHandoff(check.payload);
          setOptions(buildDefaultGenerationOptions(ctx, check.payload));
          setStandaloneTitle(check.payload.title);
          setActiveAsset(null);
          setShowComposer(true);
          setActiveTab('studio');
        } else {
          onToast('error', check.error ?? 'Rejected invalid calendar handoff payload.');
          onClearHandoff?.();
        }
      } else {
        setOptions(buildDefaultGenerationOptions(ctx, null));
        if (brandAssets.length > 0) {
          const { asset } = await api.getContentAsset(brand.id, brandAssets[0].id);
          setActiveAsset(asset);
          setShowComposer(false);
        } else {
          setActiveAsset(null);
          setShowComposer(true);
        }
      }
    } catch (err) {
      setLoadError(
        err instanceof Error ? err.message : 'Failed to load Content Studio workspace.',
      );
    } finally {
      setLoading(false);
    }
  }, [brand, initialHandoff, onClearHandoff, onToast]);

  useEffect(() => {
    setActiveAsset(null);
    setAssets([]);
    setGenerateError(null);
    setRefineError(null);
    void loadWorkspaceData();
    return () => {
      abortControllerRef.current?.abort();
    };
  }, [brand.id, loadWorkspaceData]);

  const handleSelectCalendarItem = (itemId: string) => {
    if (!itemId) {
      setActiveHandoff(null);
      setOptions(buildDefaultGenerationOptions(approvedContext, null));
      setStandaloneTitle('');
      onClearHandoff?.();
      return;
    }
    if (!calendarWithItems) return;
    const item: ContentCalendarItem | undefined = calendarWithItems.items.find(
      (ci) => ci.id === itemId,
    );
    if (!item) return;
    const handoff = buildContentStudioHandoffPayload(brand, calendarWithItems, item);
    setActiveHandoff(handoff);
    setOptions(buildDefaultGenerationOptions(approvedContext, handoff));
    setStandaloneTitle(handoff.title);
  };

  const handleOpenAsset = async (assetId: string) => {
    setLoadingAsset(true);
    setRefineError(null);
    try {
      const { asset } = await api.getContentAsset(brand.id, assetId);
      setActiveAsset(asset);
      setShowComposer(false);
      setActiveTab('studio');
    } catch (err) {
      onToast(
        'error',
        err instanceof Error ? err.message : 'Failed to open content asset.',
      );
    } finally {
      setLoadingAsset(false);
    }
  };

  const handleStartNewDraft = () => {
    setActiveAsset(null);
    setActiveHandoff(null);
    setStandaloneTitle('');
    setOptions(buildDefaultGenerationOptions(approvedContext, null));
    setGenerateError(null);
    setShowComposer(true);
    setActiveTab('studio');
    onClearHandoff?.();
  };

  const handleGenerateWithAi = async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setGenerating(true);
    setGenerateError(null);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const variables = buildStudioGenerateVariables(options, activeHandoff);
      const result = await executeBrandPrompt({
        brandId: brand.id,
        promptId: 'content_studio_generate_asset',
        variables,
        includeApprovedModules: true,
        signal: controller.signal,
      });

      if (result.status !== 'success') {
        const msg =
          result.status === 'missing_information'
            ? result.message
            : result.error || 'AI generation did not return valid structured content.';
        setGenerateError(msg);
        return;
      }

      const normalized = applyStudioGenerateOutput(result.output, options, activeHandoff);
      const createdTitle = standaloneTitle.trim() || normalized.title;

      const { asset } = await api.createContentAsset(brand.id, {
        calendarId: activeHandoff?.calendarId ?? null,
        calendarItemId: activeHandoff?.calendarItemId ?? null,
        title: createdTitle,
        platform: options.platform,
        formatCategory: options.formatCategory,
        formatLabel: options.formatLabel || getFormatCategoryLabel(options.formatCategory),
        contentPillar: activeHandoff?.contentPillar ?? '',
        contentTheme: activeHandoff?.contentTheme ?? '',
        targetAudience: options.targetAudience,
        contentObjective: options.primaryObjective,
        toneOfVoice: options.toneOfVoice,
        contentLength: options.contentLength,
        scheduledDate: activeHandoff?.scheduledDate ?? null,
        workflowStatus: 'draft',
        source: 'ai_generated',
        body: normalized.body,
        generationOptions: options,
        handoffSnapshot: activeHandoff,
        changeSummary: activeHandoff
          ? `Generated AI draft from calendar entry "${activeHandoff.title}"`
          : 'Generated standalone AI draft',
        actionType: 'ai_generate',
        promptId: result.metadata.promptId,
        promptVersion: result.metadata.promptVersion,
        model: result.metadata.model,
        generatedAt: result.metadata.generatedAt,
      });

      setAssets((prev) => [asset, ...prev.filter((a) => a.id !== asset.id)]);
      setActiveAsset(asset);
      setShowComposer(false);
      onClearHandoff?.();
      await onStudioChanged();
      onToast('success', 'Generated draft saved to Content Studio (awaiting your review).');
    } catch (err) {
      const classified = classifyStudioAiError(err);
      setGenerateError(classified.message);
    } finally {
      inFlightRef.current = false;
      abortControllerRef.current = null;
      setGenerating(false);
    }
  };

  const handleCreateManualBlankDraft = async () => {
    if (saving || generating) return;
    setSaving(true);
    setGenerateError(null);
    try {
      const fallbackTitle =
        standaloneTitle.trim() ||
        activeHandoff?.title ||
        `${options.platform} ${getFormatCategoryLabel(options.formatCategory)}`;

      const initialBody = createEmptyAssetBody();
      if (activeHandoff) {
        initialBody.hook = activeHandoff.suggestedAngle || '';
        initialBody.mainCopy = activeHandoff.coreMessage || '';
        initialBody.cta = activeHandoff.intendedCta || options.ctaPreference;
      }
      if (options.formatCategory === 'carousel') {
        initialBody.carouselSlides = [
          { slideNumber: 1, headline: 'Cover Hook', body: '', visualCue: '' },
          { slideNumber: 2, headline: 'Key Takeaway', body: '', visualCue: '' },
          { slideNumber: 3, headline: 'Closing CTA', body: initialBody.cta, visualCue: '' },
        ];
      } else if (options.formatCategory === 'short_video_script') {
        initialBody.videoScript = {
          hook: initialBody.hook,
          scenes: [{ sceneNumber: 1, visual: '', dialogue: '', durationHint: '5s' }],
          cta: initialBody.cta,
        };
      } else if (options.formatCategory === 'long_form_article') {
        initialBody.articleSections = [{ heading: 'Key Insight', body: '' }];
      }

      const { asset } = await api.createContentAsset(brand.id, {
        calendarId: activeHandoff?.calendarId ?? null,
        calendarItemId: activeHandoff?.calendarItemId ?? null,
        title: fallbackTitle,
        platform: options.platform,
        formatCategory: options.formatCategory,
        formatLabel: options.formatLabel || getFormatCategoryLabel(options.formatCategory),
        contentPillar: activeHandoff?.contentPillar ?? '',
        contentTheme: activeHandoff?.contentTheme ?? '',
        targetAudience: options.targetAudience,
        contentObjective: options.primaryObjective,
        toneOfVoice: options.toneOfVoice,
        contentLength: options.contentLength,
        scheduledDate: activeHandoff?.scheduledDate ?? null,
        workflowStatus: 'draft',
        source: 'manual',
        body: initialBody,
        generationOptions: options,
        handoffSnapshot: activeHandoff,
        changeSummary: 'Created manual draft',
        actionType: 'manual_create',
      });

      setAssets((prev) => [asset, ...prev.filter((a) => a.id !== asset.id)]);
      setActiveAsset(asset);
      setShowComposer(false);
      onClearHandoff?.();
      await onStudioChanged();
      onToast('success', 'Blank draft created and opened in editor.');
    } catch (err) {
      setGenerateError(err instanceof Error ? err.message : 'Failed to create draft.');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveDraft = async (
    nextTitle: string,
    nextBody: ContentAssetBody,
    saveOptions?: { createVersion?: boolean; changeSummary?: string },
  ) => {
    if (!activeAsset || saving) return;
    setSaving(true);
    try {
      const { asset } = await api.updateContentAsset(brand.id, activeAsset.id, {
        title: nextTitle,
        body: nextBody,
        createVersion: saveOptions?.createVersion,
        changeSummary: saveOptions?.changeSummary,
        actionType: saveOptions?.createVersion ? 'manual_snapshot' : 'manual_edit',
      });
      setActiveAsset(asset);
      setAssets((prev) => prev.map((a) => (a.id === asset.id ? asset : a)));
      await onStudioChanged();
      onToast(
        'success',
        saveOptions?.createVersion
          ? `Saved Version ${asset.currentVersionNumber}.`
          : 'Draft changes saved.',
      );
    } catch (err) {
      onToast('error', err instanceof Error ? err.message : 'Failed to save draft.');
    } finally {
      setSaving(false);
    }
  };

  const handleChangeStatus = async (nextStatus: ContentAssetStatus) => {
    if (!activeAsset || saving) return;
    setSaving(true);
    try {
      const { asset } = await api.updateContentAsset(brand.id, activeAsset.id, {
        workflowStatus: nextStatus,
      });
      setActiveAsset(asset);
      setAssets((prev) => prev.map((a) => (a.id === asset.id ? asset : a)));
      await onStudioChanged();
      onToast('success', `Asset status updated to ${nextStatus.replace(/_/g, ' ')}.`);
    } catch (err) {
      onToast('error', err instanceof Error ? err.message : 'Failed to update status.');
    } finally {
      setSaving(false);
    }
  };

  const handleRefineWithAi = async (
    action: ContentStudioRefinementAction,
    draftSnapshot: { title: string; body: ContentAssetBody },
    params?: {
      targetPlatform?: string;
      targetTone?: string;
      instructions?: string;
      selectedSectionText?: string;
    },
  ) => {
    if (!activeAsset || inFlightRef.current) return;
    inFlightRef.current = true;
    setRefining(true);
    setActiveRefineAction(action);
    setRefineError(null);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const variables = buildStudioRefineVariables(
        {
          ...activeAsset,
          title: draftSnapshot.title,
          body: draftSnapshot.body,
        },
        action,
        params,
      );

      const result = await executeBrandPrompt({
        brandId: brand.id,
        promptId: 'content_studio_refine_asset',
        variables,
        includeApprovedModules: true,
        signal: controller.signal,
      });

      if (result.status !== 'success') {
        const msg =
          result.status === 'missing_information'
            ? result.message
            : result.error || 'AI refinement failed structured output validation.';
        setRefineError(msg);
        return;
      }

      const refined = applyStudioRefineOutput(
        draftSnapshot.title,
        draftSnapshot.body,
        result.output,
        action,
      );

      const { asset } = await api.createContentAssetVersion(brand.id, activeAsset.id, {
        title: refined.title,
        body: refined.body,
        changeSummary: refined.changeSummary,
        actionType: `ai_${action}`,
        source: 'edited_ai',
        promptId: result.metadata.promptId,
        promptVersion: result.metadata.promptVersion,
        model: result.metadata.model,
        generatedAt: result.metadata.generatedAt,
      });

      setActiveAsset(asset);
      setAssets((prev) => prev.map((a) => (a.id === asset.id ? asset : a)));
      await onStudioChanged();
      onToast('success', `${refined.changeSummary} (saved as Version ${asset.currentVersionNumber}).`);
    } catch (err) {
      const classified = classifyStudioAiError(err);
      setRefineError(classified.message);
    } finally {
      inFlightRef.current = false;
      abortControllerRef.current = null;
      setRefining(false);
      setActiveRefineAction(null);
    }
  };

  const handleRestoreVersion = async (version: ContentAssetVersion) => {
    if (!activeAsset || saving) return;
    setSaving(true);
    try {
      const { asset } = await api.createContentAssetVersion(brand.id, activeAsset.id, {
        title: version.title,
        body: version.body,
        changeSummary: `Restored content from Version ${version.versionNumber}`,
        actionType: 'restore_version',
        source: version.source,
      });
      setActiveAsset(asset);
      setAssets((prev) => prev.map((a) => (a.id === asset.id ? asset : a)));
      await onStudioChanged();
      onToast('success', `Restored v${version.versionNumber} as new Version ${asset.currentVersionNumber}.`);
    } catch (err) {
      onToast('error', err instanceof Error ? err.message : 'Failed to restore version.');
    } finally {
      setSaving(false);
    }
  };

  const handleDuplicateAsset = async (asset: ContentAsset) => {
    setBusyAssetId(asset.id);
    try {
      const dupInput = buildDuplicateAssetInput(asset);
      const { asset: created } = await api.createContentAsset(brand.id, dupInput);
      setAssets((prev) => [created, ...prev]);
      setActiveAsset(created);
      setShowComposer(false);
      setActiveTab('studio');
      await onStudioChanged();
      onToast('success', `Duplicated "${asset.title}" as a new draft.`);
    } catch (err) {
      onToast('error', err instanceof Error ? err.message : 'Failed to duplicate asset.');
    } finally {
      setBusyAssetId(null);
    }
  };

  const handleToggleArchive = async (asset: ContentAsset) => {
    setBusyAssetId(asset.id);
    try {
      const nextStatus: ContentAssetStatus =
        asset.workflowStatus === 'archived' ? 'draft' : 'archived';
      const { asset: updated } = await api.updateContentAsset(brand.id, asset.id, {
        workflowStatus: nextStatus,
      });
      setAssets((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
      if (activeAsset?.id === updated.id) {
        setActiveAsset(updated);
      }
      await onStudioChanged();
      onToast(
        'success',
        nextStatus === 'archived' ? 'Asset archived.' : 'Asset restored to Draft.',
      );
    } catch (err) {
      onToast('error', err instanceof Error ? err.message : 'Failed to update archive state.');
    } finally {
      setBusyAssetId(null);
    }
  };

  const handleConfirmDelete = async () => {
    if (!assetToDelete) return;
    setDeleting(true);
    try {
      await api.deleteContentAsset(brand.id, assetToDelete.id);
      const remaining = assets.filter((a) => a.id !== assetToDelete.id);
      setAssets(remaining);
      if (activeAsset?.id === assetToDelete.id) {
        setActiveAsset(null);
        setShowComposer(true);
      }
      setAssetToDelete(null);
      await onStudioChanged();
      onToast('success', 'Content asset deleted.');
    } catch (err) {
      onToast('error', err instanceof Error ? err.message : 'Failed to delete asset.');
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-24 rounded-xl border border-slate-200 bg-white animate-pulse" />
        <div className="h-64 rounded-xl border border-slate-200 bg-white animate-pulse" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 space-y-3">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" strokeWidth={1.75} />
          <div>
            <h3 className="text-sm font-semibold text-rose-900">
              Unable to load Content Studio
            </h3>
            <p className="mt-1 text-sm text-rose-800">{loadError}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void loadWorkspaceData()}
          className="inline-flex min-h-[40px] items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          <RefreshCw className="h-4 w-4" strokeWidth={1.75} />
          <span>Retry</span>
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header & View Switcher */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">
            Content Studio
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Turn approved {brand.brandName} calendar entries and strategy briefs into complete, editable, platform-ready content assets.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => setActiveTab('studio')}
              className={`inline-flex min-h-[36px] items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                activeTab === 'studio'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <PenTool className="h-3.5 w-3.5" strokeWidth={1.75} />
              <span>Studio Editor</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('library')}
              className={`inline-flex min-h-[36px] items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                activeTab === 'library'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FolderOpen className="h-3.5 w-3.5" strokeWidth={1.75} />
              <span className="tabular-nums">Asset Library ({assets.length})</span>
            </button>
          </div>

          <button
            type="button"
            onClick={handleStartNewDraft}
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-medium text-white hover:bg-blue-700 whitespace-nowrap shrink-0"
          >
            <FilePlus2 className="h-3.5 w-3.5" strokeWidth={1.75} />
            <span>New Content Asset</span>
          </button>
        </div>
      </div>

      {/* Metrics Strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
          <p className="text-xs text-slate-500">Total Assets</p>
          <p className="mt-1 text-xl font-semibold text-slate-900 tabular-nums">{stats.total}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
          <p className="text-xs text-slate-500">Draft / In Progress</p>
          <p className="mt-1 text-xl font-semibold text-slate-900 tabular-nums">
            {stats.draft + stats.inProgress}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
          <p className="text-xs text-slate-500">Ready for Review</p>
          <p className="mt-1 text-xl font-semibold text-amber-700 tabular-nums">
            {stats.readyForReview}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
          <p className="text-xs text-slate-500">Approved</p>
          <p className="mt-1 text-xl font-semibold text-emerald-700 tabular-nums">
            {stats.approved}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 col-span-2 sm:col-span-1">
          <p className="text-xs text-slate-500">Published</p>
          <p className="mt-1 text-xl font-semibold text-slate-900 tabular-nums">
            {stats.published}
          </p>
        </div>
      </div>

      {/* Upstream Context Transparency Notice */}
      {approvedContext.missingUpstreamModules.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <span>
            Strategic grounding active for {brand.brandName}. Optional upstream modules not yet approved:{' '}
            <strong className="text-slate-800">
              {approvedContext.missingUpstreamModules.join(', ')}
            </strong>
            .
          </span>
          <button
            type="button"
            onClick={() => onNavigateToSection('content-calendar')}
            className="font-medium text-blue-700 hover:underline whitespace-nowrap shrink-0 self-start sm:self-auto"
          >
            Open 30-Day Calendar
          </button>
        </div>
      )}

      {activeTab === 'library' ? (
        <ContentStudioLibrary
          assets={assets}
          activeAssetId={activeAsset?.id ?? null}
          busyAssetId={busyAssetId}
          onOpenAsset={(id) => void handleOpenAsset(id)}
          onDuplicateAsset={handleDuplicateAsset}
          onToggleArchive={handleToggleArchive}
          onRequestDeleteAsset={setAssetToDelete}
          onCreateNewDraft={handleStartNewDraft}
        />
      ) : (
        <div className="space-y-6">
          {/* Quick Asset Switcher when editing existing assets */}
          {assets.length > 0 && !showComposer && (
            <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <label
                  htmlFor="studio-active-asset-select"
                  className="text-xs font-medium text-slate-500 whitespace-nowrap"
                >
                  Active asset
                </label>
                <select
                  id="studio-active-asset-select"
                  value={activeAsset?.id ?? ''}
                  onChange={(e) => {
                    if (e.target.value) void handleOpenAsset(e.target.value);
                  }}
                  className="min-h-[38px] max-w-full sm:max-w-md rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-800 focus:border-blue-600 focus:outline-none truncate"
                >
                  {assets.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.title} ({a.platform} · v{a.currentVersionNumber})
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                onClick={() => setShowComposer(true)}
                className="inline-flex min-h-[36px] items-center gap-1.5 text-xs font-medium text-blue-700 hover:underline whitespace-nowrap shrink-0"
              >
                <Sparkles className="h-3.5 w-3.5" strokeWidth={1.75} />
                <span>Generate Another Asset</span>
              </button>
            </div>
          )}

          {/* Generation Configuration Panel */}
          {showComposer && (
            <div className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6 space-y-5">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-base font-semibold text-slate-900">
                    Create Content Asset
                  </h3>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Start from a 30-Day Content Calendar entry or configure a standalone brief grounded in {brand.brandName} strategy.
                  </p>
                </div>
                {activeAsset && (
                  <button
                    type="button"
                    onClick={() => setShowComposer(false)}
                    className="text-xs font-medium text-slate-600 hover:text-slate-900 self-start sm:self-auto"
                  >
                    Return to Active Editor
                  </button>
                )}
              </div>

              {/* Calendar Entry Selector / Handoff Brief */}
              <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-4 space-y-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <label
                    htmlFor="studio-calendar-entry-select"
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700"
                  >
                    <CalendarDays className="h-3.5 w-3.5 text-blue-600" strokeWidth={1.75} />
                    <span>Source Content Calendar Entry (optional)</span>
                  </label>
                  {activeHandoff && (
                    <button
                      type="button"
                      onClick={() => handleSelectCalendarItem('')}
                      className="text-xs font-medium text-slate-600 hover:text-slate-900 self-start sm:self-auto"
                    >
                      Clear Calendar Link
                    </button>
                  )}
                </div>

                <select
                  id="studio-calendar-entry-select"
                  value={activeHandoff?.calendarItemId ?? ''}
                  onChange={(e) => handleSelectCalendarItem(e.target.value)}
                  className="w-full min-h-[40px] rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-600 focus:outline-none"
                >
                  <option value="">Standalone Brief (not linked to a calendar entry)</option>
                  {calendarEntries.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.scheduledDate} · {item.platform} · {item.title} ({item.workflowStatus.replace(/_/g, ' ')})
                    </option>
                  ))}
                </select>

                {activeHandoff && (
                  <div className="grid grid-cols-1 gap-2 pt-1 text-xs text-slate-600 sm:grid-cols-2">
                    <div>
                      <span className="font-semibold text-slate-700">Pillar & Theme: </span>
                      <span>
                        {activeHandoff.contentPillar || 'Not set'}
                        {activeHandoff.contentTheme ? ` · ${activeHandoff.contentTheme}` : ''}
                      </span>
                    </div>
                    <div>
                      <span className="font-semibold text-slate-700">Audience Pain Point: </span>
                      <span>{activeHandoff.audiencePainPoint || 'From approved personas'}</span>
                    </div>
                    <div className="sm:col-span-2">
                      <span className="font-semibold text-slate-700">Core Message: </span>
                      <span>{activeHandoff.coreMessage || 'From approved brand messaging'}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Generation Options Form */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                <div className="md:col-span-2 lg:col-span-3">
                  <label
                    htmlFor="studio-draft-title"
                    className="block text-xs font-semibold text-slate-700 mb-1.5"
                  >
                    Working Title / Topic Focus (optional — AI will refine if blank)
                  </label>
                  <input
                    id="studio-draft-title"
                    type="text"
                    value={standaloneTitle}
                    onChange={(e) => setStandaloneTitle(e.target.value)}
                    placeholder="e.g., 5 Positioning Mistakes B2B Teams Make Before Scaling Content"
                    className="w-full min-h-[40px] rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label
                    htmlFor="studio-opt-platform"
                    className="block text-xs font-semibold text-slate-700 mb-1.5"
                  >
                    Target Platform
                  </label>
                  <select
                    id="studio-opt-platform"
                    value={options.platform}
                    onChange={(e) =>
                      setOptions((prev) => ({ ...prev, platform: e.target.value }))
                    }
                    className="w-full min-h-[40px] rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-600 focus:outline-none"
                  >
                    {Array.from(
                      new Set([
                        options.platform,
                        ...approvedContext.approvedPlatforms,
                        'LinkedIn',
                        'Instagram',
                        'X / Twitter',
                        'TikTok',
                        'YouTube Shorts',
                        'Blog / Website',
                        'Email Newsletter',
                      ]),
                    )
                      .filter(Boolean)
                      .map((plat) => (
                        <option key={plat} value={plat}>
                          {plat}
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="studio-opt-format"
                    className="block text-xs font-semibold text-slate-700 mb-1.5"
                  >
                    Content Asset Format
                  </label>
                  <select
                    id="studio-opt-format"
                    value={options.formatCategory}
                    onChange={(e) => {
                      const nextCat = e.target.value as ContentAssetFormatCategory;
                      setOptions((prev) => ({
                        ...prev,
                        formatCategory: nextCat,
                        formatLabel: getFormatCategoryLabel(nextCat),
                      }));
                    }}
                    className="w-full min-h-[40px] rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-600 focus:outline-none"
                  >
                    {CONTENT_ASSET_FORMAT_CATEGORIES.map((fmt) => (
                      <option key={fmt.value} value={fmt.value}>
                        {fmt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="studio-opt-length"
                    className="block text-xs font-semibold text-slate-700 mb-1.5"
                  >
                    Length Preference
                  </label>
                  <select
                    id="studio-opt-length"
                    value={options.contentLength}
                    onChange={(e) =>
                      setOptions((prev) => ({
                        ...prev,
                        contentLength: e.target.value as ContentLengthPreference,
                      }))
                    }
                    className="w-full min-h-[40px] rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-600 focus:outline-none"
                  >
                    {CONTENT_LENGTH_OPTIONS.map((len) => (
                      <option key={len.value} value={len.value}>
                        {len.label} — {len.hint}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="studio-opt-tone"
                    className="block text-xs font-semibold text-slate-700 mb-1.5"
                  >
                    Tone / Writing Style
                  </label>
                  <input
                    id="studio-opt-tone"
                    type="text"
                    value={options.toneOfVoice}
                    onChange={(e) =>
                      setOptions((prev) => ({ ...prev, toneOfVoice: e.target.value }))
                    }
                    className="w-full min-h-[40px] rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label
                    htmlFor="studio-opt-audience"
                    className="block text-xs font-semibold text-slate-700 mb-1.5"
                  >
                    Target Audience
                  </label>
                  <input
                    id="studio-opt-audience"
                    type="text"
                    value={options.targetAudience}
                    onChange={(e) =>
                      setOptions((prev) => ({ ...prev, targetAudience: e.target.value }))
                    }
                    className="w-full min-h-[40px] rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label
                    htmlFor="studio-opt-objective"
                    className="block text-xs font-semibold text-slate-700 mb-1.5"
                  >
                    Primary Objective
                  </label>
                  <input
                    id="studio-opt-objective"
                    type="text"
                    value={options.primaryObjective}
                    onChange={(e) =>
                      setOptions((prev) => ({ ...prev, primaryObjective: e.target.value }))
                    }
                    className="w-full min-h-[40px] rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-600 focus:outline-none"
                  />
                </div>

                <div className="md:col-span-1 lg:col-span-1">
                  <label
                    htmlFor="studio-opt-cta"
                    className="block text-xs font-semibold text-slate-700 mb-1.5"
                  >
                    Call-to-Action Preference
                  </label>
                  <input
                    id="studio-opt-cta"
                    type="text"
                    value={options.ctaPreference}
                    onChange={(e) =>
                      setOptions((prev) => ({ ...prev, ctaPreference: e.target.value }))
                    }
                    className="w-full min-h-[40px] rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-600 focus:outline-none"
                  />
                </div>

                <div className="md:col-span-1 lg:col-span-2">
                  <label
                    htmlFor="studio-opt-instructions"
                    className="block text-xs font-semibold text-slate-700 mb-1.5"
                  >
                    Additional Creative Instructions (optional)
                  </label>
                  <input
                    id="studio-opt-instructions"
                    type="text"
                    value={options.additionalInstructions}
                    onChange={(e) =>
                      setOptions((prev) => ({
                        ...prev,
                        additionalInstructions: e.target.value,
                      }))
                    }
                    placeholder="Specific angle, product detail to highlight, or formatting constraint..."
                    className="w-full min-h-[40px] rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-600 focus:outline-none"
                  />
                </div>
              </div>

              {generateError && (
                <div className="flex items-start gap-2.5 rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs text-rose-800">
                  <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" strokeWidth={1.75} />
                  <span>{generateError}</span>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4">
                <p className="text-xs text-slate-500">
                  AI drafts always start as <strong>Draft</strong> and require explicit approval before publishing.
                </p>

                <div className="flex flex-wrap items-center gap-2">
                  {generating && (
                    <button
                      type="button"
                      onClick={() => abortControllerRef.current?.abort()}
                      className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-2 text-xs font-medium text-rose-700 hover:bg-rose-100 whitespace-nowrap shrink-0"
                    >
                      <Square className="h-3.5 w-3.5" strokeWidth={2} />
                      <span>Cancel</span>
                    </button>
                  )}

                  <button
                    type="button"
                    disabled={generating || saving}
                    onClick={() => void handleCreateManualBlankDraft()}
                    className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 whitespace-nowrap shrink-0"
                  >
                    <PenTool className="h-3.5 w-3.5" strokeWidth={1.75} />
                    <span>Start Manual Draft</span>
                  </button>

                  <button
                    type="button"
                    disabled={generating || saving}
                    onClick={() => void handleGenerateWithAi()}
                    className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50 whitespace-nowrap shrink-0"
                  >
                    {generating ? (
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" strokeWidth={1.75} />
                    ) : (
                      <Sparkles className="h-3.5 w-3.5" strokeWidth={1.75} />
                    )}
                    <span>{generating ? 'Generating Draft...' : 'Generate AI Content'}</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Active Asset Editor */}
          {loadingAsset ? (
            <div className="h-80 rounded-xl border border-slate-200 bg-white animate-pulse" />
          ) : activeAsset && !showComposer ? (
            <ContentStudioEditor
              asset={activeAsset}
              approvedPlatforms={approvedContext.approvedPlatforms}
              saving={saving}
              refining={refining}
              activeRefineAction={activeRefineAction}
              refineError={refineError}
              onSaveDraft={handleSaveDraft}
              onChangeStatus={handleChangeStatus}
              onRefineWithAi={handleRefineWithAi}
              onCancelRefine={() => abortControllerRef.current?.abort()}
              onRestoreVersion={handleRestoreVersion}
              onDuplicate={() => handleDuplicateAsset(activeAsset)}
              onOpenCalendar={() => onNavigateToSection('content-calendar')}
              onCopySuccess={(msg) => onToast('success', msg)}
            />
          ) : null}
        </div>
      )}

      <ConfirmDialog
        open={Boolean(assetToDelete)}
        title="Delete Content Asset?"
        description={`This will permanently delete "${assetToDelete?.title ?? ''}" and all of its saved versions. Linked Content Calendar entries will remain intact.`}
        confirmLabel="Delete Asset"
        variant="danger"
        busy={deleting}
        onCancel={() => setAssetToDelete(null)}
        onConfirm={() => void handleConfirmDelete()}
      />
    </div>
  );
}
