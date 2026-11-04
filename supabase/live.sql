-- Arrow F.C. · partita in diretta
-- Da incollare in Supabase → SQL Editor → New query → Run
alter table matches add column if not exists is_live boolean not null default false;
