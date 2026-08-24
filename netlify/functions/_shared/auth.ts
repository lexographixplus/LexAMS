import type { AuthConfig } from '@auth/core';
import NeonAdapter from '@auth/neon-adapter';
import Resend from '@auth/core/providers/resend';
import { getPool } from './db';

function env(name: string) {
  try {
    const value = typeof Netlify !== 'undefined' ? Netlify.env.get(name) : undefined;
    if (value) return value;
  } catch {
    // Fall back to the Node environment below.
  }
  return process.env[name];
}

function normalizeEmail(value: unknown) {
  return String(value || '').trim().toLowerCase();
}

export function getAuthConfig(): AuthConfig {
  const secret = env('AUTH_SECRET');
  const resendApiKey = env('RESEND_API_KEY');
  const from = env('AUTH_EMAIL_FROM') || 'LexAMS <onboarding@resend.dev>';
  const db = getPool();

  if (!secret) throw new Error('AUTH_SECRET is not configured');
  if (!resendApiKey) throw new Error('RESEND_API_KEY is not configured');

  return {
    adapter: NeonAdapter(db),
    secret,
    trustHost: true,
    basePath: '/api/auth',
    session: { strategy: 'database' },
    providers: [
      Resend({
        apiKey: resendApiKey,
        from,
      }),
    ],
    callbacks: {
      async signIn({ user }) {
        const email = normalizeEmail(user?.email);
        if (!email) return false;

        const member = await db.query(
          `select 1
           from users u
           join organization_members om on om.user_id = u.id
           where lower(u.email) = $1
           limit 1`,
          [email]
        );
        if (member.rowCount) return true;

        const invite = await db.query(
          `select 1
           from team_invites
           where lower(email) = $1 and status = 'pending'
           limit 1`,
          [email]
        );
        if (invite.rowCount) return true;

        const signupIntent = await db.query(
          `select 1
           from verification_token
           where identifier = $1
             and token like 'intent:%'
             and expires > now()
           limit 1`,
          [`lexams-signup:${email}`]
        );

        return Boolean(signupIntent.rowCount);
      },
      session({ session, user }) {
        if (session.user && user?.id) session.user.id = user.id;
        return session;
      },
    },
    pages: {
      signIn: '/login',
      verifyRequest: '/login?sent=1',
      error: '/login',
    },
  };
}
