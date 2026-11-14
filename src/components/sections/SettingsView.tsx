import { useEffect, useState, type FormEvent } from 'react';
import { CheckCircle2, Database, KeyRound, User, Sparkles, LoaderCircle, CircleAlert } from 'lucide-react';
import { api } from '../../services/api';
import type { StorageStatus, UserProfile } from '../../types/brand';

interface SettingsViewProps {
  profile: UserProfile;
  storage: StorageStatus;
  onSaveProfile: (patch: Partial<UserProfile>) => Promise<void>;
}

export function SettingsView({
  profile,
  storage,
  onSaveProfile,
}: SettingsViewProps) {
  const [fullName, setFullName] = useState(profile.fullName);
  const [role, setRole] = useState(profile.role);
  const [organization, setOrganization] = useState(profile.organization);
  const [saving, setSaving] = useState(false);
  const [testingGemini, setTestingGemini] = useState(false);
  const [geminiResult, setGeminiResult] = useState('');
  const [geminiError, setGeminiError] = useState('');

  // Keep the form fields in sync when the profile finishes loading from the server.
  useEffect(() => {
    setFullName(profile.fullName);
    setRole(profile.role);
    setOrganization(profile.organization);
  }, [profile.fullName, profile.role, profile.organization]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSaveProfile({ fullName, role, organization });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Settings
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Manage your profile details and review backend persistence configuration.
        </p>
      </div>

      {/* User Profile Form */}
      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex items-center gap-2.5 border-b border-slate-100 pb-4">
          <User className="h-4 w-4 text-slate-500" strokeWidth={1.75} />
          <h2 className="text-base font-semibold text-slate-900">
            Workspace Profile
          </h2>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div>
            <label
              htmlFor="profile-full-name"
              className="block text-sm font-medium text-slate-800"
            >
              Full Name
            </label>
            <input
              id="profile-full-name"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="mt-1.5 min-h-[42px] w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
            />
          </div>

          <div>
            <label
              htmlFor="profile-email"
              className="block text-sm font-medium text-slate-800"
            >
              Email Address
            </label>
            <input
              id="profile-email"
              type="email"
              value={profile.email}
              disabled
              className="mt-1.5 min-h-[42px] w-full rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2 text-sm text-slate-500"
            />
          </div>

          <div>
            <label
              htmlFor="profile-role"
              className="block text-sm font-medium text-slate-800"
            >
              Role
            </label>
            <input
              id="profile-role"
              type="text"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="mt-1.5 min-h-[42px] w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
            />
          </div>

          <div>
            <label
              htmlFor="profile-org"
              className="block text-sm font-medium text-slate-800"
            >
              Workspace Organization
            </label>
            <input
              id="profile-org"
              type="text"
              value={organization}
              onChange={(e) => setOrganization(e.target.value)}
              className="mt-1.5 min-h-[42px] w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
            />
          </div>

          <div className="flex justify-end sm:col-span-2">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex min-h-[42px] items-center justify-center rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-60 whitespace-nowrap"
            >
              {saving ? 'Saving...' : 'Save Profile'}
            </button>
          </div>
        </form>
      </section>

      {/* Gemini AI Connection */}
      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex items-center gap-2.5 border-b border-slate-100 pb-4">
          <Sparkles className="h-4 w-4 text-slate-500" strokeWidth={1.75} />
          <div>
            <h2 className="text-base font-semibold text-slate-900">Gemini AI Connection</h2>
            <p className="mt-0.5 text-xs text-slate-500">Server-side AI provider for Brand Foundation and Brand Messaging.</p>
          </div>
        </div>
        <div className="mt-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <p className="text-sm font-medium text-slate-800">Google Gemini</p>
            <p className="mt-1 text-xs text-slate-500">
              {storage.geminiConfigured
                ? 'API key detected on the server. Run a connection test before generating strategy.'
                : 'API key not configured. Add GEMINI_API_KEY to your Vercel project environment variables.'}
            </p>
            <span className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${storage.geminiConfigured ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
              {storage.geminiConfigured ? 'Key configured' : 'Not configured'}
            </span>
          </div>
          <button
            type="button"
            onClick={async () => {
              setTestingGemini(true);
              setGeminiError('');
              setGeminiResult('');
              try {
                const result = await api.testGeminiConnection();
                setGeminiResult(result.response);
              } catch (err) {
                setGeminiError(err instanceof Error ? err.message : 'Gemini connection test failed.');
              } finally {
                setTestingGemini(false);
              }
            }}
            disabled={!storage.geminiConfigured || testingGemini}
            className="inline-flex min-h-[40px] shrink-0 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {testingGemini ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {testingGemini ? 'Testing...' : 'Test Connection'}
          </button>
        </div>
        {geminiResult && (
          <div role="status" className="mt-4 flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            <span>Gemini connection successful. {geminiResult}</span>
          </div>
        )}
        {geminiError && (
          <div role="alert" className="mt-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{geminiError}</span>
          </div>
        )}
        <p className="mt-4 border-t border-slate-100 pt-3 text-xs leading-relaxed text-slate-500">
          Keep this key in Vercel as a server-only environment variable. Do not add it to a VITE_ variable or paste it into browser code.
        </p>
      </section>

      {/* Data Persistence & Supabase Integration Readiness */}
      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex items-center gap-2.5 border-b border-slate-100 pb-4">
          <Database className="h-4 w-4 text-slate-500" strokeWidth={1.75} />
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Data Persistence & Supabase Readiness
            </h2>
          </div>
        </div>

        <div className="mt-4 space-y-4 text-sm text-slate-600">
          <p className="leading-relaxed">
            {storage.mode === 'supabase'
              ? 'Connected to Supabase PostgreSQL via server-side credentials. All brands and workspace activities are stored permanently in PostgreSQL.'
              : storage.persisted
                ? 'Currently persisting brands, profile preferences, and activity logs to server-side file storage (.data/brandflow-db.json). To switch to Supabase PostgreSQL, configure the server environment variables below and apply the SQL schema in supabase/schema.sql.'
                : 'Running in serverless mode without Supabase credentials; temporary /tmp storage is active and resets across serverless cold starts. Add the Supabase environment variables below in your hosting dashboard and apply supabase/schema.sql for permanent PostgreSQL persistence.'}
          </p>

          <div className="border-t border-slate-100 pt-4">
            <h3 className="flex items-center gap-2 text-xs font-semibold tracking-wide text-slate-500 uppercase">
              <KeyRound className="h-3.5 w-3.5" strokeWidth={1.75} />
              <span>Environment Configuration Checklist</span>
            </h3>
            <ul className="mt-3 divide-y divide-slate-100">
              {storage.requiredEnvVars.map((envVar) => (
                <li
                  key={envVar.key}
                  className="flex flex-col justify-between gap-1 py-2.5 sm:flex-row sm:items-center"
                >
                  <div>
                    <code className="font-mono text-xs font-semibold text-slate-900">
                      {envVar.key}
                    </code>
                    <p className="text-xs text-slate-500">{envVar.purpose}</p>
                  </div>
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 shrink-0">
                    {envVar.configured ? (
                      <>
                        <CheckCircle2
                          className="h-3.5 w-3.5 text-emerald-600"
                          strokeWidth={2}
                        />
                        <span className="text-emerald-700">Configured</span>
                      </>
                    ) : (
                      <span className="text-slate-500">Not set</span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}
