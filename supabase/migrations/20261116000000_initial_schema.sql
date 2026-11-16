-- GLOBIS initial schema: shelters, animals, status history, source snapshots.
--
-- Data rules (P0):
--   * Never invent animal facts. Every descriptive column is nullable; unknown stays NULL.
--   * Disappearing from a source is NOT adoption. The pipeline records it as
--     'no_longer_listed'. Only 'confirmed_adopted' means adopted, and it needs evidence.
--   * A failed or partial scrape run is never published, so it can never replace the
--     last valid published snapshot. The app reads only published snapshots.
--
-- Writes happen only through the service role (bypasses RLS). Anonymous and
-- signed-in users can only read published data. No login is required to read.
--
-- Rollback: this is the first migration. To undo on a non-production database:
--   drop view public.published_animals; drop function public.publish_source_run(bigint);
--   drop table public.animal_status_history, public.snapshot_animals, public.animals,
--     public.source_runs, public.shelters; drop type public.animal_status;

create type public.animal_status as enum (
  'available',
  'reserved',          -- hidden from default discovery by the app
  'unknown',
  'no_longer_listed',  -- gone from the source; does not prove adoption
  'confirmed_adopted'
);

create table public.shelters (
  id          text primary key,
  source      text not null,
  source_url  text,
  name        text not null,
  city        text,
  address     text,
  phone       text,
  email       text,
  website     text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- One row per scrape/import run of one source.
create table public.source_runs (
  id            bigint generated always as identity primary key,
  source        text not null,
  state         text not null default 'running'
                check (state in ('running', 'failed', 'partial', 'complete')),
  started_at    timestamptz not null default now(),
  finished_at   timestamptz,
  animal_count  integer check (animal_count >= 0),
  error         text,
  published     boolean not null default false,
  published_at  timestamptz,
  -- Fail-closed: only a complete run can be published.
  constraint published_only_when_complete
    check (not published or (state = 'complete' and published_at is not null))
);

create index source_runs_published_idx
  on public.source_runs (source, published_at desc) where published;

-- Stable identity of an animal listing (e.g. 'globok:<slug>').
create table public.animals (
  id             text primary key,
  source         text not null,
  source_url     text not null unique,
  shelter_id     text references public.shelters (id),
  first_seen_at  timestamptz not null default now()
);

create index animals_shelter_idx on public.animals (shelter_id);

-- Facts about an animal as seen in one run. Nullable = unknown. Never fill with guesses.
create table public.snapshot_animals (
  run_id           bigint not null references public.source_runs (id) on delete cascade,
  animal_id        text not null references public.animals (id),
  shelter_id       text references public.shelters (id),
  name             text,
  species          text check (species in ('dog', 'cat', 'other')),
  sex              text check (sex in ('male', 'female')),
  age_text         text,
  size             text check (size in ('small', 'medium', 'large')),
  photos           text[] not null default '{}',
  chipped          boolean,
  vaccinated       boolean,
  neutered         boolean,
  bio_lt           text,
  bio_en           text,
  status           public.animal_status not null default 'unknown',
  status_evidence  text,
  primary key (run_id, animal_id),
  -- A listing seen in a run cannot be 'no_longer_listed' in that same run.
  constraint snapshot_status_listed check (status <> 'no_longer_listed'),
  constraint snapshot_status_evidence
    check (status not in ('reserved', 'confirmed_adopted') or status_evidence is not null)
);

create index snapshot_animals_animal_idx on public.snapshot_animals (animal_id);
create index snapshot_animals_shelter_idx on public.snapshot_animals (shelter_id);

-- Append-only log of status observations.
create table public.animal_status_history (
  id             bigint generated always as identity primary key,
  animal_id      text not null references public.animals (id),
  status         public.animal_status not null,
  evidence       text,
  source_run_id  bigint references public.source_runs (id),
  observed_at    timestamptz not null default now(),
  constraint history_status_evidence
    check (status not in ('reserved', 'confirmed_adopted') or evidence is not null)
);

create index animal_status_history_animal_idx
  on public.animal_status_history (animal_id, observed_at desc);
create index animal_status_history_run_idx
  on public.animal_status_history (source_run_id);

-- Publish a complete run. Refuses runs that are not complete, empty, or that lost
-- more than 5% of the last published snapshot (same guard as validateImport in the app).
create function public.publish_source_run(p_run_id bigint)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_run public.source_runs;
  v_rows integer;
  v_prev_run bigint;
  v_prev_rows integer;
  v_kept integer;
begin
  select * into v_run from public.source_runs where id = p_run_id for update;
  if not found then
    raise exception 'source run % not found', p_run_id;
  end if;
  if v_run.state <> 'complete' then
    raise exception 'run % is %, only complete runs can be published', p_run_id, v_run.state;
  end if;

  select count(*) into v_rows from public.snapshot_animals where run_id = p_run_id;
  if v_rows = 0 then
    raise exception 'run % has no animals; previous snapshot preserved', p_run_id;
  end if;

  select id into v_prev_run from public.source_runs
    where source = v_run.source and published and id <> p_run_id
    order by published_at desc, id desc limit 1;

  if v_prev_run is not null then
    select count(*) into v_prev_rows from public.snapshot_animals where run_id = v_prev_run;
    select count(*) into v_kept from public.snapshot_animals p
      where p.run_id = v_prev_run
        and exists (select 1 from public.snapshot_animals n
                    where n.run_id = p_run_id and n.animal_id = p.animal_id);
    if v_rows < v_prev_rows * 0.95 or v_kept < v_prev_rows * 0.95 then
      raise exception 'run % looks incomplete (% rows, % of % previous kept); previous snapshot preserved',
        p_run_id, v_rows, v_kept, v_prev_rows;
    end if;
  end if;

  update public.source_runs
    set published = true, published_at = now(), animal_count = v_rows
    where id = p_run_id;
end;
$$;

-- Supabase grants EXECUTE on new public functions to anon/authenticated by default,
-- so revoke from them by name as well as from PUBLIC.
revoke all on function public.publish_source_run(bigint) from public, anon, authenticated;

-- What the app reads: the latest published snapshot per source.
create view public.published_animals
with (security_invoker = true)
as
select s.*, r.source, r.published_at
from public.snapshot_animals s
join public.source_runs r on r.id = s.run_id
where r.id in (
  select distinct on (source) id from public.source_runs
  where published
  order by source, published_at desc, id desc
);

-- Row level security: public read of published data, no writes for clients.
alter table public.shelters              enable row level security;
alter table public.source_runs           enable row level security;
alter table public.animals               enable row level security;
alter table public.snapshot_animals      enable row level security;
alter table public.animal_status_history enable row level security;

create policy "public read shelters" on public.shelters
  for select to anon, authenticated using (true);

create policy "public read published runs" on public.source_runs
  for select to anon, authenticated using (published);

create policy "public read animals" on public.animals
  for select to anon, authenticated using (true);

create policy "public read published snapshots" on public.snapshot_animals
  for select to anon, authenticated
  using (exists (select 1 from public.source_runs r where r.id = run_id and r.published));

-- History from failed or unpublished runs stays private; manual entries (no run) are public.
create policy "public read status history" on public.animal_status_history
  for select to anon, authenticated
  using (source_run_id is null
         or exists (select 1 from public.source_runs r where r.id = source_run_id and r.published));

revoke insert, update, delete, truncate on
  public.shelters, public.source_runs, public.animals,
  public.snapshot_animals, public.animal_status_history
  from anon, authenticated;
grant select on
  public.shelters, public.source_runs, public.animals,
  public.snapshot_animals, public.animal_status_history, public.published_animals
  to anon, authenticated;
