-- BrandFlow AI — Phase 2B: 30-Day Content Calendar Tables & Strict RLS Policies
-- Additive, idempotent migration. Safe to run in Supabase SQL Editor on existing projects.
-- Supports multiple calendars per brand, individual calendar item management,
-- safe batch generation state tracking, and future Content Studio foreign-key integration.

create table if not exists public.content_calendars (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  brand_id uuid not null references public.brands(id) on delete cascade,
  name text not null,
  start_date date not null,
  end_date date not null,
  duration_days integer not null default 30,
  status text not null default 'draft',
  settings jsonb not null default '{}'::jsonb,
  upstream_snapshot jsonb not null default '{}'::jsonb,
  generation_state jsonb,
  prompt_id text,
  prompt_version text,
  model text,
  generated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint content_calendars_status_check check (
    status in ('draft', 'generating', 'partial', 'active', 'completed', 'archived')
  ),
  constraint content_calendars_duration_check check (
    duration_days >= 1 and duration_days <= 90
  ),
  constraint content_calendars_date_range_check check (
    end_date >= start_date
  )
);

create table if not exists public.content_calendar_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  brand_id uuid not null references public.brands(id) on delete cascade,
  calendar_id uuid not null references public.content_calendars(id) on delete cascade,
  scheduled_date date not null,
  suggested_time text not null default '',
  platform text not null,
  title text not null,
  content_pillar text not null default '',
  content_theme text not null default '',
  content_format text not null default '',
  content_series text not null default '',
  target_audience text not null default '',
  audience_pain_point text not null default '',
  content_objective text not null default '',
  related_marketing_objective text not null default '',
  core_message text not null default '',
  suggested_angle text not null default '',
  intended_cta text not null default '',
  relevant_kpi text not null default '',
  production_notes text not null default '',
  workflow_status text not null default 'planned',
  batch_index integer,
  source text not null default 'ai_generated',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint content_calendar_items_workflow_status_check check (
    workflow_status in (
      'planned',
      'in_progress',
      'ready_for_review',
      'approved',
      'published',
      'skipped'
    )
  ),
  constraint content_calendar_items_source_check check (
    source in ('ai_generated', 'edited_ai', 'manual')
  )
);

create index if not exists idx_content_calendars_brand_updated
  on public.content_calendars (brand_id, updated_at desc);

create index if not exists idx_content_calendars_user_brand
  on public.content_calendars (user_id, brand_id);

create index if not exists idx_content_calendar_items_calendar_date
  on public.content_calendar_items (calendar_id, scheduled_date asc, sort_order asc);

create index if not exists idx_content_calendar_items_brand_status
  on public.content_calendar_items (brand_id, workflow_status);

create index if not exists idx_content_calendar_items_user_calendar
  on public.content_calendar_items (user_id, calendar_id);

drop trigger if exists trg_content_calendars_updated_at on public.content_calendars;
create trigger trg_content_calendars_updated_at
  before update on public.content_calendars
  for each row execute function public.set_updated_at();

drop trigger if exists trg_content_calendar_items_updated_at on public.content_calendar_items;
create trigger trg_content_calendar_items_updated_at
  before update on public.content_calendar_items
  for each row execute function public.set_updated_at();

alter table public.content_calendars enable row level security;
alter table public.content_calendar_items enable row level security;

revoke all on public.content_calendars from anon;
revoke all on public.content_calendar_items from anon;

grant select, insert, update, delete on public.content_calendars to authenticated;
grant select, insert, update, delete on public.content_calendar_items to authenticated;

drop policy if exists "content_calendars_select_own" on public.content_calendars;
create policy "content_calendars_select_own"
  on public.content_calendars for select to authenticated
  using (
    user_id = auth.uid()
    and exists (
      select 1 from public.brands b
      where b.id = brand_id and b.user_id = auth.uid()
    )
  );

drop policy if exists "content_calendars_insert_own" on public.content_calendars;
create policy "content_calendars_insert_own"
  on public.content_calendars for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.brands b
      where b.id = brand_id and b.user_id = auth.uid()
    )
  );

drop policy if exists "content_calendars_update_own" on public.content_calendars;
create policy "content_calendars_update_own"
  on public.content_calendars for update to authenticated
  using (
    user_id = auth.uid()
    and exists (
      select 1 from public.brands b
      where b.id = brand_id and b.user_id = auth.uid()
    )
  )
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.brands b
      where b.id = brand_id and b.user_id = auth.uid()
    )
  );

drop policy if exists "content_calendars_delete_own" on public.content_calendars;
create policy "content_calendars_delete_own"
  on public.content_calendars for delete to authenticated
  using (
    user_id = auth.uid()
    and exists (
      select 1 from public.brands b
      where b.id = brand_id and b.user_id = auth.uid()
    )
  );

drop policy if exists "content_calendar_items_select_own" on public.content_calendar_items;
create policy "content_calendar_items_select_own"
  on public.content_calendar_items for select to authenticated
  using (
    user_id = auth.uid()
    and exists (
      select 1 from public.content_calendars c
      where c.id = calendar_id
        and c.brand_id = brand_id
        and c.user_id = auth.uid()
    )
  );

drop policy if exists "content_calendar_items_insert_own" on public.content_calendar_items;
create policy "content_calendar_items_insert_own"
  on public.content_calendar_items for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.content_calendars c
      where c.id = calendar_id
        and c.brand_id = brand_id
        and c.user_id = auth.uid()
    )
  );

drop policy if exists "content_calendar_items_update_own" on public.content_calendar_items;
create policy "content_calendar_items_update_own"
  on public.content_calendar_items for update to authenticated
  using (
    user_id = auth.uid()
    and exists (
      select 1 from public.content_calendars c
      where c.id = calendar_id
        and c.brand_id = brand_id
        and c.user_id = auth.uid()
    )
  )
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.content_calendars c
      where c.id = calendar_id
        and c.brand_id = brand_id
        and c.user_id = auth.uid()
    )
  );

drop policy if exists "content_calendar_items_delete_own" on public.content_calendar_items;
create policy "content_calendar_items_delete_own"
  on public.content_calendar_items for delete to authenticated
  using (
    user_id = auth.uid()
    and exists (
      select 1 from public.content_calendars c
      where c.id = calendar_id
        and c.brand_id = brand_id
        and c.user_id = auth.uid()
    )
  );
