import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, CircleAlert, FileText, LoaderCircle, RefreshCw, Save, Sparkles } from 'lucide-react';
import { api } from '../../services/api';
import type { Brand } from '../../types/brand';
import type { StrategyDocument, StrategyModule } from '../../types/strategy';

interface StrategyModuleViewProps {
  brand: Brand;
  module: StrategyModule;
}

function labelFor(key: string): string {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/[_-]/g, ' ')
    .replace(/^\w/, (letter) => letter.toUpperCase());
}

function updateAtPath(
  source: Record<string, unknown>,
  path: Array<string | number>,
  value: unknown,
): Record<string, unknown> {
  if (!path.length) return source;
  const [head, ...tail] = path;
  const clone: any = Array.isArray(source) ? [...source] : { ...source };
  if (tail.length === 0) clone[head] = value;
  else clone[head] = updateAtPath(clone[head] as Record<string, unknown>, tail, value);
  return clone;
}

function EditableValue({
  value,
  path,
  onChange,
}: {
  value: unknown;
  path: Array<string | number>;
  onChange: (path: Array<string | number>, value: unknown) => void;
}) {
  if (Array.isArray(value)) {
    if (value.length === 0 || value.every((item) => typeof item === 'string')) {
      return (
        <textarea
          value={value.join('\n')}
          onChange={(event) => onChange(path, event.target.value.split('\n').map((line) => line.trim()).filter(Boolean))}
          rows={Math.max(2, Math.min(6, value.length + 1))}
          className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm leading-relaxed text-slate-800 focus:border-blue-600 focus:outline-none"
        />
      );
    }
    return (
      <div className="mt-2 space-y-3">
        {value.map((item, index) => (
          <div key={index} className="rounded-lg border border-slate-200 bg-slate-50/70 p-3">
            <div className="mb-2 text-xs font-semibold text-slate-500">Item {index + 1}</div>
            <EditableValue value={item} path={[...path, index]} onChange={onChange} />
          </div>
        ))}
      </div>
    );
  }

  if (value && typeof value === 'object') {
    return (
      <div className="mt-2 space-y-4">
        {Object.entries(value as Record<string, unknown>).map(([key, child]) => (
          <div key={key}>
            <label className="block text-xs font-semibold text-slate-600">{labelFor(key)}</label>
            <EditableValue value={child} path={[...path, key]} onChange={onChange} />
          </div>
        ))}
      </div>
    );
  }

  return (
    <textarea
      value={value == null ? '' : String(value)}
      onChange={(event) => onChange(path, event.target.value)}
      rows={typeof value === 'string' && value.length > 100 ? 4 : 2}
      className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm leading-relaxed text-slate-800 focus:border-blue-600 focus:outline-none"
    />
  );
}

