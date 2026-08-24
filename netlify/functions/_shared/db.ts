import { Pool } from '@neondatabase/serverless';

let pool: Pool | undefined;

export function getPool() {
  const connectionString = Netlify.env.get('DATABASE_URL');
  if (!connectionString) throw new Error('DATABASE_URL is not configured');

  if (!pool) {
    pool = new Pool({ connectionString });
  }

  return pool;
}
