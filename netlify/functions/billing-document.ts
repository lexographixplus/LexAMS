import type { Config } from '@netlify/functions';
import { getPool } from './_shared/db';
import { requireTenant } from './_shared/tenant';

function formatAmount(amount: number, currency: string) {
  return `${currency} ${new Intl.NumberFormat('en-GM', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(amount)}`;
}

function formatDate(value: string | Date | null | undefined) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Africa/Banjul' }).format(new Date(value));
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
  const title = isReceipt ? 'PAYMENT RECEIPT' : 'INVOICE';
  const documentNumber = isReceipt ? `RCPT-${invoiceNumber}` : invoiceNumber;
  const plan = `LexAMS Pro - ${billingCycle === 'annual' ? 'Annual' : 'Monthly'} subscription`;
  const dateLabel = isReceipt ? 'Payment date' : 'Invoice date';
  const documentDate = isReceipt ? formatDate(paidAt) : formatDate(createdAt);
  const period = `${formatDate(billingPeriodStart)} to ${formatDate(billingPeriodEnd)}`;
  const rows = [
    [isReceipt ? 'Received from' : 'Bill to', organizationName],
    ['Payment for', plan],
    ['Billing period', period],
    [isReceipt ? 'Amount received' : 'Amount due', formatAmount(amount, currency)],
    [dateLabel, documentDate],
    ['Invoice number', invoiceNumber],
    ...(isReceipt ? [['Receipt number', documentNumber]] : []),
    ...(paymentReference ? [['Payment reference', paymentReference]] : []),
    ...(paymentMethod ? [['Payment method', paymentMethod]] : []),
  ] as Array<[string, string]>;

  const rowContent = rows.map(([label, value], index) => {
    const y = 548 - (index * 37);
    return `0.92 0.94 0.96 RG 44 ${y - 7} 507 0.7 re S\nBT /F1 9 Tf 0.34 0.42 0.50 rg 52 ${y + 8} Td (${pdfText(label, 34)}) Tj ET\nBT /F2 9 Tf 0.00 0.17 0.33 rg 240 ${y + 8} Td (${pdfText(value, 74)}) Tj ET`;
  }).join('\n');

  const statusText = isReceipt ? 'PAID' : status.toUpperCase();
  const statusFill = isReceipt ? '0.90 0.97 0.92' : '0.98 0.95 0.87';
  const statusColor = isReceipt ? '0.09 0.43 0.22' : '0.48 0.33 0.05';
  const footerText = isReceipt
    ? 'This receipt confirms payment received for the LexAMS service described above.'
    : 'Please retain this invoice for your records. Payment is processed securely through Modem Pay.';

  const stream = `q\n0.00 0.17 0.33 rg\n0 706 595 136 re f\n0.98 0.72 0.18 rg\n44 730 100 4 re f\nBT /F2 28 Tf 1 1 1 rg 44 788 Td (LexAMS) Tj ET\nBT /F2 11 Tf 0.98 0.72 0.18 rg 44 766 Td (${title}) Tj ET\nBT /F1 9 Tf 0.86 0.91 0.96 rg 44 742 Td (https://lexams.com) Tj ET\nBT /F1 9 Tf 0.86 0.91 0.96 rg 44 727 Td (billing@lexams.com) Tj ET\nBT /F1 8 Tf 0.70 0.80 0.89 rg 393 788 Td (LexAMS by LexoGraphix Plus) Tj ET\nBT /F1 8 Tf 0.70 0.80 0.89 rg 393 772 Td (Banjul, The Gambia, West Africa) Tj ET\nQ\nBT /F2 10 Tf 0.34 0.42 0.50 rg 44 675 Td (Document number) Tj ET\nBT /F2 14 Tf 0.00 0.17 0.33 rg 44 654 Td (${pdfText(documentNumber, 60)}) Tj ET\n${statusFill} rg\n438 648 113 30 re f\nBT /F2 10 Tf ${statusColor} rg 467 659 Td (${pdfText(statusText, 18)}) Tj ET\nBT /F2 18 Tf 0.00 0.17 0.33 rg 44 603 Td (${isReceipt ? 'Payment received' : 'Invoice details'}) Tj ET\nBT /F1 10 Tf 0.34 0.42 0.50 rg 44 582 Td (${isReceipt ? 'Thank you. Your LexAMS Pro access has been confirmed.' : 'Professional subscription billing statement.'}) Tj ET\n${rowContent}\n0.98 0.95 0.87 rg\n44 122 507 78 re f\nBT /F2 10 Tf 0.36 0.28 0.08 rg 58 177 Td (Billing contact) Tj ET\nBT /F1 9 Tf 0.36 0.28 0.08 rg 58 159 Td (billing@lexams.com  |  https://lexams.com) Tj ET\nBT /F1 8 Tf 0.36 0.28 0.08 rg 58 144 Td (Banjul, The Gambia, West Africa) Tj ET\nBT /F1 8 Tf 0.36 0.28 0.08 rg 58 129 Td (${pdfText(footerText, 96)}) Tj ET\nBT /F1 8 Tf 0.42 0.49 0.56 rg 44 62 Td (LexAMS  |  CREATE | PUBLISH | DIGITIZE | GROW) Tj ET`;

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
