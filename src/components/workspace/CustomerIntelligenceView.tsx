import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  ClipboardCheck,
  Compass,
  Edit3,
  Info,
  Loader2,
  MessageSquareText,
  Plus,
  RefreshCw,
  Save,
  ShieldCheck,
  Sparkles,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { api } from '../../services/api';
import { executeBrandPrompt } from '../../services/promptExecution';
import type { Brand, BrandStrategyModule, ModuleStatus } from '../../types/brand';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { FOUNDATION_SECTIONS } from '../../utils/brandFoundationLogic';
import { MESSAGING_SECTIONS } from '../../utils/brandMessagingLogic';
import {
  CUSTOMER_INTEL_SECTIONS,
  adoptAiInterestSuggestion,
  adoptAiPersonaSuggestion,
  applyAiInterestsResult,
  applyAiPersonasResult,
  buildCustomerIntelPromptVariables,
  buildCustomerIntelligenceUpsertPayload,
  canCompleteCustomerIntelligence,
  checkInterestGenerationReadiness,
  checkPersonaGenerationReadiness,
  computeCustomerIntelligenceProgress,
  createBlankAudienceInterest,
  createBlankPersona,
  createInitialCustomerIntelligenceState,
  dismissAiInterestSuggestion,
  dismissAiPersonaSuggestion,
  hasAnyApprovedCustomerIntelligence,
  hydrateCustomerIntelligenceState,
  removeInterestFromState,
  removePersonaFromState,
  validateAudienceInterest,
  validatePersona,
  type AudienceInterestItem,
  type CustomerIntelStepKey,
  type CustomerIntelligenceState,
  type CustomerPersonaItem,
} from '../../utils/customerIntelligenceLogic';

interface CustomerIntelligenceViewProps {
  brand: Brand;
  onModuleSaved: (module: BrandStrategyModule) => void | Promise<void>;
  onToast: (type: 'success' | 'error', message: string) => void;
  onNavigateToBrandFoundation: () => void;
  onNavigateToBrandMessaging: () => void;
  onNavigateToBrandSettings: () => void;
}

