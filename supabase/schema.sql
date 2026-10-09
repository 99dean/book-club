-- The Book Club database. Run this once in Supabase: SQL Editor → New query → paste → Run.
--
-- BEFORE RUNNING: change the family code on the line marked "FAMILY CODE" below.
-- Use three or four words (e.g. 'lonesome-dove-infinity'). It's case-insensitive.
-- Everyone joins with it once per device; the invite link can carry it (?code=...).
-- Running the script again is safe: it only updates the code and adds anything missing.

set client_min_messages = warning;

-- ---------------------------------------------------------------- Who's allowed in

create table if not exists public.club_devices (
  user_id uuid primary key references auth.users on delete cascade,
  joined_at timestamptz not null default now()
);

create table if not exists public.club_secret (
  id int primary key default 1 check (id = 1),
  code_hash text not null
);

insert into public.club_secret (id, code_hash)
values (1, extensions.crypt(lower('CHANGE-ME-TO-YOUR-FAMILY-CODE'), extensions.gen_salt('bf')))  -- FAMILY CODE
on conflict (id) do update set code_hash = excluded.code_hash;

create or replace function public.is_club_device() returns boolean
language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.club_devices where user_id = auth.uid()) $$;

create or replace function public.join_club(code text) returns boolean
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null then return false; end if;
  if exists (select 1 from public.club_secret
             where code_hash = extensions.crypt(lower(trim(code)), code_hash)) then
    insert into public.club_devices (user_id) values (auth.uid()) on conflict do nothing;
    return true;
  end if;
  return false;
end $$;

alter table public.club_devices enable row level security;
alter table public.club_secret enable row level security;
revoke all on public.club_secret from anon, authenticated;

-- ---------------------------------------------------------------- Club data

create table if not exists public.members (
  id text primary key default gen_random_uuid()::text,
  name text not null,
  color text not null default '#3B6FB6',
  city text not null default '',
  tz text not null default 'America/New_York',
  is_guest boolean not null default false,
  active boolean not null default true,
  prefs jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.books (
  id text primary key default gen_random_uuid()::text,
  title text not null,
  author text,
  pitch text,
  cover_url text,
  page_count int,
  status text not null default 'queue' check (status in ('queue', 'current', 'finished')),
  suggested_by text references public.members on delete set null,
  picked_by text references public.members on delete set null,
  added_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.votes (
  book_id text references public.books on delete cascade,
  member_id text references public.members on delete cascade,
  created_at timestamptz not null default now(),
  primary key (book_id, member_id)
);

create table if not exists public.progress (
  book_id text references public.books on delete cascade,
  member_id text references public.members on delete cascade,
  percent int not null default 0 check (percent between 0 and 100),
  sitting_out boolean not null default false,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  primary key (book_id, member_id)
);

create table if not exists public.posts (
  id text primary key default gen_random_uuid()::text,
  book_id text not null references public.books on delete cascade,
  member_id text not null references public.members on delete cascade,
  kind text not null check (kind in ('question', 'thought', 'quote')),
  body text not null,
  chapter text not null default '',
  at_percent int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.replies (
  id text primary key default gen_random_uuid()::text,
  post_id text not null references public.posts on delete cascade,
  member_id text not null references public.members on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.torn_pages (
  id text primary key default gen_random_uuid()::text,
  book_id text not null references public.books on delete cascade,
  from_member text not null references public.members on delete cascade,
  to_member text not null references public.members on delete cascade,
  passage text not null,
  note text not null default '',
  page_label text not null default '',
  at_percent int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.ratings (
  book_id text references public.books on delete cascade,
  member_id text references public.members on delete cascade,
  stars int not null check (stars between 1 and 5),
  review text not null default '',
  created_at timestamptz not null default now(),
  primary key (book_id, member_id)
);

create table if not exists public.meetups (
  id text primary key default gen_random_uuid()::text,
  book_id text not null references public.books on delete cascade,
  starts_at timestamptz not null,
  facetime_url text not null default '',
  goal_percent int check (goal_percent between 0 and 100),
  created_at timestamptz not null default now()
);

create table if not exists public.club_settings (
  key text primary key,
  value jsonb not null,
  created_at timestamptz not null default now()
);

-- Only devices that joined with the family code can read or write anything.
do $$
declare t text;
begin
  foreach t in array array['members', 'books', 'votes', 'progress', 'posts', 'replies',
                           'torn_pages', 'ratings', 'meetups', 'club_settings'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists club_only on public.%I', t);
    execute format('create policy club_only on public.%I for all to authenticated
                    using (public.is_club_device()) with check (public.is_club_device())', t);
    -- Live updates between phones.
    if not exists (select 1 from pg_publication_tables
                   where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------- Starting data

insert into public.members (id, name, color, city, tz, is_guest, active, prefs) values
  ('m-joe', 'Joe', '#D08A3C', 'Philly', 'America/New_York', false, true, '{}'),
  ('m-jen', 'Jen', '#C2577A', 'Philly', 'America/New_York', false, true, '{}'),
  ('m-dean', 'Dean', '#3B6FB6', 'DC', 'America/New_York', false, true, '{}'),
  ('m-alec', 'Alec', '#7A5BB0', 'London', 'Europe/London', false, true, '{}'),
  ('m-alexa', 'Alexa', '#2F8F6B', 'DC', 'America/New_York', false, true, '{}'),
  ('m-kyleigh', 'Kyleigh', '#B0563A', 'London', 'Europe/London', true, false, '{}')
on conflict (id) do nothing;

-- Alexa became a core member after the first setup; this keeps older databases in step.
update public.members set is_guest = false, active = true where id = 'm-alexa' and is_guest;

update public.members
set prefs = '{"notify": {"questions": true, "replies": true, "new_book": true, "meetup": true, "passed": true}, "library": ""}'
where prefs = '{}'::jsonb;

insert into public.books (id, title, author, pitch, suggested_by) values
  ('b-agi', 'The AGI Chronicles', 'Kevin Roose', 'Brand new. The inside story of the race to build AI.', 'm-dean'),
  ('b-abundance', 'Abundance', 'Ezra Klein & Derek Thompson', 'Why America stopped building, and how it could start again.', 'm-dean'),
  ('b-evil', 'Evil Geniuses', 'Kurt Andersen', 'Liked The Breakup? This is his nonfiction take.', 'm-dean'),
  ('b-dunces', 'A Confederacy of Dunces', 'John Kennedy Toole', 'The wildcard: a cult-classic comic novel I’ve wanted to read.', 'm-dean')
on conflict (id) do nothing;

insert into public.club_settings (key, value) values
  ('birthday', '{"member_id": "m-joe", "seen": false}')
on conflict (key) do nothing;
