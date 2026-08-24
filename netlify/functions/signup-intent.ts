import type { Config } from '@netlify/functions';
import { randomUUID } from 'node:crypto';
import { getPool } from './_shared/db';

function normalizeEmail(value: unknown) {
  return String(value || '').trim().toLowerCase();
}

function validEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export default async (request: Request) => {
  if (request.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  const body = await request.json().catch(() => ({}));
  const email = normalizeEmail(body.email);
  if (!validEmail(email)) {
    return Response.json({ error: 'Enter a valid email address' }, { status: 400 });
  }

  const db = getPool();
  const identifier = `lexams-signup:${email}`;
  const token = `intent:${randomUUID()}`;

  await db.query('delete from verification_token where expires < now()');
  await db.query('delete from verification_token where identifier = $1', [identifier]);
  await db.query(
    `insert into verification_token (identifier, token, expires)
     values ($1, $2, now() + interval '20 minutes')`,
    [identifier, token]
  );

  return Response.json({ ok: true });
};

export const config: Config = { path: '/api/signup-intent' };
