import ReportsV2 from './ReportsV2';
import { getReportPreviewAdvanced, isReportingPreviewDemo } from '../lib/reportPreviewDemo';

const FLAG = '__lexamsReportingPreviewFetchInstalled';

function csvCell(value) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

function previewCsv(type, advanced) {
  if (type === 'surveys') {
    const rows = [
      ['Survey', 'Activity', 'Respondent', 'Email', 'Answered', 'Submitted'],
      ...advanced.surveys.responseRecords.map(row => [row.survey, row.activity, row.respondent, row.email, row.answered, row.submittedAt]),
    ];
    return rows.map(row => row.map(csvCell).join(',')).join('\r\n');
  }

  const rows = [
    ['Assessment', 'Activity', 'Type', 'Respondent', 'Score (%)', 'Result', 'Submitted'],
    ...advanced.assessments.submissionRecords.map(row => [row.assessment, row.activity, row.type, row.respondent, row.percentage, row.passed ? 'Passed' : 'Not passed', row.submittedAt]),
  ];
  return rows.map(row => row.map(csvCell).join(',')).join('\r\n');
}

function installReportingPreviewFetch() {
  if (!isReportingPreviewDemo() || window[FLAG]) return;
  window[FLAG] = true;

  const originalFetch = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const rawUrl = typeof input === 'string' ? input : input?.url || '';
    const url = new URL(rawUrl, window.location.origin);
    const onReportsRoute = window.location.pathname === '/app/reports';

    if (onReportsRoute && url.pathname === '/api/report-analytics') {
      const filters = Object.fromEntries(url.searchParams.entries());
      const advanced = getReportPreviewAdvanced(filters);
      const format = url.searchParams.get('format');
      const type = url.searchParams.get('type') || 'surveys';

      if (format === 'csv') {
        return new Response('\ufeff' + previewCsv(type, advanced), {
          status: 200,
          headers: {
            'content-type': 'text/csv; charset=utf-8',
            'content-disposition': `attachment; filename="lexams-${type}-preview-demo.csv"`,
            'cache-control': 'no-store',
          },
        });
      }

      return new Response(JSON.stringify(advanced), {
        status: 200,
        headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
      });
    }

    if (onReportsRoute && url.pathname === '/api/billing/plan') {
      const response = await originalFetch(input, init);
      const body = await response.json().catch(() => ({}));
      return new Response(JSON.stringify({
        ...body,
        subscription: { ...(body.subscription || {}), plan: 'pro' },
        entitlements: { ...(body.entitlements || {}), csvExport: true },
        previewDemo: true,
      }), {
        status: 200,
        headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
      });
    }

    return originalFetch(input, init);
  };
}

installReportingPreviewFetch();

export default function ReportsPreview() {
  const demo = isReportingPreviewDemo();
  return <>
    {demo && <div style={{ marginBottom: 14, padding: '11px 14px', border: '1px solid var(--border-default)', borderRadius: 12, background: 'var(--surface-muted)', fontSize: 12, lineHeight: 1.5, color: 'var(--text-secondary)' }}><strong style={{ color: 'var(--color-navy-900)' }}>Preview demo mode:</strong> real preview records are mixed with synthetic programme, participant, attendance, survey, assessment and certificate data. Demo records exist only in this browser preview and are never written to Neon.</div>}
    <ReportsV2 />
  </>;
}
