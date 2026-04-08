-- Phase A (spells): template -> instance -> editable workflow on existing spells table.

create table if not exists public.spell_templates (
  id uuid primary key default gen_random_uuid(),
  slug text unique,
  name text not null,
  spell_level integer not null default 0,
  school text,
  casting_time text not null default '1 action',
  range_text text not null default '',
  duration_text text not null default '',
  components text not null default '',
  dice text not null default '',
  description text not null default '',
  is_cantrip boolean not null default false,
  is_ritual boolean not null default false,
  is_concentration boolean not null default false,
  is_reaction boolean not null default false,
  is_published boolean not null default true,
  version integer not null default 1,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.spells
  add column if not exists source_origin text;

alter table public.spells
  add column if not exists source_spell_template_id uuid references public.spell_templates(id) on delete set null;

alter table public.spells
  add column if not exists template_snapshot jsonb;

alter table public.spells
  drop constraint if exists spells_source_origin_check;

alter table public.spells
  add constraint spells_source_origin_check check (source_origin in ('custom', 'template'));

update public.spells
set source_origin = coalesce(source_origin, 'custom')
where source_origin is null;

alter table public.spells
  alter column source_origin set default 'custom';

alter table public.spells
  alter column source_origin set not null;

create index if not exists idx_spells_source_spell_template_id on public.spells (source_spell_template_id);
create index if not exists idx_spell_templates_level_name on public.spell_templates (spell_level, name);

