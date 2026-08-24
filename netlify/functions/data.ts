import type { Config } from '@netlify/functions';
import { getPool } from './_shared/db';
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

function quoteIdent(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}

function validateColumns(table: string, values: string[]) {
  const allowed = directTables[table] || childTables[table]?.columns;
  if (!allowed) throw new Error('Unsupported table');
  for (const value of values) if (!allowed.has(value)) throw new Error(`Unsupported column: ${value}`);
}

function normalizePayload(payload: any) {
  return Array.isArray(payload) ? payload : [payload];
}

async function parentOwned(db: ReturnType<typeof getPool>, table: string, payload: any, organizationId: string) {
  const child = childTables[table];
  if (!child) return true;
  const parentId = payload?.[child.parentKey];
  if (!parentId) return false;
  const result = await db.query(`select 1 from ${quoteIdent(child.parentTable)} where id = $1 and organization_id = $2`, [parentId, organizationId]);
  return Boolean(result.rowCount);
}

export default async (request: Request) => {
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const tenant = await requireTenant(request);
  if (!tenant) return json({ error: 'Unauthorized' }, 401);

  const body = await request.json().catch(() => null) as any;
  if (!body?.table || !body?.operation) return json({ error: 'Invalid request' }, 400);
  const table = String(body.table);
  const isDirect = Boolean(directTables[table]);
  const isChild = Boolean(childTables[table]);
  if (!isDirect && !isChild) return json({ error: 'Unsupported table' }, 400);

  const filters = Array.isArray(body.filters) ? body.filters : [];
  try { validateColumns(table, filters.map((f: any) => String(f.column))); }
  catch (error: any) { return json({ error: error.message }, 400); }

  const db = getPool();
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
        if (isDirect) row.organization_id = tenant.organization_id;
        if (['activities','surveys','assessments'].includes(table) && !row.created_by) row.created_by = tenant.user.id;
        if (table === 'team_invites' && !row.invited_by) row.invited_by = tenant.user.id;
        if (table === 'pending_approvals' && !row.requested_by) row.requested_by = tenant.user.id;
        validateColumns(table, Object.keys(row));
        if (isChild && !(await parentOwned(db, table, row, tenant.organization_id))) return json({ error: 'Parent record not found' }, 404);
        const keys = Object.keys(row);
        const values = Object.values(row);
        const placeholders = values.map((_, i) => `$${i + 1}`);
        const result = await db.query(
          `insert into ${quoteIdent(table)} (${keys.map(quoteIdent).join(',')}) values (${placeholders.join(',')}) returning *`,
          values
        );
        inserted.push(result.rows[0]);
      }
      return json({ data: body.single ? inserted[0] : (Array.isArray(body.payload) ? inserted : inserted[0]) });
    }

    if (body.operation === 'update') {
      const updates = { ...(body.payload || {}) };
      delete updates.organization_id;
      delete updates.id;
      validateColumns(table, Object.keys(updates));
      if (!Object.keys(updates).length) return json({ error: 'Missing updates' }, 400);
      const setParams: any[] = [];
      const setSql = Object.entries(updates).map(([key, value], index) => { setParams.push(value); return `${quoteIdent(key)} = $${index + 1}`; });
      const shiftedWhere = where.map(clause => clause.replace(/\$(\d+)/g, (_, n) => `$${Number(n) + setParams.length}`));
      const result = await db.query(
        `update ${quoteIdent(table)} set ${setSql.join(', ')} where ${shiftedWhere.join(' and ')} returning *`,
        [...setParams, ...params]
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
    return json({ error: error.message || 'Database request failed' }, 500);
  }
};

export const config: Config = { path: '/api/data' };
