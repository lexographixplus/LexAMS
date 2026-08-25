import type { Config, Context } from '@netlify/functions';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { Resend } from 'resend';
import { getPool } from './_shared/db';

function env(name: string) {
  return Netlify.env.get(name);
}

function signatureIsValid(payload: string, signature: string, secret: string) {
  const calculated = createHmac('sha512', secret).update(payload).digest('hex');
  return calculated.length === signature.length && timingSafeEqual(Buffer.from(calculated), Buffer.from(signature));
}

function signatureMatchesAny(payload: string, signature: string, secrets: Array<string | undefined>) {
  return secrets.some(secret => Boolean(secret) && signatureIsValid(payload, signature, secret));
}

function validEmail(value: unknown): value is string {
  return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function escapeHtml(value: unknown) {
  return String(value || '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character] || character));
}

function formatAmount(amount: number, currency: string) {
  return `${currency} ${new Intl.NumberFormat('en-GM', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount)}`;
}

function pdfText(value: unknown, limit = 110) {
  return String(value || '')
    .replace(/[^\x20-\x7E]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, limit)
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

function createReceiptPdf({
  organizationName,
  planName,
  amount,
  currency,
  reference,
  paymentMethod,
  paidDate,
}: {
  organizationName: string;
  planName: string;
  amount: number;
  currency: string;
  reference: string;
  paymentMethod: string | null;
  paidDate: string;
}) {
  // Keep this generator dependency-free so billing webhooks remain lightweight.
  const receiptNumber = `RCPT-${reference}`;
  const total = formatAmount(amount, currency);
  const gateway = paymentMethod || 'Modem Pay';
  const stream = `q\n1 1 1 rg\n0 0 595 842 re f\n0.00 0.17 0.33 rg\n0 790 595 52 re f\n0.98 0.72 0.18 rg\n0 785 595 5 re f\nBT /F2 25 Tf 1 1 1 rg 44 808 Td (LexAMS) Tj ET\nBT /F1 8 Tf 0.82 0.89 0.95 rg 44 795 Td (A LexoGraphix Plus product) Tj ET\nQ\nBT /F2 26 Tf 0.00 0.17 0.33 rg 400 744 Td (RECEIPT) Tj ET\nBT /F1 9 Tf 0.35 0.40 0.48 rg 44 744 Td (LexAMS) Tj ET\nBT /F1 8 Tf 0.35 0.40 0.48 rg 44 728 Td (Banjul, The Gambia, West Africa) Tj ET\nBT /F1 8 Tf 0.35 0.40 0.48 rg 44 714 Td (billing@lexams.com) Tj ET\nBT /F1 8 Tf 0.35 0.40 0.48 rg 44 700 Td (https://lexams.com) Tj ET\nBT /F1 8 Tf 0.35 0.40 0.48 rg 400 714 Td (Receipt #) Tj ET\nBT /F2 9 Tf 0.00 0.17 0.33 rg 400 698 Td (${pdfText(receiptNumber, 34)}) Tj ET\n0.90 0.97 0.92 rg\n400 658 105 27 re f\nBT /F2 10 Tf 0.09 0.43 0.22 rg 431 667 Td (PAID) Tj ET\n0.93 0.94 0.95 rg\n44 606 507 1 re f\nBT /F2 10 Tf 0.00 0.17 0.33 rg 44 592 Td (RECEIVED FROM) Tj ET\nBT /F2 13 Tf 0.00 0.17 0.33 rg 44 574 Td (${pdfText(organizationName, 58)}) Tj ET\nBT /F1 8 Tf 0.35 0.40 0.48 rg 394 592 Td (Paid date) Tj ET\nBT /F2 9 Tf 0.00 0.17 0.33 rg 394 576 Td (${pdfText(paidDate, 28)}) Tj ET\nBT /F1 8 Tf 0.35 0.40 0.48 rg 394 548 Td (Payment reference) Tj ET\nBT /F2 8 Tf 0.00 0.17 0.33 rg 394 532 Td (${pdfText(reference, 30)}) Tj ET\n0.00 0.17 0.33 rg\n44 458 507 30 re f\nBT /F2 8 Tf 1 1 1 rg 54 469 Td (DESCRIPTION) Tj ET\nBT /F2 8 Tf 1 1 1 rg 372 469 Td (QTY) Tj ET\nBT /F2 8 Tf 1 1 1 rg 409 469 Td (UNIT PRICE) Tj ET\nBT /F2 8 Tf 1 1 1 rg 501 469 Td (TOTAL) Tj ET\n0.91 0.92 0.94 RG\n44 411 507 47 re S\nBT /F2 9 Tf 0.00 0.17 0.33 rg 54 435 Td (${pdfText(planName, 52)}) Tj ET\nBT /F1 9 Tf 0.00 0.17 0.33 rg 383 435 Td (1) Tj ET\nBT /F1 9 Tf 0.00 0.17 0.33 rg 421 435 Td (${pdfText(total, 20)}) Tj ET\nBT /F2 9 Tf 0.00 0.17 0.33 rg 501 435 Td (${pdfText(total, 20)}) Tj ET\nBT /F1 9 Tf 0.35 0.40 0.48 rg 378 386 Td (Subtotal) Tj ET\nBT /F2 9 Tf 0.00 0.17 0.33 rg 476 386 Td (${pdfText(total, 20)}) Tj ET\nBT /F2 11 Tf 0.00 0.17 0.33 rg 378 360 Td (TOTAL) Tj ET\nBT /F2 13 Tf 0.00 0.17 0.33 rg 469 360 Td (${pdfText(total, 20)}) Tj ET\n0.90 0.97 0.92 rg\n378 324 173 25 re f\nBT /F2 10 Tf 0.09 0.43 0.22 rg 486 333 Td (PAID) Tj ET\nBT /F2 11 Tf 0.00 0.17 0.33 rg 44 304 Td (TRANSACTION) Tj ET\n0.86 0.88 0.91 RG\n44 270 507 0.5 re S\nBT /F1 8 Tf 0.38 0.43 0.50 rg 52 280 Td (Transaction date) Tj ET\nBT /F2 8 Tf 0.00 0.17 0.33 rg 210 280 Td (${pdfText(paidDate, 40)}) Tj ET\n0.86 0.88 0.91 RG\n44 245 507 0.5 re S\nBT /F1 8 Tf 0.38 0.43 0.50 rg 52 255 Td (Gateway) Tj ET\nBT /F2 8 Tf 0.00 0.17 0.33 rg 210 255 Td (${pdfText(gateway, 45)}) Tj ET\n0.86 0.88 0.91 RG\n44 220 507 0.5 re S\nBT /F1 8 Tf 0.38 0.43 0.50 rg 52 230 Td (Transaction ID) Tj ET\nBT /F2 8 Tf 0.00 0.17 0.33 rg 210 230 Td (${pdfText(reference, 55)}) Tj ET\n0.86 0.88 0.91 RG\n44 195 507 0.5 re S\nBT /F1 8 Tf 0.38 0.43 0.50 rg 52 205 Td (Amount) Tj ET\nBT /F2 8 Tf 0.00 0.17 0.33 rg 210 205 Td (${pdfText(total, 22)}) Tj ET\nBT /F2 10 Tf 0.00 0.17 0.33 rg 44 157 Td (NOTES) Tj ET\nBT /F1 8 Tf 0.35 0.40 0.48 rg 44 139 Td (Payment received. This receipt confirms your LexAMS Pro subscription payment.) Tj ET\nBT /F1 8 Tf 0.35 0.40 0.48 rg 44 123 Td (Billing enquiries: billing@lexams.com) Tj ET\n0.93 0.94 0.95 rg\n44 91 507 1 re f\nBT /F2 8 Tf 0.00 0.17 0.33 rg 44 68 Td (Thank you for choosing LexAMS.) Tj ET\nBT /F1 7 Tf 0.42 0.47 0.54 rg 369 68 Td (LexAMS by LexoGraphix Plus | https://lexams.com) Tj ET`;
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>',
    `<< /Length ${Buffer.byteLength(stream, 'utf8')} >>\nstream\n${stream}\nendstream`,
  ];
  let output = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n';
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(output, 'binary'));
    output += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = Buffer.byteLength(output, 'binary');
  output += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map(offset => `${String(offset).padStart(10, '0')} 00000 n `).join('\n')}\ntrailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return Buffer.from(output, 'binary');
}

