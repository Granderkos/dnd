-- Add collecting initiative lifecycle and initiative request queue

alter table public.fights
  drop constraint if exists fights_status_check;

alter table public.fights
  add constraint fights_status_check check (status in ('draft', 'collecting_initiative', 'active', 'ended'));

create table if not exists public.fight_initiative_requests (
  id uuid primary key default gen_random_uuid(),
  fight_id uuid not null references public.fights(id) on delete cascade,
  user_id uuid not null,
  status text not null default 'pending' check (status in ('pending', 'submitted')),
  initiative_roll integer,
  created_at timestamptz not null default now(),
  submitted_at timestamptz
);

create unique index if not exists idx_fight_initiative_requests_unique on public.fight_initiative_requests (fight_id, user_id);
create index if not exists idx_fight_initiative_requests_fight_id on public.fight_initiative_requests (fight_id);
create index if not exists idx_fight_initiative_requests_user_id on public.fight_initiative_requests (user_id);
create index if not exists idx_fight_initiative_requests_status on public.fight_initiative_requests (status);

alter table public.fight_initiative_requests enable row level security;
grant select, insert, update, delete on public.fight_initiative_requests to authenticated;

-- DM owner policies

drop policy if exists "dm_select_initiative_requests" on public.fight_initiative_requests;
create policy "dm_select_initiative_requests"
on public.fight_initiative_requests
for select
to authenticated
using (
  exists (
    select 1
    from public.fights f
    where f.id = fight_initiative_requests.fight_id
      and f.campaign_id = auth.uid()
  )
);

drop policy if exists "dm_insert_initiative_requests" on public.fight_initiative_requests;
create policy "dm_insert_initiative_requests"
on public.fight_initiative_requests
for insert
to authenticated
with check (
  exists (
    select 1
    from public.fights f
    where f.id = fight_initiative_requests.fight_id
      and f.campaign_id = auth.uid()
  )
);

drop policy if exists "dm_update_initiative_requests" on public.fight_initiative_requests;
create policy "dm_update_initiative_requests"
on public.fight_initiative_requests
for update
to authenticated
using (
  exists (
    select 1
    from public.fights f
    where f.id = fight_initiative_requests.fight_id
      and f.campaign_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.fights f
    where f.id = fight_initiative_requests.fight_id
      and f.campaign_id = auth.uid()
  )
);

drop policy if exists "dm_delete_initiative_requests" on public.fight_initiative_requests;
create policy "dm_delete_initiative_requests"
on public.fight_initiative_requests
for delete
to authenticated
using (
  exists (
    select 1
    from public.fights f
    where f.id = fight_initiative_requests.fight_id
      and f.campaign_id = auth.uid()
  )
);

-- Player policies (own request row only)

drop policy if exists "player_select_own_initiative_request" on public.fight_initiative_requests;
create policy "player_select_own_initiative_request"
on public.fight_initiative_requests
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "player_update_own_initiative_request" on public.fight_initiative_requests;
create policy "player_update_own_initiative_request"
on public.fight_initiative_requests
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());
