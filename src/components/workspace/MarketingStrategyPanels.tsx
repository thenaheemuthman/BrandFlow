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
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import type { ModuleStatus } from '../../types/brand';
import {
  MARKETING_STRATEGY_SECTIONS,
  collectOutstandingInformationGaps,
  type AiSuggestedChannelItem,
  type AiSuggestedGoalItem,
  type AiSuggestedKpiItem,
  type AiSuggestedObjectiveItem,
  type AiSuggestedRoadmapItem,
  type AiSuggestedTacticItem,
  type ChannelPriority,
  type ImplementationRoadmapItem,
  type KpiClassification,
  type MarketingAiRunState,
  type MarketingChannelItem,
  type MarketingKpiItem,
  type MarketingObjectiveItem,
  type MarketingStrategyProgressSummary,
  type MarketingStrategySectionKey,
  type MarketingStrategyState,
  type MarketingStrategyStepKey,
  type MarketingTacticItem,
  type SmartMarketingGoalItem,
  type StrategyPriority,
} from '../../utils/marketingStrategyLogic';

const INPUT_BASE =
  'mt-1.5 w-full rounded-lg border bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 transition-colors focus:outline-none';

function fieldClass(hasError?: boolean): string {
  return `${INPUT_BASE} ${
    hasError
      ? 'border-red-400 focus:border-red-600'
      : 'border-slate-200 focus:border-blue-600'
  }`;
}

