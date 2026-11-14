import type { LucideIcon } from 'lucide-react';
import { ArrowLeft, Clock } from 'lucide-react';

interface UpcomingModuleStateProps {
  icon: LucideIcon;
  title: string;
  phaseLabel?: string;
  description: string;
  plannedCapabilities: string[];
  primaryActionLabel?: string;
  onPrimaryAction?: () => void;
}

export function UpcomingModuleState({
  icon: Icon,
  title,
  phaseLabel = 'Scheduled for Phase 2',
  description,
  plannedCapabilities,
  primaryActionLabel,
  onPrimaryAction,
}: UpcomingModuleStateProps) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 sm:p-8">
      <div className="max-w-2xl">
        <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
          <Clock className="h-3.5 w-3.5 text-blue-600" strokeWidth={1.75} />
          <span>{phaseLabel}</span>
        </div>

        <div className="mt-4 flex items-start gap-3.5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-700">
            <Icon className="h-5 w-5" strokeWidth={1.75} />
          </div>
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-slate-900">
              {title}
            </h2>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
              {description}
            </p>
          </div>
        </div>

        <div className="mt-6 border-t border-slate-100 pt-5">
          <h3 className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
            Module scope in upcoming release
          </h3>
          <ul className="mt-3 space-y-2.5 text-sm text-slate-700">
            {plannedCapabilities.map((item) => (
              <li key={item} className="flex items-start gap-2.5">
                <span
                  aria-hidden="true"
                  className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-300"
                />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        {primaryActionLabel && onPrimaryAction && (
          <div className="mt-6 border-t border-slate-100 pt-5">
            <button
              type="button"
              onClick={onPrimaryAction}
              className="inline-flex min-h-[40px] items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 hover:text-slate-900 whitespace-nowrap shrink-0"
            >
              <ArrowLeft className="h-4 w-4" strokeWidth={1.75} />
              <span>{primaryActionLabel}</span>
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
