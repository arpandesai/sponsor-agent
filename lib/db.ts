import { neon } from '@neondatabase/serverless';

let cachedSql: ReturnType<typeof neon> | null = null;

// Lazily created so importing this module never throws when POSTGRES_URL is
// unset (e.g. in unit tests) — only calling a query does.
export function getSql(): ReturnType<typeof neon> {
  if (!cachedSql) {
    const connectionString = process.env.POSTGRES_URL;
    if (!connectionString) throw new Error('POSTGRES_URL is not set');
    cachedSql = neon(connectionString);
  }
  return cachedSql;
}
