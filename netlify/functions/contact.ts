import type { Config } from '@netlify/functions';
import { Resend } from 'resend';
import { isPreviewDeployment, previewReadOnlyResponse } from './_shared/preview';

const CONTACT_RECIPIENT = 'lexographixplus@gmail.com';

function clean(value: unknown, maxLength: number) {
  return String(value || '').trim().slice(0, maxLength);
}

function validEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character] || character));
}

export default async (request: Request) => {
  if (request.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });
  if (isPreviewDeployment(request)) return previewReadOnlyResponse();
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return Response.json({ error: 'A valid contact message is required' }, { status: 400 });
  if (clean(body['bot-field'], 100)) return Response.json({ ok: true });

  const name = clean(body.name, 120);
  const email = clean(body.email, 254).toLowerCase();
  const organization = clean(body.organization, 160);
  const message = clean(body.message, 4000);
  if (!name || !validEmail(email) || message.length < 3) return Response.json({ error: 'Please provide your name, a valid email address and a message.' }, { status: 400 });

  const apiKey = Netlify.env.get('RESEND_API_KEY');
  if (!apiKey) {
    console.error('Contact form email is not configured');
    return Response.json({ error: 'Contact email is temporarily unavailable.' }, { status: 503 });
  }
  const from = Netlify.env.get('AUTH_EMAIL_FROM') || 'LexAMS <onboarding@resend.dev>';
  const resend = new Resend(apiKey);
  const sent = await resend.emails.send({
    from,
    to: CONTACT_RECIPIENT,
    replyTo: email,
    subject: `LexAMS contact enquiry from ${name}`,
    html: `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#122033"><h2 style="color:#002B54">New LexAMS contact enquiry</h2><p><strong>Name:</strong> ${escapeHtml(name)}</p><p><strong>Email:</strong> ${escapeHtml(email)}</p><p><strong>Organisation:</strong> ${escapeHtml(organization || 'Not provided')}</p><p><strong>Message:</strong></p><p style="white-space:pre-wrap">${escapeHtml(message)}</p></div>`,
  });
  if (sent.error) {
    console.error('Contact email delivery failed', sent.error);
    return Response.json({ error: 'Your message could not be delivered. Please try again.' }, { status: 502 });
  }
  return Response.json({ ok: true }, { status: 202 });
};

export const config: Config = { path: '/api/contact' };
