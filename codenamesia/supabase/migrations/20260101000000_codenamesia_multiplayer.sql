-- ============================================================================
-- CodenamesIA — multiplayer schema (Supabase PostgreSQL)
--
-- SECURITY MODEL (read this before changing anything):
--  * The Next.js server (service-role key) is the ONLY writer and the only
--    reader of secret data. Browsers never query game tables directly for
--    gameplay; they call the server-authoritative API.
--  * Card assignments live in `game_card_secrets`, which has RLS enabled
--    and ZERO policies -> only the service role can touch it. It is NOT in
--    the realtime publication.
--  * `games.state` (full engine jsonb incl. secrets) likewise has no client
--    policies. Members read the safe `games_public` / `game_cards_public`
--    views, which only expose an assignment once a card is revealed.
--  * `room_events` carries NO payload beyond type/versions; Supabase
--    Realtime (postgres_changes) notifies clients to refetch via the API.
--  * user_id columns accept Supabase auth uids AND server-issued guest
--    uuids, so they intentionally do NOT FK to auth.users. `profiles` does.
-- ============================================================================

create extension if not exists pgcrypto;

-- ------------------------------------------------------------- enum types
do $$ begin
  create type public.team as enum ('red', 'blue');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.assignment as enum ('red', 'blue', 'neutral', 'assassin');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.member_role as enum ('spymaster', 'operative');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.room_status as enum ('lobby', 'playing', 'finished', 'closed');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.game_status as enum ('lobby', 'playing', 'finished');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------- profiles
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text unique,
  avatar_url text,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------------- rooms
create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  host_id uuid not null,
  categories jsonb not null default '[]'::jsonb,
  difficulty text not null default 'medium' check (difficulty in ('easy', 'medium', 'hard')),
  language text not null default 'en' check (language in ('en', 'fr', 'ar')),
  mode text not null default 'human-vs-human',
  status public.room_status not null default 'lobby',
  max_players int not null default 10 check (max_players between 2 and 16),
  ai_spymaster_red boolean not null default false,
  ai_spymaster_blue boolean not null default false,
  game_id uuid,
  version int not null default 1,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists rooms_code_idx on public.rooms (code);
create index if not exists rooms_host_idx on public.rooms (host_id);
create index if not exists rooms_status_idx on public.rooms (status);

-- ------------------------------------------------------------ room_members
create table if not exists public.room_members (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms (id) on delete cascade,
  user_id uuid not null,
  display_name text not null default 'Player',
  team public.team,
  role public.member_role not null default 'operative',
  ready boolean not null default false,
  joined_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique (room_id, user_id)
);
-- Exactly one HUMAN spymaster per team per room (spec §4), enforced by DB:
create unique index if not exists one_spymaster_per_team
  on public.room_members (room_id, team)
  where role = 'spymaster' and team is not null;
create index if not exists room_members_room_idx on public.room_members (room_id);
create index if not exists room_members_user_idx on public.room_members (user_id);

