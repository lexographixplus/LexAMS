import type { Config } from '@netlify/functions';
import { getPool } from './_shared/db';

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
}

function filtersMap(filters: any[] = []) {
  return Object.fromEntries(filters.filter(f => f?.operator === 'eq').map(f => [String(f.column), f.value]));
}

async function resolveScope(db: ReturnType<typeof getPool>, raw: string | null) {
  if (!raw) return null;
  const [kind, ...rest] = raw.split(':');
  const token = rest.join(':');
  if (!token) return null;

  if (kind === 'reg' || kind === 'att') {
    const column = kind === 'reg' ? 'reg_token' : 'att_token';
    const result = await db.query(`select id, organization_id, reg_open, start_date, end_date from activities where ${column} = $1`, [token]);
    if (!result.rowCount) return null;
    return { kind, token, activity: result.rows[0], organizationId: result.rows[0].organization_id };
  }
  if (kind === 'survey') {
    const result = await db.query(`select id, organization_id, status from surveys where share_token = $1`, [token]);
    if (!result.rowCount) return null;
    return { kind, token, survey: result.rows[0], organizationId: result.rows[0].organization_id };
  }
  if (kind === 'assessment') {
    const result = await db.query(`select id, organization_id, status from assessments where share_token = $1`, [token]);
    if (!result.rowCount) return null;
    return { kind, token, assessment: result.rows[0], organizationId: result.rows[0].organization_id };
  }
  if (kind === 'invite') {
    const result = await db.query(`select id, organization_id, status from team_invites where token = $1`, [token]);
    if (!result.rowCount) return null;
    return { kind, token, invite: result.rows[0], organizationId: result.rows[0].organization_id };
  }
  return null;
}

async function bootstrapScope(db: ReturnType<typeof getPool>, table: string, filters: Record<string, any>) {
  if (table === 'activities' && filters.reg_token) {
    const result = await db.query('select * from activities where reg_token = $1 limit 1', [filters.reg_token]);
    if (!result.rowCount) return null;
    return { data: result.rows[0], scopeToken: `reg:${filters.reg_token}` };
  }
  if (table === 'activities' && filters.att_token) {
    const result = await db.query('select * from activities where att_token = $1 limit 1', [filters.att_token]);
    if (!result.rowCount) return null;
    return { data: result.rows[0], scopeToken: `att:${filters.att_token}` };
  }
  if (table === 'surveys' && filters.share_token) {
    const result = await db.query('select * from surveys where share_token = $1 limit 1', [filters.share_token]);
    if (!result.rowCount) return null;
    return { data: result.rows[0], scopeToken: `survey:${filters.share_token}` };
  }
  if (table === 'assessments' && filters.share_token) {
    const result = await db.query('select * from assessments where share_token = $1 limit 1', [filters.share_token]);
    if (!result.rowCount) return null;
    return { data: result.rows[0], scopeToken: `assessment:${filters.share_token}` };
  }
  if (table === 'team_invites' && filters.token) {
    const result = await db.query('select * from team_invites where token = $1 limit 1', [filters.token]);
    if (!result.rowCount) return null;
    return { data: result.rows[0], scopeToken: `invite:${filters.token}` };
  }
  return null;
}

