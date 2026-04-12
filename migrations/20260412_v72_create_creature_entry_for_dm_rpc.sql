create or replace function public.create_creature_entry_for_dm(
  p_subtype text,
  p_slug text,
  p_name text,
  p_description text,
  p_data jsonb
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

  if not exists (select 1 from public.profiles where id = v_uid and role = 'dm') then
    raise exception 'Only DM can create creature entries';
  end if;

  insert into public.compendium_entries (
    type,
    subtype,
    slug,
    name,
    description,
    data,
    is_system,
    created_by
  ) values (
    'creature',
    coalesce(nullif(trim(p_subtype), ''), 'monster'),
    p_slug,
    p_name,
    nullif(trim(coalesce(p_description, '')), ''),
    coalesce(p_data, '{}'::jsonb),
    false,
    v_uid
  )
  returning * into v_row;

  return v_row;
end;
$$;

grant execute on function public.create_creature_entry_for_dm(text, text, text, text, jsonb) to authenticated;
