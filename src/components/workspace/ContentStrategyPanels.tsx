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
import type {
  MarketingChannelItem,
  MarketingObjectiveItem,
  SmartMarketingGoalItem,
} from '../../utils/marketingStrategyLogic';
import {
  CONTENT_STRATEGY_SECTIONS,
  type AiSuggestedContentFormatItem,
  type AiSuggestedContentGovernanceStandardItem,
  type AiSuggestedContentObjectiveItem,
  type AiSuggestedContentPillarItem,
  type AiSuggestedContentSeriesItem,
  type AiSuggestedContentThemeTopicItem,
  type AiSuggestedDistributionApproachItem,
  type ContentAiRunState,
  type ContentFormatItem,
  type ContentGovernanceStandardItem,
  type ContentObjectiveItem,
  type ContentObjectiveLevel,
  type ContentPillarItem,
  type ContentSeriesItem,
  type ContentStrategyProgressSummary,
  type ContentStrategyState,
  type ContentStrategyStepKey,
  type ContentThemeTopicItem,
  type DistributionApproachItem,
  type GovernanceCategory,
} from '../../utils/contentStrategyLogic';

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

const GOVERNANCE_CATEGORY_LABELS: Record<GovernanceCategory, string> = {
  quality_standard: 'Quality Standard',
  voice_and_messaging: 'Voice & Messaging',
  editorial_workflow: 'Editorial Workflow',
  performance_measurement: 'Performance Measurement',
};

