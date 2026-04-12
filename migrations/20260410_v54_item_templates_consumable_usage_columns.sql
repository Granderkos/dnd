alter table public.item_templates
  add column if not exists charges_max integer,
  add column if not exists charges_current integer,
  add column if not exists usage_type text;

alter table public.item_templates
  drop constraint if exists item_templates_usage_type_check;

alter table public.item_templates
  add constraint item_templates_usage_type_check
  check (
    usage_type is null
    or usage_type in ('charges', 'quantity', 'single_use')
  );
