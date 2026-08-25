import type { Config } from '@netlify/functions';
import { Resend } from 'resend';
import { getPool } from './_shared/db';
import { assertCreationEntitlement, getBillingSnapshot, PlanLimitError, requireAllowance, requirePro } from './_shared/billing';
import { requireTenant } from './_shared/tenant';

const directTables: Record<string, Set<string>> = {
  activities: new Set(['id','organization_id','title','type','status','venue','organizer','facilitator','start_date','end_date','sessions','reg_open','reg_token','att_token','description','created_by','created_at','updated_at']),
  participants: new Set(['id','organization_id','name','email','phone','org','category','created_at','updated_at']),
  registrations: new Set(['id','organization_id','activity_id','participant_id','registered_at']),
  attendance: new Set(['id','organization_id','activity_id','participant_id','session_label','status','recorded_at']),
  surveys: new Set(['id','organization_id','activity_id','title','description','share_token','status','allow_anonymous','created_by','created_at','updated_at']),
  assessments: new Set(['id','organization_id','activity_id','title','description','assessment_type','share_token','time_limit_minutes','passing_score','status','created_by','created_at','updated_at']),
  certificates: new Set(['id','organization_id','cert_no','activity_id','participant_id','certificate_type','issued_date','issued_by','created_at']),
  team_invites: new Set(['id','organization_id','invited_by','email','role','status','token','created_at']),
  pending_approvals: new Set(['id','organization_id','requested_by','action_type','payload','status','reviewed_by','reviewed_at','created_at']),
};

const childTables: Record<string, { columns: Set<string>; parentTable: string; parentKey: string }> = {
  survey_questions: { columns: new Set(['id','survey_id','question_text','question_type','options','required','sort_order','created_at']), parentTable: 'surveys', parentKey: 'survey_id' },
  survey_responses: { columns: new Set(['id','survey_id','participant_id','respondent_name','respondent_email','answers','submitted_at']), parentTable: 'surveys', parentKey: 'survey_id' },
  assessment_questions: { columns: new Set(['id','assessment_id','question_text','question_type','options','correct_answer','points','sort_order','created_at']), parentTable: 'assessments', parentKey: 'assessment_id' },
  assessment_submissions: { columns: new Set(['id','assessment_id','participant_id','respondent_name','respondent_email','answers','score','total_points','percentage','passed','started_at','submitted_at']), parentTable: 'assessments', parentKey: 'assessment_id' },
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
}

function quoteIdent(value: string) { return `"${value.replace(/"/g, '""')}"`; }

function validateColumns(table: string, values: string[]) {
  const allowed = directTables[table] || childTables[table]?.columns;
  if (!allowed) throw new Error('Unsupported table');
  for (const value of values) if (!allowed.has(value)) throw new Error(`Unsupported column: ${value}`);
}

function normalizePayload(payload: any) { return Array.isArray(payload) ? payload : [payload]; }

async function ownedRecord(db: ReturnType<typeof getPool>, table: 'activities' | 'participants', id: unknown, organizationId: string) {
  if (id === undefined || id === null || id === '') return false;
  const result = await db.query(`select 1 from ${quoteIdent(table)} where id = $1 and organization_id = $2`, [id, organizationId]);
  return Boolean(result.rowCount);
}

async function parentOwned(db: ReturnType<typeof getPool>, table: string, payload: any, organizationId: string) {
  const child = childTables[table];
  if (!child) return true;
  const parentId = payload?.[child.parentKey];
  if (!parentId) return false;
  const result = await db.query(`select 1 from ${quoteIdent(child.parentTable)} where id = $1 and organization_id = $2`, [parentId, organizationId]);
  return Boolean(result.rowCount);
}

async function relationshipsOwned(db: ReturnType<typeof getPool>, table: string, payload: any, organizationId: string) {
  if (!payload || typeof payload !== 'object') return true;

  if (['registrations', 'attendance', 'certificates'].includes(table)) {
    if (payload.activity_id !== undefined && !(await ownedRecord(db, 'activities', payload.activity_id, organizationId))) return false;
    if (payload.participant_id !== undefined && !(await ownedRecord(db, 'participants', payload.participant_id, organizationId))) return false;
  }

  if (['surveys', 'assessments'].includes(table) && payload.activity_id != null) {
    if (!(await ownedRecord(db, 'activities', payload.activity_id, organizationId))) return false;
  }

  if (['survey_responses', 'assessment_submissions'].includes(table) && payload.participant_id != null) {
    if (!(await ownedRecord(db, 'participants', payload.participant_id, organizationId))) return false;
  }

  return true;
}