function linesToArray(raw: string): string[] {
  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

export function AiRunContextBanner({
  run,
  label,
}: {
  run: MarketingAiRunState;
  label: string;
}) {
  if (!run.generatedAt) return null;
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-4 text-xs space-y-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/70 pb-2">
        <span className="font-semibold text-slate-800">{label} — Grounding Summary</span>
        {run.model && (
          <span className="font-mono text-[11px] text-slate-500">
            {run.promptId}@{run.promptVersion}
          </span>
        )}
      </div>
      {run.researchCaveat && (
        <p className="text-slate-700 leading-relaxed">{run.researchCaveat}</p>
      )}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <p className="font-semibold text-slate-800">
            Verified Facts Used ({run.suppliedFactsUsed.length})
          </p>
          {run.suppliedFactsUsed.length > 0 ? (
            <ul className="mt-1 list-disc space-y-0.5 pl-4 text-slate-600">
              {run.suppliedFactsUsed.slice(0, 5).map((fact, idx) => (
                <li key={idx}>{fact}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-slate-500">Grounded in verified workspace profile.</p>
          )}
        </div>
        <div>
          <p className="font-semibold text-slate-800">
            Missing Info / Assumptions Flagged ({run.missingContextNotes.length})
          </p>
          {run.missingContextNotes.length > 0 ? (
            <ul className="mt-1 list-disc space-y-0.5 pl-4 text-amber-800">
              {run.missingContextNotes.slice(0, 5).map((note, idx) => (
                <li key={idx}>{note}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-slate-500">No critical gaps flagged in this run.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function PriorityBadge({ value }: { value: StrategyPriority | ChannelPriority }) {
  const styles: Record<string, string> = {
    high: 'border-red-200 bg-red-50 text-red-700',
    primary: 'border-blue-200 bg-blue-50 text-blue-700',
    medium: 'border-amber-200 bg-amber-50 text-amber-800',
    secondary: 'border-slate-200 bg-slate-100 text-slate-700',
    low: 'border-slate-200 bg-slate-50 text-slate-600',
    experimental: 'border-purple-200 bg-purple-50 text-purple-700',
  };
  return (
    <span
      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold capitalize ${
        styles[value] ?? 'border-slate-200 bg-slate-50 text-slate-700'
      }`}
    >
      {value}
    </span>
  );
}

function ApprovalBadge({ approved }: { approved: boolean }) {
  return approved ? (
    <span className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
      <CheckCircle2 className="h-3 w-3" />
      Approved
    </span>
  ) : (
    <span className="inline-flex items-center rounded-md border border-slate-200 bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
      Draft
    </span>
  );
}

function SectionActionHeader({
  title,
  subtitle,
  generateLabel,
  regenerateLabel,
  generatingLabel,
  hasGenerated,
  generating,
  generateDisabled,
  generateDisabledReason,
  addLabel,
  onGenerate,
  onAddManual,
}: {
  title: string;
  subtitle: string;
  generateLabel: string;
  regenerateLabel: string;
  generatingLabel: string;
  hasGenerated: boolean;
  generating: boolean;
  generateDisabled: boolean;
  generateDisabledReason?: string | null;
  addLabel: string;
  onGenerate: () => void;
  onAddManual: () => void;
}) {
  return (
    <div className="flex flex-col justify-between gap-4 border-b border-slate-100 pb-4 sm:flex-row sm:items-center">
      <div className="min-w-0">
        <h3 className="text-base font-semibold text-slate-900">{title}</h3>
        <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{subtitle}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2.5 shrink-0">
        <button
          type="button"
          onClick={onGenerate}
          disabled={generating || generateDisabled}
          title={generateDisabledReason ?? undefined}
          className="inline-flex min-h-[42px] items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 whitespace-nowrap"
        >
          {generating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : hasGenerated ? (
            <RefreshCw className="h-4 w-4" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          <span>
            {generating
              ? generatingLabel
              : hasGenerated
                ? regenerateLabel
                : generateLabel}
          </span>
        </button>
        <button
          type="button"
          onClick={onAddManual}
          className="inline-flex min-h-[42px] items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 whitespace-nowrap"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>{addLabel}</span>
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// 01. SMART MARKETING GOALS PANEL
// ============================================================================

export function GoalsPanel({
  state,
  generating,
  canGenerate,
  disabledReason,
  editingIds,
  errorsMap,
  onToggleEdit,
  onGenerate,
  onAddManual,
  onAdoptSuggestion,
  onDismissSuggestion,
  onUpdateGoal,
  onApproveGoal,
  onUnapproveGoal,
  onRequestDeleteGoal,
  onNext,
}: {
  state: MarketingStrategyState;
  generating: boolean;
  canGenerate: boolean;
  disabledReason: string | null;
  editingIds: Record<string, boolean>;
  errorsMap: Record<string, Record<string, string>>;
  onToggleEdit: (id: string, editing: boolean) => void;
  onGenerate: () => void;
  onAddManual: () => void;
  onAdoptSuggestion: (suggestionId: string) => void;
  onDismissSuggestion: (suggestionId: string) => void;
  onUpdateGoal: (id: string, patch: Partial<SmartMarketingGoalItem>) => void;
  onApproveGoal: (goal: SmartMarketingGoalItem) => void;
  onUnapproveGoal: (id: string) => void;
  onRequestDeleteGoal: (goal: SmartMarketingGoalItem) => void;
  onNext: () => void;
}) {
  const pendingSuggestions = state.aiSuggestedGoals.filter(
    (s) => s.suggestionStatus === 'pending_review',
  );

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6 space-y-6">
      <SectionActionHeader
        title="01. SMART Marketing Goals"
        subtitle="Define specific, measurable, achievable, relevant, and time-bound marketing goals grounded in approved brand and customer intelligence."
        generateLabel="Generate AI Goals & Objectives"
        regenerateLabel="Regenerate AI Goals & Objectives"
        generatingLabel="Generating Goals & Objectives..."
        hasGenerated={Boolean(state.goalsObjectivesSynthesis.generatedAt)}
        generating={generating}
        generateDisabled={!canGenerate}
        generateDisabledReason={disabledReason}
        addLabel="Add Goal Manually"
        onGenerate={onGenerate}
        onAddManual={onAddManual}
      />

      <AiRunContextBanner
        run={state.goalsObjectivesSynthesis}
        label="AI Goals & Objectives Synthesis"
      />

      {pendingSuggestions.length > 0 && (
        <div className="space-y-3 rounded-xl border border-blue-200 bg-blue-50/40 p-4">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-blue-900">
              AI Recommended SMART Goals ({pendingSuggestions.length} pending review)
            </h4>
            <span className="text-[11px] text-blue-700">
              Adopt to edit & approve; never auto-approved
            </span>
          </div>
          <div className="space-y-3">
            {pendingSuggestions.map((s: AiSuggestedGoalItem) => (
              <div
                key={s.id}
                data-testid="ai-goal-suggestion-card"
                className="rounded-lg border border-blue-200/80 bg-white p-4 space-y-2"
              >
                <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-start">
                  <div>
                    <h5 className="text-sm font-semibold text-slate-900">{s.title}</h5>
                    <p className="mt-1 text-xs text-slate-600">{s.description}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => onAdoptSuggestion(s.id)}
                      className="inline-flex min-h-[34px] items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
                    >
                      <Check className="h-3.5 w-3.5" />
                      <span>Adopt as Draft</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onDismissSuggestion(s.id)}
                      className="inline-flex min-h-[34px] items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                    >
                      <X className="h-3.5 w-3.5" />
                      <span>Dismiss</span>
                    </button>
                  </div>
                </div>
                <dl className="grid grid-cols-1 gap-2 border-t border-slate-100 pt-2 text-xs sm:grid-cols-3">
                  <div>
                    <dt className="font-medium text-slate-500">Target Audience</dt>
                    <dd className="text-slate-800">{s.targetAudience || '—'}</dd>
                  </div>
                  <div>
                    <dt className="font-medium text-slate-500">Target / Baseline</dt>
                    <dd className="text-slate-800">{s.targetValue || '—'}</dd>
                  </div>
                  <div>
                    <dt className="font-medium text-slate-500">Timeframe</dt>
                    <dd className="text-slate-800">{s.recommendedTimeframe || '—'}</dd>
                  </div>
                </dl>
              </div>
            ))}
          </div>
        </div>
      )}

      {state.goals.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-8 text-center">
          <p className="text-sm font-medium text-slate-800">No SMART marketing goals yet</p>
          <p className="mt-1 text-xs text-slate-500">
            Generate AI SMART goals from your approved brand and customer intelligence, or add one manually.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {state.goals.map((goal) => {
            const isEditing = editingIds[goal.id] === true;
            const errs = errorsMap[goal.id] ?? {};
            return (
              <article
                key={goal.id}
                data-testid="marketing-goal-card"
                className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 space-y-4"
              >
                <div className="flex flex-col justify-between gap-3 border-b border-slate-100 pb-3 sm:flex-row sm:items-start">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="text-sm font-semibold text-slate-900">
                        {goal.title || 'Untitled SMART Goal'}
                      </h4>
                      <ApprovalBadge approved={goal.approved} />
                    </div>
                    {!isEditing && goal.description && (
                      <p className="mt-1 text-xs leading-relaxed text-slate-600">
                        {goal.description}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => onToggleEdit(goal.id, !isEditing)}
                      className="inline-flex min-h-[34px] items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                      <span>{isEditing ? 'Done Editing' : 'Edit'}</span>
                    </button>
                    {goal.approved ? (
                      <button
                        type="button"
                        onClick={() => onUnapproveGoal(goal.id)}
                        className="inline-flex min-h-[34px] items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs font-medium text-amber-800 hover:bg-amber-100"
                      >
                        Move to Draft
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onApproveGoal(goal)}
                        className="inline-flex min-h-[34px] items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
                      >
                        <Check className="h-3.5 w-3.5" />
                        <span>Approve Goal</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => onRequestDeleteGoal(goal)}
                      aria-label={`Delete goal ${goal.title || 'Untitled'}`}
                      className="inline-flex min-h-[34px] items-center rounded-lg border border-red-200 bg-white px-2.5 py-1.5 text-xs text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {isEditing ? (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold text-slate-700">
                        Goal Title *
                      </label>
                      <input
                        type="text"
                        value={goal.title}
                        onChange={(e) => onUpdateGoal(goal.id, { title: e.target.value })}
                        placeholder="e.g., Grow Qualified Consultation Pipeline from Austin Founders"
                        className={fieldClass(Boolean(errs.title))}
                      />
                      {errs.title && <p className="mt-1 text-xs text-red-600">{errs.title}</p>}
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold text-slate-700">
                        Description *
                      </label>
                      <textarea
                        rows={2}
                        value={goal.description}
                        onChange={(e) => onUpdateGoal(goal.id, { description: e.target.value })}
                        className={fieldClass(Boolean(errs.description))}
                      />
                      {errs.description && (
                        <p className="mt-1 text-xs text-red-600">{errs.description}</p>
                      )}
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold text-slate-700">
                        Strategic Rationale *
                      </label>
                      <textarea
                        rows={2}
                        value={goal.strategicRationale}
                        onChange={(e) =>
                          onUpdateGoal(goal.id, { strategicRationale: e.target.value })
                        }
                        className={fieldClass(Boolean(errs.strategicRationale))}
                      />
                      {errs.strategicRationale && (
                        <p className="mt-1 text-xs text-red-600">{errs.strategicRationale}</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700">
                        Target Audience *
                      </label>
                      <input
                        type="text"
                        value={goal.targetAudience}
                        onChange={(e) => onUpdateGoal(goal.id, { targetAudience: e.target.value })}
                        className={fieldClass(Boolean(errs.targetAudience))}
                      />
                      {errs.targetAudience && (
                        <p className="mt-1 text-xs text-red-600">{errs.targetAudience}</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700">
                        Supporting Business Objective *
                      </label>
                      <input
                        type="text"
                        value={goal.supportingBusinessObjective}
                        onChange={(e) =>
                          onUpdateGoal(goal.id, { supportingBusinessObjective: e.target.value })
                        }
                        className={fieldClass(Boolean(errs.supportingBusinessObjective))}
                      />
                      {errs.supportingBusinessObjective && (
                        <p className="mt-1 text-xs text-red-600">
                          {errs.supportingBusinessObjective}
                        </p>
                      )}
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold text-slate-700">
                        Success Metrics (one per line) *
                      </label>
                      <textarea
                        rows={2}
                        value={goal.successMetrics.join('\n')}
                        onChange={(e) =>
                          onUpdateGoal(goal.id, { successMetrics: linesToArray(e.target.value) })
                        }
                        placeholder="Qualified consultations booked&#10;Briefing signup rate"
                        className={fieldClass(Boolean(errs.successMetrics))}
                      />
                      {errs.successMetrics && (
                        <p className="mt-1 text-xs text-red-600">{errs.successMetrics}</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700">
                        Target Value / Baseline Status *
                      </label>
                      <input
                        type="text"
                        value={goal.targetValue}
                        onChange={(e) => onUpdateGoal(goal.id, { targetValue: e.target.value })}
                        placeholder="Baseline to be established in first 30 days"
                        className={fieldClass(Boolean(errs.targetValue))}
                      />
                      {errs.targetValue && (
                        <p className="mt-1 text-xs text-red-600">{errs.targetValue}</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700">
                        Measurement Period *
                      </label>
                      <input
                        type="text"
                        value={goal.measurementPeriod}
                        onChange={(e) =>
                          onUpdateGoal(goal.id, { measurementPeriod: e.target.value })
                        }
                        placeholder="e.g., Monthly"
                        className={fieldClass(Boolean(errs.measurementPeriod))}
                      />
                      {errs.measurementPeriod && (
                        <p className="mt-1 text-xs text-red-600">{errs.measurementPeriod}</p>
                      )}
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold text-slate-700">
                        Recommended Timeframe *
                      </label>
                      <input
                        type="text"
                        value={goal.recommendedTimeframe}
                        onChange={(e) =>
                          onUpdateGoal(goal.id, { recommendedTimeframe: e.target.value })
                        }
                        placeholder="e.g., Next 90 days"
                        className={fieldClass(Boolean(errs.recommendedTimeframe))}
                      />
                      {errs.recommendedTimeframe && (
                        <p className="mt-1 text-xs text-red-600">{errs.recommendedTimeframe}</p>
                      )}
                    </div>
                  </div>
                ) : (
                  <dl className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-2 lg:grid-cols-3">
                    <div>
                      <dt className="font-medium text-slate-500">Strategic Rationale</dt>
                      <dd className="mt-0.5 text-slate-800">{goal.strategicRationale || '—'}</dd>
                    </div>
                    <div>
                      <dt className="font-medium text-slate-500">Target Audience</dt>
                      <dd className="mt-0.5 text-slate-800">{goal.targetAudience || '—'}</dd>
                    </div>
                    <div>
                      <dt className="font-medium text-slate-500">Business Objective</dt>
                      <dd className="mt-0.5 text-slate-800">
                        {goal.supportingBusinessObjective || '—'}
                      </dd>
                    </div>
                    <div>
                      <dt className="font-medium text-slate-500">Success Metrics</dt>
                      <dd className="mt-0.5 text-slate-800">
                        {goal.successMetrics.length > 0 ? goal.successMetrics.join(' · ') : '—'}
                      </dd>
                    </div>
                    <div>
                      <dt className="font-medium text-slate-500">Target / Baseline</dt>
                      <dd className="mt-0.5 text-slate-800">{goal.targetValue || '—'}</dd>
                    </div>
                    <div>
                      <dt className="font-medium text-slate-500">Cadence & Timeframe</dt>
                      <dd className="mt-0.5 text-slate-800">
                        {[goal.measurementPeriod, goal.recommendedTimeframe]
                          .filter(Boolean)
                          .join(' · ') || '—'}
                      </dd>
                    </div>
                  </dl>
                )}
              </article>
            );
          })}
        </div>
      )}

      <div className="flex justify-end border-t border-slate-100 pt-4">
        <button
          type="button"
          onClick={onNext}
          className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
        >
          <span>Next: Marketing Objectives</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </section>
  );
}

// ============================================================================
// 02. MARKETING OBJECTIVES PANEL
// ============================================================================

export function ObjectivesPanel({
  state,
  generating,
  canGenerate,
  disabledReason,
  editingIds,
  errorsMap,
  onToggleEdit,
  onGenerate,
  onAddManual,
  onAdoptSuggestion,
  onDismissSuggestion,
  onUpdateObjective,
  onApproveObjective,
  onUnapproveObjective,
  onRequestDeleteObjective,
  onPrev,
  onNext,
}: {
  state: MarketingStrategyState;
  generating: boolean;
  canGenerate: boolean;
  disabledReason: string | null;
  editingIds: Record<string, boolean>;
  errorsMap: Record<string, Record<string, string>>;
  onToggleEdit: (id: string, editing: boolean) => void;
  onGenerate: () => void;
  onAddManual: () => void;
  onAdoptSuggestion: (suggestionId: string) => void;
  onDismissSuggestion: (suggestionId: string) => void;
  onUpdateObjective: (id: string, patch: Partial<MarketingObjectiveItem>) => void;
  onApproveObjective: (item: MarketingObjectiveItem) => void;
  onUnapproveObjective: (id: string) => void;
  onRequestDeleteObjective: (item: MarketingObjectiveItem) => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  const pendingSuggestions = state.aiSuggestedObjectives.filter(
    (s) => s.suggestionStatus === 'pending_review',
  );

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6 space-y-6">
      <SectionActionHeader
        title="02. Marketing Objectives"
        subtitle="Break down your approved SMART goals into focused, measurable marketing objectives with clear business outcomes and priority levels."
        generateLabel="Generate AI Goals & Objectives"
        regenerateLabel="Regenerate AI Goals & Objectives"
        generatingLabel="Generating Goals & Objectives..."
        hasGenerated={Boolean(state.goalsObjectivesSynthesis.generatedAt)}
        generating={generating}
        generateDisabled={!canGenerate}
        generateDisabledReason={disabledReason}
        addLabel="Add Objective Manually"
        onGenerate={onGenerate}
        onAddManual={onAddManual}
      />

      {pendingSuggestions.length > 0 && (
        <div className="space-y-3 rounded-xl border border-blue-200 bg-blue-50/40 p-4">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-blue-900">
            AI Recommended Objectives ({pendingSuggestions.length} pending review)
          </h4>
          <div className="space-y-3">
            {pendingSuggestions.map((s: AiSuggestedObjectiveItem) => (
              <div
                key={s.id}
                data-testid="ai-objective-suggestion-card"
                className="rounded-lg border border-blue-200/80 bg-white p-4 space-y-2"
              >
                <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-start">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h5 className="text-sm font-semibold text-slate-900">{s.title}</h5>
                      <PriorityBadge value={s.priority} />
                    </div>
                    <p className="mt-1 text-xs text-slate-600">{s.description}</p>
                    <p className="mt-1 text-[11px] text-slate-500">
                      Supports Goal: <span className="font-medium text-slate-700">{s.supportingGoalTitle || '—'}</span>
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => onAdoptSuggestion(s.id)}
                      className="inline-flex min-h-[34px] items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
                    >
                      <Check className="h-3.5 w-3.5" />
                      <span>Adopt as Draft</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onDismissSuggestion(s.id)}
                      className="inline-flex min-h-[34px] items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                    >
                      <X className="h-3.5 w-3.5" />
                      <span>Dismiss</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {state.objectives.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-8 text-center">
          <p className="text-sm font-medium text-slate-800">No marketing objectives yet</p>
          <p className="mt-1 text-xs text-slate-500">
            Adopt AI-generated objectives above or add a marketing objective manually linked to a SMART goal.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {state.objectives.map((obj) => {
            const isEditing = editingIds[obj.id] === true;
            const errs = errorsMap[obj.id] ?? {};
            const linkedGoal = state.goals.find((g) => g.id === obj.supportingGoalId);
            return (
              <article
                key={obj.id}
                data-testid="marketing-objective-card"
                className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 space-y-4"
              >
                <div className="flex flex-col justify-between gap-3 border-b border-slate-100 pb-3 sm:flex-row sm:items-start">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="text-sm font-semibold text-slate-900">
                        {obj.title || 'Untitled Objective'}
                      </h4>
                      <PriorityBadge value={obj.priority} />
                      <ApprovalBadge approved={obj.approved} />
                    </div>
                    {!isEditing && obj.description && (
                      <p className="mt-1 text-xs text-slate-600">{obj.description}</p>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => onToggleEdit(obj.id, !isEditing)}
                      className="inline-flex min-h-[34px] items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                      <span>{isEditing ? 'Done Editing' : 'Edit'}</span>
                    </button>
                    {obj.approved ? (
                      <button
                        type="button"
                        onClick={() => onUnapproveObjective(obj.id)}
                        className="inline-flex min-h-[34px] items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs font-medium text-amber-800 hover:bg-amber-100"
                      >
                        Move to Draft
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onApproveObjective(obj)}
                        className="inline-flex min-h-[34px] items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
                      >
                        <Check className="h-3.5 w-3.5" />
                        <span>Approve Objective</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => onRequestDeleteObjective(obj)}
                      aria-label={`Delete objective ${obj.title || 'Untitled'}`}
                      className="inline-flex min-h-[34px] items-center rounded-lg border border-red-200 bg-white px-2.5 py-1.5 text-xs text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {isEditing ? (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700">
                        Objective Title *
                      </label>
                      <input
                        type="text"
                        value={obj.title}
                        onChange={(e) => onUpdateObjective(obj.id, { title: e.target.value })}
                        className={fieldClass(Boolean(errs.title))}
                      />
                      {errs.title && <p className="mt-1 text-xs text-red-600">{errs.title}</p>}
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700">
                        Priority *
                      </label>
                      <select
                        value={obj.priority}
                        onChange={(e) =>
                          onUpdateObjective(obj.id, {
                            priority: e.target.value as StrategyPriority,
                          })
                        }
                        className={fieldClass(false)}
                      >
                        <option value="high">High</option>
                        <option value="medium">Medium</option>
                        <option value="low">Low</option>
                      </select>
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold text-slate-700">
                        Supporting SMART Goal *
                      </label>
                      <select
                        value={obj.supportingGoalId}
                        onChange={(e) => {
                          const selected = state.goals.find((g) => g.id === e.target.value);
                          onUpdateObjective(obj.id, {
                            supportingGoalId: e.target.value,
                            supportingGoalTitle: selected?.title ?? '',
                          });
                        }}
                        className={fieldClass(Boolean(errs.supportingGoalId))}
                      >
                        <option value="">Select supporting SMART goal...</option>
                        {state.goals.map((g) => (
                          <option key={g.id} value={g.id}>
                            {g.title || 'Untitled Goal'}
                          </option>
                        ))}
                      </select>
                      {errs.supportingGoalId && (
                        <p className="mt-1 text-xs text-red-600">{errs.supportingGoalId}</p>
                      )}
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold text-slate-700">
                        Description *
                      </label>
                      <textarea
                        rows={2}
                        value={obj.description}
                        onChange={(e) => onUpdateObjective(obj.id, { description: e.target.value })}
                        className={fieldClass(Boolean(errs.description))}
                      />
                      {errs.description && (
                        <p className="mt-1 text-xs text-red-600">{errs.description}</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700">
                        Intended Business Outcome *
                      </label>
                      <input
                        type="text"
                        value={obj.intendedBusinessOutcome}
                        onChange={(e) =>
                          onUpdateObjective(obj.id, { intendedBusinessOutcome: e.target.value })
                        }
                        className={fieldClass(Boolean(errs.intendedBusinessOutcome))}
                      />
                      {errs.intendedBusinessOutcome && (
                        <p className="mt-1 text-xs text-red-600">{errs.intendedBusinessOutcome}</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700">
                        Target Audience *
                      </label>
                      <input
                        type="text"
                        value={obj.targetAudience}
                        onChange={(e) =>
                          onUpdateObjective(obj.id, { targetAudience: e.target.value })
                        }
                        className={fieldClass(Boolean(errs.targetAudience))}
                      />
                      {errs.targetAudience && (
                        <p className="mt-1 text-xs text-red-600">{errs.targetAudience}</p>
                      )}
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold text-slate-700">
                        Measurement Criteria *
                      </label>
                      <input
                        type="text"
                        value={obj.measurementCriteria}
                        onChange={(e) =>
                          onUpdateObjective(obj.id, { measurementCriteria: e.target.value })
                        }
                        className={fieldClass(Boolean(errs.measurementCriteria))}
                      />
                      {errs.measurementCriteria && (
                        <p className="mt-1 text-xs text-red-600">{errs.measurementCriteria}</p>
                      )}
                    </div>
                  </div>
                ) : (
                  <dl className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-2">
                    <div>
                      <dt className="font-medium text-slate-500">Supporting Goal</dt>
                      <dd className="mt-0.5 text-slate-800">
                        {linkedGoal?.title || obj.supportingGoalTitle || '—'}
                      </dd>
                    </div>
                    <div>
                      <dt className="font-medium text-slate-500">Target Audience</dt>
                      <dd className="mt-0.5 text-slate-800">{obj.targetAudience || '—'}</dd>
                    </div>
                    <div>
                      <dt className="font-medium text-slate-500">Intended Business Outcome</dt>
                      <dd className="mt-0.5 text-slate-800">
                        {obj.intendedBusinessOutcome || '—'}
                      </dd>
                    </div>
                    <div>
                      <dt className="font-medium text-slate-500">Measurement Criteria</dt>
                      <dd className="mt-0.5 text-slate-800">{obj.measurementCriteria || '—'}</dd>
                    </div>
                  </dl>
                )}
              </article>
            );
          })}
        </div>
      )}

      <div className="flex items-center justify-between border-t border-slate-100 pt-4">
        <button
          type="button"
          onClick={onPrev}
          className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Back: SMART Goals</span>
        </button>
        <button
          type="button"
          onClick={onNext}
          className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
        >
          <span>Next: Marketing Channels</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </section>
  );
}

// ============================================================================
// 03. MARKETING CHANNELS PANEL
// ============================================================================

export function ChannelsPanel({
  state,
  generating,
  canGenerate,
  disabledReason,
  editingIds,
  errorsMap,
  onToggleEdit,
  onGenerate,
  onAddManual,
  onAdoptSuggestion,
  onDismissSuggestion,
  onUpdateChannel,
  onApproveChannel,
  onUnapproveChannel,
  onRequestDeleteChannel,
  onPrev,
  onNext,
}: {
  state: MarketingStrategyState;
  generating: boolean;
  canGenerate: boolean;
  disabledReason: string | null;
  editingIds: Record<string, boolean>;
  errorsMap: Record<string, Record<string, string>>;
  onToggleEdit: (id: string, editing: boolean) => void;
  onGenerate: () => void;
  onAddManual: () => void;
  onAdoptSuggestion: (suggestionId: string) => void;
  onDismissSuggestion: (suggestionId: string) => void;
  onUpdateChannel: (id: string, patch: Partial<MarketingChannelItem>) => void;
  onApproveChannel: (item: MarketingChannelItem) => void;
  onUnapproveChannel: (id: string) => void;
  onRequestDeleteChannel: (item: MarketingChannelItem) => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  const pendingSuggestions = state.aiSuggestedChannels.filter(
    (s) => s.suggestionStatus === 'pending_review',
  );

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6 space-y-6">
      <SectionActionHeader
        title="03. Marketing Channels"
        subtitle="Select and prioritize channels justified by approved personas, audience interests, positioning, and objectives — never generic popularity picks."
        generateLabel="Generate AI Channels & Tactics"
        regenerateLabel="Regenerate AI Channels & Tactics"
        generatingLabel="Generating Channels & Tactics..."
        hasGenerated={Boolean(state.channelsTacticsSynthesis.generatedAt)}
        generating={generating}
        generateDisabled={!canGenerate}
        generateDisabledReason={disabledReason}
        addLabel="Add Channel Manually"
        onGenerate={onGenerate}
        onAddManual={onAddManual}
      />

      {!canGenerate && disabledReason && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
          {disabledReason}
        </div>
      )}

      <AiRunContextBanner
        run={state.channelsTacticsSynthesis}
        label="AI Channels & Tactics Synthesis"
      />

      {pendingSuggestions.length > 0 && (
        <div className="space-y-3 rounded-xl border border-blue-200 bg-blue-50/40 p-4">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-blue-900">
            AI Recommended Channels ({pendingSuggestions.length} pending review)
          </h4>
          <div className="space-y-3">
            {pendingSuggestions.map((s: AiSuggestedChannelItem) => (
              <div
                key={s.id}
                data-testid="ai-channel-suggestion-card"
                className="rounded-lg border border-blue-200/80 bg-white p-4 space-y-2"
              >
                <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-start">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h5 className="text-sm font-semibold text-slate-900">{s.channelName}</h5>
                      <PriorityBadge value={s.priority} />
                    </div>
                    <p className="mt-1 text-xs text-slate-600">{s.strategicRationale}</p>
                    <p className="mt-1 text-[11px] text-slate-500">
                      Audience: <span className="font-medium text-slate-700">{s.relevantAudience}</span> · Supports:{' '}
                      <span className="font-medium text-slate-700">{s.supportingObjectiveTitle || '—'}</span>
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => onAdoptSuggestion(s.id)}
                      className="inline-flex min-h-[34px] items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
                    >
                      <Check className="h-3.5 w-3.5" />
                      <span>Adopt as Draft</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onDismissSuggestion(s.id)}
                      className="inline-flex min-h-[34px] items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                    >
                      <X className="h-3.5 w-3.5" />
                      <span>Dismiss</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {state.channels.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-8 text-center">
          <p className="text-sm font-medium text-slate-800">No marketing channels yet</p>
          <p className="mt-1 text-xs text-slate-500">
            Approve at least one SMART goal and objective, then generate grounded AI channel recommendations or add channels manually.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {state.channels.map((ch) => {
            const isEditing = editingIds[ch.id] === true;
            const errs = errorsMap[ch.id] ?? {};
            const linkedObj = state.objectives.find((o) => o.id === ch.supportingObjectiveId);
            return (
              <article
                key={ch.id}
                data-testid="marketing-channel-card"
                className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 space-y-4"
              >
                <div className="flex flex-col justify-between gap-3 border-b border-slate-100 pb-3 sm:flex-row sm:items-start">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="text-sm font-semibold text-slate-900">
                        {ch.channelName || 'Untitled Channel'}
                      </h4>
                      <PriorityBadge value={ch.priority} />
                      <ApprovalBadge approved={ch.approved} />
                    </div>
                    {!isEditing && ch.strategicRationale && (
                      <p className="mt-1 text-xs text-slate-600">{ch.strategicRationale}</p>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => onToggleEdit(ch.id, !isEditing)}
                      className="inline-flex min-h-[34px] items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                      <span>{isEditing ? 'Done Editing' : 'Edit'}</span>
                    </button>
                    {ch.approved ? (
                      <button
                        type="button"
                        onClick={() => onUnapproveChannel(ch.id)}
                        className="inline-flex min-h-[34px] items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs font-medium text-amber-800 hover:bg-amber-100"
                      >
                        Move to Draft
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onApproveChannel(ch)}
                        className="inline-flex min-h-[34px] items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
                      >
                        <Check className="h-3.5 w-3.5" />
                        <span>Approve Channel</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => onRequestDeleteChannel(ch)}
                      aria-label={`Delete channel ${ch.channelName || 'Untitled'}`}
                      className="inline-flex min-h-[34px] items-center rounded-lg border border-red-200 bg-white px-2.5 py-1.5 text-xs text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {isEditing ? (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700">
                        Channel Name *
                      </label>
                      <input
                        type="text"
                        value={ch.channelName}
                        onChange={(e) => onUpdateChannel(ch.id, { channelName: e.target.value })}
                        className={fieldClass(Boolean(errs.channelName))}
                      />
                      {errs.channelName && (
                        <p className="mt-1 text-xs text-red-600">{errs.channelName}</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700">
                        Priority *
                      </label>
                      <select
                        value={ch.priority}
                        onChange={(e) =>
                          onUpdateChannel(ch.id, {
                            priority: e.target.value as ChannelPriority,
                          })
                        }
                        className={fieldClass(false)}
                      >
                        <option value="primary">Primary</option>
                        <option value="secondary">Secondary</option>
                        <option value="experimental">Experimental</option>
                      </select>
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold text-slate-700">
                        Supporting Objective *
                      </label>
                      <select
                        value={ch.supportingObjectiveId}
                        onChange={(e) => {
                          const selected = state.objectives.find((o) => o.id === e.target.value);
                          onUpdateChannel(ch.id, {
                            supportingObjectiveId: e.target.value,
                            supportingObjectiveTitle: selected?.title ?? '',
                          });
                        }}
                        className={fieldClass(Boolean(errs.supportingObjectiveId))}
                      >
                        <option value="">Select supporting objective...</option>
                        {state.objectives.map((o) => (
                          <option key={o.id} value={o.id}>
                            {o.title || 'Untitled Objective'}
                          </option>
                        ))}
                      </select>
                      {errs.supportingObjectiveId && (
                        <p className="mt-1 text-xs text-red-600">{errs.supportingObjectiveId}</p>
                      )}
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold text-slate-700">
                        Strategic Rationale (Grounded in Personas & Strategy) *
                      </label>
                      <textarea
                        rows={2}
                        value={ch.strategicRationale}
                        onChange={(e) =>
                          onUpdateChannel(ch.id, { strategicRationale: e.target.value })
                        }
                        className={fieldClass(Boolean(errs.strategicRationale))}
                      />
                      {errs.strategicRationale && (
                        <p className="mt-1 text-xs text-red-600">{errs.strategicRationale}</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700">
                        Relevant Audience *
                      </label>
                      <input
                        type="text"
                        value={ch.relevantAudience}
                        onChange={(e) =>
                          onUpdateChannel(ch.id, { relevantAudience: e.target.value })
                        }
                        className={fieldClass(Boolean(errs.relevantAudience))}
                      />
                      {errs.relevantAudience && (
                        <p className="mt-1 text-xs text-red-600">{errs.relevantAudience}</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700">
                        Recommended Use *
                      </label>
                      <input
                        type="text"
                        value={ch.recommendedUse}
                        onChange={(e) =>
                          onUpdateChannel(ch.id, { recommendedUse: e.target.value })
                        }
                        className={fieldClass(Boolean(errs.recommendedUse))}
                      />
                      {errs.recommendedUse && (
                        <p className="mt-1 text-xs text-red-600">{errs.recommendedUse}</p>
                      )}
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold text-slate-700">
                        Expected Contribution *
                      </label>
                      <input
                        type="text"
                        value={ch.expectedContribution}
                        onChange={(e) =>
                          onUpdateChannel(ch.id, { expectedContribution: e.target.value })
                        }
                        className={fieldClass(Boolean(errs.expectedContribution))}
                      />
                      {errs.expectedContribution && (
                        <p className="mt-1 text-xs text-red-600">{errs.expectedContribution}</p>
                      )}
                    </div>
                  </div>
                ) : (
                  <dl className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-2">
                    <div>
                      <dt className="font-medium text-slate-500">Supporting Objective</dt>
                      <dd className="mt-0.5 text-slate-800">
                        {linkedObj?.title || ch.supportingObjectiveTitle || '—'}
                      </dd>
                    </div>
                    <div>
                      <dt className="font-medium text-slate-500">Relevant Audience</dt>
                      <dd className="mt-0.5 text-slate-800">{ch.relevantAudience || '—'}</dd>
                    </div>
                    <div>
                      <dt className="font-medium text-slate-500">Recommended Use</dt>
                      <dd className="mt-0.5 text-slate-800">{ch.recommendedUse || '—'}</dd>
                    </div>
                    <div>
                      <dt className="font-medium text-slate-500">Expected Contribution</dt>
                      <dd className="mt-0.5 text-slate-800">{ch.expectedContribution || '—'}</dd>
                    </div>
                  </dl>
                )}
              </article>
            );
          })}
        </div>
      )}

      <div className="flex items-center justify-between border-t border-slate-100 pt-4">
        <button
          type="button"
          onClick={onPrev}
          className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Back: Objectives</span>
        </button>
        <button
          type="button"
          onClick={onNext}
          className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
        >
          <span>Next: Marketing Tactics</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </section>
  );
}

// ============================================================================
// 04. MARKETING TACTICS PANEL
// ============================================================================

export function TacticsPanel({
  state,
  generating,
  canGenerate,
  disabledReason,
  editingIds,
  errorsMap,
  onToggleEdit,
  onGenerate,
  onAddManual,
  onAdoptSuggestion,
  onDismissSuggestion,
  onUpdateTactic,
  onApproveTactic,
  onUnapproveTactic,
  onRequestDeleteTactic,
  onPrev,
  onNext,
}: {
  state: MarketingStrategyState;
  generating: boolean;
  canGenerate: boolean;
  disabledReason: string | null;
  editingIds: Record<string, boolean>;
  errorsMap: Record<string, Record<string, string>>;
  onToggleEdit: (id: string, editing: boolean) => void;
  onGenerate: () => void;
  onAddManual: () => void;
  onAdoptSuggestion: (suggestionId: string) => void;
  onDismissSuggestion: (suggestionId: string) => void;
  onUpdateTactic: (id: string, patch: Partial<MarketingTacticItem>) => void;
  onApproveTactic: (item: MarketingTacticItem) => void;
  onUnapproveTactic: (id: string) => void;
  onRequestDeleteTactic: (item: MarketingTacticItem) => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  const pendingSuggestions = state.aiSuggestedTactics.filter(
    (s) => s.suggestionStatus === 'pending_review',
  );

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6 space-y-6">
      <SectionActionHeader
        title="04. Marketing Tactics"
        subtitle="Specify concrete, execution-ready tactics linked to approved objectives and channels, complete with cadence, execution guidance, and success metric."
        generateLabel="Generate AI Channels & Tactics"
        regenerateLabel="Regenerate AI Channels & Tactics"
        generatingLabel="Generating Channels & Tactics..."
        hasGenerated={Boolean(state.channelsTacticsSynthesis.generatedAt)}
        generating={generating}
        generateDisabled={!canGenerate}
        generateDisabledReason={disabledReason}
        addLabel="Add Tactic Manually"
        onGenerate={onGenerate}
        onAddManual={onAddManual}
      />

      {pendingSuggestions.length > 0 && (
        <div className="space-y-3 rounded-xl border border-blue-200 bg-blue-50/40 p-4">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-blue-900">
            AI Recommended Tactics ({pendingSuggestions.length} pending review)
          </h4>
          <div className="space-y-3">
            {pendingSuggestions.map((s: AiSuggestedTacticItem) => (
              <div
                key={s.id}
                data-testid="ai-tactic-suggestion-card"
                className="rounded-lg border border-blue-200/80 bg-white p-4 space-y-2"
              >
                <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-start">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h5 className="text-sm font-semibold text-slate-900">{s.tacticName}</h5>
                      <PriorityBadge value={s.priority} />
                    </div>
                    <p className="mt-1 text-xs text-slate-600">{s.executionGuidance}</p>
                    <p className="mt-1 text-[11px] text-slate-500">
                      Channel: <span className="font-medium text-slate-700">{s.recommendedChannelName}</span> · Frequency:{' '}
                      <span className="font-medium text-slate-700">{s.suggestedFrequency}</span>
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => onAdoptSuggestion(s.id)}
                      className="inline-flex min-h-[34px] items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
                    >
                      <Check className="h-3.5 w-3.5" />
                      <span>Adopt as Draft</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onDismissSuggestion(s.id)}
                      className="inline-flex min-h-[34px] items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                    >
                      <X className="h-3.5 w-3.5" />
                      <span>Dismiss</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {state.tactics.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-8 text-center">
          <p className="text-sm font-medium text-slate-800">No marketing tactics yet</p>
          <p className="mt-1 text-xs text-slate-500">
            Adopt execution-ready AI tactics above or add a specific tactic manually.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {state.tactics.map((tactic) => {
            const isEditing = editingIds[tactic.id] === true;
            const errs = errorsMap[tactic.id] ?? {};
            const linkedObj = state.objectives.find((o) => o.id === tactic.supportingObjectiveId);
            const linkedChan = state.channels.find((c) => c.id === tactic.recommendedChannelId);
            return (
              <article
                key={tactic.id}
                data-testid="marketing-tactic-card"
                className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 space-y-4"
              >
                <div className="flex flex-col justify-between gap-3 border-b border-slate-100 pb-3 sm:flex-row sm:items-start">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="text-sm font-semibold text-slate-900">
                        {tactic.tacticName || 'Untitled Tactic'}
                      </h4>
                      <PriorityBadge value={tactic.priority} />
                      <ApprovalBadge approved={tactic.approved} />
                    </div>
                    {!isEditing && tactic.description && (
                      <p className="mt-1 text-xs text-slate-600">{tactic.description}</p>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => onToggleEdit(tactic.id, !isEditing)}
                      className="inline-flex min-h-[34px] items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                      <span>{isEditing ? 'Done Editing' : 'Edit'}</span>
                    </button>
                    {tactic.approved ? (
                      <button
                        type="button"
                        onClick={() => onUnapproveTactic(tactic.id)}
                        className="inline-flex min-h-[34px] items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs font-medium text-amber-800 hover:bg-amber-100"
                      >
                        Move to Draft
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onApproveTactic(tactic)}
                        className="inline-flex min-h-[34px] items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
                      >
                        <Check className="h-3.5 w-3.5" />
                        <span>Approve Tactic</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => onRequestDeleteTactic(tactic)}
                      aria-label={`Delete tactic ${tactic.tacticName || 'Untitled'}`}
                      className="inline-flex min-h-[34px] items-center rounded-lg border border-red-200 bg-white px-2.5 py-1.5 text-xs text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {isEditing ? (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700">
                        Tactic Name *
                      </label>
                      <input
                        type="text"
                        value={tactic.tacticName}
                        onChange={(e) => onUpdateTactic(tactic.id, { tacticName: e.target.value })}
                        className={fieldClass(Boolean(errs.tacticName))}
                      />
                      {errs.tacticName && (
                        <p className="mt-1 text-xs text-red-600">{errs.tacticName}</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700">
                        Priority *
                      </label>
                      <select
                        value={tactic.priority}
                        onChange={(e) =>
                          onUpdateTactic(tactic.id, {
                            priority: e.target.value as StrategyPriority,
                          })
                        }
                        className={fieldClass(false)}
                      >
                        <option value="high">High</option>
                        <option value="medium">Medium</option>
                        <option value="low">Low</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700">
                        Supporting Objective *
                      </label>
                      <select
                        value={tactic.supportingObjectiveId}
                        onChange={(e) => {
                          const selected = state.objectives.find((o) => o.id === e.target.value);
                          onUpdateTactic(tactic.id, {
                            supportingObjectiveId: e.target.value,
                            supportingObjectiveTitle: selected?.title ?? '',
                          });
                        }}
                        className={fieldClass(Boolean(errs.supportingObjectiveId))}
                      >
                        <option value="">Select objective...</option>
                        {state.objectives.map((o) => (
                          <option key={o.id} value={o.id}>
                            {o.title || 'Untitled Objective'}
                          </option>
                        ))}
                      </select>
                      {errs.supportingObjectiveId && (
                        <p className="mt-1 text-xs text-red-600">{errs.supportingObjectiveId}</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700">
                        Recommended Channel *
                      </label>
                      <select
                        value={tactic.recommendedChannelId}
                        onChange={(e) => {
                          const selected = state.channels.find((c) => c.id === e.target.value);
                          onUpdateTactic(tactic.id, {
                            recommendedChannelId: e.target.value,
                            recommendedChannelName: selected?.channelName ?? '',
                          });
                        }}
                        className={fieldClass(Boolean(errs.recommendedChannelId))}
                      >
                        <option value="">Select channel...</option>
                        {state.channels.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.channelName || 'Untitled Channel'}
                          </option>
                        ))}
                      </select>
                      {errs.recommendedChannelId && (
                        <p className="mt-1 text-xs text-red-600">{errs.recommendedChannelId}</p>
                      )}
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold text-slate-700">
                        Description *
                      </label>
                      <textarea
                        rows={2}
                        value={tactic.description}
                        onChange={(e) => onUpdateTactic(tactic.id, { description: e.target.value })}
                        className={fieldClass(Boolean(errs.description))}
                      />
                      {errs.description && (
                        <p className="mt-1 text-xs text-red-600">{errs.description}</p>
                      )}
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold text-slate-700">
                        Execution Guidance (Concrete Steps & Format) *
                      </label>
                      <textarea
                        rows={3}
                        value={tactic.executionGuidance}
                        onChange={(e) =>
                          onUpdateTactic(tactic.id, { executionGuidance: e.target.value })
                        }
                        className={fieldClass(Boolean(errs.executionGuidance))}
                      />
                      {errs.executionGuidance && (
                        <p className="mt-1 text-xs text-red-600">{errs.executionGuidance}</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700">
                        Target Audience *
                      </label>
                      <input
                        type="text"
                        value={tactic.targetAudience}
                        onChange={(e) =>
                          onUpdateTactic(tactic.id, { targetAudience: e.target.value })
                        }
                        className={fieldClass(Boolean(errs.targetAudience))}
                      />
                      {errs.targetAudience && (
                        <p className="mt-1 text-xs text-red-600">{errs.targetAudience}</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700">
                        Suggested Frequency *
                      </label>
                      <input
                        type="text"
                        value={tactic.suggestedFrequency}
                        onChange={(e) =>
                          onUpdateTactic(tactic.id, { suggestedFrequency: e.target.value })
                        }
                        className={fieldClass(Boolean(errs.suggestedFrequency))}
                      />
                      {errs.suggestedFrequency && (
                        <p className="mt-1 text-xs text-red-600">{errs.suggestedFrequency}</p>
                      )}
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold text-slate-700">
                        Success Metric *
                      </label>
                      <input
                        type="text"
                        value={tactic.successMetric}
                        onChange={(e) =>
                          onUpdateTactic(tactic.id, { successMetric: e.target.value })
                        }
                        className={fieldClass(Boolean(errs.successMetric))}
                      />
                      {errs.successMetric && (
                        <p className="mt-1 text-xs text-red-600">{errs.successMetric}</p>
                      )}
                    </div>
                  </div>
                ) : (
                  <dl className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-2">
                    <div>
                      <dt className="font-medium text-slate-500">Objective & Channel</dt>
                      <dd className="mt-0.5 text-slate-800">
                        {linkedObj?.title || tactic.supportingObjectiveTitle || '—'} ·{' '}
                        <span className="font-medium">
                          {linkedChan?.channelName || tactic.recommendedChannelName || '—'}
                        </span>
                      </dd>
                    </div>
                    <div>
                      <dt className="font-medium text-slate-500">Audience & Cadence</dt>
                      <dd className="mt-0.5 text-slate-800">
                        {tactic.targetAudience || '—'} · {tactic.suggestedFrequency || '—'}
                      </dd>
                    </div>
                    <div className="sm:col-span-2">
                      <dt className="font-medium text-slate-500">Execution Guidance</dt>
                      <dd className="mt-0.5 leading-relaxed text-slate-800">
                        {tactic.executionGuidance || '—'}
                      </dd>
                    </div>
                    <div className="sm:col-span-2">
                      <dt className="font-medium text-slate-500">Success Metric</dt>
                      <dd className="mt-0.5 text-slate-800">{tactic.successMetric || '—'}</dd>
                    </div>
                  </dl>
                )}
              </article>
            );
          })}
        </div>
      )}

      <div className="flex items-center justify-between border-t border-slate-100 pt-4">
        <button
          type="button"
          onClick={onPrev}
          className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Back: Channels</span>
        </button>
        <button
          type="button"
          onClick={onNext}
          className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
        >
          <span>Next: KPIs & Measurement</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </section>
  );
}

// ============================================================================
// 05. KPIs & MEASUREMENT PANEL
// ============================================================================

export function KpisPanel({
  state,
  generating,
  canGenerate,
  disabledReason,
  editingIds,
  errorsMap,
  onToggleEdit,
  onGenerate,
  onAddManual,
  onAdoptSuggestion,
  onDismissSuggestion,
  onUpdateKpi,
  onApproveKpi,
  onUnapproveKpi,
  onRequestDeleteKpi,
  onPrev,
  onNext,
}: {
  state: MarketingStrategyState;
  generating: boolean;
  canGenerate: boolean;
  disabledReason: string | null;
  editingIds: Record<string, boolean>;
  errorsMap: Record<string, Record<string, string>>;
  onToggleEdit: (id: string, editing: boolean) => void;
  onGenerate: () => void;
  onAddManual: () => void;
  onAdoptSuggestion: (suggestionId: string) => void;
  onDismissSuggestion: (suggestionId: string) => void;
  onUpdateKpi: (id: string, patch: Partial<MarketingKpiItem>) => void;
  onApproveKpi: (item: MarketingKpiItem) => void;
  onUnapproveKpi: (id: string) => void;
  onRequestDeleteKpi: (item: MarketingKpiItem) => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  const pendingSuggestions = state.aiSuggestedKpis.filter(
    (s) => s.suggestionStatus === 'pending_review',
  );

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6 space-y-6">
      <SectionActionHeader
        title="05. KPIs & Measurement"
        subtitle="Define balanced leading and lagging KPIs with measurement methods, cadences, and honest baseline notes — never fabricating historical benchmarks."
        generateLabel="Generate AI KPIs"
        regenerateLabel="Regenerate AI KPIs"
        generatingLabel="Generating KPIs..."
        hasGenerated={Boolean(state.kpisSynthesis.generatedAt)}
        generating={generating}
        generateDisabled={!canGenerate}
        generateDisabledReason={disabledReason}
        addLabel="Add KPI Manually"
        onGenerate={onGenerate}
        onAddManual={onAddManual}
      />

      {!canGenerate && disabledReason && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
          {disabledReason}
        </div>
      )}

      <AiRunContextBanner run={state.kpisSynthesis} label="AI KPIs & Measurement Synthesis" />

      {pendingSuggestions.length > 0 && (
        <div className="space-y-3 rounded-xl border border-blue-200 bg-blue-50/40 p-4">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-blue-900">
            AI Recommended KPIs ({pendingSuggestions.length} pending review)
          </h4>
          <div className="space-y-3">
            {pendingSuggestions.map((s: AiSuggestedKpiItem) => (
              <div
                key={s.id}
                data-testid="ai-kpi-suggestion-card"
                className="rounded-lg border border-blue-200/80 bg-white p-4 space-y-2"
              >
                <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-start">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h5 className="text-sm font-semibold text-slate-900">{s.kpiName}</h5>
                      <span
                        className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold capitalize ${
                          s.classification === 'leading'
                            ? 'border-blue-200 bg-blue-50 text-blue-700'
                            : 'border-slate-300 bg-slate-100 text-slate-800'
                        }`}
                      >
                        {s.classification}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-600">{s.description}</p>
                    <p className="mt-1 text-[11px] text-slate-500">
                      Method: {s.measurementMethod} · Reporting: {s.reportingFrequency} · Baseline:{' '}
                      {s.baselineNote}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => onAdoptSuggestion(s.id)}
                      className="inline-flex min-h-[34px] items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
                    >
                      <Check className="h-3.5 w-3.5" />
                      <span>Adopt as Draft</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onDismissSuggestion(s.id)}
                      className="inline-flex min-h-[34px] items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                    >
                      <X className="h-3.5 w-3.5" />
                      <span>Dismiss</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {state.kpis.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-8 text-center">
          <p className="text-sm font-medium text-slate-800">No KPIs defined yet</p>
          <p className="mt-1 text-xs text-slate-500">
            Approve at least one channel and tactic, then generate AI KPI proposals or add KPIs manually.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {state.kpis.map((kpi) => {
            const isEditing = editingIds[kpi.id] === true;
            const errs = errorsMap[kpi.id] ?? {};
            const linkedObj = state.objectives.find((o) => o.id === kpi.relatedObjectiveId);
            return (
              <article
                key={kpi.id}
                data-testid="marketing-kpi-card"
                className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 space-y-4"
              >
                <div className="flex flex-col justify-between gap-3 border-b border-slate-100 pb-3 sm:flex-row sm:items-start">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="text-sm font-semibold text-slate-900">
                        {kpi.kpiName || 'Untitled KPI'}
                      </h4>
                      <span
                        className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold capitalize ${
                          kpi.classification === 'leading'
                            ? 'border-blue-200 bg-blue-50 text-blue-700'
                            : 'border-slate-300 bg-slate-100 text-slate-800'
                        }`}
                      >
                        {kpi.classification}
                      </span>
                      <ApprovalBadge approved={kpi.approved} />
                    </div>
                    {!isEditing && kpi.description && (
                      <p className="mt-1 text-xs text-slate-600">{kpi.description}</p>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => onToggleEdit(kpi.id, !isEditing)}
                      className="inline-flex min-h-[34px] items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                      <span>{isEditing ? 'Done Editing' : 'Edit'}</span>
                    </button>
                    {kpi.approved ? (
                      <button
                        type="button"
                        onClick={() => onUnapproveKpi(kpi.id)}
                        className="inline-flex min-h-[34px] items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs font-medium text-amber-800 hover:bg-amber-100"
                      >
                        Move to Draft
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onApproveKpi(kpi)}
                        className="inline-flex min-h-[34px] items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
                      >
                        <Check className="h-3.5 w-3.5" />
                        <span>Approve KPI</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => onRequestDeleteKpi(kpi)}
                      aria-label={`Delete KPI ${kpi.kpiName || 'Untitled'}`}
                      className="inline-flex min-h-[34px] items-center rounded-lg border border-red-200 bg-white px-2.5 py-1.5 text-xs text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {isEditing ? (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700">
                        KPI Name *
                      </label>
                      <input
                        type="text"
                        value={kpi.kpiName}
                        onChange={(e) => onUpdateKpi(kpi.id, { kpiName: e.target.value })}
                        className={fieldClass(Boolean(errs.kpiName))}
                      />
                      {errs.kpiName && <p className="mt-1 text-xs text-red-600">{errs.kpiName}</p>}
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700">
                        Classification *
                      </label>
                      <select
                        value={kpi.classification}
                        onChange={(e) =>
                          onUpdateKpi(kpi.id, {
                            classification: e.target.value as KpiClassification,
                          })
                        }
                        className={fieldClass(Boolean(errs.classification))}
                      >
                        <option value="leading">Leading Indicator</option>
                        <option value="lagging">Lagging Indicator</option>
                      </select>
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold text-slate-700">
                        Related Objective *
                      </label>
                      <select
                        value={kpi.relatedObjectiveId}
                        onChange={(e) => {
                          const selected = state.objectives.find((o) => o.id === e.target.value);
                          onUpdateKpi(kpi.id, {
                            relatedObjectiveId: e.target.value,
                            relatedObjectiveTitle: selected?.title ?? '',
                          });
                        }}
                        className={fieldClass(Boolean(errs.relatedObjectiveId))}
                      >
                        <option value="">Select objective...</option>
                        {state.objectives.map((o) => (
                          <option key={o.id} value={o.id}>
                            {o.title || 'Untitled Objective'}
                          </option>
                        ))}
                      </select>
                      {errs.relatedObjectiveId && (
                        <p className="mt-1 text-xs text-red-600">{errs.relatedObjectiveId}</p>
                      )}
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold text-slate-700">
                        Description *
                      </label>
                      <textarea
                        rows={2}
                        value={kpi.description}
                        onChange={(e) => onUpdateKpi(kpi.id, { description: e.target.value })}
                        className={fieldClass(Boolean(errs.description))}
                      />
                      {errs.description && (
                        <p className="mt-1 text-xs text-red-600">{errs.description}</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700">
                        What It Measures *
                      </label>
                      <input
                        type="text"
                        value={kpi.whatItMeasures}
                        onChange={(e) => onUpdateKpi(kpi.id, { whatItMeasures: e.target.value })}
                        className={fieldClass(Boolean(errs.whatItMeasures))}
                      />
                      {errs.whatItMeasures && (
                        <p className="mt-1 text-xs text-red-600">{errs.whatItMeasures}</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700">
                        Measurement Method / Tool *
                      </label>
                      <input
                        type="text"
                        value={kpi.measurementMethod}
                        onChange={(e) =>
                          onUpdateKpi(kpi.id, { measurementMethod: e.target.value })
                        }
                        className={fieldClass(Boolean(errs.measurementMethod))}
                      />
                      {errs.measurementMethod && (
                        <p className="mt-1 text-xs text-red-600">{errs.measurementMethod}</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700">
                        Reporting Frequency *
                      </label>
                      <input
                        type="text"
                        value={kpi.reportingFrequency}
                        onChange={(e) =>
                          onUpdateKpi(kpi.id, { reportingFrequency: e.target.value })
                        }
                        placeholder="e.g., Weekly, Monthly"
                        className={fieldClass(Boolean(errs.reportingFrequency))}
                      />
                      {errs.reportingFrequency && (
                        <p className="mt-1 text-xs text-red-600">{errs.reportingFrequency}</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700">
                        Baseline Note *
                      </label>
                      <input
                        type="text"
                        value={kpi.baselineNote}
                        onChange={(e) => onUpdateKpi(kpi.id, { baselineNote: e.target.value })}
                        placeholder="Baseline to be established during Month 1"
                        className={fieldClass(Boolean(errs.baselineNote))}
                      />
                      {errs.baselineNote && (
                        <p className="mt-1 text-xs text-red-600">{errs.baselineNote}</p>
                      )}
                    </div>
                  </div>
                ) : (
                  <dl className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-2">
                    <div>
                      <dt className="font-medium text-slate-500">Related Objective</dt>
                      <dd className="mt-0.5 text-slate-800">
                        {linkedObj?.title || kpi.relatedObjectiveTitle || '—'}
                      </dd>
                    </div>
                    <div>
                      <dt className="font-medium text-slate-500">What It Measures</dt>
                      <dd className="mt-0.5 text-slate-800">{kpi.whatItMeasures || '—'}</dd>
                    </div>
                    <div>
                      <dt className="font-medium text-slate-500">Method & Reporting</dt>
                      <dd className="mt-0.5 text-slate-800">
                        {kpi.measurementMethod || '—'} · {kpi.reportingFrequency || '—'}
                      </dd>
                    </div>
                    <div>
                      <dt className="font-medium text-slate-500">Baseline Status</dt>
                      <dd className="mt-0.5 text-slate-800">{kpi.baselineNote || '—'}</dd>
                    </div>
                  </dl>
                )}
              </article>
            );
          })}
        </div>
      )}

      <div className="flex items-center justify-between border-t border-slate-100 pt-4">
        <button
          type="button"
          onClick={onPrev}
          className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Back: Tactics</span>
        </button>
        <button
          type="button"
          onClick={onNext}
          className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
        >
          <span>Next: Implementation Roadmap</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </section>
  );
}

// ============================================================================
// 06. IMPLEMENTATION ROADMAP PANEL
// ============================================================================

export function RoadmapPanel({
  state,
  generating,
  canGenerate,
  disabledReason,
  editingIds,
  errorsMap,
  onToggleEdit,
  onGenerate,
  onAddManual,
  onAdoptSuggestion,
  onDismissSuggestion,
  onUpdateRoadmap,
  onApproveRoadmap,
  onUnapproveRoadmap,
  onRequestDeleteRoadmap,
  onPrev,
  onNext,
}: {
  state: MarketingStrategyState;
  generating: boolean;
  canGenerate: boolean;
  disabledReason: string | null;
  editingIds: Record<string, boolean>;
  errorsMap: Record<string, Record<string, string>>;
  onToggleEdit: (id: string, editing: boolean) => void;
  onGenerate: () => void;
  onAddManual: () => void;
  onAdoptSuggestion: (suggestionId: string) => void;
  onDismissSuggestion: (suggestionId: string) => void;
  onUpdateRoadmap: (id: string, patch: Partial<ImplementationRoadmapItem>) => void;
  onApproveRoadmap: (item: ImplementationRoadmapItem) => void;
  onUnapproveRoadmap: (id: string) => void;
  onRequestDeleteRoadmap: (item: ImplementationRoadmapItem) => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  const pendingSuggestions = state.aiSuggestedRoadmapItems.filter(
    (s) => s.suggestionStatus === 'pending_review',
  );

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6 space-y-6">
      <SectionActionHeader
        title="06. Implementation Roadmap"
        subtitle="Sequence approved objectives, channels, and tactics into practical phases with relative timeframes, dependencies, and explicit owner decision flags."
        generateLabel="Generate AI Roadmap"
        regenerateLabel="Regenerate AI Roadmap"
        generatingLabel="Generating Roadmap..."
        hasGenerated={Boolean(state.roadmapSynthesis.generatedAt)}
        generating={generating}
        generateDisabled={!canGenerate}
        generateDisabledReason={disabledReason}
        addLabel="Add Activity Manually"
        onGenerate={onGenerate}
        onAddManual={onAddManual}
      />

      {!canGenerate && disabledReason && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
          {disabledReason}
        </div>
      )}

      <AiRunContextBanner
        run={state.roadmapSynthesis}
        label="AI Implementation Roadmap Synthesis"
      />

      {pendingSuggestions.length > 0 && (
        <div className="space-y-3 rounded-xl border border-blue-200 bg-blue-50/40 p-4">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-blue-900">
            AI Recommended Roadmap Activities ({pendingSuggestions.length} pending review)
          </h4>
          <div className="space-y-3">
            {pendingSuggestions.map((s: AiSuggestedRoadmapItem) => (
              <div
                key={s.id}
                data-testid="ai-roadmap-suggestion-card"
                className="rounded-lg border border-blue-200/80 bg-white p-4 space-y-2"
              >
                <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-start">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-[11px] font-semibold text-blue-700">
                        {s.phase}
                      </span>
                      <PriorityBadge value={s.priority} />
                    </div>
                    <h5 className="mt-0.5 text-sm font-semibold text-slate-900">{s.activity}</h5>
                    <p className="mt-1 text-xs text-slate-600">{s.description}</p>
                    <p className="mt-1 text-[11px] text-slate-500">
                      Window: {s.suggestedTimeframe} · Channel: {s.channel}
                    </p>
                    {s.decisionInputNeeded && (
                      <p className="mt-1 text-[11px] font-medium text-amber-800">
                        Owner input needed: {s.decisionInputNeeded}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => onAdoptSuggestion(s.id)}
                      className="inline-flex min-h-[34px] items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
                    >
                      <Check className="h-3.5 w-3.5" />
                      <span>Adopt as Draft</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onDismissSuggestion(s.id)}
                      className="inline-flex min-h-[34px] items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                    >
                      <X className="h-3.5 w-3.5" />
                      <span>Dismiss</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {state.roadmapItems.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-8 text-center">
          <p className="text-sm font-medium text-slate-800">No roadmap activities yet</p>
          <p className="mt-1 text-xs text-slate-500">
            Generate a phased AI roadmap from your approved channels and tactics, or add activities manually.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {state.roadmapItems.map((item) => {
            const isEditing = editingIds[item.id] === true;
            const errs = errorsMap[item.id] ?? {};
            const linkedObj = state.objectives.find((o) => o.id === item.supportingObjectiveId);
            return (
              <article
                key={item.id}
                data-testid="marketing-roadmap-card"
                className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 space-y-4"
              >
                <div className="flex flex-col justify-between gap-3 border-b border-slate-100 pb-3 sm:flex-row sm:items-start">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-[11px] font-semibold text-slate-700">
                        {item.phase || 'Unassigned Phase'}
                      </span>
                      <PriorityBadge value={item.priority} />
                      <ApprovalBadge approved={item.approved} />
                    </div>
                    <h4 className="mt-1.5 text-sm font-semibold text-slate-900">
                      {item.activity || 'Untitled Roadmap Activity'}
                    </h4>
                    {!isEditing && item.description && (
                      <p className="mt-1 text-xs text-slate-600">{item.description}</p>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => onToggleEdit(item.id, !isEditing)}
                      className="inline-flex min-h-[34px] items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                      <span>{isEditing ? 'Done Editing' : 'Edit'}</span>
                    </button>
                    {item.approved ? (
                      <button
                        type="button"
                        onClick={() => onUnapproveRoadmap(item.id)}
                        className="inline-flex min-h-[34px] items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs font-medium text-amber-800 hover:bg-amber-100"
                      >
                        Move to Draft
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onApproveRoadmap(item)}
                        className="inline-flex min-h-[34px] items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
                      >
                        <Check className="h-3.5 w-3.5" />
                        <span>Approve Activity</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => onRequestDeleteRoadmap(item)}
                      aria-label={`Delete roadmap activity ${item.activity || 'Untitled'}`}
                      className="inline-flex min-h-[34px] items-center rounded-lg border border-red-200 bg-white px-2.5 py-1.5 text-xs text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {isEditing ? (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700">Phase *</label>
                      <input
                        type="text"
                        value={item.phase}
                        onChange={(e) => onUpdateRoadmap(item.id, { phase: e.target.value })}
                        placeholder="Phase 1: Foundation & Setup"
                        className={fieldClass(Boolean(errs.phase))}
                      />
                      {errs.phase && <p className="mt-1 text-xs text-red-600">{errs.phase}</p>}
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700">
                        Priority *
                      </label>
                      <select
                        value={item.priority}
                        onChange={(e) =>
                          onUpdateRoadmap(item.id, {
                            priority: e.target.value as StrategyPriority,
                          })
                        }
                        className={fieldClass(false)}
                      >
                        <option value="high">High</option>
                        <option value="medium">Medium</option>
                        <option value="low">Low</option>
                      </select>
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold text-slate-700">
                        Activity Title *
                      </label>
                      <input
                        type="text"
                        value={item.activity}
                        onChange={(e) => onUpdateRoadmap(item.id, { activity: e.target.value })}
                        className={fieldClass(Boolean(errs.activity))}
                      />
                      {errs.activity && (
                        <p className="mt-1 text-xs text-red-600">{errs.activity}</p>
                      )}
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold text-slate-700">
                        Supporting Objective *
                      </label>
                      <select
                        value={item.supportingObjectiveId}
                        onChange={(e) => {
                          const selected = state.objectives.find((o) => o.id === e.target.value);
                          onUpdateRoadmap(item.id, {
                            supportingObjectiveId: e.target.value,
                            supportingObjectiveTitle: selected?.title ?? '',
                          });
                        }}
                        className={fieldClass(Boolean(errs.supportingObjectiveId))}
                      >
                        <option value="">Select objective...</option>
                        {state.objectives.map((o) => (
                          <option key={o.id} value={o.id}>
                            {o.title || 'Untitled Objective'}
                          </option>
                        ))}
                      </select>
                      {errs.supportingObjectiveId && (
                        <p className="mt-1 text-xs text-red-600">{errs.supportingObjectiveId}</p>
                      )}
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold text-slate-700">
                        Description *
                      </label>
                      <textarea
                        rows={2}
                        value={item.description}
                        onChange={(e) => onUpdateRoadmap(item.id, { description: e.target.value })}
                        className={fieldClass(Boolean(errs.description))}
                      />
                      {errs.description && (
                        <p className="mt-1 text-xs text-red-600">{errs.description}</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700">
                        Channel / Operational Focus *
                      </label>
                      <input
                        type="text"
                        value={item.channel}
                        onChange={(e) => onUpdateRoadmap(item.id, { channel: e.target.value })}
                        className={fieldClass(Boolean(errs.channel))}
                      />
                      {errs.channel && <p className="mt-1 text-xs text-red-600">{errs.channel}</p>}
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700">
                        Suggested Timeframe (Relative Window) *
                      </label>
                      <input
                        type="text"
                        value={item.suggestedTimeframe}
                        onChange={(e) =>
                          onUpdateRoadmap(item.id, { suggestedTimeframe: e.target.value })
                        }
                        placeholder="e.g., Weeks 1–3"
                        className={fieldClass(Boolean(errs.suggestedTimeframe))}
                      />
                      {errs.suggestedTimeframe && (
                        <p className="mt-1 text-xs text-red-600">{errs.suggestedTimeframe}</p>
                      )}
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold text-slate-700">
                        Dependencies (one per line)
                      </label>
                      <textarea
                        rows={2}
                        value={item.dependencies.join('\n')}
                        onChange={(e) =>
                          onUpdateRoadmap(item.id, { dependencies: linesToArray(e.target.value) })
                        }
                        className={fieldClass(false)}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700">
                        Success Indicator *
                      </label>
                      <input
                        type="text"
                        value={item.successIndicator}
                        onChange={(e) =>
                          onUpdateRoadmap(item.id, { successIndicator: e.target.value })
                        }
                        className={fieldClass(Boolean(errs.successIndicator))}
                      />
                      {errs.successIndicator && (
                        <p className="mt-1 text-xs text-red-600">{errs.successIndicator}</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700">
                        Owner Decision / Input Needed (Optional)
                      </label>
                      <input
                        type="text"
                        value={item.decisionInputNeeded}
                        onChange={(e) =>
                          onUpdateRoadmap(item.id, { decisionInputNeeded: e.target.value })
                        }
                        placeholder="e.g., Confirm owner capacity or budget"
                        className={fieldClass(false)}
                      />
                    </div>
                  </div>
                ) : (
                  <dl className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-2">
                    <div>
                      <dt className="font-medium text-slate-500">Objective & Channel</dt>
                      <dd className="mt-0.5 text-slate-800">
                        {linkedObj?.title || item.supportingObjectiveTitle || '—'} ·{' '}
                        {item.channel || '—'}
                      </dd>
                    </div>
                    <div>
                      <dt className="font-medium text-slate-500">Timeframe</dt>
                      <dd className="mt-0.5 text-slate-800">{item.suggestedTimeframe || '—'}</dd>
                    </div>
                    <div>
                      <dt className="font-medium text-slate-500">Success Indicator</dt>
                      <dd className="mt-0.5 text-slate-800">{item.successIndicator || '—'}</dd>
                    </div>
                    <div>
                      <dt className="font-medium text-slate-500">Dependencies</dt>
                      <dd className="mt-0.5 text-slate-800">
                        {item.dependencies.length > 0 ? item.dependencies.join(' · ') : 'None'}
                      </dd>
                    </div>
                    {item.decisionInputNeeded && (
                      <div className="sm:col-span-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-amber-900">
                        <span className="font-semibold">Decision Input Needed: </span>
                        {item.decisionInputNeeded}
                      </div>
                    )}
                  </dl>
                )}
              </article>
            );
          })}
        </div>
      )}

      <div className="flex items-center justify-between border-t border-slate-100 pt-4">
        <button
          type="button"
          onClick={onPrev}
          className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Back: KPIs</span>
        </button>
        <button
          type="button"
          onClick={onNext}
          className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
        >
          <span>Next: Review & Complete</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </section>
  );
}

// ============================================================================
// 07. REVIEW & COMPLETE PANEL
// ============================================================================

export function ReviewCompletePanel({
  brandName,
  state,
  moduleStatus,
  progress,
  completionCheck,
  saving,
  onJumpToSection,
  onCompleteModule,
  onPrev,
}: {
  brandName: string;
  state: MarketingStrategyState;
  moduleStatus: ModuleStatus;
  progress: MarketingStrategyProgressSummary;
  completionCheck: {
    allowed: boolean;
    blockers: string[];
    incompleteSections: MarketingStrategySectionKey[];
  };
  saving: boolean;
  onJumpToSection: (step: MarketingStrategyStepKey) => void;
  onCompleteModule: () => void;
  onPrev: () => void;
}) {
  const gaps = collectOutstandingInformationGaps(state);
  const hasGaps =
    gaps.missingContextNotes.length > 0 ||
    gaps.roadmapDecisionsNeeded.length > 0 ||
    gaps.baselinesToEstablish.length > 0;

  const approvedGoals = state.goals.filter((g) => g.approved);
  const approvedObjectives = state.objectives.filter((o) => o.approved);
  const approvedChannels = state.channels.filter((c) => c.approved);
  const approvedTactics = state.tactics.filter((t) => t.approved);
  const approvedKpis = state.kpis.filter((k) => k.approved);
  const approvedRoadmap = state.roadmapItems.filter((r) => r.approved);

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6 space-y-6">
      <div className="flex flex-col justify-between gap-4 border-b border-slate-100 pb-4 sm:flex-row sm:items-center">
        <div>
          <h3 className="text-base font-semibold text-slate-900">
            07. Consolidated Marketing Strategy Review
          </h3>
          <p className="mt-0.5 text-xs text-slate-500">
            Verify all six approved strategy sections for {brandName} and review open information gaps before marking completed.
          </p>
        </div>

        <button
          type="button"
          data-testid="complete-marketing-strategy-btn"
          onClick={onCompleteModule}
          disabled={!completionCheck.allowed || saving}
          className="inline-flex min-h-[42px] shrink-0 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50 whitespace-nowrap"
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ClipboardCheck className="h-4 w-4" />
          )}
          <span>
            {moduleStatus === 'completed'
              ? 'Update Completed Strategy'
              : 'Mark Marketing Strategy Completed'}
          </span>
        </button>
      </div>

      {!completionCheck.allowed && (
        <div
          data-testid="marketing-strategy-completion-blockers"
          className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-950 space-y-2"
        >
          <div className="flex items-center gap-2 font-semibold">
            <AlertTriangle className="h-4 w-4 text-amber-700 shrink-0" />
            <span>Action required before marking Marketing Strategy completed:</span>
          </div>
          <ul className="list-disc space-y-1 pl-5 text-amber-900">
            {completionCheck.blockers.map((blocker, idx) => (
              <li key={idx}>{blocker}</li>
            ))}
          </ul>
        </div>
      )}

      {/* 6-Section Approval Matrix */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {MARKETING_STRATEGY_SECTIONS.map((sec) => {
          const approvedCount = progress.approvedCounts[sec.key];
          const totalCount = progress.totalCounts[sec.key];
          const isReady = progress.sectionStatuses[sec.key] === 'approved';
          return (
            <div
              key={sec.key}
              className="flex flex-col justify-between rounded-xl border border-slate-200 bg-slate-50/40 p-4"
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[11px] font-medium text-slate-400">
                    {sec.number}
                  </span>
                  {isReady ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Ready
                    </span>
                  ) : (
                    <span className="text-[11px] font-semibold text-amber-700">Needs approval</span>
                  )}
                </div>
                <h4 className="mt-1 text-sm font-semibold text-slate-900">{sec.title}</h4>
                <p className="mt-1 font-mono text-xs text-slate-600 tabular-nums">
                  {approvedCount} approved / {totalCount} total
                </p>
              </div>
              <button
                type="button"
                onClick={() => onJumpToSection(sec.key)}
                className="mt-3 self-start text-xs font-semibold text-blue-600 hover:text-blue-700"
              >
                Edit {sec.shortTitle} →
              </button>
            </div>
          );
        })}
      </div>

      {/* Approved Strategy Snapshot */}
      <div className="space-y-4">
        <div className="rounded-xl border border-slate-200 p-4 space-y-2">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Approved SMART Goals ({approvedGoals.length})
          </h4>
          {approvedGoals.length === 0 ? (
            <p className="text-xs text-slate-500">No approved goals yet.</p>
          ) : (
            <ul className="space-y-1.5 text-xs text-slate-800">
              {approvedGoals.map((g) => (
                <li key={g.id}>
                  <span className="font-semibold">{g.title}</span> — {g.targetValue} (
                  {g.recommendedTimeframe})
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-slate-200 p-4 space-y-2">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Approved Objectives ({approvedObjectives.length})
            </h4>
            {approvedObjectives.length === 0 ? (
              <p className="text-xs text-slate-500">No approved objectives yet.</p>
            ) : (
              <ul className="space-y-1.5 text-xs text-slate-800">
                {approvedObjectives.map((o) => (
                  <li key={o.id}>
                    <span className="font-semibold">{o.title}</span> ({o.priority})
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-xl border border-slate-200 p-4 space-y-2">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Approved Channels ({approvedChannels.length})
            </h4>
            {approvedChannels.length === 0 ? (
              <p className="text-xs text-slate-500">No approved channels yet.</p>
            ) : (
              <ul className="space-y-1.5 text-xs text-slate-800">
                {approvedChannels.map((c) => (
                  <li key={c.id}>
                    <span className="font-semibold">{c.channelName}</span> ({c.priority}) —{' '}
                    {c.relevantAudience}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-slate-200 p-4 space-y-2">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Approved Tactics ({approvedTactics.length})
            </h4>
            {approvedTactics.length === 0 ? (
              <p className="text-xs text-slate-500">No approved tactics yet.</p>
            ) : (
              <ul className="space-y-1.5 text-xs text-slate-800">
                {approvedTactics.map((t) => (
                  <li key={t.id}>
                    <span className="font-semibold">{t.tacticName}</span> ({t.suggestedFrequency})
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-xl border border-slate-200 p-4 space-y-2">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Approved KPIs ({approvedKpis.length})
            </h4>
            {approvedKpis.length === 0 ? (
              <p className="text-xs text-slate-500">No approved KPIs yet.</p>
            ) : (
              <ul className="space-y-1.5 text-xs text-slate-800">
                {approvedKpis.map((k) => (
                  <li key={k.id}>
                    <span className="font-semibold">{k.kpiName}</span> ({k.classification},{' '}
                    {k.reportingFrequency})
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 p-4 space-y-2">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Approved Implementation Roadmap ({approvedRoadmap.length})
          </h4>
          {approvedRoadmap.length === 0 ? (
            <p className="text-xs text-slate-500">No approved roadmap items yet.</p>
          ) : (
            <ul className="space-y-1.5 text-xs text-slate-800">
              {approvedRoadmap.map((r) => (
                <li key={r.id}>
                  <span className="font-mono font-semibold text-slate-600">{r.phase}:</span>{' '}
                  <span className="font-semibold">{r.activity}</span> ({r.suggestedTimeframe})
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Outstanding Information Gaps */}
      <div
        data-testid="marketing-strategy-information-gaps"
        className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-3"
      >
        <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-700">
          Outstanding Information Gaps & Owner Confirmations
        </h4>
        {!hasGaps ? (
          <p className="text-xs text-slate-600">
            No unresolved context gaps or pending roadmap owner decisions flagged.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-4 text-xs sm:grid-cols-3">
            <div>
              <p className="font-semibold text-slate-800">
                Context Gaps ({gaps.missingContextNotes.length})
              </p>
              {gaps.missingContextNotes.length > 0 ? (
                <ul className="mt-1 list-disc space-y-1 pl-4 text-slate-600">
                  {gaps.missingContextNotes.map((n, idx) => (
                    <li key={idx}>{n}</li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1 text-slate-500">None flagged.</p>
              )}
            </div>
            <div>
              <p className="font-semibold text-slate-800">
                KPI Baselines to Establish ({gaps.baselinesToEstablish.length})
              </p>
              {gaps.baselinesToEstablish.length > 0 ? (
                <ul className="mt-1 list-disc space-y-1 pl-4 text-slate-600">
                  {gaps.baselinesToEstablish.map((b, idx) => (
                    <li key={idx}>
                      <span className="font-medium text-slate-800">{b.kpiName}:</span>{' '}
                      {b.baselineNote}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1 text-slate-500">All KPIs have baseline context.</p>
              )}
            </div>
            <div>
              <p className="font-semibold text-slate-800">
                Roadmap Decisions Needed ({gaps.roadmapDecisionsNeeded.length})
              </p>
              {gaps.roadmapDecisionsNeeded.length > 0 ? (
                <ul className="mt-1 list-disc space-y-1 pl-4 text-amber-900">
                  {gaps.roadmapDecisionsNeeded.map((d, idx) => (
                    <li key={idx}>
                      <span className="font-medium">{d.activity}:</span> {d.decision}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1 text-slate-500">No open roadmap decisions.</p>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between border-t border-slate-100 pt-4">
        <button
          type="button"
          onClick={onPrev}
          className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Back: Implementation Roadmap</span>
        </button>
      </div>
    </section>
  );
}
