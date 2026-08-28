import { useCallback, useEffect, useMemo, useState } from 'react';
import { Award, ChevronLeft, ChevronRight, Download, Eye, Mail, Plus, RefreshCw, Search, Send, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';
import { fmtDate } from '../lib/format';
import { isReportingPreviewDemo, reportPreviewDemo } from '../lib/reportPreviewDemo';
import { isRecognitionCertificate } from '../../shared/recognition.js';
import './AwardsRecognitionPanel.css';

const PAGE_SIZE = 25;
const EMPTY_FILTERS = { search: '', status: '', activityId: '', dateFrom: '', dateTo: '' };

function today() { return new Date().toISOString().slice(0, 10); }

async function request(url, options = {}) {
  const response = await fetch(url, {
    credentials: 'include',
    ...options,
    headers: { ...(options.body ? { 'content-type': 'application/json' } : {}), ...(options.headers || {}) },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || `Request failed (${response.status})`);
  return body;
}

function csvCell(value) {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function downloadCsv(rows) {
  const headings = ['Certificate', 'Recipient', 'Email', 'Award', 'Category', 'Activity', 'Period', 'Issued', 'Status', 'Delivery'];
  const values = rows.map(row => [
    row.cert_no, row.display_recipient_name, row.display_recipient_email, row.award_title,
    row.award_category, row.activity_title, row.award_period, row.issued_date, row.status,
    row.delivery_status || 'Not sent',
  ]);
  const blob = new Blob([[headings, ...values].map(row => row.map(csvCell).join(',')).join('\n')], { type: 'text/csv;charset=utf-8' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `recognition-history-${today()}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}

function Dialog({ title, children, confirmLabel, danger = false, busy, confirmDisabled = false, onConfirm, onClose }) {
  return <div className="awards-dialog-backdrop" role="presentation" onMouseDown={event => event.target === event.currentTarget && onClose()}>
    <section className="awards-dialog" role="dialog" aria-modal="true" aria-labelledby="awards-dialog-title">
      <div className="awards-dialog__header"><h4 id="awards-dialog-title">{title}</h4><button className="icon-button" aria-label="Close dialog" onClick={onClose}><X size={17}/></button></div>
      <div className="awards-dialog__body">{children}</div>
      <div className="awards-dialog__actions"><button className="button secondary" onClick={onClose}>Cancel</button><button className={`button ${danger ? 'danger' : 'primary'}`} disabled={busy || confirmDisabled} onClick={onConfirm}>{busy ? 'Working…' : confirmLabel}</button></div>
    </section>
  </div>;
}

function StatusPill({ children, tone = '' }) { return <span className={`awards-pill ${tone}`}>{children}</span>; }

function previewHistory(filters = EMPTY_FILTERS) {
  return reportPreviewDemo.certificates.filter(isRecognitionCertificate).map(certificate => {
    const participant = reportPreviewDemo.participants.find(item => item.id === certificate.participant_id);
    const activity = reportPreviewDemo.activities.find(item => item.id === certificate.activity_id);
    return { ...certificate, display_recipient_name: participant?.name, display_recipient_email: participant?.email, activity_title: activity?.title, delivery_status: certificate.id === -8508 ? 'delivered' : null };
  }).filter(row => {
    const search = filters.search.toLowerCase();
    const matchesSearch = !search || [row.cert_no, row.display_recipient_name, row.display_recipient_email, row.award_title, row.award_category].some(value => String(value || '').toLowerCase().includes(search));
    const matchesActivity = !filters.activityId || (filters.activityId === 'standalone' ? !row.activity_id : String(row.activity_id) === filters.activityId);
    return matchesSearch && matchesActivity && (!filters.status || row.status === filters.status) && (!filters.dateFrom || row.issued_date >= filters.dateFrom) && (!filters.dateTo || row.issued_date <= filters.dateTo);
  });
}

export default function AwardsRecognitionPanel() {
  const { isPro, isAdmin } = useAuth();
  const { activities, participants, refetch } = useData();
  const previewReadOnly = isReportingPreviewDemo();
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const initialParticipantId = Number(params.get('awardParticipant'));
  const initialActivityId = Number(params.get('awardActivity'));
  const [view, setView] = useState(params.has('awardParticipant') || params.has('awardActivity') ? 'issue' : 'history');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [templates, setTemplates] = useState([]);
  const [awards, setAwards] = useState([]);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, pageSize: PAGE_SIZE, total: 0, totalPages: 1 });
  const [draftFilters, setDraftFilters] = useState(EMPTY_FILTERS);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [selectedAwards, setSelectedAwards] = useState(new Set());
  const [participantSearch, setParticipantSearch] = useState('');
  const [selectedParticipants, setSelectedParticipants] = useState(() => Number.isSafeInteger(initialParticipantId) && initialParticipantId > 0 ? new Set([initialParticipantId]) : new Set());
  const [manualName, setManualName] = useState('');
  const [manualEmail, setManualEmail] = useState('');
  const [manualRecipients, setManualRecipients] = useState([]);
  const [templateDraft, setTemplateDraft] = useState({ name: '', certificateTitle: '', category: '', citationTemplate: '' });
  const [form, setForm] = useState({ activityId: Number.isSafeInteger(initialActivityId) && initialActivityId > 0 ? String(initialActivityId) : '', templateId: '', awardTitle: 'Trainee of the Week', awardCategory: 'Performance', awardPeriod: '', citation: 'In recognition of outstanding performance, participation and commitment.', issuedDate: today(), certificateType: 'recognition', emailNow: false });
  const [dialog, setDialog] = useState(null);

  const historyQuery = useCallback((targetPage = page, targetFilters = filters, pageSize = PAGE_SIZE) => {
    const query = new URLSearchParams({ page: String(targetPage), pageSize: String(pageSize) });
    Object.entries(targetFilters).forEach(([key, value]) => value && query.set(key, value));
    return `/api/awards?${query}`;
  }, [filters, page]);

  const load = useCallback(async (targetPage = page, targetFilters = filters) => {
    setLoading(true); setError('');
    try {
      if (previewReadOnly) {
        const rows = previewHistory(targetFilters);
        setTemplates([{ id: -1, name: 'Outstanding Performance', certificate_title: 'Outstanding Project Award', category: 'Performance', active: true }]);
        setAwards(rows.slice((targetPage - 1) * PAGE_SIZE, targetPage * PAGE_SIZE));
        setPagination({ page: targetPage, pageSize: PAGE_SIZE, total: rows.length, totalPages: Math.max(1, Math.ceil(rows.length / PAGE_SIZE)) });
        setSelectedAwards(new Set());
        return;
      }
      const data = await request(historyQuery(targetPage, targetFilters));
      setTemplates(data.templates || []); setAwards(data.awards || []);
      setPagination(data.pagination || { page: targetPage, pageSize: PAGE_SIZE, total: data.awards?.length || 0, totalPages: 1 });
      setSelectedAwards(new Set());
    } catch (loadError) { setError(loadError.message); }
    finally { setLoading(false); }
  }, [filters, historyQuery, page, previewReadOnly]);

  // The effect intentionally synchronizes this view with its server-backed page and filters.
  // oxlint-disable-next-line react/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  const visibleParticipants = useMemo(() => {
    const search = participantSearch.trim().toLowerCase();
    return participants.filter(item => !search || [item.name, item.email, item.org, item.category].some(value => String(value || '').toLowerCase().includes(search))).slice(0, 100);
  }, [participantSearch, participants]);
  const selectedCount = selectedParticipants.size + manualRecipients.length;
  const selectedRows = awards.filter(row => selectedAwards.has(row.id));

  function patchForm(key, value) { setForm(current => ({ ...current, [key]: value })); }
  function applyTemplate(templateId) {
    const template = templates.find(item => String(item.id) === String(templateId));
    setForm(current => ({ ...current, templateId, ...(template ? { awardTitle: template.certificate_title || template.name, awardCategory: template.category || '', citation: template.citation_template || current.citation } : {}) }));
  }
  function toggleParticipant(id) { setSelectedParticipants(current => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; }); }
  function toggleAward(id) { setSelectedAwards(current => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; }); }
  function addManualRecipient() {
    if (!manualName.trim()) return;
    setManualRecipients(current => [...current, { id: crypto.randomUUID(), name: manualName.trim(), email: manualEmail.trim().toLowerCase() }]);
    setManualName(''); setManualEmail('');
  }
  function applyFilters(event) { event.preventDefault(); setPage(1); setFilters(draftFilters); }
  function clearFilters() { setDraftFilters(EMPTY_FILTERS); setFilters(EMPTY_FILTERS); setPage(1); }

  async function createTemplate() {
    if (previewReadOnly || busy || !templateDraft.name.trim()) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const data = await request('/api/awards', { method: 'POST', body: JSON.stringify({ action: 'create_template', ...templateDraft }) });
      setTemplates(current => [...current, data.template].sort((a, b) => a.name.localeCompare(b.name)));
      setTemplateDraft({ name: '', certificateTitle: '', category: '', citationTemplate: '' }); setNotice('Award template saved.');
    } catch (actionError) { setError(actionError.message); } finally { setBusy(false); }
  }

  async function toggleTemplate(template) {
    setBusy(true); setError('');
    try {
      const data = await request('/api/awards', { method: 'POST', body: JSON.stringify({ action: 'set_template_active', templateId: template.id, active: !template.active }) });
      setTemplates(current => current.map(item => item.id === template.id ? data.template : item));
    } catch (actionError) { setError(actionError.message); } finally { setBusy(false); }
  }

  async function issueAward() {
    setBusy(true); setError(''); setNotice('');
    try {
      const data = await request('/api/awards', { method: 'POST', body: JSON.stringify({ action: 'issue_award', participantIds: [...selectedParticipants], manualRecipients: manualRecipients.map(({ name, email }) => ({ name, email })), activityId: form.activityId || null, templateId: form.templateId || null, awardTitle: form.awardTitle, awardCategory: form.awardCategory, awardPeriod: form.awardPeriod, citation: form.citation, issuedDate: form.issuedDate, certificateType: form.certificateType }) });
      if (form.emailNow && data.certificates?.length) {
        const certificateIds = data.certificates.filter((certificate, index) => !data.delivery?.[index]?.sent).map(certificate => certificate.id);
        if (certificateIds.length) await request('/api/award-delivery', { method: 'POST', body: JSON.stringify({ certificateIds }) });
      }
      setNotice(`${data.certificates?.length || 0} recognition certificate${data.certificates?.length === 1 ? '' : 's'} issued${form.emailNow ? ' and delivery processed' : ''}.`);
      setDialog(null); setSelectedParticipants(new Set()); setManualRecipients([]); setView('history'); setPage(1);
      await Promise.all([load(1, filters), refetch()]);
    } catch (actionError) { setError(actionError.message); } finally { setBusy(false); }
  }

  async function sendCertificates(certificateIds) {
    setBusy(true); setError(''); setNotice('');
    try {
      const data = await request('/api/award-delivery', { method: 'POST', body: JSON.stringify({ certificateIds }) });
      setNotice(`${data.sent || 0} certificate email${data.sent === 1 ? '' : 's'} sent${data.skipped?.length ? `; ${data.skipped.length} skipped` : ''}.`);
      await load();
    } catch (actionError) { setError(actionError.message); } finally { setBusy(false); }
  }

  async function performCertificateAction() {
    setBusy(true); setError(''); setNotice('');
    try {
      const action = dialog.type;
      await request('/api/awards', { method: 'POST', body: JSON.stringify({ action, certificateId: dialog.row.id, ...(action === 'revoke' ? { reason: dialog.reason } : {}) }) });
      setNotice(action === 'revoke' ? 'Certificate revoked. Its verification record remains in the audit trail.' : 'Replacement certificate issued; the previous certificate is marked superseded.');
      setDialog(null); await Promise.all([load(), refetch()]);
    } catch (actionError) { setError(actionError.message); } finally { setBusy(false); }
  }

  async function exportHistory() {
    setBusy(true); setError('');
    try {
      if (previewReadOnly) {
        const rows = previewHistory(filters); downloadCsv(rows); setNotice(`${rows.length} recognition records exported.`); return;
      }
      const first = await request(historyQuery(1, filters, 100));
      const rows = [...(first.awards || [])];
      for (let nextPage = 2; nextPage <= (first.pagination?.totalPages || 1); nextPage += 1) rows.push(...((await request(historyQuery(nextPage, filters, 100))).awards || []));
      downloadCsv(rows); setNotice(`${rows.length} recognition record${rows.length === 1 ? '' : 's'} exported.`);
    } catch (actionError) { setError(actionError.message); } finally { setBusy(false); }
  }

  const activeTemplates = templates.filter(item => item.active);

  return <section id="awards-recognition" className="awards-panel">
    <header className="awards-panel__header">
      <div><div className="awards-title"><Award size={21}/><h3>Awards & Recognition</h3>{isPro && <StatusPill tone="gold">Pro</StatusPill>}</div><p>Issue, deliver, verify, and audit recurring awards or standalone recognition certificates.</p></div>
      <button className="button secondary" onClick={() => load()} disabled={loading}><RefreshCw size={14}/> Refresh</button>
    </header>
    {!isPro ? <div className="awards-upgrade"><div><strong>Recognition workflows are a LexAMS Pro feature</strong><p>Upgrade for reusable templates, bulk awards, delivery, revocation, reissue, and audit history.</p></div><button className="button primary" onClick={() => { window.location.href = '/billing'; }}>View Pro</button></div> : <>
      <nav className="awards-tabs" aria-label="Awards and recognition sections">{[['history', 'Recognition history'], ['issue', 'Issue recognition'], ['templates', 'Templates']].map(([id, label]) => <button key={id} aria-current={view === id ? 'page' : undefined} onClick={() => setView(id)}>{label}</button>)}</nav>
      {previewReadOnly && <div className="awards-message neutral">Demo preview is read-only. Creation, delivery, revocation, and template changes are disabled.</div>}
      {error && <div className="awards-message error" role="alert">{error}</div>}
      {notice && <div className="awards-message success" role="status">{notice}</div>}

      {view === 'history' && <div className="awards-view">
        <form className="awards-filters" onSubmit={applyFilters}>
          <label className="search-field"><Search size={15}/><input value={draftFilters.search} onChange={event => setDraftFilters(current => ({ ...current, search: event.target.value }))} placeholder="Recipient, email, certificate or award"/></label>
          <select aria-label="Status" value={draftFilters.status} onChange={event => setDraftFilters(current => ({ ...current, status: event.target.value }))}><option value="">All statuses</option><option value="active">Active</option><option value="revoked">Revoked</option><option value="superseded">Superseded</option></select>
          <select aria-label="Activity" value={draftFilters.activityId} onChange={event => setDraftFilters(current => ({ ...current, activityId: event.target.value }))}><option value="">All activities</option><option value="standalone">Standalone</option>{activities.map(activity => <option key={activity.id} value={activity.id}>{activity.title}</option>)}</select>
          <label className="date-filter"><span>From</span><input type="date" value={draftFilters.dateFrom} onChange={event => setDraftFilters(current => ({ ...current, dateFrom: event.target.value }))}/></label>
          <label className="date-filter"><span>To</span><input type="date" value={draftFilters.dateTo} onChange={event => setDraftFilters(current => ({ ...current, dateTo: event.target.value }))}/></label>
          <button className="button primary" type="submit">Apply</button><button className="button ghost" type="button" onClick={clearFilters}>Clear</button>
        </form>
        <div className="awards-toolbar"><div><strong>{pagination.total}</strong> record{pagination.total === 1 ? '' : 's'}{selectedAwards.size ? ` · ${selectedAwards.size} selected` : ''}</div><div>{selectedRows.some(row => row.status === 'active' && row.display_recipient_email) && <button className="button secondary" onClick={() => sendCertificates(selectedRows.filter(row => row.status === 'active' && row.display_recipient_email).map(row => row.id))} disabled={busy || previewReadOnly}><Send size={14}/> Email selected</button>}<button className="button secondary" onClick={exportHistory} disabled={busy}><Download size={14}/> Export CSV</button></div></div>
        <div className="awards-table-wrap"><table className="awards-table"><thead><tr><th><input aria-label="Select all visible records" type="checkbox" checked={Boolean(awards.length && selectedAwards.size === awards.length)} onChange={event => setSelectedAwards(event.target.checked ? new Set(awards.map(row => row.id)) : new Set())}/></th><th>Certificate / recipient</th><th>Recognition</th><th>Activity / period</th><th>Issued</th><th>Status</th><th>Delivery</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{awards.map(row => <tr key={row.id}>
          <td><input aria-label={`Select ${row.cert_no}`} type="checkbox" checked={selectedAwards.has(row.id)} onChange={() => toggleAward(row.id)}/></td>
          <td><code>{row.cert_no}</code><strong>{row.display_recipient_name || 'Recipient'}</strong><small>{row.display_recipient_email || 'No email'}</small></td>
          <td><strong>{row.award_title || 'Certificate of Recognition'}</strong><small>{row.award_category || 'Recognition'}</small></td>
          <td>{row.activity_title || 'Standalone'}<small>{row.award_period}</small></td><td>{fmtDate(row.issued_date)}</td>
          <td><StatusPill tone={row.status === 'active' ? 'success' : ''}>{row.status}</StatusPill></td>
          <td><StatusPill tone={row.delivery_status === 'sent' ? 'success' : row.delivery_status === 'failed' ? 'error' : ''}>{row.delivery_status || 'Not sent'}</StatusPill>{row.delivery_sent_at && <small>{fmtDate(row.delivery_sent_at)}</small>}</td>
          <td><div className="row-actions">{row.access_token && <button className="icon-button" title="View certificate" aria-label={`View ${row.cert_no}`} onClick={() => window.open(`/certificate/${row.access_token}`, '_blank', 'noopener,noreferrer')}><Eye size={15}/></button>}{row.status === 'active' && row.display_recipient_email && <button className="icon-button" title="Email certificate" aria-label={`Email ${row.cert_no}`} disabled={busy || previewReadOnly} onClick={() => sendCertificates([row.id])}><Mail size={15}/></button>}<button className="button-link" onClick={() => setDialog({ type: 'details', row })}>Details</button>{row.status === 'active' && <button className="button-link danger-text" disabled={previewReadOnly} onClick={() => setDialog({ type: 'revoke', row, reason: '' })}>Revoke</button>}{row.status !== 'active' && isAdmin && <button className="button-link" disabled={previewReadOnly} onClick={() => setDialog({ type: 'reissue', row })}>Reissue</button>}</div></td>
        </tr>)}</tbody></table></div>
        <div className="awards-cards">{awards.map(row => <article key={row.id} className="award-card"><div className="award-card__top"><input aria-label={`Select ${row.cert_no}`} type="checkbox" checked={selectedAwards.has(row.id)} onChange={() => toggleAward(row.id)}/><code>{row.cert_no}</code><StatusPill tone={row.status === 'active' ? 'success' : ''}>{row.status}</StatusPill></div><h4>{row.award_title || 'Certificate of Recognition'}</h4><strong>{row.display_recipient_name}</strong><p>{row.activity_title || 'Standalone'} · {fmtDate(row.issued_date)}</p><p>Delivery: {row.delivery_status || 'Not sent'}</p><div className="row-actions">{row.access_token && <button className="button-link" onClick={() => window.open(`/certificate/${row.access_token}`, '_blank', 'noopener,noreferrer')}>View</button>}<button className="button-link" onClick={() => setDialog({ type: 'details', row })}>Details</button>{row.status === 'active' && <button className="button-link danger-text" disabled={previewReadOnly} onClick={() => setDialog({ type: 'revoke', row, reason: '' })}>Revoke</button>}</div></article>)}</div>
        {loading && <div className="awards-empty">Loading recognition history…</div>}{!loading && !awards.length && <div className="awards-empty"><Award size={28}/><strong>No recognition certificates match</strong><span>Try different filters, or issue your first recognition certificate.</span><button className="button primary" onClick={() => setView('issue')}>Issue recognition</button></div>}
        {pagination.totalPages > 1 && <div className="awards-pagination"><span>Page {pagination.page} of {pagination.totalPages}</span><button className="icon-button" aria-label="Previous page" disabled={page <= 1 || loading} onClick={() => setPage(current => Math.max(1, current - 1))}><ChevronLeft/></button><button className="icon-button" aria-label="Next page" disabled={page >= pagination.totalPages || loading} onClick={() => setPage(current => current + 1)}><ChevronRight/></button></div>}
      </div>}

      {view === 'issue' && <div className="awards-view awards-issue-grid">
        <section className="awards-section"><div className="section-heading"><span>1</span><div><h4>Recognition details</h4><p>Start from a template or create a one-off award.</p></div></div><div className="field-grid"><label>Template<select value={form.templateId} onChange={event => applyTemplate(event.target.value)}><option value="">Custom / one-off</option>{activeTemplates.map(template => <option key={template.id} value={template.id}>{template.name}</option>)}</select></label><label>Activity (optional)<select value={form.activityId} onChange={event => patchForm('activityId', event.target.value)}><option value="">Standalone</option>{activities.map(activity => <option key={activity.id} value={activity.id}>{activity.title}</option>)}</select></label><label>Award / certificate title<input value={form.awardTitle} onChange={event => patchForm('awardTitle', event.target.value)}/></label><label>Category<input value={form.awardCategory} onChange={event => patchForm('awardCategory', event.target.value)}/></label><label>Period<input value={form.awardPeriod} onChange={event => patchForm('awardPeriod', event.target.value)} placeholder="Week 2 · 7–11 September"/></label><label>Award date<input type="date" value={form.issuedDate} onChange={event => patchForm('issuedDate', event.target.value)}/></label></div><label>Citation<textarea value={form.citation} onChange={event => patchForm('citation', event.target.value)}/></label><label className="checkbox-label"><input type="checkbox" checked={form.emailNow} onChange={event => patchForm('emailNow', event.target.checked)}/> Email certificates immediately when an address is available</label></section>
        <section className="awards-section"><div className="section-heading"><span>2</span><div><h4>Recipients</h4><p>Select participants or add a standalone recipient.</p></div></div><label className="search-field"><Search size={15}/><input value={participantSearch} onChange={event => setParticipantSearch(event.target.value)} placeholder="Search participants"/></label><div className="participant-list">{visibleParticipants.map(participant => <label key={participant.id}><input type="checkbox" checked={selectedParticipants.has(participant.id)} onChange={() => toggleParticipant(participant.id)}/><span><strong>{participant.name}</strong><small>{participant.email || participant.org || 'Participant'}</small></span></label>)}{!visibleParticipants.length && <p>No participants match.</p>}</div><div className="manual-recipient"><h5><Plus size={14}/> Standalone recipient</h5><div><input value={manualName} onChange={event => setManualName(event.target.value)} placeholder="Full name"/><input type="email" value={manualEmail} onChange={event => setManualEmail(event.target.value)} placeholder="Email (optional)"/><button className="button secondary" onClick={addManualRecipient}>Add</button></div>{manualRecipients.map(recipient => <span key={recipient.id}>{recipient.name}<button aria-label={`Remove ${recipient.name}`} onClick={() => setManualRecipients(current => current.filter(item => item.id !== recipient.id))}><X size={12}/></button></span>)}</div><button className="button primary full" disabled={!selectedCount || !form.awardTitle.trim() || previewReadOnly} onClick={() => setDialog({ type: 'issue' })}><Award size={16}/> Review {selectedCount} certificate{selectedCount === 1 ? '' : 's'}</button></section>
      </div>}

      {view === 'templates' && <div className="awards-view templates-grid"><section className="awards-section"><h4>Create a reusable template</h4><label>Template name<input value={templateDraft.name} onChange={event => setTemplateDraft(current => ({ ...current, name: event.target.value }))} placeholder="Trainee of the Week"/></label><label>Certificate title<input value={templateDraft.certificateTitle} onChange={event => setTemplateDraft(current => ({ ...current, certificateTitle: event.target.value }))} placeholder="Certificate of Outstanding Performance"/></label><label>Category<input value={templateDraft.category} onChange={event => setTemplateDraft(current => ({ ...current, category: event.target.value }))}/></label><label>Default citation<textarea value={templateDraft.citationTemplate} onChange={event => setTemplateDraft(current => ({ ...current, citationTemplate: event.target.value }))}/></label><button className="button primary" disabled={busy || previewReadOnly || !templateDraft.name.trim()} onClick={createTemplate}>Save template</button></section><section className="awards-section"><h4>Saved templates</h4><div className="template-list">{templates.map(template => <article key={template.id}><div><strong>{template.name}</strong><p>{template.certificate_title || template.category || 'Recognition certificate'}</p></div><StatusPill tone={template.active ? 'success' : ''}>{template.active ? 'Active' : 'Inactive'}</StatusPill>{isAdmin && <button className="button secondary" disabled={busy || previewReadOnly} onClick={() => toggleTemplate(template)}>{template.active ? 'Deactivate' : 'Activate'}</button>}</article>)}{!templates.length && <p>No templates yet.</p>}</div></section></div>}
    </>}

    {dialog?.type === 'issue' && <Dialog title="Review recognition certificates" confirmLabel={`Issue ${selectedCount} certificate${selectedCount === 1 ? '' : 's'}`} busy={busy} onClose={() => setDialog(null)} onConfirm={issueAward}><dl className="review-list"><div><dt>Recognition</dt><dd>{form.awardTitle}</dd></div><div><dt>Recipients</dt><dd>{selectedCount}</dd></div><div><dt>Date</dt><dd>{fmtDate(form.issuedDate)}</dd></div><div><dt>Delivery</dt><dd>{form.emailNow ? 'Email immediately when possible' : 'Issue only'}</dd></div></dl><p>Each recipient receives an independently verifiable certificate record.</p></Dialog>}
    {dialog?.type === 'revoke' && <Dialog title={`Revoke ${dialog.row.cert_no}`} confirmLabel="Revoke certificate" danger busy={busy} confirmDisabled={!dialog.reason.trim()} onClose={() => setDialog(null)} onConfirm={performCertificateAction}><p>Revocation is visible during verification and remains in the audit history.</p><label>Reason<textarea autoFocus value={dialog.reason} onChange={event => setDialog(current => ({ ...current, reason: event.target.value }))} placeholder="Required for the audit trail"/></label>{!dialog.reason.trim() && <small>A reason is required.</small>}</Dialog>}
    {dialog?.type === 'reissue' && <Dialog title={`Reissue ${dialog.row.cert_no}`} confirmLabel="Issue replacement" busy={busy} onClose={() => setDialog(null)} onConfirm={performCertificateAction}><p>A replacement certificate number will be created. This certificate will remain visible as superseded.</p></Dialog>}
    {dialog?.type === 'details' && <Dialog title="Recognition audit details" confirmLabel="Close" onClose={() => setDialog(null)} onConfirm={() => setDialog(null)}><dl className="review-list">{[['Certificate', dialog.row.cert_no], ['Recipient', dialog.row.display_recipient_name], ['Award', dialog.row.award_title], ['Status', dialog.row.status], ['Issued', fmtDate(dialog.row.issued_date)], ['Delivery', dialog.row.delivery_status || 'Not sent'], ['Citation', dialog.row.citation || '—'], ['Revocation reason', dialog.row.revoke_reason || '—']].map(([term, value]) => <div key={term}><dt>{term}</dt><dd>{value}</dd></div>)}</dl></Dialog>}
  </section>;
}
