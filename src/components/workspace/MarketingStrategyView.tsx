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
  Users,
} from 'lucide-react';
import { api } from '../../services/api';
import { executeBrandPrompt } from '../../services/promptExecution';
import type { Brand, BrandStrategyModule, ModuleStatus } from '../../types/brand';
import { FOUNDATION_SECTIONS } from '../../utils/brandFoundationLogic';
import { MESSAGING_SECTIONS } from '../../utils/brandMessagingLogic';
import { ConfirmDialog } from '../common/ConfirmDialog';
import {
  MARKETING_STRATEGY_SECTIONS,
  adoptAiChannelSuggestion,
  adoptAiGoalSuggestion,
  adoptAiKpiSuggestion,
  adoptAiObjectiveSuggestion,
  adoptAiRoadmapSuggestion,
  adoptAiTacticSuggestion,
  applyAiChannelsTacticsResult,
  applyAiGoalsObjectivesResult,
  applyAiKpisResult,
  applyAiRoadmapResult,
  buildMarketingPromptVariables,
  buildMarketingStrategyUpsertPayload,
  canCompleteMarketingStrategy,
  checkChannelsTacticsReadiness,
  checkGoalsObjectivesReadiness,
  checkKpisReadiness,
  checkRoadmapReadiness,
  computeMarketingStrategyProgress,
  createBlankMarketingChannel,
  createBlankMarketingKpi,
  createBlankMarketingObjective,
  createBlankMarketingTactic,
  createBlankRoadmapItem,
  createBlankSmartGoal,
  createInitialMarketingStrategyState,
  dismissAiChannelSuggestion,
  dismissAiGoalSuggestion,
  dismissAiKpiSuggestion,
  dismissAiObjectiveSuggestion,
  dismissAiRoadmapSuggestion,
  dismissAiTacticSuggestion,
  hydrateMarketingStrategyState,
  removeChannelFromState,
  removeGoalFromState,
  removeKpiFromState,
  removeObjectiveFromState,
  removeRoadmapItemFromState,
  removeTacticFromState,
  validateMarketingChannel,
  validateMarketingKpi,
  validateMarketingObjective,
  validateMarketingTactic,
  validateRoadmapActivity,
  validateSmartGoal,
  type BusinessContextGapsInput,
  type ImplementationRoadmapItem,
  type MarketingChannelItem,
  type MarketingKpiItem,
  type MarketingObjectiveItem,
  type MarketingStrategyState,
  type MarketingStrategyStepKey,
  type MarketingTacticItem,
  type SmartMarketingGoalItem,
} from '../../utils/marketingStrategyLogic';
import {
  ChannelsPanel,
  GoalsPanel,
  KpisPanel,
  ObjectivesPanel,
  ReviewCompletePanel,
  RoadmapPanel,
  TacticsPanel,
} from './MarketingStrategyPanels';

interface MarketingStrategyViewProps {
  brand: Brand;
  onModuleSaved: (module: BrandStrategyModule) => void | Promise<void>;
  onToast: (type: 'success' | 'error', message: string) => void;
  onNavigateToBrandFoundation: () => void;
  onNavigateToBrandMessaging: () => void;
  onNavigateToCustomerIntelligence: () => void;
  onNavigateToBrandSettings: () => void;
}

type RegenTarget = 'goalsObjectives' | 'channelsTactics' | 'kpis' | 'roadmap';

type DeleteTarget =
  | { kind: 'goal'; item: SmartMarketingGoalItem }
  | { kind: 'objective'; item: MarketingObjectiveItem }
  | { kind: 'channel'; item: MarketingChannelItem }
  | { kind: 'tactic'; item: MarketingTacticItem }
  | { kind: 'kpi'; item: MarketingKpiItem }
  | { kind: 'roadmap'; item: ImplementationRoadmapItem };

