-- Allow players to insert their own fight entity row during initiative submission.
-- Scope is limited to fights where the player has an initiative request.

drop policy if exists "player_insert_own_fight_entity" on public.fight_entities;
create policy "player_insert_own_fight_entity"
on public.fight_entities
for insert
to authenticated
with check (
  entity_type = 'player'
  and exists (
    select 1
    from public.characters c
    where c.id = fight_entities.character_id
      and c.user_id = auth.uid()
  )
  and exists (
    select 1
    from public.fight_initiative_requests r
    where r.fight_id = fight_entities.fight_id
      and r.user_id = auth.uid()
      and r.status in ('pending', 'submitted')
  )
);
