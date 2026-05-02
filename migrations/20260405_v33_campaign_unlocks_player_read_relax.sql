-- V3.3 hotfix: shared unlock visibility must not depend on temporary initiative rows.
-- Players should be able to see shared compendium unlocks even after combat/request cleanup.

drop policy if exists "campaign_unlocks_player_select_shared" on public.campaign_entry_unlocks;
create policy "campaign_unlocks_player_select_shared"
on public.campaign_entry_unlocks
for select
to authenticated
using (player_id is null);
