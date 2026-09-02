import type { Config, Context } from '@netlify/functions';
import { getPool } from './_shared/db';
import { getPlanAccess, PlanLimitError, requirePro } from './_shared/billing';
import { requireTenant } from './_shared/tenant';
import { isPreviewDeployment, previewReadOnlyResponse } from './_shared/preview';
import {
  BUDGET_CURRENCIES,
  canEditJournalEntry,
  canUpdatePlanningTask,
  normalizeBudgetItem,
  normalizeFacilitator,
  normalizeJournalEntry,
  normalizePlanningTask,
  normalizeSessionImportRow,
  normalizeSessionPlan,
  planningPermissions,
  SESSION_PLANNING_STATUSES,
  sessionImportIdentity,
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
    `select id, title, status, start_date, end_date, venue, description, budget_currency
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
  commercial: any,
) {
  const activity = await activityExists(db, organizationId, activityId);
  if (!activity) return null;

  const [tasks, sessions, members, facilitators, budgetItems, journalEntries] = await Promise.all([
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
              s.facilitator_id, f.name as facilitator_name, f.role as facilitator_role,
              f.email as facilitator_email, s.sort_order, s.updated_at,
              case when f.id is null then '[]'::jsonb else jsonb_build_array(jsonb_build_object(
                'id', f.id, 'user_id', linked_user.id, 'name', f.name, 'email', f.email,
                'is_lead', true, 'role_label', f.role
              )) end as facilitators
       from activity_sessions s
       left join facilitators f on f.id=s.facilitator_id and f.organization_id=s.organization_id
       left join users linked_user on lower(btrim(linked_user.email))=lower(btrim(f.email))
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
    db.query(
      `select id,name,role,email,created_at,updated_at
       from facilitators where organization_id=$1
       order by lower(name),id`,
      [organizationId],
    ),
    db.query(
      `select id,category,item_name,planned_amount,actual_amount,evidence_date,notes,evidence_url,
              created_by,created_at,updated_at
       from activity_budget_items
       where organization_id=$1 and activity_id=$2
       order by category,item_name,id`,
      [organizationId, activityId],
    ),
    db.query(
      `select j.id,j.entry_mode,j.entry_date,j.period_end,j.progress_summary,j.achievements,
              j.challenges,j.observations_lessons,j.actions_follow_up,j.follow_up_status,
              j.evidence_url,j.include_in_report,j.created_by,j.created_at,j.updated_at,
              coalesce(nullif(p.full_name,''),nullif(u.name,''),u.email,'Former team member') as author_name,
              coalesce(ls.sessions,'[]'::jsonb) as linked_sessions,
              coalesce(lt.tasks,'[]'::jsonb) as linked_tasks
       from activity_journal_entries j
       left join users u on u.id=j.created_by
       left join profiles p on p.user_id=j.created_by
       left join lateral (
         select jsonb_agg(jsonb_build_object('id',s.id,'title',s.title,'session_date',s.session_date)
                          order by s.session_date,s.sort_order,s.id) as sessions
         from journal_entry_sessions js
         join activity_sessions s on s.id=js.session_id and s.activity_id=js.activity_id and s.organization_id=js.organization_id
         where js.organization_id=j.organization_id and js.activity_id=j.activity_id and js.journal_entry_id=j.id
       ) ls on true
       left join lateral (
         select jsonb_agg(jsonb_build_object('id',t.id,'title',t.title,'status',t.status)
                          order by t.sort_order,t.id) as tasks
         from journal_entry_tasks jt
         join activity_tasks t on t.id=jt.task_id and t.activity_id=jt.activity_id and t.organization_id=jt.organization_id
         where jt.organization_id=j.organization_id and jt.activity_id=j.activity_id and jt.journal_entry_id=j.id
       ) lt on true
       where j.organization_id=$1 and j.activity_id=$2
       order by j.entry_date desc,j.id desc`,
      [organizationId, activityId],
    ),
  ]);

  return {
    activity,
    tasks: tasks.rows,
    sessions: sessions.rows,
    members: members.rows,
    facilitators: facilitators.rows,
    budgetItems: budgetItems.rows,
    journalEntries: journalEntries.rows,
    permissions: { ...planningPermissions(role), currentUserId: userId, role },
    commercial,
  };
}

async function validateJournalLinks(
  db: any,
  organizationId: string,
  activityId: number,
  sessionIds: number[],
  taskIds: number[],
) {
  const [sessionCount, taskCount] = await Promise.all([
    sessionIds.length
      ? db.query(
        `select count(*)::int as count from activity_sessions
         where organization_id=$1 and activity_id=$2 and id=any($3::bigint[])`,
        [organizationId, activityId, sessionIds],
      )
      : Promise.resolve({ rows: [{ count: 0 }] }),
    taskIds.length
      ? db.query(
        `select count(*)::int as count from activity_tasks
         where organization_id=$1 and activity_id=$2 and id=any($3::bigint[])`,
        [organizationId, activityId, taskIds],
      )
      : Promise.resolve({ rows: [{ count: 0 }] }),
  ]);
  if (Number(sessionCount.rows[0]?.count || 0) !== sessionIds.length) throw new Error('One or more linked sessions are invalid.');
  if (Number(taskCount.rows[0]?.count || 0) !== taskIds.length) throw new Error('One or more linked tasks are invalid.');
}

async function syncJournalLinks(
  db: any,
  organizationId: string,
  activityId: number,
  journalEntryId: number,
  sessionIds: number[],
  taskIds: number[],
) {
  await db.query(`delete from journal_entry_sessions where organization_id=$1 and activity_id=$2 and journal_entry_id=$3`, [organizationId, activityId, journalEntryId]);
  await db.query(`delete from journal_entry_tasks where organization_id=$1 and activity_id=$2 and journal_entry_id=$3`, [organizationId, activityId, journalEntryId]);
  if (sessionIds.length) {
    await db.query(
      `insert into journal_entry_sessions (organization_id,activity_id,journal_entry_id,session_id)
       select $1,$2,$3,unnest($4::bigint[])`,
      [organizationId, activityId, journalEntryId, sessionIds],
    );
  }
  if (taskIds.length) {
    await db.query(
      `insert into journal_entry_tasks (organization_id,activity_id,journal_entry_id,task_id)
       select $1,$2,$3,unnest($4::bigint[])`,
      [organizationId, activityId, journalEntryId, taskIds],
    );
  }
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
  const planAccess = await getPlanAccess(db, organizationId);
  const commercial = {
    plan: planAccess.subscription.plan,
    status: planAccess.subscription.status,
    entitlements: planAccess.entitlements,
  };

  if (request.method === 'GET') {
    const data = await snapshot(db, organizationId, activityId, tenant.role, userId, commercial);
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

    if (action === 'save_facilitator') {
      if (!permissions.canManagePlanning) return json({ error: 'Planning manager permission is required.' }, 403);
      const facilitatorId = body.facilitator?.id ? numberId(body.facilitator.id) : null;
      if (body.facilitator?.id && !facilitatorId) return json({ error: 'Invalid facilitator.' }, 400);
      const facilitator = normalizeFacilitator(body.facilitator);
      const duplicate = await db.query(
        `select id from facilitators
         where organization_id=$1 and lower(btrim(email))=lower(btrim($2))
           and ($3::bigint is null or id<>$3)
         limit 1`,
        [organizationId, facilitator.email, facilitatorId],
      );
      if (duplicate.rowCount) return json({ error: 'A facilitator with this email already exists.' }, 409);
      const result = facilitatorId
        ? await db.query(
          `update facilitators set name=$3,role=$4,email=$5,updated_at=now()
           where id=$1 and organization_id=$2 returning *`,
          [facilitatorId, organizationId, facilitator.name, facilitator.role, facilitator.email],
        )
        : await db.query(
          `insert into facilitators (organization_id,name,role,email,created_by)
           values ($1,$2,$3,$4,$5) returning *`,
          [organizationId, facilitator.name, facilitator.role, facilitator.email, userId],
        );
      if (!result.rowCount) return json({ error: 'Facilitator not found.' }, 404);
      await audit(db, organizationId, userId,
        facilitatorId ? 'planning.facilitator_updated' : 'planning.facilitator_created',
        'facilitator', result.rows[0].id, { name: facilitator.name, role: facilitator.role });
      return json({ facilitator: result.rows[0] }, facilitatorId ? 200 : 201);
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

      if (session.facilitator_id) {
        const validFacilitator = await db.query(
          `select 1 from facilitators where organization_id=$1 and id=$2 limit 1`,
          [organizationId, session.facilitator_id],
        );
        if (!validFacilitator.rowCount) return json({ error: 'Choose a facilitator from this workspace.' }, 400);
      }

      const client = await db.connect();
      try {
        await client.query('begin');
        let saved;
        if (sessionId) {
          const result = await client.query(
            `update activity_sessions set title=$4,session_date=$5,starts_at=$6,ends_at=$7,venue=$8,
                 description=$9,learning_objectives=$10,planning_status=$11,facilitator_id=$12,updated_at=now()
             where id=$1 and activity_id=$2 and organization_id=$3 returning *`,
            [sessionId, activityId, organizationId, session.title, session.session_date, session.starts_at,
              session.ends_at, session.venue, session.description, session.learning_objectives, session.planning_status,
              session.facilitator_id],
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
               (organization_id,activity_id,title,session_date,starts_at,ends_at,venue,description,learning_objectives,planning_status,facilitator_id,sort_order)
             values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,
                     coalesce((select max(sort_order)+1 from activity_sessions where organization_id=$1 and activity_id=$2),0))
             returning *`,
            [organizationId, activityId, session.title, session.session_date, session.starts_at,
              session.ends_at, session.venue, session.description, session.learning_objectives, session.planning_status,
              session.facilitator_id],
          );
          saved = result.rows[0];
        }

        await client.query(
          `update activities set sessions=(select count(*)::int from activity_sessions where organization_id=$1 and activity_id=$2),updated_at=now()
           where organization_id=$1 and id=$2`,
          [organizationId, activityId],
        );
        await audit(client as ReturnType<typeof getPool>, organizationId, userId,
          sessionId ? 'planning.session_updated' : 'planning.session_created', 'activity_session', saved.id,
          { activityId, facilitatorId: session.facilitator_id, planningStatus: session.planning_status });
        await client.query('commit');
        return json({ session: saved }, sessionId ? 200 : 201);
      } catch (error) {
        await client.query('rollback').catch(() => undefined);
        throw error;
      } finally {
        client.release();
      }
    }

    if (action === 'import_sessions') {
      if (!permissions.canManagePlanning) return json({ error: 'Planning manager permission is required.' }, 403);
      requirePro('Session and facilitator CSV import', planAccess.entitlements.sessionCsvImport);
      const sourceRows = Array.isArray(body.rows) ? body.rows : [];
      if (!sourceRows.length || sourceRows.length > 200) return json({ error: 'Import between 1 and 200 sessions at a time.' }, 400);
      const duplicateMode = body.duplicateMode === 'update' ? 'update' : 'skip';
      const activityStart = String(activity.start_date).slice(0, 10);
      const activityEnd = String(activity.end_date).slice(0, 10);
      let rows;
      try {
        rows = sourceRows.map((row, index) => ({
          ...normalizeSessionImportRow(row, { minDate: activityStart, maxDate: activityEnd }),
          rowNumber: index + 2,
        }));
      } catch (error) {
        return json({ error: error instanceof Error ? error.message : 'The session CSV contains invalid data.' }, 400);
      }
      const seenSessions = new Set<string>();
      const uniqueRows = [];
      let duplicateRowsSkipped = 0;
      for (const row of rows) {
        const date = row.session_date;
        if (date < activityStart || date > activityEnd) {
          return json({ error: `Row ${row.rowNumber}: session date ${date} must fall within the activity period (${activityStart} to ${activityEnd}).` }, 400);
        }
        const key = sessionImportIdentity(row);
        if (seenSessions.has(key)) {
          duplicateRowsSkipped += 1;
          continue;
        }
        seenSessions.add(key);
        uniqueRows.push(row);
      }
      rows = uniqueRows;

      const facilitatorsResult = await db.query(
        `select id,name,role,lower(btrim(email)) as email
         from facilitators where organization_id=$1`,
        [organizationId],
      );
      const facilitatorByEmail = new Map(facilitatorsResult.rows.map(facilitator => [String(facilitator.email), facilitator]));
      const missingName = rows.find(row => row.facilitator_email && !facilitatorByEmail.has(row.facilitator_email) && !row.facilitator_name);
      if (missingName) return json({ error: `Row ${missingName.rowNumber}: facilitator name is required for a new facilitator email.` }, 400);

      const existingResult = await db.query(
        `select * from activity_sessions where organization_id=$1 and activity_id=$2 order by sort_order,id`,
        [organizationId, activityId],
      );
      const existingBySession = new Map(existingResult.rows.map(session => [sessionImportIdentity(session), session]));
      let nextSortOrder = existingResult.rows.reduce((maximum, session) => Math.max(maximum, Number(session.sort_order || 0)), -1) + 1;
      const summary = {
        created: 0,
        updated: 0,
        skipped: duplicateRowsSkipped,
        facilitatorsAssigned: 0,
        facilitatorsCreated: 0,
      };
      const client = await db.connect();
      try {
        await client.query('begin');
        for (const row of rows) {
          const key = sessionImportIdentity(row);
          const existing = existingBySession.get(key);
          if (existing && duplicateMode === 'skip') { summary.skipped += 1; continue; }
          let facilitatorId = null;
          if (row.facilitator_email) {
            let facilitator = facilitatorByEmail.get(row.facilitator_email);
            if (!facilitator) {
              const created = await client.query(
                `insert into facilitators (organization_id,name,role,email,created_by)
                 values ($1,$2,'Facilitator',$3,$4) returning id,name,role,email`,
                [organizationId, row.facilitator_name, row.facilitator_email, userId],
              );
              facilitator = created.rows[0];
              facilitatorByEmail.set(row.facilitator_email, facilitator);
              summary.facilitatorsCreated += 1;
            }
            facilitatorId = Number(facilitator.id);
            summary.facilitatorsAssigned += 1;
          }
          let saved;
          if (existing) {
            const result = await client.query(
              `update activity_sessions set session_date=$4,starts_at=$5,ends_at=$6,venue=$7,
                   planning_status=$8,facilitator_id=$9,updated_at=now()
               where id=$1 and activity_id=$2 and organization_id=$3 returning *`,
              [existing.id, activityId, organizationId, row.session_date, row.starts_at, row.ends_at,
                row.venue, row.planning_status, facilitatorId],
            );
            saved = result.rows[0];
            summary.updated += 1;
          } else {
            const result = await client.query(
              `insert into activity_sessions
                 (organization_id,activity_id,title,session_date,starts_at,ends_at,venue,description,learning_objectives,planning_status,facilitator_id,sort_order)
               values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) returning *`,
              [organizationId, activityId, row.title, row.session_date, row.starts_at, row.ends_at,
                row.venue, row.description, row.learning_objectives, row.planning_status, facilitatorId, nextSortOrder],
            );
            saved = result.rows[0];
            existingBySession.set(key, saved);
            nextSortOrder += 1;
            summary.created += 1;
          }

        }
        await client.query(
          `update activities set sessions=(select count(*)::int from activity_sessions where organization_id=$1 and activity_id=$2),updated_at=now()
           where organization_id=$1 and id=$2`,
          [organizationId, activityId],
        );
        await audit(client as ReturnType<typeof getPool>, organizationId, userId, 'planning.sessions_imported', 'activity', activityId, { ...summary, rows: rows.length });
        await client.query('commit');
        return json(summary, 201);
      } catch (error) {
        await client.query('rollback').catch(() => undefined);
        throw error;
      } finally {
        client.release();
      }
    }

    if (action === 'set_budget_currency') {
      if (!permissions.canManageBudget) return json({ error: 'Budget manager permission is required.' }, 403);
      const currency = String(body.currency || '').trim().toUpperCase();
      if (!BUDGET_CURRENCIES.includes(currency)) return json({ error: 'Choose a supported budget currency.' }, 400);
      await db.query(
        `update activities set budget_currency=$3,updated_at=now() where id=$1 and organization_id=$2`,
        [activityId, organizationId, currency],
      );
      await audit(db, organizationId, userId, 'planning.budget_currency_updated', 'activity', activityId, { currency });
      return json({ currency });
    }

    if (action === 'save_budget_item') {
      if (!permissions.canManageBudget) return json({ error: 'Budget manager permission is required.' }, 403);
      const itemId = body.item?.id ? numberId(body.item.id) : null;
      if (body.item?.id && !itemId) return json({ error: 'Invalid budget item.' }, 400);
      const item = normalizeBudgetItem(body.item);
      const result = itemId
        ? await db.query(
          `update activity_budget_items set category=$4,item_name=$5,planned_amount=$6,actual_amount=$7,
               evidence_date=$8,notes=$9,evidence_url=$10,updated_at=now()
           where id=$1 and activity_id=$2 and organization_id=$3 returning *`,
          [itemId, activityId, organizationId, item.category, item.item_name, item.planned_amount,
            item.actual_amount, item.evidence_date, item.notes, item.evidence_url],
        )
        : await db.query(
          `insert into activity_budget_items
             (organization_id,activity_id,category,item_name,planned_amount,actual_amount,evidence_date,notes,evidence_url,created_by)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) returning *`,
          [organizationId, activityId, item.category, item.item_name, item.planned_amount,
            item.actual_amount, item.evidence_date, item.notes, item.evidence_url, userId],
        );
      if (!result.rowCount) return json({ error: 'Budget item not found.' }, 404);
      await audit(db, organizationId, userId, itemId ? 'planning.budget_item_updated' : 'planning.budget_item_created', 'activity_budget_item', result.rows[0].id, { activityId });
      return json({ item: result.rows[0] }, itemId ? 200 : 201);
    }

    if (action === 'delete_budget_item') {
      if (!permissions.canManageBudget) return json({ error: 'Budget manager permission is required.' }, 403);
      const itemId = numberId(body.itemId);
      if (!itemId) return json({ error: 'Invalid budget item.' }, 400);
      const result = await db.query(
        `delete from activity_budget_items where id=$1 and activity_id=$2 and organization_id=$3 returning id,item_name`,
        [itemId, activityId, organizationId],
      );
      if (!result.rowCount) return json({ error: 'Budget item not found.' }, 404);
      await audit(db, organizationId, userId, 'planning.budget_item_deleted', 'activity_budget_item', itemId, { activityId, itemName: result.rows[0].item_name });
      return json({ removed: itemId });
    }

    if (action === 'save_journal_entry') {
      if (!permissions.canCreateJournal) return json({ error: 'Journal contributor permission is required.' }, 403);
      const entryId = body.entry?.id ? numberId(body.entry.id) : null;
      if (body.entry?.id && !entryId) return json({ error: 'Invalid journal entry.' }, 400);
      const entry = normalizeJournalEntry(body.entry);
      const activityStart = String(activity.start_date).slice(0, 10);
      const activityEnd = String(activity.end_date).slice(0, 10);
      if (entry.entry_date < activityStart || entry.entry_date > activityEnd || (entry.period_end && entry.period_end > activityEnd)) {
        return json({ error: 'Journal periods must fall within the activity dates.' }, 400);
      }
      let current = null;
      if (entryId) {
        const currentResult = await db.query(
          `select * from activity_journal_entries where id=$1 and activity_id=$2 and organization_id=$3 limit 1`,
          [entryId, activityId, organizationId],
        );
        current = currentResult.rows[0] || null;
        if (!current) return json({ error: 'Journal entry not found.' }, 404);
        if (!canEditJournalEntry({ role: tenant.role, userId, entry: current })) return json({ error: 'You can only edit journal entries you created.' }, 403);
      }

      const client = await db.connect();
      try {
        await client.query('begin');
        await validateJournalLinks(client, organizationId, activityId, entry.session_ids, entry.task_ids);
        const result = entryId
          ? await client.query(
            `update activity_journal_entries set entry_mode=$4,entry_date=$5,period_end=$6,
                 progress_summary=$7,achievements=$8,challenges=$9,observations_lessons=$10,
                 actions_follow_up=$11,follow_up_status=$12,evidence_url=$13,include_in_report=$14,updated_at=now()
             where id=$1 and activity_id=$2 and organization_id=$3 returning *`,
            [entryId, activityId, organizationId, entry.entry_mode, entry.entry_date, entry.period_end,
              entry.progress_summary, entry.achievements, entry.challenges, entry.observations_lessons,
              entry.actions_follow_up, entry.follow_up_status, entry.evidence_url, entry.include_in_report],
          )
          : await client.query(
            `insert into activity_journal_entries
               (organization_id,activity_id,entry_mode,entry_date,period_end,progress_summary,achievements,
                challenges,observations_lessons,actions_follow_up,follow_up_status,evidence_url,include_in_report,created_by)
             values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) returning *`,
            [organizationId, activityId, entry.entry_mode, entry.entry_date, entry.period_end,
              entry.progress_summary, entry.achievements, entry.challenges, entry.observations_lessons,
              entry.actions_follow_up, entry.follow_up_status, entry.evidence_url, entry.include_in_report, userId],
          );
        const saved = result.rows[0];
        await syncJournalLinks(client, organizationId, activityId, saved.id, entry.session_ids, entry.task_ids);
        await audit(client as ReturnType<typeof getPool>, organizationId, userId,
          entryId ? 'planning.journal_entry_updated' : 'planning.journal_entry_created', 'activity_journal_entry', saved.id,
          { activityId, entryMode: entry.entry_mode, includeInReport: entry.include_in_report });
        await client.query('commit');
        return json({ entry: saved }, entryId ? 200 : 201);
      } catch (error) {
        await client.query('rollback').catch(() => undefined);
        throw error;
      } finally {
        client.release();
      }
    }

    if (action === 'delete_journal_entry') {
      const entryId = numberId(body.entryId);
      if (!entryId) return json({ error: 'Invalid journal entry.' }, 400);
      const currentResult = await db.query(
        `select * from activity_journal_entries where id=$1 and activity_id=$2 and organization_id=$3 limit 1`,
        [entryId, activityId, organizationId],
      );
      const current = currentResult.rows[0];
      if (!current) return json({ error: 'Journal entry not found.' }, 404);
      if (!canEditJournalEntry({ role: tenant.role, userId, entry: current })) return json({ error: 'You can only delete journal entries you created.' }, 403);
      await db.query(
        `delete from activity_journal_entries where id=$1 and activity_id=$2 and organization_id=$3`,
        [entryId, activityId, organizationId],
      );
      await audit(db, organizationId, userId, 'planning.journal_entry_deleted', 'activity_journal_entry', entryId, { activityId });
      return json({ removed: entryId });
    }

    if (action === 'set_session_planning_status') {
      const sessionId = numberId(body.sessionId);
      const status = String(body.status || '');
      if (!sessionId || !SESSION_PLANNING_STATUSES.includes(status)) return json({ error: 'Invalid session status.' }, 400);
      let allowed = permissions.canManagePlanning;
      if (!allowed && ['facilitator', 'me_officer'].includes(tenant.role)) {
        const assignment = await db.query(
          `select 1
           from activity_sessions s
           join facilitators f on f.id=s.facilitator_id and f.organization_id=s.organization_id
           join users u on u.id=$4 and lower(btrim(u.email))=lower(btrim(f.email))
           where s.organization_id=$1 and s.activity_id=$2 and s.id=$3 limit 1`,
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
    if (error instanceof PlanLimitError) return json(error.toResponse(), error.code === 'PRO_REQUIRED' ? 403 : 409);
    return json({ error: error instanceof Error ? error.message : 'Could not complete the planning action.' }, 400);
  }
};

export const config: Config = {
  path: '/api/activity-planning/:activityId',
  method: ['GET', 'POST'],
};
