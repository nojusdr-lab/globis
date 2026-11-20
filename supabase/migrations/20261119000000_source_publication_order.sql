-- Serialize publication for one source, preserve observation order, and make
-- repeat publication of the same run id a no-op. Existing shrink checks remain.
-- No stored rows are rewritten. Apply after the earlier migrations.
-- Rollback: a new forward migration may restore the function definition from
-- 20261117000000; that also restores its old race/replay behavior.

create or replace function public.publish_source_run(p_run_id bigint)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_run public.source_runs;
  v_rows integer;
  v_prev_run bigint;
  v_prev_started_at timestamptz;
  v_prev_rows integer;
  v_kept integer;
  v_lost integer;
  v_limit integer;
  v_same integer := 0;
  v_other record;
begin
  -- A repeatable-read snapshot can predate the advisory-lock wait. All callers
  -- use read committed so the head is read afresh after taking the source lock.
  if pg_catalog.current_setting('transaction_isolation') <> 'read committed' then
    raise exception 'publish_source_run requires read committed isolation';
  end if;
  select * into v_run from public.source_runs where id = p_run_id;
  if not found then
    raise exception 'source run % not found', p_run_id;
  end if;

  -- One publication per source at a time, including callers of this function
  -- outside the scraper loader. The transaction releases the lock.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('globis:publish:' || v_run.source, 0));
  select * into v_run from public.source_runs where id = p_run_id for update;
  if not found then
    raise exception 'source run % not found', p_run_id;
  end if;
  if v_run.published then
    return;
  end if;
  if v_run.state <> 'complete' then
    raise exception 'run % is %, only complete runs can be published', p_run_id, v_run.state;
  end if;

  select count(*) into v_rows from public.snapshot_animals where run_id = p_run_id;
  if v_rows = 0 then
    raise exception 'run % has no animals; previous snapshot preserved', p_run_id;
  end if;

  select id, started_at into v_prev_run, v_prev_started_at from public.source_runs
    where source = v_run.source and published and id <> p_run_id
    order by published_at desc, id desc limit 1;

  if v_prev_run is not null then
    if (v_run.started_at, v_run.id) <= (v_prev_started_at, v_prev_run) then
      raise exception 'run % is older than the latest published observation %; previous snapshot preserved',
        p_run_id, v_prev_run;
    end if;
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
          and (r.started_at, r.id) > (v_prev_started_at, v_prev_run)
          and (r.started_at, r.id) < (v_run.started_at, v_run.id)
        order by r.started_at desc, r.id desc limit 2
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
    -- now() is the transaction start, which may precede a lock wait.
    set published = true, published_at = clock_timestamp(), animal_count = v_rows
    where id = p_run_id;
end;
$$;

revoke all on function public.publish_source_run(bigint) from public, anon, authenticated;
