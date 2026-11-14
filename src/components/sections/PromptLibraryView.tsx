import { Library, ShieldCheck } from 'lucide-react';
import type { AppRoute } from '../../utils/router';
import { UpcomingModuleState } from '../common/UpcomingModuleState';

interface PromptLibraryViewProps {
  onNavigate: (route: AppRoute) => void;
}

export function PromptLibraryView({ onNavigate }: PromptLibraryViewProps) {
  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
          <ShieldCheck className="h-3.5 w-3.5 text-slate-400" strokeWidth={1.75} />
          <span>Administrative Module</span>
        </div>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
          Prompt Library
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Internal system prompt templates and structured output schemas reserved for workspace administrators.
        </p>
      </div>

      <UpcomingModuleState
        icon={Library}
        title="Administrative Prompt Management"
        phaseLabel="Administrative Feature — Deferred to Phase 2+"
        description="System prompt orchestration for brand discovery, strategy synthesis, and content scoring will be managed here once server-side Gemini workflows are enabled."
        plannedCapabilities={[
          'Versioned prompt templates per strategy and content workflow stage',
          'Structured JSON output schemas and validation guardrails',
          'Role-restricted access for workspace administrators',
        ]}
        primaryActionLabel="Back to Dashboard"
        onPrimaryAction={() => onNavigate({ view: 'dashboard' })}
      />
    </div>
  );
}
