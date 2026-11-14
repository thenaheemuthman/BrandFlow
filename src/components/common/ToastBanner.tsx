import { CheckCircle2, AlertCircle, X } from 'lucide-react';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error';
  message: string;
}

interface ToastBannerProps {
  toast: ToastMessage | null;
  onDismiss: () => void;
}

export function ToastBanner({ toast, onDismiss }: ToastBannerProps) {
  if (!toast) return null;

  const isSuccess = toast.type === 'success';

  return (
    <div
      role="status"
      aria-live="polite"
      className={`mb-6 flex items-center justify-between gap-3 rounded-lg border px-4 py-3 text-sm ${
        isSuccess
          ? 'border-emerald-200 bg-emerald-50/70 text-emerald-900'
          : 'border-red-200 bg-red-50 text-red-900'
      }`}
    >
      <div className="flex items-center gap-2.5">
        {isSuccess ? (
          <CheckCircle2
            className="h-4 w-4 shrink-0 text-emerald-600"
            strokeWidth={1.75}
          />
        ) : (
          <AlertCircle
            className="h-4 w-4 shrink-0 text-red-600"
            strokeWidth={1.75}
          />
        )}
        <span className="font-medium">{toast.message}</span>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss notification"
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-white/70 hover:text-slate-900"
      >
        <X className="h-4 w-4" strokeWidth={1.75} />
      </button>
    </div>
  );
}
