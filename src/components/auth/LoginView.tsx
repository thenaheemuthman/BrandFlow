import { useState, type FormEvent } from 'react';
import { AlertCircle, Eye, EyeOff, LoaderCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';

export function LoginView() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (signInError) {
        setError('The email or password is incorrect. Please try again.');
      }
    } catch {
      setError('Unable to sign in right now. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-slate-50 px-4 py-10 text-slate-900">
      {/* Subtle architectural hairline backdrop */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            'linear-gradient(to right, rgba(15, 23, 42, 0.035) 1px, transparent 1px), linear-gradient(to bottom, rgba(15, 23, 42, 0.035) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
          maskImage:
            'radial-gradient(ellipse 70% 60% at 50% 45%, #000 35%, transparent 100%)',
          WebkitMaskImage:
            'radial-gradient(ellipse 70% 60% at 50% 45%, #000 35%, transparent 100%)',
        }}
      />

      <div className="relative z-10 w-full max-w-[400px]">
        {/* Centralized Brand Logo & Header */}
        <header className="mb-7 flex flex-col items-center text-center">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950 text-xs font-bold tracking-tight text-white shadow-sm ring-1 ring-slate-950/10">
            BF
          </span>
          <p className="font-display mt-3.5 text-lg font-semibold tracking-tight text-slate-950">
            BrandFlow AI
          </p>
          <p className="mt-0.5 text-xs text-slate-500">Private workspace</p>
        </header>

        {/* Sleek Minimalist Sign-In Card */}
        <section
          aria-labelledby="login-heading"
          className="rounded-2xl border border-slate-200/90 bg-white p-7 shadow-[0_1px_2px_rgba(15,23,42,0.03),0_16px_36px_-18px_rgba(15,23,42,0.12)] sm:p-8"
        >
          <div className="mb-6 text-center">
            <h1
              id="login-heading"
              className="font-display text-2xl font-semibold tracking-tight text-slate-950"
            >
              Welcome back
            </h1>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-500">
              Sign in to access your BrandFlow workspace.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="login-email"
                className="mb-1.5 block text-[13px] font-medium text-slate-700"
              >
                Email address
              </label>
              <input
                id="login-email"
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="min-h-11.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition-colors duration-150 hover:border-slate-300 focus:border-blue-600 focus:ring-3 focus:ring-blue-600/10"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label
                htmlFor="login-password"
                className="mb-1.5 block text-[13px] font-medium text-slate-700"
              >
                Password
              </label>
              <div className="relative">
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="min-h-11.5 w-full rounded-xl border border-slate-200 bg-white pr-11 pl-3.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition-colors duration-150 hover:border-slate-300 focus:border-blue-600 focus:ring-3 focus:ring-blue-600/10"
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-pressed={showPassword}
                  className="absolute top-1/2 right-1 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 transition-colors duration-150 hover:bg-slate-100 hover:text-slate-700 focus-visible:text-slate-900"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
                  ) : (
                    <Eye className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
                  )}
                </button>
              </div>
            </div>

            {error && (
              <div
                role="alert"
                className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700"
              >
                <AlertCircle
                  className="mt-0.5 h-4 w-4 shrink-0 text-red-600"
                  strokeWidth={1.75}
                  aria-hidden="true"
                />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="mt-2 inline-flex min-h-11.5 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-all duration-150 hover:bg-blue-700 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting && (
                <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
              )}
              <span>{submitting ? 'Signing in…' : 'Sign in'}</span>
            </button>
          </form>
        </section>

        <p className="mt-6 text-center text-xs text-slate-400">
          Private workspace · Account registration is disabled.
        </p>
      </div>
    </main>
  );
}

