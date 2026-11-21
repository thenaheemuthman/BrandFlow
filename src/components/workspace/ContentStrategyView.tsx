import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Compass,
  Info,
  Loader2,
  MessageSquareText,
  Save,
  ShieldCheck,
  SlidersHorizontal,
  Target,
  Users,
  X,
} from 'lucide-react';
import { api } from '../../services/api';
import { executeBrandPrompt } from '../../services/promptExecution';
import type { Brand, BrandStrategyModule, ModuleStatus } from '../../types/brand';
import { FOUNDATION_SECTIONS } from '../../utils/brandFoundationLogic';
import { MESSAGING_SECTIONS } from '../../utils/brandMessagingLogic';
import { ConfirmDialog } from '../common/ConfirmDialog';
import {
  CONTENT_STRATEGY_SECTIONS,
  adoptAiContentFormatSuggestion,
  adoptAiContentObjectiveSuggestion,
  adoptAiContentPillarSuggestion,
  adoptAiContentSeriesSuggestion,
  adoptAiContentThemeSuggestion,
  adoptAiDistributionSuggestion,
  adoptAiGovernanceSuggestion,
  applyAiContentDistributionResult,
  applyAiContentFormatsResult,
  applyAiContentGovernanceResult,
  applyAiContentObjectivesResult,
  applyAiContentPillarsResult,
  applyAiContentThemesResult,
  buildContentPromptVariables,
  buildContentStrategyUpsertPayload,
  canCompleteContentStrategy,
  checkContentDistributionReadiness,
  checkContentFormatsReadiness,
  checkContentGovernanceReadiness,
  checkContentObjectivesReadiness,
  checkContentPillarsReadiness,
  checkContentThemesReadiness,
  computeContentStrategyProgress,
  createBlankContentFormat,
  createBlankContentObjective,
  createBlankContentPillar,
  createBlankContentSeries,
  createBlankContentTheme,
  createBlankDistributionApproach,
  createBlankGovernanceStandard,
  createInitialContentStrategyState,
  dismissAiContentFormatSuggestion,
  dismissAiContentObjectiveSuggestion,
  dismissAiContentPillarSuggestion,
  dismissAiContentSeriesSuggestion,
  dismissAiContentThemeSuggestion,
  dismissAiDistributionSuggestion,
  dismissAiGovernanceSuggestion,
  hydrateContentStrategyState,
  removeContentFormatFromState,
  removeContentObjectiveFromState,
  removeContentPillarFromState,
  removeContentSeriesFromState,
  removeContentThemeFromState,
  removeDistributionFromState,
  removeGovernanceFromState,
  validateContentFormat,
  validateContentObjective,
  validateContentPillar,
  validateContentSeries,
  validateContentTheme,
  validateDistributionApproach,
  validateGovernanceStandard,
  type ContentFormatItem,
  type ContentGovernanceStandardItem,
  type ContentObjectiveItem,
  type ContentPillarItem,
  type ContentSeriesItem,
  type ContentStrategyState,
  type ContentStrategyStepKey,
  type ContentThemeTopicItem,
  type DistributionApproachItem,
  type EditorialConstraintsInput,
} from '../../utils/contentStrategyLogic';
import {
  ContentDistributionPanel,
  ContentFormatsSeriesPanel,
  ContentGovernancePanel,
  ContentObjectivesPanel,
  ContentPillarsPanel,
  ContentReviewCompletePanel,
  ContentThemesPanel,
} from './ContentStrategyPanels';

interface ContentStrategyViewProps {
  brand: Brand;
  onModuleSaved: (module: BrandStrategyModule) => void | Promise<void>;
  onToast: (type: 'success' | 'error', message: string) => void;
  onNavigateToBrandFoundation: () => void;
  onNavigateToBrandMessaging: () => void;
  onNavigateToCustomerIntelligence: () => void;
  onNavigateToMarketingStrategy: () => void;
  onNavigateToBrandSettings: () => void;
}

type RegenTarget =
  | 'objectives'
  | 'pillars'
  | 'themes'
  | 'formats'
  | 'distribution'
  | 'governance';

type DeleteTarget =
  | { kind: 'objective'; item: ContentObjectiveItem }
  | { kind: 'pillar'; item: ContentPillarItem }
  | { kind: 'theme'; item: ContentThemeTopicItem }
  | { kind: 'format'; item: ContentFormatItem }
  | { kind: 'series'; item: ContentSeriesItem }
  | { kind: 'distribution'; item: DistributionApproachItem }
  | { kind: 'governance'; item: ContentGovernanceStandardItem };

