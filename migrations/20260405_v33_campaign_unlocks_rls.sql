-- V3.3 fix: allow campaign unlock writes for DM and reads for campaign participants.

alter table public.campaign_entry_unlocks enable row level security;

grant usage on schema public to authenticated;
grant select, insert, update, delete on table public.campaign_entry_unlocks to authenticated;

drop policy if exists "campaign_unlocks_dm_select" on public.campaign_entry_unlocks;
create policy "campaign_unlocks_dm_select"
on public.campaign_entry_unlocks
for select
to authenticated
using (campaign_id = auth.uid());

drop policy if exists "campaign_unlocks_dm_insert" on public.campaign_entry_unlocks;
create policy "campaign_unlocks_dm_insert"
on public.campaign_entry_unlocks
for insert
to authenticated
with check (campaign_id = auth.uid());

drop policy if exists "campaign_unlocks_dm_update" on public.campaign_entry_unlocks;
create policy "campaign_unlocks_dm_update"
on public.campaign_entry_unlocks
for update
to authenticated
using (campaign_id = auth.uid())
with check (campaign_id = auth.uid());

drop policy if exists "campaign_unlocks_dm_delete" on public.campaign_entry_unlocks;
create policy "campaign_unlocks_dm_delete"
on public.campaign_entry_unlocks
for delete
to authenticated
using (campaign_id = auth.uid());

drop policy if exists "campaign_unlocks_player_select_shared" on public.campaign_entry_unlocks;
create policy "campaign_unlocks_player_select_shared"
on public.campaign_entry_unlocks
for select
to authenticated
using (
  player_id is null
  and exists (
    select 1
    from public.fight_initiative_requests r
    join public.fights f on f.id = r.fight_id
    where r.user_id = auth.uid()
      and f.campaign_id = campaign_entry_unlocks.campaign_id
  )
);
