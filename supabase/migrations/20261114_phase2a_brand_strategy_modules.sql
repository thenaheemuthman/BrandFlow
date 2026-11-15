-- BrandFlow AI Phase 2A Migration: Brand Strategy Modules
-- Non-destructive, idempotent SQL migration for an existing Supabase project.
-- Apply via Supabase SQL Editor before enabling Phase 2A endpoints.

create extension if not exists "pgcrypto";

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

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'brand_strategy_modules'
      and policyname = 'Users view their own brand strategy modules'
  ) then
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
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'brand_strategy_modules'
      and policyname = 'Users create strategy modules for their own brands'
  ) then
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
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'brand_strategy_modules'
      and policyname = 'Users update their own brand strategy modules'
  ) then
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
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'brand_strategy_modules'
      and policyname = 'Users delete their own brand strategy modules'
  ) then
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
  end if;
end
$$;
