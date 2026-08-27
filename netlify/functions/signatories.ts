import type { Config } from '@netlify/functions';
import { getStore } from '@netlify/blobs';
import { getPool } from './_shared/db';
import { requireTenant } from './_shared/tenant';
import { isPreviewDeployment, previewReadOnlyResponse } from './_shared/preview';

type SignatoryConfigItem = {
  signatory_id: number;
  show_signature: boolean;
  show_name: boolean;
  show_title: boolean;
  show_organization: boolean;
};

const allowedImageTypes = new Map([
  ['image/png', 'png'],
  ['image/jpeg', 'jpg'],
  ['image/webp', 'webp'],
]);

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function text(value: unknown, max = 160) {
  return String(value ?? '').trim().slice(0, max);
}

function normalizeConfig(value: unknown): SignatoryConfigItem[] {
  if (value == null) return [];
  if (!Array.isArray(value)) throw new Error('Signatory configuration must be a list');
  if (value.length > 4) throw new Error('A certificate can have at most four signatories');

  const seen = new Set<number>();
  const normalized: SignatoryConfigItem[] = [];
  for (const raw of value) {
    const id = Number((raw as any)?.signatory_id ?? (raw as any)?.signatoryId);
    if (!Number.isSafeInteger(id) || id <= 0) throw new Error('Invalid signatory selection');
    if (seen.has(id)) throw new Error('A signatory can only appear once on a certificate');
    seen.add(id);
    normalized.push({
      signatory_id: id,
      show_signature: (raw as any)?.show_signature !== false && (raw as any)?.showSignature !== false,
      show_name: (raw as any)?.show_name !== false && (raw as any)?.showName !== false,
      show_title: (raw as any)?.show_title !== false && (raw as any)?.showTitle !== false,
      show_organization: (raw as any)?.show_organization === true || (raw as any)?.showOrganization === true,
    });
  }
  return normalized;
}

async function assertConfigOwned(db: ReturnType<typeof getPool>, organizationId: string, config: SignatoryConfigItem[]) {
  if (!config.length) return;
  const ids = config.map(item => item.signatory_id);
  const result = await db.query(
    `select id from organization_signatories
     where organization_id=$1 and active=true and id=any($2::bigint[])`,
    [organizationId, ids]
  );
  if (result.rowCount !== ids.length) throw new Error('One or more selected signatories are inactive or unavailable');
}

async function audit(db: ReturnType<typeof getPool>, organizationId: string, userId: string, action: string, entityType: string, entityId: string, metadata: unknown = {}) {
  await db.query(
    `insert into audit_log (organization_id,user_id,action,entity_type,entity_id,metadata)
     values ($1,$2,$3,$4,$5,$6::jsonb)`,
    [organizationId, userId, action, entityType, entityId, JSON.stringify(metadata)]
  );
}

