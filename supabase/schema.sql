-- BrandFlow AI Phase 1 PostgreSQL Schema for Supabase
-- Run this SQL inside the Supabase SQL Editor when enabling Supabase persistence.

create extension if not exists "pgcrypto";

create table if not exists public.workspace_profiles (
  id text primary key,
  full_name text not null default 'Workspace Owner',
  email text not null default '',
  role text not null default 'Brand Strategist',
  organization text not null default 'BrandFlow Workspace',
  updated_at timestamptz not null default now()
);

create table if not exists public.brands (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
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
  user_id text not null,
  brand_id uuid references public.brands (id) on delete set null,
  brand_name text not null,
  type text not null,
  description text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_brand_activities_user_id on public.brand_activities (user_id, created_at desc);

-- Enable Row Level Security (RLS) for future Supabase Auth multi-user isolation
alter table public.workspace_profiles enable row level security;
alter table public.brands enable row level security;
alter table public.brand_activities enable row level security;

create policy "Users manage their own profile"
  on public.workspace_profiles
  for all
  using (auth.uid()::text = id)
  with check (auth.uid()::text = id);

create policy "Users manage their own brands"
  on public.brands
  for all
  using (auth.uid()::text = user_id)
  with check (auth.uid()::text = user_id);

create policy "Users view their own brand activities"
  on public.brand_activities
  for all
  using (auth.uid()::text = user_id)
  with check (auth.uid()::text = user_id);
