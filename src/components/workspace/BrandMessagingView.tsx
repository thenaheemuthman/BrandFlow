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
  Loader2,
  Plus,
  RefreshCw,
  Save,
  ShieldCheck,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { api } from '../../services/api';
import { executeBrandPrompt } from '../../services/promptExecution';
import type { Brand, BrandStrategyModule, ModuleStatus } from '../../types/brand';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { FOUNDATION_SECTIONS } from '../../utils/brandFoundationLogic';
import {
  MESSAGING_SECTIONS,
  applyAiMessagingResult,
  buildMessagingPromptVariables,
  buildMessagingUpsertPayload,
  canCompleteBrandMessaging,
  checkMessagingGenerationReadiness,
  computeMessagingProgress,
  createInitialBrandMessagingState,
  evaluateFoundationDependency,
  hasAnyApprovedMessagingSection,
  hydrateBrandMessagingState,
  validateMessagingSection,
  type AudienceAngleItem,
  type BrandMessagingState,
  type MessagingPillarItem,
  type MessagingSectionKey,
  type MessagingStepKey,
  type MessagingValidationErrors,
} from '../../utils/brandMessagingLogic';

interface BrandMessagingViewProps {
  brand: Brand;
  onModuleSaved: (module: BrandStrategyModule) => void | Promise<void>;
  onToast: (type: 'success' | 'error', message: string) => void;
  onNavigateToBrandFoundation: () => void;
  onNavigateToBrandSettings: () => void;
}

function createItemId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

const STEP_SEQUENCE: readonly MessagingStepKey[] = [
  'coreValueProposition',
  'messagingPillars',
  'voiceAndTone',
  'audienceAngles',
  'review',
];

