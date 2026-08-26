import type { Config, Context } from '@netlify/functions';
import { getPool } from './_shared/db';
import { requireUser } from './_shared/session';
import { isPreviewDeployment, previewReadOnlyResponse } from './_shared/preview';

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
}

export default async (request: Request, context: Context) => {
  const token = context.params.token;
  if (!token) return json({ error: 'Missing invitation token' }, 400);
  if (request.method === 'POST' && isPreviewDeployment(request)) return previewReadOnlyResponse();
  const db = getPool();

  const inviteResult = await db.query(
    `select ti.id, ti.organization_id, ti.email, ti.role, ti.status, ti.invited_by,
            o.name as organization_name,
            coalesce(p.full_name, u.name, u.email) as invited_by_name
     from team_invites ti
     join organizations o on o.id = ti.organization_id
     join users u on u.id = ti.invited_by
     left join profiles p on p.user_id = u.id
     where ti.token = $1`,
    [token]
  );
  if (!inviteResult.rowCount) return json({ error: 'Invalid or expired invitation' }, 404);
  const invite = inviteResult.rows[0];

  if (request.method === 'GET') {
    return json({
      invite: {
        email: invite.email,
        role: invite.role,
        status: invite.status,
        organization_name: invite.organization_name,
        invited_by_name: invite.invited_by_name,
      },
    });
  }

  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  if (invite.status !== 'pending') return json({ error: `This invitation has already been ${invite.status}.` }, 409);

  const user = await requireUser(request);
  if (!user) return json({ error: 'Sign in before accepting this invitation' }, 401);
  if (String(user.email || '').toLowerCase() !== String(invite.email).toLowerCase()) {
    return json({ error: `This invitation was sent to ${invite.email}. Please sign in with that email address.` }, 403);
  }

  const roleMap: Record<string, string> = {
    member: 'viewer',
    viewer: 'viewer',
    facilitator: 'facilitator',
    programme_manager: 'programme_manager',
    me_officer: 'me_officer',
    admin: 'admin',
  };
  const role = roleMap[invite.role] || 'viewer';
  const client = await db.connect();

  try {
    await client.query('begin');

    const lockedInvite = await client.query(
      'select status from team_invites where id = $1 and organization_id = $2 for update',
      [invite.id, invite.organization_id]
    );
    if (!lockedInvite.rowCount || lockedInvite.rows[0].status !== 'pending') {
      await client.query('rollback');
      return json({ error: 'This invitation is no longer pending.' }, 409);
    }

    await client.query(
      `insert into organization_members (organization_id, user_id, role)
       values ($1,$2,$3)
       on conflict (organization_id,user_id) do update set role = excluded.role`,
      [invite.organization_id, user.id, role]
    );
    await client.query(
      `insert into profiles (user_id, full_name, active_organization_id)
       values ($1,$2,$3)
       on conflict (user_id) do update set active_organization_id = excluded.active_organization_id, updated_at = now()`,
      [user.id, user.name || user.email, invite.organization_id]
    );
    await client.query('update team_invites set status = $1 where id = $2', ['accepted', invite.id]);
    await client.query(
      `insert into audit_log (organization_id,user_id,action,entity_type,entity_id,metadata)
       values ($1,$2,'team.invite.accepted','organization_member',$3,$4)`,
      [invite.organization_id, user.id, String(user.id), { role }]
    );
    await client.query('commit');
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }

  return json({ ok: true, organization: { id: invite.organization_id, name: invite.organization_name }, role });
};

export const config: Config = {
  path: '/api/invite/:token',
  method: ['GET', 'POST'],
};
