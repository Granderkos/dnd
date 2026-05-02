create or replace function public.create_companion_entry_for_user(
  p_kind text,
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

  if not exists (
    select 1
    from public.profiles
    where id = v_uid
      and role in ('dm', 'player')
  ) then
    raise exception 'Only authenticated DM/Player profiles can create companion entries';
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
    'companion',
    coalesce(nullif(trim(p_kind), ''), 'pet'),
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

grant execute on function public.create_companion_entry_for_user(text, text, text, text, jsonb) to authenticated;
