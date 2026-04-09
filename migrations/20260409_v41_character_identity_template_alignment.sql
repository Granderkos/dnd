-- Align character class/race/background template linkage with V3.4 rules.
-- Keep origins limited to custom|template and snapshots nullable jsonb.

alter table if exists public.characters
  add column if not exists source_class_template_id uuid references public.class_templates(id) on delete set null,
  add column if not exists source_race_template_id uuid references public.race_templates(id) on delete set null,
  add column if not exists source_background_template_id uuid references public.background_templates(id) on delete set null,
  add column if not exists class_source_origin text not null default 'custom',
  add column if not exists race_source_origin text not null default 'custom',
  add column if not exists background_source_origin text not null default 'custom',
  add column if not exists class_template_snapshot jsonb,
  add column if not exists race_template_snapshot jsonb,
  add column if not exists background_template_snapshot jsonb;

alter table if exists public.characters
  alter column class_template_snapshot drop not null,
  alter column race_template_snapshot drop not null,
  alter column background_template_snapshot drop not null,
  alter column class_template_snapshot drop default,
  alter column race_template_snapshot drop default,
  alter column background_template_snapshot drop default;

update public.characters
set class_source_origin = case
  when source_class_template_id is not null then 'template'
  else 'custom'
end
where class_source_origin not in ('custom', 'template');

update public.characters
set race_source_origin = case
  when source_race_template_id is not null then 'template'
  else 'custom'
end
where race_source_origin not in ('custom', 'template');

update public.characters
set background_source_origin = case
  when source_background_template_id is not null then 'template'
  else 'custom'
end
where background_source_origin not in ('custom', 'template');

do $$
declare
  c_name text;
  r_name text;
  b_name text;
begin
  select con.conname into c_name
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  join pg_namespace nsp on nsp.oid = rel.relnamespace
  where nsp.nspname = 'public' and rel.relname = 'characters' and con.contype = 'c'
    and pg_get_constraintdef(con.oid) ilike '%class_source_origin%';
  if c_name is not null then execute format('alter table public.characters drop constraint %I', c_name); end if;

  select con.conname into r_name
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  join pg_namespace nsp on nsp.oid = rel.relnamespace
  where nsp.nspname = 'public' and rel.relname = 'characters' and con.contype = 'c'
    and pg_get_constraintdef(con.oid) ilike '%race_source_origin%';
  if r_name is not null then execute format('alter table public.characters drop constraint %I', r_name); end if;

  select con.conname into b_name
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  join pg_namespace nsp on nsp.oid = rel.relnamespace
  where nsp.nspname = 'public' and rel.relname = 'characters' and con.contype = 'c'
    and pg_get_constraintdef(con.oid) ilike '%background_source_origin%';
  if b_name is not null then execute format('alter table public.characters drop constraint %I', b_name); end if;
end
$$;

alter table public.characters
  add constraint characters_class_source_origin_check check (class_source_origin in ('custom', 'template')),
  add constraint characters_race_source_origin_check check (race_source_origin in ('custom', 'template')),
  add constraint characters_background_source_origin_check check (background_source_origin in ('custom', 'template'));
