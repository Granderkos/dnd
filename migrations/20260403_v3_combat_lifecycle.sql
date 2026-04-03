-- Combat lifecycle + player initiative support for v3.2

alter table public.fights
  add column if not exists status text not null default 'draft';

alter table public.fights
  drop constraint if exists fights_status_check;

alter table public.fights
  add constraint fights_status_check check (status in ('draft', 'active', 'ended'));

alter table public.fight_entities
  add column if not exists initiative_mod integer not null default 0;

-- keep existing encounters usable: active fights become active lifecycle state
update public.fights
set status = 'active'
where is_active = true and status = 'draft';

create index if not exists idx_fights_status on public.fights (status);

-- Player initiative submit permissions (additive to DM-owner policies).

drop policy if exists "player_select_own_fight_entity" on public.fight_entities;
create policy "player_select_own_fight_entity"
on public.fight_entities
for select
to authenticated
using (
  entity_type = 'player'
  and exists (
    select 1
    from public.characters c
    where c.id = fight_entities.character_id
      and c.user_id = auth.uid()
  )
);

drop policy if exists "player_update_own_fight_entity" on public.fight_entities;
create policy "player_update_own_fight_entity"
on public.fight_entities
for update
to authenticated
using (
  entity_type = 'player'
  and exists (
    select 1
    from public.characters c
    where c.id = fight_entities.character_id
      and c.user_id = auth.uid()
  )
)
with check (
  entity_type = 'player'
  and exists (
    select 1
    from public.characters c
    where c.id = fight_entities.character_id
      and c.user_id = auth.uid()
  )
);
