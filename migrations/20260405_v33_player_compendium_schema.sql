-- V3.3 Player Compendium schema refinements

alter table public.character_companions
  add column if not exists custom_data jsonb not null default '{}'::jsonb;

-- Remove duplicate shared unlock rows before adding unique protection.
delete from public.campaign_entry_unlocks a
using public.campaign_entry_unlocks b
where a.ctid < b.ctid
  and a.player_id is null
  and b.player_id is null
  and a.campaign_id = b.campaign_id
  and a.entry_id = b.entry_id;

create unique index if not exists idx_campaign_unlocks_shared_unique
  on public.campaign_entry_unlocks (campaign_id, entry_id)
  where player_id is null;
