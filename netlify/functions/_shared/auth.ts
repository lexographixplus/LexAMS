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

export function getAuthConfig(): AuthConfig {
  const secret = env('AUTH_SECRET');
  const resendApiKey = env('RESEND_API_KEY');
  const from = env('AUTH_EMAIL_FROM') || 'LexAMS <onboarding@resend.dev>';

  if (!secret) throw new Error('AUTH_SECRET is not configured');
  if (!resendApiKey) throw new Error('RESEND_API_KEY is not configured');

  return {
    adapter: NeonAdapter(getPool()),
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
