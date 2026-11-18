'use strict';
// Supabase free plan usage for the CI summary: database size against the 500 MB limit, and row counts.
// Needs SUPABASE_DB_URL; without it prints nothing.
async function main() {
  if (!process.env.SUPABASE_DB_URL) return;
  const { Client } = require('pg');
  const db = new Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
  await db.connect();
  try {
    const { rows: [r] } = await db.query(`select pg_database_size(current_database()) as bytes,
      (select count(*) from public.published_animals) as published,
      (select count(*) from public.snapshot_animals) as snapshot_rows,
      (select count(*) from auth.users) as accounts`);
    const mb = Number(r.bytes) / 1048576;
    console.log(`### Duomenų bazė\nDydis ${mb.toFixed(1)} MB iš 500 MB (${Math.round(mb / 5)}%) · paskelbta ${r.published} · snapshot eilučių ${r.snapshot_rows} · paskyrų ${r.accounts}`);
    if (mb > 400) console.log(`⚠️ Database ${mb.toFixed(0)} MB of 500 MB`);
  } finally { await db.end(); }
}
main().catch(e => { console.log(`⚠️ usage check failed: ${e.message}`); });
