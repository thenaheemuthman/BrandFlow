import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  ClipboardCheck,
  Edit3,
  Loader2,
  Plus,
  RefreshCw,
  Save,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { api } from '../../services/api';
import { executeBrandPrompt } from '../../services/promptExecution';
import type { Brand, BrandStrategyModule, ModuleStatus } from '../../types/brand';
import { ConfirmDialog } from '../common/ConfirmDialog';
import {
  FOUNDATION_SECTIONS,
  applyAiSynthesisResult,
  buildFoundationPromptVariables,
  buildFoundationUpsertPayload,
  buildProposedStatementDraft,
  canCompleteBrandFoundation,
  checkSynthesisReadiness,
  computeFoundationProgress,
  createInitialBrandFoundationState,
  hasAnyApprovedSection,
  hydrateBrandFoundationState,
  validateFoundationSection,
  type BrandFoundationState,
  type CoreValueItem,
  type FoundationSectionKey,
  type FoundationStepKey,
  type SectionValidationErrors,
} from '../../utils/brandFoundationLogic';

interface BrandFoundationViewProps {
  brand: Brand;
  onModuleSaved: (module: BrandStrategyModule) => void | Promise<void>;
  onToast: (type: 'success' | 'error', message: string) => void;
  onNavigateToBrandSettings: () => void;
}

