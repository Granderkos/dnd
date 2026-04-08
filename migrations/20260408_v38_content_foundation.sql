-- V3.x content/database foundation (templates + instance linkage).
-- Scope: schema foundation only (no real data import).

create extension if not exists pgcrypto;

-- ============================================================
-- SOURCE / TEMPLATE TABLES
-- ============================================================

create table if not exists public.spell_templates (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  level integer not null default 0 check (level >= 0 and level <= 9),
  school text not null default '',
  casting_time text not null default '',
  range_text text not null default '',
  components text not null default '',
  duration_text text not null default '',
  concentration boolean not null default false,
  ritual boolean not null default false,
  description text not null default '',
  higher_level_text text,
  save_type text,
  attack_type text,
  tags jsonb not null default '[]'::jsonb,
  source_name text,
  source_page text,
  is_official boolean not null default false,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.item_templates (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  category text not null default 'Other',
  rarity text,
  weight numeric(10, 2),
  value_text text,
  requires_attunement boolean not null default false,
  description text not null default '',
  properties jsonb not null default '[]'::jsonb,
  tags jsonb not null default '[]'::jsonb,
  source_name text,
  source_page text,
  is_official boolean not null default false,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.creature_templates (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  size text,
  creature_type text,
  subtype text,
  alignment text,
  armor_class integer,
  hit_points integer,
  speed_text text,
  str_score integer,
  dex_score integer,
  con_score integer,
  int_score integer,
  wis_score integer,
  cha_score integer,
  skills jsonb not null default '{}'::jsonb,
  senses text,
  languages text,
  challenge_rating numeric(8, 3),
  traits jsonb not null default '[]'::jsonb,
  actions jsonb not null default '[]'::jsonb,
  notes text,
  tags jsonb not null default '[]'::jsonb,
  source_name text,
  source_page text,
  is_official boolean not null default false,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.companion_templates (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  kind text not null check (kind in ('pet', 'mount', 'summon', 'familiar')),
  armor_class integer,
  hit_points integer,
  speed_text text,
  notes text,
  custom_data jsonb not null default '{}'::jsonb,
  tags jsonb not null default '[]'::jsonb,
  source_name text,
  source_page text,
  is_official boolean not null default false,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.class_templates (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null unique,
  hit_die text not null default '',
  primary_ability text,
  saving_throw_proficiencies text not null default '',
  armor_proficiencies text not null default '',
  weapon_proficiencies text not null default '',
  tool_proficiencies text not null default '',
  short_description text,
  feature_summary text,
  tags jsonb not null default '[]'::jsonb,
  source_name text,
  source_page text,
  is_official boolean not null default false,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.race_templates (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null unique,
  size text,
  speed integer,
  ability_bonuses jsonb not null default '{}'::jsonb,
  traits jsonb not null default '[]'::jsonb,
  languages text not null default '',
  senses text,
  short_description text,
  tags jsonb not null default '[]'::jsonb,
  source_name text,
  source_page text,
  is_official boolean not null default false,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.background_templates (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null unique,
  skill_proficiencies text not null default '',
  tool_proficiencies text not null default '',
  language_proficiencies text not null default '',
  equipment_summary text,
  feature_summary text,
  short_description text,
  tags jsonb not null default '[]'::jsonb,
  source_name text,
  source_page text,
  is_official boolean not null default false,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Optional, lightweight extension points for V3.x content metadata.
create table if not exists public.feat_templates (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null unique,
  prerequisite text,
  short_description text,
  description text not null default '',
  tags jsonb not null default '[]'::jsonb,
  source_name text,
  source_page text,
  is_official boolean not null default false,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.trait_templates (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null unique,
  trait_type text not null default 'general',
  description text not null default '',
  tags jsonb not null default '[]'::jsonb,
  source_name text,
  source_page text,
  is_official boolean not null default false,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- CHARACTER / INSTANCE LINKAGE (importable + editable instances)
-- ============================================================

alter table if exists public.spells
  add column if not exists source_spell_template_id uuid references public.spell_templates(id) on delete set null,
  add column if not exists source_origin text not null default 'custom' check (source_origin in ('custom', 'template', 'imported')),
  add column if not exists template_snapshot jsonb not null default '{}'::jsonb;

alter table if exists public.inventory_items
  add column if not exists source_item_template_id uuid references public.item_templates(id) on delete set null,
  add column if not exists source_origin text not null default 'custom' check (source_origin in ('custom', 'template', 'imported')),
  add column if not exists template_snapshot jsonb not null default '{}'::jsonb;

alter table if exists public.character_companions
  add column if not exists source_companion_template_id uuid references public.companion_templates(id) on delete set null,
  add column if not exists source_origin text not null default 'custom' check (source_origin in ('custom', 'template', 'imported')),
  add column if not exists template_snapshot jsonb not null default '{}'::jsonb,
  add column if not exists custom_data jsonb not null default '{}'::jsonb;

alter table if exists public.characters
  add column if not exists source_class_template_id uuid references public.class_templates(id) on delete set null,
  add column if not exists source_race_template_id uuid references public.race_templates(id) on delete set null,
  add column if not exists source_background_template_id uuid references public.background_templates(id) on delete set null,
  add column if not exists class_source_origin text not null default 'custom' check (class_source_origin in ('custom', 'template', 'imported')),
  add column if not exists race_source_origin text not null default 'custom' check (race_source_origin in ('custom', 'template', 'imported')),
  add column if not exists background_source_origin text not null default 'custom' check (background_source_origin in ('custom', 'template', 'imported')),
  add column if not exists class_template_snapshot jsonb not null default '{}'::jsonb,
  add column if not exists race_template_snapshot jsonb not null default '{}'::jsonb,
  add column if not exists background_template_snapshot jsonb not null default '{}'::jsonb;

-- ============================================================
-- INDEXES (hot path + manual lookup support)
-- ============================================================

create index if not exists idx_spell_templates_name on public.spell_templates (name);
create index if not exists idx_spell_templates_level on public.spell_templates (level);
create index if not exists idx_spell_templates_tags_gin on public.spell_templates using gin (tags);

create index if not exists idx_item_templates_name on public.item_templates (name);
create index if not exists idx_item_templates_category on public.item_templates (category);
create index if not exists idx_item_templates_tags_gin on public.item_templates using gin (tags);

create index if not exists idx_creature_templates_name on public.creature_templates (name);
create index if not exists idx_creature_templates_type on public.creature_templates (creature_type);
create index if not exists idx_creature_templates_cr on public.creature_templates (challenge_rating);
create index if not exists idx_creature_templates_tags_gin on public.creature_templates using gin (tags);

create index if not exists idx_companion_templates_name on public.companion_templates (name);
create index if not exists idx_companion_templates_kind on public.companion_templates (kind);
create index if not exists idx_companion_templates_tags_gin on public.companion_templates using gin (tags);

create index if not exists idx_class_templates_name on public.class_templates (name);
create index if not exists idx_race_templates_name on public.race_templates (name);
create index if not exists idx_background_templates_name on public.background_templates (name);

create index if not exists idx_feat_templates_name on public.feat_templates (name);
create index if not exists idx_feat_templates_tags_gin on public.feat_templates using gin (tags);

create index if not exists idx_trait_templates_name on public.trait_templates (name);
create index if not exists idx_trait_templates_type on public.trait_templates (trait_type);
create index if not exists idx_trait_templates_tags_gin on public.trait_templates using gin (tags);

create index if not exists idx_spells_source_spell_template on public.spells (source_spell_template_id);
create index if not exists idx_inventory_items_source_item_template on public.inventory_items (source_item_template_id);
create index if not exists idx_character_companions_source_companion_template on public.character_companions (source_companion_template_id);
create index if not exists idx_characters_source_class_template on public.characters (source_class_template_id);
create index if not exists idx_characters_source_race_template on public.characters (source_race_template_id);
create index if not exists idx_characters_source_background_template on public.characters (source_background_template_id);