export function BrandMessagingView({
  brand,
  onModuleSaved,
  onToast,
  onNavigateToBrandFoundation,
  onNavigateToBrandSettings,
}: BrandMessagingViewProps) {
  const [messaging, setMessaging] = useState<BrandMessagingState>(() =>
    createInitialBrandMessagingState(brand),
  );
  const [foundationModule, setFoundationModule] = useState<BrandStrategyModule | null>(null);
  const [moduleStatus, setModuleStatus] = useState<ModuleStatus>(
    brand.moduleStatuses.brandMessaging ?? 'not_started',
  );
  const [activeStep, setActiveStep] = useState<MessagingStepKey>('coreValueProposition');
  const [loadingModule, setLoadingModule] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sectionErrors, setSectionErrors] = useState<MessagingValidationErrors>({});
  const [saving, setSaving] = useState<boolean>(false);
  const [generatingAi, setGeneratingAi] = useState<boolean>(false);
  const [missingInfoNotice, setMissingInfoNotice] = useState<{
    message: string;
    missingFields: string[];
  } | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [showRegenerateConfirm, setShowRegenerateConfirm] = useState<boolean>(false);
  const [showFoundationDetails, setShowFoundationDetails] = useState<boolean>(false);

  const [newAttributeInput, setNewAttributeInput] = useState<string>('');
  const [newGuardrailInput, setNewGuardrailInput] = useState<string>('');

  // Load Brand Foundation (prerequisite) and Brand Messaging strictly for the active brand
  useEffect(() => {
    let cancelled = false;
    setLoadingModule(true);
    setLoadError(null);
    setSectionErrors({});
    setMissingInfoNotice(null);
    setAiError(null);

    api
      .listStrategyModules(brand.id)
      .then(({ modules }) => {
        if (cancelled) return;
        const foundFoundation =
          modules.find((m) => m.moduleKey === 'brandFoundation') ?? null;
        const foundMessaging =
          modules.find((m) => m.moduleKey === 'brandMessaging') ?? null;

        setFoundationModule(foundFoundation);

        const foundationCheck = evaluateFoundationDependency(brand, foundFoundation);
        const hydrated = hydrateBrandMessagingState(
          brand,
          foundMessaging,
          foundationCheck.approvedFoundation,
        );

        setMessaging(hydrated);
        setModuleStatus(
          foundMessaging?.status ?? brand.moduleStatuses.brandMessaging ?? 'not_started',
        );

        if (foundMessaging?.status === 'completed') {
          setActiveStep('review');
        } else {
          const firstUnapproved = MESSAGING_SECTIONS.find((s) => !hydrated[s.key].approved);
          setActiveStep(firstUnapproved ? firstUnapproved.key : 'review');
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setFoundationModule(null);
        setMessaging(createInitialBrandMessagingState(brand));
        setLoadError(
          err instanceof Error ? err.message : 'Unable to load Brand Messaging data.',
        );
      })
      .finally(() => {
        if (!cancelled) setLoadingModule(false);
      });

    return () => {
      cancelled = true;
    };
  }, [brand.id]);

  const readiness = useMemo(() => {
    try {
      return checkMessagingGenerationReadiness(brand, foundationModule);
    } catch (err) {
      return {
        ready: false,
        foundationReady: false,
        profileReady: false,
        missingProfileFields: [],
        missingFoundationSections: ['purpose', 'mission', 'vision', 'coreValues', 'positioning'],
        foundationStatus: 'not_started' as ModuleStatus,
        reason: err instanceof Error ? err.message : 'Brand context isolation error.',
        approvedFoundation: null,
      };
    }
  }, [brand, foundationModule]);

  const progress = useMemo(() => computeMessagingProgress(messaging), [messaging]);
  const completionCheck = useMemo(() => canCompleteBrandMessaging(messaging), [messaging]);

  const persistState = async (
    nextState: BrandMessagingState,
    requestedStatus: ModuleStatus,
    successMessage?: string,
  ): Promise<boolean> => {
    setSaving(true);
    try {
      const payload = buildMessagingUpsertPayload(nextState, requestedStatus);
      const { module } = await api.upsertStrategyModule(brand.id, 'brandMessaging', payload);
      setMessaging(
        hydrateBrandMessagingState(brand, module, readiness.approvedFoundation),
      );
      setModuleStatus(module.status);
      await onModuleSaved(module);
      if (successMessage) {
        onToast('success', successMessage);
      }
      return true;
    } catch (err) {
      onToast(
        'error',
        err instanceof Error ? err.message : 'Failed to save Brand Messaging.',
      );
      return false;
    } finally {
      setSaving(false);
    }
  };

  const runAiGeneration = async () => {
    setAiError(null);
    setMissingInfoNotice(null);

    if (!readiness.foundationReady || !readiness.approvedFoundation) {
      setAiError(
        readiness.reason ??
          'Complete and approve Brand Foundation before generating Brand Messaging.',
      );
      return;
    }

    if (!readiness.profileReady) {
      setMissingInfoNotice({
        message:
          'Add the missing required brand profile fields before generating messaging.',
        missingFields: readiness.missingProfileFields,
      });
      return;
    }

    setGeneratingAi(true);
    try {
      const result = await executeBrandPrompt({
        brandId: brand.id,
        promptId: 'brand_messaging_framework',
        includeApprovedModules: true,
        expectedOwnerUserId: brand.userId,
        variables: buildMessagingPromptVariables(
          brand,
          readiness.approvedFoundation,
          messaging,
        ),
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

      const applied = applyAiMessagingResult(messaging, result, {
        overwriteApproved: false,
      });
      if (!applied.applied) {
        setAiError(applied.error ?? 'Generated messaging failed structured validation.');
        return;
      }

      const nextWithFoundation: BrandMessagingState = {
        ...applied.state,
        foundationSnapshot: readiness.approvedFoundation,
      };
      setMessaging(nextWithFoundation);

      const nextStatus: ModuleStatus =
        moduleStatus === 'completed' ? 'completed' : 'in_progress';
      await persistState(
        nextWithFoundation,
        nextStatus,
        'Generated AI messaging suggestions for review. Approved components were preserved.',
      );
    } catch (err) {
      setAiError(
        err instanceof Error ? err.message : 'Unable to generate Brand Messaging.',
      );
    } finally {
      setGeneratingAi(false);
    }
  };

  const handleTriggerGeneration = () => {
    if (generatingAi || saving || !readiness.foundationReady) return;
    if (hasAnyApprovedMessagingSection(messaging) || messaging.aiSynthesis.generatedAt) {
      setShowRegenerateConfirm(true);
      return;
    }
    void runAiGeneration();
  };

  const goToStep = (step: MessagingStepKey) => {
    setSectionErrors({});
    setActiveStep(step);
  };

  const handleSaveDraft = async () => {
    const targetStatus: ModuleStatus =
      moduleStatus === 'completed' && completionCheck.allowed ? 'completed' : 'in_progress';
    await persistState(
      {
        ...messaging,
        foundationSnapshot: readiness.approvedFoundation ?? messaging.foundationSnapshot,
      },
      targetStatus,
      'Saved Brand Messaging progress.',
    );
  };

  const handleApproveSection = async (sectionKey: MessagingSectionKey) => {
    const errors = validateMessagingSection(sectionKey, messaging);
    if (Object.keys(errors).length > 0) {
      setSectionErrors(errors);
      return;
    }
    setSectionErrors({});

    const nowIso = new Date().toISOString();
    const updated: BrandMessagingState = {
      ...messaging,
      foundationSnapshot: readiness.approvedFoundation ?? messaging.foundationSnapshot,
      [sectionKey]: {
        ...messaging[sectionKey],
        approved: true,
        approvedAt: nowIso,
      },
    };

    setMessaging(updated);
    const nextCheck = canCompleteBrandMessaging(updated);
    const persistStatus: ModuleStatus =
      moduleStatus === 'completed' && nextCheck.allowed ? 'completed' : 'in_progress';

    const saved = await persistState(
      updated,
      persistStatus,
      `${MESSAGING_SECTIONS.find((s) => s.key === sectionKey)?.title ?? 'Section'} approved and saved.`,
    );
    if (saved) {
      const idx = STEP_SEQUENCE.indexOf(sectionKey);
      if (idx >= 0 && idx + 1 < STEP_SEQUENCE.length) {
        setActiveStep(STEP_SEQUENCE[idx + 1]);
      }
    }
  };

  const handleCompleteMessaging = async () => {
    if (!completionCheck.allowed) {
      onToast(
        'error',
        'Approve all four Brand Messaging components before completing the module.',
      );
      return;
    }
    await persistState(
      {
        ...messaging,
        foundationSnapshot: readiness.approvedFoundation ?? messaging.foundationSnapshot,
      },
      'completed',
      'Brand Messaging approved and marked completed.',
    );
  };

  const updateCoreValueProp = (
    patch: Partial<BrandMessagingState['coreValueProposition']>,
  ) => {
    setSectionErrors({});
    setMessaging((prev) => ({
      ...prev,
      completedAt: null,
      approvedSummary: null,
      coreValueProposition: {
        ...prev.coreValueProposition,
        ...patch,
        approved: patch.approved !== undefined ? patch.approved : false,
        approvedAt: patch.approved !== undefined ? patch.approvedAt ?? null : null,
      },
    }));
    if (moduleStatus === 'completed') setModuleStatus('in_progress');
  };

  const updatePillars = (
    patch: Partial<BrandMessagingState['messagingPillars']>,
  ) => {
    setSectionErrors({});
    setMessaging((prev) => ({
      ...prev,
      completedAt: null,
      approvedSummary: null,
      messagingPillars: {
        ...prev.messagingPillars,
        ...patch,
        approved: patch.approved !== undefined ? patch.approved : false,
        approvedAt: patch.approved !== undefined ? patch.approvedAt ?? null : null,
      },
    }));
    if (moduleStatus === 'completed') setModuleStatus('in_progress');
  };

  const updateVoiceAndTone = (
    patch: Partial<BrandMessagingState['voiceAndTone']>,
  ) => {
    setSectionErrors({});
    setMessaging((prev) => ({
      ...prev,
      completedAt: null,
      approvedSummary: null,
      voiceAndTone: {
        ...prev.voiceAndTone,
        ...patch,
        approved: patch.approved !== undefined ? patch.approved : false,
        approvedAt: patch.approved !== undefined ? patch.approvedAt ?? null : null,
      },
    }));
    if (moduleStatus === 'completed') setModuleStatus('in_progress');
  };

  const updateAudienceAngles = (
    patch: Partial<BrandMessagingState['audienceAngles']>,
  ) => {
    setSectionErrors({});
    setMessaging((prev) => ({
      ...prev,
      completedAt: null,
      approvedSummary: null,
      audienceAngles: {
        ...prev.audienceAngles,
        ...patch,
        approved: patch.approved !== undefined ? patch.approved : false,
        approvedAt: patch.approved !== undefined ? patch.approvedAt ?? null : null,
      },
    }));
    if (moduleStatus === 'completed') setModuleStatus('in_progress');
  };

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
      {/* Module Intro, Progress & AI Generation Card */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
        <div className="flex flex-col justify-between gap-4 border-b border-slate-100 pb-5 sm:flex-row sm:items-start">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span>Phase 2A Strategy Module</span>
              <span aria-hidden="true">·</span>
              <span
                data-testid="messaging-module-status"
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
              Brand Messaging
            </h2>
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-600">
              Translate <strong className="font-semibold text-slate-800">{brand.brandName}</strong>’s
              approved Brand Foundation into a clear value proposition, strategic pillars, voice
              guardrails, and audience messaging angles.
            </p>
          </div>

          <button
            type="button"
            onClick={handleTriggerGeneration}
            disabled={generatingAi || saving || !readiness.foundationReady}
            title={
              !readiness.foundationReady
                ? 'Complete and approve Brand Foundation before generating Brand Messaging.'
                : undefined
            }
            className="inline-flex min-h-[44px] shrink-0 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 whitespace-nowrap"
          >
            {generatingAi ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : messaging.aiSynthesis.generatedAt ? (
              <RefreshCw className="h-4 w-4" strokeWidth={1.75} />
            ) : (
              <Sparkles className="h-4 w-4" strokeWidth={1.75} />
            )}
            <span>
              {generatingAi
                ? 'Generating Suggestions...'
                : messaging.aiSynthesis.generatedAt
                  ? 'Regenerate AI Suggestions'
                  : 'Generate AI Draft'}
            </span>
          </button>
        </div>

        {/* Progress Bar */}
        <div className="mt-4">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="font-medium text-slate-700">Messaging Progress</span>
            <span
              data-testid="messaging-progress-label"
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
          aria-label="Brand Messaging Components"
          className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-3"
        >
          {MESSAGING_SECTIONS.map((sec) => {
            const isCurrent = activeStep === sec.key;
            const status = progress.sectionStatuses[sec.key];
            return (
              <button
                key={sec.key}
                type="button"
                onClick={() => goToStep(sec.key)}
                aria-current={isCurrent ? 'step' : undefined}
                className={`flex min-h-[52px] flex-col justify-between rounded-lg border px-3 py-2 text-left transition-colors ${
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
            onClick={() => goToStep('review')}
            aria-current={activeStep === 'review' ? 'step' : undefined}
            className={`col-span-2 sm:col-span-1 flex min-h-[52px] flex-col justify-between rounded-lg border px-3 py-2 text-left transition-colors ${
              activeStep === 'review'
                ? 'border-blue-600 bg-blue-50/70 text-blue-900'
                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            <div className="flex items-center justify-between gap-1.5">
              <span className="font-mono text-[11px] font-medium text-slate-400 tabular-nums">
                05
              </span>
              {moduleStatus === 'completed' && (
                <CheckCircle2
                  className="h-3.5 w-3.5 shrink-0 text-emerald-600"
                  aria-label="Completed"
                />
              )}
            </div>
            <span className="mt-1 text-xs font-semibold leading-snug">Review & Complete</span>
          </button>
        </nav>

        {/* Grounded AI Fact vs Suggestion Metadata Strip */}
        {messaging.aiSynthesis.generatedAt && (
          <div className="mt-5 grid grid-cols-1 gap-4 border-t border-slate-100 pt-4 text-xs sm:grid-cols-2">
            <div>
              <p className="font-semibold text-slate-800">
                Verified Facts Used by AI ({messaging.aiSynthesis.suppliedFactsUsed.length})
              </p>
              {messaging.aiSynthesis.suppliedFactsUsed.length > 0 ? (
                <ul className="mt-1.5 list-disc space-y-1 pl-4 text-slate-600">
                  {messaging.aiSynthesis.suppliedFactsUsed.slice(0, 4).map((fact, idx) => (
                    <li key={idx}>{fact}</li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1 text-slate-500">
                  Verified brand profile and foundation facts supplied.
                </p>
              )}
            </div>
            <div>
              <p className="font-semibold text-slate-800">
                Missing Context Noted by AI ({messaging.aiSynthesis.missingContextNotes.length})
              </p>
              {messaging.aiSynthesis.missingContextNotes.length > 0 ? (
                <ul className="mt-1.5 list-disc space-y-1 pl-4 text-slate-600">
                  {messaging.aiSynthesis.missingContextNotes.slice(0, 4).map((note, idx) => (
                    <li key={idx}>{note}</li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1 text-slate-500">No missing profile gaps flagged.</p>
              )}
            </div>
          </div>
        )}
      </section>

      {/* Prerequisite Gate: Brand Foundation Dependency */}
      {!readiness.foundationReady ? (
        <section
          role="status"
          data-testid="messaging-foundation-prerequisite"
          className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-amber-950"
        >
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
            <div className="flex items-start gap-3">
              <Compass className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" strokeWidth={1.75} />
              <div>
                <h3 className="text-sm font-semibold text-amber-950">
                  Brand Foundation must be completed first
                </h3>
                <p className="mt-1 text-xs leading-relaxed text-amber-900">
                  Brand Messaging uses {brand.brandName}’s approved Purpose, Mission, Vision,
                  Core Values, and Positioning as its verified source of truth. AI messaging
                  generation is locked until Brand Foundation is completed so speculative claims
                  are never generated.
                </p>
                {readiness.missingFoundationSections.length > 0 && (
                  <p className="mt-2 text-xs text-amber-900">
                    Remaining foundation sections:{' '}
                    <span className="font-semibold">
                      {readiness.missingFoundationSections
                        .map(
                          (key) =>
                            FOUNDATION_SECTIONS.find((s) => s.key === key)?.title ?? key,
                        )
                        .join(', ')}
                    </span>
                  </p>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={onNavigateToBrandFoundation}
              className="inline-flex min-h-[40px] shrink-0 items-center justify-center gap-1.5 rounded-lg bg-amber-900 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-amber-950 whitespace-nowrap"
            >
              <span>Complete Brand Foundation</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </section>
      ) : (
        readiness.approvedFoundation && (
          <section
            data-testid="messaging-foundation-source"
            className="rounded-xl border border-slate-200 bg-slate-50/70 px-5 py-3.5"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs">
                <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-600" strokeWidth={1.75} />
                <span className="font-semibold text-slate-800">
                  Source of Truth: Approved Brand Foundation
                </span>
                <span className="text-slate-500">
                  ({readiness.approvedFoundation.coreValues.length} core value
                  {readiness.approvedFoundation.coreValues.length === 1 ? '' : 's'},{' '}
                  {readiness.approvedFoundation.differentiationAttributes.length} differentiation
                  attribute
                  {readiness.approvedFoundation.differentiationAttributes.length === 1 ? '' : 's'})
                </span>
              </div>

              <button
                type="button"
                onClick={() => setShowFoundationDetails((prev) => !prev)}
                className="text-xs font-medium text-blue-600 hover:text-blue-700"
              >
                {showFoundationDetails ? 'Hide Foundation Summary' : 'View Approved Foundation'}
              </button>
            </div>

            {showFoundationDetails && (
              <dl className="mt-3 grid grid-cols-1 gap-3 border-t border-slate-200/80 pt-3 text-xs sm:grid-cols-2">
                <div>
                  <dt className="font-semibold text-slate-700">Approved Purpose</dt>
                  <dd className="mt-0.5 text-slate-600">
                    {readiness.approvedFoundation.purposeStatement}
                  </dd>
                </div>
                <div>
                  <dt className="font-semibold text-slate-700">Approved Mission</dt>
                  <dd className="mt-0.5 text-slate-600">
                    {readiness.approvedFoundation.missionStatement}
                  </dd>
                </div>
                <div>
                  <dt className="font-semibold text-slate-700">Approved Vision</dt>
                  <dd className="mt-0.5 text-slate-600">
                    {readiness.approvedFoundation.visionStatement}
                  </dd>
                </div>
                <div>
                  <dt className="font-semibold text-slate-700">Approved Positioning</dt>
                  <dd className="mt-0.5 text-slate-600">
                    {readiness.approvedFoundation.positioningStatement}
                  </dd>
                </div>
              </dl>
            )}
          </section>
        )
      )}

      {/* Alerts: Load error / Missing Info / AI error */}
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
          data-testid="messaging-missing-info"
          className="flex flex-col justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950 sm:flex-row sm:items-center"
        >
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <div>
              <p className="font-semibold">
                Additional brand context required before AI messaging generation
              </p>
              <p className="mt-0.5 text-xs leading-relaxed text-amber-900">
                {missingInfoNotice.message} Missing fields:{' '}
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
          data-testid="messaging-ai-error"
          className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900"
        >
          {aiError}
        </div>
      )}

      {/* Step 01: Core Value Proposition */}
      {activeStep === 'coreValueProposition' && (
        <SectionEditorShell
          stepNumber="01"
          title="Core Value Proposition"
          subtitle="Articulate the primary value promise anchored in your approved positioning."
          approved={messaging.coreValueProposition.approved}
          saving={saving}
          onPrevious={undefined}
          onSaveDraft={() => void handleSaveDraft()}
          onApprove={() => void handleApproveSection('coreValueProposition')}
          approveLabel="Approve Value Proposition & Continue"
        >
          <div className="space-y-5">
            {messaging.coreValueProposition.aiSuggestedStatement && (
              <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-4">
                <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-900">
                    <Sparkles className="h-3.5 w-3.5 text-amber-600" />
                    <span>
                      AI-Generated Suggestion{' '}
                      {messaging.coreValueProposition.suggestionStatus === 'approved'
                        ? '(Adopted into draft)'
                        : messaging.coreValueProposition.suggestionStatus === 'rejected'
                          ? '(Dismissed)'
                          : '(Unapproved Draft)'}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        updateCoreValueProp({
                          statement:
                            messaging.coreValueProposition.aiSuggestedStatement ?? '',
                          suggestionStatus: 'approved',
                        })
                      }
                      className="inline-flex min-h-[34px] items-center gap-1 rounded-md border border-amber-300 bg-white px-3 py-1 text-xs font-semibold text-amber-950 hover:bg-amber-100"
                    >
                      <Check className="h-3.5 w-3.5" />
                      <span>Use Suggestion</span>
                    </button>
                    {messaging.coreValueProposition.suggestionStatus !== 'rejected' && (
                      <button
                        type="button"
                        onClick={() =>
                          updateCoreValueProp({ suggestionStatus: 'rejected' })
                        }
                        className="inline-flex min-h-[34px] items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium text-amber-900 hover:bg-amber-100"
                      >
                        <X className="h-3.5 w-3.5" />
                        <span>Dismiss</span>
                      </button>
                    )}
                  </div>
                </div>
                <p className="mt-2 text-sm leading-relaxed text-slate-800">
                  {messaging.coreValueProposition.aiSuggestedStatement}
                </p>
              </div>
            )}

            <div>
              <label
                htmlFor="core-value-prop-statement"
                className="block text-xs font-semibold text-slate-800"
              >
                Approved / Working Core Value Proposition *
              </label>
              <textarea
                id="core-value-prop-statement"
                rows={4}
                value={messaging.coreValueProposition.statement}
                onChange={(e) => updateCoreValueProp({ statement: e.target.value })}
                placeholder="State the concrete outcome customers gain and why it is credibly delivered by your brand."
                className={inputClass(Boolean(sectionErrors.statement))}
              />
              {sectionErrors.statement && (
                <p className="mt-1 text-xs text-red-600">{sectionErrors.statement}</p>
              )}
            </div>
          </div>
        </SectionEditorShell>
      )}

      {/* Step 02: Messaging Pillars */}
      {activeStep === 'messagingPillars' && (
        <SectionEditorShell
          stepNumber="02"
          title="Messaging Pillars"
          subtitle="Define at least two strategic messaging themes backed by verified brand capabilities."
          approved={messaging.messagingPillars.approved}
          saving={saving}
          onPrevious={() => goToStep('coreValueProposition')}
          onSaveDraft={() => void handleSaveDraft()}
          onApprove={() => void handleApproveSection('messagingPillars')}
          approveLabel="Approve Messaging Pillars & Continue"
        >
          <div className="space-y-5">
            {messaging.messagingPillars.aiSuggestedPillars.length > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-4">
                <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-900">
                    <Sparkles className="h-3.5 w-3.5 text-amber-600" />
                    <span>
                      AI-Suggested Messaging Pillars (
                      {messaging.messagingPillars.aiSuggestedPillars.length}){' '}
                      {messaging.messagingPillars.suggestionStatus === 'approved'
                        ? '— Adopted into draft'
                        : messaging.messagingPillars.suggestionStatus === 'rejected'
                          ? '— Dismissed'
                          : '— Unapproved Draft'}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        updatePillars({
                          pillars: messaging.messagingPillars.aiSuggestedPillars.map(
                            (p, idx) => ({
                              id: createItemId(`pillar-${idx + 1}`),
                              title: p.title,
                              summary: p.summary,
                            }),
                          ),
                          suggestionStatus: 'approved',
                        })
                      }
                      className="inline-flex min-h-[34px] items-center gap-1 rounded-md border border-amber-300 bg-white px-3 py-1 text-xs font-semibold text-amber-950 hover:bg-amber-100"
                    >
                      <Check className="h-3.5 w-3.5" />
                      <span>Use Suggested Pillars</span>
                    </button>
                    {messaging.messagingPillars.suggestionStatus !== 'rejected' && (
                      <button
                        type="button"
                        onClick={() => updatePillars({ suggestionStatus: 'rejected' })}
                        className="inline-flex min-h-[34px] items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium text-amber-900 hover:bg-amber-100"
                      >
                        <X className="h-3.5 w-3.5" />
                        <span>Dismiss</span>
                      </button>
                    )}
                  </div>
                </div>

                <ul className="mt-3 divide-y divide-amber-200/70 text-xs text-slate-800">
                  {messaging.messagingPillars.aiSuggestedPillars.map((pillar, idx) => (
                    <li key={pillar.id || idx} className="py-2 first:pt-0 last:pb-0">
                      <p className="font-semibold text-slate-900">{pillar.title}</p>
                      <p className="mt-0.5 text-slate-700">{pillar.summary}</p>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex flex-col justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50/70 p-4 sm:flex-row sm:items-center">
              <div className="text-xs leading-relaxed text-slate-600">
                <strong className="font-semibold text-slate-800">
                  Working Messaging Pillars ({messaging.messagingPillars.pillars.length})
                </strong>
                {' — '}Maintain at least 2 distinct themes with clear supporting summaries.
              </div>
              <button
                type="button"
                onClick={() =>
                  updatePillars({
                    pillars: [
                      ...messaging.messagingPillars.pillars,
                      { id: createItemId('pillar'), title: '', summary: '' },
                    ],
                  })
                }
                className="inline-flex min-h-[40px] shrink-0 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 whitespace-nowrap"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Add Messaging Pillar</span>
              </button>
            </div>

            {sectionErrors.pillars && (
              <p role="alert" className="text-xs font-medium text-red-600">
                {sectionErrors.pillars}
              </p>
            )}

            {messaging.messagingPillars.pillars.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-center">
                <p className="text-sm font-medium text-slate-800">
                  No messaging pillars drafted yet
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Adopt AI-suggested pillars above or add at least 2 strategic messaging pillars.
                </p>
                <button
                  type="button"
                  onClick={() =>
                    updatePillars({
                      pillars: [
                        { id: createItemId('pillar'), title: '', summary: '' },
                        { id: createItemId('pillar'), title: '', summary: '' },
                      ],
                    })
                  }
                  className="mt-4 inline-flex min-h-[40px] items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-medium text-white hover:bg-blue-700"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Add 2 Blank Pillars</span>
                </button>
              </div>
            ) : (
              <div className="divide-y divide-slate-200 border-t border-b border-slate-200">
                {messaging.messagingPillars.pillars.map((pillar: MessagingPillarItem, idx) => (
                  <div key={pillar.id} className="space-y-3 py-5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs font-semibold text-slate-500 tabular-nums">
                        PILLAR 0{idx + 1}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          updatePillars({
                            pillars: messaging.messagingPillars.pillars.filter(
                              (item) => item.id !== pillar.id,
                            ),
                          })
                        }
                        aria-label={`Remove pillar ${pillar.title || idx + 1}`}
                        className="inline-flex min-h-[32px] items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span>Remove</span>
                      </button>
                    </div>

                    <div>
                      <label
                        htmlFor={`pillar-title-${pillar.id}`}
                        className="block text-xs font-semibold text-slate-800"
                      >
                        Pillar Title *
                      </label>
                      <input
                        id={`pillar-title-${pillar.id}`}
                        type="text"
                        value={pillar.title}
                        onChange={(e) =>
                          updatePillars({
                            pillars: messaging.messagingPillars.pillars.map((item) =>
                              item.id === pillar.id ? { ...item, title: e.target.value } : item,
                            ),
                          })
                        }
                        placeholder="e.g., Clinician-Interpreted Clarity"
                        className={inputClass(false)}
                      />
                    </div>

                    <div>
                      <label
                        htmlFor={`pillar-summary-${pillar.id}`}
                        className="block text-xs font-semibold text-slate-800"
                      >
                        Supporting Summary *
                      </label>
                      <textarea
                        id={`pillar-summary-${pillar.id}`}
                        rows={2}
                        value={pillar.summary}
                        onChange={(e) =>
                          updatePillars({
                            pillars: messaging.messagingPillars.pillars.map((item) =>
                              item.id === pillar.id
                                ? { ...item, summary: e.target.value }
                                : item,
                            ),
                          })
                        }
                        placeholder="Explain what this pillar communicates and how brand proof supports it."
                        className={inputClass(false)}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </SectionEditorShell>
      )}

      {/* Step 03: Voice & Tone */}
      {activeStep === 'voiceAndTone' && (
        <SectionEditorShell
          stepNumber="03"
          title="Voice & Tone"
          subtitle="Lock in consistent voice attributes and non-negotiable tone guardrails."
          approved={messaging.voiceAndTone.approved}
          saving={saving}
          onPrevious={() => goToStep('messagingPillars')}
          onSaveDraft={() => void handleSaveDraft()}
          onApprove={() => void handleApproveSection('voiceAndTone')}
          approveLabel="Approve Voice & Tone & Continue"
        >
          <div className="space-y-6">
            {(messaging.voiceAndTone.aiSuggestedAttributes.length > 0 ||
              messaging.voiceAndTone.aiSuggestedGuardrails.length > 0) && (
              <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-4">
                <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-900">
                    <Sparkles className="h-3.5 w-3.5 text-amber-600" />
                    <span>
                      AI-Suggested Voice & Tone{' '}
                      {messaging.voiceAndTone.suggestionStatus === 'approved'
                        ? '(Adopted into draft)'
                        : messaging.voiceAndTone.suggestionStatus === 'rejected'
                          ? '(Dismissed)'
                          : '(Unapproved Draft)'}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        updateVoiceAndTone({
                          attributes: Array.from(
                            new Set([
                              ...messaging.voiceAndTone.attributes,
                              ...messaging.voiceAndTone.aiSuggestedAttributes,
                            ]),
                          ),
                          guardrails: Array.from(
                            new Set([
                              ...messaging.voiceAndTone.guardrails,
                              ...messaging.voiceAndTone.aiSuggestedGuardrails,
                            ]),
                          ),
                          suggestionStatus: 'approved',
                        })
                      }
                      className="inline-flex min-h-[34px] items-center gap-1 rounded-md border border-amber-300 bg-white px-3 py-1 text-xs font-semibold text-amber-950 hover:bg-amber-100"
                    >
                      <Check className="h-3.5 w-3.5" />
                      <span>Use Voice & Tone Suggestions</span>
                    </button>
                    {messaging.voiceAndTone.suggestionStatus !== 'rejected' && (
                      <button
                        type="button"
                        onClick={() =>
                          updateVoiceAndTone({ suggestionStatus: 'rejected' })
                        }
                        className="inline-flex min-h-[34px] items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium text-amber-900 hover:bg-amber-100"
                      >
                        <X className="h-3.5 w-3.5" />
                        <span>Dismiss</span>
                      </button>
                    )}
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-1 gap-3 text-xs sm:grid-cols-2">
                  <div>
                    <p className="font-semibold text-slate-800">Suggested Voice Attributes</p>
                    <p className="mt-1 text-slate-700">
                      {messaging.voiceAndTone.aiSuggestedAttributes.join(' · ') || '—'}
                    </p>
                  </div>
                  <div>
                    <p className="font-semibold text-slate-800">Suggested Tone Guardrails</p>
                    <ul className="mt-1 list-disc space-y-0.5 pl-4 text-slate-700">
                      {messaging.voiceAndTone.aiSuggestedGuardrails.map((item, idx) => (
                        <li key={idx}>{item}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* Voice Attributes Editor */}
            <div>
              <label
                htmlFor="voice-attribute-input"
                className="block text-xs font-semibold text-slate-800"
              >
                Approved / Working Voice Attributes *
              </label>
              <div className="mt-1.5 flex flex-wrap gap-2">
                <input
                  id="voice-attribute-input"
                  type="text"
                  value={newAttributeInput}
                  onChange={(e) => setNewAttributeInput(e.target.value)}
                  placeholder="e.g., Calm, Evidence-led, Direct"
                  className="min-h-[42px] flex-1 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => {
                    const trimmed = newAttributeInput.trim();
                    if (!trimmed) return;
                    if (!messaging.voiceAndTone.attributes.includes(trimmed)) {
                      updateVoiceAndTone({
                        attributes: [...messaging.voiceAndTone.attributes, trimmed],
                      });
                    }
                    setNewAttributeInput('');
                  }}
                  className="inline-flex min-h-[42px] items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Add Attribute</span>
                </button>
              </div>
              {sectionErrors.attributes && (
                <p role="alert" className="mt-1 text-xs text-red-600">
                  {sectionErrors.attributes}
                </p>
              )}

              {messaging.voiceAndTone.attributes.length > 0 && (
                <ul className="mt-3 flex flex-wrap gap-2">
                  {messaging.voiceAndTone.attributes.map((attr) => (
                    <li
                      key={attr}
                      className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-800"
                    >
                      <span>{attr}</span>
                      <button
                        type="button"
                        aria-label={`Remove voice attribute ${attr}`}
                        onClick={() =>
                          updateVoiceAndTone({
                            attributes: messaging.voiceAndTone.attributes.filter(
                              (item) => item !== attr,
                            ),
                          })
                        }
                        className="text-slate-400 hover:text-slate-700"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Tone Guardrails Editor */}
            <div className="border-t border-slate-100 pt-5">
              <label
                htmlFor="tone-guardrail-input"
                className="block text-xs font-semibold text-slate-800"
              >
                Approved / Working Tone Guardrails *
              </label>
              <div className="mt-1.5 flex flex-wrap gap-2">
                <input
                  id="tone-guardrail-input"
                  type="text"
                  value={newGuardrailInput}
                  onChange={(e) => setNewGuardrailInput(e.target.value)}
                  placeholder="e.g., Avoid exaggerated claims or unverified medical statistics"
                  className="min-h-[42px] flex-1 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => {
                    const trimmed = newGuardrailInput.trim();
                    if (!trimmed) return;
                    if (!messaging.voiceAndTone.guardrails.includes(trimmed)) {
                      updateVoiceAndTone({
                        guardrails: [...messaging.voiceAndTone.guardrails, trimmed],
                      });
                    }
                    setNewGuardrailInput('');
                  }}
                  className="inline-flex min-h-[42px] items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Add Guardrail</span>
                </button>
              </div>
              {sectionErrors.guardrails && (
                <p role="alert" className="mt-1 text-xs text-red-600">
                  {sectionErrors.guardrails}
                </p>
              )}

              {messaging.voiceAndTone.guardrails.length > 0 && (
                <ul className="mt-3 divide-y divide-slate-100 rounded-lg border border-slate-200">
                  {messaging.voiceAndTone.guardrails.map((guardrail, idx) => (
                    <li
                      key={`${guardrail}-${idx}`}
                      className="flex items-center justify-between gap-3 px-3.5 py-2.5 text-sm text-slate-800"
                    >
                      <input
                        type="text"
                        aria-label={`Tone guardrail ${idx + 1}`}
                        value={guardrail}
                        onChange={(e) =>
                          updateVoiceAndTone({
                            guardrails: messaging.voiceAndTone.guardrails.map((item, i) =>
                              i === idx ? e.target.value : item,
                            ),
                          })
                        }
                        className="w-full bg-transparent text-sm text-slate-800 focus:outline-none"
                      />
                      <button
                        type="button"
                        aria-label={`Remove guardrail ${idx + 1}`}
                        onClick={() =>
                          updateVoiceAndTone({
                            guardrails: messaging.voiceAndTone.guardrails.filter(
                              (_item, i) => i !== idx,
                            ),
                          })
                        }
                        className="shrink-0 text-slate-400 hover:text-red-600"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </SectionEditorShell>
      )}

      {/* Step 04: Audience Angles */}
      {activeStep === 'audienceAngles' && (
        <SectionEditorShell
          stepNumber="04"
          title="Audience Angles"
          subtitle="Tailor key messaging statements for distinct customer segments you serve."
          approved={messaging.audienceAngles.approved}
          saving={saving}
          onPrevious={() => goToStep('voiceAndTone')}
          onSaveDraft={() => void handleSaveDraft()}
          onApprove={() => void handleApproveSection('audienceAngles')}
          approveLabel="Approve Audience Angles & Review"
        >
          <div className="space-y-5">
            {messaging.audienceAngles.aiSuggestedAngles.length > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-4">
                <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-900">
                    <Sparkles className="h-3.5 w-3.5 text-amber-600" />
                    <span>
                      AI-Suggested Audience Angles (
                      {messaging.audienceAngles.aiSuggestedAngles.length}){' '}
                      {messaging.audienceAngles.suggestionStatus === 'approved'
                        ? '— Adopted into draft'
                        : messaging.audienceAngles.suggestionStatus === 'rejected'
                          ? '— Dismissed'
                          : '— Unapproved Draft'}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        updateAudienceAngles({
                          angles: messaging.audienceAngles.aiSuggestedAngles.map(
                            (a, idx) => ({
                              id: createItemId(`angle-${idx + 1}`),
                              audience: a.audience,
                              message: a.message,
                            }),
                          ),
                          suggestionStatus: 'approved',
                        })
                      }
                      className="inline-flex min-h-[34px] items-center gap-1 rounded-md border border-amber-300 bg-white px-3 py-1 text-xs font-semibold text-amber-950 hover:bg-amber-100"
                    >
                      <Check className="h-3.5 w-3.5" />
                      <span>Use Suggested Angles</span>
                    </button>
                    {messaging.audienceAngles.suggestionStatus !== 'rejected' && (
                      <button
                        type="button"
                        onClick={() => updateAudienceAngles({ suggestionStatus: 'rejected' })}
                        className="inline-flex min-h-[34px] items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium text-amber-900 hover:bg-amber-100"
                      >
                        <X className="h-3.5 w-3.5" />
                        <span>Dismiss</span>
                      </button>
                    )}
                  </div>
                </div>

                <ul className="mt-3 divide-y divide-amber-200/70 text-xs text-slate-800">
                  {messaging.audienceAngles.aiSuggestedAngles.map((angle, idx) => (
                    <li key={angle.id || idx} className="py-2 first:pt-0 last:pb-0">
                      <p className="font-semibold text-slate-900">{angle.audience}</p>
                      <p className="mt-0.5 text-slate-700">{angle.message}</p>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex flex-col justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50/70 p-4 sm:flex-row sm:items-center">
              <div className="text-xs leading-relaxed text-slate-600">
                <strong className="font-semibold text-slate-800">
                  Working Audience Angles ({messaging.audienceAngles.angles.length})
                </strong>
                {' — '}Add at least 1 audience segment with a tailored messaging statement.
              </div>
              <button
                type="button"
                onClick={() =>
                  updateAudienceAngles({
                    angles: [
                      ...messaging.audienceAngles.angles,
                      { id: createItemId('angle'), audience: '', message: '' },
                    ],
                  })
                }
                className="inline-flex min-h-[40px] shrink-0 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 whitespace-nowrap"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Add Audience Angle</span>
              </button>
            </div>

            {sectionErrors.angles && (
              <p role="alert" className="text-xs font-medium text-red-600">
                {sectionErrors.angles}
              </p>
            )}

            {messaging.audienceAngles.angles.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-center">
                <p className="text-sm font-medium text-slate-800">
                  No audience angles defined yet
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Adopt AI suggestions above or add your first audience-specific messaging angle.
                </p>
                <button
                  type="button"
                  onClick={() =>
                    updateAudienceAngles({
                      angles: [{ id: createItemId('angle'), audience: '', message: '' }],
                    })
                  }
                  className="mt-4 inline-flex min-h-[40px] items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-medium text-white hover:bg-blue-700"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Add First Audience Angle</span>
                </button>
              </div>
            ) : (
              <div className="divide-y divide-slate-200 border-t border-b border-slate-200">
                {messaging.audienceAngles.angles.map((angle: AudienceAngleItem, idx) => (
                  <div key={angle.id} className="space-y-3 py-5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs font-semibold text-slate-500 tabular-nums">
                        ANGLE 0{idx + 1}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          updateAudienceAngles({
                            angles: messaging.audienceAngles.angles.filter(
                              (item) => item.id !== angle.id,
                            ),
                          })
                        }
                        aria-label={`Remove audience angle ${angle.audience || idx + 1}`}
                        className="inline-flex min-h-[32px] items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span>Remove</span>
                      </button>
                    </div>

                    <div>
                      <label
                        htmlFor={`angle-audience-${angle.id}`}
                        className="block text-xs font-semibold text-slate-800"
                      >
                        Target Audience Segment *
                      </label>
                      <input
                        id={`angle-audience-${angle.id}`}
                        type="text"
                        value={angle.audience}
                        onChange={(e) =>
                          updateAudienceAngles({
                            angles: messaging.audienceAngles.angles.map((item) =>
                              item.id === angle.id
                                ? { ...item, audience: e.target.value }
                                : item,
                            ),
                          })
                        }
                        placeholder="e.g., Busy professionals ages 30-55"
                        className={inputClass(false)}
                      />
                    </div>

                    <div>
                      <label
                        htmlFor={`angle-message-${angle.id}`}
                        className="block text-xs font-semibold text-slate-800"
                      >
                        Tailored Messaging Angle *
                      </label>
                      <textarea
                        id={`angle-message-${angle.id}`}
                        rows={2}
                        value={angle.message}
                        onChange={(e) =>
                          updateAudienceAngles({
                            angles: messaging.audienceAngles.angles.map((item) =>
                              item.id === angle.id
                                ? { ...item, message: e.target.value }
                                : item,
                            ),
                          })
                        }
                        placeholder="What specific promise or framing resonates most with this segment?"
                        className={inputClass(false)}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </SectionEditorShell>
      )}

      {/* Step 05: Consolidated Review & Completion */}
      {activeStep === 'review' && (
        <section
          aria-label="Consolidated Brand Messaging Review"
          className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6"
        >
          <div className="flex flex-col justify-between gap-3 border-b border-slate-100 pb-4 sm:flex-row sm:items-center">
            <div>
              <div className="flex items-center gap-2">
                <ClipboardCheck className="h-4 w-4 text-blue-600" strokeWidth={1.75} />
                <h3 className="text-base font-semibold text-slate-900">
                  05. Consolidated Brand Messaging Review
                </h3>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-slate-600">
                Verify all four messaging components for {brand.brandName} before marking Brand
                Messaging completed.
              </p>
            </div>

            {moduleStatus === 'completed' && (
              <span className="inline-flex shrink-0 items-center gap-1.5 text-xs font-semibold text-emerald-700 whitespace-nowrap">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>Messaging Completed</span>
              </span>
            )}
          </div>

          {!completionCheck.allowed && (
            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3.5 text-xs text-amber-950">
              Approve the remaining messaging components before completion:{' '}
              <span className="font-semibold">
                {completionCheck.incompleteSections
                  .map((key) => MESSAGING_SECTIONS.find((s) => s.key === key)?.title ?? key)
                  .join(', ')}
              </span>
              .
            </div>
          )}

          <div className="mt-4 divide-y divide-slate-100">
            {/* 01 Core Value Proposition */}
            <div className="py-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-semibold text-slate-900">
                    01. Core Value Proposition
                  </h4>
                  <span
                    className={`text-xs font-medium ${
                      messaging.coreValueProposition.approved
                        ? 'text-emerald-700'
                        : 'text-amber-700'
                    }`}
                  >
                    {messaging.coreValueProposition.approved ? 'Approved' : 'Needs approval'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => goToStep('coreValueProposition')}
                  className="inline-flex min-h-[36px] items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  <Edit3 className="h-3.5 w-3.5" />
                  <span>Edit</span>
                </button>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-slate-800">
                {messaging.coreValueProposition.statement.trim() || (
                  <span className="text-slate-400">
                    No core value proposition drafted yet.
                  </span>
                )}
              </p>
            </div>

            {/* 02 Messaging Pillars */}
            <div className="py-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-semibold text-slate-900">
                    02. Messaging Pillars
                  </h4>
                  <span
                    className={`text-xs font-medium ${
                      messaging.messagingPillars.approved
                        ? 'text-emerald-700'
                        : 'text-amber-700'
                    }`}
                  >
                    {messaging.messagingPillars.approved ? 'Approved' : 'Needs approval'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => goToStep('messagingPillars')}
                  className="inline-flex min-h-[36px] items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  <Edit3 className="h-3.5 w-3.5" />
                  <span>Edit</span>
                </button>
              </div>
              {messaging.messagingPillars.pillars.length === 0 ? (
                <p className="mt-2 text-sm text-slate-500">No messaging pillars added yet.</p>
              ) : (
                <ul className="mt-2.5 divide-y divide-slate-100 pl-1">
                  {messaging.messagingPillars.pillars.map((pillar) => (
                    <li key={pillar.id} className="py-2 text-xs first:pt-0 last:pb-0">
                      <p className="font-semibold text-slate-900">
                        {pillar.title || 'Untitled Pillar'}
                      </p>
                      <p className="mt-0.5 text-slate-600">{pillar.summary || '—'}</p>
                    </li>
                  ))}
                </ul>
              )}
              {completionCheck.validationIssues.messagingPillars?.pillars && (
                <p className="mt-2 text-xs text-red-600">
                  {completionCheck.validationIssues.messagingPillars.pillars}
                </p>
              )}
            </div>

            {/* 03 Voice & Tone */}
            <div className="py-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-semibold text-slate-900">03. Voice & Tone</h4>
                  <span
                    className={`text-xs font-medium ${
                      messaging.voiceAndTone.approved ? 'text-emerald-700' : 'text-amber-700'
                    }`}
                  >
                    {messaging.voiceAndTone.approved ? 'Approved' : 'Needs approval'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => goToStep('voiceAndTone')}
                  className="inline-flex min-h-[36px] items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  <Edit3 className="h-3.5 w-3.5" />
                  <span>Edit</span>
                </button>
              </div>
              <div className="mt-2 grid grid-cols-1 gap-3 text-xs sm:grid-cols-2">
                <div>
                  <p className="font-semibold text-slate-700">Voice Attributes</p>
                  <p className="mt-1 text-slate-800">
                    {messaging.voiceAndTone.attributes.length > 0
                      ? messaging.voiceAndTone.attributes.join(' · ')
                      : '—'}
                  </p>
                </div>
                <div>
                  <p className="font-semibold text-slate-700">Tone Guardrails</p>
                  {messaging.voiceAndTone.guardrails.length > 0 ? (
                    <ul className="mt-1 list-disc space-y-0.5 pl-4 text-slate-700">
                      {messaging.voiceAndTone.guardrails.map((item, idx) => (
                        <li key={idx}>{item}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-1 text-slate-400">—</p>
                  )}
                </div>
              </div>
              {(completionCheck.validationIssues.voiceAndTone?.attributes ||
                completionCheck.validationIssues.voiceAndTone?.guardrails) && (
                <p className="mt-2 text-xs text-red-600">
                  {completionCheck.validationIssues.voiceAndTone?.attributes ??
                    completionCheck.validationIssues.voiceAndTone?.guardrails}
                </p>
              )}
            </div>

            {/* 04 Audience Angles */}
            <div className="py-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-semibold text-slate-900">
                    04. Audience Angles
                  </h4>
                  <span
                    className={`text-xs font-medium ${
                      messaging.audienceAngles.approved ? 'text-emerald-700' : 'text-amber-700'
                    }`}
                  >
                    {messaging.audienceAngles.approved ? 'Approved' : 'Needs approval'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => goToStep('audienceAngles')}
                  className="inline-flex min-h-[36px] items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  <Edit3 className="h-3.5 w-3.5" />
                  <span>Edit</span>
                </button>
              </div>
              {messaging.audienceAngles.angles.length === 0 ? (
                <p className="mt-2 text-sm text-slate-500">No audience angles added yet.</p>
              ) : (
                <ul className="mt-2.5 divide-y divide-slate-100 pl-1">
                  {messaging.audienceAngles.angles.map((angle) => (
                    <li key={angle.id} className="py-2 text-xs first:pt-0 last:pb-0">
                      <p className="font-semibold text-slate-900">
                        {angle.audience || 'Untitled Audience'}
                      </p>
                      <p className="mt-0.5 text-slate-600">{angle.message || '—'}</p>
                    </li>
                  ))}
                </ul>
              )}
              {completionCheck.validationIssues.audienceAngles?.angles && (
                <p className="mt-2 text-xs text-red-600">
                  {completionCheck.validationIssues.audienceAngles.angles}
                </p>
              )}
            </div>
          </div>

          {/* Prompt Traceability Metadata */}
          {messaging.aiSynthesis.promptId && (
            <div className="mt-4 border-t border-slate-100 pt-4 text-xs text-slate-500">
              <span>
                AI Draft Provenance:{' '}
                <code className="font-mono text-slate-700">
                  {messaging.aiSynthesis.promptId}
                </code>{' '}
                v{messaging.aiSynthesis.promptVersion} · {messaging.aiSynthesis.model}
              </span>
            </div>
          )}

          {/* Review Footer Actions */}
          <div className="mt-6 flex flex-col justify-between gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={() => goToStep('audienceAngles')}
              className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Previous Section</span>
            </button>

            <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
              <button
                type="button"
                onClick={() => void handleSaveDraft()}
                disabled={saving}
                className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              >
                <Save className="h-4 w-4" />
                <span>Save Progress</span>
              </button>

              <button
                type="button"
                onClick={() => void handleCompleteMessaging()}
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
                    ? 'Save Updated Brand Messaging'
                    : 'Complete Brand Messaging'}
                </span>
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Regeneration Safeguard Confirmation Dialog */}
      <ConfirmDialog
        open={showRegenerateConfirm}
        title="Regenerate AI messaging suggestions?"
        description="Regenerating runs brand_messaging_framework using your approved Brand Foundation. Previously approved messaging components stay protected and will not be overwritten."
        confirmLabel="Generate New Suggestions"
        cancelLabel="Cancel"
        variant="primary"
        onConfirm={() => {
          setShowRegenerateConfirm(false);
          void runAiGeneration();
        }}
        onCancel={() => setShowRegenerateConfirm(false)}
      />
    </div>
  );
}

interface SectionEditorShellProps {
  stepNumber: string;
  title: string;
  subtitle: string;
  approved: boolean;
  saving: boolean;
  approveLabel: string;
  onPrevious?: () => void;
  onSaveDraft: () => void;
  onApprove: () => void;
  children: React.ReactNode;
}

function SectionEditorShell({
  stepNumber,
  title,
  subtitle,
  approved,
  saving,
  approveLabel,
  onPrevious,
  onSaveDraft,
  onApprove,
  children,
}: SectionEditorShellProps) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
      <div className="flex flex-col justify-between gap-2 border-b border-slate-100 pb-4 sm:flex-row sm:items-center">
        <div>
          <h3 className="text-base font-semibold text-slate-900">
            {stepNumber}. {title}
          </h3>
          <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>
        </div>

        <span
          className={`inline-flex shrink-0 items-center gap-1.5 text-xs font-semibold whitespace-nowrap ${
            approved ? 'text-emerald-700' : 'text-slate-500'
          }`}
        >
          {approved ? (
            <>
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <span>Approved Messaging</span>
            </>
          ) : (
            <span>Awaiting Approval</span>
          )}
        </span>
      </div>

      <div className="mt-5">{children}</div>

      <div className="mt-6 flex flex-col justify-between gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:items-center">
        <div>
          {onPrevious && (
            <button
              type="button"
              onClick={onPrevious}
              disabled={saving}
              className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 sm:w-auto"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Previous Section</span>
            </button>
          )}
        </div>

        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={onSaveDraft}
            disabled={saving}
            className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            <span>Save Progress</span>
          </button>

          <button
            type="button"
            onClick={onApprove}
            disabled={saving}
            className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-60"
          >
            <Check className="h-4 w-4" />
            <span>{approveLabel}</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </section>
  );
}
