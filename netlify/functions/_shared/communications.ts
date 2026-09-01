import { Resend } from 'resend';

export type OutboundEmail = {
  to: string;
  subject: string;
  html: string;
  replyTo?: string | null;
};

function envValue(name: string) {
  try {
    const value = typeof Netlify !== 'undefined' ? Netlify.env.get(name) : undefined;
    if (value) return value;
  } catch {
    // Fall through to process.env for local and test environments.
  }
  return process.env[name];
}

export function communicationsFrom() {
  return envValue('COMMUNICATION_EMAIL_FROM') || envValue('AUTH_EMAIL_FROM') || 'LexAMS <onboarding@resend.dev>';
}

export function appBaseUrl(request?: Request) {
  const configured = envValue('APP_URL') || envValue('LEXAMS_APP_URL') || envValue('URL');
  if (configured) return configured.replace(/\/$/, '');
  if (request) return new URL(request.url).origin;
  return '';
}

export function resendApiKey() {
  const key = envValue('RESEND_API_KEY');
  if (!key) throw new Error('RESEND_API_KEY is not configured');
  return key;
}

export function resendWebhookSecret() {
  return envValue('RESEND_WEBHOOK_SECRET') || '';
}

function resendClient() {
  return new Resend(resendApiKey());
}

export function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function bodyHtml(body: string) {
  return escapeHtml(body)
    .split(/\n{2,}/)
    .map(paragraph => `<p style="margin:0 0 16px;line-height:1.65;color:#334155;font-size:15px">${paragraph.replaceAll('\n', '<br>')}</p>`)
    .join('');
}

export function brandedEmail(args: {
  organizationName: string;
  logoUrl?: string | null;
  preview: string;
  heading: string;
  body: string;
  ctaLabel?: string;
  ctaUrl?: string;
  footer?: string;
}) {
  const logo = args.logoUrl
    ? `<img src="${escapeHtml(args.logoUrl)}" alt="${escapeHtml(args.organizationName)}" style="max-height:56px;max-width:180px;display:block;margin:0 auto 16px" />`
    : '';
  const cta = args.ctaLabel && args.ctaUrl
    ? `<p style="margin:26px 0"><a href="${escapeHtml(args.ctaUrl)}" style="display:inline-block;background:#002B54;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:700">${escapeHtml(args.ctaLabel)}</a></p>`
    : '';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(args.heading)}</title></head><body style="margin:0;background:#f4f7fa;font-family:Arial,Helvetica,sans-serif"><div style="display:none;max-height:0;overflow:hidden">${escapeHtml(args.preview)}</div><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f7fa;padding:28px 12px"><tr><td align="center"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#ffffff;border:1px solid #dbe3ec;border-radius:14px"><tr><td style="padding:32px">${logo}<div style="text-align:center;font-size:13px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#0E4C8F">${escapeHtml(args.organizationName)}</div><h1 style="margin:14px 0 22px;text-align:center;color:#002B54;font-size:25px;line-height:1.25">${escapeHtml(args.heading)}</h1>${bodyHtml(args.body)}${cta}<hr style="border:0;border-top:1px solid #e4eaf0;margin:28px 0 18px"><p style="margin:0;color:#718096;font-size:12px;line-height:1.55">${escapeHtml(args.footer || `Sent through LexAMS on behalf of ${args.organizationName}.`)}</p></td></tr></table></td></tr></table></body></html>`;
}

export async function sendEmailBatch(emails: OutboundEmail[], idempotencyKeyBase?: string) {
  const valid = emails.filter(email => email.to && email.to.includes('@'));
  if (!valid.length) return { sent: 0, ids: [] as string[] };
  const resend = resendClient();
  let sent = 0;
  const ids: string[] = [];
  for (let offset = 0; offset < valid.length; offset += 100) {
    const chunk = valid.slice(offset, offset + 100).map(email => ({
      from: communicationsFrom(),
      to: email.to,
      subject: email.subject,
      html: email.html,
      ...(email.replyTo ? { replyTo: email.replyTo } : {}),
    }));
    const key = idempotencyKeyBase ? `${idempotencyKeyBase}:${offset}`.slice(0, 256) : null;
    const result = key
      ? await resend.batch.send(chunk, { idempotencyKey: key })
      : await resend.batch.send(chunk);
    if (result.error) throw new Error(result.error.message || 'Email delivery failed');
    // The Resend SDK wraps the provider payload in `result.data`, while the
    // batch endpoint itself returns a second `data` array. Keep the fallback
    // for older SDK responses that exposed the array directly.
    const providerPayload = result.data as unknown;
    const batchItems = Array.isArray(providerPayload)
      ? providerPayload
      : providerPayload && typeof providerPayload === 'object' && Array.isArray((providerPayload as { data?: unknown }).data)
        ? (providerPayload as { data: unknown[] }).data
        : [];
    const batchIds = batchItems
      .map(item => (item && typeof item === 'object' ? (item as { id?: unknown }).id : undefined))
      .filter((id): id is string => typeof id === 'string' && Boolean(id));
    if (batchIds.length !== chunk.length) throw new Error('Email provider did not return an id for every message');
    ids.push(...batchIds);
    sent += chunk.length;
  }
  return { sent, ids };
}