function createEntityId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function CustomerIntelligenceView({
  brand,
  onModuleSaved,
  onToast,
  onNavigateToBrandFoundation,
  onNavigateToBrandMessaging,
  onNavigateToBrandSettings,
}: CustomerIntelligenceViewProps) {
  const [intel, setIntel] = useState<CustomerIntelligenceState>(() =>
    createInitialCustomerIntelligenceState(brand),
  );
  const [strategyModules, setStrategyModules] = useState<BrandStrategyModule[]>([]);
  const [moduleStatus, setModuleStatus] = useState<ModuleStatus>(
    brand.moduleStatuses.customerIntelligence ?? 'not_started',
  );
  const [activeStep, setActiveStep] = useState<CustomerIntelStepKey>('personas');
  const [loadingModule, setLoadingModule] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState<boolean>(false);
  const [generatingPersonas, setGeneratingPersonas] = useState<boolean>(false);
  const [generatingInterests, setGeneratingInterests] = useState<boolean>(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [missingInfoNotice, setMissingInfoNotice] = useState<{
    message: string;
    missingFields: string[];
  } | null>(null);

  const [editingPersonaIds, setEditingPersonaIds] = useState<Record<string, boolean>>({});
  const [personaErrorsMap, setPersonaErrorsMap] = useState<
    Record<string, Record<string, string>>
  >({});
  const [editingInterestIds, setEditingInterestIds] = useState<Record<string, boolean>>({});
  const [interestErrorsMap, setInterestErrorsMap] = useState<
    Record<string, Record<string, string>>
  >({});
  const [personaFilterId, setPersonaFilterId] = useState<string>('all');
  const [showUpstreamDetails, setShowUpstreamDetails] = useState<boolean>(false);

  const [confirmRegenTarget, setConfirmRegenTarget] = useState<
    'personas' | 'interests' | null
  >(null);
  const [pendingDeletePersona, setPendingDeletePersona] =
    useState<CustomerPersonaItem | null>(null);
  const [pendingDeleteInterest, setPendingDeleteInterest] =
    useState<AudienceInterestItem | null>(null);

  // Load brand strategy modules cleanly for this exact brand workspace
  useEffect(() => {
    let cancelled = false;
    setLoadingModule(true);
    setLoadError(null);
    setAiError(null);
    setMissingInfoNotice(null);
    setPersonaErrorsMap({});
    setInterestErrorsMap({});

    api
      .listStrategyModules(brand.id)
      .then(({ modules }) => {
        if (cancelled) return;
        setStrategyModules(modules);

        const existingCi =
          modules.find((m) => m.moduleKey === 'customerIntelligence') ?? null;
        let readinessCheck;
        try {
          readinessCheck = checkPersonaGenerationReadiness(brand, modules);
        } catch {
          readinessCheck = null;
        }

        const hydrated = hydrateCustomerIntelligenceState(
          brand,
          existingCi,
          readinessCheck?.dependencyEvaluation.upstreamSnapshot ?? null,
        );
        setIntel(hydrated);
        setModuleStatus(
          existingCi?.status ??
            brand.moduleStatuses.customerIntelligence ??
            'not_started',
        );

        if (existingCi?.status === 'completed') {
          setActiveStep('review');
        } else if (
          hydrated.personas.some((p) => p.approved) &&
          !hydrated.interests.some((i) => i.approved)
        ) {
          setActiveStep('audienceInterests');
        } else {
          setActiveStep('personas');
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setStrategyModules([]);
        setIntel(createInitialCustomerIntelligenceState(brand));
        setLoadError(
          err instanceof Error
            ? err.message
            : 'Unable to load Customer Intelligence workspace.',
        );
      })
      .finally(() => {
        if (!cancelled) setLoadingModule(false);
      });

    return () => {
      cancelled = true;
    };
  }, [brand.id]);

  const personaReadiness = useMemo(() => {
    try {
      return checkPersonaGenerationReadiness(brand, strategyModules);
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
          foundationStatus: 'not_started' as ModuleStatus,
          messagingStatus: 'not_started' as ModuleStatus,
          missingFoundationSections: FOUNDATION_SECTIONS.map((s) => s.key),
          missingMessagingSections: MESSAGING_SECTIONS.map((s) => s.key),
          approvedFoundation: null,
          approvedMessaging: null,
          upstreamSnapshot: null,
          reason:
            err instanceof Error ? err.message : 'Brand context isolation error.',
        },
        reason: err instanceof Error ? err.message : 'Brand context isolation error.',
      };
    }
  }, [brand, strategyModules]);

  const interestReadiness = useMemo(() => {
    try {
      return checkInterestGenerationReadiness(brand, strategyModules, intel);
    } catch (err) {
      return {
        ready: false,
        dependenciesReady: false,
        profileReady: false,
        hasApprovedPersonas: false,
        approvedPersonasCount: 0,
        missingProfileFields: [],
        dependencyEvaluation: personaReadiness.dependencyEvaluation,
        reason: err instanceof Error ? err.message : 'Brand context isolation error.',
      };
    }
  }, [brand, strategyModules, intel, personaReadiness.dependencyEvaluation]);

  const progress = useMemo(
    () => computeCustomerIntelligenceProgress(intel),
    [intel],
  );
  const completionCheck = useMemo(
    () => canCompleteCustomerIntelligence(intel),
    [intel],
  );

  const persistState = async (
    nextState: CustomerIntelligenceState,
    requestedStatus: ModuleStatus,
    successMessage?: string,
  ): Promise<boolean> => {
    setSaving(true);
    try {
      const payload = buildCustomerIntelligenceUpsertPayload(
        nextState,
        requestedStatus,
      );
      const { module } = await api.upsertStrategyModule(
        brand.id,
        'customerIntelligence',
        payload,
      );
      const refreshed = hydrateCustomerIntelligenceState(
        brand,
        module,
        personaReadiness.dependencyEvaluation.upstreamSnapshot ??
          nextState.upstreamSnapshot,
      );
      setIntel(refreshed);
      setModuleStatus(module.status);
      setStrategyModules((prev) => [
        ...prev.filter((m) => m.moduleKey !== 'customerIntelligence'),
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
        err instanceof Error
          ? err.message
          : 'Failed to save Customer Intelligence.',
      );
      return false;
    } finally {
      setSaving(false);
    }
  };

  const runPersonaGeneration = async () => {
    setAiError(null);
    setMissingInfoNotice(null);

    if (!personaReadiness.dependenciesReady) {
      setAiError(
        personaReadiness.reason ??
          'Complete both Brand Foundation and Brand Messaging before generating persona hypotheses.',
      );
      return;
    }

    if (!personaReadiness.profileReady) {
      setMissingInfoNotice({
        message:
          'Complete the required brand profile fields before generating customer persona hypotheses.',
        missingFields: personaReadiness.missingProfileFields,
      });
      return;
    }

    setGeneratingPersonas(true);
    try {
      const result = await executeBrandPrompt({
        brandId: brand.id,
        promptId: 'customer_personas_synthesis',
        includeApprovedModules: true,
        expectedOwnerUserId: brand.userId,
        variables: buildCustomerIntelPromptVariables(brand, intel),
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

      const applied = applyAiPersonasResult(intel, result);
      if (!applied.applied) {
        setAiError(
          applied.error ?? 'AI persona hypotheses failed structured validation.',
        );
        return;
      }

      const nextState: CustomerIntelligenceState = {
        ...applied.state,
        upstreamSnapshot:
          personaReadiness.dependencyEvaluation.upstreamSnapshot ??
          applied.state.upstreamSnapshot,
      };
      setIntel(nextState);

      const nextStatus: ModuleStatus =
        moduleStatus === 'completed' ? 'completed' : 'in_progress';
      await persistState(
        nextState,
        nextStatus,
        'Generated AI persona hypotheses for review. Approved personas remain protected.',
      );
    } catch (err) {
      setAiError(
        err instanceof Error
          ? err.message
          : 'Unable to generate customer persona hypotheses.',
      );
    } finally {
      setGeneratingPersonas(false);
    }
  };

  const runInterestGeneration = async () => {
    setAiError(null);
    setMissingInfoNotice(null);

    if (!interestReadiness.dependenciesReady) {
      setAiError(
        interestReadiness.reason ??
          'Complete both Brand Foundation and Brand Messaging first.',
      );
      return;
    }

    if (!interestReadiness.hasApprovedPersonas) {
      setAiError(
        'Approve at least one complete Customer Persona before generating Audience Interests.',
      );
      return;
    }

    setGeneratingInterests(true);
    try {
      // Ensure approved personas are persisted on the server before invoking includeApprovedModules
      if (
        !strategyModules.some(
          (m) =>
            m.moduleKey === 'customerIntelligence' &&
            Array.isArray(m.content?.personas) &&
            m.content.personas.some(
              (p) =>
                typeof p === 'object' &&
                p !== null &&
                (p as Record<string, unknown>).approved === true,
            ),
        )
      ) {
        const persisted = await persistState(
          intel,
          moduleStatus === 'completed' ? 'completed' : 'in_progress',
        );
        if (!persisted) {
          return;
        }
      }

      const result = await executeBrandPrompt({
        brandId: brand.id,
        promptId: 'customer_audience_interests',
        includeApprovedModules: true,
        expectedOwnerUserId: brand.userId,
        variables: buildCustomerIntelPromptVariables(brand, intel),
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

      const applied = applyAiInterestsResult(intel, result);
      if (!applied.applied) {
        setAiError(
          applied.error ?? 'AI audience interest hypotheses failed validation.',
        );
        return;
      }

      const nextState: CustomerIntelligenceState = {
        ...applied.state,
        upstreamSnapshot:
          personaReadiness.dependencyEvaluation.upstreamSnapshot ??
          applied.state.upstreamSnapshot,
      };
      setIntel(nextState);

      const nextStatus: ModuleStatus =
        moduleStatus === 'completed' ? 'completed' : 'in_progress';
      await persistState(
        nextState,
        nextStatus,
        'Generated AI audience interest hypotheses linked to your approved personas.',
      );
    } catch (err) {
      setAiError(
        err instanceof Error
          ? err.message
          : 'Unable to generate audience interest hypotheses.',
      );
    } finally {
      setGeneratingInterests(false);
    }
  };

  const handleRequestGeneratePersonas = () => {
    if (generatingPersonas || saving || !personaReadiness.dependenciesReady) return;
    if (intel.personas.length > 0 || intel.personaSynthesis.generatedAt) {
      setConfirmRegenTarget('personas');
      return;
    }
    void runPersonaGeneration();
  };

  const handleRequestGenerateInterests = () => {
    if (generatingInterests || saving || !interestReadiness.ready) return;
    if (intel.interests.length > 0 || intel.interestSynthesis.generatedAt) {
      setConfirmRegenTarget('interests');
      return;
    }
    void runInterestGeneration();
  };

  const updatePersona = (
    personaId: string,
    patch: Partial<CustomerPersonaItem>,
  ) => {
    setPersonaErrorsMap((prev) => {
      const next = { ...prev };
      delete next[personaId];
      return next;
    });
    setIntel((prev) => ({
      ...prev,
      completedAt: null,
      approvedSummary: null,
      personas: prev.personas.map((p) => {
        if (p.id !== personaId) return p;
        const nextSource =
          p.source === 'ai_adopted' && patch.source === undefined
            ? 'edited_ai'
            : (patch.source ?? p.source);
        return {
          ...p,
          ...patch,
          source: nextSource,
          approved: patch.approved !== undefined ? patch.approved : false,
          approvedAt:
            patch.approved !== undefined ? (patch.approvedAt ?? null) : null,
        };
      }),
    }));
    if (moduleStatus === 'completed') setModuleStatus('in_progress');
  };

  const handleApprovePersona = async (persona: CustomerPersonaItem) => {
    const errors = validatePersona(persona);
    if (Object.keys(errors).length > 0) {
      setPersonaErrorsMap((prev) => ({ ...prev, [persona.id]: errors }));
      setEditingPersonaIds((prev) => ({ ...prev, [persona.id]: true }));
      return;
    }

    const nowIso = new Date().toISOString();
    const updated: CustomerIntelligenceState = {
      ...intel,
      personas: intel.personas.map((p) =>
        p.id === persona.id ? { ...p, approved: true, approvedAt: nowIso } : p,
      ),
    };
    setIntel(updated);
    setEditingPersonaIds((prev) => ({ ...prev, [persona.id]: false }));

    const nextCheck = canCompleteCustomerIntelligence(updated);
    const targetStatus: ModuleStatus =
      moduleStatus === 'completed' && nextCheck.allowed
        ? 'completed'
        : 'in_progress';
    await persistState(
      updated,
      targetStatus,
      `Approved persona "${persona.name}".`,
    );
  };

  const handleUnapprovePersona = async (personaId: string) => {
    const updated: CustomerIntelligenceState = {
      ...intel,
      completedAt: null,
      approvedSummary: null,
      personas: intel.personas.map((p) =>
        p.id === personaId ? { ...p, approved: false, approvedAt: null } : p,
      ),
    };
    setIntel(updated);
    if (moduleStatus === 'completed') setModuleStatus('in_progress');
    await persistState(
      updated,
      'in_progress',
      'Persona moved back to draft review.',
    );
  };

  const handleConfirmDeletePersona = async () => {
    if (!pendingDeletePersona) return;
    const removedName = pendingDeletePersona.name || 'Persona';
    const nextState = removePersonaFromState(intel, pendingDeletePersona.id);
    setPendingDeletePersona(null);
    setIntel(nextState);
    if (personaFilterId === pendingDeletePersona.id) {
      setPersonaFilterId('all');
    }

    const hasRemaining = hasAnyApprovedCustomerIntelligence(nextState);
    if (!hasRemaining && nextState.personas.length === 0 && nextState.interests.length === 0) {
      setModuleStatus('in_progress');
    }
    const nextCheck = canCompleteCustomerIntelligence(nextState);
    const nextStatus: ModuleStatus =
      moduleStatus === 'completed' && nextCheck.allowed
        ? 'completed'
        : 'in_progress';
    await persistState(
      nextState,
      nextStatus,
      `Removed "${removedName}" and updated linked audience interests.`,
    );
  };

  const updateInterest = (
    interestId: string,
    patch: Partial<AudienceInterestItem>,
  ) => {
    setInterestErrorsMap((prev) => {
      const next = { ...prev };
      delete next[interestId];
      return next;
    });
    setIntel((prev) => ({
      ...prev,
      completedAt: null,
      approvedSummary: null,
      interests: prev.interests.map((item) => {
        if (item.id !== interestId) return item;
        const nextSource =
          item.source === 'ai_adopted' && patch.source === undefined
            ? 'edited_ai'
            : (patch.source ?? item.source);
        return {
          ...item,
          ...patch,
          source: nextSource,
          approved: patch.approved !== undefined ? patch.approved : false,
          approvedAt:
            patch.approved !== undefined ? (patch.approvedAt ?? null) : null,
        };
      }),
    }));
    if (moduleStatus === 'completed') setModuleStatus('in_progress');
  };

  const handleApproveInterest = async (interest: AudienceInterestItem) => {
    const errors = validateAudienceInterest(interest, intel.personas);
    if (Object.keys(errors).length > 0) {
      setInterestErrorsMap((prev) => ({ ...prev, [interest.id]: errors }));
      setEditingInterestIds((prev) => ({ ...prev, [interest.id]: true }));
      return;
    }

    const nowIso = new Date().toISOString();
    const updated: CustomerIntelligenceState = {
      ...intel,
      interests: intel.interests.map((item) =>
        item.id === interest.id
          ? { ...item, approved: true, approvedAt: nowIso }
          : item,
      ),
    };
    setIntel(updated);
    setEditingInterestIds((prev) => ({ ...prev, [interest.id]: false }));

    const nextCheck = canCompleteCustomerIntelligence(updated);
    const targetStatus: ModuleStatus =
      moduleStatus === 'completed' && nextCheck.allowed
        ? 'completed'
        : 'in_progress';
    await persistState(
      updated,
      targetStatus,
      `Approved audience interest "${interest.topic}".`,
    );
  };

  const handleUnapproveInterest = async (interestId: string) => {
    const updated: CustomerIntelligenceState = {
      ...intel,
      completedAt: null,
      approvedSummary: null,
      interests: intel.interests.map((item) =>
        item.id === interestId
          ? { ...item, approved: false, approvedAt: null }
          : item,
      ),
    };
    setIntel(updated);
    if (moduleStatus === 'completed') setModuleStatus('in_progress');
    await persistState(
      updated,
      'in_progress',
      'Audience interest moved back to draft review.',
    );
  };

  const handleConfirmDeleteInterest = async () => {
    if (!pendingDeleteInterest) return;
    const removedTopic = pendingDeleteInterest.topic || 'Audience interest';
    const nextState = removeInterestFromState(intel, pendingDeleteInterest.id);
    setPendingDeleteInterest(null);
    setIntel(nextState);
    const nextCheck = canCompleteCustomerIntelligence(nextState);
    const nextStatus: ModuleStatus =
      moduleStatus === 'completed' && nextCheck.allowed
        ? 'completed'
        : 'in_progress';
    await persistState(
      nextState,
      nextStatus,
      `Removed "${removedTopic}".`,
    );
  };

  const handleSaveProgress = async () => {
    const nextStatus: ModuleStatus =
      moduleStatus === 'completed' && completionCheck.allowed
        ? 'completed'
        : 'in_progress';
    await persistState(intel, nextStatus, 'Saved Customer Intelligence progress.');
  };

  const handleCompleteModule = async () => {
    if (!completionCheck.allowed) {
      onToast(
        'error',
        completionCheck.blockers[0] ??
          'Approve at least one Customer Persona and one linked Audience Interest before completing.',
      );
      return;
    }
    await persistState(
      intel,
      'completed',
      'Customer Intelligence approved and marked completed.',
    );
  };

  const filteredInterests = useMemo(() => {
    if (personaFilterId === 'all') return intel.interests;
    return intel.interests.filter((item) =>
      item.linkedPersonaIds.includes(personaFilterId),
    );
  }, [intel.interests, personaFilterId]);

  const inputClass = (hasError?: boolean) =>
    `mt-1.5 w-full rounded-lg border bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 transition-colors focus:outline-none ${
      hasError
        ? 'border-red-400 focus:border-red-600'
        : 'border-slate-200 focus:border-blue-600'
    }`;

  if (loadingModule) {
    return (
      <div className="space-y-4">
        <div className="h-32 animate-pulse rounded-xl border border-slate-200 bg-slate-50" />
        <div className="h-72 animate-pulse rounded-xl border border-slate-200 bg-slate-50" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Module Header, Progress & Step Switcher */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
        <div className="flex flex-col justify-between gap-4 border-b border-slate-100 pb-5 sm:flex-row sm:items-start">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span>Phase 2B Strategy Module</span>
              <span aria-hidden="true">·</span>
              <span
                data-testid="customer-intel-module-status"
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
              Customer Intelligence
            </h2>
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-600">
              Define structured customer personas and audience interest clusters for{' '}
              <strong className="font-semibold text-slate-800">{brand.brandName}</strong>,
              separating unverified AI hypotheses from explicitly approved buyer intelligence.
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
              Customer Intelligence Progress ({progress.approvedPersonasCount} approved persona
              {progress.approvedPersonasCount === 1 ? '' : 's'} ·{' '}
              {progress.approvedInterestsCount} approved interest
              {progress.approvedInterestsCount === 1 ? '' : 's'})
            </span>
            <span
              data-testid="customer-intel-progress-label"
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

        {/* Step Navigation */}
        <nav
          aria-label="Customer Intelligence Sections"
          className="mt-5 grid grid-cols-1 gap-2.5 sm:grid-cols-3"
        >
          {CUSTOMER_INTEL_SECTIONS.map((sec) => {
            const isCurrent = activeStep === sec.key;
            const status = progress.sectionStatuses[sec.key];
            return (
              <button
                key={sec.key}
                type="button"
                onClick={() => setActiveStep(sec.key)}
                aria-current={isCurrent ? 'step' : undefined}
                className={`flex min-h-[54px] flex-col justify-between rounded-lg border px-3.5 py-2.5 text-left transition-colors ${
                  isCurrent
                    ? 'border-blue-600 bg-blue-50/70 text-blue-900'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between gap-1.5">
                  <span className="font-mono text-[11px] font-medium text-slate-400 tabular-nums">
                    {sec.number}
                  </span>
                  {status === 'approved' ? (
                    <CheckCircle2
                      className="h-3.5 w-3.5 shrink-0 text-emerald-600"
                      aria-label="Approved"
                    />
                  ) : status === 'in_progress' ? (
                    <span className="text-[11px] font-medium text-blue-600">Draft</span>
                  ) : null}
                </div>
                <span className="mt-1 text-xs font-semibold leading-snug">{sec.title}</span>
              </button>
            );
          })}

          <button
            type="button"
            onClick={() => setActiveStep('review')}
            aria-current={activeStep === 'review' ? 'step' : undefined}
            className={`flex min-h-[54px] flex-col justify-between rounded-lg border px-3.5 py-2.5 text-left transition-colors ${
              activeStep === 'review'
                ? 'border-blue-600 bg-blue-50/70 text-blue-900'
                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            <div className="flex items-center justify-between gap-1.5">
              <span className="font-mono text-[11px] font-medium text-slate-400 tabular-nums">
                03
              </span>
              {moduleStatus === 'completed' && (
                <CheckCircle2
                  className="h-3.5 w-3.5 shrink-0 text-emerald-600"
                  aria-label="Completed"
                />
              )}
            </div>
            <span className="mt-1 text-xs font-semibold leading-snug">
              Review & Complete
            </span>
          </button>
        </nav>
      </section>

      {/* Dual Dependency Gate: Brand Foundation + Brand Messaging */}
      {!personaReadiness.dependenciesReady ? (
        <section
          role="status"
          data-testid="customer-intel-prerequisite"
          className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-amber-950"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle
              className="mt-0.5 h-5 w-5 shrink-0 text-amber-700"
              strokeWidth={1.75}
            />
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-semibold text-amber-950">
                Complete Brand Foundation and Brand Messaging to unlock AI customer generation
              </h3>
              <p className="mt-1 text-xs leading-relaxed text-amber-900">
                Customer Intelligence grounds every AI persona and audience interest hypothesis in{' '}
                {brand.brandName}’s approved positioning and messaging framework. AI generation is
                locked until both prerequisite modules are completed; manual drafting remains
                available below.
              </p>

              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="flex flex-col justify-between gap-2 rounded-lg border border-amber-200/80 bg-white/80 p-3.5">
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-900">
                        <Compass className="h-3.5 w-3.5 text-slate-500" />
                        <span>Brand Foundation</span>
                      </span>
                      <span
                        className={`text-[11px] font-semibold ${
                          personaReadiness.dependencyEvaluation.foundationReady
                            ? 'text-emerald-700'
                            : 'text-amber-800'
                        }`}
                      >
                        {personaReadiness.dependencyEvaluation.foundationReady
                          ? 'Completed'
                          : 'Incomplete'}
                      </span>
                    </div>
                  </div>
                  {!personaReadiness.dependencyEvaluation.foundationReady && (
                    <button
                      type="button"
                      onClick={onNavigateToBrandFoundation}
                      className="inline-flex min-h-[36px] items-center justify-center gap-1.5 rounded-lg bg-amber-900 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-amber-950"
                    >
                      <span>Complete Brand Foundation</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                <div className="flex flex-col justify-between gap-2 rounded-lg border border-amber-200/80 bg-white/80 p-3.5">
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-900">
                        <MessageSquareText className="h-3.5 w-3.5 text-slate-500" />
                        <span>Brand Messaging</span>
                      </span>
                      <span
                        className={`text-[11px] font-semibold ${
                          personaReadiness.dependencyEvaluation.messagingReady
                            ? 'text-emerald-700'
                            : 'text-amber-800'
                        }`}
                      >
                        {personaReadiness.dependencyEvaluation.messagingReady
                          ? 'Completed'
                          : 'Incomplete'}
                      </span>
                    </div>
                  </div>
                  {!personaReadiness.dependencyEvaluation.messagingReady && (
                    <button
                      type="button"
                      onClick={onNavigateToBrandMessaging}
                      className="inline-flex min-h-[36px] items-center justify-center gap-1.5 rounded-lg bg-amber-900 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-amber-950"
                    >
                      <span>Complete Brand Messaging</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>
      ) : (
        personaReadiness.dependencyEvaluation.approvedFoundation &&
        personaReadiness.dependencyEvaluation.approvedMessaging && (
          <section
            data-testid="customer-intel-upstream-source"
            className="rounded-xl border border-slate-200 bg-slate-50/70 px-5 py-3.5"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs">
                <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-600" strokeWidth={1.75} />
                <span className="font-semibold text-slate-800">
                  Verified Upstream Anchor: Approved Brand Foundation & Brand Messaging
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
                    {personaReadiness.dependencyEvaluation.approvedFoundation.positioningStatement}
                  </dd>
                </div>
                <div>
                  <dt className="font-semibold text-slate-700">Approved Core Value Proposition</dt>
                  <dd className="mt-0.5 text-slate-600">
                    {personaReadiness.dependencyEvaluation.approvedMessaging.coreValueProposition}
                  </dd>
                </div>
              </dl>
            )}
          </section>
        )
      )}

      {/* AI Hypothesis Safeguard Reminder */}
      <div className="flex items-start gap-2.5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-700">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
        <p className="leading-relaxed">
          <strong className="font-semibold text-slate-900">
            AI Hypotheses vs. Approved Intelligence:
          </strong>{' '}
          AI-generated personas and interest clusters are unverified hypotheses derived from your
          brand strategy until reviewed, edited where needed, and explicitly approved by you.
        </p>
      </div>

      {/* Global Alerts */}
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
          data-testid="customer-intel-missing-info"
          className="flex flex-col justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950 sm:flex-row sm:items-center"
        >
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <div>
              <p className="font-semibold">
                Required brand profile details missing for AI synthesis
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
          data-testid="customer-intel-ai-error"
          className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900"
        >
          {aiError}
        </div>
      )}

      {/* ===================================================================== */}
      {/* STEP 01: CUSTOMER PERSONAS                                            */}
      {/* ===================================================================== */}
      {activeStep === 'personas' && (
        <section className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6 space-y-6">
          <div className="flex flex-col justify-between gap-4 border-b border-slate-100 pb-4 sm:flex-row sm:items-center">
            <div>
              <h3 className="text-base font-semibold text-slate-900">
                01. Customer Personas
              </h3>
              <p className="mt-0.5 text-xs text-slate-500">
                Build decision-useful profiles covering goals, pain points, objections, triggers,
                decision factors, and preferred channels. Demographics are strictly optional.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={handleRequestGeneratePersonas}
                disabled={
                  generatingPersonas ||
                  saving ||
                  !personaReadiness.dependenciesReady
                }
                title={
                  !personaReadiness.dependenciesReady
                    ? 'Complete Brand Foundation and Brand Messaging first.'
                    : undefined
                }
                className="inline-flex min-h-[42px] items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 whitespace-nowrap"
              >
                {generatingPersonas ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : intel.personaSynthesis.generatedAt ? (
                  <RefreshCw className="h-4 w-4" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                <span>
                  {generatingPersonas
                    ? 'Generating Personas...'
                    : intel.personaSynthesis.generatedAt
                      ? 'Regenerate AI Personas'
                      : 'Generate AI Persona Hypotheses'}
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  const id = createEntityId('persona');
                  const blank = createBlankPersona(id);
                  setIntel((prev) => ({
                    ...prev,
                    completedAt: null,
                    approvedSummary: null,
                    personas: [...prev.personas, blank],
                  }));
                  setEditingPersonaIds((prev) => ({ ...prev, [id]: true }));
                }}
                className="inline-flex min-h-[42px] items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 whitespace-nowrap"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Add Persona Manually</span>
              </button>
            </div>
          </div>

          {/* Grounded Facts & Missing Context for Personas */}
          {intel.personaSynthesis.generatedAt && (
            <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-4 text-xs">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <p className="font-semibold text-slate-800">
                    Verified Facts Used ({intel.personaSynthesis.suppliedFactsUsed.length})
                  </p>
                  {intel.personaSynthesis.suppliedFactsUsed.length > 0 && (
                    <ul className="mt-1 list-disc space-y-0.5 pl-4 text-slate-600">
                      {intel.personaSynthesis.suppliedFactsUsed.slice(0, 4).map((f, idx) => (
                        <li key={idx}>{f}</li>
                      ))}
                    </ul>
                  )}
                </div>
                <div>
                  <p className="font-semibold text-slate-800">
                    Assumptions / Research Gaps ({intel.personaSynthesis.missingContextNotes.length})
                  </p>
                  {intel.personaSynthesis.missingContextNotes.length > 0 ? (
                    <ul className="mt-1 list-disc space-y-0.5 pl-4 text-slate-600">
                      {intel.personaSynthesis.missingContextNotes.slice(0, 4).map((n, idx) => (
                        <li key={idx}>{n}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-1 text-slate-500">None flagged.</p>
                  )}
                </div>
              </div>
              {intel.personaSynthesis.researchCaveat && (
                <p className="mt-3 border-t border-slate-200/80 pt-2.5 text-slate-700">
                  <strong className="font-semibold">AI Research Caveat:</strong>{' '}
                  {intel.personaSynthesis.researchCaveat}
                </p>
              )}
            </div>
          )}

          {/* AI Persona Suggestions Review Queue */}
          {intel.aiSuggestedPersonas.length > 0 && (
            <div
              data-testid="ai-persona-suggestions-panel"
              className="space-y-3 rounded-xl border border-amber-200 bg-amber-50/70 p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-amber-950">
                  <Sparkles className="h-4 w-4 text-amber-600" />
                  <span>
                    AI Persona Hypotheses ({intel.aiSuggestedPersonas.length}) — Review & Adopt
                    before Approval
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3">
                {intel.aiSuggestedPersonas.map((suggestion) => (
                  <div
                    key={suggestion.id}
                    className="rounded-lg border border-amber-200 bg-white p-4"
                  >
                    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold text-slate-900">
                            {suggestion.name}
                          </span>
                          <span className="text-xs text-slate-500">
                            {suggestion.roleOrSegment}
                          </span>
                          <span className="rounded bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-900">
                            {suggestion.suggestionStatus === 'approved'
                              ? 'Adopted into Workspace'
                              : suggestion.suggestionStatus === 'rejected'
                                ? 'Dismissed'
                                : 'AI Hypothesis (Unapproved)'}
                          </span>
                        </div>
                        <p className="mt-1.5 text-xs leading-relaxed text-slate-700">
                          {suggestion.summary}
                        </p>
                        <div className="mt-2.5 grid grid-cols-1 gap-2 text-xs text-slate-600 sm:grid-cols-2">
                          {suggestion.goals.length > 0 && (
                            <p>
                              <strong className="text-slate-800">Goals:</strong>{' '}
                              {suggestion.goals.join(' · ')}
                            </p>
                          )}
                          {suggestion.painPoints.length > 0 && (
                            <p>
                              <strong className="text-slate-800">Pain Points:</strong>{' '}
                              {suggestion.painPoints.join(' · ')}
                            </p>
                          )}
                          {suggestion.purchasingTriggers.length > 0 && (
                            <p>
                              <strong className="text-slate-800">Triggers:</strong>{' '}
                              {suggestion.purchasingTriggers.join(' · ')}
                            </p>
                          )}
                          {suggestion.decisionFactors.length > 0 && (
                            <p>
                              <strong className="text-slate-800">Decision Factors:</strong>{' '}
                              {suggestion.decisionFactors.join(' · ')}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex shrink-0 items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            const newId = createEntityId('persona');
                            const adopted = adoptAiPersonaSuggestion(
                              intel,
                              suggestion.id,
                              newId,
                            );
                            if (adopted.adoptedPersona) {
                              setIntel(adopted.state);
                              setEditingPersonaIds((prev) => ({
                                ...prev,
                                [newId]: true,
                              }));
                              onToast(
                                'success',
                                `Adopted "${adopted.adoptedPersona.name}" into working personas for verification.`,
                              );
                            }
                          }}
                          className="inline-flex min-h-[36px] items-center gap-1 rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-950 hover:bg-amber-100 whitespace-nowrap"
                        >
                          <Check className="h-3.5 w-3.5" />
                          <span>Adopt Hypothesis</span>
                        </button>
                        {suggestion.suggestionStatus !== 'rejected' && (
                          <button
                            type="button"
                            onClick={() =>
                              setIntel((prev) =>
                                dismissAiPersonaSuggestion(prev, suggestion.id),
                              )
                            }
                            className="inline-flex min-h-[36px] items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100"
                          >
                            <X className="h-3.5 w-3.5" />
                            <span>Dismiss</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Working & Approved Personas List */}
          {intel.personas.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/40 p-8 text-center">
              <Users className="mx-auto h-7 w-7 text-slate-400" strokeWidth={1.5} />
              <p className="mt-2.5 text-sm font-semibold text-slate-800">
                No customer personas added yet
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {personaReadiness.dependenciesReady
                  ? 'Generate AI persona hypotheses above to review, or add your first verified buyer persona manually.'
                  : 'Add a verified buyer persona manually below, or complete Brand Foundation and Brand Messaging to unlock AI generation.'}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {intel.personas.map((persona, idx) => {
                const isEditing =
                  Boolean(editingPersonaIds[persona.id]) || !persona.name.trim();
                const errs = personaErrorsMap[persona.id] ?? {};
                return (
                  <article
                    key={persona.id}
                    data-testid={`persona-card-${persona.id}`}
                    className={`rounded-xl border p-4 sm:p-5 ${
                      persona.approved
                        ? 'border-emerald-200 bg-emerald-50/20'
                        : 'border-slate-200 bg-white'
                    }`}
                  >
                    <div className="flex flex-col justify-between gap-3 border-b border-slate-100 pb-3.5 sm:flex-row sm:items-center">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-xs text-slate-400 tabular-nums">
                            PERSONA 0{idx + 1}
                          </span>
                          <h4 className="text-base font-semibold text-slate-900">
                            {persona.name.trim() || 'Untitled Persona'}
                          </h4>
                          {persona.roleOrSegment.trim() && (
                            <span className="text-xs text-slate-500">
                              · {persona.roleOrSegment}
                            </span>
                          )}
                          <span
                            className={`inline-flex items-center gap-1 text-xs font-semibold ${
                              persona.approved
                                ? 'text-emerald-700'
                                : 'text-amber-700'
                            }`}
                          >
                            {persona.approved ? (
                              <>
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                <span>Approved Persona</span>
                              </>
                            ) : (
                              <span>
                                {persona.source === 'manual'
                                  ? 'Draft Persona (Unapproved)'
                                  : 'Adopted Hypothesis (Awaiting Approval)'}
                              </span>
                            )}
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            setEditingPersonaIds((prev) => ({
                              ...prev,
                              [persona.id]: !isEditing,
                            }))
                          }
                          className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                          <span>{isEditing ? 'Close Editor' : 'Edit'}</span>
                        </button>

                        {persona.approved ? (
                          <button
                            type="button"
                            onClick={() => void handleUnapprovePersona(persona.id)}
                            disabled={saving}
                            className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                          >
                            <span>Reopen Draft</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => void handleApprovePersona(persona)}
                            disabled={saving}
                            className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                          >
                            <Check className="h-3.5 w-3.5" />
                            <span>Approve Persona</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => setPendingDeletePersona(persona)}
                          aria-label={`Remove persona ${persona.name || idx + 1}`}
                          className="inline-flex min-h-[36px] items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          <span>Delete</span>
                        </button>
                      </div>
                    </div>

                    {Object.keys(errs).length > 0 && (
                      <div
                        role="alert"
                        className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800"
                      >
                        <p className="font-semibold">
                          Complete required persona details before approving:
                        </p>
                        <ul className="mt-1 list-disc pl-4">
                          {Object.values(errs).map((msg, i) => (
                            <li key={i}>{msg}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {isEditing ? (
                      <div className="mt-4 space-y-4">
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                          <div>
                            <label
                              htmlFor={`persona-name-${persona.id}`}
                              className="block text-xs font-semibold text-slate-800"
                            >
                              Persona Name / Archetype *
                            </label>
                            <input
                              id={`persona-name-${persona.id}`}
                              type="text"
                              value={persona.name}
                              onChange={(e) =>
                                updatePersona(persona.id, { name: e.target.value })
                              }
                              placeholder="e.g., Proactive Executive Optimizer"
                              className={inputClass(Boolean(errs.name))}
                            />
                          </div>

                          <div>
                            <label
                              htmlFor={`persona-role-${persona.id}`}
                              className="block text-xs font-semibold text-slate-800"
                            >
                              Role / Buyer Segment *
                            </label>
                            <input
                              id={`persona-role-${persona.id}`}
                              type="text"
                              value={persona.roleOrSegment}
                              onChange={(e) =>
                                updatePersona(persona.id, {
                                  roleOrSegment: e.target.value,
                                })
                              }
                              placeholder="e.g., Growth-stage founder or VP Operations"
                              className={inputClass(Boolean(errs.roleOrSegment))}
                            />
                          </div>
                        </div>

                        <div>
                          <label
                            htmlFor={`persona-summary-${persona.id}`}
                            className="block text-xs font-semibold text-slate-800"
                          >
                            Persona Summary *
                          </label>
                          <textarea
                            id={`persona-summary-${persona.id}`}
                            rows={2}
                            value={persona.summary}
                            onChange={(e) =>
                              updatePersona(persona.id, { summary: e.target.value })
                            }
                            placeholder="Summarize who this customer is, what situation triggers them to evaluate solutions, and what outcome they care about."
                            className={inputClass(Boolean(errs.summary))}
                          />
                        </div>

                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                          <TagListEditor
                            id={`persona-goals-${persona.id}`}
                            label="Customer Goals *"
                            items={persona.goals}
                            placeholder="Add a goal (e.g., Detect metabolic shifts early)"
                            hasError={Boolean(errs.goals)}
                            onChange={(items) =>
                              updatePersona(persona.id, { goals: items })
                            }
                          />
                          <TagListEditor
                            id={`persona-pains-${persona.id}`}
                            label="Pain Points & Frustrations *"
                            items={persona.painPoints}
                            placeholder="Add a pain point (e.g., Scattered confusing labs)"
                            hasError={Boolean(errs.painPoints)}
                            onChange={(items) =>
                              updatePersona(persona.id, { painPoints: items })
                            }
                          />
                          <TagListEditor
                            id={`persona-triggers-${persona.id}`}
                            label="Purchasing Triggers *"
                            items={persona.purchasingTriggers}
                            placeholder="Add a trigger (e.g., Peer recommendation)"
                            hasError={Boolean(errs.purchasingTriggers)}
                            onChange={(items) =>
                              updatePersona(persona.id, {
                                purchasingTriggers: items,
                              })
                            }
                          />
                          <TagListEditor
                            id={`persona-factors-${persona.id}`}
                            label="Key Decision Factors *"
                            items={persona.decisionFactors}
                            placeholder="Add a factor (e.g., Clinician interpretation)"
                            hasError={Boolean(errs.decisionFactors)}
                            onChange={(items) =>
                              updatePersona(persona.id, { decisionFactors: items })
                            }
                          />
                          <TagListEditor
                            id={`persona-motivations-${persona.id}`}
                            label="Motivations"
                            items={persona.motivations}
                            placeholder="Add motivation (optional)"
                            onChange={(items) =>
                              updatePersona(persona.id, { motivations: items })
                            }
                          />
                          <TagListEditor
                            id={`persona-objections-${persona.id}`}
                            label="Objections / Hesitations"
                            items={persona.objections}
                            placeholder="Add objection (optional)"
                            onChange={(items) =>
                              updatePersona(persona.id, { objections: items })
                            }
                          />
                          <TagListEditor
                            id={`persona-sources-${persona.id}`}
                            label="Information Sources"
                            items={persona.informationSources}
                            placeholder="Add source (e.g., Podcasts, LinkedIn, Peers)"
                            onChange={(items) =>
                              updatePersona(persona.id, {
                                informationSources: items,
                              })
                            }
                          />
                          <TagListEditor
                            id={`persona-comms-${persona.id}`}
                            label="Communication Preferences"
                            items={persona.communicationPreferences}
                            placeholder="Add preference (e.g., Concise emails, case studies)"
                            onChange={(items) =>
                              updatePersona(persona.id, {
                                communicationPreferences: items,
                              })
                            }
                          />
                        </div>

                        {/* Optional Demographics Toggle */}
                        <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3.5">
                          <label className="flex cursor-pointer items-center gap-2.5 text-xs font-semibold text-slate-800">
                            <input
                              type="checkbox"
                              checked={persona.demographicsRelevant}
                              onChange={(e) =>
                                updatePersona(persona.id, {
                                  demographicsRelevant: e.target.checked,
                                })
                              }
                              className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-600"
                            />
                            <span>
                              Include demographic attributes (optional — enable only when
                              demographics genuinely affect purchasing behavior)
                            </span>
                          </label>

                          {persona.demographicsRelevant && (
                            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                              <input
                                type="text"
                                aria-label="Age range"
                                value={persona.demographics.ageRange}
                                onChange={(e) =>
                                  updatePersona(persona.id, {
                                    demographics: {
                                      ...persona.demographics,
                                      ageRange: e.target.value,
                                    },
                                  })
                                }
                                placeholder="Age range (if relevant)"
                                className={inputClass()}
                              />
                              <input
                                type="text"
                                aria-label="Location"
                                value={persona.demographics.location}
                                onChange={(e) =>
                                  updatePersona(persona.id, {
                                    demographics: {
                                      ...persona.demographics,
                                      location: e.target.value,
                                    },
                                  })
                                }
                                placeholder="Location / region (if relevant)"
                                className={inputClass()}
                              />
                              <input
                                type="text"
                                aria-label="Income or budget tier"
                                value={persona.demographics.incomeOrBudget}
                                onChange={(e) =>
                                  updatePersona(persona.id, {
                                    demographics: {
                                      ...persona.demographics,
                                      incomeOrBudget: e.target.value,
                                    },
                                  })
                                }
                                placeholder="Income / budget (if relevant)"
                                className={inputClass()}
                              />
                              <input
                                type="text"
                                aria-label="Occupation or job title"
                                value={persona.demographics.occupationOrRole}
                                onChange={(e) =>
                                  updatePersona(persona.id, {
                                    demographics: {
                                      ...persona.demographics,
                                      occupationOrRole: e.target.value,
                                    },
                                  })
                                }
                                placeholder="Occupation / title (if relevant)"
                                className={inputClass()}
                              />
                              <input
                                type="text"
                                aria-label="Education or background"
                                value={persona.demographics.educationOrExperience}
                                onChange={(e) =>
                                  updatePersona(persona.id, {
                                    demographics: {
                                      ...persona.demographics,
                                      educationOrExperience: e.target.value,
                                    },
                                  })
                                }
                                placeholder="Education / seniority (optional)"
                                className={inputClass()}
                              />
                              <input
                                type="text"
                                aria-label="Lifestyle or context"
                                value={persona.demographics.lifestyleOrContext}
                                onChange={(e) =>
                                  updatePersona(persona.id, {
                                    demographics: {
                                      ...persona.demographics,
                                      lifestyleOrContext: e.target.value,
                                    },
                                  })
                                }
                                placeholder="Lifestyle / buying context (optional)"
                                className={inputClass()}
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="mt-3.5 space-y-2.5 text-xs text-slate-700">
                        <p className="text-sm leading-relaxed text-slate-800">
                          {persona.summary || 'No summary added yet.'}
                        </p>
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                          <p>
                            <strong className="text-slate-900">Goals:</strong>{' '}
                            {persona.goals.join(' · ') || '—'}
                          </p>
                          <p>
                            <strong className="text-slate-900">Pain Points:</strong>{' '}
                            {persona.painPoints.join(' · ') || '—'}
                          </p>
                          <p>
                            <strong className="text-slate-900">Purchasing Triggers:</strong>{' '}
                            {persona.purchasingTriggers.join(' · ') || '—'}
                          </p>
                          <p>
                            <strong className="text-slate-900">Decision Factors:</strong>{' '}
                            {persona.decisionFactors.join(' · ') || '—'}
                          </p>
                        </div>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}

          {/* Step Footer */}
          <div className="flex flex-col justify-between gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center">
            <span className="text-xs text-slate-500">
              {progress.approvedPersonasCount > 0
                ? `${progress.approvedPersonasCount} approved persona(s) ready for Audience Interests.`
                : 'Approve at least 1 persona before advancing to AI Audience Interests.'}
            </span>
            <button
              type="button"
              onClick={() => setActiveStep('audienceInterests')}
              className="inline-flex min-h-[42px] items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50"
            >
              <span>Continue to Audience Interests</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </section>
      )}

      {/* ===================================================================== */}
      {/* STEP 02: AUDIENCE INTERESTS                                           */}
      {/* ===================================================================== */}
      {activeStep === 'audienceInterests' && (
        <section className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6 space-y-6">
          <div className="flex flex-col justify-between gap-4 border-b border-slate-100 pb-4 sm:flex-row sm:items-center">
            <div>
              <h3 className="text-base font-semibold text-slate-900">
                02. Audience Interests & Purchase Drivers
              </h3>
              <p className="mt-0.5 text-xs text-slate-500">
                Map what your approved personas ask frequently, search for, consume, want to buy,
                and object to across seasonal or situational moments.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={handleRequestGenerateInterests}
                disabled={
                  generatingInterests ||
                  saving ||
                  !interestReadiness.ready
                }
                title={
                  !interestReadiness.ready
                    ? interestReadiness.reason ??
                      'Approve at least one Customer Persona first.'
                    : undefined
                }
                className="inline-flex min-h-[42px] items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 whitespace-nowrap"
              >
                {generatingInterests ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : intel.interestSynthesis.generatedAt ? (
                  <RefreshCw className="h-4 w-4" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                <span>
                  {generatingInterests
                    ? 'Generating Interests...'
                    : intel.interestSynthesis.generatedAt
                      ? 'Regenerate AI Audience Interests'
                      : 'Generate AI Audience Interests'}
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  const id = createEntityId('interest');
                  const defaultPersona =
                    intel.personas.find((p) => p.approved) ?? intel.personas[0];
                  const blank = createBlankAudienceInterest(
                    id,
                    defaultPersona ? [defaultPersona.id] : [],
                  );
                  setIntel((prev) => ({
                    ...prev,
                    completedAt: null,
                    approvedSummary: null,
                    interests: [...prev.interests, blank],
                  }));
                  setEditingInterestIds((prev) => ({ ...prev, [id]: true }));
                }}
                disabled={intel.personas.length === 0}
                title={
                  intel.personas.length === 0
                    ? 'Add at least one Customer Persona before creating an audience interest.'
                    : undefined
                }
                className="inline-flex min-h-[42px] items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 whitespace-nowrap"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Add Interest Manually</span>
              </button>
            </div>
          </div>

          {!interestReadiness.hasApprovedPersonas && (
            <div
              role="status"
              data-testid="interest-persona-prereq-notice"
              className="flex flex-col justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-xs text-amber-950 sm:flex-row sm:items-center"
            >
              <div>
                <p className="font-semibold">
                  Approve at least one Customer Persona to unlock AI Audience Interests
                </p>
                <p className="mt-0.5 text-amber-900">
                  Audience Interest generation (`customer_audience_interests`) runs strictly from
                  your approved Customer Personas plus completed Brand Foundation and Brand
                  Messaging.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveStep('personas')}
                className="inline-flex min-h-[36px] shrink-0 items-center gap-1.5 rounded-lg bg-amber-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-950 whitespace-nowrap"
              >
                <span>Review Personas</span>
                <ArrowLeft className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {/* Grounded Facts Strip for Interests */}
          {intel.interestSynthesis.generatedAt && (
            <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-4 text-xs">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <p className="font-semibold text-slate-800">
                    Verified Inputs Used ({intel.interestSynthesis.suppliedFactsUsed.length})
                  </p>
                  {intel.interestSynthesis.suppliedFactsUsed.length > 0 && (
                    <ul className="mt-1 list-disc space-y-0.5 pl-4 text-slate-600">
                      {intel.interestSynthesis.suppliedFactsUsed.slice(0, 4).map((f, idx) => (
                        <li key={idx}>{f}</li>
                      ))}
                    </ul>
                  )}
                </div>
                <div>
                  <p className="font-semibold text-slate-800">
                    Missing Context ({intel.interestSynthesis.missingContextNotes.length})
                  </p>
                  {intel.interestSynthesis.missingContextNotes.length > 0 ? (
                    <ul className="mt-1 list-disc space-y-0.5 pl-4 text-slate-600">
                      {intel.interestSynthesis.missingContextNotes.slice(0, 4).map((n, idx) => (
                        <li key={idx}>{n}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-1 text-slate-500">None flagged.</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* AI Audience Interest Suggestions Queue */}
          {intel.aiSuggestedInterests.length > 0 && (
            <div
              data-testid="ai-interest-suggestions-panel"
              className="space-y-3 rounded-xl border border-amber-200 bg-amber-50/70 p-4"
            >
              <div className="flex items-center gap-2 text-xs font-semibold text-amber-950">
                <Sparkles className="h-4 w-4 text-amber-600" />
                <span>
                  AI Audience Interest Hypotheses ({intel.aiSuggestedInterests.length}) — Adopt
                  & Verify Linked Personas
                </span>
              </div>

              <div className="grid grid-cols-1 gap-3">
                {intel.aiSuggestedInterests.map((suggestion) => (
                  <div
                    key={suggestion.id}
                    className="rounded-lg border border-amber-200 bg-white p-4"
                  >
                    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold text-slate-900">
                            {suggestion.topic}
                          </span>
                          <span className="rounded bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-900">
                            {suggestion.suggestionStatus === 'approved'
                              ? 'Adopted'
                              : suggestion.suggestionStatus === 'rejected'
                                ? 'Dismissed'
                                : 'AI Hypothesis (Unapproved)'}
                          </span>
                        </div>
                        {suggestion.linkedPersonaNames.length > 0 && (
                          <p className="mt-1 text-xs text-slate-500">
                            Suggested Personas:{' '}
                            <span className="font-medium text-slate-700">
                              {suggestion.linkedPersonaNames.join(', ')}
                            </span>
                          </p>
                        )}
                        <div className="mt-2 grid grid-cols-1 gap-1.5 text-xs text-slate-600 sm:grid-cols-2">
                          {suggestion.frequentQuestions.length > 0 && (
                            <p>
                              <strong className="text-slate-800">Questions:</strong>{' '}
                              {suggestion.frequentQuestions.join(' · ')}
                            </p>
                          )}
                          {suggestion.problemsToSolve.length > 0 && (
                            <p>
                              <strong className="text-slate-800">Problems:</strong>{' '}
                              {suggestion.problemsToSolve.join(' · ')}
                            </p>
                          )}
                          {suggestion.searchTopics.length > 0 && (
                            <p>
                              <strong className="text-slate-800">Search Topics:</strong>{' '}
                              {suggestion.searchTopics.join(' · ')}
                            </p>
                          )}
                          {suggestion.purchaseTriggers.length > 0 && (
                            <p>
                              <strong className="text-slate-800">Purchase Triggers:</strong>{' '}
                              {suggestion.purchaseTriggers.join(' · ')}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex shrink-0 items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            const newId = createEntityId('interest');
                            const adopted = adoptAiInterestSuggestion(
                              intel,
                              suggestion.id,
                              newId,
                            );
                            if (adopted.adoptedInterest) {
                              setIntel(adopted.state);
                              setEditingInterestIds((prev) => ({
                                ...prev,
                                [newId]: true,
                              }));
                              onToast(
                                'success',
                                `Adopted "${adopted.adoptedInterest.topic}" for review and approval.`,
                              );
                            }
                          }}
                          className="inline-flex min-h-[36px] items-center gap-1 rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-950 hover:bg-amber-100 whitespace-nowrap"
                        >
                          <Check className="h-3.5 w-3.5" />
                          <span>Adopt Interest</span>
                        </button>
                        {suggestion.suggestionStatus !== 'rejected' && (
                          <button
                            type="button"
                            onClick={() =>
                              setIntel((prev) =>
                                dismissAiInterestSuggestion(prev, suggestion.id),
                              )
                            }
                            className="inline-flex min-h-[36px] items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100"
                          >
                            <X className="h-3.5 w-3.5" />
                            <span>Dismiss</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Persona Filter Control */}
          {intel.interests.length > 0 && intel.personas.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50/70 px-4 py-2.5">
              <span className="text-xs font-semibold text-slate-700">
                Showing {filteredInterests.length} of {intel.interests.length} audience interest
                cluster{intel.interests.length === 1 ? '' : 's'}
              </span>
              <div className="flex items-center gap-2">
                <label
                  htmlFor="interest-persona-filter"
                  className="text-xs font-medium text-slate-600"
                >
                  Filter by persona:
                </label>
                <select
                  id="interest-persona-filter"
                  value={personaFilterId}
                  onChange={(e) => setPersonaFilterId(e.target.value)}
                  className="min-h-[36px] rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 focus:border-blue-600 focus:outline-none"
                >
                  <option value="all">All Personas</option>
                  {intel.personas.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name.trim() || 'Untitled Persona'}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Audience Interests List */}
          {filteredInterests.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/40 p-8 text-center">
              <p className="text-sm font-semibold text-slate-800">
                No audience interests drafted yet
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Generate AI audience interests from your approved personas or add a structured
                interest cluster manually.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredInterests.map((interest, idx) => {
                const isEditing =
                  Boolean(editingInterestIds[interest.id]) || !interest.topic.trim();
                const errs = interestErrorsMap[interest.id] ?? {};
                const linkedPersonas = intel.personas.filter((p) =>
                  interest.linkedPersonaIds.includes(p.id),
                );
                return (
                  <article
                    key={interest.id}
                    data-testid={`interest-card-${interest.id}`}
                    className={`rounded-xl border p-4 sm:p-5 ${
                      interest.approved
                        ? 'border-emerald-200 bg-emerald-50/20'
                        : 'border-slate-200 bg-white'
                    }`}
                  >
                    <div className="flex flex-col justify-between gap-3 border-b border-slate-100 pb-3.5 sm:flex-row sm:items-center">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-xs text-slate-400 tabular-nums">
                            INTEREST 0{idx + 1}
                          </span>
                          <h4 className="text-base font-semibold text-slate-900">
                            {interest.topic.trim() || 'Untitled Interest Cluster'}
                          </h4>
                          <span
                            className={`inline-flex items-center gap-1 text-xs font-semibold ${
                              interest.approved ? 'text-emerald-700' : 'text-amber-700'
                            }`}
                          >
                            {interest.approved ? (
                              <>
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                <span>Approved Interest</span>
                              </>
                            ) : (
                              <span>Draft Interest (Unapproved)</span>
                            )}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-slate-500">
                          Linked Personas:{' '}
                          <span className="font-medium text-slate-700">
                            {linkedPersonas.length > 0
                              ? linkedPersonas
                                  .map((p) => p.name.trim() || 'Untitled')
                                  .join(', ')
                              : 'None linked yet'}
                          </span>
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            setEditingInterestIds((prev) => ({
                              ...prev,
                              [interest.id]: !isEditing,
                            }))
                          }
                          className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                          <span>{isEditing ? 'Close Editor' : 'Edit'}</span>
                        </button>

                        {interest.approved ? (
                          <button
                            type="button"
                            onClick={() => void handleUnapproveInterest(interest.id)}
                            disabled={saving}
                            className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                          >
                            <span>Reopen Draft</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => void handleApproveInterest(interest)}
                            disabled={saving}
                            className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                          >
                            <Check className="h-3.5 w-3.5" />
                            <span>Approve Interest</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => setPendingDeleteInterest(interest)}
                          aria-label={`Remove interest ${interest.topic || idx + 1}`}
                          className="inline-flex min-h-[36px] items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          <span>Delete</span>
                        </button>
                      </div>
                    </div>

                    {Object.keys(errs).length > 0 && (
                      <div
                        role="alert"
                        className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800"
                      >
                        <ul className="list-disc pl-4">
                          {Object.values(errs).map((msg, i) => (
                            <li key={i}>{msg}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {isEditing ? (
                      <div className="mt-4 space-y-4">
                        <div>
                          <label
                            htmlFor={`interest-topic-${interest.id}`}
                            className="block text-xs font-semibold text-slate-800"
                          >
                            Interest Theme / Core Topic *
                          </label>
                          <input
                            id={`interest-topic-${interest.id}`}
                            type="text"
                            value={interest.topic}
                            onChange={(e) =>
                              updateInterest(interest.id, { topic: e.target.value })
                            }
                            placeholder="e.g., Preventive Metabolic Biomarker Clarity"
                            className={inputClass(Boolean(errs.topic))}
                          />
                        </div>

                        {/* Persona Linkage */}
                        <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3.5">
                          <p className="text-xs font-semibold text-slate-800">
                            Connected Customer Personas *
                          </p>
                          {intel.personas.length === 0 ? (
                            <p className="mt-1 text-xs text-slate-500">
                              Add a persona first to link this interest theme.
                            </p>
                          ) : (
                            <div className="mt-2 flex flex-wrap gap-3">
                              {intel.personas.map((persona) => {
                                const checked = interest.linkedPersonaIds.includes(
                                  persona.id,
                                );
                                return (
                                  <label
                                    key={persona.id}
                                    className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-800"
                                  >
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      onChange={(e) => {
                                        const nextIds = e.target.checked
                                          ? Array.from(
                                              new Set([
                                                ...interest.linkedPersonaIds,
                                                persona.id,
                                              ]),
                                            )
                                          : interest.linkedPersonaIds.filter(
                                              (id) => id !== persona.id,
                                            );
                                        updateInterest(interest.id, {
                                          linkedPersonaIds: nextIds,
                                        });
                                      }}
                                      className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-600"
                                    />
                                    <span>
                                      {persona.name.trim() || 'Untitled Persona'}
                                      {persona.approved ? '' : ' (Draft)'}
                                    </span>
                                  </label>
                                );
                              })}
                            </div>
                          )}
                        </div>

                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                          <TagListEditor
                            id={`interest-questions-${interest.id}`}
                            label="Frequent Customer Questions"
                            items={interest.frequentQuestions}
                            placeholder="Add a question customers ask"
                            onChange={(items) =>
                              updateInterest(interest.id, {
                                frequentQuestions: items,
                              })
                            }
                          />
                          <TagListEditor
                            id={`interest-problems-${interest.id}`}
                            label="Problems They Want Solved"
                            items={interest.problemsToSolve}
                            placeholder="Add a problem to solve"
                            onChange={(items) =>
                              updateInterest(interest.id, {
                                problemsToSolve: items,
                              })
                            }
                          />
                          <TagListEditor
                            id={`interest-content-${interest.id}`}
                            label="Content Consumed"
                            items={interest.contentConsumed}
                            placeholder="e.g., Clinical explainers, podcasts"
                            onChange={(items) =>
                              updateInterest(interest.id, {
                                contentConsumed: items,
                              })
                            }
                          />
                          <TagListEditor
                            id={`interest-search-${interest.id}`}
                            label="Search Topics & Keywords"
                            items={interest.searchTopics}
                            placeholder="e.g., preventive blood panel austin"
                            onChange={(items) =>
                              updateInterest(interest.id, { searchTopics: items })
                            }
                          />
                          <TagListEditor
                            id={`interest-products-${interest.id}`}
                            label="Product / Service Interests"
                            items={interest.productOrServiceInterests}
                            placeholder="Add product or offer interest"
                            onChange={(items) =>
                              updateInterest(interest.id, {
                                productOrServiceInterests: items,
                              })
                            }
                          />
                          <TagListEditor
                            id={`interest-triggers-${interest.id}`}
                            label="Purchase Triggers"
                            items={interest.purchaseTriggers}
                            placeholder="Add buying trigger"
                            onChange={(items) =>
                              updateInterest(interest.id, {
                                purchaseTriggers: items,
                              })
                            }
                          />
                          <TagListEditor
                            id={`interest-concerns-${interest.id}`}
                            label="Concerns / Objections"
                            items={interest.concernsOrObjections}
                            placeholder="Add common objection"
                            onChange={(items) =>
                              updateInterest(interest.id, {
                                concernsOrObjections: items,
                              })
                            }
                          />
                          <TagListEditor
                            id={`interest-seasonal-${interest.id}`}
                            label="Seasonal / Situational Interests"
                            items={interest.seasonalOrSituationalInterests}
                            placeholder="e.g., Q1 reset, post-travel fatigue"
                            onChange={(items) =>
                              updateInterest(interest.id, {
                                seasonalOrSituationalInterests: items,
                              })
                            }
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="mt-3.5 grid grid-cols-1 gap-2 text-xs text-slate-700 sm:grid-cols-2">
                        {interest.frequentQuestions.length > 0 && (
                          <p>
                            <strong className="text-slate-900">Questions:</strong>{' '}
                            {interest.frequentQuestions.join(' · ')}
                          </p>
                        )}
                        {interest.problemsToSolve.length > 0 && (
                          <p>
                            <strong className="text-slate-900">Problems:</strong>{' '}
                            {interest.problemsToSolve.join(' · ')}
                          </p>
                        )}
                        {interest.searchTopics.length > 0 && (
                          <p>
                            <strong className="text-slate-900">Search Topics:</strong>{' '}
                            {interest.searchTopics.join(' · ')}
                          </p>
                        )}
                        {interest.purchaseTriggers.length > 0 && (
                          <p>
                            <strong className="text-slate-900">Purchase Triggers:</strong>{' '}
                            {interest.purchaseTriggers.join(' · ')}
                          </p>
                        )}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}

          {/* Step Footer */}
          <div className="flex flex-col justify-between gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={() => setActiveStep('personas')}
              className="inline-flex min-h-[42px] items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back to Personas</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveStep('review')}
              className="inline-flex min-h-[42px] items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50"
            >
              <span>Review & Complete</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </section>
      )}

      {/* ===================================================================== */}
      {/* STEP 03: CONSOLIDATED REVIEW & COMPLETE                               */}
      {/* ===================================================================== */}
      {activeStep === 'review' && (
        <section
          data-testid="customer-intel-review-panel"
          className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6"
        >
          <div className="flex flex-col justify-between gap-3 border-b border-slate-100 pb-4 sm:flex-row sm:items-center">
            <div className="flex items-start gap-2.5">
              <ClipboardCheck className="mt-0.5 h-5 w-5 text-blue-600" strokeWidth={1.75} />
              <div>
                <h3 className="text-base font-semibold text-slate-900">
                  03. Review & Approve Customer Intelligence
                </h3>
                <p className="mt-0.5 text-xs text-slate-500">
                  Only approved Customer Personas and linked Audience Interests become downstream
                  verified context for Marketing Strategy and Content Strategy.
                </p>
              </div>
            </div>

            <span
              className={`text-xs font-semibold whitespace-nowrap ${
                moduleStatus === 'completed' ? 'text-emerald-700' : 'text-amber-700'
              }`}
            >
              {moduleStatus === 'completed'
                ? 'Module Completed'
                : completionCheck.allowed
                  ? 'Ready to Complete'
                  : 'Approvals Pending'}
            </span>
          </div>

          {!completionCheck.allowed && (
            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-xs text-amber-950">
              <p className="font-semibold">Required before marking Completed:</p>
              <ul className="mt-1 list-disc space-y-1 pl-4 text-amber-900">
                {completionCheck.blockers.map((blocker, idx) => (
                  <li key={idx}>{blocker}</li>
                ))}
              </ul>
            </div>
          )}

          {(completionCheck.unapprovedPersonaCount > 0 ||
            completionCheck.unapprovedInterestCount > 0) && (
            <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3.5 text-xs text-slate-700">
              Note: You currently have{' '}
              <strong>{completionCheck.unapprovedPersonaCount}</strong> unapproved persona draft(s)
              and <strong>{completionCheck.unapprovedInterestCount}</strong> unapproved interest
              draft(s). Unapproved items stay in your workspace for future refinement and will NOT
              be exposed to downstream strategy modules.
            </div>
          )}

          {/* Consolidated Personas Summary */}
          <div className="mt-5 divide-y divide-slate-200">
            <div className="py-4 first:pt-0">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="text-sm font-semibold text-slate-900">
                  01. Approved Customer Personas ({completionCheck.approvedPersonasCount})
                </h4>
                <button
                  type="button"
                  onClick={() => setActiveStep('personas')}
                  className="inline-flex min-h-[36px] items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  <Edit3 className="h-3.5 w-3.5" />
                  <span>Edit Personas</span>
                </button>
              </div>
              {intel.personas.filter((p) => p.approved).length === 0 ? (
                <p className="mt-2 text-xs text-slate-500">
                  No approved personas yet.
                </p>
              ) : (
                <ul className="mt-3 space-y-2.5">
                  {intel.personas
                    .filter((p) => p.approved)
                    .map((p) => (
                      <li
                        key={p.id}
                        className="rounded-lg border border-slate-200 bg-slate-50/50 p-3.5 text-xs"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-slate-900">{p.name}</span>
                          <span className="text-slate-500">· {p.roleOrSegment}</span>
                        </div>
                        <p className="mt-1 text-slate-700">{p.summary}</p>
                        <p className="mt-1 text-slate-500">
                          <strong>Triggers:</strong> {p.purchasingTriggers.join(' · ')}
                        </p>
                      </li>
                    ))}
                </ul>
              )}
            </div>

            {/* Consolidated Audience Interests Summary */}
            <div className="py-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="text-sm font-semibold text-slate-900">
                  02. Approved Audience Interests ({completionCheck.approvedInterestsCount})
                </h4>
                <button
                  type="button"
                  onClick={() => setActiveStep('audienceInterests')}
                  className="inline-flex min-h-[36px] items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  <Edit3 className="h-3.5 w-3.5" />
                  <span>Edit Interests</span>
                </button>
              </div>
              {intel.interests.filter((i) => i.approved).length === 0 ? (
                <p className="mt-2 text-xs text-slate-500">
                  No approved audience interests yet.
                </p>
              ) : (
                <ul className="mt-3 space-y-2.5">
                  {intel.interests
                    .filter((i) => i.approved)
                    .map((i) => {
                      const linkedNames = intel.personas
                        .filter((p) => i.linkedPersonaIds.includes(p.id))
                        .map((p) => p.name);
                      return (
                        <li
                          key={i.id}
                          className="rounded-lg border border-slate-200 bg-slate-50/50 p-3.5 text-xs"
                        >
                          <p className="font-semibold text-slate-900">{i.topic}</p>
                          <p className="mt-0.5 text-slate-500">
                            <strong>Personas:</strong>{' '}
                            {linkedNames.join(', ') || 'Unlinked'}
                          </p>
                          {i.frequentQuestions.length > 0 && (
                            <p className="mt-1 text-slate-700">
                              <strong>Key Questions:</strong>{' '}
                              {i.frequentQuestions.join(' · ')}
                            </p>
                          )}
                        </li>
                      );
                    })}
                </ul>
              )}
            </div>
          </div>

          {/* Traceability Metadata */}
          {(intel.personaSynthesis.promptId || intel.interestSynthesis.promptId) && (
            <div className="mt-2 border-t border-slate-100 pt-4 text-xs text-slate-500 space-y-1">
              {intel.personaSynthesis.promptId && (
                <p>
                  Personas AI Provenance:{' '}
                  <code className="font-mono text-slate-700">
                    {intel.personaSynthesis.promptId}
                  </code>{' '}
                  v{intel.personaSynthesis.promptVersion} · {intel.personaSynthesis.model}
                </p>
              )}
              {intel.interestSynthesis.promptId && (
                <p>
                  Interests AI Provenance:{' '}
                  <code className="font-mono text-slate-700">
                    {intel.interestSynthesis.promptId}
                  </code>{' '}
                  v{intel.interestSynthesis.promptVersion} · {intel.interestSynthesis.model}
                </p>
              )}
            </div>
          )}

          {/* Review Footer Actions */}
          <div className="mt-6 flex flex-col justify-between gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={() => setActiveStep('audienceInterests')}
              className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Previous Section</span>
            </button>

            <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
              <button
                type="button"
                onClick={() => void handleSaveProgress()}
                disabled={saving}
                className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              >
                <Save className="h-4 w-4" />
                <span>Save Progress</span>
              </button>

              <button
                type="button"
                onClick={() => void handleCompleteModule()}
                disabled={saving || !completionCheck.allowed}
                className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                <span>
                  {moduleStatus === 'completed'
                    ? 'Save Updated Customer Intelligence'
                    : 'Complete Customer Intelligence'}
                </span>
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Regeneration Safeguard Dialog */}
      <ConfirmDialog
        open={confirmRegenTarget !== null}
        title={
          confirmRegenTarget === 'personas'
            ? 'Regenerate AI customer persona hypotheses?'
            : 'Regenerate AI audience interest hypotheses?'
        }
        description={
          confirmRegenTarget === 'personas'
            ? 'Regenerating runs customer_personas_synthesis using your approved Brand Foundation and Brand Messaging. Your existing approved or edited personas will stay untouched.'
            : 'Regenerating runs customer_audience_interests using your approved personas and upstream strategy. Existing approved audience interests will stay untouched.'
        }
        confirmLabel="Generate New Hypotheses"
        cancelLabel="Cancel"
        variant="primary"
        onConfirm={() => {
          const target = confirmRegenTarget;
          setConfirmRegenTarget(null);
          if (target === 'personas') void runPersonaGeneration();
          if (target === 'interests') void runInterestGeneration();
        }}
        onCancel={() => setConfirmRegenTarget(null)}
      />

      {/* Delete Persona Confirmation Dialog */}
      <ConfirmDialog
        open={pendingDeletePersona !== null}
        title={`Remove "${pendingDeletePersona?.name || 'this persona'}"?`}
        description="Removing this persona deletes it from Customer Intelligence and automatically unlinks it from any associated audience interests."
        confirmLabel="Remove Persona"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={() => void handleConfirmDeletePersona()}
        onCancel={() => setPendingDeletePersona(null)}
      />

      {/* Delete Interest Confirmation Dialog */}
      <ConfirmDialog
        open={pendingDeleteInterest !== null}
        title={`Remove "${pendingDeleteInterest?.topic || 'this audience interest'}"?`}
        description="This audience interest cluster will be permanently removed from this brand's Customer Intelligence module."
        confirmLabel="Remove Interest"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={() => void handleConfirmDeleteInterest()}
        onCancel={() => setPendingDeleteInterest(null)}
      />
    </div>
  );
}

interface TagListEditorProps {
  id: string;
  label: string;
  items: string[];
  placeholder: string;
  hasError?: boolean;
  onChange: (nextItems: string[]) => void;
}

function TagListEditor({
  id,
  label,
  items,
  placeholder,
  hasError,
  onChange,
}: TagListEditorProps) {
  const [draft, setDraft] = useState<string>('');

  const addDraft = () => {
    const cleaned = draft.trim();
    if (!cleaned) return;
    if (!items.includes(cleaned)) {
      onChange([...items, cleaned]);
    }
    setDraft('');
  };

  return (
    <div
      className={`rounded-lg border p-3 ${
        hasError ? 'border-red-300 bg-red-50/30' : 'border-slate-200 bg-white'
      }`}
    >
      <label htmlFor={id} className="block text-xs font-semibold text-slate-800">
        {label}
      </label>

      {items.length > 0 && (
        <ul className="mt-2 space-y-1.5">
          {items.map((item, idx) => (
            <li
              key={`${item}-${idx}`}
              className="flex items-center justify-between gap-2 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-800"
            >
              <span className="min-w-0 break-words">{item}</span>
              <button
                type="button"
                onClick={() => onChange(items.filter((_, i) => i !== idx))}
                aria-label={`Remove ${item} from ${label}`}
                className="shrink-0 text-slate-400 hover:text-red-600"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-2 flex gap-2">
        <input
          id={id}
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              addDraft();
            }
          }}
          placeholder={placeholder}
          className="min-h-[38px] min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none"
        />
        <button
          type="button"
          onClick={addDraft}
          className="inline-flex min-h-[38px] shrink-0 items-center rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
        >
          Add
        </button>
      </div>
    </div>
  );
}
