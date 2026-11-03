-- Arrow F.C. · struttura del database
-- Da incollare in Supabase → SQL Editor → New query → Run

-- Giocatori (id = numero di maglia)
create table if not exists players (
  id int primary key,
  name text not null,
  role text not null check (role in ('GK', 'DIF', 'CEN', 'ATT')),
  label text,
  photo_url text,
  active boolean not null default true
);

-- Partite (passate e future)
create table if not exists matches (
  id bigserial primary key,
  match_date timestamptz not null,
  opponent text,
  crest_url text,
  competition text not null default 'Serie A LegaCalcio a 8',
  score_us int,
  score_them int
);

-- Presenze: chi era in campo in ogni partita
create table if not exists match_players (
  match_id bigint references matches(id) on delete cascade,
  player_id int references players(id) on delete cascade,
  primary key (match_id, player_id)
);

-- Gol e assist per partita
create table if not exists match_events (
  id bigserial primary key,
  match_id bigint references matches(id) on delete cascade,
  player_id int references players(id) on delete set null,
  scorer_name text,
  kind text not null check (kind in ('goal', 'assist')),
  n int not null default 1
);

-- Galleria (foto e video)
create table if not exists gallery (
  id bigserial primary key,
  kind text not null check (kind in ('photo', 'video')),
  category text,
  caption text,
  src text not null,
  match_id bigint references matches(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Sponsor
create table if not exists sponsors (
  id bigserial primary key,
  name text not null,
  logo_url text,
  tone text not null default 'dark' check (tone in ('dark', 'light')),
  sort int not null default 0
);

-- Foto della collezione
create table if not exists collection_photos (
  id bigserial primary key,
  src text not null,
  sort int not null default 0
);

-- Sicurezza: tutti possono leggere, solo gli amministratori loggati possono modificare
alter table players enable row level security;
alter table matches enable row level security;
alter table match_players enable row level security;
alter table match_events enable row level security;
alter table gallery enable row level security;
alter table sponsors enable row level security;
alter table collection_photos enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array['players', 'matches', 'match_players', 'match_events', 'gallery', 'sponsors', 'collection_photos']
  loop
    execute format('drop policy if exists "lettura pubblica" on %I', t);
    execute format('create policy "lettura pubblica" on %I for select using (true)', t);
    execute format('drop policy if exists "scrittura admin" on %I', t);
    execute format('create policy "scrittura admin" on %I for all to authenticated using (true) with check (true)', t);
  end loop;
end $$;

-- Foto e video: bucket pubblico in lettura, modificabile solo dagli amministratori
insert into storage.buckets (id, name, public)
values ('media', 'media', true)
on conflict (id) do nothing;

drop policy if exists "media lettura" on storage.objects;
create policy "media lettura" on storage.objects for select using (bucket_id = 'media');
drop policy if exists "media scrittura admin" on storage.objects;
create policy "media scrittura admin" on storage.objects for all to authenticated
  using (bucket_id = 'media') with check (bucket_id = 'media');