function createEntityId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function MarketingStrategyView({
  brand,
  onModuleSaved,
  onToast,
  onNavigateToBrandFoundation,
  onNavigateToBrandMessaging,
  onNavigateToCustomerIntelligence,
  onNavigateToBrandSettings,
}: MarketingStrategyViewProps) {
  const [strategy, setStrategy] = useState<MarketingStrategyState>(() =>
    createInitialMarketingStrategyState(brand),
  );
  const [strategyModules, setStrategyModules] = useState<BrandStrategyModule[]>([]);
  const [moduleStatus, setModuleStatus] = useState<ModuleStatus>(
    brand.moduleStatuses.marketingStrategy ?? 'not_started',
  );
  const [activeStep, setActiveStep] = useState<MarketingStrategyStepKey>('goals');
  const [loadingModule, setLoadingModule] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState<boolean>(false);

  const [generatingTarget, setGeneratingTarget] = useState<RegenTarget | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
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

        const existingMs = modules.find((m) => m.moduleKey === 'marketingStrategy') ?? null;
        let readiness;
        try {
          readiness = checkGoalsObjectivesReadiness(brand, modules);
        } catch {
          readiness = null;
        }

        const hydrated = hydrateMarketingStrategyState(
          brand,
          existingMs,
          readiness?.dependencyEvaluation.upstreamSnapshot ?? null,
        );
        setStrategy(hydrated);
        setModuleStatus(
          existingMs?.status ?? brand.moduleStatuses.marketingStrategy ?? 'not_started',
        );

        if (existingMs?.status === 'completed') {
          setActiveStep('review');
        } else {
          setActiveStep('goals');
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setStrategyModules([]);
        setStrategy(createInitialMarketingStrategyState(brand));
        setLoadError(
          err instanceof Error
            ? err.message
            : 'Unable to load Marketing Strategy workspace.',
        );
      })
      .finally(() => {
        if (!cancelled) setLoadingModule(false);
      });

    return () => {
      cancelled = true;
    };
  }, [brand.id]);

  const goalsReadiness = useMemo(() => {
    try {
      return checkGoalsObjectivesReadiness(brand, strategyModules);
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
          personasReady: false,
          interestsReady: false,
          foundationStatus: 'not_started' as ModuleStatus,
          messagingStatus: 'not_started' as ModuleStatus,
          customerIntelStatus: 'not_started' as ModuleStatus,
          missingFoundationSections: FOUNDATION_SECTIONS.map((s) => s.key),
          missingMessagingSections: MESSAGING_SECTIONS.map((s) => s.key),
          approvedPersonasCount: 0,
          approvedInterestsCount: 0,
          approvedFoundation: null,
          approvedMessaging: null,
          approvedPersonas: [],
          approvedInterests: [],
          upstreamSnapshot: null,
          reason: err instanceof Error ? err.message : 'Brand context isolation error.',
        },
        reason: err instanceof Error ? err.message : 'Brand context isolation error.',
      };
    }
  }, [brand, strategyModules]);

  const channelsReadiness = useMemo(() => {
    try {
      return checkChannelsTacticsReadiness(brand, strategyModules, strategy);
    } catch (err) {
      return {
        ready: false,
        dependenciesReady: false,
        hasApprovedGoals: false,
        hasApprovedObjectives: false,
        reason: err instanceof Error ? err.message : 'Brand context isolation error.',
      };
    }
  }, [brand, strategyModules, strategy]);

  const kpisReadiness = useMemo(() => {
    try {
      return checkKpisReadiness(brand, strategyModules, strategy);
    } catch (err) {
      return {
        ready: false,
        dependenciesReady: false,
        hasApprovedChannels: false,
        hasApprovedTactics: false,
        reason: err instanceof Error ? err.message : 'Brand context isolation error.',
      };
    }
  }, [brand, strategyModules, strategy]);

  const roadmapReadiness = useMemo(() => {
    try {
      return checkRoadmapReadiness(brand, strategyModules, strategy);
    } catch (err) {
      return {
        ready: false,
        dependenciesReady: false,
        hasApprovedChannels: false,
        hasApprovedTactics: false,
        reason: err instanceof Error ? err.message : 'Brand context isolation error.',
      };
    }
  }, [brand, strategyModules, strategy]);

  const progress = useMemo(() => computeMarketingStrategyProgress(strategy), [strategy]);
  const completionCheck = useMemo(() => canCompleteMarketingStrategy(strategy), [strategy]);

  const persistState = async (
    nextState: MarketingStrategyState,
    requestedStatus: ModuleStatus,
    successMessage?: string,
  ): Promise<boolean> => {
    setSaving(true);
    try {
      const payload = buildMarketingStrategyUpsertPayload(nextState, requestedStatus);
      const { module } = await api.upsertStrategyModule(
        brand.id,
        'marketingStrategy',
        payload,
      );
      const refreshed = hydrateMarketingStrategyState(
        brand,
        module,
        goalsReadiness.dependencyEvaluation.upstreamSnapshot ?? nextState.upstreamSnapshot,
      );
      setStrategy(refreshed);
      setModuleStatus(module.status);
      setStrategyModules((prev) => [
        ...prev.filter((m) => m.moduleKey !== 'marketingStrategy'),
        module,
      ]);
      await onModuleSaved(module);
      if (successMessage) {
        onToast('success', successMessage);
      }
      return true;
    } catch (err) {
      onToast(
        'error',
        err instanceof Error ? err.message : 'Failed to save Marketing Strategy.',
      );
      return false;
    } finally {
      setSaving(false);
    }
  };

  // =========================================================================
  // MODULAR AI GENERATION RUNNERS (4 PROMPTS)
  // =========================================================================

  const runModularGeneration = async (target: RegenTarget) => {
    setAiError(null);
    setMissingInfoNotice(null);

    if (!goalsReadiness.dependenciesReady) {
      setAiError(
        goalsReadiness.reason ??
          'Complete Brand Foundation, Brand Messaging, and approve at least one Customer Persona and Audience Interest cluster first.',
      );
      return;
    }

    if (!goalsReadiness.profileReady) {
      setMissingInfoNotice({
        message: 'Complete the required brand profile fields before running AI strategy generation.',
        missingFields: goalsReadiness.missingProfileFields,
      });
      return;
    }

    if (target === 'channelsTactics' && !channelsReadiness.ready) {
      setAiError(
        channelsReadiness.reason ??
          'Approve at least one SMART Goal and Marketing Objective first.',
      );
      return;
    }

    if (target === 'kpis' && !kpisReadiness.ready) {
      setAiError(
        kpisReadiness.reason ??
          'Approve at least one Marketing Channel and Marketing Tactic first.',
      );
      return;
    }

    if (target === 'roadmap' && !roadmapReadiness.ready) {
      setAiError(
        roadmapReadiness.reason ??
          'Approve at least one Marketing Channel and Marketing Tactic first.',
      );
      return;
    }

    setGeneratingTarget(target);
    try {
      // Persist latest approved marketing strategy records to server before downstream prompts
      // so server-side buildVerifiedBrandContext injects freshly approved items cleanly.
      if (target !== 'goalsObjectives') {
        const synced = await persistState(
          strategy,
          moduleStatus === 'completed' ? 'completed' : 'in_progress',
        );
        if (!synced) return;
      }

      const promptIdMap: Record<RegenTarget, string> = {
        goalsObjectives: 'marketing_strategy_goals_objectives',
        channelsTactics: 'marketing_strategy_channels_tactics',
        kpis: 'marketing_strategy_kpis',
        roadmap: 'marketing_strategy_roadmap',
      };

      const result = await executeBrandPrompt({
        brandId: brand.id,
        promptId: promptIdMap[target],
        includeApprovedModules: true,
        expectedOwnerUserId: brand.userId,
        variables: buildMarketingPromptVariables(brand, strategy),
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
        return;
      }

      const applied =
        target === 'goalsObjectives'
          ? applyAiGoalsObjectivesResult(strategy, result)
          : target === 'channelsTactics'
            ? applyAiChannelsTacticsResult(strategy, result)
            : target === 'kpis'
              ? applyAiKpisResult(strategy, result)
              : applyAiRoadmapResult(strategy, result);

      if (!applied.applied) {
        setAiError(applied.error ?? 'AI recommendations failed structured validation.');
        return;
      }

      const nextState: MarketingStrategyState = {
        ...applied.state,
        upstreamSnapshot:
          goalsReadiness.dependencyEvaluation.upstreamSnapshot ??
          applied.state.upstreamSnapshot,
      };
      setStrategy(nextState);

      const toastCopy: Record<RegenTarget, string> = {
        goalsObjectives:
          'Generated AI SMART Goals & Objectives for review. Existing approved items remain protected.',
        channelsTactics:
          'Generated AI Channels & Tactics grounded in approved strategy. Approved items remain protected.',
        kpis: 'Generated AI KPIs & Measurement proposals for review. Approved items remain protected.',
        roadmap:
          'Generated phased AI Implementation Roadmap for review. Approved items remain protected.',
      };

      await persistState(
        nextState,
        moduleStatus === 'completed' ? 'completed' : 'in_progress',
        toastCopy[target],
      );
    } catch (err) {
      setAiError(
        err instanceof Error ? err.message : 'Unable to generate Marketing Strategy recommendations.',
      );
    } finally {
      setGeneratingTarget(null);
    }
  };

  const requestGeneration = (target: RegenTarget) => {
    if (generatingTarget || saving) return;
    const hasExisting =
      target === 'goalsObjectives'
        ? strategy.goals.length > 0 ||
          strategy.objectives.length > 0 ||
          Boolean(strategy.goalsObjectivesSynthesis.generatedAt)
        : target === 'channelsTactics'
          ? strategy.channels.length > 0 ||
            strategy.tactics.length > 0 ||
            Boolean(strategy.channelsTacticsSynthesis.generatedAt)
          : target === 'kpis'
            ? strategy.kpis.length > 0 || Boolean(strategy.kpisSynthesis.generatedAt)
            : strategy.roadmapItems.length > 0 || Boolean(strategy.roadmapSynthesis.generatedAt);

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

  const updateBusinessContext = (patch: Partial<BusinessContextGapsInput>) => {
    setStrategy((prev) => ({
      ...prev,
      businessContext: { ...prev.businessContext, ...patch },
    }));
  };

  const updateGoal = (id: string, patch: Partial<SmartMarketingGoalItem>) => {
    clearErrors(id);
    setStrategy((prev) => ({
      ...prev,
      completedAt: null,
      approvedSummary: null,
      goals: prev.goals.map((g) => {
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

  const approveGoal = async (goal: SmartMarketingGoalItem) => {
    const errs = validateSmartGoal(goal);
    if (Object.keys(errs).length > 0) {
      setErrorsMap((prev) => ({ ...prev, [goal.id]: errs }));
      setEditingIds((prev) => ({ ...prev, [goal.id]: true }));
      return;
    }
    const nowIso = new Date().toISOString();
    const updated: MarketingStrategyState = {
      ...strategy,
      goals: strategy.goals.map((g) =>
        g.id === goal.id ? { ...g, approved: true, approvedAt: nowIso } : g,
      ),
    };
    setStrategy(updated);
    toggleEdit(goal.id, false);
    await persistState(
      updated,
      moduleStatus === 'completed' && canCompleteMarketingStrategy(updated).allowed
        ? 'completed'
        : 'in_progress',
      `Approved SMART goal "${goal.title}".`,
    );
  };

  const unapproveGoal = async (id: string) => {
    const updated: MarketingStrategyState = {
      ...strategy,
      completedAt: null,
      approvedSummary: null,
      goals: strategy.goals.map((g) =>
        g.id === id ? { ...g, approved: false, approvedAt: null } : g,
      ),
    };
    setStrategy(updated);
    if (moduleStatus === 'completed') setModuleStatus('in_progress');
    await persistState(updated, 'in_progress', 'Goal moved back to draft review.');
  };

  const updateObjective = (id: string, patch: Partial<MarketingObjectiveItem>) => {
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

  const approveObjective = async (obj: MarketingObjectiveItem) => {
    const errs = validateMarketingObjective(obj, strategy.goals);
    if (Object.keys(errs).length > 0) {
      setErrorsMap((prev) => ({ ...prev, [obj.id]: errs }));
      setEditingIds((prev) => ({ ...prev, [obj.id]: true }));
      return;
    }
    const nowIso = new Date().toISOString();
    const updated: MarketingStrategyState = {
      ...strategy,
      objectives: strategy.objectives.map((o) =>
        o.id === obj.id ? { ...o, approved: true, approvedAt: nowIso } : o,
      ),
    };
    setStrategy(updated);
    toggleEdit(obj.id, false);
    await persistState(
      updated,
      moduleStatus === 'completed' && canCompleteMarketingStrategy(updated).allowed
        ? 'completed'
        : 'in_progress',
      `Approved objective "${obj.title}".`,
    );
  };

  const unapproveObjective = async (id: string) => {
    const updated: MarketingStrategyState = {
      ...strategy,
      completedAt: null,
      approvedSummary: null,
      objectives: strategy.objectives.map((o) =>
        o.id === id ? { ...o, approved: false, approvedAt: null } : o,
      ),
    };
    setStrategy(updated);
    if (moduleStatus === 'completed') setModuleStatus('in_progress');
    await persistState(updated, 'in_progress', 'Objective moved back to draft review.');
  };

  const updateChannel = (id: string, patch: Partial<MarketingChannelItem>) => {
    clearErrors(id);
    setStrategy((prev) => ({
      ...prev,
      completedAt: null,
      approvedSummary: null,
      channels: prev.channels.map((c) => {
        if (c.id !== id) return c;
        const nextSource =
          c.source === 'ai_adopted' && patch.source === undefined
            ? 'edited_ai'
            : (patch.source ?? c.source);
        return {
          ...c,
          ...patch,
          source: nextSource,
          approved: patch.approved !== undefined ? patch.approved : false,
          approvedAt: patch.approved !== undefined ? (patch.approvedAt ?? null) : null,
        };
      }),
    }));
    if (moduleStatus === 'completed') setModuleStatus('in_progress');
  };

  const approveChannel = async (ch: MarketingChannelItem) => {
    const errs = validateMarketingChannel(ch, strategy.objectives);
    if (Object.keys(errs).length > 0) {
      setErrorsMap((prev) => ({ ...prev, [ch.id]: errs }));
      setEditingIds((prev) => ({ ...prev, [ch.id]: true }));
      return;
    }
    const nowIso = new Date().toISOString();
    const updated: MarketingStrategyState = {
      ...strategy,
      channels: strategy.channels.map((c) =>
        c.id === ch.id ? { ...c, approved: true, approvedAt: nowIso } : c,
      ),
    };
    setStrategy(updated);
    toggleEdit(ch.id, false);
    await persistState(
      updated,
      moduleStatus === 'completed' && canCompleteMarketingStrategy(updated).allowed
        ? 'completed'
        : 'in_progress',
      `Approved channel "${ch.channelName}".`,
    );
  };

  const unapproveChannel = async (id: string) => {
    const updated: MarketingStrategyState = {
      ...strategy,
      completedAt: null,
      approvedSummary: null,
      channels: strategy.channels.map((c) =>
        c.id === id ? { ...c, approved: false, approvedAt: null } : c,
      ),
    };
    setStrategy(updated);
    if (moduleStatus === 'completed') setModuleStatus('in_progress');
    await persistState(updated, 'in_progress', 'Channel moved back to draft review.');
  };

  const updateTactic = (id: string, patch: Partial<MarketingTacticItem>) => {
    clearErrors(id);
    setStrategy((prev) => ({
      ...prev,
      completedAt: null,
      approvedSummary: null,
      tactics: prev.tactics.map((t) => {
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

  const approveTactic = async (tactic: MarketingTacticItem) => {
    const errs = validateMarketingTactic(tactic, strategy.objectives, strategy.channels);
    if (Object.keys(errs).length > 0) {
      setErrorsMap((prev) => ({ ...prev, [tactic.id]: errs }));
      setEditingIds((prev) => ({ ...prev, [tactic.id]: true }));
      return;
    }
    const nowIso = new Date().toISOString();
    const updated: MarketingStrategyState = {
      ...strategy,
      tactics: strategy.tactics.map((t) =>
        t.id === tactic.id ? { ...t, approved: true, approvedAt: nowIso } : t,
      ),
    };
    setStrategy(updated);
    toggleEdit(tactic.id, false);
    await persistState(
      updated,
      moduleStatus === 'completed' && canCompleteMarketingStrategy(updated).allowed
        ? 'completed'
        : 'in_progress',
      `Approved tactic "${tactic.tacticName}".`,
    );
  };

  const unapproveTactic = async (id: string) => {
    const updated: MarketingStrategyState = {
      ...strategy,
      completedAt: null,
      approvedSummary: null,
      tactics: strategy.tactics.map((t) =>
        t.id === id ? { ...t, approved: false, approvedAt: null } : t,
      ),
    };
    setStrategy(updated);
    if (moduleStatus === 'completed') setModuleStatus('in_progress');
    await persistState(updated, 'in_progress', 'Tactic moved back to draft review.');
  };

  const updateKpi = (id: string, patch: Partial<MarketingKpiItem>) => {
    clearErrors(id);
    setStrategy((prev) => ({
      ...prev,
      completedAt: null,
      approvedSummary: null,
      kpis: prev.kpis.map((k) => {
        if (k.id !== id) return k;
        const nextSource =
          k.source === 'ai_adopted' && patch.source === undefined
            ? 'edited_ai'
            : (patch.source ?? k.source);
        return {
          ...k,
          ...patch,
          source: nextSource,
          approved: patch.approved !== undefined ? patch.approved : false,
          approvedAt: patch.approved !== undefined ? (patch.approvedAt ?? null) : null,
        };
      }),
    }));
    if (moduleStatus === 'completed') setModuleStatus('in_progress');
  };

  const approveKpi = async (kpi: MarketingKpiItem) => {
    const errs = validateMarketingKpi(kpi, strategy.objectives);
    if (Object.keys(errs).length > 0) {
      setErrorsMap((prev) => ({ ...prev, [kpi.id]: errs }));
      setEditingIds((prev) => ({ ...prev, [kpi.id]: true }));
      return;
    }
    const nowIso = new Date().toISOString();
    const updated: MarketingStrategyState = {
      ...strategy,
      kpis: strategy.kpis.map((k) =>
        k.id === kpi.id ? { ...k, approved: true, approvedAt: nowIso } : k,
      ),
    };
    setStrategy(updated);
    toggleEdit(kpi.id, false);
    await persistState(
      updated,
      moduleStatus === 'completed' && canCompleteMarketingStrategy(updated).allowed
        ? 'completed'
        : 'in_progress',
      `Approved KPI "${kpi.kpiName}".`,
    );
  };

  const unapproveKpi = async (id: string) => {
    const updated: MarketingStrategyState = {
      ...strategy,
      completedAt: null,
      approvedSummary: null,
      kpis: strategy.kpis.map((k) =>
        k.id === id ? { ...k, approved: false, approvedAt: null } : k,
      ),
    };
    setStrategy(updated);
    if (moduleStatus === 'completed') setModuleStatus('in_progress');
    await persistState(updated, 'in_progress', 'KPI moved back to draft review.');
  };

  const updateRoadmap = (id: string, patch: Partial<ImplementationRoadmapItem>) => {
    clearErrors(id);
    setStrategy((prev) => ({
      ...prev,
      completedAt: null,
      approvedSummary: null,
      roadmapItems: prev.roadmapItems.map((r) => {
        if (r.id !== id) return r;
        const nextSource =
          r.source === 'ai_adopted' && patch.source === undefined
            ? 'edited_ai'
            : (patch.source ?? r.source);
        return {
          ...r,
          ...patch,
          source: nextSource,
          approved: patch.approved !== undefined ? patch.approved : false,
          approvedAt: patch.approved !== undefined ? (patch.approvedAt ?? null) : null,
        };
      }),
    }));
    if (moduleStatus === 'completed') setModuleStatus('in_progress');
  };

  const approveRoadmap = async (item: ImplementationRoadmapItem) => {
    const errs = validateRoadmapActivity(item, strategy.objectives);
    if (Object.keys(errs).length > 0) {
      setErrorsMap((prev) => ({ ...prev, [item.id]: errs }));
      setEditingIds((prev) => ({ ...prev, [item.id]: true }));
      return;
    }
    const nowIso = new Date().toISOString();
    const updated: MarketingStrategyState = {
      ...strategy,
      roadmapItems: strategy.roadmapItems.map((r) =>
        r.id === item.id ? { ...r, approved: true, approvedAt: nowIso } : r,
      ),
    };
    setStrategy(updated);
    toggleEdit(item.id, false);
    await persistState(
      updated,
      moduleStatus === 'completed' && canCompleteMarketingStrategy(updated).allowed
        ? 'completed'
        : 'in_progress',
      `Approved roadmap activity "${item.activity}".`,
    );
  };

  const unapproveRoadmap = async (id: string) => {
    const updated: MarketingStrategyState = {
      ...strategy,
      completedAt: null,
      approvedSummary: null,
      roadmapItems: strategy.roadmapItems.map((r) =>
        r.id === id ? { ...r, approved: false, approvedAt: null } : r,
      ),
    };
    setStrategy(updated);
    if (moduleStatus === 'completed') setModuleStatus('in_progress');
    await persistState(updated, 'in_progress', 'Roadmap activity moved back to draft review.');
  };

  const handleConfirmDelete = async () => {
    if (!pendingDelete) return;
    let nextState = strategy;
    let label = 'Item';

    switch (pendingDelete.kind) {
      case 'goal':
        label = pendingDelete.item.title || 'SMART Goal';
        nextState = removeGoalFromState(strategy, pendingDelete.item.id);
        break;
      case 'objective':
        label = pendingDelete.item.title || 'Objective';
        nextState = removeObjectiveFromState(strategy, pendingDelete.item.id);
        break;
      case 'channel':
        label = pendingDelete.item.channelName || 'Channel';
        nextState = removeChannelFromState(strategy, pendingDelete.item.id);
        break;
      case 'tactic':
        label = pendingDelete.item.tacticName || 'Tactic';
        nextState = removeTacticFromState(strategy, pendingDelete.item.id);
        break;
      case 'kpi':
        label = pendingDelete.item.kpiName || 'KPI';
        nextState = removeKpiFromState(strategy, pendingDelete.item.id);
        break;
      case 'roadmap':
        label = pendingDelete.item.activity || 'Roadmap activity';
        nextState = removeRoadmapItemFromState(strategy, pendingDelete.item.id);
        break;
    }

    setPendingDelete(null);
    setStrategy(nextState);
    const nextStatus: ModuleStatus =
      moduleStatus === 'completed' && canCompleteMarketingStrategy(nextState).allowed
        ? 'completed'
        : 'in_progress';
    await persistState(nextState, nextStatus, `Removed "${label}".`);
  };

  const handleSaveProgress = async () => {
    const nextStatus: ModuleStatus =
      moduleStatus === 'completed' && completionCheck.allowed ? 'completed' : 'in_progress';
    await persistState(strategy, nextStatus, 'Saved Marketing Strategy progress.');
  };

  const handleCompleteModule = async () => {
    if (!completionCheck.allowed) {
      onToast(
        'error',
        completionCheck.blockers[0] ??
          'Approve valid items in all six Marketing Strategy sections before completing.',
      );
      return;
    }
    await persistState(
      strategy,
      'completed',
      'Marketing Strategy approved and marked completed.',
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

  const depEval = goalsReadiness.dependencyEvaluation;

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
                data-testid="marketing-strategy-module-status"
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
              Marketing Strategy
            </h2>
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-600">
              Transform <strong className="font-semibold text-slate-800">{brand.brandName}</strong>
              ’s approved brand foundation, messaging, and customer intelligence into SMART goals,
              objectives, channels, tactics, KPIs, and a phased roadmap.
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
              Marketing Strategy Progress across 6 core strategy sections
            </span>
            <span
              data-testid="marketing-strategy-progress-label"
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
          aria-label="Marketing Strategy Sections"
          className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-7"
        >
          {MARKETING_STRATEGY_SECTIONS.map((sec) => {
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
      {!goalsReadiness.dependenciesReady ? (
        <section
          role="status"
          data-testid="marketing-strategy-prerequisite"
          className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-amber-950"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle
              className="mt-0.5 h-5 w-5 shrink-0 text-amber-700"
              strokeWidth={1.75}
            />
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-semibold text-amber-950">
                Complete upstream brand and customer intelligence to unlock AI Marketing Strategy
              </h3>
              <p className="mt-1 text-xs leading-relaxed text-amber-900">
                Marketing Strategy AI generation requires completed Brand Foundation, completed
                Brand Messaging, at least one approved Customer Persona, and at least one approved
                Audience Interest cluster. Manual drafting remains available below.
              </p>

              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  {
                    label: 'Brand Foundation',
                    ready: depEval.foundationReady,
                    icon: Compass,
                    action: onNavigateToBrandFoundation,
                    cta: 'Complete Foundation',
                  },
                  {
                    label: 'Brand Messaging',
                    ready: depEval.messagingReady,
                    icon: MessageSquareText,
                    action: onNavigateToBrandMessaging,
                    cta: 'Complete Messaging',
                  },
                  {
                    label: 'Customer Personas',
                    ready: depEval.personasReady,
                    icon: Users,
                    action: onNavigateToCustomerIntelligence,
                    cta: 'Approve Persona',
                  },
                  {
                    label: 'Audience Interests',
                    ready: depEval.interestsReady,
                    icon: Users,
                    action: onNavigateToCustomerIntelligence,
                    cta: 'Approve Interest',
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
                          <span>Verified &amp; approved</span>
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
            data-testid="marketing-strategy-upstream-source"
            className="rounded-xl border border-slate-200 bg-slate-50/70 px-5 py-3.5"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs">
                <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-600" strokeWidth={1.75} />
                <span className="font-semibold text-slate-800">
                  Verified Upstream Anchor: Foundation, Messaging,{' '}
                  {depEval.approvedPersonasCount} Persona
                  {depEval.approvedPersonasCount === 1 ? '' : 's'} &{' '}
                  {depEval.approvedInterestsCount} Audience Interest
                  {depEval.approvedInterestsCount === 1 ? '' : 's'}
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
                  <dt className="font-semibold text-slate-700">Approved Audience Interests</dt>
                  <dd className="mt-0.5 text-slate-600">
                    {depEval.upstreamSnapshot.primaryInterestTopics.join(' · ')}
                  </dd>
                </div>
              </dl>
            )}
          </section>
        )
      )}

      {/* Optional Business Context & Constraints Panel (for missing info) */}
      <section className="rounded-xl border border-slate-200 bg-white">
        <button
          type="button"
          onClick={() => setShowContextPanel((prev) => !prev)}
          className="flex w-full items-center justify-between gap-3 px-5 py-3.5 text-left"
        >
          <div className="flex items-center gap-2 text-xs">
            <SlidersHorizontal className="h-4 w-4 text-slate-500 shrink-0" />
            <span className="font-semibold text-slate-800">
              Optional Business Context & Constraints (Budget, Capacity, Baselines, Timeline)
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
              BrandFlow AI never fabricates budgets, staffing, or historical baselines. Supply any
              real constraints below to sharpen AI strategy recommendations.
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Budget Constraints
                </label>
                <input
                  type="text"
                  value={strategy.businessContext.budgetConstraints}
                  onChange={(e) =>
                    updateBusinessContext({ budgetConstraints: e.target.value })
                  }
                  placeholder="e.g., Organic-first or $1,500/month test budget"
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Team & Operational Capacity
                </label>
                <input
                  type="text"
                  value={strategy.businessContext.teamCapacity}
                  onChange={(e) => updateBusinessContext({ teamCapacity: e.target.value })}
                  placeholder="e.g., Founder 4 hrs/week + part-time contractor"
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Known Baseline Performance
                </label>
                <input
                  type="text"
                  value={strategy.businessContext.baselinePerformance}
                  onChange={(e) =>
                    updateBusinessContext({ baselinePerformance: e.target.value })
                  }
                  placeholder="e.g., 800 monthly visits, no paid baseline yet"
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Target Planning Window
                </label>
                <input
                  type="text"
                  value={strategy.businessContext.targetTimeline}
                  onChange={(e) => updateBusinessContext({ targetTimeline: e.target.value })}
                  placeholder="e.g., Next 90 days"
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
            AI Recommendations vs. Approved Strategy:
          </strong>{' '}
          All AI-generated goals, objectives, channels, tactics, KPIs, and roadmap items stay in a
          review queue until adopted, edited as needed, and explicitly approved by you.
        </p>
      </div>

      {/* Alerts */}
      {loadError && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900"
        >
          {loadError}
        </div>
      )}

      {missingInfoNotice && (
        <div
          role="alert"
          data-testid="marketing-strategy-missing-info"
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
          data-testid="marketing-strategy-ai-error"
          className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900"
        >
          {aiError}
        </div>
      )}

      {/* Active Step Panels */}
      {activeStep === 'goals' && (
        <GoalsPanel
          state={strategy}
          generating={generatingTarget === 'goalsObjectives'}
          canGenerate={goalsReadiness.dependenciesReady}
          disabledReason={goalsReadiness.reason}
          editingIds={editingIds}
          errorsMap={errorsMap}
          onToggleEdit={toggleEdit}
          onGenerate={() => requestGeneration('goalsObjectives')}
          onAddManual={() => {
            const id = createEntityId('goal');
            setStrategy((prev) => ({
              ...prev,
              completedAt: null,
              approvedSummary: null,
              goals: [...prev.goals, createBlankSmartGoal(id)],
            }));
            toggleEdit(id, true);
          }}
          onAdoptSuggestion={(suggId) => {
            const newId = createEntityId('goal');
            const { state: next } = adoptAiGoalSuggestion(strategy, suggId, newId);
            setStrategy(next);
            onToast('success', 'Adopted SMART goal as draft. Review and approve when ready.');
          }}
          onDismissSuggestion={(suggId) =>
            setStrategy((prev) => dismissAiGoalSuggestion(prev, suggId))
          }
          onUpdateGoal={updateGoal}
          onApproveGoal={(g) => void approveGoal(g)}
          onUnapproveGoal={(id) => void unapproveGoal(id)}
          onRequestDeleteGoal={(item) => setPendingDelete({ kind: 'goal', item })}
          onNext={() => setActiveStep('objectives')}
        />
      )}

      {activeStep === 'objectives' && (
        <ObjectivesPanel
          state={strategy}
          generating={generatingTarget === 'goalsObjectives'}
          canGenerate={goalsReadiness.dependenciesReady}
          disabledReason={goalsReadiness.reason}
          editingIds={editingIds}
          errorsMap={errorsMap}
          onToggleEdit={toggleEdit}
          onGenerate={() => requestGeneration('goalsObjectives')}
          onAddManual={() => {
            const id = createEntityId('objective');
            const defaultGoal = strategy.goals.find((g) => g.approved) ?? strategy.goals[0];
            setStrategy((prev) => ({
              ...prev,
              completedAt: null,
              approvedSummary: null,
              objectives: [
                ...prev.objectives,
                createBlankMarketingObjective(
                  id,
                  defaultGoal ? { id: defaultGoal.id, title: defaultGoal.title } : undefined,
                ),
              ],
            }));
            toggleEdit(id, true);
          }}
          onAdoptSuggestion={(suggId) => {
            const newId = createEntityId('objective');
            const { state: next } = adoptAiObjectiveSuggestion(strategy, suggId, newId);
            setStrategy(next);
            onToast('success', 'Adopted objective as draft. Review and approve when ready.');
          }}
          onDismissSuggestion={(suggId) =>
            setStrategy((prev) => dismissAiObjectiveSuggestion(prev, suggId))
          }
          onUpdateObjective={updateObjective}
          onApproveObjective={(o) => void approveObjective(o)}
          onUnapproveObjective={(id) => void unapproveObjective(id)}
          onRequestDeleteObjective={(item) => setPendingDelete({ kind: 'objective', item })}
          onPrev={() => setActiveStep('goals')}
          onNext={() => setActiveStep('channels')}
        />
      )}

      {activeStep === 'channels' && (
        <ChannelsPanel
          state={strategy}
          generating={generatingTarget === 'channelsTactics'}
          canGenerate={channelsReadiness.ready}
          disabledReason={channelsReadiness.reason}
          editingIds={editingIds}
          errorsMap={errorsMap}
          onToggleEdit={toggleEdit}
          onGenerate={() => requestGeneration('channelsTactics')}
          onAddManual={() => {
            const id = createEntityId('channel');
            const defaultObj =
              strategy.objectives.find((o) => o.approved) ?? strategy.objectives[0];
            setStrategy((prev) => ({
              ...prev,
              completedAt: null,
              approvedSummary: null,
              channels: [
                ...prev.channels,
                createBlankMarketingChannel(
                  id,
                  defaultObj ? { id: defaultObj.id, title: defaultObj.title } : undefined,
                ),
              ],
            }));
            toggleEdit(id, true);
          }}
          onAdoptSuggestion={(suggId) => {
            const newId = createEntityId('channel');
            const { state: next } = adoptAiChannelSuggestion(strategy, suggId, newId);
            setStrategy(next);
            onToast('success', 'Adopted channel as draft. Review and approve when ready.');
          }}
          onDismissSuggestion={(suggId) =>
            setStrategy((prev) => dismissAiChannelSuggestion(prev, suggId))
          }
          onUpdateChannel={updateChannel}
          onApproveChannel={(c) => void approveChannel(c)}
          onUnapproveChannel={(id) => void unapproveChannel(id)}
          onRequestDeleteChannel={(item) => setPendingDelete({ kind: 'channel', item })}
          onPrev={() => setActiveStep('objectives')}
          onNext={() => setActiveStep('tactics')}
        />
      )}

      {activeStep === 'tactics' && (
        <TacticsPanel
          state={strategy}
          generating={generatingTarget === 'channelsTactics'}
          canGenerate={channelsReadiness.ready}
          disabledReason={channelsReadiness.reason}
          editingIds={editingIds}
          errorsMap={errorsMap}
          onToggleEdit={toggleEdit}
          onGenerate={() => requestGeneration('channelsTactics')}
          onAddManual={() => {
            const id = createEntityId('tactic');
            const defaultObj =
              strategy.objectives.find((o) => o.approved) ?? strategy.objectives[0];
            const defaultChan =
              strategy.channels.find((c) => c.approved) ?? strategy.channels[0];
            setStrategy((prev) => ({
              ...prev,
              completedAt: null,
              approvedSummary: null,
              tactics: [
                ...prev.tactics,
                createBlankMarketingTactic(id, {
                  objective: defaultObj
                    ? { id: defaultObj.id, title: defaultObj.title }
                    : undefined,
                  channel: defaultChan
                    ? { id: defaultChan.id, name: defaultChan.channelName }
                    : undefined,
                }),
              ],
            }));
            toggleEdit(id, true);
          }}
          onAdoptSuggestion={(suggId) => {
            const newId = createEntityId('tactic');
            const { state: next } = adoptAiTacticSuggestion(strategy, suggId, newId);
            setStrategy(next);
            onToast('success', 'Adopted tactic as draft. Review and approve when ready.');
          }}
          onDismissSuggestion={(suggId) =>
            setStrategy((prev) => dismissAiTacticSuggestion(prev, suggId))
          }
          onUpdateTactic={updateTactic}
          onApproveTactic={(t) => void approveTactic(t)}
          onUnapproveTactic={(id) => void unapproveTactic(id)}
          onRequestDeleteTactic={(item) => setPendingDelete({ kind: 'tactic', item })}
          onPrev={() => setActiveStep('channels')}
          onNext={() => setActiveStep('kpis')}
        />
      )}

      {activeStep === 'kpis' && (
        <KpisPanel
          state={strategy}
          generating={generatingTarget === 'kpis'}
          canGenerate={kpisReadiness.ready}
          disabledReason={kpisReadiness.reason}
          editingIds={editingIds}
          errorsMap={errorsMap}
          onToggleEdit={toggleEdit}
          onGenerate={() => requestGeneration('kpis')}
          onAddManual={() => {
            const id = createEntityId('kpi');
            const defaultObj =
              strategy.objectives.find((o) => o.approved) ?? strategy.objectives[0];
            setStrategy((prev) => ({
              ...prev,
              completedAt: null,
              approvedSummary: null,
              kpis: [
                ...prev.kpis,
                createBlankMarketingKpi(
                  id,
                  defaultObj ? { id: defaultObj.id, title: defaultObj.title } : undefined,
                ),
              ],
            }));
            toggleEdit(id, true);
          }}
          onAdoptSuggestion={(suggId) => {
            const newId = createEntityId('kpi');
            const { state: next } = adoptAiKpiSuggestion(strategy, suggId, newId);
            setStrategy(next);
            onToast('success', 'Adopted KPI as draft. Review baseline note and approve.');
          }}
          onDismissSuggestion={(suggId) =>
            setStrategy((prev) => dismissAiKpiSuggestion(prev, suggId))
          }
          onUpdateKpi={updateKpi}
          onApproveKpi={(k) => void approveKpi(k)}
          onUnapproveKpi={(id) => void unapproveKpi(id)}
          onRequestDeleteKpi={(item) => setPendingDelete({ kind: 'kpi', item })}
          onPrev={() => setActiveStep('tactics')}
          onNext={() => setActiveStep('roadmap')}
        />
      )}

      {activeStep === 'roadmap' && (
        <RoadmapPanel
          state={strategy}
          generating={generatingTarget === 'roadmap'}
          canGenerate={roadmapReadiness.ready}
          disabledReason={roadmapReadiness.reason}
          editingIds={editingIds}
          errorsMap={errorsMap}
          onToggleEdit={toggleEdit}
          onGenerate={() => requestGeneration('roadmap')}
          onAddManual={() => {
            const id = createEntityId('roadmap');
            const defaultObj =
              strategy.objectives.find((o) => o.approved) ?? strategy.objectives[0];
            setStrategy((prev) => ({
              ...prev,
              completedAt: null,
              approvedSummary: null,
              roadmapItems: [
                ...prev.roadmapItems,
                createBlankRoadmapItem(
                  id,
                  defaultObj ? { id: defaultObj.id, title: defaultObj.title } : undefined,
                ),
              ],
            }));
            toggleEdit(id, true);
          }}
          onAdoptSuggestion={(suggId) => {
            const newId = createEntityId('roadmap');
            const { state: next } = adoptAiRoadmapSuggestion(strategy, suggId, newId);
            setStrategy(next);
            onToast('success', 'Adopted roadmap activity as draft. Review and approve.');
          }}
          onDismissSuggestion={(suggId) =>
            setStrategy((prev) => dismissAiRoadmapSuggestion(prev, suggId))
          }
          onUpdateRoadmap={updateRoadmap}
          onApproveRoadmap={(r) => void approveRoadmap(r)}
          onUnapproveRoadmap={(id) => void unapproveRoadmap(id)}
          onRequestDeleteRoadmap={(item) => setPendingDelete({ kind: 'roadmap', item })}
          onPrev={() => setActiveStep('kpis')}
          onNext={() => setActiveStep('review')}
        />
      )}

      {activeStep === 'review' && (
        <ReviewCompletePanel
          brandName={brand.brandName}
          state={strategy}
          moduleStatus={moduleStatus}
          progress={progress}
          completionCheck={completionCheck}
          saving={saving}
          onJumpToSection={(step) => setActiveStep(step)}
          onCompleteModule={() => void handleCompleteModule()}
          onPrev={() => setActiveStep('roadmap')}
        />
      )}

      {/* Regeneration Safeguard Dialog */}
      <ConfirmDialog
        open={confirmRegenTarget !== null}
        title="Regenerate AI Strategy Recommendations?"
        description="This generates a fresh set of AI recommendations in the review queue. Your existing working and approved items will NOT be overwritten or removed."
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
        title="Remove Strategy Item?"
        description={
          pendingDelete?.kind === 'goal'
            ? 'Removing this SMART goal will unlink and move any marketing objectives connected to it back to draft review.'
            : pendingDelete?.kind === 'objective'
              ? 'Removing this objective will unlink and move any channels, tactics, KPIs, or roadmap activities pointing to it back to draft review.'
              : pendingDelete?.kind === 'channel'
                ? 'Removing this channel will unlink and move any tactics assigned to it back to draft review.'
                : 'This will remove the selected item from your Marketing Strategy workspace.'
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