async function sendReceipt({
  receiptEventId,
  receiptTo,
  organizationName,
  billingCycle,
  amount,
  currency,
  reference,
  paymentMethod,
  paidAt,
}: {
  receiptEventId: string;
  receiptTo: string;
  organizationName: string;
  billingCycle: 'monthly' | 'annual';
  amount: number;
  currency: string;
  reference: string;
  paymentMethod: string | null;
  paidAt: string;
}) {
  const db = getPool();
  const apiKey = env('RESEND_API_KEY');
  if (!apiKey) {
    await db.query(`update billing_events set processing_status = 'failed', processed_at = now(), error_message = 'Receipt email is not configured' where id = $1`, [receiptEventId]);
    return;
  }

  const paidDate = new Intl.DateTimeFormat('en-GB', { dateStyle: 'long', timeStyle: 'short', timeZone: 'Africa/Banjul' }).format(new Date(paidAt));
  const planName = `LexAMS Pro - ${billingCycle === 'annual' ? 'Annual' : 'Monthly'} Subscription`;
  const receiptPdf = await createReceiptPdf({ organizationName, planName, amount, currency, reference, paymentMethod, paidDate });
  const result = await new Resend(apiKey).emails.send({
    from: env('AUTH_EMAIL_FROM') || 'LexAMS <onboarding@resend.dev>',
    to: receiptTo,
    subject: `LexAMS payment receipt - ${reference}`,
    html: `<div style="margin:0;padding:32px 16px;background:#f5f7fa;font-family:Arial,sans-serif;color:#122033"><div style="max-width:620px;margin:auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e3e8ee"><div style="padding:28px 32px;background:#002B54;color:#fff"><div style="font-size:24px;font-weight:700;letter-spacing:.2px">LexAMS</div><div style="margin-top:6px;color:#FAB72D;font-size:14px;font-weight:700">PAYMENT RECEIPT</div><div style="margin-top:10px;color:#dbe8f2;font-size:12px">Banjul, The Gambia, West Africa · https://lexams.com · billing@lexams.com</div></div><div style="padding:32px"><p style="margin:0 0 20px">Hello,</p><p style="margin:0 0 24px;line-height:1.6">Thank you. We have received payment from <strong>${escapeHtml(organizationName)}</strong> for <strong>${escapeHtml(planName)}</strong>. Your LexAMS Pro access is active.</p><p style="margin:0 0 22px;line-height:1.6"><strong>Your official LexAMS PDF receipt is attached.</strong></p><table style="width:100%;border-collapse:collapse;font-size:14px"><tr><td style="padding:10px 0;border-top:1px solid #e7ebf0;color:#64748b">Received from</td><td style="padding:10px 0;border-top:1px solid #e7ebf0;text-align:right;font-weight:600">${escapeHtml(organizationName)}</td></tr><tr><td style="padding:10px 0;border-top:1px solid #e7ebf0;color:#64748b">Payment for</td><td style="padding:10px 0;border-top:1px solid #e7ebf0;text-align:right;font-weight:600">${escapeHtml(planName)}</td></tr><tr><td style="padding:10px 0;border-top:1px solid #e7ebf0;color:#64748b">Amount received</td><td style="padding:10px 0;border-top:1px solid #e7ebf0;text-align:right;font-size:18px;font-weight:700;color:#002B54">${escapeHtml(formatAmount(amount, currency))}</td></tr><tr><td style="padding:10px 0;border-top:1px solid #e7ebf0;color:#64748b">Payment date</td><td style="padding:10px 0;border-top:1px solid #e7ebf0;text-align:right;font-weight:600">${escapeHtml(paidDate)}</td></tr><tr><td style="padding:10px 0;border-top:1px solid #e7ebf0;color:#64748b">Reference</td><td style="padding:10px 0;border-top:1px solid #e7ebf0;text-align:right;font-weight:600">${escapeHtml(reference)}</td></tr>${paymentMethod ? `<tr><td style="padding:10px 0;border-top:1px solid #e7ebf0;color:#64748b">Payment method</td><td style="padding:10px 0;border-top:1px solid #e7ebf0;text-align:right;font-weight:600">${escapeHtml(paymentMethod)}</td></tr>` : ''}</table><p style="margin:28px 0 0;line-height:1.6">For billing questions, contact <strong>billing@lexams.com</strong>.</p></div><div style="padding:16px 32px;background:#f8fafc;color:#64748b;font-size:12px">LexAMS by LexoGraphix Plus · Banjul, The Gambia, West Africa · https://lexams.com</div></div></div>`,
    attachments: [{ filename: `LexAMS-receipt-${pdfText(reference, 48) || 'payment'}.pdf`, content: receiptPdf }],
  });

  if (result.error) throw new Error(result.error.message || 'Receipt email delivery failed');
  await db.query(`update billing_events set processing_status = 'processed', processed_at = now() where id = $1`, [receiptEventId]);
}

