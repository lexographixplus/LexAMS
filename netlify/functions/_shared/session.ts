import { Auth } from '@auth/core';
import { getAuthConfig } from './auth';

export async function getSession(request: Request) {
  const originalUrl = new URL(request.url);
  const sessionUrl = new URL('/api/auth/session', originalUrl.origin);
  const sessionRequest = new Request(sessionUrl, {
    method: 'GET',
    headers: request.headers,
  });

  const response = await Auth(sessionRequest, getAuthConfig());
  if (!response.ok) return null;

  const session = await response.json();
  return session?.user ? session : null;
}

export async function requireUser(request: Request) {
  const session = await getSession(request);
  const userId = session?.user?.id;
  if (!userId) return null;
  return { id: userId, email: session.user.email, name: session.user.name };
}
