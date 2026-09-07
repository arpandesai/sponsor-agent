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

// Each migration is independently guarded — applied only if guardTable
// doesn't exist yet — so a later migration can be added without re-running
// or touching earlier ones.
const MIGRATIONS = [
  { file: '001_schema.sql', guardTable: 'clubs' },
  { file: '002_api_call_logs.sql', guardTable: 'api_call_logs' },
];

for (const { file, guardTable } of MIGRATIONS) {
  const { rows } = await pool.query(
    `SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = $1) AS exists`,
    [guardTable]
  );

  if (rows[0].exists) {
    console.log(`${file}: already applied (${guardTable} exists) — skipping.`);
    continue;
  }

  const sql = fs.readFileSync(path.join(__dirname, '..', 'db', file), 'utf8');
  await pool.query(sql);
  console.log(`${file}: applied successfully.`);
}

await pool.end();
