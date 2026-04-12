alter table public.fights
  add column if not exists round_number integer not null default 1;