export function ContentAiRunContextBanner({
  run,
  label,
}: {
  run: ContentAiRunState;
  label: string;
}) {
  if (!run.generatedAt) return null;
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-4 text-xs space-y-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/70 pb-2">
        <span className="font-semibold text-slate-800">{label} — Grounding Summary</span>
        {run.promptId && (
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
            <p className="mt-1 text-slate-500">Grounded in verified workspace strategy.</p>
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

function LevelBadge({ level }: { level: ContentObjectiveLevel }) {
  return level === 'primary' ? (
    <span className="inline-flex items-center rounded-md border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700">
      Primary
    </span>
  ) : (
    <span className="inline-flex items-center rounded-md border border-slate-200 bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700">
      Supporting
    </span>
  );
}

function GovernanceCategoryBadge({ category }: { category: GovernanceCategory }) {
  const styles: Record<GovernanceCategory, string> = {
    quality_standard: 'border-blue-200 bg-blue-50 text-blue-700',
    voice_and_messaging: 'border-indigo-200 bg-indigo-50 text-indigo-700',
    editorial_workflow: 'border-amber-200 bg-amber-50 text-amber-800',
    performance_measurement: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  };
  return (
    <span
      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold ${styles[category]}`}
    >
      {GOVERNANCE_CATEGORY_LABELS[category]}
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
  secondaryAddLabel,
  onGenerate,
  onAddManual,
  onSecondaryAddManual,
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
  secondaryAddLabel?: string;
  onGenerate: () => void;
  onAddManual: () => void;
  onSecondaryAddManual?: () => void;
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
        {secondaryAddLabel && onSecondaryAddManual && (
          <button
            type="button"
            onClick={onSecondaryAddManual}
            className="inline-flex min-h-[42px] items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 whitespace-nowrap"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>{secondaryAddLabel}</span>
          </button>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// 01. CONTENT OBJECTIVES PANEL
// ============================================================================

export function ContentObjectivesPanel({
  state,
  approvedMarketingGoals,
  approvedMarketingObjectives,
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
  onNext,
}: {
  state: ContentStrategyState;
  approvedMarketingGoals: SmartMarketingGoalItem[];
  approvedMarketingObjectives: MarketingObjectiveItem[];
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
  onUpdateObjective: (id: string, patch: Partial<ContentObjectiveItem>) => void;
  onApproveObjective: (item: ContentObjectiveItem) => void;
  onUnapproveObjective: (id: string) => void;
  onRequestDeleteObjective: (item: ContentObjectiveItem) => void;
  onNext: () => void;
}) {
  const pendingSuggestions = state.aiSuggestedObjectives.filter(
    (s) => s.suggestionStatus === 'pending_review',
  );

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6 space-y-6">
      <SectionActionHeader
        title="01. Content Objectives"
        subtitle="Define primary and supporting content goals, target audience outcomes, and desired audience actions aligned with approved marketing goals."
        generateLabel="Generate AI Objectives"
        regenerateLabel="Regenerate AI Objectives"
        generatingLabel="Generating Objectives..."
        hasGenerated={Boolean(state.objectivesSynthesis.generatedAt)}
        generating={generating}
        generateDisabled={!canGenerate}
        generateDisabledReason={disabledReason}
        addLabel="Add Objective Manually"
        onGenerate={onGenerate}
        onAddManual={onAddManual}
      />

      <ContentAiRunContextBanner
        run={state.objectivesSynthesis}
        label="AI Content Objectives Synthesis"
      />

      {pendingSuggestions.length > 0 && (
        <div className="space-y-3 rounded-xl border border-blue-200 bg-blue-50/40 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-blue-900">
              AI Recommended Content Objectives ({pendingSuggestions.length} pending review)
            </h4>
            <span className="text-[11px] text-blue-700">
              Adopt to edit &amp; approve; never auto-approved
            </span>
          </div>
          <div className="space-y-3">
            {pendingSuggestions.map((s: AiSuggestedContentObjectiveItem) => (
              <div
                key={s.id}
                data-testid="ai-content-objective-suggestion-card"
                className="rounded-lg border border-blue-200/80 bg-white p-4 space-y-2.5"
              >
                <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-start">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h5 className="text-sm font-semibold text-slate-900">{s.title}</h5>
                      <LevelBadge level={s.level} />
                    </div>
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
                    <dt className="font-medium text-slate-500">Audience Outcomes</dt>
                    <dd className="text-slate-800">
                      {s.targetAudienceOutcomes.join(' · ') || '—'}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-medium text-slate-500">Desired Actions</dt>
                    <dd className="text-slate-800">
                      {s.desiredAudienceActions.join(' · ') || '—'}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-medium text-slate-500">Marketing Alignment</dt>
                    <dd className="text-slate-800">
                      {s.alignedMarketingObjectiveTitle || s.alignedMarketingGoalTitle || '—'}
                    </dd>
                  </div>
                </dl>
              </div>
            ))}
          </div>
        </div>
      )}

      {state.objectives.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-8 text-center">
          <p className="text-sm font-medium text-slate-800">No content objectives yet</p>
          <p className="mt-1 text-xs text-slate-500">
            Generate AI content objectives grounded in your approved Marketing Strategy, or add one manually.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {state.objectives.map((obj) => {
            const isEditing = editingIds[obj.id] === true;
            const errs = errorsMap[obj.id] ?? {};
            return (
              <article
                key={obj.id}
                data-testid="content-objective-card"
                className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 space-y-4"
              >
                <div className="flex flex-col justify-between gap-3 border-b border-slate-100 pb-3 sm:flex-row sm:items-start">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="text-sm font-semibold text-slate-900">
                        {obj.title || 'Untitled Content Objective'}
                      </h4>
                      <LevelBadge level={obj.level} />
                      <ApprovalBadge approved={obj.approved} />
                    </div>
                    {!isEditing && obj.description && (
                      <p className="mt-1 text-xs leading-relaxed text-slate-600">
                        {obj.description}
                      </p>
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
                      aria-label={`Delete content objective ${obj.title || 'Untitled'}`}
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
                        placeholder="e.g., Build Operational Credibility with Series A Leaders"
                        className={fieldClass(Boolean(errs.title))}
                      />
                      {errs.title && <p className="mt-1 text-xs text-red-600">{errs.title}</p>}
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700">
                        Objective Level *
                      </label>
                      <select
                        value={obj.level}
                        onChange={(e) =>
                          onUpdateObjective(obj.id, {
                            level: e.target.value as ContentObjectiveLevel,
                          })
                        }
                        className={fieldClass(false)}
                      >
                        <option value="primary">Primary</option>
                        <option value="supporting">Supporting</option>
                      </select>
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
                        Target Audience Outcomes (one per line) *
                      </label>
                      <textarea
                        rows={2}
                        value={obj.targetAudienceOutcomes.join('\n')}
                        onChange={(e) =>
                          onUpdateObjective(obj.id, {
                            targetAudienceOutcomes: linesToArray(e.target.value),
                          })
                        }
                        placeholder="Understand how workflow audits expose hidden delays"
                        className={fieldClass(Boolean(errs.targetAudienceOutcomes))}
                      />
                      {errs.targetAudienceOutcomes && (
                        <p className="mt-1 text-xs text-red-600">{errs.targetAudienceOutcomes}</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700">
                        Desired Audience Actions (one per line) *
                      </label>
                      <textarea
                        rows={2}
                        value={obj.desiredAudienceActions.join('\n')}
                        onChange={(e) =>
                          onUpdateObjective(obj.id, {
                            desiredAudienceActions: linesToArray(e.target.value),
                          })
                        }
                        placeholder="Subscribe to weekly teardown briefing"
                        className={fieldClass(Boolean(errs.desiredAudienceActions))}
                      />
                      {errs.desiredAudienceActions && (
                        <p className="mt-1 text-xs text-red-600">{errs.desiredAudienceActions}</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700">
                        Aligned Marketing Goal
                      </label>
                      <input
                        type="text"
                        list={`ms-goals-${obj.id}`}
                        value={obj.alignedMarketingGoalTitle}
                        onChange={(e) =>
                          onUpdateObjective(obj.id, {
                            alignedMarketingGoalTitle: e.target.value,
                          })
                        }
                        placeholder="Select or type approved marketing goal"
                        className={fieldClass(false)}
                      />
                      <datalist id={`ms-goals-${obj.id}`}>
                        {approvedMarketingGoals.map((g) => (
                          <option key={g.id} value={g.title} />
                        ))}
                      </datalist>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700">
                        Aligned Marketing Objective *
                      </label>
                      <input
                        type="text"
                        list={`ms-objs-${obj.id}`}
                        value={obj.alignedMarketingObjectiveTitle}
                        onChange={(e) =>
                          onUpdateObjective(obj.id, {
                            alignedMarketingObjectiveTitle: e.target.value,
                          })
                        }
                        placeholder="Select or type approved marketing objective"
                        className={fieldClass(Boolean(errs.alignedMarketingObjectiveTitle))}
                      />
                      <datalist id={`ms-objs-${obj.id}`}>
                        {approvedMarketingObjectives.map((o) => (
                          <option key={o.id} value={o.title} />
                        ))}
                      </datalist>
                      {errs.alignedMarketingObjectiveTitle && (
                        <p className="mt-1 text-xs text-red-600">
                          {errs.alignedMarketingObjectiveTitle}
                        </p>
                      )}
                    </div>
                  </div>
                ) : (
                  <dl className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-2 lg:grid-cols-3">
                    <div>
                      <dt className="font-medium text-slate-500">Target Audience Outcomes</dt>
                      <dd className="mt-0.5 text-slate-800">
                        {obj.targetAudienceOutcomes.join(' · ') || '—'}
                      </dd>
                    </div>
                    <div>
                      <dt className="font-medium text-slate-500">Desired Audience Actions</dt>
                      <dd className="mt-0.5 text-slate-800">
                        {obj.desiredAudienceActions.join(' · ') || '—'}
                      </dd>
                    </div>
                    <div>
                      <dt className="font-medium text-slate-500">Marketing Alignment</dt>
                      <dd className="mt-0.5 text-slate-800">
                        {[obj.alignedMarketingObjectiveTitle, obj.alignedMarketingGoalTitle]
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
          <span>Next: Content Pillars</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </section>
  );
}

// ============================================================================
// 02. CONTENT PILLARS PANEL
// ============================================================================

export function ContentPillarsPanel({
  state,
  approvedMarketingObjectives,
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
  onUpdatePillar,
  onApprovePillar,
  onUnapprovePillar,
  onRequestDeletePillar,
  onPrev,
  onNext,
}: {
  state: ContentStrategyState;
  approvedMarketingObjectives: MarketingObjectiveItem[];
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
  onUpdatePillar: (id: string, patch: Partial<ContentPillarItem>) => void;
  onApprovePillar: (item: ContentPillarItem) => void;
  onUnapprovePillar: (id: string) => void;
  onRequestDeletePillar: (item: ContentPillarItem) => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  const pendingSuggestions = state.aiSuggestedPillars.filter(
    (s) => s.suggestionStatus === 'pending_review',
  );

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6 space-y-6">
      <SectionActionHeader
        title="02. Content Pillars"
        subtitle="Build distinctive, brand-specific editorial pillars grounded in approved positioning, messaging, audience pain points, and marketing objectives. Avoid generic labels."
        generateLabel="Generate AI Pillars"
        regenerateLabel="Regenerate AI Pillars"
        generatingLabel="Generating Pillars..."
        hasGenerated={Boolean(state.pillarsSynthesis.generatedAt)}
        generating={generating}
        generateDisabled={!canGenerate}
        generateDisabledReason={disabledReason}
        addLabel="Add Pillar Manually"
        onGenerate={onGenerate}
        onAddManual={onAddManual}
      />

      {!canGenerate && disabledReason && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
          {disabledReason}
        </div>
      )}

      <ContentAiRunContextBanner
        run={state.pillarsSynthesis}
        label="AI Content Pillars Synthesis"
      />

      {pendingSuggestions.length > 0 && (
        <div className="space-y-3 rounded-xl border border-blue-200 bg-blue-50/40 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-blue-900">
              AI Recommended Content Pillars ({pendingSuggestions.length} pending review)
            </h4>
            <span className="text-[11px] text-blue-700">
              Adopt to edit &amp; approve; never auto-approved
            </span>
          </div>
          <div className="space-y-3">
            {pendingSuggestions.map((s: AiSuggestedContentPillarItem) => (
              <div
                key={s.id}
                data-testid="ai-content-pillar-suggestion-card"
                className="rounded-lg border border-blue-200/80 bg-white p-4 space-y-2.5"
              >
                <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-start">
                  <div className="min-w-0">
                    <h5 className="text-sm font-semibold text-slate-900">{s.name}</h5>
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
                    <dt className="font-medium text-slate-500">Strategic Purpose</dt>
                    <dd className="text-slate-800">{s.strategicPurpose || '—'}</dd>
                  </div>
                  <div>
                    <dt className="font-medium text-slate-500">Target Audience</dt>
                    <dd className="text-slate-800">{s.targetAudienceSegment || '—'}</dd>
                  </div>
                  <div>
                    <dt className="font-medium text-slate-500">Supporting Topics</dt>
                    <dd className="text-slate-800">{s.supportingTopics.join(' · ') || '—'}</dd>
                  </div>
                </dl>
              </div>
            ))}
          </div>
        </div>
      )}

      {state.pillars.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-8 text-center">
          <p className="text-sm font-medium text-slate-800">No content pillars yet</p>
          <p className="mt-1 text-xs text-slate-500">
            Approve at least one Content Objective, then generate distinctive brand pillars or add one manually.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {state.pillars.map((pillar) => {
            const isEditing = editingIds[pillar.id] === true;
            const errs = errorsMap[pillar.id] ?? {};
            return (
              <article
                key={pillar.id}
                data-testid="content-pillar-card"
                className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 space-y-4"
              >
                <div className="flex flex-col justify-between gap-3 border-b border-slate-100 pb-3 sm:flex-row sm:items-start">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="text-sm font-semibold text-slate-900">
                        {pillar.name || 'Untitled Content Pillar'}
                      </h4>
                      <ApprovalBadge approved={pillar.approved} />
                    </div>
                    {!isEditing && pillar.description && (
                      <p className="mt-1 text-xs leading-relaxed text-slate-600">
                        {pillar.description}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => onToggleEdit(pillar.id, !isEditing)}
                      className="inline-flex min-h-[34px] items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                      <span>{isEditing ? 'Done Editing' : 'Edit'}</span>
                    </button>
                    {pillar.approved ? (
                      <button
                        type="button"
                        onClick={() => onUnapprovePillar(pillar.id)}
                        className="inline-flex min-h-[34px] items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs font-medium text-amber-800 hover:bg-amber-100"
                      >
                        Move to Draft
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onApprovePillar(pillar)}
                        className="inline-flex min-h-[34px] items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
                      >
                        <Check className="h-3.5 w-3.5" />
                        <span>Approve Pillar</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => onRequestDeletePillar(pillar)}
                      aria-label={`Delete content pillar ${pillar.name || 'Untitled'}`}
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
                        Pillar Name *
                      </label>
                      <input
                        type="text"
                        value={pillar.name}
                        onChange={(e) => onUpdatePillar(pillar.id, { name: e.target.value })}
                        placeholder="e.g., Operator Workflow Diagnostics"
                        className={fieldClass(Boolean(errs.name))}
                      />
                      {errs.name && <p className="mt-1 text-xs text-red-600">{errs.name}</p>}
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700">
                        Target Audience Segment *
                      </label>
                      <input
                        type="text"
                        value={pillar.targetAudienceSegment}
                        onChange={(e) =>
                          onUpdatePillar(pillar.id, { targetAudienceSegment: e.target.value })
                        }
                        className={fieldClass(Boolean(errs.targetAudienceSegment))}
                      />
                      {errs.targetAudienceSegment && (
                        <p className="mt-1 text-xs text-red-600">{errs.targetAudienceSegment}</p>
                      )}
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold text-slate-700">
                        Description *
                      </label>
                      <textarea
                        rows={2}
                        value={pillar.description}
                        onChange={(e) => onUpdatePillar(pillar.id, { description: e.target.value })}
                        className={fieldClass(Boolean(errs.description))}
                      />
                      {errs.description && (
                        <p className="mt-1 text-xs text-red-600">{errs.description}</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700">
                        Strategic Purpose *
                      </label>
                      <textarea
                        rows={2}
                        value={pillar.strategicPurpose}
                        onChange={(e) =>
                          onUpdatePillar(pillar.id, { strategicPurpose: e.target.value })
                        }
                        className={fieldClass(Boolean(errs.strategicPurpose))}
                      />
                      {errs.strategicPurpose && (
                        <p className="mt-1 text-xs text-red-600">{errs.strategicPurpose}</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700">
                        Aligned Marketing Objective *
                      </label>
                      <input
                        type="text"
                        list={`pillar-ms-obj-${pillar.id}`}
                        value={pillar.alignedMarketingObjectiveTitle}
                        onChange={(e) =>
                          onUpdatePillar(pillar.id, {
                            alignedMarketingObjectiveTitle: e.target.value,
                          })
                        }
                        className={fieldClass(Boolean(errs.alignedMarketingObjectiveTitle))}
                      />
                      <datalist id={`pillar-ms-obj-${pillar.id}`}>
                        {approvedMarketingObjectives.map((o) => (
                          <option key={o.id} value={o.title} />
                        ))}
                      </datalist>
                      {errs.alignedMarketingObjectiveTitle && (
                        <p className="mt-1 text-xs text-red-600">
                          {errs.alignedMarketingObjectiveTitle}
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700">
                        Relevant Interests &amp; Pain Points (one per line) *
                      </label>
                      <textarea
                        rows={2}
                        value={pillar.relevantInterestsAndPainPoints.join('\n')}
                        onChange={(e) =>
                          onUpdatePillar(pillar.id, {
                            relevantInterestsAndPainPoints: linesToArray(e.target.value),
                          })
                        }
                        className={fieldClass(Boolean(errs.relevantInterestsAndPainPoints))}
                      />
                      {errs.relevantInterestsAndPainPoints && (
                        <p className="mt-1 text-xs text-red-600">
                          {errs.relevantInterestsAndPainPoints}
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700">
                        Key Brand Messages (one per line) *
                      </label>
                      <textarea
                        rows={2}
                        value={pillar.keyMessages.join('\n')}
                        onChange={(e) =>
                          onUpdatePillar(pillar.id, {
                            keyMessages: linesToArray(e.target.value),
                          })
                        }
                        className={fieldClass(Boolean(errs.keyMessages))}
                      />
                      {errs.keyMessages && (
                        <p className="mt-1 text-xs text-red-600">{errs.keyMessages}</p>
                      )}
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold text-slate-700">
                        Supporting Topics (one per line) *
                      </label>
                      <textarea
                        rows={2}
                        value={pillar.supportingTopics.join('\n')}
                        onChange={(e) =>
                          onUpdatePillar(pillar.id, {
                            supportingTopics: linesToArray(e.target.value),
                          })
                        }
                        className={fieldClass(Boolean(errs.supportingTopics))}
                      />
                      {errs.supportingTopics && (
                        <p className="mt-1 text-xs text-red-600">{errs.supportingTopics}</p>
                      )}
                    </div>
                  </div>
                ) : (
                  <dl className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-2 lg:grid-cols-3">
                    <div>
                      <dt className="font-medium text-slate-500">Strategic Purpose</dt>
                      <dd className="mt-0.5 text-slate-800">{pillar.strategicPurpose || '—'}</dd>
                    </div>
                    <div>
                      <dt className="font-medium text-slate-500">Target Audience</dt>
                      <dd className="mt-0.5 text-slate-800">
                        {pillar.targetAudienceSegment || '—'}
                      </dd>
                    </div>
                    <div>
                      <dt className="font-medium text-slate-500">Marketing Objective</dt>
                      <dd className="mt-0.5 text-slate-800">
                        {pillar.alignedMarketingObjectiveTitle || '—'}
                      </dd>
                    </div>
                    <div>
                      <dt className="font-medium text-slate-500">Interests &amp; Pain Points</dt>
                      <dd className="mt-0.5 text-slate-800">
                        {pillar.relevantInterestsAndPainPoints.join(' · ') || '—'}
                      </dd>
                    </div>
                    <div>
                      <dt className="font-medium text-slate-500">Key Brand Messages</dt>
                      <dd className="mt-0.5 text-slate-800">
                        {pillar.keyMessages.join(' · ') || '—'}
                      </dd>
                    </div>
                    <div>
                      <dt className="font-medium text-slate-500">Supporting Topics</dt>
                      <dd className="mt-0.5 text-slate-800">
                        {pillar.supportingTopics.join(' · ') || '—'}
                      </dd>
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
          <span>Next: Themes &amp; Topics</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </section>
  );
}

// ============================================================================
// 03. CONTENT THEMES & TOPICS PANEL
// ============================================================================

export function ContentThemesPanel({
  state,
  approvedMarketingObjectives,
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
  onUpdateTheme,
  onApproveTheme,
  onUnapproveTheme,
  onRequestDeleteTheme,
  onPrev,
  onNext,
}: {
  state: ContentStrategyState;
  approvedMarketingObjectives: MarketingObjectiveItem[];
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
  onUpdateTheme: (id: string, patch: Partial<ContentThemeTopicItem>) => void;
  onApproveTheme: (item: ContentThemeTopicItem) => void;
  onUnapproveTheme: (id: string) => void;
  onRequestDeleteTheme: (item: ContentThemeTopicItem) => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  const pendingSuggestions = state.aiSuggestedThemes.filter(
    (s) => s.suggestionStatus === 'pending_review',
  );

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6 space-y-6">
      <SectionActionHeader
        title="03. Content Themes & Topics"
        subtitle="Translate approved Content Pillars into distinct, practical editorial themes with clear audience relevance and communication angles."
        generateLabel="Generate AI Themes"
        regenerateLabel="Regenerate AI Themes"
        generatingLabel="Generating Themes..."
        hasGenerated={Boolean(state.themesSynthesis.generatedAt)}
        generating={generating}
        generateDisabled={!canGenerate}
        generateDisabledReason={disabledReason}
        addLabel="Add Theme Manually"
        onGenerate={onGenerate}
        onAddManual={onAddManual}
      />

      {!canGenerate && disabledReason && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
          {disabledReason}
        </div>
      )}

      <ContentAiRunContextBanner
        run={state.themesSynthesis}
        label="AI Content Themes Synthesis"
      />

      {pendingSuggestions.length > 0 && (
        <div className="space-y-3 rounded-xl border border-blue-200 bg-blue-50/40 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-blue-900">
              AI Recommended Themes &amp; Topics ({pendingSuggestions.length} pending review)
            </h4>
            <span className="text-[11px] text-blue-700">
              Adopt to edit &amp; approve; never auto-approved
            </span>
          </div>
          <div className="space-y-3">
            {pendingSuggestions.map((s: AiSuggestedContentThemeTopicItem) => (
              <div
                key={s.id}
                data-testid="ai-content-theme-suggestion-card"
                className="rounded-lg border border-blue-200/80 bg-white p-4 space-y-2"
              >
                <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-start">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h5 className="text-sm font-semibold text-slate-900">{s.title}</h5>
                      {s.associatedPillarName && (
                        <span className="inline-flex items-center rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-700">
                          {s.associatedPillarName}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-slate-600">{s.description}</p>
                    <p className="mt-1 text-[11px] text-slate-500">
                      Angle: <span className="font-medium text-slate-700">{s.communicationAngle || '—'}</span>
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

      {state.themes.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-8 text-center">
          <p className="text-sm font-medium text-slate-800">No content themes or topics yet</p>
          <p className="mt-1 text-xs text-slate-500">
            Generate non-overlapping themes mapped to your approved pillars, or add one manually.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {state.themes.map((theme) => {
            const isEditing = editingIds[theme.id] === true;
            const errs = errorsMap[theme.id] ?? {};
            const linkedPillar = state.pillars.find((p) => p.id === theme.associatedPillarId);
            return (
              <article
                key={theme.id}
                data-testid="content-theme-card"
                className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 space-y-4"
              >
                <div className="flex flex-col justify-between gap-3 border-b border-slate-100 pb-3 sm:flex-row sm:items-start">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="text-sm font-semibold text-slate-900">
                        {theme.title || 'Untitled Content Theme'}
                      </h4>
                      <ApprovalBadge approved={theme.approved} />
                    </div>
                    {!isEditing && theme.description && (
                      <p className="mt-1 text-xs leading-relaxed text-slate-600">
                        {theme.description}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => onToggleEdit(theme.id, !isEditing)}
                      className="inline-flex min-h-[34px] items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                      <span>{isEditing ? 'Done Editing' : 'Edit'}</span>
                    </button>
                    {theme.approved ? (
                      <button
                        type="button"
                        onClick={() => onUnapproveTheme(theme.id)}
                        className="inline-flex min-h-[34px] items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs font-medium text-amber-800 hover:bg-amber-100"
                      >
                        Move to Draft
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onApproveTheme(theme)}
                        className="inline-flex min-h-[34px] items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
                      >
                        <Check className="h-3.5 w-3.5" />
                        <span>Approve Theme</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => onRequestDeleteTheme(theme)}
                      aria-label={`Delete content theme ${theme.title || 'Untitled'}`}
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
                        Theme / Topic Title *
                      </label>
                      <input
                        type="text"
                        value={theme.title}
                        onChange={(e) => onUpdateTheme(theme.id, { title: e.target.value })}
                        className={fieldClass(Boolean(errs.title))}
                      />
                      {errs.title && <p className="mt-1 text-xs text-red-600">{errs.title}</p>}
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700">
                        Associated Content Pillar *
                      </label>
                      <select
                        value={theme.associatedPillarId}
                        onChange={(e) => {
                          const selected = state.pillars.find((p) => p.id === e.target.value);
                          onUpdateTheme(theme.id, {
                            associatedPillarId: e.target.value,
                            associatedPillarName: selected?.name ?? '',
                          });
                        }}
                        className={fieldClass(Boolean(errs.associatedPillarId))}
                      >
                        <option value="">Select content pillar...</option>
                        {state.pillars.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name || 'Untitled Pillar'}
                          </option>
                        ))}
                      </select>
                      {errs.associatedPillarId && (
                        <p className="mt-1 text-xs text-red-600">{errs.associatedPillarId}</p>
                      )}
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold text-slate-700">
                        Description *
                      </label>
                      <textarea
                        rows={2}
                        value={theme.description}
                        onChange={(e) => onUpdateTheme(theme.id, { description: e.target.value })}
                        className={fieldClass(Boolean(errs.description))}
                      />
                      {errs.description && (
                        <p className="mt-1 text-xs text-red-600">{errs.description}</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700">
                        Audience Relevance *
                      </label>
                      <input
                        type="text"
                        value={theme.audienceRelevance}
                        onChange={(e) =>
                          onUpdateTheme(theme.id, { audienceRelevance: e.target.value })
                        }
                        className={fieldClass(Boolean(errs.audienceRelevance))}
                      />
                      {errs.audienceRelevance && (
                        <p className="mt-1 text-xs text-red-600">{errs.audienceRelevance}</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700">
                        Problem, Interest, or Aspiration Addressed *
                      </label>
                      <input
                        type="text"
                        value={theme.addressedNeedOrAspiration}
                        onChange={(e) =>
                          onUpdateTheme(theme.id, {
                            addressedNeedOrAspiration: e.target.value,
                          })
                        }
                        className={fieldClass(Boolean(errs.addressedNeedOrAspiration))}
                      />
                      {errs.addressedNeedOrAspiration && (
                        <p className="mt-1 text-xs text-red-600">
                          {errs.addressedNeedOrAspiration}
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700">
                        Communication Angle *
                      </label>
                      <input
                        type="text"
                        value={theme.communicationAngle}
                        onChange={(e) =>
                          onUpdateTheme(theme.id, { communicationAngle: e.target.value })
                        }
                        className={fieldClass(Boolean(errs.communicationAngle))}
                      />
                      {errs.communicationAngle && (
                        <p className="mt-1 text-xs text-red-600">{errs.communicationAngle}</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700">
                        Aligned Marketing Objective *
                      </label>
                      <input
                        type="text"
                        list={`theme-ms-obj-${theme.id}`}
                        value={theme.alignedMarketingObjectiveTitle}
                        onChange={(e) =>
                          onUpdateTheme(theme.id, {
                            alignedMarketingObjectiveTitle: e.target.value,
                          })
                        }
                        className={fieldClass(Boolean(errs.alignedMarketingObjectiveTitle))}
                      />
                      <datalist id={`theme-ms-obj-${theme.id}`}>
                        {approvedMarketingObjectives.map((o) => (
                          <option key={o.id} value={o.title} />
                        ))}
                      </datalist>
                      {errs.alignedMarketingObjectiveTitle && (
                        <p className="mt-1 text-xs text-red-600">
                          {errs.alignedMarketingObjectiveTitle}
                        </p>
                      )}
                    </div>
                  </div>
                ) : (
                  <dl className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-2 lg:grid-cols-3">
                    <div>
                      <dt className="font-medium text-slate-500">Associated Pillar</dt>
                      <dd className="mt-0.5 text-slate-800">
                        {linkedPillar?.name || theme.associatedPillarName || 'Unlinked'}
                      </dd>
                    </div>
                    <div>
                      <dt className="font-medium text-slate-500">Audience Relevance</dt>
                      <dd className="mt-0.5 text-slate-800">{theme.audienceRelevance || '—'}</dd>
                    </div>
                    <div>
                      <dt className="font-medium text-slate-500">Need / Aspiration</dt>
                      <dd className="mt-0.5 text-slate-800">
                        {theme.addressedNeedOrAspiration || '—'}
                      </dd>
                    </div>
                    <div>
                      <dt className="font-medium text-slate-500">Communication Angle</dt>
                      <dd className="mt-0.5 text-slate-800">{theme.communicationAngle || '—'}</dd>
                    </div>
                    <div>
                      <dt className="font-medium text-slate-500">Marketing Objective</dt>
                      <dd className="mt-0.5 text-slate-800">
                        {theme.alignedMarketingObjectiveTitle || '—'}
                      </dd>
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
          <span>Back: Pillars</span>
        </button>
        <button
          type="button"
          onClick={onNext}
          className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
        >
          <span>Next: Formats &amp; Series</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </section>
  );
}

// ============================================================================
// 04. CONTENT FORMATS & RECURRING SERIES PANEL
// ============================================================================

export function ContentFormatsSeriesPanel({
  state,
  approvedMarketingChannels,
  generating,
  canGenerate,
  disabledReason,
  editingIds,
  errorsMap,
  onToggleEdit,
  onGenerate,
  onAddManualFormat,
  onAddManualSeries,
  onAdoptFormatSuggestion,
  onDismissFormatSuggestion,
  onAdoptSeriesSuggestion,
  onDismissSeriesSuggestion,
  onUpdateFormat,
  onApproveFormat,
  onUnapproveFormat,
  onRequestDeleteFormat,
  onUpdateSeries,
  onApproveSeries,
  onUnapproveSeries,
  onRequestDeleteSeries,
  onPrev,
  onNext,
}: {
  state: ContentStrategyState;
  approvedMarketingChannels: MarketingChannelItem[];
  generating: boolean;
  canGenerate: boolean;
  disabledReason: string | null;
  editingIds: Record<string, boolean>;
  errorsMap: Record<string, Record<string, string>>;
  onToggleEdit: (id: string, editing: boolean) => void;
  onGenerate: () => void;
  onAddManualFormat: () => void;
  onAddManualSeries: () => void;
  onAdoptFormatSuggestion: (suggestionId: string) => void;
  onDismissFormatSuggestion: (suggestionId: string) => void;
  onAdoptSeriesSuggestion: (suggestionId: string) => void;
  onDismissSeriesSuggestion: (suggestionId: string) => void;
  onUpdateFormat: (id: string, patch: Partial<ContentFormatItem>) => void;
  onApproveFormat: (item: ContentFormatItem) => void;
  onUnapproveFormat: (id: string) => void;
  onRequestDeleteFormat: (item: ContentFormatItem) => void;
  onUpdateSeries: (id: string, patch: Partial<ContentSeriesItem>) => void;
  onApproveSeries: (item: ContentSeriesItem) => void;
  onUnapproveSeries: (id: string) => void;
  onRequestDeleteSeries: (item: ContentSeriesItem) => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  const pendingFormats = state.aiSuggestedFormats.filter(
    (s) => s.suggestionStatus === 'pending_review',
  );
  const pendingSeries = state.aiSuggestedSeries.filter(
    (s) => s.suggestionStatus === 'pending_review',
  );
  const channelHint = approvedMarketingChannels.map((c) => c.channelName).join(', ');

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6 space-y-6">
      <SectionActionHeader
        title="04. Content Formats & Recurring Series"
        subtitle="Select practical content formats and repeatable editorial series matched to your approved marketing channels and content pillars. Approve at least one format and one recurring series."
        generateLabel="Generate AI Formats & Series"
        regenerateLabel="Regenerate AI Formats & Series"
        generatingLabel="Generating Formats & Series..."
        hasGenerated={Boolean(state.formatsSynthesis.generatedAt)}
        generating={generating}
        generateDisabled={!canGenerate}
        generateDisabledReason={disabledReason}
        addLabel="Add Format"
        secondaryAddLabel="Add Series"
        onGenerate={onGenerate}
        onAddManual={onAddManualFormat}
        onSecondaryAddManual={onAddManualSeries}
      />

      {!canGenerate && disabledReason && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
          {disabledReason}
        </div>
      )}

      {channelHint && (
        <p className="text-xs text-slate-500">
          Approved Marketing Strategy channels:{' '}
          <span className="font-medium text-slate-700">{channelHint}</span>
        </p>
      )}

      <ContentAiRunContextBanner
        run={state.formatsSynthesis}
        label="AI Formats & Series Synthesis"
      />

      {/* Part A: Recommended Formats */}
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <h4 className="text-sm font-semibold text-slate-900">
            Recommended Content Formats ({state.formats.filter((f) => f.approved).length} approved /{' '}
            {state.formats.length} total)
          </h4>
        </div>

        {pendingFormats.length > 0 && (
          <div className="space-y-3 rounded-xl border border-blue-200 bg-blue-50/40 p-4">
            <h5 className="text-xs font-semibold uppercase tracking-wide text-blue-900">
              AI Recommended Formats ({pendingFormats.length} pending review)
            </h5>
            <div className="space-y-3">
              {pendingFormats.map((s: AiSuggestedContentFormatItem) => (
                <div
                  key={s.id}
                  data-testid="ai-content-format-suggestion-card"
                  className="rounded-lg border border-blue-200/80 bg-white p-4 space-y-2"
                >
                  <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-start">
                    <div>
                      <h6 className="text-sm font-semibold text-slate-900">{s.formatName}</h6>
                      <p className="mt-1 text-xs text-slate-600">{s.purpose}</p>
                      <p className="mt-1 text-[11px] text-slate-500">
                        Platforms: <span className="font-medium text-slate-700">{s.suitablePlatforms.join(' · ') || '—'}</span>
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => onAdoptFormatSuggestion(s.id)}
                        className="inline-flex min-h-[34px] items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
                      >
                        <Check className="h-3.5 w-3.5" />
                        <span>Adopt as Draft</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onDismissFormatSuggestion(s.id)}
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

        {state.formats.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-6 text-center">
            <p className="text-xs text-slate-600">
              No content formats added yet. Adopt AI format proposals above or add one manually.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {state.formats.map((format) => {
              const isEditing = editingIds[format.id] === true;
              const errs = errorsMap[format.id] ?? {};
              return (
                <article
                  key={format.id}
                  data-testid="content-format-card"
                  className="rounded-xl border border-slate-200 bg-white p-4 space-y-4"
                >
                  <div className="flex flex-col justify-between gap-3 border-b border-slate-100 pb-3 sm:flex-row sm:items-start">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h5 className="text-sm font-semibold text-slate-900">
                          {format.formatName || 'Untitled Format'}
                        </h5>
                        <ApprovalBadge approved={format.approved} />
                      </div>
                      {!isEditing && format.purpose && (
                        <p className="mt-1 text-xs text-slate-600">{format.purpose}</p>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => onToggleEdit(format.id, !isEditing)}
                        className="inline-flex min-h-[34px] items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                        <span>{isEditing ? 'Done Editing' : 'Edit'}</span>
                      </button>
                      {format.approved ? (
                        <button
                          type="button"
                          onClick={() => onUnapproveFormat(format.id)}
                          className="inline-flex min-h-[34px] items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs font-medium text-amber-800 hover:bg-amber-100"
                        >
                          Move to Draft
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onApproveFormat(format)}
                          className="inline-flex min-h-[34px] items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
                        >
                          <Check className="h-3.5 w-3.5" />
                          <span>Approve Format</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => onRequestDeleteFormat(format)}
                        aria-label={`Delete format ${format.formatName || 'Untitled'}`}
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
                          Format Name *
                        </label>
                        <input
                          type="text"
                          value={format.formatName}
                          onChange={(e) =>
                            onUpdateFormat(format.id, { formatName: e.target.value })
                          }
                          placeholder="e.g., Founder Teardown Carousel"
                          className={fieldClass(Boolean(errs.formatName))}
                        />
                        {errs.formatName && (
                          <p className="mt-1 text-xs text-red-600">{errs.formatName}</p>
                        )}
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700">
                          Audience Suitability *
                        </label>
                        <input
                          type="text"
                          value={format.audienceSuitability}
                          onChange={(e) =>
                            onUpdateFormat(format.id, { audienceSuitability: e.target.value })
                          }
                          className={fieldClass(Boolean(errs.audienceSuitability))}
                        />
                        {errs.audienceSuitability && (
                          <p className="mt-1 text-xs text-red-600">{errs.audienceSuitability}</p>
                        )}
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-xs font-semibold text-slate-700">
                          Strategic Purpose *
                        </label>
                        <textarea
                          rows={2}
                          value={format.purpose}
                          onChange={(e) => onUpdateFormat(format.id, { purpose: e.target.value })}
                          className={fieldClass(Boolean(errs.purpose))}
                        />
                        {errs.purpose && (
                          <p className="mt-1 text-xs text-red-600">{errs.purpose}</p>
                        )}
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700">
                          Suitable Platforms (one per line) *
                        </label>
                        <textarea
                          rows={2}
                          value={format.suitablePlatforms.join('\n')}
                          onChange={(e) =>
                            onUpdateFormat(format.id, {
                              suitablePlatforms: linesToArray(e.target.value),
                            })
                          }
                          placeholder={channelHint || 'LinkedIn\nEmail Newsletter'}
                          className={fieldClass(Boolean(errs.suitablePlatforms))}
                        />
                        {errs.suitablePlatforms && (
                          <p className="mt-1 text-xs text-red-600">{errs.suitablePlatforms}</p>
                        )}
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700">
                          Related Content Pillars (one per line) *
                        </label>
                        <textarea
                          rows={2}
                          value={format.relatedPillarNames.join('\n')}
                          onChange={(e) =>
                            onUpdateFormat(format.id, {
                              relatedPillarNames: linesToArray(e.target.value),
                            })
                          }
                          className={fieldClass(Boolean(errs.relatedPillarNames))}
                        />
                        {errs.relatedPillarNames && (
                          <p className="mt-1 text-xs text-red-600">{errs.relatedPillarNames}</p>
                        )}
                      </div>
                    </div>
                  ) : (
                    <dl className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-3">
                      <div>
                        <dt className="font-medium text-slate-500">Suitable Platforms</dt>
                        <dd className="mt-0.5 text-slate-800">
                          {format.suitablePlatforms.join(' · ') || '—'}
                        </dd>
                      </div>
                      <div>
                        <dt className="font-medium text-slate-500">Audience Suitability</dt>
                        <dd className="mt-0.5 text-slate-800">
                          {format.audienceSuitability || '—'}
                        </dd>
                      </div>
                      <div>
                        <dt className="font-medium text-slate-500">Related Pillars</dt>
                        <dd className="mt-0.5 text-slate-800">
                          {format.relatedPillarNames.join(' · ') || '—'}
                        </dd>
                      </div>
                    </dl>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </div>

      {/* Part B: Recurring Content Series */}
      <div className="space-y-4 border-t border-slate-100 pt-5">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <h4 className="text-sm font-semibold text-slate-900">
            Recurring Content Series ({state.series.filter((s) => s.approved).length} approved /{' '}
            {state.series.length} total)
          </h4>
        </div>

        {pendingSeries.length > 0 && (
          <div className="space-y-3 rounded-xl border border-blue-200 bg-blue-50/40 p-4">
            <h5 className="text-xs font-semibold uppercase tracking-wide text-blue-900">
              AI Recommended Recurring Series ({pendingSeries.length} pending review)
            </h5>
            <div className="space-y-3">
              {pendingSeries.map((s: AiSuggestedContentSeriesItem) => (
                <div
                  key={s.id}
                  data-testid="ai-content-series-suggestion-card"
                  className="rounded-lg border border-blue-200/80 bg-white p-4 space-y-2"
                >
                  <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-start">
                    <div>
                      <h6 className="text-sm font-semibold text-slate-900">{s.seriesName}</h6>
                      <p className="mt-1 text-xs text-slate-600">{s.description}</p>
                      <p className="mt-1 text-[11px] text-slate-500">
                        Format: <span className="font-medium text-slate-700">{s.formatName || '—'}</span>
                        {s.cadenceHint ? ` · Cadence: ${s.cadenceHint}` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => onAdoptSeriesSuggestion(s.id)}
                        className="inline-flex min-h-[34px] items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
                      >
                        <Check className="h-3.5 w-3.5" />
                        <span>Adopt as Draft</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onDismissSeriesSuggestion(s.id)}
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

        {state.series.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-6 text-center">
            <p className="text-xs text-slate-600">
              No recurring content series added yet. Adopt AI series proposals above or add one manually.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {state.series.map((item) => {
              const isEditing = editingIds[item.id] === true;
              const errs = errorsMap[item.id] ?? {};
              return (
                <article
                  key={item.id}
                  data-testid="content-series-card"
                  className="rounded-xl border border-slate-200 bg-white p-4 space-y-4"
                >
                  <div className="flex flex-col justify-between gap-3 border-b border-slate-100 pb-3 sm:flex-row sm:items-start">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h5 className="text-sm font-semibold text-slate-900">
                          {item.seriesName || 'Untitled Recurring Series'}
                        </h5>
                        <ApprovalBadge approved={item.approved} />
                      </div>
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
                          onClick={() => onUnapproveSeries(item.id)}
                          className="inline-flex min-h-[34px] items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs font-medium text-amber-800 hover:bg-amber-100"
                        >
                          Move to Draft
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onApproveSeries(item)}
                          className="inline-flex min-h-[34px] items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
                        >
                          <Check className="h-3.5 w-3.5" />
                          <span>Approve Series</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => onRequestDeleteSeries(item)}
                        aria-label={`Delete series ${item.seriesName || 'Untitled'}`}
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
                          Series Name *
                        </label>
                        <input
                          type="text"
                          value={item.seriesName}
                          onChange={(e) =>
                            onUpdateSeries(item.id, { seriesName: e.target.value })
                          }
                          className={fieldClass(Boolean(errs.seriesName))}
                        />
                        {errs.seriesName && (
                          <p className="mt-1 text-xs text-red-600">{errs.seriesName}</p>
                        )}
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700">
                          Primary Format *
                        </label>
                        <input
                          type="text"
                          value={item.formatName}
                          onChange={(e) =>
                            onUpdateSeries(item.id, { formatName: e.target.value })
                          }
                          className={fieldClass(Boolean(errs.formatName))}
                        />
                        {errs.formatName && (
                          <p className="mt-1 text-xs text-red-600">{errs.formatName}</p>
                        )}
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-xs font-semibold text-slate-700">
                          Series Description *
                        </label>
                        <textarea
                          rows={2}
                          value={item.description}
                          onChange={(e) =>
                            onUpdateSeries(item.id, { description: e.target.value })
                          }
                          className={fieldClass(Boolean(errs.description))}
                        />
                        {errs.description && (
                          <p className="mt-1 text-xs text-red-600">{errs.description}</p>
                        )}
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700">
                          Audience Suitability *
                        </label>
                        <input
                          type="text"
                          value={item.audienceSuitability}
                          onChange={(e) =>
                            onUpdateSeries(item.id, { audienceSuitability: e.target.value })
                          }
                          className={fieldClass(Boolean(errs.audienceSuitability))}
                        />
                        {errs.audienceSuitability && (
                          <p className="mt-1 text-xs text-red-600">{errs.audienceSuitability}</p>
                        )}
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700">
                          Cadence Hint
                        </label>
                        <input
                          type="text"
                          value={item.cadenceHint}
                          onChange={(e) =>
                            onUpdateSeries(item.id, { cadenceHint: e.target.value })
                          }
                          placeholder="e.g., Bi-weekly"
                          className={fieldClass(false)}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700">
                          Suitable Platforms (one per line) *
                        </label>
                        <textarea
                          rows={2}
                          value={item.suitablePlatforms.join('\n')}
                          onChange={(e) =>
                            onUpdateSeries(item.id, {
                              suitablePlatforms: linesToArray(e.target.value),
                            })
                          }
                          className={fieldClass(Boolean(errs.suitablePlatforms))}
                        />
                        {errs.suitablePlatforms && (
                          <p className="mt-1 text-xs text-red-600">{errs.suitablePlatforms}</p>
                        )}
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700">
                          Related Content Pillars (one per line) *
                        </label>
                        <textarea
                          rows={2}
                          value={item.relatedPillarNames.join('\n')}
                          onChange={(e) =>
                            onUpdateSeries(item.id, {
                              relatedPillarNames: linesToArray(e.target.value),
                            })
                          }
                          className={fieldClass(Boolean(errs.relatedPillarNames))}
                        />
                        {errs.relatedPillarNames && (
                          <p className="mt-1 text-xs text-red-600">{errs.relatedPillarNames}</p>
                        )}
                      </div>
                    </div>
                  ) : (
                    <dl className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-4">
                      <div>
                        <dt className="font-medium text-slate-500">Format</dt>
                        <dd className="mt-0.5 text-slate-800">{item.formatName || '—'}</dd>
                      </div>
                      <div>
                        <dt className="font-medium text-slate-500">Platforms</dt>
                        <dd className="mt-0.5 text-slate-800">
                          {item.suitablePlatforms.join(' · ') || '—'}
                        </dd>
                      </div>
                      <div>
                        <dt className="font-medium text-slate-500">Related Pillars</dt>
                        <dd className="mt-0.5 text-slate-800">
                          {item.relatedPillarNames.join(' · ') || '—'}
                        </dd>
                      </div>
                      <div>
                        <dt className="font-medium text-slate-500">Cadence</dt>
                        <dd className="mt-0.5 text-slate-800">{item.cadenceHint || '—'}</dd>
                      </div>
                    </dl>
                  )}
                </article>
              );
            })}
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
          <span>Back: Themes</span>
        </button>
        <button
          type="button"
          onClick={onNext}
          className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
        >
          <span>Next: Distribution &amp; Publishing</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </section>
  );
}

// ============================================================================
// 05. DISTRIBUTION & PUBLISHING APPROACH PANEL
// ============================================================================

export function ContentDistributionPanel({
  state,
  approvedMarketingChannels,
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
  onUpdateDistribution,
  onApproveDistribution,
  onUnapproveDistribution,
  onRequestDeleteDistribution,
  onPrev,
  onNext,
}: {
  state: ContentStrategyState;
  approvedMarketingChannels: MarketingChannelItem[];
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
  onUpdateDistribution: (id: string, patch: Partial<DistributionApproachItem>) => void;
  onApproveDistribution: (item: DistributionApproachItem) => void;
  onUnapproveDistribution: (id: string) => void;
  onRequestDeleteDistribution: (item: DistributionApproachItem) => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  const pendingSuggestions = state.aiSuggestedDistribution.filter(
    (s) => s.suggestionStatus === 'pending_review',
  );

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6 space-y-6">
      <SectionActionHeader
        title="05. Distribution & Publishing Approach"
        subtitle="Operationalize publishing cadence, content mix, and repurposing exclusively across your approved Marketing Strategy channels."
        generateLabel="Generate AI Distribution Plan"
        regenerateLabel="Regenerate AI Distribution Plan"
        generatingLabel="Generating Distribution..."
        hasGenerated={Boolean(state.distributionSynthesis.generatedAt)}
        generating={generating}
        generateDisabled={!canGenerate}
        generateDisabledReason={disabledReason}
        addLabel="Add Platform Plan"
        onGenerate={onGenerate}
        onAddManual={onAddManual}
      />

      {!canGenerate && disabledReason && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
          {disabledReason}
        </div>
      )}

      {approvedMarketingChannels.length > 0 && (
        <div className="rounded-lg border border-slate-200 bg-slate-50/70 px-4 py-2.5 text-xs text-slate-600">
          <span className="font-semibold text-slate-800">Single source of truth:</span>{' '}
          Channel selection is inherited from approved Marketing Strategy channels (
          {approvedMarketingChannels.map((c) => `${c.channelName} [${c.priority}]`).join(', ')}).
        </div>
      )}

      <ContentAiRunContextBanner
        run={state.distributionSynthesis}
        label="AI Distribution & Publishing Synthesis"
      />

      {pendingSuggestions.length > 0 && (
        <div className="space-y-3 rounded-xl border border-blue-200 bg-blue-50/40 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-blue-900">
              AI Recommended Publishing Plans ({pendingSuggestions.length} pending review)
            </h4>
            <span className="text-[11px] text-blue-700">
              Adopt to edit &amp; approve; never auto-approved
            </span>
          </div>
          <div className="space-y-3">
            {pendingSuggestions.map((s: AiSuggestedDistributionApproachItem) => (
              <div
                key={s.id}
                data-testid="ai-content-distribution-suggestion-card"
                className="rounded-lg border border-blue-200/80 bg-white p-4 space-y-2"
              >
                <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-start">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h5 className="text-sm font-semibold text-slate-900">{s.platformName}</h5>
                      {s.channelRole && (
                        <span className="inline-flex items-center rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-700">
                          {s.channelRole}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-slate-600">{s.distributionApproach}</p>
                    <p className="mt-1 text-[11px] text-slate-500">
                      Frequency: <span className="font-medium text-slate-700">{s.recommendedFrequency || '—'}</span>
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

      {state.distribution.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-8 text-center">
          <p className="text-sm font-medium text-slate-800">No platform publishing plans yet</p>
          <p className="mt-1 text-xs text-slate-500">
            Generate distribution plans anchored in your approved marketing channels, or add a platform plan manually.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {state.distribution.map((item) => {
            const isEditing = editingIds[item.id] === true;
            const errs = errorsMap[item.id] ?? {};
            return (
              <article
                key={item.id}
                data-testid="content-distribution-card"
                className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 space-y-4"
              >
                <div className="flex flex-col justify-between gap-3 border-b border-slate-100 pb-3 sm:flex-row sm:items-start">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="text-sm font-semibold text-slate-900">
                        {item.platformName || 'Untitled Platform Plan'}
                      </h4>
                      {item.channelRole && (
                        <span className="inline-flex items-center rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-700">
                          {item.channelRole}
                        </span>
                      )}
                      <ApprovalBadge approved={item.approved} />
                    </div>
                    {!isEditing && item.distributionApproach && (
                      <p className="mt-1 text-xs leading-relaxed text-slate-600">
                        {item.distributionApproach}
                      </p>
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
                        onClick={() => onUnapproveDistribution(item.id)}
                        className="inline-flex min-h-[34px] items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs font-medium text-amber-800 hover:bg-amber-100"
                      >
                        Move to Draft
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onApproveDistribution(item)}
                        className="inline-flex min-h-[34px] items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
                      >
                        <Check className="h-3.5 w-3.5" />
                        <span>Approve Plan</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => onRequestDeleteDistribution(item)}
                      aria-label={`Delete distribution plan ${item.platformName || 'Untitled'}`}
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
                        Platform / Channel *
                      </label>
                      <input
                        type="text"
                        list={`dist-channels-${item.id}`}
                        value={item.platformName}
                        onChange={(e) =>
                          onUpdateDistribution(item.id, { platformName: e.target.value })
                        }
                        placeholder="Select approved marketing channel"
                        className={fieldClass(Boolean(errs.platformName))}
                      />
                      <datalist id={`dist-channels-${item.id}`}>
                        {approvedMarketingChannels.map((c) => (
                          <option key={c.id} value={c.channelName} />
                        ))}
                      </datalist>
                      {errs.platformName && (
                        <p className="mt-1 text-xs text-red-600">{errs.platformName}</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700">
                        Channel Role
                      </label>
                      <input
                        type="text"
                        value={item.channelRole}
                        onChange={(e) =>
                          onUpdateDistribution(item.id, { channelRole: e.target.value })
                        }
                        placeholder="e.g., Primary authority & demand channel"
                        className={fieldClass(false)}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700">
                        Recommended Publishing Frequency *
                      </label>
                      <input
                        type="text"
                        value={item.recommendedFrequency}
                        onChange={(e) =>
                          onUpdateDistribution(item.id, { recommendedFrequency: e.target.value })
                        }
                        placeholder="e.g., 2 posts/week + 1 teardown/month"
                        className={fieldClass(Boolean(errs.recommendedFrequency))}
                      />
                      {errs.recommendedFrequency && (
                        <p className="mt-1 text-xs text-red-600">{errs.recommendedFrequency}</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700">
                        Publishing Constraints *
                      </label>
                      <input
                        type="text"
                        value={item.publishingConstraints}
                        onChange={(e) =>
                          onUpdateDistribution(item.id, { publishingConstraints: e.target.value })
                        }
                        className={fieldClass(Boolean(errs.publishingConstraints))}
                      />
                      {errs.publishingConstraints && (
                        <p className="mt-1 text-xs text-red-600">{errs.publishingConstraints}</p>
                      )}
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold text-slate-700">
                        Platform-Specific Considerations *
                      </label>
                      <textarea
                        rows={2}
                        value={item.platformConsiderations}
                        onChange={(e) =>
                          onUpdateDistribution(item.id, { platformConsiderations: e.target.value })
                        }
                        className={fieldClass(Boolean(errs.platformConsiderations))}
                      />
                      {errs.platformConsiderations && (
                        <p className="mt-1 text-xs text-red-600">{errs.platformConsiderations}</p>
                      )}
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold text-slate-700">
                        Distribution Approach *
                      </label>
                      <textarea
                        rows={2}
                        value={item.distributionApproach}
                        onChange={(e) =>
                          onUpdateDistribution(item.id, { distributionApproach: e.target.value })
                        }
                        className={fieldClass(Boolean(errs.distributionApproach))}
                      />
                      {errs.distributionApproach && (
                        <p className="mt-1 text-xs text-red-600">{errs.distributionApproach}</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700">
                        Content Mix (one per line) *
                      </label>
                      <textarea
                        rows={2}
                        value={item.contentMix.join('\n')}
                        onChange={(e) =>
                          onUpdateDistribution(item.id, {
                            contentMix: linesToArray(e.target.value),
                          })
                        }
                        className={fieldClass(Boolean(errs.contentMix))}
                      />
                      {errs.contentMix && (
                        <p className="mt-1 text-xs text-red-600">{errs.contentMix}</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700">
                        Repurposing Opportunities (one per line) *
                      </label>
                      <textarea
                        rows={2}
                        value={item.repurposingOpportunities.join('\n')}
                        onChange={(e) =>
                          onUpdateDistribution(item.id, {
                            repurposingOpportunities: linesToArray(e.target.value),
                          })
                        }
                        className={fieldClass(Boolean(errs.repurposingOpportunities))}
                      />
                      {errs.repurposingOpportunities && (
                        <p className="mt-1 text-xs text-red-600">
                          {errs.repurposingOpportunities}
                        </p>
                      )}
                    </div>
                  </div>
                ) : (
                  <dl className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-2 lg:grid-cols-3">
                    <div>
                      <dt className="font-medium text-slate-500">Publishing Frequency</dt>
                      <dd className="mt-0.5 text-slate-800">{item.recommendedFrequency || '—'}</dd>
                    </div>
                    <div>
                      <dt className="font-medium text-slate-500">Platform Considerations</dt>
                      <dd className="mt-0.5 text-slate-800">
                        {item.platformConsiderations || '—'}
                      </dd>
                    </div>
                    <div>
                      <dt className="font-medium text-slate-500">Publishing Constraints</dt>
                      <dd className="mt-0.5 text-slate-800">{item.publishingConstraints || '—'}</dd>
                    </div>
                    <div>
                      <dt className="font-medium text-slate-500">Content Mix</dt>
                      <dd className="mt-0.5 text-slate-800">
                        {item.contentMix.join(' · ') || '—'}
                      </dd>
                    </div>
                    <div className="sm:col-span-2">
                      <dt className="font-medium text-slate-500">Repurposing Opportunities</dt>
                      <dd className="mt-0.5 text-slate-800">
                        {item.repurposingOpportunities.join(' · ') || '—'}
                      </dd>
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
          <span>Back: Formats &amp; Series</span>
        </button>
        <button
          type="button"
          onClick={onNext}
          className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
        >
          <span>Next: Governance &amp; Measurement</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </section>
  );
}

// ============================================================================
// 06. CONTENT GOVERNANCE & MEASUREMENT PANEL
// ============================================================================

export function ContentGovernancePanel({
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
  onUpdateGovernance,
  onApproveGovernance,
  onUnapproveGovernance,
  onRequestDeleteGovernance,
  onPrev,
  onNext,
}: {
  state: ContentStrategyState;
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
  onUpdateGovernance: (id: string, patch: Partial<ContentGovernanceStandardItem>) => void;
  onApproveGovernance: (item: ContentGovernanceStandardItem) => void;
  onUnapproveGovernance: (id: string) => void;
  onRequestDeleteGovernance: (item: ContentGovernanceStandardItem) => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  const pendingSuggestions = state.aiSuggestedGovernance.filter(
    (s) => s.suggestionStatus === 'pending_review',
  );

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6 space-y-6">
      <SectionActionHeader
        title="06. Content Governance & Measurement"
        subtitle="Establish quality standards, brand voice compliance, messaging consistency checks, editorial approval rules, and KPI-linked performance indicators without fabricated numerical benchmarks."
        generateLabel="Generate AI Governance"
        regenerateLabel="Regenerate AI Governance"
        generatingLabel="Generating Governance..."
        hasGenerated={Boolean(state.governanceSynthesis.generatedAt)}
        generating={generating}
        generateDisabled={!canGenerate}
        generateDisabledReason={disabledReason}
        addLabel="Add Standard Manually"
        onGenerate={onGenerate}
        onAddManual={onAddManual}
      />

      {!canGenerate && disabledReason && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
          {disabledReason}
        </div>
      )}

      <ContentAiRunContextBanner
        run={state.governanceSynthesis}
        label="AI Governance & Measurement Synthesis"
      />

      {pendingSuggestions.length > 0 && (
        <div className="space-y-3 rounded-xl border border-blue-200 bg-blue-50/40 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-blue-900">
              AI Recommended Governance Standards ({pendingSuggestions.length} pending review)
            </h4>
            <span className="text-[11px] text-blue-700">
              Adopt to edit &amp; approve; never auto-approved
            </span>
          </div>
          <div className="space-y-3">
            {pendingSuggestions.map((s: AiSuggestedContentGovernanceStandardItem) => (
              <div
                key={s.id}
                data-testid="ai-content-governance-suggestion-card"
                className="rounded-lg border border-blue-200/80 bg-white p-4 space-y-2"
              >
                <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-start">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h5 className="text-sm font-semibold text-slate-900">{s.title}</h5>
                      <GovernanceCategoryBadge category={s.category} />
                    </div>
                    <p className="mt-1 text-xs text-slate-600">{s.brandVoiceCompliance}</p>
                    <p className="mt-1 text-[11px] text-slate-500">
                      Indicators:{' '}
                      <span className="font-medium text-slate-700">
                        {s.performanceIndicators.join(' · ') || '—'}
                      </span>
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

      {state.governance.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-8 text-center">
          <p className="text-sm font-medium text-slate-800">No governance standards yet</p>
          <p className="mt-1 text-xs text-slate-500">
            Generate governance and KPI-linked measurement standards grounded in your brand voice and Marketing KPIs, or add one manually.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {state.governance.map((item) => {
            const isEditing = editingIds[item.id] === true;
            const errs = errorsMap[item.id] ?? {};
            return (
              <article
                key={item.id}
                data-testid="content-governance-card"
                className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 space-y-4"
              >
                <div className="flex flex-col justify-between gap-3 border-b border-slate-100 pb-3 sm:flex-row sm:items-start">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="text-sm font-semibold text-slate-900">
                        {item.title || 'Untitled Governance Standard'}
                      </h4>
                      <GovernanceCategoryBadge category={item.category} />
                      <ApprovalBadge approved={item.approved} />
                    </div>
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
                        onClick={() => onUnapproveGovernance(item.id)}
                        className="inline-flex min-h-[34px] items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs font-medium text-amber-800 hover:bg-amber-100"
                      >
                        Move to Draft
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onApproveGovernance(item)}
                        className="inline-flex min-h-[34px] items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
                      >
                        <Check className="h-3.5 w-3.5" />
                        <span>Approve Standard</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => onRequestDeleteGovernance(item)}
                      aria-label={`Delete governance standard ${item.title || 'Untitled'}`}
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
                        Standard Title *
                      </label>
                      <input
                        type="text"
                        value={item.title}
                        onChange={(e) => onUpdateGovernance(item.id, { title: e.target.value })}
                        className={fieldClass(Boolean(errs.title))}
                      />
                      {errs.title && <p className="mt-1 text-xs text-red-600">{errs.title}</p>}
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700">
                        Category *
                      </label>
                      <select
                        value={item.category}
                        onChange={(e) =>
                          onUpdateGovernance(item.id, {
                            category: e.target.value as GovernanceCategory,
                          })
                        }
                        className={fieldClass(false)}
                      >
                        <option value="quality_standard">Quality Standard</option>
                        <option value="voice_and_messaging">Voice &amp; Messaging</option>
                        <option value="editorial_workflow">Editorial Workflow</option>
                        <option value="performance_measurement">Performance Measurement</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700">
                        Quality Standards (one per line) *
                      </label>
                      <textarea
                        rows={2}
                        value={item.qualityStandards.join('\n')}
                        onChange={(e) =>
                          onUpdateGovernance(item.id, {
                            qualityStandards: linesToArray(e.target.value),
                          })
                        }
                        className={fieldClass(Boolean(errs.qualityStandards))}
                      />
                      {errs.qualityStandards && (
                        <p className="mt-1 text-xs text-red-600">{errs.qualityStandards}</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700">
                        Editorial Guidelines (one per line) *
                      </label>
                      <textarea
                        rows={2}
                        value={item.editorialGuidelines.join('\n')}
                        onChange={(e) =>
                          onUpdateGovernance(item.id, {
                            editorialGuidelines: linesToArray(e.target.value),
                          })
                        }
                        className={fieldClass(Boolean(errs.editorialGuidelines))}
                      />
                      {errs.editorialGuidelines && (
                        <p className="mt-1 text-xs text-red-600">{errs.editorialGuidelines}</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700">
                        Brand Voice Compliance *
                      </label>
                      <textarea
                        rows={2}
                        value={item.brandVoiceCompliance}
                        onChange={(e) =>
                          onUpdateGovernance(item.id, { brandVoiceCompliance: e.target.value })
                        }
                        className={fieldClass(Boolean(errs.brandVoiceCompliance))}
                      />
                      {errs.brandVoiceCompliance && (
                        <p className="mt-1 text-xs text-red-600">{errs.brandVoiceCompliance}</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700">
                        Messaging Consistency *
                      </label>
                      <textarea
                        rows={2}
                        value={item.messagingConsistency}
                        onChange={(e) =>
                          onUpdateGovernance(item.id, { messagingConsistency: e.target.value })
                        }
                        className={fieldClass(Boolean(errs.messagingConsistency))}
                      />
                      {errs.messagingConsistency && (
                        <p className="mt-1 text-xs text-red-600">{errs.messagingConsistency}</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700">
                        Approval Considerations *
                      </label>
                      <input
                        type="text"
                        value={item.approvalConsiderations}
                        onChange={(e) =>
                          onUpdateGovernance(item.id, { approvalConsiderations: e.target.value })
                        }
                        className={fieldClass(Boolean(errs.approvalConsiderations))}
                      />
                      {errs.approvalConsiderations && (
                        <p className="mt-1 text-xs text-red-600">{errs.approvalConsiderations}</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700">
                        Marketing Objective Alignment *
                      </label>
                      <input
                        type="text"
                        value={item.marketingObjectiveAlignment}
                        onChange={(e) =>
                          onUpdateGovernance(item.id, {
                            marketingObjectiveAlignment: e.target.value,
                          })
                        }
                        className={fieldClass(Boolean(errs.marketingObjectiveAlignment))}
                      />
                      {errs.marketingObjectiveAlignment && (
                        <p className="mt-1 text-xs text-red-600">
                          {errs.marketingObjectiveAlignment}
                        </p>
                      )}
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold text-slate-700">
                        KPI-Linked Performance Indicators (one per line) *
                      </label>
                      <textarea
                        rows={2}
                        value={item.performanceIndicators.join('\n')}
                        onChange={(e) =>
                          onUpdateGovernance(item.id, {
                            performanceIndicators: linesToArray(e.target.value),
                          })
                        }
                        className={fieldClass(Boolean(errs.performanceIndicators))}
                      />
                      {errs.performanceIndicators && (
                        <p className="mt-1 text-xs text-red-600">{errs.performanceIndicators}</p>
                      )}
                    </div>
                  </div>
                ) : (
                  <dl className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-2 lg:grid-cols-3">
                    <div>
                      <dt className="font-medium text-slate-500">Quality Standards</dt>
                      <dd className="mt-0.5 text-slate-800">
                        {item.qualityStandards.join(' · ') || '—'}
                      </dd>
                    </div>
                    <div>
                      <dt className="font-medium text-slate-500">Brand Voice Compliance</dt>
                      <dd className="mt-0.5 text-slate-800">{item.brandVoiceCompliance || '—'}</dd>
                    </div>
                    <div>
                      <dt className="font-medium text-slate-500">Messaging Consistency</dt>
                      <dd className="mt-0.5 text-slate-800">{item.messagingConsistency || '—'}</dd>
                    </div>
                    <div>
                      <dt className="font-medium text-slate-500">Editorial Guidelines</dt>
                      <dd className="mt-0.5 text-slate-800">
                        {item.editorialGuidelines.join(' · ') || '—'}
                      </dd>
                    </div>
                    <div>
                      <dt className="font-medium text-slate-500">Approval Considerations</dt>
                      <dd className="mt-0.5 text-slate-800">
                        {item.approvalConsiderations || '—'}
                      </dd>
                    </div>
                    <div>
                      <dt className="font-medium text-slate-500">Performance Indicators</dt>
                      <dd className="mt-0.5 text-slate-800">
                        {item.performanceIndicators.join(' · ') || '—'}
                      </dd>
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
          <span>Back: Distribution</span>
        </button>
        <button
          type="button"
          onClick={onNext}
          className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
        >
          <span>Next: Review &amp; Complete</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </section>
  );
}

// ============================================================================
// 07. REVIEW & COMPLETE PANEL
// ============================================================================

export function ContentReviewCompletePanel({
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
  state: ContentStrategyState;
  moduleStatus: ModuleStatus;
  progress: ContentStrategyProgressSummary;
  completionCheck: {
    allowed: boolean;
    blockers: string[];
  };
  saving: boolean;
  onJumpToSection: (step: ContentStrategyStepKey) => void;
  onCompleteModule: () => void;
  onPrev: () => void;
}) {
  const approvedObjectives = state.objectives.filter((o) => o.approved);
  const approvedPillars = state.pillars.filter((p) => p.approved);
  const approvedThemes = state.themes.filter((t) => t.approved);
  const approvedFormats = state.formats.filter((f) => f.approved);
  const approvedSeries = state.series.filter((s) => s.approved);
  const approvedDistribution = state.distribution.filter((d) => d.approved);
  const approvedGovernance = state.governance.filter((g) => g.approved);

  const sectionTotals: Record<string, string> = {
    objectives: `${progress.approvedCounts.objectives} approved / ${state.objectives.length} total`,
    pillars: `${progress.approvedCounts.pillars} approved / ${state.pillars.length} total`,
    themes: `${progress.approvedCounts.themes} approved / ${state.themes.length} total`,
    formats: `${progress.approvedCounts.formats} formats · ${progress.approvedCounts.series} series approved`,
    distribution: `${progress.approvedCounts.distribution} approved / ${state.distribution.length} total`,
    governance: `${progress.approvedCounts.governance} approved / ${state.governance.length} total`,
  };

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6 space-y-6">
      <div className="flex flex-col justify-between gap-4 border-b border-slate-100 pb-4 sm:flex-row sm:items-center">
        <div>
          <h3 className="text-base font-semibold text-slate-900">
            07. Consolidated Content Strategy Review
          </h3>
          <p className="mt-0.5 text-xs text-slate-500">
            Verify all six approved editorial strategy sections for {brandName} before marking Content Strategy completed.
          </p>
        </div>

        <button
          type="button"
          data-testid="complete-content-strategy-btn"
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
              ? 'Update Completed Content Strategy'
              : 'Approve & Complete Content Strategy'}
          </span>
        </button>
      </div>

      {!completionCheck.allowed && (
        <div
          data-testid="content-strategy-completion-blockers"
          className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-950 space-y-2"
        >
          <div className="flex items-center gap-2 font-semibold">
            <AlertTriangle className="h-4 w-4 text-amber-700 shrink-0" />
            <span>Action required before completing Content Strategy:</span>
          </div>
          <ul className="list-disc space-y-1 pl-5 text-amber-900">
            {completionCheck.blockers.map((blocker, idx) => (
              <li key={idx}>{blocker}</li>
            ))}
          </ul>
        </div>
      )}

      {progress.pendingSuggestionsCount > 0 && (
        <div className="rounded-xl border border-blue-200 bg-blue-50/50 px-4 py-3 text-xs text-blue-900">
          There {progress.pendingSuggestionsCount === 1 ? 'is' : 'are'}{' '}
          <strong>{progress.pendingSuggestionsCount}</strong> unreviewed AI suggestion
          {progress.pendingSuggestionsCount === 1 ? '' : 's'} remaining in review queues. Unadopted
          suggestions are never included in your approved strategy.
        </div>
      )}

      {/* 6-Section Approval Matrix */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {CONTENT_STRATEGY_SECTIONS.map((sec) => {
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
                  {sectionTotals[sec.key]}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onJumpToSection(sec.key)}
                className="mt-3 self-start text-xs font-semibold text-blue-600 hover:text-blue-700"
              >
                Review {sec.shortTitle} →
              </button>
            </div>
          );
        })}
      </div>

      {/* Approved Strategy Snapshot */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-200 p-4 space-y-2">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Approved Content Objectives ({approvedObjectives.length})
          </h4>
          {approvedObjectives.length === 0 ? (
            <p className="text-xs text-slate-500">No approved objectives yet.</p>
          ) : (
            <ul className="space-y-1.5 text-xs text-slate-800">
              {approvedObjectives.map((o) => (
                <li key={o.id}>
                  <span className="font-semibold">{o.title}</span> ({o.level})
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 p-4 space-y-2">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Approved Content Pillars ({approvedPillars.length})
          </h4>
          {approvedPillars.length === 0 ? (
            <p className="text-xs text-slate-500">No approved pillars yet.</p>
          ) : (
            <ul className="space-y-1.5 text-xs text-slate-800">
              {approvedPillars.map((p) => (
                <li key={p.id}>
                  <span className="font-semibold">{p.name}</span> — {p.targetAudienceSegment}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 p-4 space-y-2">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Approved Themes &amp; Topics ({approvedThemes.length})
          </h4>
          {approvedThemes.length === 0 ? (
            <p className="text-xs text-slate-500">No approved themes yet.</p>
          ) : (
            <ul className="space-y-1.5 text-xs text-slate-800">
              {approvedThemes.map((t) => (
                <li key={t.id}>
                  <span className="font-semibold">{t.title}</span> ({t.associatedPillarName})
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 p-4 space-y-2">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Approved Formats ({approvedFormats.length}) &amp; Series ({approvedSeries.length})
          </h4>
          {approvedFormats.length === 0 && approvedSeries.length === 0 ? (
            <p className="text-xs text-slate-500">No approved formats or series yet.</p>
          ) : (
            <ul className="space-y-1.5 text-xs text-slate-800">
              {approvedFormats.map((f) => (
                <li key={f.id}>
                  <span className="font-semibold">{f.formatName}</span> (Format)
                </li>
              ))}
              {approvedSeries.map((s) => (
                <li key={s.id}>
                  <span className="font-semibold">{s.seriesName}</span> (Series ·{' '}
                  {s.cadenceHint || s.formatName})
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 p-4 space-y-2">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Approved Distribution Plans ({approvedDistribution.length})
          </h4>
          {approvedDistribution.length === 0 ? (
            <p className="text-xs text-slate-500">No approved distribution plans yet.</p>
          ) : (
            <ul className="space-y-1.5 text-xs text-slate-800">
              {approvedDistribution.map((d) => (
                <li key={d.id}>
                  <span className="font-semibold">{d.platformName}</span> — {d.recommendedFrequency}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 p-4 space-y-2">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Approved Governance Standards ({approvedGovernance.length})
          </h4>
          {approvedGovernance.length === 0 ? (
            <p className="text-xs text-slate-500">No approved governance standards yet.</p>
          ) : (
            <ul className="space-y-1.5 text-xs text-slate-800">
              {approvedGovernance.map((g) => (
                <li key={g.id}>
                  <span className="font-semibold">{g.title}</span> (
                  {GOVERNANCE_CATEGORY_LABELS[g.category]})
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-slate-100 pt-4">
        <button
          type="button"
          onClick={onPrev}
          className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Back: Governance &amp; Measurement</span>
        </button>
      </div>
    </section>
  );
}
