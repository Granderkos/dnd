create or replace function public.create_item_template_for_dm(
  p_slug text,
  p_name text,
  p_description text,
  p_category text,
  p_item_kind text,
  p_item_subtype text,
  p_rarity text,
  p_weight numeric,
  p_value_text text,
  p_damage_text text,
  p_damage_type text,
  p_range_text text,
  p_armor_kind text,
  p_ac_base integer,
  p_charges_max integer,
  p_charges_current integer,
  p_usage_type text,
  p_properties jsonb,
  p_tags jsonb
)
returns public.item_templates
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.item_templates;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if not exists (select 1 from public.profiles where id = v_uid and role = 'dm') then
    raise exception 'Only DM can create item templates';
  end if;

  insert into public.item_templates (
    slug, name, description, category, item_kind, item_subtype, rarity, weight, value_text,
    damage_text, damage_type, range_text, armor_kind, ac_base, charges_max, charges_current,
    usage_type, properties, tags, is_official, created_by
  ) values (
    p_slug, p_name, coalesce(p_description, ''), coalesce(p_category, 'Other'),
    p_item_kind, p_item_subtype, p_rarity, p_weight, p_value_text,
    p_damage_text, p_damage_type, p_range_text, p_armor_kind, p_ac_base, p_charges_max, p_charges_current,
    p_usage_type, coalesce(p_properties, '[]'::jsonb), coalesce(p_tags, '[]'::jsonb), false, v_uid
  )
  returning * into v_row;

  return v_row;
end;
$$;

grant execute on function public.create_item_template_for_dm(
  text, text, text, text, text, text, text, numeric, text, text, text, text, text, integer, integer, integer, text, jsonb, jsonb
) to authenticated;

create or replace function public.grant_inventory_item_for_dm(
  p_character_id uuid,
  p_title text,
  p_description text,
  p_quantity integer,
  p_category text,
  p_source_item_template_id uuid default null,
  p_source_origin text default 'custom',
  p_template_snapshot jsonb default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_next_sort integer := 0;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if not exists (select 1 from public.profiles where id = v_uid and role = 'dm') then
    raise exception 'Only DM can grant inventory items';
  end if;

  if not exists (
    select 1
    from public.characters c
    join public.profiles p on p.id = c.user_id
    where c.id = p_character_id and p.role = 'player'
  ) then
    raise exception 'Invalid target character';
  end if;

  select coalesce(max(sort_order), -1) + 1
  into v_next_sort
  from public.inventory_items
  where character_id = p_character_id;

  insert into public.inventory_items (
    character_id,
    client_id,
    sort_order,
    title,
    description,
    quantity,
    category,
    parent_client_id,
    source_item_template_id,
    source_origin,
    template_snapshot
  ) values (
    p_character_id,
    concat('srv-', replace(gen_random_uuid()::text, '-', '')),
    v_next_sort,
    p_title,
    coalesce(p_description, ''),
    greatest(1, coalesce(p_quantity, 1)),
    coalesce(p_category, 'Other'),
    null,
    p_source_item_template_id,
    coalesce(p_source_origin, 'custom'),
    p_template_snapshot
  );
end;
$$;

grant execute on function public.grant_inventory_item_for_dm(
  uuid, text, text, integer, text, uuid, text, jsonb
) to authenticated;