async function handleProfiles(request: Request, body: any, tenant: any, db: ReturnType<typeof getPool>) {
  const filters = Object.fromEntries((body.filters || []).map((f: any) => [f.column, f.value]));
  if (body.operation === 'select') {
    const values: any[] = [tenant.organization_id];
    let sql = `
      select u.id,
             coalesce(p.full_name, u.name, u.email) as full_name,
             o.name as org_name,
             case when om.role in ('owner','admin') then 'Institution Administrator'
                  when om.role = 'programme_manager' then 'Activity Manager'
                  else 'Facilitator' end as role,
             case when om.role in ('owner','admin') then 'admin' else 'member' end as team_role,
             om.organization_id as team_id,
             p.avatar_url,
             o.logo_url
      from organization_members om
      join users u on u.id = om.user_id
      join organizations o on o.id = om.organization_id
      left join profiles p on p.user_id = u.id
      where om.organization_id = $1`;
    if (filters.id) { values.push(filters.id); sql += ` and u.id = $${values.length}`; }
    sql += ' order by om.created_at asc';
    const result = await db.query(sql, values);
    return json({ data: body.single ? (result.rows[0] || null) : result.rows });
  }

  if (body.operation === 'update' && filters.id) {
    const targetUserId = String(filters.id);
    const updates = body.payload || {};

    if (updates.team_id === targetUserId && updates.team_role === 'admin' && targetUserId !== tenant.user.id) {
      if (!['owner','admin'].includes(tenant.role)) return json({ error: 'Admin permission required' }, 403);
      const membership = await db.query('select role from organization_members where organization_id = $1 and user_id = $2', [tenant.organization_id, targetUserId]);
      if (!membership.rowCount) return json({ error: 'Member not found' }, 404);
      if (membership.rows[0].role === 'owner') return json({ error: 'The workspace owner cannot be removed' }, 403);
      await db.query('delete from organization_members where organization_id = $1 and user_id = $2', [tenant.organization_id, targetUserId]);
      return json({ data: [] });
    }

    if (targetUserId !== tenant.user.id) return json({ error: 'You can only edit your own profile' }, 403);
    if (updates.full_name !== undefined) {
      await db.query('update users set name = $1 where id = $2', [updates.full_name, tenant.user.id]);
      await db.query(`insert into profiles (user_id, full_name, active_organization_id) values ($1,$2,$3)
        on conflict (user_id) do update set full_name = excluded.full_name, updated_at = now()`, [tenant.user.id, updates.full_name, tenant.organization_id]);
    }
    if (updates.org_name !== undefined) {
      if (!['owner','admin'].includes(tenant.role)) return json({ error: 'Admin permission required' }, 403);
      await db.query('update organizations set name = $1, updated_at = now() where id = $2', [updates.org_name, tenant.organization_id]);
    }
    if (updates.logo_url !== undefined) {
      if (!['owner','admin'].includes(tenant.role)) return json({ error: 'Admin permission required' }, 403);
      const billing = await getBillingSnapshot(db, tenant.organization_id);
      requirePro('custom organisation branding', billing.entitlements.customBranding);
      await db.query('update organizations set logo_url = $1, updated_at = now() where id = $2', [updates.logo_url, tenant.organization_id]);
    }
    return json({ data: [] });
  }
  return json({ error: 'Unsupported profile operation' }, 400);
}

async function sendTeamInvite(request: Request, tenant: any, invite: any) {
  const apiKey = Netlify.env.get('RESEND_API_KEY') || process.env.RESEND_API_KEY;
  if (!apiKey) return;
  const from = Netlify.env.get('AUTH_EMAIL_FROM') || process.env.AUTH_EMAIL_FROM || 'LexAMS <onboarding@resend.dev>';
  const appUrl = Netlify.env.get('APP_URL') || process.env.APP_URL || new URL(request.url).origin;
  const resend = new Resend(apiKey);
  const inviteUrl = `${appUrl}/join/${invite.token}`;
  await resend.emails.send({
    from,
    to: invite.email,
    subject: `You're invited to ${tenant.organization_name} on LexAMS`,
    html: `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#0F1B2B"><h2 style="color:#002B54">Join ${tenant.organization_name} on LexAMS</h2><p>You've been invited to collaborate in the ${tenant.organization_name} workspace.</p><p><a href="${inviteUrl}" style="display:inline-block;padding:12px 18px;background:#FAB72D;color:#002B54;text-decoration:none;border-radius:8px;font-weight:600">Accept invitation</a></p><p style="font-size:12px;color:#7A8699">If you weren't expecting this invitation, you can ignore this email.</p></div>`,
  });
}