export default async (request: Request, context: Context) => {
  if (request.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });
  const rawPayload = await request.text();
  const signature = request.headers.get('x-modem-signature');
  // A per-payment callback uses the merchant secret key (the server-side Modem
  // API key), while the dashboard's global webhook uses its own signing secret.
  // Accept either trusted signature so both delivery paths are safe and usable.
  const callbackSecret = env('MODEM_PAY_MERCHANT_SECRET_KEY') || env('MODEM_PAY_API_KEY');
  const webhookSecret = env('MODEM_PAY_WEBHOOK_SECRET') || env('MODEM_PAY_SECRET_HASH');
  if (!signature || !signatureMatchesAny(rawPayload, signature, [callbackSecret, webhookSecret])) {
    return Response.json({ error: 'Invalid webhook signature' }, { status: 400 });
  }

  let event: any;
  try { event = JSON.parse(rawPayload); }
  catch { return Response.json({ error: 'Invalid webhook data' }, { status: 400 }); }

  const payload = event?.payload || {};
  const eventType = String(event?.event || 'unknown');
  const providerEventId = String(payload.id || payload.transaction_reference || payload.payment_intent_id || '');
  if (!providerEventId) return Response.json({ error: 'Webhook event has no trusted payment identifier' }, { status: 400 });

  const db = getPool();
  const client = await db.connect();
  try {
    await client.query('begin');
    const received = await client.query(
      `insert into billing_events (provider, provider_event_id, event_type, processing_status, payload)
       values ('modempay',$1,$2,'received',$3::jsonb)
       on conflict (provider, provider_event_id) do update
         set processing_status = 'received', error_message = null
         where billing_events.processing_status = 'failed'
       returning id`,
      [providerEventId, eventType, JSON.stringify(event)]
    );
    if (!received.rowCount) {
      await client.query('commit');
      return Response.json({ received: true, duplicate: true });
    }
    const eventId = received.rows[0].id;
    if (eventType !== 'charge.succeeded' || payload.status !== 'completed') {
      await client.query(`update billing_events set processing_status = 'ignored', processed_at = now() where id = $1`, [eventId]);
      await client.query('commit');
      return Response.json({ received: true, ignored: true });
    }

    const invoiceId = payload?.metadata?.invoice_id;
    if (!invoiceId) throw new Error('Successful charge is missing LexAMS invoice metadata');
    const invoiceResult = await client.query(
      `select i.*, o.name as organization_name
       from billing_invoices i
       join organizations o on o.id = i.organization_id
       where i.id = $1 for update of i`,
      [invoiceId]
    );
    if (!invoiceResult.rowCount) throw new Error('No LexAMS invoice matches this payment');
    const invoice = invoiceResult.rows[0];
    if (Number(payload.amount) !== Number(invoice.amount) || payload.currency !== invoice.currency) {
      throw new Error('Payment amount or currency does not match the invoice');
    }

    const transaction = await client.query(
      `insert into billing_transactions (
         organization_id, invoice_id, provider, provider_transaction_id, amount, currency,
         status, payment_method, provider_reference, metadata, paid_at
       ) values ($1,$2,'modempay',$3,$4,$5,'paid',$6,$7,$8::jsonb,now())
       on conflict (provider, provider_transaction_id) do nothing returning id`,
      [invoice.organization_id, invoice.id, providerEventId, invoice.amount, invoice.currency, payload.payment_method || null, payload.transaction_reference || null, JSON.stringify({ payment_intent_id: payload.payment_intent_id || null })]
    );
    if (!transaction.rowCount) {
      await client.query(`update billing_events set processing_status = 'processed', processed_at = now() where id = $1`, [eventId]);
      await client.query('commit');
      return Response.json({ received: true, duplicate: true });
    }

    const billingCycle = invoice.metadata?.billing_cycle === 'annual' ? 'annual' : 'monthly';
    const interval = billingCycle === 'annual' ? '1 year' : '1 month';
    await client.query(`update billing_invoices set status = 'paid', paid_at = now(), updated_at = now() where id = $1`, [invoice.id]);
    await client.query(
      `update organization_subscriptions
       set plan = 'pro', status = 'active', billing_cycle = $2, provider = 'modempay', cancel_at_period_end = false,
           current_period_start = greatest(coalesce(current_period_end, now()), now()),
           current_period_end = greatest(coalesce(current_period_end, now()), now()) + $3::interval,
           grace_period_end = null, updated_at = now()
       where organization_id = $1`,
      [invoice.organization_id, billingCycle, interval]
    );
    const receiptRecipient = validEmail(payload.customer_email)
      ? payload.customer_email
      : validEmail(invoice.metadata?.receipt_recipient)
        ? invoice.metadata.receipt_recipient
        : null;
    let receiptEventId: string | null = null;
    if (receiptRecipient) {
      const receiptEvent = await client.query(
        `insert into billing_events (provider, provider_event_id, event_type, processing_status, payload)
         values ('manual',$1,'receipt.send','received',$2::jsonb)
         on conflict (provider, provider_event_id) do nothing
         returning id`,
        [`receipt-${transaction.rows[0].id}`, JSON.stringify({ invoice_id: invoice.id, transaction_id: transaction.rows[0].id, recipient: receiptRecipient })]
      );
      receiptEventId = receiptEvent.rows[0]?.id || null;
    }
    await client.query(`update billing_events set processing_status = 'processed', processed_at = now() where id = $1`, [eventId]);
    await client.query('commit');
    if (receiptEventId && receiptRecipient) {
      context.waitUntil(
        sendReceipt({
          receiptEventId,
          receiptTo: receiptRecipient,
          organizationName: invoice.organization_name,
          billingCycle,
          amount: Number(invoice.amount),
          currency: invoice.currency,
          reference: payload.transaction_reference || invoice.internal_reference,
          paymentMethod: payload.payment_method || null,
          paidAt: new Date().toISOString(),
        }).catch(async error => {
          console.error('Receipt email delivery failed', error);
          await getPool().query(
            `update billing_events set processing_status = 'failed', processed_at = now(), error_message = $2 where id = $1`,
            [receiptEventId, error instanceof Error ? error.message.slice(0, 1000) : 'Receipt email delivery failed']
          ).catch(() => undefined);
        })
      );
    }
    return Response.json({ received: true, processed: true });
  } catch (error) {
    await client.query('rollback').catch(() => undefined);
    console.error('Modem Pay webhook processing failed', error);
    await db.query(
      `insert into billing_events (provider, provider_event_id, event_type, processing_status, payload, error_message)
       values ('modempay',$1,$2,'failed',$3::jsonb,$4)
       on conflict (provider, provider_event_id) do update
         set processing_status = 'failed', error_message = excluded.error_message
         where billing_events.processing_status <> 'processed'`,
      [providerEventId, eventType, JSON.stringify(event), error instanceof Error ? error.message.slice(0, 1000) : 'Unknown webhook processing error']
    ).catch(() => undefined);
    return Response.json({ error: 'Webhook could not be processed' }, { status: 500 });
  } finally {
    client.release();
  }
};

export const config: Config = { path: '/api/billing/webhook' };
