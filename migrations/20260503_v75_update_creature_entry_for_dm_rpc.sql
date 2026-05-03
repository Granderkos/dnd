create or replace function public.update_creature_entry_for_dm(
  p_entry_id uuid,
  p_name text default null,
  p_description text default null,
  p_data jsonb default null,
  p_subtype text default null
)
returns public.compendium_entries
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.compendium_entries;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  update public.compendium_entries ce
  set
    name = coalesce(nullif(trim(p_name), ''), ce.name),
    description = case
      when p_description is null then ce.description
      else nullif(trim(p_description), '')
    end,
    data = coalesce(p_data, ce.data),
    subtype = coalesce(nullif(trim(p_subtype), ''), ce.subtype),
    updated_at = now()
  where ce.id = p_entry_id
    and ce.type = 'creature'
    and ce.is_system = false
    and ce.created_by = v_uid
  returning ce.* into v_row;

  if not found then
    raise exception 'No editable creature found for id %', p_entry_id;
  end if;

  return v_row;
end;
$$;

grant execute on function public.update_creature_entry_for_dm(uuid, text, text, jsonb, text) to authenticated;
