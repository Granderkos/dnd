-- v3.5 stabilization: persist inventory category in normalized table.

alter table if exists public.inventory_items
  add column if not exists category text;

update public.inventory_items
set category = 'Other'
where category is null or btrim(category) = '';

alter table if exists public.inventory_items
  alter column category set default 'Other';

alter table if exists public.inventory_items
  alter column category set not null;
