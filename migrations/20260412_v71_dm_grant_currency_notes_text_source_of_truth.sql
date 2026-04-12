create or replace function public.grant_currency_to_character_for_dm(
  p_character_id text,
  p_gold integer default 0
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_character_id uuid;
  v_notes_text text := '{}';
  v_payload jsonb := '{}'::jsonb;
  v_currency jsonb := '{}'::jsonb;
  v_next_gp integer := 0;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if not exists (select 1 from public.profiles where id = v_uid and role = 'dm') then
    raise exception 'Only DM can grant currency';
  end if;

  begin
    v_character_id := p_character_id::uuid;
  exception when invalid_text_representation then
    raise exception 'Invalid target character id format';
  end;

  if not exists (
    select 1
    from public.characters c
    join public.profiles p on p.id = c.user_id
    where c.id = v_character_id and p.role = 'player'
  ) then
    raise exception 'Invalid target character';
  end if;

  select coalesce(notes, '{}')
    into v_notes_text
  from public.character_notes
  where character_id = v_character_id;

  begin
    v_payload := coalesce(v_notes_text::jsonb, '{}'::jsonb);
  exception when others then
    v_payload := '{}'::jsonb;
  end;

  v_currency := coalesce(v_payload->'inventoryCurrency', '{}'::jsonb);
  v_next_gp := greatest(0, coalesce((v_currency->>'gp')::integer, 0) + greatest(0, coalesce(p_gold, 0)));

  v_payload := jsonb_set(
    v_payload,
    '{inventoryCurrency}',
    jsonb_build_object(
      'pp', coalesce((v_currency->>'pp')::integer, 0),
      'gp', v_next_gp,
      'ep', coalesce((v_currency->>'ep')::integer, 0),
      'sp', coalesce((v_currency->>'sp')::integer, 0),
      'cp', coalesce((v_currency->>'cp')::integer, 0)
    ),
    true
  );

  insert into public.character_notes (character_id, notes)
  values (v_character_id, v_payload::text)
  on conflict (character_id)
  do update set notes = excluded.notes;
end;
$$;

grant execute on function public.grant_currency_to_character_for_dm(text, integer) to authenticated;
