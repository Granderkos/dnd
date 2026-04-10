-- Fix ambiguous column references in assign_companion_from_template RPC.
-- Explicitly qualify table columns to avoid collisions with RETURNS TABLE output names.

create or replace function public.assign_companion_from_template(
  p_character_id uuid,
  p_template_id uuid,
  p_name_override text default null,
  p_notes text default null
)
returns table (
  id uuid,
  character_id uuid,
  entry_id uuid,
  kind text,
  name_override text,
  notes text,
  is_active boolean,
  custom_data jsonb,
  source_companion_template_id uuid,
  source_origin text,
  template_snapshot jsonb,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_template public.companion_templates%rowtype;
  v_entry_id uuid;
  v_auth_user uuid;
begin
  v_auth_user := auth.uid();
  if v_auth_user is null then
    raise exception 'Not authenticated';
  end if;

  if not exists (
    select 1
    from public.characters as c
    where c.id = p_character_id
      and c.user_id = v_auth_user
  ) then
    raise exception 'Character does not belong to current user';
  end if;

  select ct.*
  into v_template
  from public.companion_templates as ct
  where ct.id = p_template_id;

  if not found then
    raise exception 'Companion template not found';
  end if;

  insert into public.compendium_entries (
    type,
    subtype,
    slug,
    name,
    description,
    is_system,
    data,
    created_by
  )
  values (
    'companion',
    v_template.kind,
    concat(v_template.slug, '-', replace(gen_random_uuid()::text, '-', '')),
    v_template.name,
    v_template.notes,
    false,
    jsonb_build_object(
      'ac', v_template.armor_class,
      'hp', v_template.hit_points,
      'speed', v_template.speed_text
    ) || coalesce(v_template.custom_data, '{}'::jsonb),
    v_auth_user
  )
  returning public.compendium_entries.id
  into v_entry_id;

  return query
  insert into public.character_companions as cc (
    character_id,
    entry_id,
    kind,
    name_override,
    notes,
    is_active,
    custom_data,
    source_companion_template_id,
    source_origin,
    template_snapshot
  )
  values (
    p_character_id,
    v_entry_id,
    v_template.kind,
    p_name_override,
    coalesce(p_notes, v_template.notes),
    true,
    jsonb_build_object('source', 'template', 'template_id', v_template.id),
    v_template.id,
    'template',
    to_jsonb(v_template)
  )
  returning
    cc.id,
    cc.character_id,
    cc.entry_id,
    cc.kind,
    cc.name_override,
    cc.notes,
    cc.is_active,
    cc.custom_data,
    cc.source_companion_template_id,
    cc.source_origin,
    cc.template_snapshot,
    cc.created_at;
end
$$;

revoke all on function public.assign_companion_from_template(uuid, uuid, text, text) from public;
grant execute on function public.assign_companion_from_template(uuid, uuid, text, text) to authenticated;
