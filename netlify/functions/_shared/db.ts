import { Pool } from '@neondatabase/serverless';

let pool: Pool | undefined;

function env(name: string) {
  try {
    const value = typeof Netlify !== 'undefined' ? Netlify.env.get(name) : undefined;
    if (value) return value;
  } catch {
    // Fall back to the Node environment below.
  }
  return process.env[name];
}

export function getPool() {
  const connectionString = env('DATABASE_URL');
  if (!connectionString) throw new Error('DATABASE_URL is not configured');

  if (!pool) {
    pool = new Pool({ connectionString });
  }

  return pool;
}
