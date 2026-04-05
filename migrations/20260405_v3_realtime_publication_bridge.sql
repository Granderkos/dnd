-- Ensure combat and activity tables are published to Supabase Realtime.
-- Without publication membership, postgres_changes subscriptions receive no events
-- and UI state only updates after manual refresh.

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'activity_status'
  ) then
    execute 'alter publication supabase_realtime add table public.activity_status';
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'fight_initiative_requests'
  ) then
    execute 'alter publication supabase_realtime add table public.fight_initiative_requests';
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'fight_entities'
  ) then
    execute 'alter publication supabase_realtime add table public.fight_entities';
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'fights'
  ) then
    execute 'alter publication supabase_realtime add table public.fights';
  end if;
end
$$;
