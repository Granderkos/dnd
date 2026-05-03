alter table public.character_companions enable row level security;

drop policy if exists "character_companions_select_own" on public.character_companions;
create policy "character_companions_select_own"
on public.character_companions
for select
to authenticated
using (
  exists (
    select 1
    from public.characters c
    where c.id = character_companions.character_id
      and (c.user_id = auth.uid() or public.is_dm())
  )
);
