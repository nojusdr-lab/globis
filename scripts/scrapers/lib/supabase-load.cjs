'use strict';
// Writes one scraper run into the Supabase schema (supabase/migrations) and asks the
// database to publish it. `db` is anything with query(sql, params) -> { rows }
// (node-postgres client, PGlite). The database guard has the final word: if
// publish_source_run refuses, the last good snapshot stays and we report why.
// Nothing here needs or stores secrets; the caller supplies the connection.

async function loadRun(db, adapter, run) {
  await db.query('begin');
  let runId;
  try {
    await db.query(
      `insert into public.shelters (id, source, source_url, name, website)
       values ($1, $1, $2, $3, $2)
       on conflict (id) do update set name = excluded.name, website = excluded.website, updated_at = now()`,
      [adapter.id, adapter.website, adapter.name]);
    const r = await db.query(
      `insert into public.source_runs (source, state, started_at, finished_at, animal_count, error)
       values ($1, $2, $3, $4, $5, $6) returning id`,
      [adapter.id, run.state, run.startedAt, run.finishedAt, run.animals.length, run.errors.join('\n').slice(0, 4000) || null]);
    runId = r.rows[0].id;
    for (const a of run.animals) {
      await db.query(
        `insert into public.animals (id, source, source_url, shelter_id) values ($1, $2, $3, $4)
         on conflict (id) do nothing`, [a.id, a.source, a.sourceUrl, adapter.id]);
      await db.query(
        `insert into public.snapshot_animals
           (run_id, animal_id, shelter_id, name, species, sex, age_text, size, photos,
            chipped, vaccinated, neutered, bio_lt, status, status_evidence, shelter_hint)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
        [runId, a.id, adapter.id, a.name, a.species, a.sex, a.age_text, a.size, a.photos,
          a.chipped, a.vaccinated, a.neutered, a.bio_lt, a.status, a.statusEvidence, a.shelterHint ?? null]);
    }
    await db.query('commit');
  } catch (e) {
    await db.query('rollback');
    throw e;
  }
  if (run.state !== 'complete') return { runId, published: false, reason: `run is ${run.state}` };

  try {
    await db.query('begin');
    // The daily run and a one-source run can load the same source at once (different CI
    // concurrency groups). Lock per source so "previous snapshot" is read after the other commits.
    await db.query('select pg_advisory_xact_lock(hashtext($1))', ['publish:' + adapter.id]);
    const prev = await db.query(
      `select id from public.source_runs where source = $1 and published order by published_at desc, id desc limit 1`, [adapter.id]);
    await db.query('select public.publish_source_run($1)', [runId]);
    // Status log: new or changed statuses, and animals that disappeared (not proof of adoption).
    await db.query(
      `insert into public.animal_status_history (animal_id, status, evidence, source_run_id)
       select n.animal_id, n.status, n.status_evidence, $1 from public.snapshot_animals n
       where n.run_id = $1 and not exists (
         select 1 from public.snapshot_animals p where p.run_id = $2 and p.animal_id = n.animal_id and p.status = n.status)`,
      [runId, prev.rows[0]?.id ?? null]);
    if (prev.rows[0]) {
      await db.query(
        `insert into public.animal_status_history (animal_id, status, evidence, source_run_id)
         select p.animal_id, 'no_longer_listed', null, $1 from public.snapshot_animals p
         where p.run_id = $2 and not exists (
           select 1 from public.snapshot_animals n where n.run_id = $1 and n.animal_id = p.animal_id)`,
        [runId, prev.rows[0].id]);
    }
    await db.query('commit');
    return { runId, published: true, reason: null };
  } catch (e) {
    await db.query('rollback');
    return { runId, published: false, reason: e.message };
  }
}

module.exports = { loadRun };