export default async (request: Request) => {
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const body = await request.json().catch(() => null) as any;
  if (!body?.table || !body?.operation) return json({ error: 'Invalid request' }, 400);
  const table = String(body.table);
  const operation = String(body.operation);
  const filters = filtersMap(body.filters);
  const db = getPool();

  try {
    if (!body.scopeToken) {
      if (operation !== 'select') return json({ error: 'Public scope required' }, 403);
      const boot = await bootstrapScope(db, table, filters);
      if (!boot) return json({ error: 'Not found' }, 404);
      return json({ data: body.single ? boot.data : [boot.data], scopeToken: boot.scopeToken });
    }

    const scope = await resolveScope(db, String(body.scopeToken));
    if (!scope) return json({ error: 'Invalid or expired public link' }, 403);

    if (scope.kind === 'reg') {
      if (scope.activity.reg_open !== true) return json({ error: 'Registration is closed' }, 403);
      if (table === 'activities' && operation === 'select') {
        const result = await db.query('select * from activities where id = $1 and organization_id = $2', [scope.activity.id, scope.organizationId]);
        return json({ data: body.single ? (result.rows[0] || null) : result.rows, scopeToken: body.scopeToken });
      }
      if (table === 'participants' && operation === 'select') {
        const values: any[] = [scope.organizationId];
        let sql = 'select * from participants where organization_id = $1';
        if (filters.email) { values.push(String(filters.email).toLowerCase()); sql += ` and lower(email) = $${values.length}`; }
        if (filters.id) { values.push(filters.id); sql += ` and id = $${values.length}`; }
        const result = await db.query(sql, values);
        return json({ data: body.single ? (result.rows[0] || null) : result.rows, scopeToken: body.scopeToken });
      }
      if (table === 'participants' && operation === 'insert') {
        const p = body.payload || {};
        const result = await db.query(
          `insert into participants (organization_id,name,email,phone,org,category) values ($1,$2,$3,$4,$5,$6) returning *`,
          [scope.organizationId, p.name, String(p.email || '').toLowerCase(), p.phone || '', p.org || '', p.category || 'Community member']
        );
        return json({ data: result.rows[0], scopeToken: body.scopeToken });
      }
      if (table === 'participants' && operation === 'update' && filters.id) {
        const p = body.payload || {};
        const result = await db.query(
          `update participants set name = coalesce($1,name), phone = coalesce($2,phone), org = coalesce($3,org), category = coalesce($4,category), updated_at = now()
           where id = $5 and organization_id = $6 returning *`,
          [p.name ?? null, p.phone ?? null, p.org ?? null, p.category ?? null, filters.id, scope.organizationId]
        );
        return json({ data: body.single ? (result.rows[0] || null) : result.rows, scopeToken: body.scopeToken });
      }
      if (table === 'registrations' && operation === 'select') {
        const values: any[] = [scope.organizationId, scope.activity.id];
        let sql = 'select * from registrations where organization_id = $1 and activity_id = $2';
        if (filters.participant_id) { values.push(filters.participant_id); sql += ` and participant_id = $${values.length}`; }
        const result = await db.query(sql, values);
        return json({ data: body.single ? (result.rows[0] || null) : result.rows, scopeToken: body.scopeToken });
      }
      if (table === 'registrations' && operation === 'insert') {
        const participantId = body.payload?.participant_id;
        const owned = await db.query('select 1 from participants where id = $1 and organization_id = $2', [participantId, scope.organizationId]);
        if (!owned.rowCount) return json({ error: 'Participant not found' }, 404);
        const result = await db.query(
          `insert into registrations (organization_id,activity_id,participant_id) values ($1,$2,$3)
           on conflict (activity_id,participant_id) do nothing returning *`,
          [scope.organizationId, scope.activity.id, participantId]
        );
        return json({ data: result.rows[0] || null, scopeToken: body.scopeToken });
      }
    }

    if (scope.kind === 'att') {
      if (table === 'activities' && operation === 'select') {
        const result = await db.query('select * from activities where id = $1 and organization_id = $2', [scope.activity.id, scope.organizationId]);
        return json({ data: body.single ? (result.rows[0] || null) : result.rows, scopeToken: body.scopeToken });
      }
      if (table === 'participants' && operation === 'select') {
        const values: any[] = [scope.organizationId];
        let sql = 'select * from participants where organization_id = $1';
        if (filters.email) { values.push(String(filters.email).toLowerCase()); sql += ` and lower(email) = $${values.length}`; }
        const result = await db.query(sql, values);
        return json({ data: body.single ? (result.rows[0] || null) : result.rows, scopeToken: body.scopeToken });
      }
      if (table === 'registrations' && operation === 'select') {
        const values: any[] = [scope.organizationId, scope.activity.id];
        let sql = 'select * from registrations where organization_id = $1 and activity_id = $2';
        if (filters.participant_id) { values.push(filters.participant_id); sql += ` and participant_id = $${values.length}`; }
        const result = await db.query(sql, values);
        return json({ data: body.single ? (result.rows[0] || null) : result.rows, scopeToken: body.scopeToken });
      }
      if (table === 'attendance' && operation === 'select') {
        const values: any[] = [scope.organizationId, scope.activity.id];
        let sql = 'select * from attendance where organization_id = $1 and activity_id = $2';
        for (const key of ['participant_id','session_label']) if (filters[key] !== undefined) { values.push(filters[key]); sql += ` and ${key} = $${values.length}`; }
        const result = await db.query(sql, values);
        return json({ data: body.single ? (result.rows[0] || null) : result.rows, scopeToken: body.scopeToken });
      }
      if (table === 'attendance' && operation === 'insert') {
        const p = body.payload || {};
        const registered = await db.query(
          'select 1 from registrations where organization_id = $1 and activity_id = $2 and participant_id = $3',
          [scope.organizationId, scope.activity.id, p.participant_id]
        );
        if (!registered.rowCount) return json({ error: 'Participant is not registered' }, 403);
        const result = await db.query(
          `insert into attendance (organization_id,activity_id,participant_id,session_label,status) values ($1,$2,$3,$4,$5)
           on conflict (activity_id,participant_id,session_label) do nothing returning *`,
          [scope.organizationId, scope.activity.id, p.participant_id, p.session_label || 'Day 1', 'present']
        );
        return json({ data: result.rows[0] || null, scopeToken: body.scopeToken });
      }
    }

    if (scope.kind === 'survey') {
      if (scope.survey.status !== 'active') return json({ error: 'Survey is closed' }, 403);
      if (table === 'surveys' && operation === 'select') {
        const result = await db.query('select * from surveys where id = $1 and organization_id = $2', [scope.survey.id, scope.organizationId]);
        return json({ data: body.single ? (result.rows[0] || null) : result.rows, scopeToken: body.scopeToken });
      }
      if (table === 'survey_questions' && operation === 'select') {
        const result = await db.query('select * from survey_questions where survey_id = $1 order by sort_order asc', [scope.survey.id]);
        return json({ data: result.rows, scopeToken: body.scopeToken });
      }
      if (table === 'survey_responses' && operation === 'insert') {
        const p = body.payload || {};
        const result = await db.query(
          `insert into survey_responses (survey_id,participant_id,respondent_name,respondent_email,answers) values ($1,$2,$3,$4,$5) returning *`,
          [scope.survey.id, p.participant_id || null, p.respondent_name || '', p.respondent_email || '', p.answers || {}]
        );
        return json({ data: result.rows[0], scopeToken: body.scopeToken });
      }
    }

    if (scope.kind === 'assessment') {
      if (scope.assessment.status !== 'active') return json({ error: 'Assessment is closed' }, 403);
      if (table === 'assessments' && operation === 'select') {
        const result = await db.query('select * from assessments where id = $1 and organization_id = $2', [scope.assessment.id, scope.organizationId]);
        return json({ data: body.single ? (result.rows[0] || null) : result.rows, scopeToken: body.scopeToken });
      }
      if (table === 'assessment_questions' && operation === 'select') {
        const result = await db.query('select * from assessment_questions where assessment_id = $1 order by sort_order asc', [scope.assessment.id]);
        return json({ data: result.rows, scopeToken: body.scopeToken });
      }
      if (table === 'assessment_submissions' && operation === 'insert') {
        const p = body.payload || {};
        const result = await db.query(
          `insert into assessment_submissions (assessment_id,participant_id,respondent_name,respondent_email,answers,score,total_points,percentage,passed,started_at,submitted_at)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9,coalesce($10,now()),coalesce($11,now())) returning *`,
          [scope.assessment.id, p.participant_id || null, p.respondent_name || '', p.respondent_email || '', p.answers || {}, p.score ?? null, p.total_points ?? null, p.percentage ?? null, p.passed ?? null, p.started_at || null, p.submitted_at || null]
        );
        return json({ data: result.rows[0], scopeToken: body.scopeToken });
      }
    }

    if (scope.kind === 'invite' && table === 'team_invites' && operation === 'select') {
      const result = await db.query('select * from team_invites where id = $1 and organization_id = $2', [scope.invite.id, scope.organizationId]);
      return json({ data: body.single ? (result.rows[0] || null) : result.rows, scopeToken: body.scopeToken });
    }

    return json({ error: 'Operation is not allowed for this public link' }, 403);
  } catch (error: any) {
    console.error('public data error', error);
    return json({ error: error.message || 'Public request failed' }, 500);
  }
};

export const config: Config = { path: '/api/public-data' };
