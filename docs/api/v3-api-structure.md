# V3.0 API Structure Proposal

## DM Bestiary
- `GET /api/v3/bestiary`
  - Returns all `compendium_entries` where `type='creature'`.
- `POST /api/v3/bestiary`
  - Creates custom creature (`is_system=false`).
- `PATCH /api/v3/bestiary/:id`
  - Updates creature fields.
- `POST /api/v3/fights/:fightId/entities/monster`
  - Adds monster to a fight with generated initiative.

## Fights
- `POST /api/v3/fights`
  - Creates a fight for campaign.
- `GET /api/v3/fights/:id`
  - Fight metadata + ordered entities.
- `POST /api/v3/fights/:id/entities`
  - Adds participant (`player|monster|npc|summon`).
- `PATCH /api/v3/fights/:id/entities/:entityId/hp`
  - Updates `current_hp`.
- `PATCH /api/v3/fights/:id/entities/:entityId/notes`
  - Updates notes.
- `DELETE /api/v3/fights/:id/entities/:entityId`
  - Removes participant.
- `POST /api/v3/fights/:id/start`
  - Receives initiative submissions and persists sorted turn order.
- `POST /api/v3/fights/:id/next-turn`
  - Advances turn and rotates order.

## Player Compendium
- `GET /api/v3/compendium/creatures?campaignId=...`
  - Returns unlocked entries from `campaign_entry_unlocks` and placeholder metadata for locked rows.
- `GET /api/v3/companions?characterId=...`
  - Returns assigned companions for character.
- `POST /api/v3/companions`
  - Assigns companion to character.
- `PATCH /api/v3/companions/:id`
  - Activates/deactivates companion.

## Turn Display Mode
- `GET /api/v3/fights/:id/display`
  - Read-only feed: turn order, active turn, hp values.

## Realtime Event Channels (Supabase Realtime)
- `fight:{fightId}:initiative-modal`
  - DM start combat prompt; players submit initiative.
- `fight:{fightId}:turn-updates`
  - Broadcasts order changes, hp updates, turn advance.
