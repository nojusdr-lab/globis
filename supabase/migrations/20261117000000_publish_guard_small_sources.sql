-- Publish guard for small shelter sources.
--
-- The first guard refused any run that lost more than 5% of the last published
-- snapshot. For a shelter with 20 animals, two adoptions in one day is 10%, and the
-- run would be refused forever (every later run is compared with the same old
-- snapshot), so the app would keep showing adopted animals.
--
-- New rule (same as scripts/scrapers/lib/snapshot.cjs):
--   * lost animals <= greatest(3, 5% of previous)  -> publish;
--   * otherwise publish only if the two previous complete runs of this source,
--     made after the last published one, had exactly the same set of animals
--     (three identical complete runs in a row = a real change, not a broken scrape).
-- Failed, partial and empty runs are still refused, so the last good snapshot stays.
--
-- Rollback: re-run the publish_source_run definition from 20261116000000_initial_schema.sql.

create or replace function public.publish_source_run(p_run_id bigint)
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
  v_lost integer;
  v_limit integer;
  v_same integer := 0;
  v_other record;
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
    v_lost := v_prev_rows - v_kept;
    v_limit := greatest(3, floor(v_prev_rows * 0.05)::integer);
    if v_lost > v_limit then
      for v_other in
        select r.id from public.source_runs r
        where r.source = v_run.source and r.state = 'complete' and not r.published
          and r.id < p_run_id and r.id > v_prev_run
        order by r.id desc limit 2
      loop
        if not exists (
          (select animal_id from public.snapshot_animals where run_id = v_other.id
           except select animal_id from public.snapshot_animals where run_id = p_run_id)
          union all
          (select animal_id from public.snapshot_animals where run_id = p_run_id
           except select animal_id from public.snapshot_animals where run_id = v_other.id)
        ) then
          v_same := v_same + 1;
        end if;
      end loop;
      if v_same < 2 then
        raise exception 'run % looks incomplete (lost % of % previous, limit %); previous snapshot preserved',
          p_run_id, v_lost, v_prev_rows, v_limit;
      end if;
    end if;
  end if;

  update public.source_runs
    set published = true, published_at = now(), animal_count = v_rows
    where id = p_run_id;
end;
$$;

revoke all on function public.publish_source_run(bigint) from public, anon, authenticated;
