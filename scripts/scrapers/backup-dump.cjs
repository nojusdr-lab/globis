'use strict';
// The public and account dumps share one exported snapshot. Writers can continue.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const execute = promisify(execFile);
const { postgresConfig } = require('./lib/postgres-config.cjs');

async function dumpSnapshot(db, connectionString, outDir) {
  fs.mkdirSync(outDir, { recursive: true, mode: 0o700 });
  await db.query('begin isolation level repeatable read read only');
  try {
    const { rows } = await db.query('select pg_export_snapshot() as snapshot');
    const common = [connectionString, '--snapshot=' + rows[0].snapshot, '--no-owner'];
    await execute('pg_dump', [...common, '--schema=public',
      '--file=' + path.join(outDir, 'public.sql')], { maxBuffer: 1024 * 1024 });
    // Supabase supplies auth's schema in the restore target. Identities are
    // required to restore the link between a user and their sign-in provider.
    await execute('pg_dump', [...common, '--data-only', '--table=auth.users', '--table=auth.identities',
      '--file=' + path.join(outDir, 'auth-users.sql')], { maxBuffer: 1024 * 1024 });
    await db.query('commit');
  } catch (error) {
    await db.query('rollback');
    throw error;
  }
}

async function main() {
  const outDir = process.argv[2];
  if (!outDir) throw new Error('Usage: node scripts/scrapers/backup-dump.cjs <output-directory>');
  const config = postgresConfig();
  if (!config.ssl.ca) throw new Error('Set SUPABASE_DB_CA_CERT for verified backup connections');
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'globis-backup-tls-'));
  const { Client } = require('pg');
  const db = new Client(config);
  try {
    const caFile = path.join(temporary, 'root.crt');
    fs.writeFileSync(caFile, config.ssl.ca, { mode: 0o600 });
    const dumpUrl = new URL(config.connectionString);
    dumpUrl.searchParams.set('sslmode', 'verify-full');
    dumpUrl.searchParams.set('sslrootcert', caFile);
    const original = new URL(process.env.SUPABASE_DB_URL);
    for (const key of ['sslcert', 'sslkey']) {
      if (original.searchParams.has(key)) dumpUrl.searchParams.set(key, original.searchParams.get(key));
    }
    await db.connect();
    await dumpSnapshot(db, dumpUrl.toString(), outDir);
  } finally {
    try { await db.end(); }
    finally { fs.rmSync(temporary, { recursive: true, force: true }); }
  }
}

if (require.main === module) {
  main().catch(() => {
    // execFile errors include argv, which contains the connection URI.
    console.error('Database backup dump failed. Check CA, database access and pg_dump compatibility.');
    process.exitCode = 1;
  });
}
module.exports = { dumpSnapshot };
