import { Feather } from 'lucide-react';
import type { AppRoute } from '../../utils/router';
import { UpcomingModuleState } from '../common/UpcomingModuleState';

interface WritingStylesViewProps {
  onNavigate: (route: AppRoute) => void;
}

export function WritingStylesView({ onNavigate }: WritingStylesViewProps) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Writing Styles
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Reusable editorial voice profiles, formatting preferences, and tone standards.
        </p>
      </div>

      <UpcomingModuleState
        icon={Feather}
        title="Writing Style Library"
        phaseLabel="Phase 1 Foundation — Style profiles unlock in Phase 2"
        description="Writing Styles ensure every piece of content generated for a brand follows clear rules for cadence, vocabulary, reading level, and structural formatting."
        plannedCapabilities={[
          'Create reusable voice presets (e.g., Executive Briefing, Technical Deep-Dive, Conversational)',
          'Assign default writing styles per brand or content channel',
          'Specify banned phrases, formatting guidelines, and CTA conventions',
        ]}
        primaryActionLabel="Back to Dashboard"
        onPrimaryAction={() => onNavigate({ view: 'dashboard' })}
      />
    </div>
  );
}
