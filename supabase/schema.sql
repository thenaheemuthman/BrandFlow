-- BrandFlow AI Phase 1 PostgreSQL Schema for Supabase
-- Run this SQL inside the Supabase SQL Editor when enabling Supabase persistence.

create extension if not exists "pgcrypto";

create table if not exists public.workspace_profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default 'Workspace Owner',
  email text not null default '',
  role text not null default 'Brand Strategist',
  organization text not null default 'BrandFlow Workspace',
  updated_at timestamptz not null default now()
);

create table if not exists public.brands (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  brand_name text not null,
  business_description text not null,
  industry text not null,
  products_or_services text not null,
  target_market text not null,
  primary_location text not null,
  website_url text not null default '',
  social_links text not null default '',
  existing_mission text not null default '',
  existing_vision text not null default '',
  marketing_challenges text not null default '',
  business_goals text not null default '',
  competitors text not null default '',
  additional_notes text not null default '',
  module_statuses jsonb not null default '{
    "brandFoundation": "not_started",
    "brandMessaging": "not_started",
    "customerIntelligence": "not_started",
    "marketingStrategy": "not_started",
    "contentStrategy": "not_started",
    "contentCalendar": "not_started",
    "contentStudio": "not_started"
  }'::jsonb,
  content_pieces_count integer not null default 0,
  pending_approvals_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_accessed_at timestamptz not null default now()
);

create index if not exists idx_brands_user_id on public.brands (user_id);
create index if not exists idx_brands_updated_at on public.brands (updated_at desc);

create table if not exists public.brand_activities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  brand_id uuid references public.brands (id) on delete set null,
  brand_name text not null,
  type text not null,
  description text not null,
  created_at timestamptz not null default now(),
  constraint brand_activities_type_check
    check (
      type in (
        'brand_created',
        'brand_updated',
        'workspace_accessed',
        'brand_deleted',
        'module_updated',
        'module_completed'
      )
    )
);

create index if not exists idx_brand_activities_user_id on public.brand_activities (user_id, created_at desc);

-- Enable Row Level Security (RLS) for future Supabase Auth multi-user isolation
alter table public.workspace_profiles enable row level security;
alter table public.brands enable row level security;
alter table public.brand_activities enable row level security;

create policy "Users manage their own profile"
  on public.workspace_profiles
  for all
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "Users manage their own brands"
  on public.brands
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users view their own brand activities"
  on public.brand_activities
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Phase 2A: Persisted Brand Strategy Modules (Brand Foundation & Brand Messaging)
create table if not exists public.brand_strategy_modules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  brand_id uuid not null references public.brands (id) on delete cascade,
  module_key text not null,
  status text not null default 'not_started',
  content jsonb not null default '{}'::jsonb,
  prompt_id text,
  prompt_version text,
  model text,
  generated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chk_brand_strategy_modules_module_key
    check (module_key in ('brandFoundation', 'brandMessaging')),
  constraint chk_brand_strategy_modules_status
    check (status in ('not_started', 'in_progress', 'completed')),
  constraint uq_brand_strategy_modules_brand_module
    unique (brand_id, module_key)
);

create index if not exists idx_brand_strategy_modules_user_id
  on public.brand_strategy_modules (user_id);

create index if not exists idx_brand_strategy_modules_brand_id
  on public.brand_strategy_modules (brand_id);

create index if not exists idx_brand_strategy_modules_user_brand
  on public.brand_strategy_modules (user_id, brand_id);

revoke all on table public.brand_strategy_modules from anon;
grant select, insert, update, delete on table public.brand_strategy_modules to authenticated;

alter table public.brand_strategy_modules enable row level security;

create policy "Users view their own brand strategy modules"
  on public.brand_strategy_modules
  for select
  to authenticated
  using (
    user_id = auth.uid()
    and exists (
      select 1
      from public.brands b
      where b.id = brand_id
        and b.user_id = auth.uid()
    )
  );

create policy "Users create strategy modules for their own brands"
  on public.brand_strategy_modules
  for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1
      from public.brands b
      where b.id = brand_id
        and b.user_id = auth.uid()
    )
  );

create policy "Users update their own brand strategy modules"
  on public.brand_strategy_modules
  for update
  to authenticated
  using (
    user_id = auth.uid()
    and exists (
      select 1
      from public.brands b
      where b.id = brand_id
        and b.user_id = auth.uid()
    )
  )
  with check (
    user_id = auth.uid()
    and exists (
      select 1
      from public.brands b
      where b.id = brand_id
        and b.user_id = auth.uid()
    )
  );

create policy "Users delete their own brand strategy modules"
  on public.brand_strategy_modules
  for delete
  to authenticated
  using (
    user_id = auth.uid()
    and exists (
      select 1
      from public.brands b
      where b.id = brand_id
        and b.user_id = auth.uid()
    )
  );

