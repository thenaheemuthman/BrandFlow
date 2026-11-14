import { useEffect, useState } from 'react';
import { BookOpen, Check, Copy, ShieldCheck, Sparkles } from 'lucide-react';
import type { AppRoute } from '../../utils/router';
import { api } from '../../services/api';
import type { StrategyPromptTemplate } from '../../types/strategy';

interface PromptLibraryViewProps {
  onNavigate: (route: AppRoute) => void;
}

function PromptList({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</h4>
      <ul className="mt-2 space-y-1.5">
        {items.map((item, index) => <li key={index} className="text-sm leading-relaxed text-slate-700">• {item}</li>)}
      </ul>
    </div>
  );
}

export function PromptLibraryView({ onNavigate }: PromptLibraryViewProps) {
  const [prompts, setPrompts] = useState<StrategyPromptTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState('');

  useEffect(() => {
    api.getStrategyPrompts()
      .then((result) => setPrompts(result.prompts))
      .catch((err) => setError(err instanceof Error ? err.message : 'Unable to load prompt templates.'))
      .finally(() => setLoading(false));
  }, []);

  const copyPrompt = async (prompt: StrategyPromptTemplate) => {
    try {
      await navigator.clipboard.writeText(prompt.systemInstruction + '\n\n' + prompt.templatePreview);
      setCopied(prompt.key);
      window.setTimeout(() => setCopied(''), 2000);
    } catch {
      setError('Clipboard access is unavailable in this browser.');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
          <ShieldCheck className="h-3.5 w-3.5 text-slate-400" strokeWidth={1.75} />
          <span>Private Administrative Module</span>
        </div>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">Prompt Library</h1>
        <p className="mt-1 text-sm text-slate-600">
          Review the versioned AI instructions that power the Brand Foundation and Brand Messaging workflows.
        </p>
      </div>

      {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>}

      {loading ? (
        <div className="h-48 animate-pulse rounded-xl border border-slate-200 bg-slate-50" />
      ) : prompts.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-600">No prompt templates are available.</div>
      ) : (
        <div className="space-y-4">
          {prompts.map((prompt) => (
            <article key={prompt.key} className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">{prompt.module === 'brand_foundation' ? 'Brand Foundation' : 'Brand Messaging'}</span>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">Version {prompt.version}</span>
                    {prompt.reconstructed && <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800">Reconstructed template</span>}
                  </div>
                  <h2 className="mt-3 text-lg font-semibold text-slate-900">{prompt.name}</h2>
                  <p className="mt-1 text-xs text-slate-500">Prompt ID: <code>{prompt.key}</code> · AI role: {prompt.aiRole}</p>
                </div>
                <button type="button" onClick={() => void copyPrompt(prompt)} className="inline-flex min-h-[38px] items-center justify-center gap-2 self-start rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50">
                  {copied === prompt.key ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied === prompt.key ? 'Copied' : 'Copy prompt'}
                </button>
              </div>

              <div className="mt-5 grid grid-cols-1 gap-5 border-t border-slate-100 pt-5 md:grid-cols-2">
                <PromptList title="Required context" items={prompt.requiredContext} />
                <PromptList title="Inputs" items={prompt.inputs} />
                <PromptList title="Task instructions" items={prompt.taskInstructions} />
                <PromptList title="Output requirements" items={prompt.outputRequirements} />
                <PromptList title="Quality criteria" items={prompt.qualityCriteria} />
                <PromptList title="Restrictions" items={prompt.restrictions} />
              </div>

              <details className="mt-5 border-t border-slate-100 pt-4">
                <summary className="cursor-pointer text-sm font-semibold text-slate-700">View full prompt instructions</summary>
                <div className="mt-4 space-y-3">
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">System instruction</h3>
                    <pre className="mt-2 whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-xs leading-relaxed text-slate-700">{prompt.systemInstruction}</pre>
                  </div>
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">User prompt template</h3>
                    <pre className="mt-2 max-h-[480px] overflow-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-xs leading-relaxed text-slate-700">{prompt.templatePreview}</pre>
                  </div>
                </div>
              </details>
            </article>
          ))}
        </div>
      )}

      <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-4">
        <div className="flex gap-2">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
          <p className="text-xs leading-relaxed text-slate-700">
            These are reconstructed templates because the exact original prompt documents were not available in the current project files. They are labelled as such and versioned. Original prompt wording can replace them when recovered.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 text-sm text-slate-600">
        <BookOpen className="h-4 w-4" />
        <button type="button" onClick={() => onNavigate({ view: 'dashboard' })} className="font-medium hover:text-slate-900">Back to Dashboard</button>
      </div>
    </div>
  );
}
