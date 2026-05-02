alter table public.inventory_items
  add column if not exists parent_client_id text;

create index if not exists inventory_items_character_parent_idx
  on public.inventory_items (character_id, parent_client_id);