export default async (request: Request) => {
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const tenant = await requireTenant(request);
  if (!tenant) return json({ error: 'Unauthorized' }, 401);

  const body = await request.json().catch(() => null) as any;
  if (!body?.table || !body?.operation) return json({ error: 'Invalid request' }, 400);
  const table = String(body.table);
  const db = getPool();

  if (table === 'profiles') return handleProfiles(request, body, tenant, db);

  const isDirect = Boolean(directTables[table]);
  const isChild = Boolean(childTables[table]);
  if (!isDirect && !isChild) return json({ error: 'Unsupported table' }, 400);

  const canMutate = ['owner', 'admin', 'programme_manager', 'facilitator', 'me_officer'].includes(tenant.role);
  if (body.operation !== 'select' && !canMutate) return json({ error: 'Read-only role' }, 403);
  if (body.operation !== 'select' && table === 'certificates' && !['owner', 'admin'].includes(tenant.role)) {
    return json({ error: 'Certificate changes require admin approval' }, 403);
  }

  const rawFilters = Array.isArray(body.filters) ? body.filters : [];
  const filters = rawFilters.map((f: any) => {
    if (table === 'pending_approvals' && f.column === 'team_id') return { ...f, column: 'organization_id', value: tenant.organization_id };
    if (table === 'team_invites' && f.column === 'invited_by' && f.value === tenant.organization_id) return { ...f, column: 'organization_id', value: tenant.organization_id };
    return f;
  });
  try { validateColumns(table, filters.map((f: any) => String(f.column))); }
  catch (error: any) { return json({ error: error.message }, 400); }

  const params: any[] = [];
  const where: string[] = [];
  if (isDirect) {
    params.push(tenant.organization_id);
    where.push(`organization_id = $${params.length}`);
  } else {
    const child = childTables[table];
    params.push(tenant.organization_id);
    where.push(`exists (select 1 from ${quoteIdent(child.parentTable)} p where p.id = ${quoteIdent(table)}.${quoteIdent(child.parentKey)} and p.organization_id = $${params.length})`);
  }
  for (const filter of filters) {
    if (filter.operator !== 'eq') return json({ error: 'Unsupported filter' }, 400);
    params.push(filter.value);
    where.push(`${quoteIdent(String(filter.column))} = $${params.length}`);
  }

  try {
    if (body.operation === 'select') {
      let sql = `select * from ${quoteIdent(table)} where ${where.join(' and ')}`;
      if (body.orderBy?.column) {
        validateColumns(table, [String(body.orderBy.column)]);
        sql += ` order by ${quoteIdent(String(body.orderBy.column))} ${body.orderBy.ascending === false ? 'desc' : 'asc'}`;
      }
      if (body.single) sql += ' limit 1';
      const result = await db.query(sql, params);
      return json({ data: body.single ? (result.rows[0] || null) : result.rows });
    }

    if (body.operation === 'insert') {
      const rows = normalizePayload(body.payload);
      if (!rows.length) return json({ error: 'Missing payload' }, 400);
      const inserted = [];
      for (const original of rows) {
        const row = { ...original };
        delete row.team_id;
        if (isDirect) row.organization_id = tenant.organization_id;
        if (['activities','surveys','assessments'].includes(table) && !row.created_by) row.created_by = tenant.user.id;
        if (table === 'team_invites') {
          row.invited_by = tenant.user.id;
          if (row.role === 'member') row.role = 'viewer';
          if (!['owner','admin'].includes(tenant.role)) return json({ error: 'Admin permission required' }, 403);
        }
        if (table === 'pending_approvals') row.requested_by = tenant.user.id;
        validateColumns(table, Object.keys(row));
        if (isChild && !(await parentOwned(db, table, row, tenant.organization_id))) return json({ error: 'Parent record not found' }, 404);
        if (!(await relationshipsOwned(db, table, row, tenant.organization_id))) return json({ error: 'Referenced record belongs to another organization or does not exist' }, 403);
        await assertCreationEntitlement(db, tenant.organization_id, table, row);
        const keys = Object.keys(row);
        const values = Object.values(row);
        const placeholders = values.map((_, i) => `$${i + 1}`);
        const result = await db.query(
          `insert into ${quoteIdent(table)} (${keys.map(quoteIdent).join(',')}) values (${placeholders.join(',')}) returning *`, values
        );
        inserted.push(result.rows[0]);
        if (table === 'team_invites') await sendTeamInvite(request, tenant, result.rows[0]).catch(error => console.error('invite email failed', error));
      }
      return json({ data: body.single ? inserted[0] : (Array.isArray(body.payload) ? inserted : inserted[0]) });
    }

    if (body.operation === 'update') {
      if (table === 'team_invites' && !['owner','admin'].includes(tenant.role)) return json({ error: 'Admin permission required' }, 403);
      const updates = { ...(body.payload || {}) };
      delete updates.organization_id;
      delete updates.id;
      delete updates.team_id;
      if (table === 'pending_approvals' && ['status','reviewed_by','reviewed_at'].some(key => key in updates)) {
        return json({ error: 'Approval decisions must use the protected approval transaction' }, 403);
      }
      validateColumns(table, Object.keys(updates));
      if (!Object.keys(updates).length) return json({ error: 'Missing updates' }, 400);
      if (!(await relationshipsOwned(db, table, updates, tenant.organization_id))) return json({ error: 'Referenced record belongs to another organization or does not exist' }, 403);
      if (table === 'assessments' && updates.time_limit_minutes) {
        const billing = await getBillingSnapshot(db, tenant.organization_id);
        requirePro('timed assessments', billing.entitlements.timedAssessments);
      }
      if (table === 'activities' && ['Upcoming', 'Ongoing'].includes(updates.status)) {
        const transitioning = await db.query(
          `select count(*)::int as count from activities where ${where.join(' and ')} and status = 'Completed'`,
          params
        );
        if (transitioning.rows[0].count) {
          const billing = await getBillingSnapshot(db, tenant.organization_id);
          for (let index = 0; index < transitioning.rows[0].count; index += 1) {
            requireAllowance('active activities', billing.usage.activeActivities + index, billing.entitlements.activeActivities, 'ACTIVITY_LIMIT_REACHED');
          }
        }
      }
      const setParams: any[] = [];
      const setSql = Object.entries(updates).map(([key, value], index) => { setParams.push(value); return `${quoteIdent(key)} = $${index + 1}`; });
      const shiftedWhere = where.map(clause => clause.replace(/\$(\d+)/g, (_, n) => `$${Number(n) + setParams.length}`));
      const result = await db.query(
        `update ${quoteIdent(table)} set ${setSql.join(', ')} where ${shiftedWhere.join(' and ')} returning *`, [...setParams, ...params]
      );
      return json({ data: body.single ? (result.rows[0] || null) : result.rows });
    }

    if (body.operation === 'delete') {
      const result = await db.query(`delete from ${quoteIdent(table)} where ${where.join(' and ')} returning *`, params);
      return json({ data: body.single ? (result.rows[0] || null) : result.rows });
    }

    if (body.operation === 'upsert' && table === 'attendance') {
      const row = { ...(body.payload || {}), organization_id: tenant.organization_id };
      validateColumns(table, Object.keys(row));
      if (!(await relationshipsOwned(db, table, row, tenant.organization_id))) return json({ error: 'Referenced record belongs to another organization or does not exist' }, 403);
      const result = await db.query(
        `insert into attendance (organization_id, activity_id, participant_id, session_label, status)
         values ($1,$2,$3,$4,$5)
         on conflict (activity_id, participant_id, session_label)
         do update set status = excluded.status, recorded_at = now()
         returning *`,
        [tenant.organization_id, row.activity_id, row.participant_id, row.session_label, row.status]
      );
      return json({ data: result.rows[0] });
    }

    return json({ error: 'Unsupported operation' }, 400);
  } catch (error: any) {
    console.error('data api error', error);
    if (error instanceof PlanLimitError) return json(error.toResponse(), error.code === 'PRO_REQUIRED' ? 403 : 409);
    return json({ error: error.message || 'Database request failed' }, 500);
  }
};

export const config: Config = { path: '/api/data' };
