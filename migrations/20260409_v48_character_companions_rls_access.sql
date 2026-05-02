-- Ensure players can read their own companion assignments after RPC inserts.
-- Fixes refresh path returning zero companions when RLS is enabled.

alter table public.character_companions enable row level security;

grant select, insert, update, delete on table public.character_companions to authenticated;
grant select on table public.compendium_entries to authenticated;

drop policy if exists "character_companions_select_own" on public.character_companions;
create policy "character_companions_select_own"
on public.character_companions
for select
to authenticated
using (
  exists (
    select 1
    from public.characters c
    where c.id = character_companions.character_id
      and c.user_id = auth.uid()
  )
);

drop policy if exists "character_companions_insert_own" on public.character_companions;
create policy "character_companions_insert_own"
on public.character_companions
for insert
to authenticated
with check (
  exists (
    select 1
    from public.characters c
    where c.id = character_companions.character_id
      and c.user_id = auth.uid()
  )
);

drop policy if exists "character_companions_update_own" on public.character_companions;
create policy "character_companions_update_own"
on public.character_companions
for update
to authenticated
using (
  exists (
    select 1
    from public.characters c
    where c.id = character_companions.character_id
      and c.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.characters c
    where c.id = character_companions.character_id
      and c.user_id = auth.uid()
  )
);

drop policy if exists "character_companions_delete_own" on public.character_companions;
create policy "character_companions_delete_own"
on public.character_companions
for delete
to authenticated
using (
  exists (
    select 1
    from public.characters c
    where c.id = character_companions.character_id
      and c.user_id = auth.uid()
  )
);
