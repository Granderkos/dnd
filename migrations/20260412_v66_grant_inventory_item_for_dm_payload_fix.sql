drop function if exists public.grant_inventory_item_for_dm(
  uuid, text, text, integer, text, uuid, text, jsonb
);

create or replace function public.grant_inventory_item_for_dm(
  p_character_id text,
  p_title text,
  p_description text,
  p_quantity integer,
  p_category text,
  p_source_item_template_id text default null,
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
  v_character_id uuid;
  v_template_id uuid := null;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if not exists (select 1 from public.profiles where id = v_uid and role = 'dm') then
    raise exception 'Only DM can grant inventory items';
  end if;

  begin
    v_character_id := p_character_id::uuid;
  exception when invalid_text_representation then
    raise exception 'Invalid target character id format';
  end;

  if coalesce(p_source_item_template_id, '') <> '' then
    begin
      v_template_id := p_source_item_template_id::uuid;
    exception when invalid_text_representation then
      raise exception 'Invalid source item template id format';
    end;
  end if;

  if not exists (
    select 1
    from public.characters c
    join public.profiles p on p.id = c.user_id
    where c.id = v_character_id and p.role = 'player'
  ) then
    raise exception 'Invalid target character';
  end if;

  select coalesce(max(sort_order), -1) + 1
  into v_next_sort
  from public.inventory_items
  where character_id = v_character_id;

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
    v_character_id,
    concat('srv-', replace(gen_random_uuid()::text, '-', '')),
    v_next_sort,
    p_title,
    coalesce(p_description, ''),
    greatest(1, coalesce(p_quantity, 1)),
    coalesce(p_category, 'Other'),
    null,
    v_template_id,
    coalesce(p_source_origin, 'custom'),
    p_template_snapshot
  );
end;
$$;

grant execute on function public.grant_inventory_item_for_dm(
  text, text, text, integer, text, text, text, jsonb
) to authenticated;
