import type { Config } from '@netlify/functions';
import { getPool } from './_shared/db';
import { requireTenant } from './_shared/tenant';

function formatAmount(amount: number, currency: string) {
  return `${currency} ${new Intl.NumberFormat('en-GM', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount)}`;
}

function formatDate(value: string | Date | null | undefined) {
  if (!value) return 'N/A';
  return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Africa/Banjul' }).format(new Date(value));
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

function makePdf({
  kind,
  organizationName,
  customerEmail,
  invoiceNumber,
  amount,
  currency,
  status,
  createdAt,
  paidAt,
  billingPeriodStart,
  billingPeriodEnd,
  paymentReference,
  paymentMethod,
  billingCycle,
}: {
  kind: 'invoice' | 'receipt';
  organizationName: string;
  customerEmail: string | null;
  invoiceNumber: string;
  amount: number;
  currency: string;
  status: string;
  createdAt: string;
  paidAt: string | null;
  billingPeriodStart: string | null;
  billingPeriodEnd: string | null;
  paymentReference: string | null;
  paymentMethod: string | null;
  billingCycle: 'monthly' | 'annual';
}) {
  const isReceipt = kind === 'receipt';
  const title = isReceipt ? 'RECEIPT' : 'INVOICE';
  const receiptNumber = `RCPT-${invoiceNumber}`;
  const documentNumber = isReceipt ? receiptNumber : invoiceNumber;
  const description = `LexAMS Pro - ${billingCycle === 'annual' ? 'Annual' : 'Monthly'} Subscription`;
  const period = `${formatDate(billingPeriodStart)} - ${formatDate(billingPeriodEnd)}`;
  const statusText = isReceipt ? 'PAID' : status.toUpperCase();
  const total = formatAmount(amount, currency);
  const paymentDate = formatDate(paidAt);
  const invoiceDate = formatDate(createdAt);

  const statusFill = statusText === 'PAID' ? '0.90 0.97 0.92' : statusText === 'FAILED' ? '0.98 0.91 0.90' : '1.00 0.95 0.82';
  const statusColor = statusText === 'PAID' ? '0.09 0.43 0.22' : statusText === 'FAILED' ? '0.65 0.13 0.10' : '0.48 0.33 0.05';

  const transactionRows = isReceipt
    ? [
        ['Transaction date', paymentDate],
        ['Gateway', paymentMethod || 'Modem Pay'],
        ['Transaction ID', paymentReference || 'N/A'],
        ['Amount', total],
      ]
    : [
        ['Payment terms', 'Due on receipt'],
        ['Gateway', 'Modem Pay'],
        ['Balance', total],
      ];

  const transactionContent = transactionRows.map(([label, value], index) => {
    const y = 276 - (index * 25);
    return `0.86 0.88 0.91 RG 44 ${y - 6} 507 0.5 re S\nBT /F1 8 Tf 0.38 0.43 0.50 rg 52 ${y + 4} Td (${pdfText(label, 28)}) Tj ET\nBT /F2 8 Tf 0.00 0.17 0.33 rg 210 ${y + 4} Td (${pdfText(value, 64)}) Tj ET`;
  }).join('\n');

  const billToEmail = customerEmail
    ? `BT /F1 9 Tf 0.35 0.40 0.48 rg 44 560 Td (${pdfText(customerEmail, 58)}) Tj ET`
    : '';

  const paidDateLine = isReceipt
    ? `BT /F1 8 Tf 0.35 0.40 0.48 rg 394 558 Td (Paid date) Tj ET\nBT /F2 9 Tf 0.00 0.17 0.33 rg 394 542 Td (${pdfText(paymentDate, 25)}) Tj ET`
    : `BT /F1 8 Tf 0.35 0.40 0.48 rg 394 558 Td (Terms) Tj ET\nBT /F2 9 Tf 0.00 0.17 0.33 rg 394 542 Td (Due on receipt) Tj ET`;

  const notes = isReceipt
    ? 'Payment received. This receipt confirms your LexAMS Pro subscription payment.'
    : 'Thank you for choosing LexAMS. Please complete payment using the secure Modem Pay checkout.';

  const stream = `q\n1 1 1 rg\n0 0 595 842 re f\n0.00 0.17 0.33 rg\n0 790 595 52 re f\n0.98 0.72 0.18 rg\n0 785 595 5 re f\nBT /F2 25 Tf 1 1 1 rg 44 808 Td (LexAMS) Tj ET\nBT /F1 8 Tf 0.82 0.89 0.95 rg 44 795 Td (A LexoGraphix Plus product) Tj ET\nQ\nBT /F2 26 Tf 0.00 0.17 0.33 rg 400 744 Td (${title}) Tj ET\nBT /F1 9 Tf 0.35 0.40 0.48 rg 44 744 Td (LexAMS) Tj ET\nBT /F1 8 Tf 0.35 0.40 0.48 rg 44 728 Td (Banjul, The Gambia, West Africa) Tj ET\nBT /F1 8 Tf 0.35 0.40 0.48 rg 44 714 Td (billing@lexams.com) Tj ET\nBT /F1 8 Tf 0.35 0.40 0.48 rg 44 700 Td (https://lexams.netlify.app) Tj ET\nBT /F1 8 Tf 0.35 0.40 0.48 rg 400 714 Td (${isReceipt ? 'Receipt #' : 'Invoice #'}) Tj ET\nBT /F2 10 Tf 0.00 0.17 0.33 rg 400 698 Td (${pdfText(documentNumber, 34)}) Tj ET\n${statusFill} rg\n400 658 105 27 re f\nBT /F2 10 Tf ${statusColor} rg 431 667 Td (${pdfText(statusText, 16)}) Tj ET\n0.93 0.94 0.95 rg\n44 606 507 1 re f\nBT /F2 10 Tf 0.00 0.17 0.33 rg 44 592 Td (${isReceipt ? 'RECEIVED FROM' : 'BILL TO'}) Tj ET\nBT /F2 13 Tf 0.00 0.17 0.33 rg 44 574 Td (${pdfText(organizationName, 58)}) Tj ET\n${billToEmail}\nBT /F1 8 Tf 0.35 0.40 0.48 rg 394 592 Td (Invoice date) Tj ET\nBT /F2 9 Tf 0.00 0.17 0.33 rg 394 576 Td (${pdfText(invoiceDate, 25)}) Tj ET\n${paidDateLine}\nBT /F1 8 Tf 0.35 0.40 0.48 rg 394 524 Td (Billing period) Tj ET\nBT /F2 8 Tf 0.00 0.17 0.33 rg 394 508 Td (${pdfText(period, 35)}) Tj ET\n0.00 0.17 0.33 rg\n44 458 507 30 re f\nBT /F2 8 Tf 1 1 1 rg 54 469 Td (DESCRIPTION) Tj ET\nBT /F2 8 Tf 1 1 1 rg 372 469 Td (QTY) Tj ET\nBT /F2 8 Tf 1 1 1 rg 409 469 Td (UNIT PRICE) Tj ET\nBT /F2 8 Tf 1 1 1 rg 501 469 Td (TOTAL) Tj ET\n0.91 0.92 0.94 RG\n44 411 507 47 re S\nBT /F2 9 Tf 0.00 0.17 0.33 rg 54 439 Td (${pdfText(description, 48)}) Tj ET\nBT /F1 7 Tf 0.35 0.40 0.48 rg 54 424 Td (${pdfText(period, 52)}) Tj ET\nBT /F1 9 Tf 0.00 0.17 0.33 rg 383 435 Td (1) Tj ET\nBT /F1 9 Tf 0.00 0.17 0.33 rg 421 435 Td (${pdfText(total, 20)}) Tj ET\nBT /F2 9 Tf 0.00 0.17 0.33 rg 501 435 Td (${pdfText(total, 20)}) Tj ET\nBT /F1 9 Tf 0.35 0.40 0.48 rg 378 386 Td (Subtotal) Tj ET\nBT /F2 9 Tf 0.00 0.17 0.33 rg 476 386 Td (${pdfText(total, 20)}) Tj ET\nBT /F2 11 Tf 0.00 0.17 0.33 rg 378 360 Td (TOTAL) Tj ET\nBT /F2 13 Tf 0.00 0.17 0.33 rg 469 360 Td (${pdfText(total, 20)}) Tj ET\n${isReceipt ? `0.90 0.97 0.92 rg\n378 324 173 25 re f\nBT /F2 10 Tf 0.09 0.43 0.22 rg 486 333 Td (PAID) Tj ET` : ''}\nBT /F2 11 Tf 0.00 0.17 0.33 rg 44 304 Td (${isReceipt ? 'TRANSACTION' : 'PAYMENT'}) Tj ET\n${transactionContent}\nBT /F2 10 Tf 0.00 0.17 0.33 rg 44 157 Td (NOTES) Tj ET\nBT /F1 8 Tf 0.35 0.40 0.48 rg 44 139 Td (${pdfText(notes, 98)}) Tj ET\nBT /F1 8 Tf 0.35 0.40 0.48 rg 44 123 Td (Billing enquiries: billing@lexams.com) Tj ET\n0.93 0.94 0.95 rg\n44 91 507 1 re f\nBT /F2 8 Tf 0.00 0.17 0.33 rg 44 68 Td (Thank you for choosing LexAMS.) Tj ET\nBT /F1 7 Tf 0.42 0.47 0.54 rg 346 68 Td (LexAMS by LexoGraphix Plus | https://lexams.netlify.app) Tj ET`;

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

export default async (request: Request) => {
  if (request.method !== 'GET') return Response.json({ error: 'Method not allowed' }, { status: 405 });
  const tenant = await requireTenant(request);
  if (!tenant) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(request.url);
  const invoiceId = url.searchParams.get('id');
  const kind = url.searchParams.get('type') === 'receipt' ? 'receipt' : 'invoice';
  if (!invoiceId) return Response.json({ error: 'Invoice id is required' }, { status: 400 });

  const result = await getPool().query(
    `select i.*, o.name as organization_name,
            t.provider_reference, t.payment_method
     from billing_invoices i
     join organizations o on o.id = i.organization_id
     left join lateral (
       select provider_reference, payment_method
       from billing_transactions
       where invoice_id = i.id and status = 'paid'
       order by paid_at desc nulls last, created_at desc
       limit 1
     ) t on true
     where i.id = $1 and i.organization_id = $2`,
    [invoiceId, tenant.organization_id]
  );
  if (!result.rowCount) return Response.json({ error: 'Invoice not found' }, { status: 404 });

  const invoice = result.rows[0];
  if (kind === 'receipt' && invoice.status !== 'paid') {
    return Response.json({ error: 'A receipt is available only after payment is confirmed' }, { status: 409 });
  }

  const billingCycle = invoice.metadata?.billing_cycle === 'annual' ? 'annual' : 'monthly';
  const pdf = makePdf({
    kind,
    organizationName: invoice.organization_name,
    customerEmail: invoice.metadata?.receipt_recipient || null,
    invoiceNumber: invoice.internal_reference,
    amount: Number(invoice.amount),
    currency: invoice.currency,
    status: invoice.status,
    createdAt: invoice.created_at,
    paidAt: invoice.paid_at,
    billingPeriodStart: invoice.billing_period_start,
    billingPeriodEnd: invoice.billing_period_end,
    paymentReference: invoice.provider_reference,
    paymentMethod: invoice.payment_method,
    billingCycle,
  });
  const filename = `${kind === 'receipt' ? 'LexAMS-receipt' : 'LexAMS-invoice'}-${invoice.internal_reference}.pdf`;
  return new Response(pdf, {
    status: 200,
    headers: {
      'content-type': 'application/pdf',
      'content-disposition': `inline; filename="${filename}"`,
      'cache-control': 'private, no-store',
      'x-content-type-options': 'nosniff',
    },
  });
};

export const config: Config = { path: '/api/billing/document' };
