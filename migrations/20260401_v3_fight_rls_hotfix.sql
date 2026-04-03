-- Hotfix: remove dependency on public.users visibility inside RLS policy checks.
-- Policies are now scoped strictly by campaign ownership convention: campaign_id = auth.uid().

alter table public.fights enable row level security;
alter table public.fight_entities enable row level security;

drop policy if exists "dm_select_own_fights" on public.fights;
drop policy if exists "dm_insert_own_fights" on public.fights;
drop policy if exists "dm_update_own_fights" on public.fights;
drop policy if exists "dm_delete_own_fights" on public.fights;

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

drop policy if exists "dm_select_own_fight_entities" on public.fight_entities;
drop policy if exists "dm_insert_own_fight_entities" on public.fight_entities;
drop policy if exists "dm_update_own_fight_entities" on public.fight_entities;
drop policy if exists "dm_delete_own_fight_entities" on public.fight_entities;

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
