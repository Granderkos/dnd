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
  v_notes_column text;
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

  select column_name
  into v_notes_column
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'character_notes'
    and column_name in ('payload', 'blob', 'notes_blob', 'data')
  order by case column_name
    when 'payload' then 1
    when 'blob' then 2
    when 'notes_blob' then 3
    else 4
  end
  limit 1;

  if v_notes_column is null then
    raise exception 'character_notes payload column not found';
  end if;

  execute format('select coalesce(%I, ''{}''::jsonb) from public.character_notes where character_id = $1', v_notes_column)
    into v_payload
    using v_character_id;

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

  execute format(
    'insert into public.character_notes (character_id, %1$I)
     values ($1, $2)
     on conflict (character_id)
     do update set %1$I = excluded.%1$I',
    v_notes_column
  )
  using v_character_id, v_payload;
end;
$$;

grant execute on function public.grant_currency_to_character_for_dm(text, integer) to authenticated;
