-- Bridge DM fight HP edits to real character HP (player entities),
-- and expose player combat state for DM fight UI via SECURITY DEFINER RPCs.

create or replace function public.set_fight_entity_hp(
  p_entity_id uuid,
  p_current_hp integer
)
returns table (
  entity_id uuid,
  entity_type text,
  character_id uuid,
  current_hp integer,
  max_hp integer,
  death_successes integer,
  death_failures integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
  v_entity public.fight_entities%rowtype;
begin
  select f.campaign_id into v_owner
  from public.fight_entities fe
  join public.fights f on f.id = fe.fight_id
  where fe.id = p_entity_id;

  if v_owner is null then
    raise exception 'Fight entity not found';
  end if;

  if auth.uid() is distinct from v_owner then
    raise exception 'Not authorized to update this fight entity';
  end if;

  update public.fight_entities
  set current_hp = greatest(0, p_current_hp)
  where id = p_entity_id
  returning * into v_entity;

  if v_entity.entity_type = 'player' and v_entity.character_id is not null then
    update public.characters
    set
      hp_current = greatest(0, p_current_hp),
      death_successes = case when p_current_hp > 0 then 0 else death_successes end,
      death_failures = case when p_current_hp > 0 then 0 else death_failures end
    where id = v_entity.character_id;
  end if;

  return query
  select
    v_entity.id,
    v_entity.entity_type::text,
    v_entity.character_id,
    v_entity.current_hp,
    v_entity.max_hp,
    coalesce(c.death_successes, 0),
    coalesce(c.death_failures, 0)
  from public.characters c
  where c.id = v_entity.character_id
  union all
  select
    v_entity.id,
    v_entity.entity_type::text,
    v_entity.character_id,
    v_entity.current_hp,
    v_entity.max_hp,
    0,
    0
  where v_entity.character_id is null;
end;
$$;

revoke all on function public.set_fight_entity_hp(uuid, integer) from public;
grant execute on function public.set_fight_entity_hp(uuid, integer) to authenticated;

create or replace function public.get_fight_character_combat_state(
  p_fight_id uuid
)
returns table (
  character_id uuid,
  hp_current integer,
  hp_max integer,
  death_successes integer,
  death_failures integer
)
language sql
security definer
set search_path = public
as $$
  select
    c.id as character_id,
    c.hp_current,
    c.hp_max,
    coalesce(c.death_successes, 0) as death_successes,
    coalesce(c.death_failures, 0) as death_failures
  from public.fight_entities fe
  join public.fights f on f.id = fe.fight_id
  join public.characters c on c.id = fe.character_id
  where fe.fight_id = p_fight_id
    and fe.entity_type = 'player'
    and auth.uid() = f.campaign_id;
$$;

revoke all on function public.get_fight_character_combat_state(uuid) from public;
grant execute on function public.get_fight_character_combat_state(uuid) to authenticated;
