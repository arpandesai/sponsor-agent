import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Pool } from '@neondatabase/serverless';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Schema migrations must use the direct (non-pooled) connection.
const connectionString = process.env.POSTGRES_URL_NON_POOLING || process.env.DATABASE_URL_UNPOOLED;
if (!connectionString) {
  console.error('POSTGRES_URL_NON_POOLING (or DATABASE_URL_UNPOOLED) is not set');
  process.exit(1);
}

const pool = new Pool({ connectionString });

const { rows } = await pool.query(`
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_name = 'clubs'
  ) AS exists
`);

if (rows[0].exists) {
  console.log('Schema already applied (clubs table exists) — skipping.');
  await pool.end();
  process.exit(0);
}

const schemaSql = fs.readFileSync(path.join(__dirname, '../db/schema.sql'), 'utf8');
await pool.query(schemaSql);

console.log('Schema applied successfully.');
await pool.end();