-- ------------------------------------------------------------------- games
-- `state` = full server engine state INCLUDING secret assignments.
-- NO client RLS policies are created for this table (service role only).
create table if not exists public.games (
  id uuid primary key default gen_random_uuid(),
  room_id uuid references public.rooms (id) on delete set null,
  status public.game_status not null default 'playing',
  starting_team public.team not null,
  current_team public.team not null,
  current_phase text not null default 'awaiting-clue',
  current_clue jsonb,
  guesses_used int not null default 0,
  winner public.team,
  state_version int not null default 1,
  state jsonb not null default '{}'::jsonb,
  demo_mode boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists games_room_idx on public.games (room_id);

alter table public.rooms
  add constraint rooms_game_fk foreign key (game_id) references public.games (id) on delete set null
  not valid;

-- --------------------------------------------------------------- game_cards
-- PUBLIC card data only — deliberately NO assignment column here.
create table if not exists public.game_cards (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games (id) on delete cascade,
  word text not null,
  category text not null default '',
  position int not null check (position between 0 and 24),
  revealed boolean not null default false,
  revealed_at timestamptz,
  unique (game_id, position)
);
create index if not exists game_cards_game_idx on public.game_cards (game_id);

-- ------------------------------------------------------- game_card_secrets
-- THE key card. RLS on, zero policies, never published to realtime.
create table if not exists public.game_card_secrets (
  card_id uuid primary key references public.game_cards (id) on delete cascade,
  game_id uuid not null references public.games (id) on delete cascade,
  assignment public.assignment not null
);
create index if not exists game_card_secrets_game_idx on public.game_card_secrets (game_id);

-- --------------------------------------------------------------- game_clues
create table if not exists public.game_clues (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games (id) on delete cascade,
  team public.team not null,
  clue text not null,
  number int not null check (number between 0 and 9),
  given_by text not null default 'human' check (given_by in ('human', 'ai')),
  created_at timestamptz not null default now()
);
create index if not exists game_clues_game_idx on public.game_clues (game_id, created_at);

-- ------------------------------------------------------------- game_actions
create table if not exists public.game_actions (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games (id) on delete cascade,
  actor_id uuid,
  action_type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists game_actions_game_idx on public.game_actions (game_id, created_at);

-- --------------------------------------------------------------- room_events
-- Public-safe realtime notifications: type + versions ONLY, never secrets.
create table if not exists public.room_events (
  id bigint generated always as identity primary key,
  room_id uuid not null references public.rooms (id) on delete cascade,
  type text not null,
  room_version int not null default 0,
  game_id uuid,
  created_at timestamptz not null default now()
);
create index if not exists room_events_room_idx on public.room_events (room_id, id);

-- --------------------------------------------------------- helper: membership
create or replace function public.is_room_member(target_room uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.room_members m
    where m.room_id = target_room and m.user_id = auth.uid()
  );
$$;

create or replace function public.game_room_id(target_game uuid)
returns uuid
language sql stable security definer set search_path = public
as $$
  select room_id from public.games where id = target_game;
$$;

-- --------------------------------------------------------------------- RLS
alter table public.profiles enable row level security;
alter table public.rooms enable row level security;
alter table public.room_members enable row level security;
alter table public.games enable row level security;              -- no policies => service role only
alter table public.game_cards enable row level security;
alter table public.game_card_secrets enable row level security; -- no policies => service role only
alter table public.game_clues enable row level security;
alter table public.game_actions enable row level security;
alter table public.room_events enable row level security;

-- profiles: public read, self update
drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles for select using (true);
drop policy if exists profiles_self_write on public.profiles;
create policy profiles_self_write on public.profiles for all
  using (auth.uid() = id) with check (auth.uid() = id);

-- rooms / members: members can read their own room; ALL writes via server API
drop policy if exists rooms_member_read on public.rooms;
create policy rooms_member_read on public.rooms for select
  using (public.is_room_member(id) or host_id = auth.uid());
drop policy if exists members_read on public.room_members;
create policy members_read on public.room_members for select
  using (public.is_room_member(room_id) or user_id = auth.uid());

-- cards (public columns only) / clues / actions / events: room members read
drop policy if exists cards_member_read on public.game_cards;
create policy cards_member_read on public.game_cards for select
  using (public.is_room_member(public.game_room_id(game_id)));
drop policy if exists clues_member_read on public.game_clues;
create policy clues_member_read on public.game_clues for select
  using (public.is_room_member(public.game_room_id(game_id)));
drop policy if exists actions_member_read on public.game_actions;
create policy actions_member_read on public.game_actions for select
  using (public.is_room_member(public.game_room_id(game_id)));
drop policy if exists events_member_read on public.room_events;
create policy events_member_read on public.room_events for select
  using (public.is_room_member(room_id));

-- ------------------------------------------------------------ safe views
-- NOTE: views run with the view owner's rights on the base tables. The
-- membership + revealed checks INSIDE the view are therefore the security
-- boundary: assignment is only projected for REVEALED cards, and only to
-- members of the game's room. There is intentionally NO spymaster view in
-- the database: the secret board is served only by the Next.js API after
-- membership+role verification (GET /api/games/[id]/spymaster).
create or replace view public.games_public as
select g.id, g.room_id, g.status, g.starting_team, g.current_team,
       g.current_phase, g.current_clue, g.guesses_used, g.winner,
       g.state_version, g.demo_mode, g.created_at
from public.games g
where g.room_id is null or public.is_room_member(g.room_id);

create or replace view public.game_cards_public as
select c.id, c.game_id, c.word, c.category, c.position, c.revealed, c.revealed_at,
       case when c.revealed then s.assignment else null end as assignment
from public.game_cards c
join public.game_card_secrets s on s.card_id = c.id
where public.is_room_member(public.game_room_id(c.game_id));

grant select on public.games_public, public.game_cards_public to authenticated, anon;

-- ----------------------------------------------------------------- realtime
-- Only public-safe tables are published. game_card_secrets and games.state
-- are NEVER streamed to browsers.
do $$ begin
  alter publication supabase_realtime add table public.room_events;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.room_members;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.rooms;
exception when duplicate_object then null; end $$;

-- ------------------------------------------------------ profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, username)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users for each row execute function public.handle_new_user();
