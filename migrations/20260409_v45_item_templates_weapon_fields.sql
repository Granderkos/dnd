-- Phase 1: add structured item template fields for weapon data.

alter table if exists public.item_templates
  add column if not exists damage_text text,
  add column if not exists damage_type text,
  add column if not exists range_text text,
  add column if not exists weapon_kind text,
  add column if not exists source_url text;

alter table if exists public.item_templates
  drop constraint if exists item_templates_weapon_kind_check;

alter table public.item_templates
  add constraint item_templates_weapon_kind_check
  check (
    weapon_kind is null
    or weapon_kind in ('simple_melee', 'simple_ranged', 'martial_melee', 'martial_ranged')
  );

create index if not exists idx_item_templates_weapon_kind on public.item_templates (weapon_kind);
create index if not exists idx_item_templates_damage_type on public.item_templates (damage_type);
