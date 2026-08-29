import type { Config, Context } from '@netlify/functions';
import { getPool } from './_shared/db';
import { requireTenant } from './_shared/tenant';
import { isPreviewDeployment, previewReadOnlyResponse } from './_shared/preview';
import {
  canUpdatePlanningTask,
  normalizePlanningTask,
  normalizeSessionPlan,
  planningPermissions,
  SESSION_PLANNING_STATUSES,
} from '../../shared/planning.js';

function json(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
    },
  });
}

function numberId(value: unknown) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

async function activityExists(db: ReturnType<typeof getPool>, organizationId: string, activityId: number) {
  const result = await db.query(
    `select id, title, status, start_date, end_date, venue, description
     from activities where id=$1 and organization_id=$2 limit 1`,
    [activityId, organizationId],
  );
  return result.rows[0] || null;
}

async function memberExists(db: ReturnType<typeof getPool>, organizationId: string, userId: string | null) {
  if (!userId) return true;
  const result = await db.query(
    `select 1 from organization_members
     where organization_id=$1 and user_id=$2 and role <> 'viewer' limit 1`,
    [organizationId, userId],
  );
  return Boolean(result.rowCount);
}

async function audit(
  db: ReturnType<typeof getPool>,
  organizationId: string,
  userId: string,
  action: string,
  entityType: string,
  entityId: string | number,
  metadata: Record<string, unknown> = {},
) {
  await db.query(
    `insert into audit_log (organization_id,user_id,action,entity_type,entity_id,metadata)
     values ($1,$2,$3,$4,$5,$6::jsonb)`,
    [organizationId, userId, action, entityType, String(entityId), JSON.stringify(metadata)],
  );
}

async function snapshot(
  db: ReturnType<typeof getPool>,
  organizationId: string,
  activityId: number,
  role: string,
  userId: string,
) {
  const activity = await activityExists(db, organizationId, activityId);
  if (!activity) return null;

  const [tasks, sessions, members] = await Promise.all([
    db.query(
      `select t.id, t.title, t.description, t.stage, t.assignee_user_id, t.due_date,
              t.priority, t.status, t.completed_at, t.sort_order, t.created_at, t.updated_at,
              coalesce(nullif(p.full_name,''), nullif(u.name,''), u.email) as assignee_name
       from activity_tasks t
       left join users u on u.id=t.assignee_user_id
       left join profiles p on p.user_id=t.assignee_user_id
       where t.organization_id=$1 and t.activity_id=$2
       order by case t.stage when 'pre' then 1 when 'during' then 2 else 3 end,
                t.sort_order, t.due_date nulls last, t.id`,
      [organizationId, activityId],
    ),
    db.query(
      `select s.id, s.title, s.session_date, s.starts_at, s.ends_at, s.status,
              s.description, s.learning_objectives, s.venue, s.planning_status,
              s.sort_order, s.updated_at, coalesce(f.facilitators,'[]'::jsonb) as facilitators
       from activity_sessions s
       left join lateral (
         select jsonb_agg(jsonb_build_object(
           'user_id', sf.user_id,
           'name', coalesce(nullif(p.full_name,''), nullif(u.name,''), u.email),
           'email', u.email,
           'is_lead', sf.is_lead,
           'role_label', sf.role_label
         ) order by sf.is_lead desc, coalesce(p.full_name,u.name,u.email)) as facilitators
         from session_facilitators sf
         join users u on u.id=sf.user_id
         left join profiles p on p.user_id=sf.user_id
         where sf.organization_id=s.organization_id
           and sf.activity_id=s.activity_id
           and sf.session_id=s.id
       ) f on true
       where s.organization_id=$1 and s.activity_id=$2
       order by s.session_date, s.sort_order, s.id`,
      [organizationId, activityId],
    ),
    db.query(
      `select om.user_id as id, om.role, u.email,
              coalesce(nullif(p.full_name,''), nullif(u.name,''), u.email) as name
       from organization_members om
       join users u on u.id=om.user_id
       left join profiles p on p.user_id=om.user_id
       where om.organization_id=$1 and om.role <> 'viewer'
       order by coalesce(p.full_name,u.name,u.email), om.user_id`,
      [organizationId],
    ),
  ]);

  return {
    activity,
    tasks: tasks.rows,
    sessions: sessions.rows,
    members: members.rows,
    permissions: { ...planningPermissions(role), currentUserId: userId, role },
  };
}

