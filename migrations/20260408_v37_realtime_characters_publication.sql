-- Ensure character row updates are emitted to realtime so player dashboard
-- subscriptions receive live HP/death-save updates.

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'characters'
  ) then
    execute 'alter publication supabase_realtime add table public.characters';
  end if;
end
$$;
