-- Align inventory item template fields with V3.4 rules:
-- - source_origin limited to ('custom', 'template')
-- - template_snapshot remains nullable jsonb

alter table if exists public.inventory_items
  add column if not exists source_item_template_id uuid references public.item_templates(id) on delete set null,
  add column if not exists source_origin text not null default 'custom',
  add column if not exists template_snapshot jsonb;

alter table if exists public.inventory_items
  alter column template_snapshot drop not null,
  alter column template_snapshot drop default;

update public.inventory_items
set source_origin = 'template'
where source_origin not in ('custom', 'template')
  and source_item_template_id is not null;

update public.inventory_items
set source_origin = 'custom'
where source_origin not in ('custom', 'template')
  and source_item_template_id is null;

do $$
declare
  constraint_name text;
begin
  select con.conname
  into constraint_name
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  join pg_namespace nsp on nsp.oid = rel.relnamespace
  where nsp.nspname = 'public'
    and rel.relname = 'inventory_items'
    and con.contype = 'c'
    and pg_get_constraintdef(con.oid) ilike '%source_origin%';

  if constraint_name is not null then
    execute format('alter table public.inventory_items drop constraint %I', constraint_name);
  end if;
end
$$;

alter table public.inventory_items
  add constraint inventory_items_source_origin_check
  check (source_origin in ('custom', 'template'));
