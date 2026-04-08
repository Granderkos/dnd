-- Reconcile fight RLS policies regardless of prior migration order.
-- Safe to run multiple times.

alter table public.fights enable row level security;
alter table public.fight_entities enable row level security;

grant usage on schema public to authenticated;
grant select, insert, update, delete on table public.fights to authenticated;
grant select, insert, update, delete on table public.fight_entities to authenticated;

-- Drop legacy policy names (users-table dependent)
drop policy if exists "dm_select_own_fights" on public.fights;
drop policy if exists "dm_insert_own_fights" on public.fights;
drop policy if exists "dm_update_own_fights" on public.fights;
drop policy if exists "dm_delete_own_fights" on public.fights;
drop policy if exists "dm_select_own_fight_entities" on public.fight_entities;
drop policy if exists "dm_insert_own_fight_entities" on public.fight_entities;
drop policy if exists "dm_update_own_fight_entities" on public.fight_entities;
drop policy if exists "dm_delete_own_fight_entities" on public.fight_entities;

-- Drop hotfix policy names to allow clean recreation
drop policy if exists "fight_owner_select" on public.fights;
drop policy if exists "fight_owner_insert" on public.fights;
drop policy if exists "fight_owner_update" on public.fights;
drop policy if exists "fight_owner_delete" on public.fights;
drop policy if exists "fight_entity_owner_select" on public.fight_entities;
drop policy if exists "fight_entity_owner_insert" on public.fight_entities;
drop policy if exists "fight_entity_owner_update" on public.fight_entities;
drop policy if exists "fight_entity_owner_delete" on public.fight_entities;

-- Stable policies (no dependency on public.users)
create policy "fight_owner_select"
on public.fights
for select
to authenticated
using (campaign_id = auth.uid());

create policy "fight_owner_insert"
on public.fights
for insert
to authenticated
with check (campaign_id = auth.uid());

create policy "fight_owner_update"
on public.fights
for update
to authenticated
using (campaign_id = auth.uid())
with check (campaign_id = auth.uid());

create policy "fight_owner_delete"
on public.fights
for delete
to authenticated
using (campaign_id = auth.uid());

create policy "fight_entity_owner_select"
on public.fight_entities
for select
to authenticated
using (
  exists (
    select 1
    from public.fights f
    where f.id = fight_entities.fight_id
      and f.campaign_id = auth.uid()
  )
);

create policy "fight_entity_owner_insert"
on public.fight_entities
for insert
to authenticated
with check (
  exists (
    select 1
    from public.fights f
    where f.id = fight_entities.fight_id
      and f.campaign_id = auth.uid()
  )
);

create policy "fight_entity_owner_update"
on public.fight_entities
for update
to authenticated
using (
  exists (
    select 1
    from public.fights f
    where f.id = fight_entities.fight_id
      and f.campaign_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.fights f
    where f.id = fight_entities.fight_id
      and f.campaign_id = auth.uid()
  )
);

create policy "fight_entity_owner_delete"
on public.fight_entities
for delete
to authenticated
using (
  exists (
    select 1
    from public.fights f
    where f.id = fight_entities.fight_id
      and f.campaign_id = auth.uid()
  )
);
