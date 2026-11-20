'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { Client } = require('pg');
const { postgresConfig } = require('../lib/postgres-config.cjs');

test('database clients verify the certificate and hostname even if URL options disable TLS', () => {
  for (const suffix of ['', '?sslmode=disable', '?sslmode=no-verify&uselibpqcompat=true', '?ssl=false']) {
    const config = postgresConfig({ SUPABASE_DB_URL: 'postgres://user:password@db.invalid/globis' + suffix });
    const actual = new Client(config).connectionParameters;
    assert.equal(actual.ssl.rejectUnauthorized, true);
    assert.equal(actual.ssl.checkServerIdentity, undefined, 'use Node hostname verification');
    assert.equal(actual.host, 'db.invalid');
    assert.equal(actual.database, 'globis');
  }
});

test('the server CA and non-SSL connection options survive driver parsing', () => {
  const config = postgresConfig({
    SUPABASE_DB_URL: 'postgres://user:p%40ss@db.invalid:6543/globis?sslmode=require&application_name=globis',
    SUPABASE_DB_CA_CERT: 'FIXTURE_CA',
  });
  const actual = new Client(config).connectionParameters;
  assert.equal(actual.ssl.ca, 'FIXTURE_CA');
  assert.equal(actual.ssl.rejectUnauthorized, true);
  assert.equal(actual.password, 'p@ss');
  assert.equal(actual.application_name, 'globis');
  assert.equal(actual.port, 6543);
});
