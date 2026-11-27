'use strict';
const fs = require('node:fs');

// node-postgres replaces config.ssl if SSL options occur in the connection URL.
// Read its file options first, then supply one explicit, verified TLS config.
function postgresConfig(env = process.env) {
  const url = new URL(env.SUPABASE_DB_URL);
  if (!['postgres:', 'postgresql:'].includes(url.protocol)) throw new Error('Expected a PostgreSQL URL');
  const ssl = { rejectUnauthorized: true };
  for (const [parameter, option] of [['sslrootcert', 'ca'], ['sslcert', 'cert'], ['sslkey', 'key']]) {
    const file = url.searchParams.get(parameter);
    if (file) ssl[option] = fs.readFileSync(file, 'utf8');
  }
  if (env.SUPABASE_DB_CA_CERT) ssl.ca = env.SUPABASE_DB_CA_CERT;
  for (const key of [...url.searchParams.keys()]) {
    if (key.toLowerCase().startsWith('ssl') || key.toLowerCase() === 'uselibpqcompat') {
      url.searchParams.delete(key);
    }
  }
  return { connectionString: url.toString(), ssl, connectionTimeoutMillis: 15000 };
}

module.exports = { postgresConfig };
