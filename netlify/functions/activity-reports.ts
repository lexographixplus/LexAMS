import type { Config, Context } from '@netlify/functions';
import { getPool } from './_shared/db';
import { requireTenant } from './_shared/tenant';
import { isPreviewDeployment, previewReadOnlyResponse } from './_shared/preview';
import { loadActivityReportSourceBundle } from './_shared/report-sources';
import {
  calculateReportCompletion,
  generateGroundedReportNarrative,
  isReportSectionStale,
  normalizeActivityReport,
  normalizeReportSectionContent,
  normalizeReportTemplate,
  normalizeTemplateSection,
  reportSectionHasSourceData,
  reportingPermissions,
  REPORT_STATUSES,
} from '../../shared/reporting.js';

function json(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: { 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' },
  });
}

function numberId(value: unknown) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

async function audit(
  db: any,
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

async function findActivity(db: any, organizationId: string, activityId: number) {
  const result = await db.query(
    `select id,title,start_date,end_date from activities where id=$1 and organization_id=$2 limit 1`,
    [activityId, organizationId],
  );
  return result.rows[0] || null;
}

async function findTemplate(db: any, organizationId: string, templateId: number) {
  const result = await db.query(
    `select * from report_templates
     where id=$1 and (is_builtin or organization_id=$2) limit 1`,
    [templateId, organizationId],
  );
  return result.rows[0] || null;
}

async function findReport(db: any, organizationId: string, activityId: number, reportId: number) {
  const result = await db.query(
    `select * from activity_reports where id=$1 and activity_id=$2 and organization_id=$3 limit 1`,
    [reportId, activityId, organizationId],
  );
  return result.rows[0] || null;
}

async function moveReportToReview(db: any, organizationId: string, activityId: number, reportId: number) {
  await db.query(
    `update activity_reports
     set status=case when status='approved' then 'in_review' else status end,
         approved_by=null,approved_at=null,updated_at=now()
     where id=$1 and activity_id=$2 and organization_id=$3`,
    [reportId, activityId, organizationId],
  );
}

async function loadTemplates(db: any, organizationId: string) {
  const result = await db.query(
    `select t.id,t.organization_id,t.code,t.name,t.description,t.is_builtin,t.created_at,t.updated_at,
            coalesce(s.sections,'[]'::jsonb) as sections
     from report_templates t
     left join lateral (
       select jsonb_agg(jsonb_build_object(
         'id',rs.id,'title',rs.title,'section_type',rs.section_type,'source_type',rs.source_type,
         'instructions',rs.instructions,'starter_text',rs.starter_text,'visualization',rs.visualization,
         'is_required',rs.is_required,'position',rs.position
       ) order by rs.position,rs.id) as sections
       from report_template_sections rs where rs.template_id=t.id
     ) s on true
     where t.is_builtin or t.organization_id=$1
     order by t.is_builtin desc,t.name,t.id`,
    [organizationId],
  );
  return result.rows;
}

async function loadReports(db: any, organizationId: string, activityId: number, sources: Record<string, any>) {
  const [reportResult, sectionResult] = await Promise.all([
    db.query(
      `select r.id,r.template_id,r.title,r.status,r.reporting_period_start,r.reporting_period_end,
              r.created_by,r.approved_by,r.approved_at,r.created_at,r.updated_at,
              coalesce(nullif(p.full_name,''),nullif(u.name,''),u.email,'Former team member') as author_name,
              t.name as template_name
       from activity_reports r
       left join users u on u.id=r.created_by
       left join profiles p on p.user_id=r.created_by
       left join report_templates t on t.id=r.template_id
       where r.organization_id=$1 and r.activity_id=$2 and r.status<>'archived'
       order by r.updated_at desc,r.id desc`,
      [organizationId, activityId],
    ),
    db.query(
      `select s.id,s.report_id,s.template_section_id,s.title,s.section_type,s.source_type,
              s.instructions,s.content_text,s.generated_text,s.content_state,s.generation_version,
              s.source_hash,s.source_snapshot,s.generated_at,s.approved_by,s.approved_at,
              s.visualization,s.is_required,s.position,s.created_at,s.updated_at
       from activity_report_sections s
       join activity_reports r on r.id=s.report_id and r.organization_id=s.organization_id and r.activity_id=s.activity_id
       where s.organization_id=$1 and s.activity_id=$2 and r.status<>'archived'
       order by s.report_id,s.position,s.id`,
      [organizationId, activityId],
    ),
  ]);

  const sectionsByReport = new Map<number, any[]>();
  sectionResult.rows.forEach((section: any) => {
    const source = section.source_type ? sources[section.source_type] || null : null;
    const normalized = {
      ...section,
      source_payload: source,
      current_source_hash: source?.hash || null,
      has_source_data: section.source_type ? reportSectionHasSourceData(source) : false,
      source_changed: source ? isReportSectionStale(section, source.hash) : false,
    };
    const current = sectionsByReport.get(Number(section.report_id)) || [];
    current.push(normalized);
    sectionsByReport.set(Number(section.report_id), current);
  });

  return reportResult.rows.map((report: any) => {
    const sections = sectionsByReport.get(Number(report.id)) || [];
    return { ...report, sections, completion: calculateReportCompletion(sections) };
  });
}

async function snapshot(db: any, organizationId: string, activityId: number, role: string, userId: string) {
  const bundle = await loadActivityReportSourceBundle(db, organizationId, activityId);
  if (!bundle) return null;
  const [templates, reports] = await Promise.all([
    loadTemplates(db, organizationId),
    loadReports(db, organizationId, activityId, bundle.sources),
  ]);
  return {
    ...bundle,
    templates,
    reports,
    permissions: { ...reportingPermissions(role), role, currentUserId: userId },
  };
}

async function replaceTemplateSections(client: any, organizationId: string, templateId: number, sections: any[]) {
  await client.query(`delete from report_template_sections where template_id=$1 and organization_id=$2`, [templateId, organizationId]);
  for (let index = 0; index < sections.length; index += 1) {
    const section = sections[index];
    await client.query(
      `insert into report_template_sections
         (organization_id,template_id,title,section_type,source_type,instructions,starter_text,visualization,is_required,position)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [organizationId, templateId, section.title, section.section_type, section.source_type, section.instructions,
        section.starter_text, section.visualization, section.is_required, (index + 1) * 10],
    );
  }
}

async function storeReference(
  db: any,
  organizationId: string,
  activityId: number,
  reportId: number,
  sectionId: number,
  sourceType: string,
  source: any,
  generationVersion: string,
) {
  await db.query(
    `insert into report_section_references
       (organization_id,activity_id,report_id,section_id,source_type,source_hash,source_snapshot,generation_version,captured_at)
     values ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,now())
     on conflict (organization_id,activity_id,report_id,section_id,source_type)
     do update set source_hash=excluded.source_hash,source_snapshot=excluded.source_snapshot,
                   generation_version=excluded.generation_version,captured_at=now()`,
    [organizationId, activityId, reportId, sectionId, sourceType, source.hash, JSON.stringify(source), generationVersion],
  );
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
  const permissions = reportingPermissions(tenant.role);

  if (request.method === 'GET') {
    const data = await snapshot(db, organizationId, activityId, tenant.role, userId);
    return data ? json(data) : json({ error: 'Activity not found.' }, 404);
  }
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
  const activity = await findActivity(db, organizationId, activityId);
  if (!activity) return json({ error: 'Activity not found.' }, 404);

  const body = await request.json().catch(() => ({})) as any;
  const action = String(body.action || '');

  try {
    if (action === 'save_template') {
      if (!permissions.canManageTemplates) return json({ error: 'Administrator permission is required to manage organisation templates.' }, 403);
      const template = normalizeReportTemplate(body.template);
      const client = await db.connect();
      try {
        await client.query('begin');
        let templateId = template.id;
        if (templateId) {
          const current = await client.query(
            `select id from report_templates where id=$1 and organization_id=$2 and not is_builtin limit 1`,
            [templateId, organizationId],
          );
          if (!current.rowCount) throw new Error('Only organisation templates can be edited.');
          await client.query(
            `update report_templates set name=$3,description=$4,updated_at=now() where id=$1 and organization_id=$2`,
            [templateId, organizationId, template.name, template.description],
          );
        } else {
          const created = await client.query(
            `insert into report_templates (organization_id,name,description,is_builtin,created_by)
             values ($1,$2,$3,false,$4) returning id`,
            [organizationId, template.name, template.description, userId],
          );
          templateId = Number(created.rows[0].id);
        }
        await replaceTemplateSections(client, organizationId, templateId!, template.sections);
        await audit(client, organizationId, userId, template.id ? 'reporting.template_updated' : 'reporting.template_created', 'report_template', templateId!, { sections: template.sections.length });
        await client.query('commit');
        return json({ templateId }, template.id ? 200 : 201);
      } catch (error) {
        await client.query('rollback').catch(() => undefined);
        throw error;
      } finally {
        client.release();
      }
    }

    if (action === 'duplicate_template') {
      if (!permissions.canManageTemplates) return json({ error: 'Administrator permission is required to manage organisation templates.' }, 403);
      const templateId = numberId(body.templateId);
      const name = String(body.name || '').trim().slice(0, 120);
      if (!templateId || !name) return json({ error: 'Template and copy name are required.' }, 400);
      const source = await findTemplate(db, organizationId, templateId);
      if (!source) return json({ error: 'Template not found.' }, 404);
      const client = await db.connect();
      try {
        await client.query('begin');
        const created = await client.query(
          `insert into report_templates (organization_id,name,description,is_builtin,created_by)
           values ($1,$2,$3,false,$4) returning id`,
          [organizationId, name, source.description, userId],
        );
        const copyId = Number(created.rows[0].id);
        await client.query(
          `insert into report_template_sections
             (organization_id,template_id,title,section_type,source_type,instructions,starter_text,visualization,is_required,position)
           select $1,$2,title,section_type,source_type,instructions,starter_text,visualization,is_required,position
           from report_template_sections where template_id=$3 order by position,id`,
          [organizationId, copyId, templateId],
        );
        await audit(client, organizationId, userId, 'reporting.template_duplicated', 'report_template', copyId, { sourceTemplateId: templateId });
        await client.query('commit');
        return json({ templateId: copyId }, 201);
      } catch (error) {
        await client.query('rollback').catch(() => undefined);
        throw error;
      } finally {
        client.release();
      }
    }

    if (action === 'delete_template') {
      if (!permissions.canManageTemplates) return json({ error: 'Administrator permission is required to manage organisation templates.' }, 403);
      const templateId = numberId(body.templateId);
      if (!templateId) return json({ error: 'Invalid template.' }, 400);
      const result = await db.query(
        `delete from report_templates where id=$1 and organization_id=$2 and not is_builtin returning id,name`,
        [templateId, organizationId],
      );
      if (!result.rowCount) return json({ error: 'Organisation template not found.' }, 404);
      await audit(db, organizationId, userId, 'reporting.template_deleted', 'report_template', templateId, { name: result.rows[0].name });
      return json({ removed: templateId });
    }

    if (action === 'create_report') {
      if (!permissions.canCreateReports) return json({ error: 'Report editor permission is required.' }, 403);
      const report = normalizeActivityReport(body.report, activity);
      if (!report.template_id) return json({ error: 'Choose a report template.' }, 400);
      const template = await findTemplate(db, organizationId, report.template_id);
      if (!template) return json({ error: 'Report template not found.' }, 404);
      const client = await db.connect();
      try {
        await client.query('begin');
        const created = await client.query(
          `insert into activity_reports
             (organization_id,activity_id,template_id,title,reporting_period_start,reporting_period_end,created_by)
           values ($1,$2,$3,$4,$5,$6,$7) returning id`,
          [organizationId, activityId, template.id, report.title, report.reporting_period_start, report.reporting_period_end, userId],
        );
        const reportId = Number(created.rows[0].id);
        await client.query(
          `insert into activity_report_sections
             (organization_id,activity_id,report_id,template_section_id,title,section_type,source_type,instructions,
              content_text,content_state,visualization,is_required,position)
           select $1,$2,$3,id,title,section_type,source_type,instructions,starter_text,
                  case when starter_text<>'' then 'user_edited' else 'empty' end,visualization,is_required,position
           from report_template_sections where template_id=$4 order by position,id`,
          [organizationId, activityId, reportId, template.id],
        );
        await audit(client, organizationId, userId, 'reporting.report_created', 'activity_report', reportId, { activityId, templateId: template.id });
        await client.query('commit');
        return json({ reportId }, 201);
      } catch (error) {
        await client.query('rollback').catch(() => undefined);
        throw error;
      } finally {
        client.release();
      }
    }

    if (action === 'save_report') {
      if (!permissions.canEditReports) return json({ error: 'Report editor permission is required.' }, 403);
      const reportId = numberId(body.report?.id);
      const status = String(body.report?.status || 'draft');
      if (!reportId || !REPORT_STATUSES.includes(status)) return json({ error: 'Invalid report.' }, 400);
      const current = await findReport(db, organizationId, activityId, reportId);
      if (!current) return json({ error: 'Report not found.' }, 404);
      if (status === 'approved' && !permissions.canApproveReports) return json({ error: 'Report approval permission is required.' }, 403);
      if (status === 'approved') {
        const bundle = await loadActivityReportSourceBundle(db, organizationId, activityId);
        const reports = bundle ? await loadReports(db, organizationId, activityId, bundle.sources) : [];
        const candidate = reports.find((item: any) => Number(item.id) === reportId);
        if (!candidate || candidate.completion.requiredIncomplete > 0) {
          return json({ error: 'Complete every required report section before approval.' }, 409);
        }
        if (candidate.sections.some((section: any) => section.source_changed)) {
          return json({ error: 'Review every changed source before approving this report.' }, 409);
        }
      }
      const report = normalizeActivityReport(body.report, activity);
      const result = await db.query(
        `update activity_reports set title=$4,status=$5,reporting_period_start=$6,reporting_period_end=$7,
             approved_by=case when $5='approved' then $8::uuid else null end,
             approved_at=case when $5='approved' then now() else null end,updated_at=now()
         where id=$1 and activity_id=$2 and organization_id=$3 returning *`,
        [reportId, activityId, organizationId, report.title, status, report.reporting_period_start, report.reporting_period_end, userId],
      );
      await audit(db, organizationId, userId, 'reporting.report_updated', 'activity_report', reportId, { activityId, status });
      return json({ report: result.rows[0] });
    }

    if (action === 'delete_report') {
      if (!permissions.canEditReports) return json({ error: 'Report editor permission is required.' }, 403);
      const reportId = numberId(body.reportId);
      if (!reportId) return json({ error: 'Invalid report.' }, 400);
      const result = await db.query(
        `delete from activity_reports where id=$1 and activity_id=$2 and organization_id=$3 returning id,title`,
        [reportId, activityId, organizationId],
      );
      if (!result.rowCount) return json({ error: 'Report not found.' }, 404);
      await audit(db, organizationId, userId, 'reporting.report_deleted', 'activity_report', reportId, { activityId, title: result.rows[0].title });
      return json({ removed: reportId });
    }

    if (action === 'save_section') {
      if (!permissions.canEditReports) return json({ error: 'Report editor permission is required.' }, 403);
      const section = normalizeReportSectionContent(body.section);
      const current = await db.query(
        `select s.* from activity_report_sections s
         join activity_reports r on r.id=s.report_id and r.organization_id=s.organization_id and r.activity_id=s.activity_id
         where s.id=$1 and s.activity_id=$2 and s.organization_id=$3 and r.status<>'archived' limit 1`,
        [section.id, activityId, organizationId],
      );
      if (!current.rowCount) return json({ error: 'Report section not found.' }, 404);
      const row = current.rows[0];
      const state = section.content_text
        ? (row.generated_text && section.content_text === row.generated_text ? 'generated' : 'user_edited')
        : 'empty';
      const result = await db.query(
        `update activity_report_sections set title=$4,content_text=$5,instructions=$6,content_state=$7,
             approved_by=null,approved_at=null,updated_at=now()
         where id=$1 and activity_id=$2 and organization_id=$3 returning *`,
        [section.id, activityId, organizationId, section.title, section.content_text, section.instructions, state],
      );
      await moveReportToReview(db, organizationId, activityId, Number(row.report_id));
      await audit(db, organizationId, userId, 'reporting.section_saved', 'activity_report_section', section.id, { activityId, reportId: row.report_id, state });
      return json({ section: result.rows[0] });
    }

    if (action === 'generate_section') {
      if (!permissions.canGenerateNarrative) return json({ error: 'Narrative generation permission is required.' }, 403);
      const sectionId = numberId(body.sectionId);
      if (!sectionId) return json({ error: 'Invalid report section.' }, 400);
      const sectionResult = await db.query(
        `select s.* from activity_report_sections s
         join activity_reports r on r.id=s.report_id and r.organization_id=s.organization_id and r.activity_id=s.activity_id
         where s.id=$1 and s.activity_id=$2 and s.organization_id=$3 and r.status<>'archived' limit 1`,
        [sectionId, activityId, organizationId],
      );
      const section = sectionResult.rows[0];
      if (!section) return json({ error: 'Report section not found.' }, 404);
      if (!['generated', 'hybrid'].includes(section.section_type) || !section.source_type) return json({ error: 'This section does not support narrative generation.' }, 400);
      if (['user_edited', 'approved'].includes(section.content_state) && body.confirmReplace !== true) {
        return json({ error: 'This section contains protected writing. Confirm before replacing it.', confirmationRequired: true }, 409);
      }
      const bundle = await loadActivityReportSourceBundle(db, organizationId, activityId);
      const source = bundle?.sources?.[section.source_type];
      if (!source || !reportSectionHasSourceData(source)) return json({ error: 'There is not enough source data to generate this section.' }, 409);
      const generation = generateGroundedReportNarrative({ sourceType: section.source_type, source });
      const generationVersion = generation.version;
      const narrative = generation.content;
      const client = await db.connect();
      try {
        await client.query('begin');
        const result = await client.query(
          `update activity_report_sections set content_text=$4,generated_text=$4,content_state='generated',
               generation_version=$5,source_hash=$6,source_snapshot=$7::jsonb,generated_at=now(),
               approved_by=null,approved_at=null,updated_at=now()
           where id=$1 and activity_id=$2 and organization_id=$3 returning *`,
          [sectionId, activityId, organizationId, narrative, generationVersion, source.hash, JSON.stringify(source)],
        );
        await storeReference(client, organizationId, activityId, Number(section.report_id), sectionId, section.source_type, source, generationVersion);
        await moveReportToReview(client, organizationId, activityId, Number(section.report_id));
        await audit(client, organizationId, userId, 'reporting.section_generated', 'activity_report_section', sectionId, { activityId, reportId: section.report_id, sourceType: section.source_type, generationProvider: generation.provider, generationVersion });
        await client.query('commit');
        return json({ section: result.rows[0] });
      } catch (error) {
        await client.query('rollback').catch(() => undefined);
        throw error;
      } finally {
        client.release();
      }
    }

    if (action === 'acknowledge_source') {
      if (!permissions.canEditReports) return json({ error: 'Report editor permission is required.' }, 403);
      const sectionId = numberId(body.sectionId);
      if (!sectionId) return json({ error: 'Invalid report section.' }, 400);
      const current = await db.query(
        `select * from activity_report_sections where id=$1 and activity_id=$2 and organization_id=$3 limit 1`,
        [sectionId, activityId, organizationId],
      );
      const section = current.rows[0];
      if (!section?.source_type) return json({ error: 'Report section source not found.' }, 404);
      const bundle = await loadActivityReportSourceBundle(db, organizationId, activityId);
      const source = bundle?.sources?.[section.source_type];
      if (!source) return json({ error: 'Report source not found.' }, 404);
      const generationVersion = section.generation_version || 'deterministic-v1';
      const client = await db.connect();
      try {
        await client.query('begin');
        await client.query(
          `update activity_report_sections set source_hash=$4,source_snapshot=$5::jsonb,updated_at=now()
           where id=$1 and activity_id=$2 and organization_id=$3`,
          [sectionId, activityId, organizationId, source.hash, JSON.stringify(source)],
        );
        await storeReference(client, organizationId, activityId, Number(section.report_id), sectionId, section.source_type, source, generationVersion);
        await client.query(
          `update activity_reports set updated_at=now() where id=$1 and activity_id=$2 and organization_id=$3`,
          [section.report_id, activityId, organizationId],
        );
        await audit(client, organizationId, userId, 'reporting.source_change_acknowledged', 'activity_report_section', sectionId, { activityId, reportId: section.report_id, sourceType: section.source_type });
        await client.query('commit');
        return json({ acknowledged: sectionId });
      } catch (error) {
        await client.query('rollback').catch(() => undefined);
        throw error;
      } finally {
        client.release();
      }
    }

    if (action === 'set_section_approval') {
      if (!permissions.canApproveReports) return json({ error: 'Report approval permission is required.' }, 403);
      const sectionId = numberId(body.sectionId);
      const approved = body.approved === true;
      if (!sectionId) return json({ error: 'Invalid report section.' }, 400);
      const current = await db.query(
        `select * from activity_report_sections where id=$1 and activity_id=$2 and organization_id=$3 limit 1`,
        [sectionId, activityId, organizationId],
      );
      const section = current.rows[0];
      if (!section) return json({ error: 'Report section not found.' }, 404);
      if (approved && !String(section.content_text || '').trim() && section.section_type !== 'linked') return json({ error: 'Complete the section before approving it.' }, 409);
      const nextState = approved ? 'approved' : (section.generated_text && section.content_text === section.generated_text ? 'generated' : (section.content_text ? 'user_edited' : 'empty'));
      const result = await db.query(
        `update activity_report_sections set content_state=$4,
             approved_by=case when $5 then $6::uuid else null end,
             approved_at=case when $5 then now() else null end,updated_at=now()
         where id=$1 and activity_id=$2 and organization_id=$3 returning *`,
        [sectionId, activityId, organizationId, nextState, approved, userId],
      );
      await moveReportToReview(db, organizationId, activityId, Number(section.report_id));
      await audit(db, organizationId, userId, approved ? 'reporting.section_approved' : 'reporting.section_unlocked', 'activity_report_section', sectionId, { activityId, reportId: section.report_id });
      return json({ section: result.rows[0] });
    }

    if (action === 'add_report_section') {
      if (!permissions.canEditReports) return json({ error: 'Report editor permission is required.' }, 403);
      const reportId = numberId(body.reportId);
      if (!reportId || !(await findReport(db, organizationId, activityId, reportId))) return json({ error: 'Report not found.' }, 404);
      const section = normalizeTemplateSection(body.section, 1);
      const result = await db.query(
        `insert into activity_report_sections
           (organization_id,activity_id,report_id,title,section_type,source_type,instructions,content_text,
            content_state,visualization,is_required,position)
         values ($1,$2,$3,$4,$5,$6,$7,$8,case when $8<>'' then 'user_edited' else 'empty' end,$9,$10,
                 coalesce((select max(position)+10 from activity_report_sections where organization_id=$1 and activity_id=$2 and report_id=$3),10))
         returning *`,
        [organizationId, activityId, reportId, section.title, section.section_type, section.source_type,
          section.instructions, section.starter_text, section.visualization, section.is_required],
      );
      await moveReportToReview(db, organizationId, activityId, reportId);
      await audit(db, organizationId, userId, 'reporting.section_added', 'activity_report_section', result.rows[0].id, { activityId, reportId });
      return json({ section: result.rows[0] }, 201);
    }

    if (action === 'delete_report_section') {
      if (!permissions.canEditReports) return json({ error: 'Report editor permission is required.' }, 403);
      const sectionId = numberId(body.sectionId);
      if (!sectionId) return json({ error: 'Invalid report section.' }, 400);
      const current = await db.query(
        `select s.id,s.report_id,s.title,
                (select count(*)::int from activity_report_sections siblings
                 where siblings.organization_id=s.organization_id and siblings.activity_id=s.activity_id and siblings.report_id=s.report_id) as section_count
         from activity_report_sections s
         where s.id=$1 and s.activity_id=$2 and s.organization_id=$3 limit 1`,
        [sectionId, activityId, organizationId],
      );
      if (!current.rowCount) return json({ error: 'Report section not found.' }, 404);
      if (Number(current.rows[0].section_count) <= 1) return json({ error: 'A report must keep at least one section.' }, 409);
      const result = await db.query(
        `delete from activity_report_sections where id=$1 and activity_id=$2 and organization_id=$3 returning id,report_id,title`,
        [sectionId, activityId, organizationId],
      );
      await moveReportToReview(db, organizationId, activityId, Number(result.rows[0].report_id));
      await audit(db, organizationId, userId, 'reporting.section_deleted', 'activity_report_section', sectionId, { activityId, reportId: result.rows[0].report_id, title: result.rows[0].title });
      return json({ removed: sectionId });
    }

    if (action === 'reorder_sections') {
      if (!permissions.canEditReports) return json({ error: 'Report editor permission is required.' }, 403);
      const reportId = numberId(body.reportId);
      const sectionIds = Array.isArray(body.sectionIds) ? body.sectionIds.map(numberId) : [];
      if (!reportId || !sectionIds.length || sectionIds.some((id: number | null) => !id) || new Set(sectionIds).size !== sectionIds.length) return json({ error: 'Invalid section order.' }, 400);
      const current = await db.query(
        `select id from activity_report_sections where organization_id=$1 and activity_id=$2 and report_id=$3`,
        [organizationId, activityId, reportId],
      );
      if (current.rowCount !== sectionIds.length || current.rows.some((row: any) => !sectionIds.includes(Number(row.id)))) return json({ error: 'Section order does not match this report.' }, 400);
      const client = await db.connect();
      try {
        await client.query('begin');
        for (let index = 0; index < sectionIds.length; index += 1) {
          await client.query(
            `update activity_report_sections set position=$5,updated_at=now()
             where id=$1 and activity_id=$2 and organization_id=$3 and report_id=$4`,
            [sectionIds[index], activityId, organizationId, reportId, (index + 1) * 10],
          );
        }
        await moveReportToReview(client, organizationId, activityId, reportId);
        await audit(client, organizationId, userId, 'reporting.sections_reordered', 'activity_report', reportId, { activityId, sectionIds });
        await client.query('commit');
        return json({ reordered: sectionIds.length });
      } catch (error) {
        await client.query('rollback').catch(() => undefined);
        throw error;
      } finally {
        client.release();
      }
    }

    return json({ error: 'Unsupported reporting action.' }, 400);
  } catch (error: any) {
    console.error('Activity reporting failed', { action, activityId, error });
    const message = error?.code === '23505' ? 'A template with that name already exists.' : (error instanceof Error ? error.message : 'Could not complete the reporting action.');
    return json({ error: message }, 400);
  }
};

export const config: Config = {
  path: '/api/activity-reports/:activityId',
  method: ['GET', 'POST'],
};
