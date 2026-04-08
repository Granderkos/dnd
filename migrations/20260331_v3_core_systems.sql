-- V3.0 core systems: compendium, companions, and combat baseline

create extension if not exists pgcrypto;

create table if not exists public.compendium_entries (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('creature', 'companion')),
  subtype text check (subtype in ('monster', 'pet', 'mount', 'summon', 'familiar')),
  slug text not null unique,
  name text not null,
  description text,
  is_system boolean not null default true,
  data jsonb not null default '{}'::jsonb,
  created_by uuid,
  created_at timestamptz not null default now()
);

create table if not exists public.campaign_entry_unlocks (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null,
  entry_id uuid not null references public.compendium_entries(id) on delete cascade,
  player_id uuid,
  is_unlocked boolean not null default false,
  created_at timestamptz not null default now(),
  unique (campaign_id, entry_id, player_id)
);

create table if not exists public.character_companions (
  id uuid primary key default gen_random_uuid(),
  character_id uuid not null,
  entry_id uuid not null references public.compendium_entries(id) on delete restrict,
  kind text not null check (kind in ('pet', 'mount', 'summon', 'familiar')),
  name_override text,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.fights (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.fight_entities (
  id uuid primary key default gen_random_uuid(),
  fight_id uuid not null references public.fights(id) on delete cascade,
  entity_type text not null check (entity_type in ('player', 'monster', 'npc', 'summon')),
  character_id uuid,
  entry_id uuid references public.compendium_entries(id) on delete set null,
  name text not null,
  initiative integer,
  current_hp integer,
  max_hp integer,
  turn_order integer,
  notes text,
  created_at timestamptz not null default now(),
  check ((entity_type = 'player' and character_id is not null) or entity_type <> 'player')
);

create index if not exists idx_compendium_entries_slug on public.compendium_entries (slug);
create index if not exists idx_campaign_entry_unlocks_campaign_id on public.campaign_entry_unlocks (campaign_id);
create index if not exists idx_campaign_entry_unlocks_entry_id on public.campaign_entry_unlocks (entry_id);
create index if not exists idx_character_companions_entry_id on public.character_companions (entry_id);
create index if not exists idx_fights_campaign_id on public.fights (campaign_id);
create index if not exists idx_fight_entities_fight_id on public.fight_entities (fight_id);
create index if not exists idx_fight_entities_entry_id on public.fight_entities (entry_id);
