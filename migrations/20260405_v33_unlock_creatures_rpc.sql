-- V3.3 fix: unlock creature rows through SECURITY DEFINER RPC to avoid client-side RLS failures.

create or replace function public.unlock_fight_creatures_for_campaign(
  p_campaign_id uuid,
  p_fight_id uuid
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted_count integer := 0;
begin
  with candidate_entries as (
    select distinct fe.entry_id
    from public.fight_entities fe
    where fe.fight_id = p_fight_id
      and fe.entity_type = 'monster'
      and fe.entry_id is not null
  )
  insert into public.campaign_entry_unlocks (campaign_id, entry_id, player_id, is_unlocked)
  select p_campaign_id, c.entry_id, null, true
  from candidate_entries c
  on conflict do nothing;

  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$$;

revoke all on function public.unlock_fight_creatures_for_campaign(uuid, uuid) from public;
grant execute on function public.unlock_fight_creatures_for_campaign(uuid, uuid) to authenticated;
