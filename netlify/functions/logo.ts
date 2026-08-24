import type { Config } from '@netlify/functions';
import { getStore } from '@netlify/blobs';
import { requireTenant } from './_shared/tenant';

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
}

export default async (request: Request) => {
  const url = new URL(request.url);
  const store = getStore({ name: 'lexams-branding', consistency: 'strong' });

  if (request.method === 'GET') {
    const key = url.searchParams.get('key');
    if (!key || !key.startsWith('organizations/')) return json({ error: 'Invalid logo key' }, 400);
    const result = await store.getWithMetadata(key, { type: 'arrayBuffer' });
    if (!result) return new Response('Not found', { status: 404 });
    return new Response(result.data, {
      status: 200,
      headers: {
        'content-type': String(result.metadata?.contentType || 'application/octet-stream'),
        'cache-control': 'public, max-age=3600, stale-while-revalidate=86400',
      },
    });
  }

  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const tenant = await requireTenant(request);
  if (!tenant) return json({ error: 'Unauthorized' }, 401);
  if (!['owner', 'admin'].includes(tenant.role)) return json({ error: 'Admin permission required' }, 403);

  const form = await request.formData();
  const file = form.get('file');
  if (!(file instanceof File)) return json({ error: 'Image file is required' }, 400);
  if (!file.type.startsWith('image/')) return json({ error: 'Only image files are allowed' }, 400);
  if (file.size > 2 * 1024 * 1024) return json({ error: 'Logo must be under 2MB' }, 400);

  const safeExt = (file.name.split('.').pop() || 'img').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  const key = `organizations/${tenant.organization_id}/logo.${safeExt}`;
  const buffer = await file.arrayBuffer();
  await store.set(key, buffer, { metadata: { contentType: file.type, uploadedAt: new Date().toISOString() } });

  const publicUrl = `${url.origin}/api/logo?key=${encodeURIComponent(key)}`;
  return json({ key, publicUrl });
};

export const config: Config = { path: '/api/logo', method: ['GET', 'POST'] };
