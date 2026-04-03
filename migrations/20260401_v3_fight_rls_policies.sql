-- V3.0.5: secure DM fight write/read access with RLS policies
-- Current app model uses campaign_id = DM user id.

grant usage on schema public to authenticated;
grant select, insert, update, delete on table public.fights to authenticated;
grant select, insert, update, delete on table public.fight_entities to authenticated;

alter table public.fights enable row level security;
alter table public.fight_entities enable row level security;

-- fights policies

drop policy if exists "dm_select_own_fights" on public.fights;
create policy "dm_select_own_fights"
on public.fights
for select
to authenticated
using (
  campaign_id = auth.uid()
  and exists (
    select 1
    from public.users u
    where u.id = auth.uid()
      and u.role = 'dm'
  )
);

drop policy if exists "dm_insert_own_fights" on public.fights;
create policy "dm_insert_own_fights"
on public.fights
for insert
to authenticated
with check (
  campaign_id = auth.uid()
  and exists (
    select 1
    from public.users u
    where u.id = auth.uid()
      and u.role = 'dm'
  )
);

drop policy if exists "dm_update_own_fights" on public.fights;
create policy "dm_update_own_fights"
on public.fights
for update
to authenticated
using (
  campaign_id = auth.uid()
  and exists (
    select 1
    from public.users u
    where u.id = auth.uid()
      and u.role = 'dm'
  )
)
with check (
  campaign_id = auth.uid()
  and exists (
    select 1
    from public.users u
    where u.id = auth.uid()
      and u.role = 'dm'
  )
);

drop policy if exists "dm_delete_own_fights" on public.fights;
create policy "dm_delete_own_fights"
on public.fights
for delete
to authenticated
using (
  campaign_id = auth.uid()
  and exists (
    select 1
    from public.users u
    where u.id = auth.uid()
      and u.role = 'dm'
  )
);

-- fight_entities policies

drop policy if exists "dm_select_own_fight_entities" on public.fight_entities;
create policy "dm_select_own_fight_entities"
on public.fight_entities
for select
to authenticated
using (
  exists (
    select 1
    from public.fights f
    join public.users u on u.id = auth.uid()
    where f.id = fight_entities.fight_id
      and f.campaign_id = auth.uid()
      and u.role = 'dm'
  )
);

drop policy if exists "dm_insert_own_fight_entities" on public.fight_entities;
create policy "dm_insert_own_fight_entities"
on public.fight_entities
for insert
to authenticated
with check (
  exists (
    select 1
    from public.fights f
    join public.users u on u.id = auth.uid()
    where f.id = fight_entities.fight_id
      and f.campaign_id = auth.uid()
      and u.role = 'dm'
  )
);

drop policy if exists "dm_update_own_fight_entities" on public.fight_entities;
create policy "dm_update_own_fight_entities"
on public.fight_entities
for update
to authenticated
using (
  exists (
    select 1
    from public.fights f
    join public.users u on u.id = auth.uid()
    where f.id = fight_entities.fight_id
      and f.campaign_id = auth.uid()
      and u.role = 'dm'
  )
)
with check (
  exists (
    select 1
    from public.fights f
    join public.users u on u.id = auth.uid()
    where f.id = fight_entities.fight_id
      and f.campaign_id = auth.uid()
      and u.role = 'dm'
  )
);

drop policy if exists "dm_delete_own_fight_entities" on public.fight_entities;
create policy "dm_delete_own_fight_entities"
on public.fight_entities
for delete
to authenticated
using (
  exists (
    select 1
    from public.fights f
    join public.users u on u.id = auth.uid()
    where f.id = fight_entities.fight_id
      and f.campaign_id = auth.uid()
      and u.role = 'dm'
  )
);
