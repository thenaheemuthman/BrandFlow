-- BrandFlow AI Phase 2A Migration: Allow 'module_updated' in brand_activities.type
-- Non-destructive, idempotent SQL migration for an existing Supabase project.
-- Preserves all existing activity types and records; alters no other tables, columns, indexes, or RLS policies.

do $$
begin
  alter table public.brand_activities
    drop constraint if exists brand_activities_type_check;

  alter table public.brand_activities
    add constraint brand_activities_type_check
    check (
      type in (
        'brand_created',
        'brand_updated',
        'workspace_accessed',
        'brand_deleted',
        'module_updated',
        'module_completed'
      )
    );
end
$$;