function createCoreValueId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `val-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

const STEP_SEQUENCE: readonly FoundationStepKey[] = [
  'purpose',
  'mission',
  'vision',
  'coreValues',
  'positioning',
  'review',
];

export function BrandFoundationView({
  brand,
  onModuleSaved,
  onToast,
  onNavigateToBrandSettings,
}: BrandFoundationViewProps) {
  const [foundation, setFoundation] = useState<BrandFoundationState>(() =>
    createInitialBrandFoundationState(brand),
  );
  const [moduleStatus, setModuleStatus] = useState<ModuleStatus>(
    brand.moduleStatuses.brandFoundation ?? 'not_started',
  );
  const [activeStep, setActiveStep] = useState<FoundationStepKey>('purpose');
  const [loadingModule, setLoadingModule] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sectionErrors, setSectionErrors] = useState<SectionValidationErrors>({});
  const [saving, setSaving] = useState<boolean>(false);
  const [generatingAi, setGeneratingAi] = useState<boolean>(false);
  const [missingInfoNotice, setMissingInfoNotice] = useState<{
    message: string;
    missingFields: string[];
  } | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [showRegenerateConfirm, setShowRegenerateConfirm] = useState<boolean>(false);
  const [newAttributeInput, setNewAttributeInput] = useState<string>('');

  // Load persisted brandFoundation module strictly for this brandId
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
        const existing = modules.find((m) => m.moduleKey === 'brandFoundation');
        const hydrated = hydrateBrandFoundationState(brand, existing);
        setFoundation(hydrated);
        setModuleStatus(existing?.status ?? brand.moduleStatuses.brandFoundation ?? 'not_started');

        if (existing?.status === 'completed') {
          setActiveStep('review');
        } else {
          const firstUnapproved = FOUNDATION_SECTIONS.find((s) => !hydrated[s.key].approved);
          setActiveStep(firstUnapproved ? firstUnapproved.key : 'review');
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setFoundation(createInitialBrandFoundationState(brand));
        setLoadError(
          err instanceof Error ? err.message : 'Unable to load Brand Foundation data.',
        );
      })
      .finally(() => {
        if (!cancelled) setLoadingModule(false);
      });

    return () => {
      cancelled = true;
    };
  }, [brand.id]);

  const progress = useMemo(() => computeFoundationProgress(foundation), [foundation]);
  const completionCheck = useMemo(
    () => canCompleteBrandFoundation(foundation),
    [foundation],
  );
  const readiness = useMemo(() => checkSynthesisReadiness(brand), [brand]);

  const persistState = async (
    nextState: BrandFoundationState,
    requestedStatus: ModuleStatus,
    successMessage?: string,
  ): Promise<boolean> => {
    setSaving(true);
    try {
      const payload = buildFoundationUpsertPayload(nextState, requestedStatus);
      const { module } = await api.upsertStrategyModule(
        brand.id,
        'brandFoundation',
        payload,
      );
      setFoundation(hydrateBrandFoundationState(brand, module));
      setModuleStatus(module.status);
      await onModuleSaved(module);
      if (successMessage) {
        onToast('success', successMessage);
      }
      return true;
    } catch (err) {
      onToast(
        'error',
        err instanceof Error ? err.message : 'Failed to save Brand Foundation.',
      );
      return false;
    } finally {
      setSaving(false);
    }
  };

  const runAiSynthesis = async () => {
    setAiError(null);
    setMissingInfoNotice(null);

    if (!readiness.ready) {
      setMissingInfoNotice({
        message:
          'Add the missing required brand profile fields before generating foundation suggestions.',
        missingFields: readiness.missingFields,
      });
      return;
    }

    setGeneratingAi(true);
    try {
      const result = await executeBrandPrompt({
        brandId: brand.id,
        promptId: 'brand_foundation_synthesis',
        expectedOwnerUserId: brand.userId,
        variables: buildFoundationPromptVariables(foundation),
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

      const updated = applyAiSynthesisResult(foundation, result, {
        overwriteApproved: false,
      });
      setFoundation(updated);

      const nextStatus: ModuleStatus =
        moduleStatus === 'completed' ? 'completed' : 'in_progress';
      await persistState(
        updated,
        nextStatus,
        'Generated AI suggestions for review. Approved sections were preserved.',
      );
    } catch (err) {
      setAiError(
        err instanceof Error ? err.message : 'Unable to generate AI suggestions.',
      );
    } finally {
      setGeneratingAi(false);
    }
  };

  const handleTriggerSynthesis = () => {
    if (generatingAi || saving) return;
    if (hasAnyApprovedSection(foundation) || foundation.aiSynthesis.generatedAt) {
      setShowRegenerateConfirm(true);
      return;
    }
    void runAiSynthesis();
  };

  const goToStep = (step: FoundationStepKey) => {
    setSectionErrors({});
    setActiveStep(step);
  };

  const handleSaveDraft = async () => {
    const targetStatus: ModuleStatus =
      moduleStatus === 'completed' && completionCheck.allowed
        ? 'completed'
        : 'in_progress';
    await persistState(foundation, targetStatus, 'Saved Brand Foundation progress.');
  };

  const handleApproveSection = async (sectionKey: FoundationSectionKey) => {
    const errors = validateFoundationSection(sectionKey, foundation);
    if (Object.keys(errors).length > 0) {
      setSectionErrors(errors);
      return;
    }
    setSectionErrors({});

    const nowIso = new Date().toISOString();
    const updated: BrandFoundationState = {
      ...foundation,
      [sectionKey]: {
        ...foundation[sectionKey],
        approved: true,
        approvedAt: nowIso,
      },
    };

    setFoundation(updated);
    const nextCheck = canCompleteBrandFoundation(updated);
    const persistStatus: ModuleStatus =
      moduleStatus === 'completed' && nextCheck.allowed ? 'completed' : 'in_progress';

    const saved = await persistState(
      updated,
      persistStatus,
      `${FOUNDATION_SECTIONS.find((s) => s.key === sectionKey)?.title ?? 'Section'} approved and saved.`,
    );
    if (saved) {
      const idx = STEP_SEQUENCE.indexOf(sectionKey);
      if (idx >= 0 && idx + 1 < STEP_SEQUENCE.length) {
        setActiveStep(STEP_SEQUENCE[idx + 1]);
      }
    }
  };

  const handleCompleteFoundation = async () => {
    if (!completionCheck.allowed) {
      onToast(
        'error',
        'Approve all five Brand Foundation sections before completing the module.',
      );
      return;
    }
    await persistState(
      foundation,
      'completed',
      'Brand Foundation approved and marked completed.',
    );
  };

  // Helper updaters that cleanly invalidate a section's approval (and module completion) when edited
  const updatePurpose = (patch: Partial<BrandFoundationState['purpose']>) => {
    setSectionErrors({});
    setFoundation((prev) => ({
      ...prev,
      completedAt: null,
      approvedSummary: null,
      purpose: {
        ...prev.purpose,
        ...patch,
        approved: patch.approved !== undefined ? patch.approved : false,
        approvedAt: patch.approved !== undefined ? patch.approvedAt ?? null : null,
      },
    }));
    if (moduleStatus === 'completed') setModuleStatus('in_progress');
  };

  const updateMission = (patch: Partial<BrandFoundationState['mission']>) => {
    setSectionErrors({});
    setFoundation((prev) => ({
      ...prev,
      completedAt: null,
      approvedSummary: null,
      mission: {
        ...prev.mission,
        ...patch,
        approved: patch.approved !== undefined ? patch.approved : false,
        approvedAt: patch.approved !== undefined ? patch.approvedAt ?? null : null,
      },
    }));
    if (moduleStatus === 'completed') setModuleStatus('in_progress');
  };

  const updateVision = (patch: Partial<BrandFoundationState['vision']>) => {
    setSectionErrors({});
    setFoundation((prev) => ({
      ...prev,
      completedAt: null,
      approvedSummary: null,
      vision: {
        ...prev.vision,
        ...patch,
        approved: patch.approved !== undefined ? patch.approved : false,
        approvedAt: patch.approved !== undefined ? patch.approvedAt ?? null : null,
      },
    }));
    if (moduleStatus === 'completed') setModuleStatus('in_progress');
  };

  const updateCoreValues = (values: CoreValueItem[]) => {
    setSectionErrors({});
    setFoundation((prev) => ({
      ...prev,
      completedAt: null,
      approvedSummary: null,
      coreValues: {
        values,
        approved: false,
        approvedAt: null,
      },
    }));
    if (moduleStatus === 'completed') setModuleStatus('in_progress');
  };

  const updatePositioning = (patch: Partial<BrandFoundationState['positioning']>) => {
    setSectionErrors({});
    setFoundation((prev) => ({
      ...prev,
      completedAt: null,
      approvedSummary: null,
      positioning: {
        ...prev.positioning,
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
      {/* Module Intro, Progress & AI Synthesis Card */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
        <div className="flex flex-col justify-between gap-4 border-b border-slate-100 pb-5 sm:flex-row sm:items-start">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span>Phase 2A Strategy Module</span>
              <span aria-hidden="true">·</span>
              <span
                data-testid="foundation-module-status"
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
              Brand Foundation
            </h2>
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-600">
              Capture, refine, and approve the strategic bedrock for{' '}
              <strong className="font-semibold text-slate-800">{brand.brandName}</strong>.
              Verified workspace facts are separated from AI-generated drafts until you explicitly approve each section.
            </p>
          </div>

          <button
            type="button"
            onClick={handleTriggerSynthesis}
            disabled={generatingAi || saving}
            className="inline-flex min-h-[44px] shrink-0 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60 whitespace-nowrap"
          >
            {generatingAi ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : foundation.aiSynthesis.generatedAt ? (
              <RefreshCw className="h-4 w-4" strokeWidth={1.75} />
            ) : (
              <Sparkles className="h-4 w-4" strokeWidth={1.75} />
            )}
            <span>
              {generatingAi
                ? 'Generating Suggestions...'
                : foundation.aiSynthesis.generatedAt
                  ? 'Regenerate AI Suggestions'
                  : 'Generate AI Draft'}
            </span>
          </button>
        </div>

        {/* Progress Bar */}
        <div className="mt-4">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="font-medium text-slate-700">Foundation Progress</span>
            <span
              data-testid="foundation-progress-label"
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
          aria-label="Brand Foundation Sections"
          className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-3"
        >
          {FOUNDATION_SECTIONS.map((sec) => {
            const isCurrent = activeStep === sec.key;
            const status = progress.sectionStatuses[sec.key];
            return (
              <button
                key={sec.key}
                type="button"
                onClick={() => goToStep(sec.key)}
                aria-current={isCurrent ? 'step' : undefined}
                className={`flex min-h-[44px] flex-col justify-between rounded-lg border px-3 py-2 text-left transition-colors ${
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
                <span className="mt-1 truncate text-xs font-semibold">
                  {sec.title}
                </span>
              </button>
            );
          })}

          <button
            type="button"
            onClick={() => goToStep('review')}
            aria-current={activeStep === 'review' ? 'step' : undefined}
            className={`flex min-h-[44px] flex-col justify-between rounded-lg border px-3 py-2 text-left transition-colors ${
              activeStep === 'review'
                ? 'border-blue-600 bg-blue-50/70 text-blue-900'
                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            <div className="flex items-center justify-between gap-1.5">
              <span className="font-mono text-[11px] font-medium text-slate-400 tabular-nums">
                06
              </span>
              {moduleStatus === 'completed' && (
                <CheckCircle2
                  className="h-3.5 w-3.5 shrink-0 text-emerald-600"
                  aria-label="Completed"
                />
              )}
            </div>
            <span className="mt-1 truncate text-xs font-semibold">Review & Complete</span>
          </button>
        </nav>

        {/* Grounded AI Fact vs Suggestion Metadata Strip */}
        {foundation.aiSynthesis.generatedAt && (
          <div className="mt-5 grid grid-cols-1 gap-4 border-t border-slate-100 pt-4 text-xs sm:grid-cols-2">
            <div>
              <p className="font-semibold text-slate-800">
                Verified Facts Used by AI ({foundation.aiSynthesis.suppliedFactsUsed.length})
              </p>
              {foundation.aiSynthesis.suppliedFactsUsed.length > 0 ? (
                <ul className="mt-1.5 list-disc space-y-1 pl-4 text-slate-600">
                  {foundation.aiSynthesis.suppliedFactsUsed.slice(0, 4).map((fact, idx) => (
                    <li key={idx}>{fact}</li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1 text-slate-500">Workspace profile facts supplied.</p>
              )}
            </div>
            <div>
              <p className="font-semibold text-slate-800">
                Missing Context Noted by AI ({foundation.aiSynthesis.missingContextNotes.length})
              </p>
              {foundation.aiSynthesis.missingContextNotes.length > 0 ? (
                <ul className="mt-1.5 list-disc space-y-1 pl-4 text-slate-600">
                  {foundation.aiSynthesis.missingContextNotes.slice(0, 4).map((note, idx) => (
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

      {/* Alerts: Load error / Missing Information / AI validation error */}
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
          data-testid="foundation-missing-info"
          className="flex flex-col justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950 sm:flex-row sm:items-center"
        >
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <div>
              <p className="font-semibold">Additional brand context required before AI synthesis</p>
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
          data-testid="foundation-ai-error"
          className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900"
        >
          {aiError}
        </div>
      )}

      {/* Active Section Card */}
      {activeStep === 'purpose' && (
        <SectionEditorShell
          stepNumber="01"
          title="Brand Purpose"
          subtitle="Establish why the brand exists beyond financial return."
          approved={foundation.purpose.approved}
          approvedAt={foundation.purpose.approvedAt}
          saving={saving}
          onPrevious={undefined}
          onSaveDraft={() => void handleSaveDraft()}
          onApprove={() => void handleApproveSection('purpose')}
          approveLabel="Approve Purpose & Continue"
        >
          <div className="grid grid-cols-1 gap-5">
            <div>
              <label
                htmlFor="purpose-problem"
                className="block text-xs font-semibold text-slate-800"
              >
                Problem the brand exists to address *
              </label>
              <textarea
                id="purpose-problem"
                rows={2}
                value={foundation.purpose.problemAddressed}
                onChange={(e) => updatePurpose({ problemAddressed: e.target.value })}
                placeholder="What specific gap or frustration does your brand step in to fix?"
                className={inputClass(Boolean(sectionErrors.problemAddressed))}
              />
              {sectionErrors.problemAddressed && (
                <p className="mt-1 text-xs text-red-600">{sectionErrors.problemAddressed}</p>
              )}
            </div>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="purpose-people"
                  className="block text-xs font-semibold text-slate-800"
                >
                  People it exists to serve *
                </label>
                <input
                  id="purpose-people"
                  type="text"
                  value={foundation.purpose.peopleServed}
                  onChange={(e) => updatePurpose({ peopleServed: e.target.value })}
                  placeholder="Who benefits most from your existence?"
                  className={inputClass(Boolean(sectionErrors.peopleServed))}
                />
                {sectionErrors.peopleServed && (
                  <p className="mt-1 text-xs text-red-600">{sectionErrors.peopleServed}</p>
                )}
              </div>

              <div>
                <label
                  htmlFor="purpose-change"
                  className="block text-xs font-semibold text-slate-800"
                >
                  Positive change it wants to create *
                </label>
                <input
                  id="purpose-change"
                  type="text"
                  value={foundation.purpose.positiveChange}
                  onChange={(e) => updatePurpose({ positiveChange: e.target.value })}
                  placeholder="What measurable shift do you want to see in their world?"
                  className={inputClass(Boolean(sectionErrors.positiveChange))}
                />
                {sectionErrors.positiveChange && (
                  <p className="mt-1 text-xs text-red-600">{sectionErrors.positiveChange}</p>
                )}
              </div>
            </div>

            <AiSuggestionBox
              suggestion={foundation.purpose.aiSuggestedStatement}
              status={foundation.purpose.suggestionStatus}
              onUse={() =>
                updatePurpose({
                  statement: foundation.purpose.aiSuggestedStatement ?? '',
                  suggestionStatus: 'approved',
                })
              }
              onReject={() => updatePurpose({ suggestionStatus: 'rejected' })}
            />

            <div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label
                  htmlFor="purpose-statement"
                  className="block text-xs font-semibold text-slate-800"
                >
                  Approved / Working Brand Purpose Statement *
                </label>
                <button
                  type="button"
                  onClick={() => {
                    const draft = buildProposedStatementDraft(
                      'purpose',
                      foundation,
                      brand.brandName,
                    );
                    if (draft) {
                      updatePurpose({ statement: draft });
                    } else {
                      setSectionErrors(validateFoundationSection('purpose', foundation));
                    }
                  }}
                  className="text-xs font-medium text-blue-600 hover:text-blue-700"
                >
                  Build Draft from My Inputs
                </button>
              </div>
              <textarea
                id="purpose-statement"
                rows={3}
                value={foundation.purpose.statement}
                onChange={(e) => updatePurpose({ statement: e.target.value })}
                placeholder="Write or refine your brand purpose statement here before approving."
                className={inputClass(Boolean(sectionErrors.statement))}
              />
              {sectionErrors.statement && (
                <p className="mt-1 text-xs text-red-600">{sectionErrors.statement}</p>
              )}
            </div>
          </div>
        </SectionEditorShell>
      )}

      {activeStep === 'mission' && (
        <SectionEditorShell
          stepNumber="02"
          title="Mission Statement"
          subtitle="Define what the business does, who it serves, how it delivers, and the value created."
          approved={foundation.mission.approved}
          approvedAt={foundation.mission.approvedAt}
          saving={saving}
          onPrevious={() => goToStep('purpose')}
          onSaveDraft={() => void handleSaveDraft()}
          onApprove={() => void handleApproveSection('mission')}
          approveLabel="Approve Mission & Continue"
        >
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div>
              <label
                htmlFor="mission-what"
                className="block text-xs font-semibold text-slate-800"
              >
                What the business does *
              </label>
              <textarea
                id="mission-what"
                rows={2}
                value={foundation.mission.whatBusinessDoes}
                onChange={(e) => updateMission({ whatBusinessDoes: e.target.value })}
                className={inputClass(Boolean(sectionErrors.whatBusinessDoes))}
              />
              {sectionErrors.whatBusinessDoes && (
                <p className="mt-1 text-xs text-red-600">{sectionErrors.whatBusinessDoes}</p>
              )}
            </div>

            <div>
              <label
                htmlFor="mission-who"
                className="block text-xs font-semibold text-slate-800"
              >
                Who it serves *
              </label>
              <textarea
                id="mission-who"
                rows={2}
                value={foundation.mission.whoItServes}
                onChange={(e) => updateMission({ whoItServes: e.target.value })}
                className={inputClass(Boolean(sectionErrors.whoItServes))}
              />
              {sectionErrors.whoItServes && (
                <p className="mt-1 text-xs text-red-600">{sectionErrors.whoItServes}</p>
              )}
            </div>

            <div>
              <label
                htmlFor="mission-how"
                className="block text-xs font-semibold text-slate-800"
              >
                How it serves them *
              </label>
              <textarea
                id="mission-how"
                rows={2}
                value={foundation.mission.howItServes}
                onChange={(e) => updateMission({ howItServes: e.target.value })}
                className={inputClass(Boolean(sectionErrors.howItServes))}
              />
              {sectionErrors.howItServes && (
                <p className="mt-1 text-xs text-red-600">{sectionErrors.howItServes}</p>
              )}
            </div>

            <div>
              <label
                htmlFor="mission-value"
                className="block text-xs font-semibold text-slate-800"
              >
                The value it delivers *
              </label>
              <textarea
                id="mission-value"
                rows={2}
                value={foundation.mission.valueDelivered}
                onChange={(e) => updateMission({ valueDelivered: e.target.value })}
                placeholder="Concrete outcome or benefit experienced by customers"
                className={inputClass(Boolean(sectionErrors.valueDelivered))}
              />
              {sectionErrors.valueDelivered && (
                <p className="mt-1 text-xs text-red-600">{sectionErrors.valueDelivered}</p>
              )}
            </div>

            <div className="sm:col-span-2">
              <AiSuggestionBox
                suggestion={foundation.mission.aiSuggestedStatement}
                status={foundation.mission.suggestionStatus}
                onUse={() =>
                  updateMission({
                    statement: foundation.mission.aiSuggestedStatement ?? '',
                    suggestionStatus: 'approved',
                  })
                }
                onReject={() => updateMission({ suggestionStatus: 'rejected' })}
              />
            </div>

            <div className="sm:col-span-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label
                  htmlFor="mission-statement"
                  className="block text-xs font-semibold text-slate-800"
                >
                  Approved / Working Mission Statement *
                </label>
                <button
                  type="button"
                  onClick={() => {
                    const draft = buildProposedStatementDraft(
                      'mission',
                      foundation,
                      brand.brandName,
                    );
                    if (draft) {
                      updateMission({ statement: draft });
                    } else {
                      setSectionErrors(validateFoundationSection('mission', foundation));
                    }
                  }}
                  className="text-xs font-medium text-blue-600 hover:text-blue-700"
                >
                  Build Draft from My Inputs
                </button>
              </div>
              <textarea
                id="mission-statement"
                rows={3}
                value={foundation.mission.statement}
                onChange={(e) => updateMission({ statement: e.target.value })}
                placeholder="Write or refine your mission statement before approving."
                className={inputClass(Boolean(sectionErrors.statement))}
              />
              {sectionErrors.statement && (
                <p className="mt-1 text-xs text-red-600">{sectionErrors.statement}</p>
              )}
            </div>
          </div>
        </SectionEditorShell>
      )}

      {activeStep === 'vision' && (
        <SectionEditorShell
          stepNumber="03"
          title="Vision Statement"
          subtitle="Articulate the future the brand wants to build and its long-term impact."
          approved={foundation.vision.approved}
          approvedAt={foundation.vision.approvedAt}
          saving={saving}
          onPrevious={() => goToStep('mission')}
          onSaveDraft={() => void handleSaveDraft()}
          onApprove={() => void handleApproveSection('vision')}
          approveLabel="Approve Vision & Continue"
        >
          <div className="grid grid-cols-1 gap-5">
            <div>
              <label
                htmlFor="vision-future"
                className="block text-xs font-semibold text-slate-800"
              >
                The future the brand wants to create *
              </label>
              <textarea
                id="vision-future"
                rows={2}
                value={foundation.vision.futureCreated}
                onChange={(e) => updateVision({ futureCreated: e.target.value })}
                placeholder="What does the market or customer reality look like in 5-10 years?"
                className={inputClass(Boolean(sectionErrors.futureCreated))}
              />
              {sectionErrors.futureCreated && (
                <p className="mt-1 text-xs text-red-600">{sectionErrors.futureCreated}</p>
              )}
            </div>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="vision-ambition"
                  className="block text-xs font-semibold text-slate-800"
                >
                  Long-term ambition *
                </label>
                <textarea
                  id="vision-ambition"
                  rows={2}
                  value={foundation.vision.longTermAmbition}
                  onChange={(e) => updateVision({ longTermAmbition: e.target.value })}
                  className={inputClass(Boolean(sectionErrors.longTermAmbition))}
                />
                {sectionErrors.longTermAmbition && (
                  <p className="mt-1 text-xs text-red-600">{sectionErrors.longTermAmbition}</p>
                )}
              </div>

              <div>
                <label
                  htmlFor="vision-impact"
                  className="block text-xs font-semibold text-slate-800"
                >
                  Impact it hopes to achieve *
                </label>
                <textarea
                  id="vision-impact"
                  rows={2}
                  value={foundation.vision.impactAchieved}
                  onChange={(e) => updateVision({ impactAchieved: e.target.value })}
                  placeholder="Who changes and how as a result of this work?"
                  className={inputClass(Boolean(sectionErrors.impactAchieved))}
                />
                {sectionErrors.impactAchieved && (
                  <p className="mt-1 text-xs text-red-600">{sectionErrors.impactAchieved}</p>
                )}
              </div>
            </div>

            <AiSuggestionBox
              suggestion={foundation.vision.aiSuggestedStatement}
              status={foundation.vision.suggestionStatus}
              onUse={() =>
                updateVision({
                  statement: foundation.vision.aiSuggestedStatement ?? '',
                  suggestionStatus: 'approved',
                })
              }
              onReject={() => updateVision({ suggestionStatus: 'rejected' })}
            />

            <div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label
                  htmlFor="vision-statement"
                  className="block text-xs font-semibold text-slate-800"
                >
                  Approved / Working Vision Statement *
                </label>
                <button
                  type="button"
                  onClick={() => {
                    const draft = buildProposedStatementDraft(
                      'vision',
                      foundation,
                      brand.brandName,
                    );
                    if (draft) {
                      updateVision({ statement: draft });
                    } else {
                      setSectionErrors(validateFoundationSection('vision', foundation));
                    }
                  }}
                  className="text-xs font-medium text-blue-600 hover:text-blue-700"
                >
                  Build Draft from My Inputs
                </button>
              </div>
              <textarea
                id="vision-statement"
                rows={3}
                value={foundation.vision.statement}
                onChange={(e) => updateVision({ statement: e.target.value })}
                placeholder="Write or refine your vision statement before approving."
                className={inputClass(Boolean(sectionErrors.statement))}
              />
              {sectionErrors.statement && (
                <p className="mt-1 text-xs text-red-600">{sectionErrors.statement}</p>
              )}
            </div>
          </div>
        </SectionEditorShell>
      )}

      {activeStep === 'coreValues' && (
        <SectionEditorShell
          stepNumber="04"
          title="Core Values"
          subtitle="Define the guiding principles, observable behaviors, and rationale behind how your brand operates."
          approved={foundation.coreValues.approved}
          approvedAt={foundation.coreValues.approvedAt}
          saving={saving}
          onPrevious={() => goToStep('vision')}
          onSaveDraft={() => void handleSaveDraft()}
          onApprove={() => void handleApproveSection('coreValues')}
          approveLabel="Approve Core Values & Continue"
        >
          <div className="space-y-4">
            <div className="flex flex-col justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50/70 p-4 sm:flex-row sm:items-center">
              <div className="text-xs leading-relaxed text-slate-600">
                <strong className="font-semibold text-slate-800">Manual Core Values Builder</strong>
                {' — '}Add each core value, describe concrete behaviors that prove it in practice, and explain why it matters.
              </div>
              <button
                type="button"
                onClick={() =>
                  updateCoreValues([
                    ...foundation.coreValues.values,
                    {
                      id: createCoreValueId(),
                      name: '',
                      behaviors: '',
                      whyItMatters: '',
                    },
                  ])
                }
                className="inline-flex min-h-[40px] shrink-0 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 whitespace-nowrap"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Add Core Value</span>
              </button>
            </div>

            {sectionErrors.values && (
              <p role="alert" className="text-xs font-medium text-red-600">
                {sectionErrors.values}
              </p>
            )}

            {foundation.coreValues.values.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-center">
                <p className="text-sm font-medium text-slate-800">No core values added yet</p>
                <p className="mt-1 text-xs text-slate-500">
                  Add 1 to 5 foundational values with specific behaviors and why each matters to your brand.
                </p>
                <button
                  type="button"
                  onClick={() =>
                    updateCoreValues([
                      {
                        id: createCoreValueId(),
                        name: '',
                        behaviors: '',
                        whyItMatters: '',
                      },
                    ])
                  }
                  className="mt-4 inline-flex min-h-[40px] items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-medium text-white hover:bg-blue-700"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Add First Core Value</span>
                </button>
              </div>
            ) : (
              <div className="divide-y divide-slate-200 border-t border-b border-slate-200">
                {foundation.coreValues.values.map((item, idx) => (
                  <div key={item.id} className="space-y-3 py-5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs font-semibold text-slate-500 tabular-nums">
                        VALUE 0{idx + 1}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          updateCoreValues(
                            foundation.coreValues.values.filter((v) => v.id !== item.id),
                          )
                        }
                        aria-label={`Remove core value ${item.name || idx + 1}`}
                        className="inline-flex min-h-[32px] items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span>Remove</span>
                      </button>
                    </div>

                    <div className="grid grid-cols-1 gap-4">
                      <div>
                        <label
                          htmlFor={`value-name-${item.id}`}
                          className="block text-xs font-semibold text-slate-800"
                        >
                          Core Value Name *
                        </label>
                        <input
                          id={`value-name-${item.id}`}
                          type="text"
                          value={item.name}
                          onChange={(e) =>
                            updateCoreValues(
                              foundation.coreValues.values.map((v) =>
                                v.id === item.id ? { ...v, name: e.target.value } : v,
                              ),
                            )
                          }
                          placeholder="e.g., Evidence Over Hype"
                          className={inputClass(false)}
                        />
                      </div>

                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div>
                          <label
                            htmlFor={`value-behaviors-${item.id}`}
                            className="block text-xs font-semibold text-slate-800"
                          >
                            Behaviors That Demonstrate It *
                          </label>
                          <textarea
                            id={`value-behaviors-${item.id}`}
                            rows={2}
                            value={item.behaviors}
                            onChange={(e) =>
                              updateCoreValues(
                                foundation.coreValues.values.map((v) =>
                                  v.id === item.id ? { ...v, behaviors: e.target.value } : v,
                                ),
                              )
                            }
                            placeholder="Observable actions customers and team members see every week"
                            className={inputClass(false)}
                          />
                        </div>

                        <div>
                          <label
                            htmlFor={`value-why-${item.id}`}
                            className="block text-xs font-semibold text-slate-800"
                          >
                            Why It Matters *
                          </label>
                          <textarea
                            id={`value-why-${item.id}`}
                            rows={2}
                            value={item.whyItMatters}
                            onChange={(e) =>
                              updateCoreValues(
                                foundation.coreValues.values.map((v) =>
                                  v.id === item.id ? { ...v, whyItMatters: e.target.value } : v,
                                ),
                              )
                            }
                            placeholder="Strategic impact on customer trust and decision-making"
                            className={inputClass(false)}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </SectionEditorShell>
      )}

      {activeStep === 'positioning' && (
        <SectionEditorShell
          stepNumber="05"
          title="Brand Positioning"
          subtitle="Define who you win with, the problem you solve, and why alternatives fall short."
          approved={foundation.positioning.approved}
          approvedAt={foundation.positioning.approvedAt}
          saving={saving}
          onPrevious={() => goToStep('coreValues')}
          onSaveDraft={() => void handleSaveDraft()}
          onApprove={() => void handleApproveSection('positioning')}
          approveLabel="Approve Positioning & Review"
        >
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div>
              <label
                htmlFor="pos-target-market"
                className="block text-xs font-semibold text-slate-800"
              >
                Target Market *
              </label>
              <input
                id="pos-target-market"
                type="text"
                value={foundation.positioning.targetMarket}
                onChange={(e) => updatePositioning({ targetMarket: e.target.value })}
                className={inputClass(Boolean(sectionErrors.targetMarket))}
              />
              {sectionErrors.targetMarket && (
                <p className="mt-1 text-xs text-red-600">{sectionErrors.targetMarket}</p>
              )}
            </div>

            <div>
              <label
                htmlFor="pos-primary-customer"
                className="block text-xs font-semibold text-slate-800"
              >
                Primary Customer *
              </label>
              <input
                id="pos-primary-customer"
                type="text"
                value={foundation.positioning.primaryCustomer}
                onChange={(e) => updatePositioning({ primaryCustomer: e.target.value })}
                placeholder="Specific buyer role or customer segment"
                className={inputClass(Boolean(sectionErrors.primaryCustomer))}
              />
              {sectionErrors.primaryCustomer && (
                <p className="mt-1 text-xs text-red-600">{sectionErrors.primaryCustomer}</p>
              )}
            </div>

            <div>
              <label
                htmlFor="pos-customer-problem"
                className="block text-xs font-semibold text-slate-800"
              >
                Customer Problem *
              </label>
              <textarea
                id="pos-customer-problem"
                rows={2}
                value={foundation.positioning.customerProblem}
                onChange={(e) => updatePositioning({ customerProblem: e.target.value })}
                className={inputClass(Boolean(sectionErrors.customerProblem))}
              />
              {sectionErrors.customerProblem && (
                <p className="mt-1 text-xs text-red-600">{sectionErrors.customerProblem}</p>
              )}
            </div>

            <div>
              <label
                htmlFor="pos-brand-solution"
                className="block text-xs font-semibold text-slate-800"
              >
                Brand Solution *
              </label>
              <textarea
                id="pos-brand-solution"
                rows={2}
                value={foundation.positioning.brandSolution}
                onChange={(e) => updatePositioning({ brandSolution: e.target.value })}
                className={inputClass(Boolean(sectionErrors.brandSolution))}
              />
              {sectionErrors.brandSolution && (
                <p className="mt-1 text-xs text-red-600">{sectionErrors.brandSolution}</p>
              )}
            </div>

            <div>
              <label
                htmlFor="pos-advantage"
                className="block text-xs font-semibold text-slate-800"
              >
                Differentiating Advantage *
              </label>
              <textarea
                id="pos-advantage"
                rows={2}
                value={foundation.positioning.differentiatingAdvantage}
                onChange={(e) =>
                  updatePositioning({ differentiatingAdvantage: e.target.value })
                }
                placeholder="What makes your delivery measurably better or harder to copy"
                className={inputClass(Boolean(sectionErrors.differentiatingAdvantage))}
              />
              {sectionErrors.differentiatingAdvantage && (
                <p className="mt-1 text-xs text-red-600">
                  {sectionErrors.differentiatingAdvantage}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="pos-competitive-distinction"
                className="block text-xs font-semibold text-slate-800"
              >
                Competitive Distinction *
              </label>
              <textarea
                id="pos-competitive-distinction"
                rows={2}
                value={foundation.positioning.competitiveDistinction}
                onChange={(e) => updatePositioning({ competitiveDistinction: e.target.value })}
                placeholder="How you differ directly from named competitors or status quo"
                className={inputClass(Boolean(sectionErrors.competitiveDistinction))}
              />
              {sectionErrors.competitiveDistinction && (
                <p className="mt-1 text-xs text-red-600">
                  {sectionErrors.competitiveDistinction}
                </p>
              )}
            </div>

            <div className="sm:col-span-2">
              <label
                htmlFor="pos-main-value"
                className="block text-xs font-semibold text-slate-800"
              >
                Main Value Delivered *
              </label>
              <input
                id="pos-main-value"
                type="text"
                value={foundation.positioning.mainValueDelivered}
                onChange={(e) => updatePositioning({ mainValueDelivered: e.target.value })}
                placeholder="Primary measurable outcome for the customer"
                className={inputClass(Boolean(sectionErrors.mainValueDelivered))}
              />
              {sectionErrors.mainValueDelivered && (
                <p className="mt-1 text-xs text-red-600">{sectionErrors.mainValueDelivered}</p>
              )}
            </div>

            {/* Differentiation Attributes (AI suggested vs User-approved) */}
            <div className="sm:col-span-2 border-t border-slate-100 pt-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-semibold text-slate-800">
                  Approved Differentiation Attributes
                </span>
                {foundation.positioning.aiSuggestedAttributes.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      const merged = Array.from(
                        new Set([
                          ...foundation.positioning.differentiationAttributes,
                          ...foundation.positioning.aiSuggestedAttributes,
                        ]),
                      );
                      updatePositioning({ differentiationAttributes: merged });
                    }}
                    className="text-xs font-medium text-blue-600 hover:text-blue-700"
                  >
                    Adopt AI-Suggested Attributes (
                    {foundation.positioning.aiSuggestedAttributes.length})
                  </button>
                )}
              </div>

              {foundation.positioning.aiSuggestedAttributes.length > 0 && (
                <p className="mt-1 text-xs text-amber-800">
                  AI Suggestions: {foundation.positioning.aiSuggestedAttributes.join(' · ')}
                </p>
              )}

              <div className="mt-2 flex flex-wrap gap-2">
                <input
                  type="text"
                  aria-label="Add differentiation attribute"
                  value={newAttributeInput}
                  onChange={(e) => setNewAttributeInput(e.target.value)}
                  placeholder="Add an approved differentiation attribute"
                  className="min-h-[40px] flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => {
                    const trimmed = newAttributeInput.trim();
                    if (!trimmed) return;
                    if (!foundation.positioning.differentiationAttributes.includes(trimmed)) {
                      updatePositioning({
                        differentiationAttributes: [
                          ...foundation.positioning.differentiationAttributes,
                          trimmed,
                        ],
                      });
                    }
                    setNewAttributeInput('');
                  }}
                  className="inline-flex min-h-[40px] items-center gap-1 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Add</span>
                </button>
              </div>

              {foundation.positioning.differentiationAttributes.length > 0 && (
                <ul className="mt-2.5 flex flex-wrap gap-2">
                  {foundation.positioning.differentiationAttributes.map((attr) => (
                    <li
                      key={attr}
                      className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-800"
                    >
                      <span>{attr}</span>
                      <button
                        type="button"
                        aria-label={`Remove ${attr}`}
                        onClick={() =>
                          updatePositioning({
                            differentiationAttributes:
                              foundation.positioning.differentiationAttributes.filter(
                                (item) => item !== attr,
                              ),
                          })
                        }
                        className="text-slate-400 hover:text-slate-700"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="sm:col-span-2">
              <AiSuggestionBox
                suggestion={foundation.positioning.aiSuggestedStatement}
                status={foundation.positioning.suggestionStatus}
                onUse={() =>
                  updatePositioning({
                    statement: foundation.positioning.aiSuggestedStatement ?? '',
                    suggestionStatus: 'approved',
                  })
                }
                onReject={() => updatePositioning({ suggestionStatus: 'rejected' })}
              />
            </div>

            <div className="sm:col-span-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label
                  htmlFor="pos-statement"
                  className="block text-xs font-semibold text-slate-800"
                >
                  Approved / Working Brand Positioning Statement *
                </label>
                <button
                  type="button"
                  onClick={() => {
                    const draft = buildProposedStatementDraft(
                      'positioning',
                      foundation,
                      brand.brandName,
                    );
                    if (draft) {
                      updatePositioning({ statement: draft });
                    } else {
                      setSectionErrors(validateFoundationSection('positioning', foundation));
                    }
                  }}
                  className="text-xs font-medium text-blue-600 hover:text-blue-700"
                >
                  Build Draft from My Inputs
                </button>
              </div>
              <textarea
                id="pos-statement"
                rows={3}
                value={foundation.positioning.statement}
                onChange={(e) => updatePositioning({ statement: e.target.value })}
                placeholder="Write or refine your positioning statement before approving."
                className={inputClass(Boolean(sectionErrors.statement))}
              />
              {sectionErrors.statement && (
                <p className="mt-1 text-xs text-red-600">{sectionErrors.statement}</p>
              )}
            </div>
          </div>
        </SectionEditorShell>
      )}

      {/* Step 06: Consolidated Review & Final Approval */}
      {activeStep === 'review' && (
        <section
          aria-label="Consolidated Brand Foundation Review"
          className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6"
        >
          <div className="flex flex-col justify-between gap-3 border-b border-slate-100 pb-4 sm:flex-row sm:items-center">
            <div>
              <div className="flex items-center gap-2">
                <ClipboardCheck className="h-4 w-4 text-blue-600" strokeWidth={1.75} />
                <h3 className="text-base font-semibold text-slate-900">
                  06. Consolidated Brand Foundation Review
                </h3>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-slate-600">
                Review every approved section before locking the consolidated foundation for{' '}
                {brand.brandName}. Once completed, this serves as verified context for Brand Messaging.
              </p>
            </div>

            {moduleStatus === 'completed' && (
              <span className="inline-flex shrink-0 items-center gap-1.5 text-xs font-semibold text-emerald-700 whitespace-nowrap">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>Foundation Completed</span>
              </span>
            )}
          </div>

          {!completionCheck.allowed && (
            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3.5 text-xs text-amber-950">
              Approve the remaining sections before final completion:{' '}
              <span className="font-semibold">
                {completionCheck.incompleteSections
                  .map(
                    (key) =>
                      FOUNDATION_SECTIONS.find((s) => s.key === key)?.title ?? key,
                  )
                  .join(', ')}
              </span>
              .
            </div>
          )}

          <div className="mt-4 divide-y divide-slate-100">
            <ReviewSectionRow
              title="01. Brand Purpose"
              approved={foundation.purpose.approved}
              statement={foundation.purpose.statement}
              details={[
                `Problem: ${foundation.purpose.problemAddressed || '—'}`,
                `People Served: ${foundation.purpose.peopleServed || '—'}`,
                `Positive Change: ${foundation.purpose.positiveChange || '—'}`,
              ]}
              onEdit={() => goToStep('purpose')}
            />

            <ReviewSectionRow
              title="02. Mission Statement"
              approved={foundation.mission.approved}
              statement={foundation.mission.statement}
              details={[
                `What We Do: ${foundation.mission.whatBusinessDoes || '—'}`,
                `Who We Serve: ${foundation.mission.whoItServes || '—'}`,
                `Value Delivered: ${foundation.mission.valueDelivered || '—'}`,
              ]}
              onEdit={() => goToStep('mission')}
            />

            <ReviewSectionRow
              title="03. Vision Statement"
              approved={foundation.vision.approved}
              statement={foundation.vision.statement}
              details={[
                `Future Created: ${foundation.vision.futureCreated || '—'}`,
                `Long-Term Ambition: ${foundation.vision.longTermAmbition || '—'}`,
                `Impact: ${foundation.vision.impactAchieved || '—'}`,
              ]}
              onEdit={() => goToStep('vision')}
            />

            <div className="py-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-semibold text-slate-900">04. Core Values</h4>
                  <span
                    className={`text-xs font-medium ${
                      foundation.coreValues.approved
                        ? 'text-emerald-700'
                        : 'text-amber-700'
                    }`}
                  >
                    {foundation.coreValues.approved ? 'Approved' : 'Needs approval'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => goToStep('coreValues')}
                  className="inline-flex min-h-[36px] items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  <Edit3 className="h-3.5 w-3.5" />
                  <span>Edit</span>
                </button>
              </div>
              {foundation.coreValues.values.length === 0 ? (
                <p className="mt-2 text-sm text-slate-500">No core values defined yet.</p>
              ) : (
                <ul className="mt-2.5 divide-y divide-slate-100 pl-1">
                  {foundation.coreValues.values.map((val) => (
                    <li key={val.id} className="py-2 text-xs first:pt-0 last:pb-0">
                      <p className="font-semibold text-slate-900">{val.name || 'Untitled Value'}</p>
                      <p className="mt-1 text-slate-600">
                        <strong className="font-medium text-slate-700">Behaviors:</strong>{' '}
                        {val.behaviors || '—'}
                      </p>
                      <p className="mt-0.5 text-slate-600">
                        <strong className="font-medium text-slate-700">Why it matters:</strong>{' '}
                        {val.whyItMatters || '—'}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <ReviewSectionRow
              title="05. Brand Positioning"
              approved={foundation.positioning.approved}
              statement={foundation.positioning.statement}
              details={[
                `Primary Customer: ${foundation.positioning.primaryCustomer || '—'}`,
                `Advantage: ${foundation.positioning.differentiatingAdvantage || '—'}`,
                `Distinction: ${foundation.positioning.competitiveDistinction || '—'}`,
                ...(foundation.positioning.differentiationAttributes.length > 0
                  ? [
                      `Attributes: ${foundation.positioning.differentiationAttributes.join(', ')}`,
                    ]
                  : []),
              ]}
              onEdit={() => goToStep('positioning')}
            />
          </div>

          {/* Prompt Traceability Metadata */}
          {foundation.aiSynthesis.promptId && (
            <div className="mt-4 border-t border-slate-100 pt-4 text-xs text-slate-500">
              <span>
                AI Draft Provenance:{' '}
                <code className="font-mono text-slate-700">
                  {foundation.aiSynthesis.promptId}
                </code>{' '}
                v{foundation.aiSynthesis.promptVersion} · {foundation.aiSynthesis.model}
              </span>
            </div>
          )}

          {/* Review Footer Actions */}
          <div className="mt-6 flex flex-col justify-between gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={() => goToStep('positioning')}
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
                onClick={() => void handleCompleteFoundation()}
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
                    ? 'Save Updated Brand Foundation'
                    : 'Complete Brand Foundation'}
                </span>
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Regeneration Safeguard Confirmation Dialog */}
      <ConfirmDialog
        open={showRegenerateConfirm}
        title="Regenerate AI suggestions?"
        description="Regenerating runs brand_foundation_synthesis again using your current verified brand profile. Previously approved sections and your manual inputs will stay protected and will not be overwritten."
        confirmLabel="Generate New Suggestions"
        cancelLabel="Cancel"
        variant="primary"
        onConfirm={() => {
          setShowRegenerateConfirm(false);
          void runAiSynthesis();
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
  approvedAt: string | null;
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
          className={`inline-flex items-center gap-1.5 text-xs font-semibold ${
            approved ? 'text-emerald-700' : 'text-slate-500'
          }`}
        >
          {approved ? (
            <>
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <span>Approved Brand Fact</span>
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
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
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

interface AiSuggestionBoxProps {
  suggestion: string | null;
  status: 'none' | 'pending_review' | 'approved' | 'rejected';
  onUse: () => void;
  onReject: () => void;
}

function AiSuggestionBox({ suggestion, status, onUse, onReject }: AiSuggestionBoxProps) {
  if (!suggestion) return null;

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-4">
      <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-900">
          <Sparkles className="h-3.5 w-3.5 text-amber-600" />
          <span>
            AI-Generated Suggestion{' '}
            {status === 'approved'
              ? '(Adopted into draft)'
              : status === 'rejected'
                ? '(Rejected)'
                : '(Unapproved Draft)'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onUse}
            className="inline-flex min-h-[34px] items-center gap-1 rounded-md border border-amber-300 bg-white px-3 py-1 text-xs font-semibold text-amber-950 hover:bg-amber-100"
          >
            <Check className="h-3.5 w-3.5" />
            <span>Use Suggestion</span>
          </button>
          {status !== 'rejected' && (
            <button
              type="button"
              onClick={onReject}
              className="inline-flex min-h-[34px] items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium text-amber-900 hover:bg-amber-100"
            >
              <X className="h-3.5 w-3.5" />
              <span>Dismiss</span>
            </button>
          )}
        </div>
      </div>

      <p className="mt-2 text-sm leading-relaxed text-slate-800">{suggestion}</p>
    </div>
  );
}

interface ReviewSectionRowProps {
  title: string;
  approved: boolean;
  statement: string;
  details: string[];
  onEdit: () => void;
}

function ReviewSectionRow({
  title,
  approved,
  statement,
  details,
  onEdit,
}: ReviewSectionRowProps) {
  return (
    <div className="py-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h4 className="text-sm font-semibold text-slate-900">{title}</h4>
          <span
            className={`text-xs font-medium ${
              approved ? 'text-emerald-700' : 'text-amber-700'
            }`}
          >
            {approved ? 'Approved' : 'Needs approval'}
          </span>
        </div>

        <button
          type="button"
          onClick={onEdit}
          className="inline-flex min-h-[36px] items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
        >
          <Edit3 className="h-3.5 w-3.5" />
          <span>Edit</span>
        </button>
      </div>

      <p className="mt-2 text-sm leading-relaxed text-slate-800">
        {statement.trim() || <span className="text-slate-400">No statement drafted yet.</span>}
      </p>

      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
        {details.map((detail, idx) => (
          <span key={idx}>{detail}</span>
        ))}
      </div>
    </div>
  );
}
