import { createHash } from 'node:crypto';
import { getPool } from './db';

type PublicRateLimitOptions = {
  scope: string;
  limit: number;
  windowSeconds: number;
};

function clientAddress(request: Request) {
  const netlifyIp = request.headers.get('x-nf-client-connection-ip');
  if (netlifyIp) return netlifyIp.trim();

  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0]?.trim() || 'unknown';

  return 'unknown';
}

function clientKey(request: Request, scope: string) {
  return createHash('sha256')
    .update(`${scope}:${clientAddress(request)}`)
    .digest('hex');
}

export async function consumePublicRateLimit(request: Request, options: PublicRateLimitOptions) {
  const scope = options.scope.trim().slice(0, 100);
  const limit = Math.max(1, Math.floor(options.limit));
  const windowSeconds = Math.max(1, Math.floor(options.windowSeconds));
  const key = clientKey(request, scope);
  const db = getPool();

  const result = await db.query(
    `with bucket as (
       select to_timestamp(
         floor(extract(epoch from now()) / $3::numeric) * $3::numeric
       ) as window_start
     )
     insert into public_rate_limits (scope, client_key, window_start, request_count, expires_at)
     select $1, $2, bucket.window_start, 1,
            bucket.window_start + (($3::text || ' seconds')::interval * 2)
     from bucket
     on conflict (scope, client_key, window_start) do update
       set request_count = public_rate_limits.request_count + 1,
           expires_at = excluded.expires_at
     returning request_count`,
    [scope, key, windowSeconds]
  );

  const count = Number(result.rows[0]?.request_count || 1);
  return {
    allowed: count <= limit,
    count,
    limit,
    retryAfterSeconds: windowSeconds,
  };
}
