-- V3.4 performance: keep small portrait preview in hot character row, keep original separately.

alter table public.characters
  add column if not exists portrait_preview_url text,
  add column if not exists portrait_original_url text;
