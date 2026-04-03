-- Minimal runtime read access for bestiary listing

grant usage on schema public to anon, authenticated;
grant select on table public.compendium_entries to anon, authenticated;
