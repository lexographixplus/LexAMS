import { Auth } from '@auth/core';
import type { Config } from '@netlify/functions';
import { getAuthConfig } from './_shared/auth';

export default async (request: Request) => Auth(request, getAuthConfig());

export const config: Config = {
  path: '/api/auth/*',
};
