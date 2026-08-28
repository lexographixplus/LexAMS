import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { Pool } from '@neondatabase/serverless';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const migrationsDirectory = path.join(root, 'db', 'migrations');

async function migrationFiles() {
  const names = (await readdir(migrationsDirectory)).filter(name => /^\d{3}_[a-z0-9_]+\.sql$/.test(name)).sort();
  if (!names.length) throw new Error('No database migrations were found.');
  names.forEach((name, index) => {
    const expected = String(index + 1).padStart(3, '0');
    if (!name.startsWith(`${expected}_`)) throw new Error(`Migration sequence is incomplete at ${name}; expected ${expected}_*.sql.`);
  });
  return Promise.all(names.map(async name => {
    const sql = await readFile(path.join(migrationsDirectory, name), 'utf8');
    return { name, sql, checksum: createHash('sha256').update(sql).digest('hex') };
  }));
}

const migrations = await migrationFiles();
if (process.argv.includes('--check')) {
  console.log(`Validated ${migrations.length} ordered migrations (${migrations[0].name} through ${migrations.at(-1).name}).`);
  process.exit(0);
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL is required to apply migrations.');

const pool = new Pool({ connectionString, max: 1 });
try {
  await pool.query(`create table if not exists lexams_schema_migrations (
    filename text primary key,
    checksum text not null,
    applied_at timestamptz not null default now()
  )`);
  const appliedResult = await pool.query('select filename,checksum from lexams_schema_migrations order by filename');
  const applied = new Map(appliedResult.rows.map(row => [row.filename, row.checksum]));

  // The production database predates the migration ledger. If its foundation
  // exists, record historical migrations as a baseline and apply only new ones.
  if (!applied.size) {
    const existing = await pool.query(`select to_regclass('public.organizations') as organizations`);
    if (existing.rows[0]?.organizations) {
      for (const migration of migrations.slice(0, -1)) {
        await pool.query('insert into lexams_schema_migrations (filename,checksum) values ($1,$2) on conflict do nothing', [migration.name, migration.checksum]);
        applied.set(migration.name, migration.checksum);
      }
      console.log(`Baselined ${Math.max(0, migrations.length - 1)} historical migrations.`);
    }
  }

  for (const migration of migrations) {
    if (applied.has(migration.name)) {
      if (applied.get(migration.name) !== migration.checksum) throw new Error(`Applied migration ${migration.name} has changed. Add a new migration instead of editing history.`);
      continue;
    }
    const client = await pool.connect();
    try {
      await client.query('begin');
      await client.query(migration.sql);
      await client.query('insert into lexams_schema_migrations (filename,checksum) values ($1,$2)', [migration.name, migration.checksum]);
      await client.query('commit');
      console.log(`Applied ${migration.name}.`);
    } catch (error) {
      await client.query('rollback').catch(() => undefined);
      throw error;
    } finally { client.release(); }
  }
  console.log('Database schema is current.');
} finally { await pool.end(); }
