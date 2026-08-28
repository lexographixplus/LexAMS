import type { Config, Context } from '@netlify/functions';
import { getStore } from '@netlify/blobs';
import { getPool } from './_shared/db';

export default async (_request: Request, context: Context) => {
  const token = String(context.params.token || '');
  const slot = Number(context.params.slot);
  if (!token || !Number.isSafeInteger(slot) || slot < 0 || slot > 3) {
    return new Response('Invalid certificate signature', { status: 400 });
  }

  const db = getPool();
  const result = await db.query(
    `select metadata from certificates where access_token=$1 limit 1`,
    [token]
  );
  if (!result.rowCount) return new Response('Not found', { status: 404 });

  const metadata = result.rows[0]?.metadata || {};
  const signatories = Array.isArray(metadata.signatories) ? metadata.signatories : [];
  const signatory = signatories[slot];
  if (!signatory || signatory.show_signature === false || signatory.signature_mode !== 'uploaded' || !signatory.signature_key) {
    return new Response('Not found', { status: 404 });
  }

  const store = getStore({ name: 'lexams-signatures', consistency: 'strong' });
  const blob = await store.getWithMetadata(String(signatory.signature_key), { type: 'arrayBuffer' });
  if (!blob) return new Response('Not found', { status: 404 });

  return new Response(blob.data, {
    status: 200,
    headers: {
      'content-type': String(signatory.signature_content_type || blob.metadata?.contentType || 'application/octet-stream'),
      'cache-control': 'private, max-age=300',
      'x-content-type-options': 'nosniff',
    },
  });
};

export const config: Config = { path: '/api/public-certificate-signature/:token/:slot', method: ['GET'] };
