import type { Config } from '@netlify/functions';
import { getPool } from './_shared/db';
import { getAuthConfig } from './_shared/auth';

function readEnv(name: string) {
  try {
    return Netlify.env.get(name) || process.env[name] || '';
  } catch {
    return process.env[name] || '';
  }
}

export default async () => {
  const checks = {
    AUTH_SECRET: Boolean(readEnv('AUTH_SECRET')),
    DATABASE_URL: Boolean(readEnv('DATABASE_URL')),
    RESEND_API_KEY: Boolean(readEnv('RESEND_API_KEY')),
    AUTH_EMAIL_FROM: Boolean(readEnv('AUTH_EMAIL_FROM')),
    APP_URL: Boolean(readEnv('APP_URL')),
  };

  let authConfig = false;
  let database = false;
  let authConfigError: string | null = null;
  let databaseError: string | null = null;

  try {
    getAuthConfig();
    authConfig = true;
  } catch (error: any) {
    authConfigError = error?.message || 'Auth configuration failed';
  }

  try {
    const pool = getPool();
    await pool.query('select 1');
    database = true;
  } catch (error: any) {
    databaseError = error?.message || 'Database connectivity failed';
  }

  return Response.json({
    ok: authConfig && database && checks.AUTH_SECRET && checks.DATABASE_URL && checks.RESEND_API_KEY,
    checks,
    authConfig,
    database,
    authConfigError,
    databaseError,
  }, {
    headers: { 'cache-control': 'no-store' },
  });
};

export const config: Config = { path: '/api/auth-health' };
