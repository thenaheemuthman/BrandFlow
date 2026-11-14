import { useState } from 'react';
import { PenTool, ArrowRight } from 'lucide-react';
import type { Brand } from '../../types/brand';
import type { AppRoute } from '../../utils/router';
import { UpcomingModuleState } from '../common/UpcomingModuleState';

interface ContentStudioGlobalViewProps {
  brands: Brand[];
  onNavigate: (route: AppRoute) => void;
}

export function ContentStudioGlobalView({
  brands,
  onNavigate,
}: ContentStudioGlobalViewProps) {
  const [selectedBrandId, setSelectedBrandId] = useState<string>(
    brands[0]?.id ?? '',
  );

  const selectedBrand = brands.find((b) => b.id === selectedBrandId) ?? brands[0];

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Content Studio
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Cross-brand content drafting and editorial approval queue.
          </p>
        </div>

        {brands.length > 0 && (
          <div className="flex items-center gap-3">
            <label
              htmlFor="studio-brand-select"
              className="text-xs font-medium text-slate-500 whitespace-nowrap"
            >
              Active brand
            </label>
            <select
              id="studio-brand-select"
              value={selectedBrand?.id ?? ''}
              onChange={(e) => setSelectedBrandId(e.target.value)}
              className="min-h-[40px] rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-600 focus:outline-none"
            >
              {brands.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.brandName}
                </option>
              ))}
            </select>
            {selectedBrand && (
              <button
                type="button"
                onClick={() =>
                  onNavigate({
                    view: 'brand-workspace',
                    brandId: selectedBrand.id,
                    section: 'overview',
                  })
                }
                className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
              >
                <span>Open Workspace</span>
                <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.75} />
              </button>
            )}
          </div>
        )}
      </div>

      <UpcomingModuleState
        icon={PenTool}
        title="Content Studio Foundation"
        phaseLabel="Phase 1 Foundation — Production unlocks in Phase 2"
        description="Content Studio will connect directly to each brand's messaging framework, writing style, and 30-day calendar to draft and review multi-channel assets."
        plannedCapabilities={[
          'Draft articles, LinkedIn posts, email sequences, and landing copy grounded in brand strategy',
          'Apply saved Writing Styles consistently across every generated piece',
          'Review, revise, and approve content items before scheduling',
        ]}
        primaryActionLabel={
          brands.length === 0 ? 'Create First Brand' : 'Back to Dashboard'
        }
        onPrimaryAction={() =>
          onNavigate(
            brands.length === 0 ? { view: 'brand-new' } : { view: 'dashboard' },
          )
        }
      />
    </div>
  );
}
