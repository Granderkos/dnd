-- Ensure stable client IDs for deterministic upserts and de-duplication.

alter table if exists inventory_items
  add column if not exists client_id text;

alter table if exists spells
  add column if not exists client_id text;

update inventory_items
set client_id = id::text
where client_id is null;

update spells
set client_id = id::text
where client_id is null;

alter table if exists inventory_items
  alter column client_id set not null;

alter table if exists spells
  alter column client_id set not null;

create unique index if not exists inventory_items_character_client_uidx
  on inventory_items (character_id, client_id);

create unique index if not exists spells_character_client_uidx
  on spells (character_id, client_id);