function createEntityId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function ContentStrategyView({
  brand,
  onModuleSaved,
  onToast,
  onNavigateToBrandFoundation,
  onNavigateToBrandMessaging,
  onNavigateToCustomerIntelligence,
  onNavigateToMarketingStrategy,
  onNavigateToBrandSettings,
}: ContentStrategyViewProps) {
  const [strategy, setStrategy] = useState<ContentStrategyState>(() =>
    createInitialContentStrategyState(brand),
  );
  const [strategyModules, setStrategyModules] = useState<BrandStrategyModule[]>([]);
  const [moduleStatus, setModuleStatus] = useState<ModuleStatus>(
    brand.moduleStatuses.contentStrategy ?? 'not_started',
  );
  const [activeStep, setActiveStep] = useState<ContentStrategyStepKey>('objectives');
  const [loadingModule, setLoadingModule] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadNonce, setReloadNonce] = useState<number>(0);
  const [saving, setSaving] = useState<boolean>(false);

  const [generatingTarget, setGeneratingTarget] = useState<RegenTarget | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [lastFailedTarget, setLastFailedTarget] = useState<RegenTarget | null>(null);
  const [missingInfoNotice, setMissingInfoNotice] = useState<{
    message: string;
    missingFields: string[];
  } | null>(null);

  const [showUpstreamDetails, setShowUpstreamDetails] = useState<boolean>(false);
  const [showContextPanel, setShowContextPanel] = useState<boolean>(false);

  const [editingIds, setEditingIds] = useState<Record<string, boolean>>({});
  const [errorsMap, setErrorsMap] = useState<Record<string, Record<string, string>>>({});

  const [confirmRegenTarget, setConfirmRegenTarget] = useState<RegenTarget | null>(null);
  const [pendingDelete, setPendingDelete] = useState<DeleteTarget | null>(null);

  useEffect(() => {
    setAiError(null);
    setLastFailedTarget(null);
    setMissingInfoNotice(null);
  }, [activeStep]);

  useEffect(() => {
    let cancelled = false;
    setLoadingModule(true);
    setLoadError(null);
    setAiError(null);
    setMissingInfoNotice(null);
    setErrorsMap({});
    setEditingIds({});

    api
      .listStrategyModules(brand.id)
      .then(({ modules }) => {
        if (cancelled) return;
        setStrategyModules(modules);

        const existingCs = modules.find((m) => m.moduleKey === 'contentStrategy') ?? null;
        let readiness;
        try {
          readiness = checkContentObjectivesReadiness(brand, modules);
        } catch {
          readiness = null;
        }

        const hydrated = hydrateContentStrategyState(
          brand,
          existingCs,
          readiness?.dependencyEvaluation.upstreamSnapshot ?? null,
        );
        setStrategy(hydrated);
        setModuleStatus(
          existingCs?.status ?? brand.moduleStatuses.contentStrategy ?? 'not_started',
        );

        if (existingCs?.status === 'completed') {
          setActiveStep('review');
        } else {
          setActiveStep('objectives');
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setStrategyModules([]);
        setStrategy(createInitialContentStrategyState(brand));
        setLoadError(
          err instanceof Error ? err.message : 'Unable to load Content Strategy workspace.',
        );
      })
      .finally(() => {
        if (!cancelled) setLoadingModule(false);
      });

    return () => {
      cancelled = true;
    };
  }, [brand.id, reloadNonce]);

  const objectivesReadiness = useMemo(() => {
    try {
      return checkContentObjectivesReadiness(brand, strategyModules);
    } catch (err) {
      return {
        ready: false,
        dependenciesReady: false,
        profileReady: false,
        missingProfileFields: [],
        dependencyEvaluation: {
          ready: false,
          foundationReady: false,
          messagingReady: false,
          customerIntelligenceReady: false,
          personasReady: false,
          interestsReady: false,
          marketingStrategyReady: false,
          foundationStatus: 'not_started' as ModuleStatus,
          messagingStatus: 'not_started' as ModuleStatus,
          customerIntelStatus: 'not_started' as ModuleStatus,
          marketingStrategyStatus: 'not_started' as ModuleStatus,
          missingFoundationSections: FOUNDATION_SECTIONS.map((s) => s.key),
          missingMessagingSections: MESSAGING_SECTIONS.map((s) => s.key),
          marketingStrategyBlockers: [],
          approvedPersonasCount: 0,
          approvedInterestsCount: 0,
          approvedFoundation: null,
          approvedMessaging: null,
          approvedPersonas: [],
          approvedInterests: [],
          approvedMarketingGoals: [],
          approvedMarketingObjectives: [],
          approvedMarketingChannels: [],
          approvedMarketingTactics: [],
          approvedMarketingKpis: [],
          approvedMarketingRoadmap: [],
          upstreamSnapshot: null,
          reason: err instanceof Error ? err.message : 'Brand context isolation error.',
        },
        reason: err instanceof Error ? err.message : 'Brand context isolation error.',
      };
    }
  }, [brand, strategyModules]);

  const pillarsReadiness = useMemo(() => {
    try {
      return checkContentPillarsReadiness(brand, strategyModules, strategy);
    } catch (err) {
      return {
        ready: false,
        hasApprovedObjectives: false,
        reason: err instanceof Error ? err.message : 'Brand context isolation error.',
      };
    }
  }, [brand, strategyModules, strategy]);

  const themesReadiness = useMemo(() => {
    try {
      return checkContentThemesReadiness(brand, strategyModules, strategy);
    } catch (err) {
      return {
        ready: false,
        hasApprovedPillars: false,
        reason: err instanceof Error ? err.message : 'Brand context isolation error.',
      };
    }
  }, [brand, strategyModules, strategy]);

  const formatsReadiness = useMemo(() => {
    try {
      return checkContentFormatsReadiness(brand, strategyModules, strategy);
    } catch (err) {
      return {
        ready: false,
        hasApprovedPillars: false,
        reason: err instanceof Error ? err.message : 'Brand context isolation error.',
      };
    }
  }, [brand, strategyModules, strategy]);

  const distributionReadiness = useMemo(() => {
    try {
      return checkContentDistributionReadiness(brand, strategyModules, strategy);
    } catch (err) {
      return {
        ready: false,
        hasApprovedPillars: false,
        hasApprovedFormatsOrSeries: false,
        reason: err instanceof Error ? err.message : 'Brand context isolation error.',
      };
    }
  }, [brand, strategyModules, strategy]);

  const governanceReadiness = useMemo(() => {
    try {
      return checkContentGovernanceReadiness(brand, strategyModules, strategy);
    } catch (err) {
      return {
        ready: false,
        hasApprovedPillars: false,
        reason: err instanceof Error ? err.message : 'Brand context isolation error.',
      };
    }
  }, [brand, strategyModules, strategy]);

  const progress = useMemo(() => computeContentStrategyProgress(strategy), [strategy]);
  const completionCheck = useMemo(() => canCompleteContentStrategy(strategy), [strategy]);

  const persistState = async (
    nextState: ContentStrategyState,
    requestedStatus: ModuleStatus,
    successMessage?: string,
  ): Promise<{ saved: boolean; state: ContentStrategyState; error?: string }> => {
    setSaving(true);
    try {
      const payload = buildContentStrategyUpsertPayload(nextState, requestedStatus);
      const { module } = await api.upsertStrategyModule(brand.id, 'contentStrategy', payload);
      const refreshed = hydrateContentStrategyState(
        brand,
        module,
        objectivesReadiness.dependencyEvaluation.upstreamSnapshot ?? nextState.upstreamSnapshot,
      );
      setStrategy(refreshed);
      setModuleStatus(module.status);
      setStrategyModules((prev) => [
        ...prev.filter((m) => m.moduleKey !== 'contentStrategy'),
        module,
      ]);
      await onModuleSaved(module);
      if (successMessage) {
        onToast('success', successMessage);
      }
      return { saved: true, state: refreshed };
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to save Content Strategy.';
      onToast('error', message);
      return { saved: false, state: nextState, error: message };
    } finally {
      setSaving(false);
    }
  };

  // =========================================================================
  // MODULAR AI GENERATION RUNNERS (6 PROMPTS)
  // =========================================================================

  const runModularGeneration = async (target: RegenTarget) => {
    setAiError(null);
    setLastFailedTarget(null);
    setMissingInfoNotice(null);

    if (!objectivesReadiness.dependenciesReady) {
      setAiError(
        objectivesReadiness.reason ??
          'Complete Brand Foundation, Brand Messaging, Customer Intelligence, and Marketing Strategy first.',
      );
      return;
    }

    if (!objectivesReadiness.profileReady) {
      setMissingInfoNotice({
        message:
          'Complete the required brand profile fields before running AI Content Strategy generation.',
        missingFields: objectivesReadiness.missingProfileFields,
      });
      return;
    }

    if (target === 'pillars' && !pillarsReadiness.ready) {
      setAiError(pillarsReadiness.reason ?? 'Approve at least one Content Objective first.');
      return;
    }
    if (target === 'themes' && !themesReadiness.ready) {
      setAiError(themesReadiness.reason ?? 'Approve at least one Content Pillar first.');
      return;
    }
    if (target === 'formats' && !formatsReadiness.ready) {
      setAiError(formatsReadiness.reason ?? 'Approve at least one Content Pillar first.');
      return;
    }
    if (target === 'distribution' && !distributionReadiness.ready) {
      setAiError(
        distributionReadiness.reason ??
          'Approve at least one Content Pillar and Content Format or Series first.',
      );
      return;
    }
    if (target === 'governance' && !governanceReadiness.ready) {
      setAiError(governanceReadiness.reason ?? 'Approve at least one Content Pillar first.');
      return;
    }

    setGeneratingTarget(target);
    try {
      let workingState = strategy;

      // Sync approved in-module items before Steps 2-6 only when the server copy
      // differs from local state (avoids an unnecessary extra round-trip on every click).
      if (target !== 'objectives') {
        const persistedCs = strategyModules.find((m) => m.moduleKey === 'contentStrategy');
        const nextStatus: ModuleStatus =
          moduleStatus === 'completed' ? 'completed' : 'in_progress';
        const localPayload = buildContentStrategyUpsertPayload(workingState, nextStatus);
        const persistedJson = persistedCs?.content ? JSON.stringify(persistedCs.content) : '';
        const localJson = JSON.stringify(localPayload.content);

        if (!persistedCs || persistedJson !== localJson) {
          const synced = await persistState(workingState, nextStatus);
          if (!synced.saved) {
            setAiError(
              synced.error ??
                'Unable to sync your approved Content Strategy sections before AI generation. Please try again.',
            );
            setLastFailedTarget(target);
            return;
          }
          workingState = synced.state;
        }
      }

      const promptIdMap: Record<RegenTarget, string> = {
        objectives: 'content_strategy_objectives',
        pillars: 'content_strategy_pillars',
        themes: 'content_strategy_themes',
        formats: 'content_strategy_formats',
        distribution: 'content_strategy_distribution',
        governance: 'content_strategy_governance',
      };

      const result = await executeBrandPrompt({
        brandId: brand.id,
        promptId: promptIdMap[target],
        includeApprovedModules: true,
        expectedOwnerUserId: brand.userId,
        variables: buildContentPromptVariables(brand, workingState),
      });

      if (result.status === 'missing_information') {
        setMissingInfoNotice({
          message: result.message,
          missingFields: result.missingVariables,
        });
        return;
      }

      if (result.status === 'validation_error') {
        setAiError(result.error);
        setLastFailedTarget(target);
        return;
      }

      const applied =
        target === 'objectives'
          ? applyAiContentObjectivesResult(workingState, result)
          : target === 'pillars'
            ? applyAiContentPillarsResult(workingState, result)
            : target === 'themes'
              ? applyAiContentThemesResult(workingState, result)
              : target === 'formats'
                ? applyAiContentFormatsResult(workingState, result)
                : target === 'distribution'
                  ? applyAiContentDistributionResult(workingState, result)
                  : applyAiContentGovernanceResult(workingState, result);

      if (!applied.applied) {
        setAiError(applied.error ?? 'AI recommendations failed structured validation.');
        setLastFailedTarget(target);
        return;
      }

      const nextState: ContentStrategyState = {
        ...applied.state,
        upstreamSnapshot:
          objectivesReadiness.dependencyEvaluation.upstreamSnapshot ??
          applied.state.upstreamSnapshot,
      };
      setStrategy(nextState);

      const toastCopy: Record<RegenTarget, string> = {
        objectives:
          'Generated AI Content Objectives for review. Existing approved items remain protected.',
        pillars:
          'Generated distinctive AI Content Pillars for review. Approved items remain protected.',
        themes:
          'Generated AI Content Themes & Topics mapped to approved pillars. Approved items remain protected.',
        formats:
          'Generated AI Content Formats & Recurring Series for review. Approved items remain protected.',
        distribution:
          'Generated AI Distribution & Publishing plans anchored to approved channels.',
        governance:
          'Generated AI Content Governance & Measurement standards for review.',
      };

      await persistState(
        nextState,
        moduleStatus === 'completed' ? 'completed' : 'in_progress',
        toastCopy[target],
      );
    } catch (err) {
      setAiError(
        err instanceof Error
          ? err.message
          : 'Unable to generate Content Strategy recommendations.',
      );
      setLastFailedTarget(target);
    } finally {
      setGeneratingTarget(null);
    }
  };

  const requestGeneration = (target: RegenTarget) => {
    if (generatingTarget || saving) return;
    const hasExisting =
      target === 'objectives'
        ? strategy.objectives.length > 0 || Boolean(strategy.objectivesSynthesis.generatedAt)
        : target === 'pillars'
          ? strategy.pillars.length > 0 || Boolean(strategy.pillarsSynthesis.generatedAt)
          : target === 'themes'
            ? strategy.themes.length > 0 || Boolean(strategy.themesSynthesis.generatedAt)
            : target === 'formats'
              ? strategy.formats.length > 0 ||
                strategy.series.length > 0 ||
                Boolean(strategy.formatsSynthesis.generatedAt)
              : target === 'distribution'
                ? strategy.distribution.length > 0 ||
                  Boolean(strategy.distributionSynthesis.generatedAt)
                : strategy.governance.length > 0 ||
                  Boolean(strategy.governanceSynthesis.generatedAt);

    if (hasExisting) {
      setConfirmRegenTarget(target);
      return;
    }
    void runModularGeneration(target);
  };

  // =========================================================================
  // ENTITY CRUD & APPROVAL HANDLERS
  // =========================================================================

  const toggleEdit = (id: string, editing: boolean) => {
    setEditingIds((prev) => ({ ...prev, [id]: editing }));
  };

  const clearErrors = (id: string) => {
    setErrorsMap((prev) => {
      if (!prev[id]) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const updateEditorialContext = (patch: Partial<EditorialConstraintsInput>) => {
    setStrategy((prev) => ({
      ...prev,
      editorialContext: { ...prev.editorialContext, ...patch },
    }));
  };

  const updateObjective = (id: string, patch: Partial<ContentObjectiveItem>) => {
    clearErrors(id);
    setStrategy((prev) => ({
      ...prev,
      completedAt: null,
      approvedSummary: null,
      objectives: prev.objectives.map((o) => {
        if (o.id !== id) return o;
        const nextSource =
          o.source === 'ai_adopted' && patch.source === undefined
            ? 'edited_ai'
            : (patch.source ?? o.source);
        return {
          ...o,
          ...patch,
          source: nextSource,
          approved: patch.approved !== undefined ? patch.approved : false,
          approvedAt: patch.approved !== undefined ? (patch.approvedAt ?? null) : null,
        };
      }),
    }));
    if (moduleStatus === 'completed') setModuleStatus('in_progress');
  };

  const approveObjective = async (item: ContentObjectiveItem) => {
    const errs = validateContentObjective(item);
    if (Object.keys(errs).length > 0) {
      setErrorsMap((prev) => ({ ...prev, [item.id]: errs }));
      setEditingIds((prev) => ({ ...prev, [item.id]: true }));
      return;
    }
    const nowIso = new Date().toISOString();
    const updated: ContentStrategyState = {
      ...strategy,
      objectives: strategy.objectives.map((o) =>
        o.id === item.id ? { ...o, approved: true, approvedAt: nowIso } : o,
      ),
    };
    setStrategy(updated);
    toggleEdit(item.id, false);
    await persistState(
      updated,
      moduleStatus === 'completed' && canCompleteContentStrategy(updated).allowed
        ? 'completed'
        : 'in_progress',
      `Approved content objective "${item.title}".`,
    );
  };

  const unapproveObjective = async (id: string) => {
    const updated: ContentStrategyState = {
      ...strategy,
      completedAt: null,
      approvedSummary: null,
      objectives: strategy.objectives.map((o) =>
        o.id === id ? { ...o, approved: false, approvedAt: null } : o,
      ),
    };
    setStrategy(updated);
    if (moduleStatus === 'completed') setModuleStatus('in_progress');
    await persistState(updated, 'in_progress', 'Content objective moved back to draft.');
  };

  const updatePillar = (id: string, patch: Partial<ContentPillarItem>) => {
    clearErrors(id);
    setStrategy((prev) => ({
      ...prev,
      completedAt: null,
      approvedSummary: null,
      pillars: prev.pillars.map((p) => {
        if (p.id !== id) return p;
        const nextSource =
          p.source === 'ai_adopted' && patch.source === undefined
            ? 'edited_ai'
            : (patch.source ?? p.source);
        return {
          ...p,
          ...patch,
          source: nextSource,
          approved: patch.approved !== undefined ? patch.approved : false,
          approvedAt: patch.approved !== undefined ? (patch.approvedAt ?? null) : null,
        };
      }),
    }));
    if (moduleStatus === 'completed') setModuleStatus('in_progress');
  };

  const approvePillar = async (item: ContentPillarItem) => {
    const errs = validateContentPillar(item, strategy.pillars);
    if (Object.keys(errs).length > 0) {
      setErrorsMap((prev) => ({ ...prev, [item.id]: errs }));
      setEditingIds((prev) => ({ ...prev, [item.id]: true }));
      return;
    }
    const nowIso = new Date().toISOString();
    const updated: ContentStrategyState = {
      ...strategy,
      pillars: strategy.pillars.map((p) =>
        p.id === item.id ? { ...p, approved: true, approvedAt: nowIso } : p,
      ),
    };
    setStrategy(updated);
    toggleEdit(item.id, false);
    await persistState(
      updated,
      moduleStatus === 'completed' && canCompleteContentStrategy(updated).allowed
        ? 'completed'
        : 'in_progress',
      `Approved content pillar "${item.name}".`,
    );
  };

  const unapprovePillar = async (id: string) => {
    const updated: ContentStrategyState = {
      ...strategy,
      completedAt: null,
      approvedSummary: null,
      pillars: strategy.pillars.map((p) =>
        p.id === id ? { ...p, approved: false, approvedAt: null } : p,
      ),
    };
    setStrategy(updated);
    if (moduleStatus === 'completed') setModuleStatus('in_progress');
    await persistState(updated, 'in_progress', 'Content pillar moved back to draft.');
  };

  const updateTheme = (id: string, patch: Partial<ContentThemeTopicItem>) => {
    clearErrors(id);
    setStrategy((prev) => ({
      ...prev,
      completedAt: null,
      approvedSummary: null,
      themes: prev.themes.map((t) => {
        if (t.id !== id) return t;
        const nextSource =
          t.source === 'ai_adopted' && patch.source === undefined
            ? 'edited_ai'
            : (patch.source ?? t.source);
        return {
          ...t,
          ...patch,
          source: nextSource,
          approved: patch.approved !== undefined ? patch.approved : false,
          approvedAt: patch.approved !== undefined ? (patch.approvedAt ?? null) : null,
        };
      }),
    }));
    if (moduleStatus === 'completed') setModuleStatus('in_progress');
  };

  const approveTheme = async (item: ContentThemeTopicItem) => {
    const errs = validateContentTheme(item, strategy.pillars, strategy.themes);
    if (Object.keys(errs).length > 0) {
      setErrorsMap((prev) => ({ ...prev, [item.id]: errs }));
      setEditingIds((prev) => ({ ...prev, [item.id]: true }));
      return;
    }
    const nowIso = new Date().toISOString();
    const updated: ContentStrategyState = {
      ...strategy,
      themes: strategy.themes.map((t) =>
        t.id === item.id ? { ...t, approved: true, approvedAt: nowIso } : t,
      ),
    };
    setStrategy(updated);
    toggleEdit(item.id, false);
    await persistState(
      updated,
      moduleStatus === 'completed' && canCompleteContentStrategy(updated).allowed
        ? 'completed'
        : 'in_progress',
      `Approved content theme "${item.title}".`,
    );
  };

  const unapproveTheme = async (id: string) => {
    const updated: ContentStrategyState = {
      ...strategy,
      completedAt: null,
      approvedSummary: null,
      themes: strategy.themes.map((t) =>
        t.id === id ? { ...t, approved: false, approvedAt: null } : t,
      ),
    };
    setStrategy(updated);
    if (moduleStatus === 'completed') setModuleStatus('in_progress');
    await persistState(updated, 'in_progress', 'Content theme moved back to draft.');
  };

  const updateFormat = (id: string, patch: Partial<ContentFormatItem>) => {
    clearErrors(id);
    setStrategy((prev) => ({
      ...prev,
      completedAt: null,
      approvedSummary: null,
      formats: prev.formats.map((f) => {
        if (f.id !== id) return f;
        const nextSource =
          f.source === 'ai_adopted' && patch.source === undefined
            ? 'edited_ai'
            : (patch.source ?? f.source);
        return {
          ...f,
          ...patch,
          source: nextSource,
          approved: patch.approved !== undefined ? patch.approved : false,
          approvedAt: patch.approved !== undefined ? (patch.approvedAt ?? null) : null,
        };
      }),
    }));
    if (moduleStatus === 'completed') setModuleStatus('in_progress');
  };

  const approveFormat = async (item: ContentFormatItem) => {
    const errs = validateContentFormat(item);
    if (Object.keys(errs).length > 0) {
      setErrorsMap((prev) => ({ ...prev, [item.id]: errs }));
      setEditingIds((prev) => ({ ...prev, [item.id]: true }));
      return;
    }
    const nowIso = new Date().toISOString();
    const updated: ContentStrategyState = {
      ...strategy,
      formats: strategy.formats.map((f) =>
        f.id === item.id ? { ...f, approved: true, approvedAt: nowIso } : f,
      ),
    };
    setStrategy(updated);
    toggleEdit(item.id, false);
    await persistState(
      updated,
      moduleStatus === 'completed' && canCompleteContentStrategy(updated).allowed
        ? 'completed'
        : 'in_progress',
      `Approved content format "${item.formatName}".`,
    );
  };

  const unapproveFormat = async (id: string) => {
    const updated: ContentStrategyState = {
      ...strategy,
      completedAt: null,
      approvedSummary: null,
      formats: strategy.formats.map((f) =>
        f.id === id ? { ...f, approved: false, approvedAt: null } : f,
      ),
    };
    setStrategy(updated);
    if (moduleStatus === 'completed') setModuleStatus('in_progress');
    await persistState(updated, 'in_progress', 'Content format moved back to draft.');
  };

  const updateSeries = (id: string, patch: Partial<ContentSeriesItem>) => {
    clearErrors(id);
    setStrategy((prev) => ({
      ...prev,
      completedAt: null,
      approvedSummary: null,
      series: prev.series.map((s) => {
        if (s.id !== id) return s;
        const nextSource =
          s.source === 'ai_adopted' && patch.source === undefined
            ? 'edited_ai'
            : (patch.source ?? s.source);
        return {
          ...s,
          ...patch,
          source: nextSource,
          approved: patch.approved !== undefined ? patch.approved : false,
          approvedAt: patch.approved !== undefined ? (patch.approvedAt ?? null) : null,
        };
      }),
    }));
    if (moduleStatus === 'completed') setModuleStatus('in_progress');
  };

  const approveSeries = async (item: ContentSeriesItem) => {
    const errs = validateContentSeries(item);
    if (Object.keys(errs).length > 0) {
      setErrorsMap((prev) => ({ ...prev, [item.id]: errs }));
      setEditingIds((prev) => ({ ...prev, [item.id]: true }));
      return;
    }
    const nowIso = new Date().toISOString();
    const updated: ContentStrategyState = {
      ...strategy,
      series: strategy.series.map((s) =>
        s.id === item.id ? { ...s, approved: true, approvedAt: nowIso } : s,
      ),
    };
    setStrategy(updated);
    toggleEdit(item.id, false);
    await persistState(
      updated,
      moduleStatus === 'completed' && canCompleteContentStrategy(updated).allowed
        ? 'completed'
        : 'in_progress',
      `Approved recurring series "${item.seriesName}".`,
    );
  };

  const unapproveSeries = async (id: string) => {
    const updated: ContentStrategyState = {
      ...strategy,
      completedAt: null,
      approvedSummary: null,
      series: strategy.series.map((s) =>
        s.id === id ? { ...s, approved: false, approvedAt: null } : s,
      ),
    };
    setStrategy(updated);
    if (moduleStatus === 'completed') setModuleStatus('in_progress');
    await persistState(updated, 'in_progress', 'Recurring series moved back to draft.');
  };

  const updateDistribution = (id: string, patch: Partial<DistributionApproachItem>) => {
    clearErrors(id);
    setStrategy((prev) => ({
      ...prev,
      completedAt: null,
      approvedSummary: null,
      distribution: prev.distribution.map((d) => {
        if (d.id !== id) return d;
        const nextSource =
          d.source === 'ai_adopted' && patch.source === undefined
            ? 'edited_ai'
            : (patch.source ?? d.source);
        return {
          ...d,
          ...patch,
          source: nextSource,
          approved: patch.approved !== undefined ? patch.approved : false,
          approvedAt: patch.approved !== undefined ? (patch.approvedAt ?? null) : null,
        };
      }),
    }));
    if (moduleStatus === 'completed') setModuleStatus('in_progress');
  };

  const approveDistribution = async (item: DistributionApproachItem) => {
    const errs = validateDistributionApproach(item);
    if (Object.keys(errs).length > 0) {
      setErrorsMap((prev) => ({ ...prev, [item.id]: errs }));
      setEditingIds((prev) => ({ ...prev, [item.id]: true }));
      return;
    }
    const nowIso = new Date().toISOString();
    const updated: ContentStrategyState = {
      ...strategy,
      distribution: strategy.distribution.map((d) =>
        d.id === item.id ? { ...d, approved: true, approvedAt: nowIso } : d,
      ),
    };
    setStrategy(updated);
    toggleEdit(item.id, false);
    await persistState(
      updated,
      moduleStatus === 'completed' && canCompleteContentStrategy(updated).allowed
        ? 'completed'
        : 'in_progress',
      `Approved publishing plan for "${item.platformName}".`,
    );
  };

  const unapproveDistribution = async (id: string) => {
    const updated: ContentStrategyState = {
      ...strategy,
      completedAt: null,
      approvedSummary: null,
      distribution: strategy.distribution.map((d) =>
        d.id === id ? { ...d, approved: false, approvedAt: null } : d,
      ),
    };
    setStrategy(updated);
    if (moduleStatus === 'completed') setModuleStatus('in_progress');
    await persistState(updated, 'in_progress', 'Publishing plan moved back to draft.');
  };

  const updateGovernance = (id: string, patch: Partial<ContentGovernanceStandardItem>) => {
    clearErrors(id);
    setStrategy((prev) => ({
      ...prev,
      completedAt: null,
      approvedSummary: null,
      governance: prev.governance.map((g) => {
        if (g.id !== id) return g;
        const nextSource =
          g.source === 'ai_adopted' && patch.source === undefined
            ? 'edited_ai'
            : (patch.source ?? g.source);
        return {
          ...g,
          ...patch,
          source: nextSource,
          approved: patch.approved !== undefined ? patch.approved : false,
          approvedAt: patch.approved !== undefined ? (patch.approvedAt ?? null) : null,
        };
      }),
    }));
    if (moduleStatus === 'completed') setModuleStatus('in_progress');
  };

  const approveGovernance = async (item: ContentGovernanceStandardItem) => {
    const errs = validateGovernanceStandard(item);
    if (Object.keys(errs).length > 0) {
      setErrorsMap((prev) => ({ ...prev, [item.id]: errs }));
      setEditingIds((prev) => ({ ...prev, [item.id]: true }));
      return;
    }
    const nowIso = new Date().toISOString();
    const updated: ContentStrategyState = {
      ...strategy,
      governance: strategy.governance.map((g) =>
        g.id === item.id ? { ...g, approved: true, approvedAt: nowIso } : g,
      ),
    };
    setStrategy(updated);
    toggleEdit(item.id, false);
    await persistState(
      updated,
      moduleStatus === 'completed' && canCompleteContentStrategy(updated).allowed
        ? 'completed'
        : 'in_progress',
      `Approved governance standard "${item.title}".`,
    );
  };

  const unapproveGovernance = async (id: string) => {
    const updated: ContentStrategyState = {
      ...strategy,
      completedAt: null,
      approvedSummary: null,
      governance: strategy.governance.map((g) =>
        g.id === id ? { ...g, approved: false, approvedAt: null } : g,
      ),
    };
    setStrategy(updated);
    if (moduleStatus === 'completed') setModuleStatus('in_progress');
    await persistState(updated, 'in_progress', 'Governance standard moved back to draft.');
  };

  const handleConfirmDelete = async () => {
    if (!pendingDelete) return;
    let nextState = strategy;
    let label = 'Item';

    switch (pendingDelete.kind) {
      case 'objective':
        label = pendingDelete.item.title || 'Content Objective';
        nextState = removeContentObjectiveFromState(strategy, pendingDelete.item.id);
        break;
      case 'pillar':
        label = pendingDelete.item.name || 'Content Pillar';
        nextState = removeContentPillarFromState(strategy, pendingDelete.item.id);
        break;
      case 'theme':
        label = pendingDelete.item.title || 'Content Theme';
        nextState = removeContentThemeFromState(strategy, pendingDelete.item.id);
        break;
      case 'format':
        label = pendingDelete.item.formatName || 'Content Format';
        nextState = removeContentFormatFromState(strategy, pendingDelete.item.id);
        break;
      case 'series':
        label = pendingDelete.item.seriesName || 'Recurring Series';
        nextState = removeContentSeriesFromState(strategy, pendingDelete.item.id);
        break;
      case 'distribution':
        label = pendingDelete.item.platformName || 'Platform Plan';
        nextState = removeDistributionFromState(strategy, pendingDelete.item.id);
        break;
      case 'governance':
        label = pendingDelete.item.title || 'Governance Standard';
        nextState = removeGovernanceFromState(strategy, pendingDelete.item.id);
        break;
    }

    setPendingDelete(null);
    setStrategy(nextState);
    const nextStatus: ModuleStatus =
      moduleStatus === 'completed' && canCompleteContentStrategy(nextState).allowed
        ? 'completed'
        : 'in_progress';
    await persistState(nextState, nextStatus, `Removed "${label}".`);
  };

  const handleSaveProgress = async () => {
    const nextStatus: ModuleStatus =
      moduleStatus === 'completed' && completionCheck.allowed ? 'completed' : 'in_progress';
    await persistState(strategy, nextStatus, 'Saved Content Strategy progress.');
  };

  const handleCompleteModule = async () => {
    if (!completionCheck.allowed) {
      onToast(
        'error',
        completionCheck.blockers[0] ??
          'Approve valid items in all six Content Strategy sections before completing.',
      );
      return;
    }
    await persistState(
      strategy,
      'completed',
      'Content Strategy approved and marked completed.',
    );
  };

  if (loadingModule) {
    return (
      <div className="space-y-4">
        <div className="h-32 animate-pulse rounded-xl border border-slate-200 bg-slate-50" />
        <div className="h-72 animate-pulse rounded-xl border border-slate-200 bg-slate-50" />
      </div>
    );
  }

  const depEval = objectivesReadiness.dependencyEvaluation;

  return (
    <div className="space-y-6">
      {/* Header, Progress & 7-Step Switcher */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
        <div className="flex flex-col justify-between gap-4 border-b border-slate-100 pb-5 sm:flex-row sm:items-start">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span>Phase 2B Strategy Module</span>
              <span aria-hidden="true">·</span>
              <span
                data-testid="content-strategy-module-status"
                className={
                  moduleStatus === 'completed'
                    ? 'font-semibold text-emerald-700'
                    : moduleStatus === 'in_progress'
                      ? 'font-medium text-blue-700'
                      : 'text-slate-500'
                }
              >
                {moduleStatus === 'completed'
                  ? 'Completed'
                  : moduleStatus === 'in_progress'
                    ? 'In progress'
                    : 'Not started'}
              </span>
            </div>
            <h2 className="mt-1 text-xl font-bold tracking-tight text-slate-900">
              Content Strategy
            </h2>
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-600">
              Translate <strong className="font-semibold text-slate-800">{brand.brandName}</strong>
              ’s approved brand, audience, and marketing strategy into editorial objectives,
              pillars, themes, formats, distribution plans, and governance standards.
            </p>
          </div>

          <button
            type="button"
            onClick={() => void handleSaveProgress()}
            disabled={saving}
            className="inline-flex min-h-[42px] shrink-0 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-60 whitespace-nowrap"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" strokeWidth={1.75} />
            )}
            <span>Save Progress</span>
          </button>
        </div>

        {/* Progress Bar */}
        <div className="mt-4">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="font-medium text-slate-700">
              Content Strategy Progress across 6 editorial architecture sections
            </span>
            <span
              data-testid="content-strategy-progress-label"
              className="font-mono font-semibold text-slate-900 tabular-nums whitespace-nowrap"
            >
              {progress.approvedCount} of {progress.totalSections} approved · {progress.percentage}%
            </span>
          </div>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-blue-600 transition-all duration-200"
              style={{ width: `${progress.percentage}%` }}
            />
          </div>
        </div>

        {/* 7-Step Navigation */}
        <nav
          aria-label="Content Strategy Sections"
          className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-7"
        >
          {CONTENT_STRATEGY_SECTIONS.map((sec) => {
            const isCurrent = activeStep === sec.key;
            const status = progress.sectionStatuses[sec.key];
            return (
              <button
                key={sec.key}
                type="button"
                onClick={() => setActiveStep(sec.key)}
                aria-current={isCurrent ? 'step' : undefined}
                className={`flex min-h-[54px] flex-col justify-between rounded-lg border px-3 py-2 text-left transition-colors ${
                  isCurrent
                    ? 'border-blue-600 bg-blue-50/70 text-blue-900'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="font-mono text-[11px] font-medium text-slate-400 tabular-nums">
                    {sec.number}
                  </span>
                  {status === 'approved' ? (
                    <CheckCircle2
                      className="h-3.5 w-3.5 shrink-0 text-emerald-600"
                      aria-label="Approved"
                    />
                  ) : status === 'in_progress' ? (
                    <span className="text-[10px] font-medium text-blue-600">Draft</span>
                  ) : null}
                </div>
                <span className="mt-1 text-xs font-semibold leading-snug truncate">
                  {sec.shortTitle}
                </span>
              </button>
            );
          })}

          <button
            type="button"
            onClick={() => setActiveStep('review')}
            aria-current={activeStep === 'review' ? 'step' : undefined}
            className={`col-span-2 sm:col-span-2 xl:col-span-1 flex min-h-[54px] flex-col justify-between rounded-lg border px-3 py-2 text-left transition-colors ${
              activeStep === 'review'
                ? 'border-blue-600 bg-blue-50/70 text-blue-900'
                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            <div className="flex items-center justify-between gap-1">
              <span className="font-mono text-[11px] font-medium text-slate-400 tabular-nums">
                07
              </span>
              {moduleStatus === 'completed' && (
                <CheckCircle2
                  className="h-3.5 w-3.5 shrink-0 text-emerald-600"
                  aria-label="Completed"
                />
              )}
            </div>
            <span className="mt-1 text-xs font-semibold leading-snug">Review</span>
          </button>
        </nav>
      </section>

      {/* 4-Prerequisite Upstream Gate or Verified Upstream Anchor */}
      {!objectivesReadiness.dependenciesReady ? (
        <section
          role="status"
          data-testid="content-strategy-prerequisite"
          className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-amber-950"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle
              className="mt-0.5 h-5 w-5 shrink-0 text-amber-700"
              strokeWidth={1.75}
            />
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-semibold text-amber-950">
                Complete upstream brand, customer, and marketing strategy to unlock AI Content Strategy
              </h3>
              <p className="mt-1 text-xs leading-relaxed text-amber-900">
                Content Strategy AI generation requires completed Brand Foundation, completed Brand
                Messaging, completed Customer Intelligence (approved Personas &amp; Interests), and
                completed Marketing Strategy. Manual drafting remains available below.
              </p>

              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {[
                  {
                    label: 'Brand Foundation',
                    ready: depEval.foundationReady,
                    detail: depEval.foundationReady ? 'Verified & approved' : 'Completion required',
                    icon: Compass,
                    action: onNavigateToBrandFoundation,
                    cta: 'Complete Foundation',
                  },
                  {
                    label: 'Brand Messaging',
                    ready: depEval.messagingReady,
                    detail: depEval.messagingReady ? 'Verified & approved' : 'Completion required',
                    icon: MessageSquareText,
                    action: onNavigateToBrandMessaging,
                    cta: 'Complete Messaging',
                  },
                  {
                    label: 'Customer Intelligence',
                    ready: depEval.customerIntelligenceReady,
                    detail: depEval.customerIntelligenceReady
                      ? `${depEval.approvedPersonasCount} Persona · ${depEval.approvedInterestsCount} Interest`
                      : 'Personas & Interests required',
                    icon: Users,
                    action: onNavigateToCustomerIntelligence,
                    cta: 'Complete Customer Intel',
                  },
                  {
                    label: 'Marketing Strategy',
                    ready: depEval.marketingStrategyReady,
                    detail: depEval.marketingStrategyReady
                      ? `${depEval.approvedMarketingChannels.length} Channel · ${depEval.approvedMarketingObjectives.length} Obj`
                      : 'Completion required',
                    icon: Target,
                    action: onNavigateToMarketingStrategy,
                    cta: 'Complete Marketing',
                  },
                ].map((item) => {
                  const Icon = item.icon;
                  return (
                    <div
                      key={item.label}
                      className="flex flex-col justify-between gap-2 rounded-lg border border-amber-200/80 bg-white/85 p-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-900">
                          <Icon className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                          <span>{item.label}</span>
                        </span>
                        <span
                          className={`text-[11px] font-semibold ${
                            item.ready ? 'text-emerald-700' : 'text-amber-800'
                          }`}
                        >
                          {item.ready ? 'Ready' : 'Required'}
                        </span>
                      </div>
                      {!item.ready ? (
                        <button
                          type="button"
                          onClick={item.action}
                          className="inline-flex min-h-[34px] items-center justify-center gap-1 rounded-lg bg-amber-900 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-amber-950"
                        >
                          <span>{item.cta}</span>
                          <ArrowRight className="h-3.5 w-3.5" />
                        </button>
                      ) : (
                        <div className="flex min-h-[34px] items-center gap-1.5 text-[11px] font-medium text-emerald-700">
                          <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                          <span>{item.detail}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>
      ) : (
        depEval.upstreamSnapshot && (
          <section
            data-testid="content-strategy-upstream-source"
            className="rounded-xl border border-slate-200 bg-slate-50/70 px-5 py-3.5"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs">
                <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-600" strokeWidth={1.75} />
                <span className="font-semibold text-slate-800">
                  Verified Upstream Anchor: Foundation, Messaging,{' '}
                  {depEval.approvedPersonasCount} Persona
                  {depEval.approvedPersonasCount === 1 ? '' : 's'},{' '}
                  {depEval.approvedInterestsCount} Interest
                  {depEval.approvedInterestsCount === 1 ? '' : 's'} &amp;{' '}
                  {depEval.approvedMarketingChannels.length} Marketing Channel
                  {depEval.approvedMarketingChannels.length === 1 ? '' : 's'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowUpstreamDetails((prev) => !prev)}
                className="text-xs font-medium text-blue-600 hover:text-blue-700"
              >
                {showUpstreamDetails ? 'Hide Upstream Summary' : 'View Upstream Summary'}
              </button>
            </div>

            {showUpstreamDetails && (
              <dl className="mt-3 grid grid-cols-1 gap-3 border-t border-slate-200/80 pt-3 text-xs sm:grid-cols-2">
                <div>
                  <dt className="font-semibold text-slate-700">Approved Positioning</dt>
                  <dd className="mt-0.5 text-slate-600">
                    {depEval.upstreamSnapshot.positioningStatement}
                  </dd>
                </div>
                <div>
                  <dt className="font-semibold text-slate-700">Approved Value Proposition</dt>
                  <dd className="mt-0.5 text-slate-600">
                    {depEval.upstreamSnapshot.coreValueProposition}
                  </dd>
                </div>
                <div>
                  <dt className="font-semibold text-slate-700">Approved Personas</dt>
                  <dd className="mt-0.5 text-slate-600">
                    {depEval.upstreamSnapshot.primaryPersonaNames.join(' · ')}
                  </dd>
                </div>
                <div>
                  <dt className="font-semibold text-slate-700">Approved Marketing Channels</dt>
                  <dd className="mt-0.5 text-slate-600">
                    {depEval.upstreamSnapshot.primaryChannelNames.join(' · ')}
                  </dd>
                </div>
              </dl>
            )}
          </section>
        )
      )}

      {/* Optional Editorial & Production Constraints */}
      <section className="rounded-xl border border-slate-200 bg-white">
        <button
          type="button"
          onClick={() => setShowContextPanel((prev) => !prev)}
          aria-expanded={showContextPanel}
          className="flex w-full items-center justify-between gap-3 px-5 py-3.5 text-left"
        >
          <div className="flex items-center gap-2 text-xs">
            <SlidersHorizontal className="h-4 w-4 text-slate-500 shrink-0" />
            <span className="font-semibold text-slate-800">
              Optional Editorial &amp; Production Constraints (Capacity, Resources, Notes)
            </span>
          </div>
          {showContextPanel ? (
            <ChevronUp className="h-4 w-4 text-slate-400 shrink-0" />
          ) : (
            <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" />
          )}
        </button>

        {showContextPanel && (
          <div className="border-t border-slate-100 px-5 py-4 space-y-4">
            <p className="text-xs text-slate-500">
              Share realistic editorial capacity or production limits so AI formats, cadence, and
              repurposing recommendations stay grounded in what your team can sustain.
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Publishing Capacity
                </label>
                <input
                  type="text"
                  value={strategy.editorialContext.publishingCapacity}
                  onChange={(e) =>
                    updateEditorialContext({ publishingCapacity: e.target.value })
                  }
                  placeholder="e.g., 2 LinkedIn posts/wk + 1 bi-weekly newsletter"
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Production Constraints
                </label>
                <input
                  type="text"
                  value={strategy.editorialContext.productionConstraints}
                  onChange={(e) =>
                    updateEditorialContext({ productionConstraints: e.target.value })
                  }
                  placeholder="e.g., No studio video; written + visual carousels only"
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Editorial Notes
                </label>
                <input
                  type="text"
                  value={strategy.editorialContext.editorialNotes}
                  onChange={(e) => updateEditorialContext({ editorialNotes: e.target.value })}
                  placeholder="e.g., Prioritize operator case breakdowns over news"
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                />
              </div>
            </div>
          </div>
        )}
      </section>

      {/* AI Safeguard Reminder */}
      <div className="flex items-start gap-2.5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-700">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
        <p className="leading-relaxed">
          <strong className="font-semibold text-slate-900">
            AI Suggestions vs. Approved Editorial Strategy:
          </strong>{' '}
          AI recommendations enter a pending review queue and are never auto-approved. Adopt
          suggestions as drafts, edit as needed, and approve each item explicitly.
        </p>
      </div>

      {/* Alerts */}
      {loadError && (
        <div
          role="alert"
          className="flex flex-col justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900 sm:flex-row sm:items-center"
        >
          <span>{loadError}</span>
          <button
            type="button"
            onClick={() => setReloadNonce((n) => n + 1)}
            className="inline-flex min-h-[36px] shrink-0 items-center rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-semibold text-red-800 hover:bg-red-100"
          >
            Retry Loading
          </button>
        </div>
      )}

      {missingInfoNotice && (
        <div
          role="alert"
          data-testid="content-strategy-missing-info"
          className="flex flex-col justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950 sm:flex-row sm:items-center"
        >
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <div>
              <p className="font-semibold">
                Required brand profile or upstream strategy details missing
              </p>
              <p className="mt-0.5 text-xs leading-relaxed text-amber-900">
                {missingInfoNotice.message} Missing:{' '}
                <span className="font-mono">{missingInfoNotice.missingFields.join(', ')}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onNavigateToBrandSettings}
            className="inline-flex min-h-[40px] shrink-0 items-center rounded-lg border border-amber-300 bg-white px-3.5 py-2 text-xs font-medium text-amber-900 hover:bg-amber-100 whitespace-nowrap"
          >
            Update Brand Profile
          </button>
        </div>
      )}

      {aiError && (
        <div
          role="alert"
          data-testid="content-strategy-ai-error"
          className="flex flex-col justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900 sm:flex-row sm:items-center"
        >
          <span className="leading-relaxed">{aiError}</span>
          <div className="flex shrink-0 items-center gap-2">
            {lastFailedTarget && !generatingTarget && !saving && (
              <button
                type="button"
                data-testid="content-strategy-ai-retry-btn"
                onClick={() => void runModularGeneration(lastFailedTarget)}
                className="inline-flex min-h-[34px] items-center rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-semibold text-red-800 transition-colors hover:bg-red-100 whitespace-nowrap"
              >
                Retry Generation
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setAiError(null);
                setLastFailedTarget(null);
              }}
              aria-label="Dismiss error"
              className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-red-700 hover:bg-red-100"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Active Step Panels */}
      {activeStep === 'objectives' && (
        <ContentObjectivesPanel
          state={strategy}
          approvedMarketingGoals={depEval.approvedMarketingGoals}
          approvedMarketingObjectives={depEval.approvedMarketingObjectives}
          generating={generatingTarget === 'objectives'}
          canGenerate={objectivesReadiness.dependenciesReady}
          disabledReason={objectivesReadiness.reason}
          editingIds={editingIds}
          errorsMap={errorsMap}
          onToggleEdit={toggleEdit}
          onGenerate={() => requestGeneration('objectives')}
          onAddManual={() => {
            const id = createEntityId('cobj');
            setStrategy((prev) => ({
              ...prev,
              completedAt: null,
              approvedSummary: null,
              objectives: [...prev.objectives, createBlankContentObjective(id)],
            }));
            toggleEdit(id, true);
          }}
          onAdoptSuggestion={(suggId) => {
            const newId = createEntityId('cobj');
            const { state: next } = adoptAiContentObjectiveSuggestion(strategy, suggId, newId);
            setStrategy(next);
            onToast(
              'success',
              'Adopted content objective as draft. Review and approve when ready.',
            );
          }}
          onDismissSuggestion={(suggId) =>
            setStrategy((prev) => dismissAiContentObjectiveSuggestion(prev, suggId))
          }
          onUpdateObjective={updateObjective}
          onApproveObjective={(item) => void approveObjective(item)}
          onUnapproveObjective={(id) => void unapproveObjective(id)}
          onRequestDeleteObjective={(item) => setPendingDelete({ kind: 'objective', item })}
          onNext={() => setActiveStep('pillars')}
        />
      )}

      {activeStep === 'pillars' && (
        <ContentPillarsPanel
          state={strategy}
          approvedMarketingObjectives={depEval.approvedMarketingObjectives}
          generating={generatingTarget === 'pillars'}
          canGenerate={pillarsReadiness.ready}
          disabledReason={pillarsReadiness.reason}
          editingIds={editingIds}
          errorsMap={errorsMap}
          onToggleEdit={toggleEdit}
          onGenerate={() => requestGeneration('pillars')}
          onAddManual={() => {
            const id = createEntityId('cpillar');
            setStrategy((prev) => ({
              ...prev,
              completedAt: null,
              approvedSummary: null,
              pillars: [...prev.pillars, createBlankContentPillar(id)],
            }));
            toggleEdit(id, true);
          }}
          onAdoptSuggestion={(suggId) => {
            const newId = createEntityId('cpillar');
            const { state: next } = adoptAiContentPillarSuggestion(strategy, suggId, newId);
            setStrategy(next);
            onToast('success', 'Adopted content pillar as draft. Review and approve when ready.');
          }}
          onDismissSuggestion={(suggId) =>
            setStrategy((prev) => dismissAiContentPillarSuggestion(prev, suggId))
          }
          onUpdatePillar={updatePillar}
          onApprovePillar={(item) => void approvePillar(item)}
          onUnapprovePillar={(id) => void unapprovePillar(id)}
          onRequestDeletePillar={(item) => setPendingDelete({ kind: 'pillar', item })}
          onPrev={() => setActiveStep('objectives')}
          onNext={() => setActiveStep('themes')}
        />
      )}

      {activeStep === 'themes' && (
        <ContentThemesPanel
          state={strategy}
          approvedMarketingObjectives={depEval.approvedMarketingObjectives}
          generating={generatingTarget === 'themes'}
          canGenerate={themesReadiness.ready}
          disabledReason={themesReadiness.reason}
          editingIds={editingIds}
          errorsMap={errorsMap}
          onToggleEdit={toggleEdit}
          onGenerate={() => requestGeneration('themes')}
          onAddManual={() => {
            const id = createEntityId('ctheme');
            const defaultPillar =
              strategy.pillars.find((p) => p.approved) ?? strategy.pillars[0];
            setStrategy((prev) => ({
              ...prev,
              completedAt: null,
              approvedSummary: null,
              themes: [
                ...prev.themes,
                createBlankContentTheme(
                  id,
                  defaultPillar ? { id: defaultPillar.id, name: defaultPillar.name } : undefined,
                ),
              ],
            }));
            toggleEdit(id, true);
          }}
          onAdoptSuggestion={(suggId) => {
            const newId = createEntityId('ctheme');
            const { state: next } = adoptAiContentThemeSuggestion(strategy, suggId, newId);
            setStrategy(next);
            onToast('success', 'Adopted content theme as draft. Review and approve when ready.');
          }}
          onDismissSuggestion={(suggId) =>
            setStrategy((prev) => dismissAiContentThemeSuggestion(prev, suggId))
          }
          onUpdateTheme={updateTheme}
          onApproveTheme={(item) => void approveTheme(item)}
          onUnapproveTheme={(id) => void unapproveTheme(id)}
          onRequestDeleteTheme={(item) => setPendingDelete({ kind: 'theme', item })}
          onPrev={() => setActiveStep('pillars')}
          onNext={() => setActiveStep('formats')}
        />
      )}

      {activeStep === 'formats' && (
        <ContentFormatsSeriesPanel
          state={strategy}
          approvedMarketingChannels={depEval.approvedMarketingChannels}
          generating={generatingTarget === 'formats'}
          canGenerate={formatsReadiness.ready}
          disabledReason={formatsReadiness.reason}
          editingIds={editingIds}
          errorsMap={errorsMap}
          onToggleEdit={toggleEdit}
          onGenerate={() => requestGeneration('formats')}
          onAddManualFormat={() => {
            const id = createEntityId('cformat');
            setStrategy((prev) => ({
              ...prev,
              completedAt: null,
              approvedSummary: null,
              formats: [...prev.formats, createBlankContentFormat(id)],
            }));
            toggleEdit(id, true);
          }}
          onAddManualSeries={() => {
            const id = createEntityId('cseries');
            setStrategy((prev) => ({
              ...prev,
              completedAt: null,
              approvedSummary: null,
              series: [...prev.series, createBlankContentSeries(id)],
            }));
            toggleEdit(id, true);
          }}
          onAdoptFormatSuggestion={(suggId) => {
            const newId = createEntityId('cformat');
            const { state: next } = adoptAiContentFormatSuggestion(strategy, suggId, newId);
            setStrategy(next);
            onToast('success', 'Adopted content format as draft. Review and approve when ready.');
          }}
          onDismissFormatSuggestion={(suggId) =>
            setStrategy((prev) => dismissAiContentFormatSuggestion(prev, suggId))
          }
          onAdoptSeriesSuggestion={(suggId) => {
            const newId = createEntityId('cseries');
            const { state: next } = adoptAiContentSeriesSuggestion(strategy, suggId, newId);
            setStrategy(next);
            onToast(
              'success',
              'Adopted recurring series as draft. Review and approve when ready.',
            );
          }}
          onDismissSeriesSuggestion={(suggId) =>
            setStrategy((prev) => dismissAiContentSeriesSuggestion(prev, suggId))
          }
          onUpdateFormat={updateFormat}
          onApproveFormat={(item) => void approveFormat(item)}
          onUnapproveFormat={(id) => void unapproveFormat(id)}
          onRequestDeleteFormat={(item) => setPendingDelete({ kind: 'format', item })}
          onUpdateSeries={updateSeries}
          onApproveSeries={(item) => void approveSeries(item)}
          onUnapproveSeries={(id) => void unapproveSeries(id)}
          onRequestDeleteSeries={(item) => setPendingDelete({ kind: 'series', item })}
          onPrev={() => setActiveStep('themes')}
          onNext={() => setActiveStep('distribution')}
        />
      )}

      {activeStep === 'distribution' && (
        <ContentDistributionPanel
          state={strategy}
          approvedMarketingChannels={depEval.approvedMarketingChannels}
          generating={generatingTarget === 'distribution'}
          canGenerate={distributionReadiness.ready}
          disabledReason={distributionReadiness.reason}
          editingIds={editingIds}
          errorsMap={errorsMap}
          onToggleEdit={toggleEdit}
          onGenerate={() => requestGeneration('distribution')}
          onAddManual={() => {
            const id = createEntityId('cdist');
            const defaultPlatform = depEval.approvedMarketingChannels[0]?.channelName ?? '';
            setStrategy((prev) => ({
              ...prev,
              completedAt: null,
              approvedSummary: null,
              distribution: [
                ...prev.distribution,
                createBlankDistributionApproach(id, defaultPlatform),
              ],
            }));
            toggleEdit(id, true);
          }}
          onAdoptSuggestion={(suggId) => {
            const newId = createEntityId('cdist');
            const { state: next } = adoptAiDistributionSuggestion(strategy, suggId, newId);
            setStrategy(next);
            onToast(
              'success',
              'Adopted distribution plan as draft. Review and approve when ready.',
            );
          }}
          onDismissSuggestion={(suggId) =>
            setStrategy((prev) => dismissAiDistributionSuggestion(prev, suggId))
          }
          onUpdateDistribution={updateDistribution}
          onApproveDistribution={(item) => void approveDistribution(item)}
          onUnapproveDistribution={(id) => void unapproveDistribution(id)}
          onRequestDeleteDistribution={(item) => setPendingDelete({ kind: 'distribution', item })}
          onPrev={() => setActiveStep('formats')}
          onNext={() => setActiveStep('governance')}
        />
      )}

      {activeStep === 'governance' && (
        <ContentGovernancePanel
          state={strategy}
          generating={generatingTarget === 'governance'}
          canGenerate={governanceReadiness.ready}
          disabledReason={governanceReadiness.reason}
          editingIds={editingIds}
          errorsMap={errorsMap}
          onToggleEdit={toggleEdit}
          onGenerate={() => requestGeneration('governance')}
          onAddManual={() => {
            const id = createEntityId('cgov');
            setStrategy((prev) => ({
              ...prev,
              completedAt: null,
              approvedSummary: null,
              governance: [...prev.governance, createBlankGovernanceStandard(id)],
            }));
            toggleEdit(id, true);
          }}
          onAdoptSuggestion={(suggId) => {
            const newId = createEntityId('cgov');
            const { state: next } = adoptAiGovernanceSuggestion(strategy, suggId, newId);
            setStrategy(next);
            onToast(
              'success',
              'Adopted governance standard as draft. Review and approve when ready.',
            );
          }}
          onDismissSuggestion={(suggId) =>
            setStrategy((prev) => dismissAiGovernanceSuggestion(prev, suggId))
          }
          onUpdateGovernance={updateGovernance}
          onApproveGovernance={(item) => void approveGovernance(item)}
          onUnapproveGovernance={(id) => void unapproveGovernance(id)}
          onRequestDeleteGovernance={(item) => setPendingDelete({ kind: 'governance', item })}
          onPrev={() => setActiveStep('distribution')}
          onNext={() => setActiveStep('review')}
        />
      )}

      {activeStep === 'review' && (
        <ContentReviewCompletePanel
          brandName={brand.brandName}
          state={strategy}
          moduleStatus={moduleStatus}
          progress={progress}
          completionCheck={completionCheck}
          saving={saving}
          onJumpToSection={(step) => setActiveStep(step)}
          onCompleteModule={() => void handleCompleteModule()}
          onPrev={() => setActiveStep('governance')}
        />
      )}

      {/* Regeneration Safeguard Dialog */}
      <ConfirmDialog
        open={confirmRegenTarget !== null}
        title="Regenerate AI Content Strategy Recommendations?"
        description="This generates a fresh set of AI recommendations in the pending review queue. Your existing draft and approved items will NOT be overwritten or removed."
        confirmLabel="Regenerate Recommendations"
        cancelLabel="Cancel"
        variant="primary"
        onCancel={() => setConfirmRegenTarget(null)}
        onConfirm={() => {
          const target = confirmRegenTarget;
          setConfirmRegenTarget(null);
          if (target) void runModularGeneration(target);
        }}
      />

      {/* Deletion Confirmation Dialog */}
      <ConfirmDialog
        open={pendingDelete !== null}
        title="Remove Content Strategy Item?"
        description={
          pendingDelete?.kind === 'pillar'
            ? 'Removing this content pillar will unlink any themes connected to it and return those themes to draft review.'
            : 'This will remove the selected item from your Content Strategy workspace.'
        }
        confirmLabel="Remove Item"
        cancelLabel="Cancel"
        variant="danger"
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => void handleConfirmDelete()}
      />
    </div>
  );
}
