import type { Config, Context } from '@netlify/functions';
import { getPool } from './_shared/db';
import { requireTenant } from './_shared/tenant';
import { isPreviewDeployment, previewReadOnlyResponse } from './_shared/preview';

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
    },
  });
}

function num(value: unknown) {
  const n = Number(value);
  return Number.isSafeInteger(n) ? n : null;
}

function cleanTime(value: unknown) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const match = raw.match(/^(\d{2}):(\d{2})(?::\d{2})?$/);
  if (!match) throw new Error('Check-in times must use HH:MM format.');
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) throw new Error('Enter a valid check-in time.');
  return `${match[1]}:${match[2]}`;
}

async function getActivity(db: ReturnType<typeof getPool>, organizationId: string, activityId: number) {
  const result = await db.query(
    `select id, organization_id, title, type, venue, start_date, end_date, att_token,
            daily_checkin_enabled, daily_checkin_window_start, daily_checkin_window_end,
            daily_checkin_timezone
     from activities
     where id=$1 and organization_id=$2
     limit 1`,
    [activityId, organizationId]
  );
  return result.rows[0] || null;
}

export default async (request: Request, context: Context) => {
  if (request.method === 'POST' && isPreviewDeployment(request)) return previewReadOnlyResponse();
  const tenant = await requireTenant(request);
  if (!tenant) return json({ error: 'Unauthorized.' }, 401);

  const activityId = num(context.params.activityId);
  if (!activityId) return json({ error: 'Invalid activity.' }, 400);

  const db = getPool();
  const orgId = tenant.organization_id;
  const canMutate = ['owner', 'admin', 'programme_manager', 'facilitator', 'me_officer'].includes(tenant.role);

  if (request.method === 'GET') {
    const activity = await getActivity(db, orgId, activityId);
    return activity ? json({ activity }) : json({ error: 'Activity not found.' }, 404);
  }

  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
  if (!canMutate) return json({ error: 'Read-only role.' }, 403);

  const activity = await getActivity(db, orgId, activityId);
  if (!activity) return json({ error: 'Activity not found.' }, 404);

  const body = await request.json().catch(() => ({})) as any;
  const action = String(body.action || 'update');
  if (action !== 'update') return json({ error: 'Unsupported check-in settings operation.' }, 400);

  try {
    const start = cleanTime(body.settings?.daily_checkin_window_start);
    const end = cleanTime(body.settings?.daily_checkin_window_end);
    if (start && end && end <= start) {
      return json({ error: 'The daily check-in closing time must be after the opening time.' }, 400);
    }

    const timezone = String(body.settings?.daily_checkin_timezone || 'UTC').trim().slice(0, 80) || 'UTC';
    try {
      await db.query('select now() at time zone $1 as local_now', [timezone]);
    } catch {
      return json({ error: 'Enter a valid IANA timezone, for example Africa/Banjul or Europe/Amsterdam.' }, 400);
    }

    const updated = await db.query(
      `update activities set
         daily_checkin_enabled=$3,
         daily_checkin_window_start=$4,
         daily_checkin_window_end=$5,
         daily_checkin_timezone=$6,
         updated_at=now()
       where id=$1 and organization_id=$2
       returning id, organization_id, title, type, venue, start_date, end_date, att_token,
                 daily_checkin_enabled, daily_checkin_window_start, daily_checkin_window_end,
                 daily_checkin_timezone`,
      [
        activityId,
        orgId,
        body.settings?.daily_checkin_enabled !== false,
        start,
        end,
        timezone,
      ]
    );
    return json({ activity: updated.rows[0] });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Could not update check-in settings.' }, 400);
  }
};

export const config: Config = {
  path: '/api/activity-checkin-settings/:activityId',
  method: ['GET', 'POST'],
};
