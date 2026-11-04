-- Arrow F.C. · dirigenza e allenatori
-- Da incollare in Supabase → SQL Editor → New query → Run

create table if not exists staff (
  id bigserial primary key,
  name text not null,
  role text not null,
  description text,
  photo_url text,
  sort int not null default 0,
  active boolean not null default true
);

alter table staff enable row level security;

drop policy if exists "lettura pubblica" on staff;
create policy "lettura pubblica" on staff for select using (true);

drop policy if exists "scrittura admin" on staff;
create policy "scrittura admin" on staff for all to authenticated using (true) with check (true);
