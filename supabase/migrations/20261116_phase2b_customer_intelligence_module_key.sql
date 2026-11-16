-- Phase 2B: Extend public.brand_strategy_modules module_key check constraint to allow 'customerIntelligence'
alter table public.brand_strategy_modules
  drop constraint if exists chk_brand_strategy_modules_module_key;

alter table public.brand_strategy_modules
  add constraint chk_brand_strategy_modules_module_key
  check (module_key in ('brandFoundation', 'brandMessaging', 'customerIntelligence'));
