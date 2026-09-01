import type { Config } from '@netlify/functions';
import { getPool } from './_shared/db';
import { isPreviewDeployment, previewReadOnlyResponse } from './_shared/preview';

export default async (request: Request) => {
  if (isPreviewDeployment(request)) return previewReadOnlyResponse();
  const result = await getPool().query(
    `delete from public_rate_limits
     where expires_at < now()
     returning scope`
  );
  return Response.json({ deleted: result.rowCount || 0 });
};

export const config: Config = { schedule: '17 3 * * *' };