export default async (request: Request) => {
  const tenant = await requireTenant(request);
  if (!tenant) return json({ error: 'Unauthorized' }, 401);

  const db = getPool();
  const organizationId = tenant.organization_id;
  const isAdmin = ['owner', 'admin'].includes(tenant.role);
  const url = new URL(request.url);
  const store = getStore({ name: 'lexams-signatures', consistency: 'strong' });

  if (request.method === 'GET') {
    const signatureId = Number(url.searchParams.get('signature'));
    if (Number.isSafeInteger(signatureId) && signatureId > 0) {
      if (!isAdmin) return json({ error: 'Admin permission required' }, 403);
      const signatory = await db.query(
        `select signature_blob_key,signature_content_type
         from organization_signatories
         where id=$1 and organization_id=$2 and signature_blob_key is not null`,
        [signatureId, organizationId]
      );
      if (!signatory.rowCount) return new Response('Not found', { status: 404 });
      const row = signatory.rows[0];
      const result = await store.getWithMetadata(row.signature_blob_key, { type: 'arrayBuffer' });
      if (!result) return new Response('Not found', { status: 404 });
      return new Response(result.data, {
        status: 200,
        headers: {
          'content-type': String(row.signature_content_type || result.metadata?.contentType || 'application/octet-stream'),
          'cache-control': 'private, no-store',
          'x-content-type-options': 'nosniff',
        },
      });
    }

    const [signatories, settings, templates] = await Promise.all([
      db.query(
        `select id,full_name,title,organization_label,signature_mode,
                (signature_blob_key is not null) as has_signature,active,created_at,updated_at
         from organization_signatories
         where organization_id=$1
         order by active desc, lower(full_name) asc`,
        [organizationId]
      ),
      db.query(
        `select signatory_config from organization_certificate_settings
         where organization_id=$1`,
        [organizationId]
      ),
      db.query(
        `select id,name,certificate_title,active,signatory_config
         from award_templates
         where organization_id=$1
         order by active desc, lower(name) asc`,
        [organizationId]
      ),
    ]);

    return json({
      signatories: signatories.rows.map(row => ({
        ...row,
        signature_preview_url: row.has_signature && isAdmin ? `/api/signatories?signature=${row.id}` : null,
      })),
      default_config: settings.rows[0]?.signatory_config || [],
      award_templates: templates.rows,
      can_manage: isAdmin,
    });
  }

  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  if (isPreviewDeployment(request)) return previewReadOnlyResponse();
  if (!isAdmin) return json({ error: 'Admin permission required' }, 403);

  const contentType = request.headers.get('content-type') || '';

  try {
    if (contentType.includes('multipart/form-data')) {
      const form = await request.formData();
      const action = String(form.get('action') || '');
      if (action !== 'upload_signature') return json({ error: 'Unsupported upload action' }, 400);

      const signatoryId = Number(form.get('signatoryId'));
      const file = form.get('file');
      if (!Number.isSafeInteger(signatoryId) || signatoryId <= 0) return json({ error: 'Invalid signatory' }, 400);
      if (!(file instanceof File)) return json({ error: 'Signature image is required' }, 400);
      if (!allowedImageTypes.has(file.type)) return json({ error: 'Only PNG, JPEG, and WebP signatures are allowed' }, 400);
      if (file.size > 1024 * 1024) return json({ error: 'Signature image must be under 1MB' }, 400);

      const owned = await db.query(
        `select id from organization_signatories where id=$1 and organization_id=$2`,
        [signatoryId, organizationId]
      );
      if (!owned.rowCount) return json({ error: 'Signatory not found' }, 404);

      const key = `organizations/${organizationId}/signatories/${signatoryId}/signature`;
      await store.set(key, await file.arrayBuffer(), {
        metadata: { contentType: file.type, uploadedAt: new Date().toISOString() },
      });
      const updated = await db.query(
        `update organization_signatories
         set signature_mode='uploaded',signature_blob_key=$3,signature_content_type=$4,updated_at=now()
         where id=$1 and organization_id=$2
         returning id,full_name,title,organization_label,signature_mode,active,updated_at`,
        [signatoryId, organizationId, key, file.type]
      );
      await audit(db, organizationId, tenant.user.id, 'signatory.signature_uploaded', 'organization_signatory', String(signatoryId), { contentType: file.type });
      return json({
        signatory: {
          ...updated.rows[0],
          has_signature: true,
          signature_preview_url: `/api/signatories?signature=${signatoryId}`,
        },
      });
    }

    const body = await request.json().catch(() => ({})) as any;
    const action = String(body.action || '');

    if (action === 'create') {
      const fullName = text(body.fullName, 140);
      if (!fullName) return json({ error: 'Full name is required' }, 400);
      const result = await db.query(
        `insert into organization_signatories
         (organization_id,full_name,title,organization_label,signature_mode,created_by)
         values ($1,$2,$3,$4,'typed',$5)
         returning id,full_name,title,organization_label,signature_mode,active,created_at,updated_at`,
        [organizationId, fullName, text(body.title, 140) || null, text(body.organizationLabel, 180) || null, tenant.user.id]
      );
      const signatory = result.rows[0];
      await audit(db, organizationId, tenant.user.id, 'signatory.created', 'organization_signatory', String(signatory.id), { fullName });
      return json({ signatory: { ...signatory, has_signature: false, signature_preview_url: null } }, 201);
    }

    if (action === 'update') {
      const id = Number(body.id);
      if (!Number.isSafeInteger(id) || id <= 0) return json({ error: 'Invalid signatory' }, 400);
      const fullName = text(body.fullName, 140);
      if (!fullName) return json({ error: 'Full name is required' }, 400);
      const signatureMode = body.signatureMode === 'uploaded' ? 'uploaded' : 'typed';
      if (signatureMode === 'uploaded') {
        const existing = await db.query(
          `select signature_blob_key from organization_signatories where id=$1 and organization_id=$2`,
          [id, organizationId]
        );
        if (!existing.rowCount) return json({ error: 'Signatory not found' }, 404);
        if (!existing.rows[0].signature_blob_key) return json({ error: 'Upload a signature image before switching to uploaded signature' }, 400);
      }
      const result = await db.query(
        `update organization_signatories
         set full_name=$3,title=$4,organization_label=$5,signature_mode=$6,updated_at=now()
         where id=$1 and organization_id=$2
         returning id,full_name,title,organization_label,signature_mode,
                   (signature_blob_key is not null) as has_signature,active,created_at,updated_at`,
        [id, organizationId, fullName, text(body.title, 140) || null, text(body.organizationLabel, 180) || null, signatureMode]
      );
      if (!result.rowCount) return json({ error: 'Signatory not found' }, 404);
      await audit(db, organizationId, tenant.user.id, 'signatory.updated', 'organization_signatory', String(id), { fullName, signatureMode });
      const signatory = result.rows[0];
      return json({ signatory: { ...signatory, signature_preview_url: signatory.has_signature ? `/api/signatories?signature=${id}` : null } });
    }

    if (action === 'set_active') {
      const id = Number(body.id);
      const active = body.active === true;
      if (!Number.isSafeInteger(id) || id <= 0) return json({ error: 'Invalid signatory' }, 400);
      const result = await db.query(
        `update organization_signatories set active=$3,updated_at=now()
         where id=$1 and organization_id=$2 returning id,active`,
        [id, organizationId, active]
      );
      if (!result.rowCount) return json({ error: 'Signatory not found' }, 404);
      await audit(db, organizationId, tenant.user.id, active ? 'signatory.activated' : 'signatory.deactivated', 'organization_signatory', String(id));
      return json({ signatory: result.rows[0] });
    }

    if (action === 'set_defaults') {
      const config = normalizeConfig(body.config);
      await assertConfigOwned(db, organizationId, config);
      await db.query(
        `insert into organization_certificate_settings (organization_id,signatory_config,updated_by)
         values ($1,$2::jsonb,$3)
         on conflict (organization_id) do update
         set signatory_config=excluded.signatory_config,updated_by=excluded.updated_by,updated_at=now()`,
        [organizationId, JSON.stringify(config), tenant.user.id]
      );
      await audit(db, organizationId, tenant.user.id, 'certificate_signatories.defaults_updated', 'certificate_settings', organizationId, { signatoryIds: config.map(item => item.signatory_id) });
      return json({ default_config: config });
    }

    if (action === 'set_template_config') {
      const templateId = Number(body.templateId);
      if (!Number.isSafeInteger(templateId) || templateId <= 0) return json({ error: 'Invalid award template' }, 400);
      const config = normalizeConfig(body.config);
      await assertConfigOwned(db, organizationId, config);
      const result = await db.query(
        `update award_templates set signatory_config=$3::jsonb,updated_at=now()
         where id=$1 and organization_id=$2 returning id,name,signatory_config`,
        [templateId, organizationId, JSON.stringify(config)]
      );
      if (!result.rowCount) return json({ error: 'Award template not found' }, 404);
      await audit(db, organizationId, tenant.user.id, 'certificate_signatories.template_updated', 'award_template', String(templateId), { signatoryIds: config.map(item => item.signatory_id) });
      return json({ template: result.rows[0] });
    }

    return json({ error: 'Unsupported action' }, 400);
  } catch (error) {
    console.error('LexAMS signatory operation failed', { error });
    return json({ error: error instanceof Error ? error.message : 'Signatory operation failed' }, 500);
  }
};

export const config: Config = { path: '/api/signatories' };
