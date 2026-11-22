import { useEffect, useState } from 'react';
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Copy,
  History,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Send,
  Square,
  Trash2,
  Wand2,
} from 'lucide-react';
import type {
  ContentArticleSection,
  ContentAssetBody,
  ContentAssetStatus,
  ContentAssetVersion,
  ContentAssetWithVersions,
  ContentCarouselSlide,
  ContentStudioRefinementAction,
  ContentVideoScene,
} from '../../types/brand';
import {
  CONTENT_ASSET_STATUSES,
  CONTENT_STUDIO_REFINEMENT_ACTIONS,
  formatAssetAsPlainText,
  getFormatCategoryLabel,
  requiresVersionSnapshotOnBodyEdit,
} from '../../utils/contentStudioLogic';

interface ContentStudioEditorProps {
  asset: ContentAssetWithVersions;
  approvedPlatforms: string[];
  saving: boolean;
  refining: boolean;
  activeRefineAction: ContentStudioRefinementAction | null;
  refineError: string | null;
  onSaveDraft: (
    title: string,
    body: ContentAssetBody,
    options?: { createVersion?: boolean; changeSummary?: string },
  ) => Promise<void>;
  onChangeStatus: (nextStatus: ContentAssetStatus) => Promise<void>;
  onRefineWithAi: (
    action: ContentStudioRefinementAction,
    draftSnapshot: { title: string; body: ContentAssetBody },
    params?: {
      targetPlatform?: string;
      targetTone?: string;
      instructions?: string;
      selectedSectionText?: string;
    },
  ) => Promise<void>;
  onCancelRefine: () => void;
  onRestoreVersion: (version: ContentAssetVersion) => Promise<void>;
  onDuplicate: () => Promise<void>;
  onOpenCalendar?: () => void;
  onCopySuccess: (message: string) => void;
}

const STATUS_STYLE_MAP: Record<ContentAssetStatus, string> = {
  draft: 'text-slate-700',
  in_progress: 'text-indigo-700',
  ready_for_review: 'text-amber-700',
  approved: 'text-emerald-700',
  published: 'text-slate-900 font-semibold',
  archived: 'text-slate-400',
};

function getStatusLabel(status: ContentAssetStatus): string {
  return CONTENT_ASSET_STATUSES.find((s) => s.value === status)?.label ?? status;
}