export default async (request: Request, context: Context) => {
  if (request.method === 'POST' && isPreviewDeployment(request)) return previewReadOnlyResponse();
  const tenant = await requireTenant(request);
  if (!tenant) return json({ error: 'Unauthorized.' }, 401);
  const activityId = numberId(context.params.activityId);
  if (!activityId) return json({ error: 'Invalid activity.' }, 400);

  const db = getPool();
  const organizationId = tenant.organization_id;
  const userId = String(tenant.user.id);
  const permissions = planningPermissions(tenant.role);

  if (request.method === 'GET') {
    const data = await snapshot(db, organizationId, activityId, tenant.role, userId);
    return data ? json(data) : json({ error: 'Activity not found.' }, 404);
  }
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
  const activity = await activityExists(db, organizationId, activityId);
  if (!activity) return json({ error: 'Activity not found.' }, 404);

  const body = await request.json().catch(() => ({})) as any;
  const action = String(body.action || '');

  try {
    if (action === 'create_task') {
      if (!permissions.canManagePlanning) return json({ error: 'Planning manager permission is required.' }, 403);
      const task = normalizePlanningTask(body.task);
      if (!(await memberExists(db, organizationId, task.assignee_user_id))) return json({ error: 'Select a current team member as assignee.' }, 400);
      const result = await db.query(
        `insert into activity_tasks
           (organization_id,activity_id,title,description,stage,assignee_user_id,due_date,priority,status,completed_at,sort_order,created_by)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,case when $9='done' then now() else null end,
                 coalesce((select max(sort_order)+1 from activity_tasks where organization_id=$1 and activity_id=$2 and stage=$5),0),$10)
         returning *`,
        [organizationId, activityId, task.title, task.description, task.stage, task.assignee_user_id,
          task.due_date, task.priority, task.status, userId],
      );
      await audit(db, organizationId, userId, 'planning.task_created', 'activity_task', result.rows[0].id, { activityId });
      return json({ task: result.rows[0] }, 201);
    }

    if (action === 'update_task') {
      const taskId = numberId(body.taskId);
      if (!taskId) return json({ error: 'Invalid task.' }, 400);
      const currentResult = await db.query(
        `select * from activity_tasks where id=$1 and activity_id=$2 and organization_id=$3 limit 1`,
        [taskId, activityId, organizationId],
      );
      if (!currentResult.rowCount) return json({ error: 'Task not found.' }, 404);
      const current = currentResult.rows[0];
      if (!canUpdatePlanningTask({ role: tenant.role, userId, task: current, updates: body.updates })) {
        return json({ error: 'You can only update the status of a task assigned to you.' }, 403);
      }
      const task = normalizePlanningTask({ ...current, ...(body.updates || {}) });
      if (!(await memberExists(db, organizationId, task.assignee_user_id))) return json({ error: 'Select a current team member as assignee.' }, 400);
      const result = await db.query(
        `update activity_tasks set title=$4,description=$5,stage=$6,assignee_user_id=$7,due_date=$8,
             priority=$9,status=$10,
             completed_at=case when $10='done' then coalesce(completed_at,now()) else null end,
             updated_at=now()
         where id=$1 and activity_id=$2 and organization_id=$3 returning *`,
        [taskId, activityId, organizationId, task.title, task.description, task.stage, task.assignee_user_id,
          task.due_date, task.priority, task.status],
      );
      await audit(db, organizationId, userId, 'planning.task_updated', 'activity_task', taskId, { activityId, status: task.status });
      return json({ task: result.rows[0] });
    }

    if (action === 'delete_task') {
      if (!permissions.canManagePlanning) return json({ error: 'Planning manager permission is required.' }, 403);
      const taskId = numberId(body.taskId);
      if (!taskId) return json({ error: 'Invalid task.' }, 400);
      const result = await db.query(
        `delete from activity_tasks where id=$1 and activity_id=$2 and organization_id=$3 returning id,title`,
        [taskId, activityId, organizationId],
      );
      if (!result.rowCount) return json({ error: 'Task not found.' }, 404);
      await audit(db, organizationId, userId, 'planning.task_deleted', 'activity_task', taskId, { activityId, title: result.rows[0].title });
      return json({ removed: taskId });
    }

    if (action === 'save_session') {
      if (!permissions.canManagePlanning) return json({ error: 'Planning manager permission is required.' }, 403);
      const sessionId = body.session?.id ? numberId(body.session.id) : null;
      if (body.session?.id && !sessionId) return json({ error: 'Invalid session.' }, 400);
      const session = normalizeSessionPlan(body.session);
      const activityStart = String(activity.start_date).slice(0, 10);
      const activityEnd = String(activity.end_date).slice(0, 10);
      if (session.session_date < activityStart || session.session_date > activityEnd) {
        return json({ error: 'Session date must fall within the activity dates.' }, 400);
      }
      const duplicateTitle = await db.query(
        `select 1 from activity_sessions
         where organization_id=$1 and activity_id=$2 and lower(btrim(title))=lower(btrim($3))
           and ($4::bigint is null or id<>$4)
         limit 1`,
        [organizationId, activityId, session.title, sessionId],
      );
      if (duplicateTitle.rowCount) return json({ error: 'Session titles must be unique within an activity.' }, 409);

      if (session.facilitator_ids.length) {
        const validMembers = await db.query(
          `select user_id::text from organization_members
           where organization_id=$1 and user_id=any($2::uuid[]) and role <> 'viewer'`,
          [organizationId, session.facilitator_ids],
        );
        if (validMembers.rowCount !== session.facilitator_ids.length) return json({ error: 'One or more facilitators are not current team members.' }, 400);
      }

      const client = await db.connect();
      try {
        await client.query('begin');
        let saved;
        if (sessionId) {
          const result = await client.query(
            `update activity_sessions set title=$4,session_date=$5,starts_at=$6,ends_at=$7,venue=$8,
                 description=$9,learning_objectives=$10,planning_status=$11,updated_at=now()
             where id=$1 and activity_id=$2 and organization_id=$3 returning *`,
            [sessionId, activityId, organizationId, session.title, session.session_date, session.starts_at,
              session.ends_at, session.venue, session.description, session.learning_objectives, session.planning_status],
          );
          if (!result.rowCount) {
            await client.query('rollback');
            return json({ error: 'Session not found.' }, 404);
          }
          saved = result.rows[0];
          await client.query(
            `update attendance set session_label=$4
             where session_id=$1 and activity_id=$2 and organization_id=$3`,
            [sessionId, activityId, organizationId, session.title],
          );
        } else {
          const result = await client.query(
            `insert into activity_sessions
               (organization_id,activity_id,title,session_date,starts_at,ends_at,venue,description,learning_objectives,planning_status,sort_order)
             values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
                     coalesce((select max(sort_order)+1 from activity_sessions where organization_id=$1 and activity_id=$2),0))
             returning *`,
            [organizationId, activityId, session.title, session.session_date, session.starts_at,
              session.ends_at, session.venue, session.description, session.learning_objectives, session.planning_status],
          );
          saved = result.rows[0];
        }

        await client.query(`delete from session_facilitators where session_id=$1 and activity_id=$2 and organization_id=$3`, [saved.id, activityId, organizationId]);
        if (session.facilitator_ids.length) {
          await client.query(
            `insert into session_facilitators
               (organization_id,activity_id,session_id,user_id,is_lead,role_label,assigned_by)
             select $1,$2,$3,om.user_id,om.user_id=$5,
                    case when om.user_id=$5 then 'Lead facilitator' else 'Facilitator' end,$6
             from organization_members om
             where om.organization_id=$1 and om.user_id=any($4::uuid[]) and om.role <> 'viewer'`,
            [organizationId, activityId, saved.id, session.facilitator_ids, session.lead_facilitator_id, userId],
          );
        }
        await client.query(
          `update activities set sessions=(select count(*)::int from activity_sessions where organization_id=$1 and activity_id=$2),updated_at=now()
           where organization_id=$1 and id=$2`,
          [organizationId, activityId],
        );
        await audit(client as ReturnType<typeof getPool>, organizationId, userId,
          sessionId ? 'planning.session_updated' : 'planning.session_created', 'activity_session', saved.id,
          { activityId, facilitatorCount: session.facilitator_ids.length, planningStatus: session.planning_status });
        await client.query('commit');
        return json({ session: saved }, sessionId ? 200 : 201);
      } catch (error) {
        await client.query('rollback').catch(() => undefined);
        throw error;
      } finally {
        client.release();
      }
    }

    if (action === 'set_session_planning_status') {
      const sessionId = numberId(body.sessionId);
      const status = String(body.status || '');
      if (!sessionId || !SESSION_PLANNING_STATUSES.includes(status)) return json({ error: 'Invalid session status.' }, 400);
      let allowed = permissions.canManagePlanning;
      if (!allowed && ['facilitator', 'me_officer'].includes(tenant.role)) {
        const assignment = await db.query(
          `select 1 from session_facilitators
           where organization_id=$1 and activity_id=$2 and session_id=$3 and user_id=$4 limit 1`,
          [organizationId, activityId, sessionId, userId],
        );
        allowed = Boolean(assignment.rowCount);
      }
      if (!allowed) return json({ error: 'This session is not assigned to you.' }, 403);
      const result = await db.query(
        `update activity_sessions set planning_status=$4,updated_at=now()
         where id=$1 and activity_id=$2 and organization_id=$3 returning *`,
        [sessionId, activityId, organizationId, status],
      );
      if (!result.rowCount) return json({ error: 'Session not found.' }, 404);
      await audit(db, organizationId, userId, 'planning.session_status_updated', 'activity_session', sessionId, { activityId, status });
      return json({ session: result.rows[0] });
    }

    return json({ error: 'Unsupported planning action.' }, 400);
  } catch (error) {
    console.error('Activity planning failed', { action, activityId, error });
    return json({ error: error instanceof Error ? error.message : 'Could not complete the planning action.' }, 400);
  }
};

export const config: Config = {
  path: '/api/activity-planning/:activityId',
  method: ['GET', 'POST'],
};
