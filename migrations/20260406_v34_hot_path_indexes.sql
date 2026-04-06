-- V3.4 performance: hot-path indexes for dashboard, presence and fight startup.

create index if not exists idx_character_notes_character_id
  on public.character_notes (character_id);

create index if not exists idx_activity_status_user_id
  on public.activity_status (user_id);

create index if not exists idx_activity_status_last_seen
  on public.activity_status (last_seen desc);

create index if not exists idx_profiles_role_created_at
  on public.profiles (role, created_at);

create index if not exists idx_characters_user_id
  on public.characters (user_id);

create index if not exists idx_fights_campaign_active_status_created
  on public.fights (campaign_id, is_active, status, created_at desc);

create index if not exists idx_fight_entities_fight_entity_type
  on public.fight_entities (fight_id, entity_type);

create index if not exists idx_fight_initiative_requests_fight_status
  on public.fight_initiative_requests (fight_id, status);

create index if not exists idx_fight_initiative_requests_user_status
  on public.fight_initiative_requests (user_id, status);