export function ContentStudioEditor({
  asset,
  approvedPlatforms,
  saving,
  refining,
  activeRefineAction,
  refineError,
  onSaveDraft,
  onChangeStatus,
  onRefineWithAi,
  onCancelRefine,
  onRestoreVersion,
  onDuplicate,
  onOpenCalendar,
  onCopySuccess,
}: ContentStudioEditorProps) {
  const [title, setTitle] = useState(asset.title);
  const [body, setBody] = useState<ContentAssetBody>(asset.body);
  const [hashtagsText, setHashtagsText] = useState(asset.body.hashtags.join(' '));
  const [dirty, setDirty] = useState(false);

  // Refinement controls
  const [expandedRefineAction, setExpandedRefineAction] =
    useState<ContentStudioRefinementAction | null>(null);
  const [targetPlatform, setTargetPlatform] = useState(
    approvedPlatforms.find((p) => p.toLowerCase() !== asset.platform.toLowerCase()) ||
      approvedPlatforms[0] ||
      'LinkedIn',
  );
  const [targetTone, setTargetTone] = useState(asset.toneOfVoice || '');
  const [refineInstructions, setRefineInstructions] = useState('');
  const [selectedSectionText, setSelectedSectionText] = useState('');

  // Version history panel
  const [showHistory, setShowHistory] = useState(false);
  const [previewVersionId, setPreviewVersionId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setTitle(asset.title);
    setBody(asset.body);
    setHashtagsText(asset.body.hashtags.join(' '));
    setTargetTone(asset.toneOfVoice || '');
    setDirty(false);
    setPreviewVersionId(null);
  }, [asset.id, asset.currentVersionNumber, asset.updatedAt]);

  const isProtected = requiresVersionSnapshotOnBodyEdit(asset.workflowStatus);

  const updateBodyField = <K extends keyof ContentAssetBody>(
    key: K,
    value: ContentAssetBody[K],
  ) => {
    setBody((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  };

  const buildCurrentBody = (): ContentAssetBody => {
    const parsedTags = hashtagsText
      .split(/[\s,]+/)
      .map((t) => t.trim())
      .filter(Boolean)
      .map((t) => (t.startsWith('#') ? t : `#${t}`));
    return {
      ...body,
      hashtags: Array.from(new Set(parsedTags)),
    };
  };

  const handleSave = async (createVersion = false) => {
    const currentBody = buildCurrentBody();
    await onSaveDraft(title.trim() || asset.title, currentBody, {
      createVersion,
      changeSummary: createVersion ? 'Manual version snapshot saved' : undefined,
    });
    setDirty(false);
  };

  const handleTriggerRefine = async (action: ContentStudioRefinementAction) => {
    if (
      action === 'adjust_tone' ||
      action === 'adapt_platform' ||
      action === 'refine_section'
    ) {
      setExpandedRefineAction((prev) => (prev === action ? null : action));
      return;
    }
    setExpandedRefineAction(null);
    await onRefineWithAi(action, {
      title: title.trim() || asset.title,
      body: buildCurrentBody(),
    });
  };

  const handleRunConfiguredRefine = async () => {
    if (!expandedRefineAction) return;
    await onRefineWithAi(
      expandedRefineAction,
      {
        title: title.trim() || asset.title,
        body: buildCurrentBody(),
      },
      {
        targetPlatform: expandedRefineAction === 'adapt_platform' ? targetPlatform : undefined,
        targetTone: expandedRefineAction === 'adjust_tone' ? targetTone : undefined,
        instructions: refineInstructions,
        selectedSectionText:
          expandedRefineAction === 'refine_section' ? selectedSectionText : undefined,
      },
    );
    setExpandedRefineAction(null);
    setRefineInstructions('');
    setSelectedSectionText('');
  };

  const handleCopyPlainText = async () => {
    const text = formatAssetAsPlainText({
      ...asset,
      title: title.trim() || asset.title,
      body: buildCurrentBody(),
    });
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      onCopySuccess('Copied formatted content to clipboard.');
      setTimeout(() => setCopied(false), 1800);
    } catch {
      onCopySuccess('Select and copy directly from the editor fields.');
    }
  };

  // Carousel helpers
  const updateSlide = (index: number, patch: Partial<ContentCarouselSlide>) => {
    const next = body.carouselSlides.map((slide, idx) =>
      idx === index ? { ...slide, ...patch } : slide,
    );
    updateBodyField('carouselSlides', next);
  };

  const addSlide = () => {
    const nextNum = body.carouselSlides.length + 1;
    updateBodyField('carouselSlides', [
      ...body.carouselSlides,
      { slideNumber: nextNum, headline: `Slide ${nextNum}`, body: '', visualCue: '' },
    ]);
  };

  const removeSlide = (index: number) => {
    const next = body.carouselSlides
      .filter((_, idx) => idx !== index)
      .map((s, idx) => ({ ...s, slideNumber: idx + 1 }));
    updateBodyField('carouselSlides', next);
  };

  // Video script helpers
  const ensureVideoScript = () =>
    body.videoScript ?? {
      hook: body.hook || '',
      scenes: [{ sceneNumber: 1, visual: '', dialogue: '', durationHint: '5s' }],
      cta: body.cta || '',
    };

  const updateVideoScene = (index: number, patch: Partial<ContentVideoScene>) => {
    const current = ensureVideoScript();
    const nextScenes = current.scenes.map((sc, idx) =>
      idx === index ? { ...sc, ...patch } : sc,
    );
    updateBodyField('videoScript', { ...current, scenes: nextScenes });
  };

  const addVideoScene = () => {
    const current = ensureVideoScript();
    const nextNum = current.scenes.length + 1;
    updateBodyField('videoScript', {
      ...current,
      scenes: [
        ...current.scenes,
        { sceneNumber: nextNum, visual: '', dialogue: '', durationHint: '5–8s' },
      ],
    });
  };

  const removeVideoScene = (index: number) => {
    const current = ensureVideoScript();
    const nextScenes = current.scenes
      .filter((_, idx) => idx !== index)
      .map((sc, idx) => ({ ...sc, sceneNumber: idx + 1 }));
    updateBodyField('videoScript', { ...current, scenes: nextScenes });
  };

  // Article section helpers
  const updateArticleSection = (index: number, patch: Partial<ContentArticleSection>) => {
    const next = body.articleSections.map((sec, idx) =>
      idx === index ? { ...sec, ...patch } : sec,
    );
    updateBodyField('articleSections', next);
  };

  const addArticleSection = () => {
    updateBodyField('articleSections', [
      ...body.articleSections,
      { heading: `Section ${body.articleSections.length + 1}`, body: '' },
    ]);
  };

  const removeArticleSection = (index: number) => {
    updateBodyField(
      'articleSections',
      body.articleSections.filter((_, idx) => idx !== index),
    );
  };

  const previewVersion = asset.versions.find((v) => v.id === previewVersionId) ?? null;

  return (
    <div className="space-y-6">
      {/* Top Workflow & Approval Bar */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
              <span className={STATUS_STYLE_MAP[asset.workflowStatus]}>
                {getStatusLabel(asset.workflowStatus)}
              </span>
              <span aria-hidden="true">·</span>
              <span className="tabular-nums">Version {asset.currentVersionNumber}</span>
              {asset.approvedVersionNumber !== null && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="text-emerald-700 tabular-nums">
                    Approved v{asset.approvedVersionNumber}
                  </span>
                </>
              )}
              <span aria-hidden="true">·</span>
              <span>{asset.platform}</span>
              <span aria-hidden="true">·</span>
              <span>{asset.formatLabel || getFormatCategoryLabel(asset.formatCategory)}</span>
              {asset.scheduledDate && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="tabular-nums">Scheduled {asset.scheduledDate}</span>
                </>
              )}
            </div>
            <p className="mt-1 text-xs text-slate-500">
              {asset.contentPillar ? `Pillar: ${asset.contentPillar}` : 'Standalone brief'}
              {asset.targetAudience ? ` · Audience: ${asset.targetAudience}` : ''}
              {asset.calendarItemId && onOpenCalendar ? (
                <>
                  {' · '}
                  <button
                    type="button"
                    onClick={onOpenCalendar}
                    className="font-medium text-blue-700 hover:underline"
                  >
                    View Calendar
                  </button>
                </>
              ) : null}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void handleSave(false)}
              disabled={saving || refining}
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 whitespace-nowrap shrink-0"
            >
              <Save className="h-3.5 w-3.5" strokeWidth={1.75} />
              <span>{dirty ? 'Save Changes' : 'Save'}</span>
            </button>

            <button
              type="button"
              onClick={() => void handleSave(true)}
              disabled={saving || refining}
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 whitespace-nowrap shrink-0"
            >
              <History className="h-3.5 w-3.5" strokeWidth={1.75} />
              <span>Save Snapshot</span>
            </button>

            {asset.workflowStatus !== 'ready_for_review' &&
              asset.workflowStatus !== 'approved' &&
              asset.workflowStatus !== 'published' && (
                <button
                  type="button"
                  onClick={() => void onChangeStatus('ready_for_review')}
                  disabled={saving || refining}
                  className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3.5 py-2 text-xs font-medium text-amber-800 hover:bg-amber-100 disabled:opacity-50 whitespace-nowrap shrink-0"
                >
                  <Send className="h-3.5 w-3.5" strokeWidth={1.75} />
                  <span>Submit for Review</span>
                </button>
              )}

            {asset.workflowStatus !== 'approved' && asset.workflowStatus !== 'published' && (
              <button
                type="button"
                onClick={() => void onChangeStatus('approved')}
                disabled={saving || refining}
                className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50 whitespace-nowrap shrink-0"
              >
                <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                <span>Approve Content</span>
              </button>
            )}

            {asset.workflowStatus === 'approved' && (
              <button
                type="button"
                onClick={() => void onChangeStatus('published')}
                disabled={saving || refining}
                className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50 whitespace-nowrap shrink-0"
              >
                <Check className="h-3.5 w-3.5" strokeWidth={1.75} />
                <span>Mark Published</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => void handleCopyPlainText()}
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
            >
              {copied ? (
                <Check className="h-3.5 w-3.5 text-emerald-600" strokeWidth={1.75} />
              ) : (
                <Copy className="h-3.5 w-3.5" strokeWidth={1.75} />
              )}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>

            <button
              type="button"
              onClick={() => setShowHistory((prev) => !prev)}
              className={`inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium whitespace-nowrap shrink-0 ${
                showHistory
                  ? 'border-blue-300 bg-blue-50 text-blue-700'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              <History className="h-3.5 w-3.5" strokeWidth={1.75} />
              <span className="tabular-nums">History ({asset.versions.length})</span>
            </button>

            <button
              type="button"
              onClick={() => void onDuplicate()}
              disabled={saving || refining}
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 whitespace-nowrap shrink-0"
            >
              <Copy className="h-3.5 w-3.5" strokeWidth={1.75} />
              <span>Duplicate</span>
            </button>
          </div>
        </div>

        {isProtected && (
          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50/70 px-3.5 py-2.5 text-xs text-amber-900">
            This asset is currently <strong>{getStatusLabel(asset.workflowStatus)}</strong>. Saving copy edits or running AI refinements will automatically create a new draft version so the approved snapshot remains preserved in Version History.
          </div>
        )}
      </div>

      {/* Inline AI Refinement Toolbar */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Wand2 className="h-4 w-4 text-blue-600 shrink-0" strokeWidth={1.75} />
            <h3 className="text-sm font-semibold text-slate-900">AI Refinement Tools</h3>
            <span className="text-xs text-slate-500">
              Each refinement saves a new version automatically
            </span>
          </div>

          {refining && (
            <button
              type="button"
              onClick={onCancelRefine}
              className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-100 whitespace-nowrap shrink-0"
            >
              <Square className="h-3 w-3" strokeWidth={2} />
              <span>Cancel AI Run</span>
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {CONTENT_STUDIO_REFINEMENT_ACTIONS.map((item) => {
            const isActive =
              (refining && activeRefineAction === item.action) ||
              expandedRefineAction === item.action;
            return (
              <button
                key={item.action}
                type="button"
                disabled={refining || saving}
                onClick={() => void handleTriggerRefine(item.action)}
                title={item.description}
                className={`inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 whitespace-nowrap shrink-0 ${
                  isActive
                    ? 'border-blue-600 bg-blue-50 text-blue-700'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                {refining && activeRefineAction === item.action ? (
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" strokeWidth={1.75} />
                ) : null}
                <span>{item.shortLabel}</span>
              </button>
            );
          })}
        </div>

        {/* Expanded sub-form for Tone / Platform Adaptation / Section Refinement */}
        {expandedRefineAction && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-3">
            {expandedRefineAction === 'adapt_platform' && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Target Platform
                  </label>
                  <select
                    value={targetPlatform}
                    onChange={(e) => setTargetPlatform(e.target.value)}
                    className="w-full min-h-[40px] rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-600 focus:outline-none"
                  >
                    {Array.from(
                      new Set([
                        ...approvedPlatforms,
                        'LinkedIn',
                        'Instagram',
                        'X / Twitter',
                        'TikTok',
                        'Email Newsletter',
                        'Blog / Website',
                      ]),
                    ).map((plat) => (
                      <option key={plat} value={plat}>
                        {plat}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Adaptation Notes (optional)
                  </label>
                  <input
                    type="text"
                    value={refineInstructions}
                    onChange={(e) => setRefineInstructions(e.target.value)}
                    placeholder="e.g., Convert into a concise 4-line founder post"
                    className="w-full min-h-[40px] rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-600 focus:outline-none"
                  />
                </div>
              </div>
            )}

            {expandedRefineAction === 'adjust_tone' && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Target Tone / Writing Style
                  </label>
                  <input
                    type="text"
                    value={targetTone}
                    onChange={(e) => setTargetTone(e.target.value)}
                    placeholder="e.g., Direct executive, warm conversational, punchy tactical"
                    className="w-full min-h-[40px] rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Additional Guidance (optional)
                  </label>
                  <input
                    type="text"
                    value={refineInstructions}
                    onChange={(e) => setRefineInstructions(e.target.value)}
                    placeholder="e.g., Keep sentences under 15 words"
                    className="w-full min-h-[40px] rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-600 focus:outline-none"
                  />
                </div>
              </div>
            )}

            {expandedRefineAction === 'refine_section' && (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Paste the Section or Paragraph to Refine
                  </label>
                  <textarea
                    rows={3}
                    value={selectedSectionText}
                    onChange={(e) => setSelectedSectionText(e.target.value)}
                    placeholder="Paste the specific hook, slide, scene, or paragraph you want improved..."
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    How should this section change?
                  </label>
                  <input
                    type="text"
                    value={refineInstructions}
                    onChange={(e) => setRefineInstructions(e.target.value)}
                    placeholder="e.g., Make the opening sharper and remove generic phrasing"
                    className="w-full min-h-[40px] rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-600 focus:outline-none"
                  />
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setExpandedRefineAction(null)}
                className="min-h-[38px] rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={refining}
                onClick={() => void handleRunConfiguredRefine()}
                className="min-h-[38px] rounded-lg bg-blue-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                Run Refinement
              </button>
            </div>
          </div>
        )}

        {refineError && (
          <div className="flex items-start gap-2.5 rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs text-rose-800">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" strokeWidth={1.75} />
            <span>{refineError}</span>
          </div>
        )}
      </div>

      {/* Main Editor + Optional Version History Split */}
      <div className={`grid grid-cols-1 gap-6 ${showHistory ? 'xl:grid-cols-12' : ''}`}>
        <div className={`${showHistory ? 'xl:col-span-8' : ''} space-y-5`}>
          <div className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6 space-y-5">
            {/* Title */}
            <div>
              <label
                htmlFor="studio-asset-title"
                className="block text-xs font-semibold text-slate-700 mb-1.5"
              >
                Asset Title
              </label>
              <input
                id="studio-asset-title"
                type="text"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  setDirty(true);
                }}
                className="w-full min-h-[42px] rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-base font-semibold text-slate-900 focus:border-blue-600 focus:outline-none"
              />
            </div>

            {/* Opening Hook + Alternative Hooks */}
            <div className="space-y-2.5">
              <label
                htmlFor="studio-asset-hook"
                className="block text-xs font-semibold text-slate-700"
              >
                Opening Hook / Headline
              </label>
              <textarea
                id="studio-asset-hook"
                rows={2}
                value={body.hook}
                onChange={(e) => updateBodyField('hook', e.target.value)}
                placeholder="Write a scroll-stopping opening line..."
                className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
              />

              {body.alternativeHooks.length > 0 && (
                <div className="pt-1 space-y-1.5">
                  <p className="text-xs font-medium text-slate-500">
                    Alternative hooks (click to swap into Opening Hook)
                  </p>
                  <div className="space-y-1.5">
                    {body.alternativeHooks.map((altHook, idx) => (
                      <button
                        key={`${idx}-${altHook.slice(0, 20)}`}
                        type="button"
                        onClick={() => updateBodyField('hook', altHook)}
                        className="w-full text-left rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700 hover:border-blue-300 hover:bg-blue-50/40 transition-colors"
                      >
                        {altHook}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Format-Specific Structured Editor: Carousel */}
            {asset.formatCategory === 'carousel' && (
              <div className="space-y-3 border-t border-slate-200 pt-5">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <h4 className="text-sm font-semibold text-slate-900">
                      Carousel Slides ({body.carouselSlides.length})
                    </h4>
                    <p className="text-xs text-slate-500">
                      Edit individual slide headlines, copy, and visual cues.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={addSlide}
                    className="inline-flex min-h-[36px] items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
                  >
                    <Plus className="h-3.5 w-3.5" strokeWidth={1.75} />
                    <span>Add Slide</span>
                  </button>
                </div>

                {body.carouselSlides.length === 0 ? (
                  <p className="text-xs text-slate-500 py-2">
                    No slides yet. Click Add Slide or regenerate for carousel structure.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {body.carouselSlides.map((slide, idx) => (
                      <div
                        key={idx}
                        className="rounded-lg border border-slate-200 bg-slate-50/70 p-3.5 space-y-2.5"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold text-slate-700 tabular-nums">
                            Slide {slide.slideNumber}
                          </span>
                          <button
                            type="button"
                            onClick={() => removeSlide(idx)}
                            aria-label={`Remove slide ${slide.slideNumber}`}
                            className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-rose-600"
                          >
                            <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                            <span>Remove</span>
                          </button>
                        </div>
                        <input
                          type="text"
                          value={slide.headline}
                          onChange={(e) => updateSlide(idx, { headline: e.target.value })}
                          placeholder="Slide headline"
                          className="w-full min-h-[38px] rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-900 focus:border-blue-600 focus:outline-none"
                        />
                        <textarea
                          rows={2}
                          value={slide.body}
                          onChange={(e) => updateSlide(idx, { body: e.target.value })}
                          placeholder="Slide body copy"
                          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-800 focus:border-blue-600 focus:outline-none"
                        />
                        <input
                          type="text"
                          value={slide.visualCue}
                          onChange={(e) => updateSlide(idx, { visualCue: e.target.value })}
                          placeholder="Visual / layout cue for designer"
                          className="w-full min-h-[36px] rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 focus:border-blue-600 focus:outline-none"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Format-Specific Structured Editor: Short-Form Video Script */}
            {asset.formatCategory === 'short_video_script' && (
              <div className="space-y-3 border-t border-slate-200 pt-5">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <h4 className="text-sm font-semibold text-slate-900">
                      Video Script Scenes ({body.videoScript?.scenes.length ?? 0})
                    </h4>
                    <p className="text-xs text-slate-500">
                      Scene-by-scene visual directions, spoken dialogue, and pacing hints.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={addVideoScene}
                    className="inline-flex min-h-[36px] items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
                  >
                    <Plus className="h-3.5 w-3.5" strokeWidth={1.75} />
                    <span>Add Scene</span>
                  </button>
                </div>

                {(body.videoScript?.scenes ?? []).map((scene, idx) => (
                  <div
                    key={idx}
                    className="rounded-lg border border-slate-200 bg-slate-50/70 p-3.5 space-y-2.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-slate-700 tabular-nums">
                        Scene {scene.sceneNumber}
                      </span>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={scene.durationHint}
                          onChange={(e) =>
                            updateVideoScene(idx, { durationHint: e.target.value })
                          }
                          placeholder="5–8s"
                          className="w-20 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 tabular-nums focus:border-blue-600 focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => removeVideoScene(idx)}
                          className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-rose-600"
                        >
                          <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                          <span>Remove</span>
                        </button>
                      </div>
                    </div>
                    <input
                      type="text"
                      value={scene.visual}
                      onChange={(e) => updateVideoScene(idx, { visual: e.target.value })}
                      placeholder="On-screen visual / B-roll / text overlay"
                      className="w-full min-h-[36px] rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 focus:border-blue-600 focus:outline-none"
                    />
                    <textarea
                      rows={2}
                      value={scene.dialogue}
                      onChange={(e) => updateVideoScene(idx, { dialogue: e.target.value })}
                      placeholder="Spoken script / voiceover line"
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                    />
                  </div>
                ))}
              </div>
            )}

            {/* Format-Specific Structured Editor: Long-Form Article Sections */}
            {asset.formatCategory === 'long_form_article' && (
              <div className="space-y-3 border-t border-slate-200 pt-5">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <h4 className="text-sm font-semibold text-slate-900">
                      Article Sections ({body.articleSections.length})
                    </h4>
                    <p className="text-xs text-slate-500">
                      Structured editorial headings and section body copy.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={addArticleSection}
                    className="inline-flex min-h-[36px] items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
                  >
                    <Plus className="h-3.5 w-3.5" strokeWidth={1.75} />
                    <span>Add Section</span>
                  </button>
                </div>

                {body.articleSections.map((sec, idx) => (
                  <div
                    key={idx}
                    className="rounded-lg border border-slate-200 bg-slate-50/70 p-3.5 space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <input
                        type="text"
                        value={sec.heading}
                        onChange={(e) =>
                          updateArticleSection(idx, { heading: e.target.value })
                        }
                        placeholder="Section heading"
                        className="flex-1 min-h-[38px] rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-900 focus:border-blue-600 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => removeArticleSection(idx)}
                        className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-rose-600 shrink-0"
                      >
                        <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                        <span>Remove</span>
                      </button>
                    </div>
                    <textarea
                      rows={4}
                      value={sec.body}
                      onChange={(e) => updateArticleSection(idx, { body: e.target.value })}
                      placeholder="Section paragraphs..."
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 leading-relaxed focus:border-blue-600 focus:outline-none"
                    />
                  </div>
                ))}
              </div>
            )}

            {/* Main Copy / Caption */}
            <div>
              <label
                htmlFor="studio-asset-main-copy"
                className="block text-xs font-semibold text-slate-700 mb-1.5"
              >
                {asset.formatCategory === 'carousel'
                  ? 'Accompanying Post Caption'
                  : asset.formatCategory === 'short_video_script'
                    ? 'Caption / Description'
                    : asset.formatCategory === 'long_form_article'
                      ? 'Article Introduction / Summary'
                      : 'Main Content Copy'}
              </label>
              <textarea
                id="studio-asset-main-copy"
                rows={8}
                value={body.mainCopy}
                onChange={(e) => updateBodyField('mainCopy', e.target.value)}
                placeholder="Write or refine your platform-ready content copy..."
                className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm leading-relaxed text-slate-900 focus:border-blue-600 focus:outline-none"
              />
            </div>

            {/* CTA & Hashtags */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label
                  htmlFor="studio-asset-cta"
                  className="block text-xs font-semibold text-slate-700 mb-1.5"
                >
                  Call to Action (CTA)
                </label>
                <input
                  id="studio-asset-cta"
                  type="text"
                  value={body.cta}
                  onChange={(e) => updateBodyField('cta', e.target.value)}
                  placeholder="Clear next step for the reader..."
                  className="w-full min-h-[40px] rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                />
              </div>
              <div>
                <label
                  htmlFor="studio-asset-hashtags"
                  className="block text-xs font-semibold text-slate-700 mb-1.5"
                >
                  Hashtags (space or comma separated)
                </label>
                <input
                  id="studio-asset-hashtags"
                  type="text"
                  value={hashtagsText}
                  onChange={(e) => {
                    setHashtagsText(e.target.value);
                    setDirty(true);
                  }}
                  placeholder="#BrandStrategy #ContentMarketing"
                  className="w-full min-h-[40px] rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                />
              </div>
            </div>

            {/* Visual Direction & Adaptation Notes */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label
                  htmlFor="studio-asset-visual"
                  className="block text-xs font-semibold text-slate-700 mb-1.5"
                >
                  Visual / Creative Direction
                </label>
                <textarea
                  id="studio-asset-visual"
                  rows={2}
                  value={body.visualDirection}
                  onChange={(e) => updateBodyField('visualDirection', e.target.value)}
                  placeholder="Image, layout, or motion direction..."
                  className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-800 focus:border-blue-600 focus:outline-none"
                />
              </div>
              <div>
                <label
                  htmlFor="studio-asset-adaptation"
                  className="block text-xs font-semibold text-slate-700 mb-1.5"
                >
                  Platform / Repurposing Notes
                </label>
                <textarea
                  id="studio-asset-adaptation"
                  rows={2}
                  value={body.adaptationNotes}
                  onChange={(e) => updateBodyField('adaptationNotes', e.target.value)}
                  placeholder="Optional channel-specific publishing notes..."
                  className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-800 focus:border-blue-600 focus:outline-none"
                />
              </div>
            </div>

            {/* Grounding Transparency Footer */}
            {(body.suppliedFactsUsed.length > 0 ||
              body.missingContextNotes.length > 0 ||
              body.researchCaveat) && (
              <div className="border-t border-slate-200 pt-4 space-y-2 text-xs text-slate-600">
                {body.suppliedFactsUsed.length > 0 && (
                  <div>
                    <span className="font-semibold text-slate-700">Verified facts used: </span>
                    <span>{body.suppliedFactsUsed.join(' · ')}</span>
                  </div>
                )}
                {body.missingContextNotes.length > 0 && (
                  <div>
                    <span className="font-semibold text-amber-800">Owner check / missing details: </span>
                    <span>{body.missingContextNotes.join(' · ')}</span>
                  </div>
                )}
                {body.researchCaveat && (
                  <p className="text-slate-500">{body.researchCaveat}</p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Version History Sidebar */}
        {showHistory && (
          <aside className="xl:col-span-4 space-y-4">
            <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-slate-900">
                  Version History ({asset.versions.length})
                </h3>
                <button
                  type="button"
                  onClick={() => setShowHistory(false)}
                  className="text-xs font-medium text-slate-500 hover:text-slate-900"
                >
                  Close
                </button>
              </div>

              <div className="space-y-2.5 max-h-[520px] overflow-y-auto pr-1">
                {asset.versions.map((ver) => {
                  const isCurrent = ver.versionNumber === asset.currentVersionNumber;
                  const isApprovedVer = ver.versionNumber === asset.approvedVersionNumber;
                  const isSelected = previewVersionId === ver.id;
                  return (
                    <div
                      key={ver.id}
                      className={`rounded-lg border p-3 space-y-1.5 ${
                        isSelected
                          ? 'border-blue-300 bg-blue-50/40'
                          : 'border-slate-200 bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-900 tabular-nums">
                          <span>v{ver.versionNumber}</span>
                          {isCurrent && (
                            <span className="text-blue-700 font-medium">· Current</span>
                          )}
                          {isApprovedVer && (
                            <span className="text-emerald-700 font-medium">· Approved</span>
                          )}
                        </div>
                        <span className="text-[11px] text-slate-400 tabular-nums">
                          {new Date(ver.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600">{ver.changeSummary || ver.actionType}</p>
                      <div className="flex items-center gap-3 pt-1">
                        <button
                          type="button"
                          onClick={() =>
                            setPreviewVersionId((prev) => (prev === ver.id ? null : ver.id))
                          }
                          className="text-xs font-medium text-blue-700 hover:underline"
                        >
                          {isSelected ? 'Hide Preview' : 'Preview'}
                        </button>
                        {!isCurrent && (
                          <button
                            type="button"
                            disabled={saving || refining}
                            onClick={() => void onRestoreVersion(ver)}
                            className="inline-flex items-center gap-1 text-xs font-medium text-slate-700 hover:text-slate-900 disabled:opacity-50"
                          >
                            <RotateCcw className="h-3 w-3" strokeWidth={1.75} />
                            <span>Restore as New Version</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {previewVersion && (
                <div className="border-t border-slate-200 pt-3 space-y-2">
                  <p className="text-xs font-semibold text-slate-900 tabular-nums">
                    Previewing Version {previewVersion.versionNumber}
                  </p>
                  <p className="text-xs font-medium text-slate-800">{previewVersion.title}</p>
                  {previewVersion.body.hook && (
                    <p className="text-xs text-slate-700 italic">“{previewVersion.body.hook}”</p>
                  )}
                  <p className="text-xs text-slate-600 whitespace-pre-line max-h-40 overflow-y-auto">
                    {previewVersion.body.mainCopy || '(Structured slides/scenes/sections)'}
                  </p>
                </div>
              )}
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