export function StrategyModuleView({ brand, module }: StrategyModuleViewProps) {
  const isFoundation = module === 'brand_foundation';
  const title = isFoundation ? 'Brand Foundation' : 'Brand Messaging';
  const [documents, setDocuments] = useState<StrategyDocument[]>([]);
  const [current, setCurrent] = useState<StrategyDocument | null>(null);
  const [content, setContent] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await api.getStrategyDocuments(brand.id, module);
      setDocuments(result.documents);
      const active = result.documents.find((item) => item.status === 'draft') ?? result.approved ?? result.documents[0] ?? null;
      setCurrent(active);
      setContent(active ? active.content : {});
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load strategy.');
    } finally {
      setLoading(false);
    }
  }, [brand.id, module]);

  useEffect(() => { void refresh(); }, [refresh]);

  const handleGenerate = async () => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const result = await api.generateStrategy(brand.id, module);
      setCurrent(result.document);
      setContent(result.document.content);
      await refresh();
      setCurrent(result.document);
      setContent(result.document.content);
      setNotice('A new draft has been generated. Review it before approving.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed.');
    } finally {
      setBusy(false);
    }
  };

  const handleSave = async () => {
    if (!current || current.status !== 'draft') return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const result = await api.saveStrategyDraft(brand.id, module, current.id, content);
      setCurrent(result.document);
      setContent(result.document.content);
      await refresh();
      setNotice('Your draft changes have been saved.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save draft.');
    } finally {
      setBusy(false);
    }
  };

  const handleApprove = async () => {
    if (!current || current.status !== 'draft') return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const result = await api.approveStrategy(brand.id, module, current.id);
      setCurrent(result.document);
      setContent(result.document.content);
      await refresh();
      setNotice('This strategy version is now approved.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to approve strategy.');
    } finally {
      setBusy(false);
    }
  };

  const selectVersion = (id: string) => {
    const selected = documents.find((item) => item.id === id);
    if (!selected) return;
    setCurrent(selected);
    setContent(selected.content);
    setNotice('');
  };

  const onFieldChange = (path: Array<string | number>, value: unknown) => {
    setContent((previous) => updateAtPath(previous, path, value));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <div className="inline-flex items-center gap-2 text-xs font-medium text-blue-700">
            <Sparkles className="h-3.5 w-3.5" />
            <span>AI Strategy Workspace</span>
          </div>
          <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">{title}</h2>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-600">
            {isFoundation
              ? 'Build the strategic identity of this brand from its business profile. Review every recommendation before approving it.'
              : 'Turn the approved brand foundation into a consistent messaging system. Brand Messaging uses the approved foundation as its source.'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void handleGenerate()}
          disabled={busy || loading}
          className="inline-flex min-h-[42px] shrink-0 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {documents.length ? 'Generate New Draft' : 'Generate with Gemini'}
        </button>
      </div>

      {error && (
        <div role="alert" className="flex gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" /> <span>{error}</span>
        </div>
      )}
      {notice && (
        <div role="status" className="flex gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> <span>{notice}</span>
        </div>
      )}

      {loading ? (
        <div className="h-48 animate-pulse rounded-xl border border-slate-200 bg-slate-50" />
      ) : (
        <>
          {documents.length > 0 && (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <label className="text-sm font-medium text-slate-700" htmlFor="strategy-version">Saved versions</label>
              <select
                id="strategy-version"
                value={current?.id ?? ''}
                onChange={(event) => selectVersion(event.target.value)}
                className="min-h-[40px] rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800"
              >
                {documents.map((item) => (
                  <option key={item.id} value={item.id}>
                    Version {item.version} · {labelFor(item.status)}
                  </option>
                ))}
              </select>
            </div>
          )}

          {!current ? (
            <section className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
              <FileText className="mx-auto h-8 w-8 text-slate-400" />
              <h3 className="mt-3 text-base font-semibold text-slate-900">No strategy draft yet</h3>
              <p className="mx-auto mt-1 max-w-md text-sm text-slate-600">
                Generate a first draft using the information in this brand profile. You can edit it before approving.
              </p>
            </section>
          ) : (
            <section className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
                <div>
                  <h3 className="font-semibold text-slate-900">Strategy Draft · Version {current.version}</h3>
                  <p className="mt-1 text-xs text-slate-500">Created {new Date(current.createdAt).toLocaleString()}</p>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${current.status === 'approved' ? 'bg-emerald-50 text-emerald-700' : current.status === 'draft' ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>
                  {labelFor(current.status)}
                </span>
              </div>

              <div className="mt-5 space-y-5">
                {Object.entries(content).map(([key, value]) => (
                  <div key={key} className="rounded-lg border border-slate-100 bg-slate-50/60 p-4">
                    <label className="block text-sm font-semibold text-slate-900">{labelFor(key)}</label>
                    <EditableValue value={value} path={[key]} onChange={onFieldChange} />
                  </div>
                ))}
              </div>

              {current.status === 'draft' && (
                <div className="mt-6 flex flex-col justify-end gap-2 border-t border-slate-100 pt-4 sm:flex-row">
                  <button type="button" onClick={() => void handleSave()} disabled={busy} className="inline-flex min-h-[40px] items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60">
                    <Save className="h-4 w-4" /> Save Draft
                  </button>
                  <button type="button" onClick={() => void handleApprove()} disabled={busy} className="inline-flex min-h-[40px] items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60">
                    <CheckCircle2 className="h-4 w-4" /> Approve This Version
                  </button>
                </div>
              )}
              {current.status === 'approved' && (
                <div className="mt-5 flex items-center gap-2 border-t border-emerald-100 pt-4 text-sm text-emerald-700">
                  <CheckCircle2 className="h-4 w-4" /> This version is approved and can be used by downstream strategy modules.
                </div>
              )}
            </section>
          )}
        </>
      )}
    </div>
  );
}
