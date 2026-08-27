import { useEffect, useMemo, useState } from 'react';
import { Award, Mail, Plus, RefreshCw, Search, ShieldCheck, Sparkles, UserPlus, Users, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';
import { fmtDate } from '../lib/format';
import { isReportingPreviewDemo } from '../lib/reportPreviewDemo';

const card = { background: 'var(--surface-card)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-card)' };
const input = { width: '100%', border: '1px solid var(--border-default)', borderRadius: 8, padding: '9px 10px', background: 'var(--surface-card)', color: 'var(--text-primary)', fontSize: 13 };
const label = { display: 'block', fontSize: 11, fontWeight: 800, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 };

function today() { return new Date().toISOString().slice(0, 10); }

async function request(url, options = {}) {
  const response = await fetch(url, { credentials: 'include', ...options, headers: { ...(options.body ? { 'content-type': 'application/json' } : {}), ...(options.headers || {}) } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || `Request failed (${response.status})`);
  return body;
}

export default function AwardsRecognitionPanel() {
  const { isPro, isAdmin } = useAuth();
  const { activities, participants, refetch } = useData();
  const previewReadOnly = isReportingPreviewDemo();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [templates, setTemplates] = useState([]);
  const [awards, setAwards] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedParticipants, setSelectedParticipants] = useState(new Set());
  const [manualName, setManualName] = useState('');
  const [manualEmail, setManualEmail] = useState('');
  const [manualRecipients, setManualRecipients] = useState([]);
  const [showTemplateForm, setShowTemplateForm] = useState(false);
  const [templateDraft, setTemplateDraft] = useState({ name: '', certificateTitle: '', category: '', citationTemplate: '' });
  const [form, setForm] = useState({ activityId: '', templateId: '', awardTitle: 'Trainee of the Week', awardCategory: 'Performance', awardPeriod: '', citation: 'In recognition of outstanding performance, participation and commitment.', issuedDate: today(), certificateType: 'recognition', emailNow: false });

  async function load() {
    setLoading(true); setError('');
    try {
      const data = await request('/api/awards');
      setTemplates(data.templates || []);
      setAwards(data.awards || []);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const participantId = Number(params.get('awardParticipant'));
    const activityId = Number(params.get('awardActivity'));
    if (Number.isSafeInteger(participantId) && participants.some(p => Number(p.id) === participantId)) setSelectedParticipants(new Set([participantId]));
    if (Number.isSafeInteger(activityId) && activities.some(a => Number(a.id) === activityId)) setForm(current => ({ ...current, activityId: String(activityId) }));
  }, [activities, participants]);

  const visibleParticipants = useMemo(() => {
    const q = search.trim().toLowerCase();
    return participants.filter(p => !q || [p.name, p.email, p.org, p.category].some(v => String(v || '').toLowerCase().includes(q))).slice(0, 80);
  }, [participants, search]);

  function patch(key, value) { setForm(current => ({ ...current, [key]: value })); }
  function applyTemplate(templateId) {
    const template = templates.find(t => String(t.id) === String(templateId));
    setForm(current => ({ ...current, templateId: templateId || '', ...(template ? { awardTitle: template.certificate_title || template.name, awardCategory: template.category || '', citation: template.citation_template || current.citation } : {}) }));
  }
  function toggleParticipant(id) { setSelectedParticipants(current => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; }); }
  function addManualRecipient() {
    const name = manualName.trim(); if (!name) return;
    setManualRecipients(current => [...current, { id: `${Date.now()}-${current.length}`, name, email: manualEmail.trim().toLowerCase() }]);
    setManualName(''); setManualEmail('');
  }

  async function createTemplate() {
    if (previewReadOnly || busy) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const data = await request('/api/awards', { method: 'POST', body: JSON.stringify({ action: 'create_template', ...templateDraft }) });
      setTemplates(current => [...current, data.template].sort((a, b) => a.name.localeCompare(b.name)));
      setTemplateDraft({ name: '', certificateTitle: '', category: '', citationTemplate: '' }); setShowTemplateForm(false); setNotice('Award template saved.');
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  }

  async function issueAward() {
    if (previewReadOnly || busy) return;
    if (!selectedParticipants.size && !manualRecipients.length) { setError('Select at least one participant or add a manual recipient.'); return; }
    setBusy(true); setError(''); setNotice('');
    try {
      const data = await request('/api/awards', { method: 'POST', body: JSON.stringify({ action: 'issue_award', participantIds: [...selectedParticipants], manualRecipients: manualRecipients.map(({ name, email }) => ({ name, email })), activityId: form.activityId || null, templateId: form.templateId || null, awardTitle: form.awardTitle, awardCategory: form.awardCategory, awardPeriod: form.awardPeriod, citation: form.citation, issuedDate: form.issuedDate, certificateType: form.certificateType }) });
      let manuallySent = 0;
      if (form.emailNow && data.certificates?.length) {
        const needsManualSend = data.certificates.filter((cert, index) => !data.delivery?.[index]?.sent).map(cert => cert.id);
        if (needsManualSend.length) manuallySent = Number((await request('/api/award-delivery', { method: 'POST', body: JSON.stringify({ certificateIds: needsManualSend }) })).sent || 0);
      }
      setNotice(`${data.certificates?.length || 0} award certificate${data.certificates?.length === 1 ? '' : 's'} issued${form.emailNow ? ` · email delivery processed${manuallySent ? ` (${manuallySent} sent manually)` : ''}` : ''}.`);
      setSelectedParticipants(new Set()); setManualRecipients([]); await Promise.all([load(), refetch()]);
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  }

  async function sendAward(id) {
    if (previewReadOnly || busy) return;
    setBusy(true); setError(''); setNotice('');
    try { const data = await request('/api/award-delivery', { method: 'POST', body: JSON.stringify({ certificateIds: [id] }) }); if (!data.sent) throw new Error(data.skipped?.[0]?.reason || 'Certificate could not be emailed.'); setNotice('Award certificate emailed.'); }
    catch (e) { setError(e.message); } finally { setBusy(false); }
  }

  async function revokeAward(row) {
    if (previewReadOnly || busy) return;
    const reason = window.prompt(`Reason for revoking ${row.cert_no}:`); if (!reason?.trim()) return;
    setBusy(true); setError(''); setNotice('');
    try { await request('/api/awards', { method: 'POST', body: JSON.stringify({ action: 'revoke', certificateId: row.id, reason }) }); setNotice('Award certificate revoked. The verification record remains in the audit trail.'); await load(); }
    catch (e) { setError(e.message); } finally { setBusy(false); }
  }

  async function reissueAward(row) {
    if (!isAdmin || previewReadOnly || busy || !window.confirm(`Reissue ${row.cert_no}? The current certificate will be marked superseded.`)) return;
    setBusy(true); setError(''); setNotice('');
    try { await request('/api/awards', { method: 'POST', body: JSON.stringify({ action: 'reissue', certificateId: row.id }) }); setNotice('A replacement certificate was issued and the previous certificate was marked superseded.'); await Promise.all([load(), refetch()]); }
    catch (e) { setError(e.message); } finally { setBusy(false); }
  }

  const activeTemplates = templates.filter(t => t.active);
  const selectedCount = selectedParticipants.size + manualRecipients.length;

  return <section id="awards-recognition" style={{ ...card, marginTop: 22, overflow: 'hidden' }}>
    <div style={{ padding: '20px 22px', borderBottom: '1px solid var(--border-default)', display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', alignItems: 'flex-start' }}>
      <div><div style={{ display: 'flex', alignItems: 'center', gap: 9 }}><Award size={20} color="var(--color-gold-600)"/><h3 style={{ margin: 0, fontSize: 18, fontFamily: 'var(--font-display)' }}>Awards & Recognition</h3>{isPro && <span style={{ fontSize: 10, fontWeight: 900, padding: '3px 7px', borderRadius: 999, background: '#FFF3D7', color: '#8A5B00' }}>PRO</span>}</div><p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--text-secondary)', maxWidth: 720 }}>Issue recurring awards such as Trainee of the Day/Week, special recognition and standalone certificates. Awards remain independently verifiable.</p></div>
      <button onClick={load} disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 11px', border: '1px solid var(--border-default)', borderRadius: 8, background: 'var(--surface-card)', cursor: 'pointer' }}><RefreshCw size={14}/>Refresh</button>
    </div>
    {!isPro ? <div style={{ padding: 28, display: 'grid', gridTemplateColumns: '1fr auto', gap: 22, alignItems: 'center', background: 'linear-gradient(135deg,#FFF8E8,#F5F8FB)' }}><div><div style={{ fontWeight: 800, color: 'var(--color-navy-900)' }}>Recognition workflows are a LexAMS Pro feature</div><div style={{ marginTop: 5, fontSize: 13, color: 'var(--text-secondary)' }}>Upgrade to create standalone awards, reusable templates, bulk award certificates, reissues and certificate email delivery.</div></div><button onClick={() => { window.location.href = '/billing'; }} style={{ border: 0, borderRadius: 8, background: 'var(--color-navy-900)', color: '#fff', padding: '10px 15px', fontWeight: 800, cursor: 'pointer' }}>View Pro</button></div> : <>
      {previewReadOnly && <div style={{ margin: '16px 22px 0', padding: 11, borderRadius: 8, background: 'var(--surface-muted)', color: 'var(--text-secondary)', fontSize: 13 }}>Demo preview is read-only. Award creation and email delivery are disabled.</div>}
      {error && <div role="alert" style={{ margin: '16px 22px 0', padding: 11, borderRadius: 8, background: '#FFF1F0', color: '#9B2C2C', fontSize: 13 }}>{error}</div>}
      {notice && <div role="status" style={{ margin: '16px 22px 0', padding: 11, borderRadius: 8, background: '#EDF8F0', color: '#176B3A', fontSize: 13 }}>{notice}</div>}
      <div className="lex-awards-create-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.08fr) minmax(300px,.92fr)', gap: 18, padding: 22 }}>
        <div style={{ border: '1px solid var(--border-default)', borderRadius: 12, padding: 18 }}><div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}><div><div style={{ fontSize: 15, fontWeight: 800 }}>1. Award details</div><div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 3 }}>Use a template or build a one-off recognition certificate.</div></div><Sparkles size={18} color="var(--color-gold-600)"/></div>
          <div className="lex-awards-fields-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 16 }}><div><label style={label}>Reusable template</label><select style={input} value={form.templateId} onChange={e => applyTemplate(e.target.value)}><option value="">Custom / one-off</option>{activeTemplates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></div><div><label style={label}>Activity (optional)</label><select style={input} value={form.activityId} onChange={e => patch('activityId', e.target.value)}><option value="">Standalone certificate</option>{activities.map(a => <option key={a.id} value={a.id}>{a.title}</option>)}</select></div><div><label style={label}>Award / certificate title</label><input style={input} value={form.awardTitle} onChange={e => patch('awardTitle', e.target.value)} placeholder="Trainee of the Week"/></div><div><label style={label}>Category</label><input style={input} value={form.awardCategory} onChange={e => patch('awardCategory', e.target.value)} placeholder="Performance"/></div><div><label style={label}>Period</label><input style={input} value={form.awardPeriod} onChange={e => patch('awardPeriod', e.target.value)} placeholder="Week 2 · 7–11 September"/></div><div><label style={label}>Award date</label><input style={input} type="date" value={form.issuedDate} onChange={e => patch('issuedDate', e.target.value)}/></div></div>
          <div style={{ marginTop: 12 }}><label style={label}>Citation / reason</label><textarea style={{ ...input, minHeight: 82, resize: 'vertical' }} value={form.citation} onChange={e => patch('citation', e.target.value)} placeholder="In recognition of..."/></div><label style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 12, fontSize: 13, fontWeight: 700 }}><input type="checkbox" checked={form.emailNow} onChange={e => patch('emailNow', e.target.checked)}/> Email the certificate immediately when possible</label>
          <div style={{ marginTop: 17, paddingTop: 15, borderTop: '1px solid var(--border-default)' }}><button onClick={() => setShowTemplateForm(v => !v)} style={{ border: 0, background: 'transparent', color: 'var(--color-navy-700)', padding: 0, display: 'flex', gap: 6, alignItems: 'center', fontWeight: 800, cursor: 'pointer' }}><Plus size={15}/>Save a reusable award template</button>{showTemplateForm && <div style={{ marginTop: 12, display: 'grid', gap: 9, padding: 12, background: 'var(--surface-muted)', borderRadius: 9 }}><input style={input} placeholder="Template name · Trainee of the Week" value={templateDraft.name} onChange={e => setTemplateDraft(d => ({ ...d, name: e.target.value }))}/><input style={input} placeholder="Certificate title" value={templateDraft.certificateTitle} onChange={e => setTemplateDraft(d => ({ ...d, certificateTitle: e.target.value }))}/><input style={input} placeholder="Category" value={templateDraft.category} onChange={e => setTemplateDraft(d => ({ ...d, category: e.target.value }))}/><textarea style={{ ...input, minHeight: 65 }} placeholder="Default citation" value={templateDraft.citationTemplate} onChange={e => setTemplateDraft(d => ({ ...d, citationTemplate: e.target.value }))}/><div><button onClick={createTemplate} disabled={busy || previewReadOnly} style={{ border: 0, borderRadius: 8, padding: '8px 12px', background: 'var(--color-navy-900)', color: '#fff', fontWeight: 800 }}>Save template</button></div></div>}</div>
        </div>
        <div style={{ border: '1px solid var(--border-default)', borderRadius: 12, padding: 18 }}><div style={{ fontSize: 15, fontWeight: 800 }}>2. Recipients</div><div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 3 }}>Select LexAMS participants and/or add standalone recipients.</div><div style={{ position: 'relative', marginTop: 14 }}><Search size={14} style={{ position: 'absolute', left: 10, top: 11, color: 'var(--text-tertiary)' }}/><input style={{ ...input, paddingLeft: 31 }} value={search} onChange={e => setSearch(e.target.value)} placeholder="Search participants"/></div><div style={{ maxHeight: 210, overflowY: 'auto', marginTop: 8, border: '1px solid var(--border-default)', borderRadius: 8 }}>{visibleParticipants.map(p => <label key={p.id} style={{ display: 'grid', gridTemplateColumns: '20px 1fr', gap: 8, padding: '8px 10px', borderBottom: '1px solid var(--border-default)', cursor: 'pointer' }}><input type="checkbox" checked={selectedParticipants.has(p.id)} onChange={() => toggleParticipant(p.id)}/><span><span style={{ display: 'block', fontSize: 13, fontWeight: 700 }}>{p.name}</span><span style={{ display: 'block', fontSize: 11, color: 'var(--text-tertiary)' }}>{p.email || p.org || 'Participant'}</span></span></label>)}{!visibleParticipants.length && <div style={{ padding: 16, fontSize: 12, color: 'var(--text-tertiary)', textAlign: 'center' }}>No participants match.</div>}</div>
          <div style={{ marginTop: 15, paddingTop: 13, borderTop: '1px solid var(--border-default)' }}><div style={{ fontSize: 12, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 6 }}><UserPlus size={14}/>Standalone/manual recipient</div><div className="lex-awards-manual-grid" style={{ display: 'grid', gridTemplateColumns: '1.15fr 1.4fr auto', gap: 7, marginTop: 8 }}><input style={input} value={manualName} onChange={e => setManualName(e.target.value)} placeholder="Full name"/><input style={input} value={manualEmail} onChange={e => setManualEmail(e.target.value)} placeholder="Email (optional)"/><button onClick={addManualRecipient} style={{ border: 0, borderRadius: 8, background: 'var(--surface-muted)', padding: '0 11px', fontWeight: 800 }}>Add</button></div>{manualRecipients.length > 0 && <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 9 }}>{manualRecipients.map(r => <span key={r.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, borderRadius: 999, padding: '5px 8px', background: '#EEF3F8', fontSize: 11, fontWeight: 700 }}>{r.name}<button aria-label={`Remove ${r.name}`} onClick={() => setManualRecipients(rows => rows.filter(x => x.id !== r.id))} style={{ border: 0, background: 'transparent', padding: 0, cursor: 'pointer' }}><X size={12}/></button></span>)}</div>}</div>
          <button onClick={issueAward} disabled={busy || previewReadOnly || !selectedCount || !form.awardTitle.trim()} style={{ width: '100%', marginTop: 18, border: 0, borderRadius: 9, padding: '11px 14px', background: 'var(--color-gold-500)', color: 'var(--color-navy-900)', fontWeight: 900, cursor: 'pointer', opacity: busy || !selectedCount ? .55 : 1 }}><Award size={15} style={{ verticalAlign: -3, marginRight: 7 }}/>{busy ? 'Processing…' : `Award certificate${selectedCount === 1 ? '' : 's'} to ${selectedCount} recipient${selectedCount === 1 ? '' : 's'}`}</button>
        </div>
      </div>
      <div style={{ borderTop: '1px solid var(--border-default)', padding: '18px 22px 22px' }}><div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}><div><div style={{ fontSize: 15, fontWeight: 800 }}>Recognition history</div><div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 3 }}>Awards remain visible after revocation or reissue for auditability.</div></div><div style={{ display: 'flex', gap: 12, fontSize: 12, color: 'var(--text-secondary)' }}><span><Users size={13} style={{ verticalAlign: -2 }}/> {new Set(awards.map(a => a.display_recipient_name)).size} recipients</span><span><ShieldCheck size={13} style={{ verticalAlign: -2 }}/> {awards.filter(a => a.status === 'active').length} active</span></div></div><div className="table-scroll" style={{ marginTop: 12 }}><div style={{ minWidth: 920 }}><div style={{ display: 'grid', gridTemplateColumns: '1.15fr 1.35fr 1.45fr 1.4fr .75fr .8fr 1.05fr', gap: 10, padding: '10px 12px', background: 'var(--surface-muted)', fontSize: 10, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--text-tertiary)' }}><div>Certificate</div><div>Recipient</div><div>Award</div><div>Activity / period</div><div>Issued</div><div>Status</div><div></div></div>{awards.map(row => <div key={row.id} style={{ display: 'grid', gridTemplateColumns: '1.15fr 1.35fr 1.45fr 1.4fr .75fr .8fr 1.05fr', gap: 10, padding: '10px 12px', alignItems: 'center', borderTop: '1px solid var(--border-default)', fontSize: 12 }}><div style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>{row.cert_no}</div><div><div style={{ fontWeight: 700 }}>{row.display_recipient_name || 'Recipient'}</div><div style={{ color: 'var(--text-tertiary)', fontSize: 10 }}>{row.display_recipient_email || 'No email'}</div></div><div><div style={{ fontWeight: 700 }}>{row.award_title}</div><div style={{ color: 'var(--text-tertiary)', fontSize: 10 }}>{row.award_category || (row.certificate_kind === 'standalone' ? 'Standalone' : 'Recognition')}</div></div><div>{row.activity_title || 'Standalone'}{row.award_period && <div style={{ color: 'var(--text-tertiary)', fontSize: 10 }}>{row.award_period}</div>}</div><div>{fmtDate(row.issued_date)}</div><div><span style={{ padding: '3px 7px', borderRadius: 999, background: row.status === 'active' ? '#EAF7EE' : '#F2F3F5', color: row.status === 'active' ? '#176B3A' : 'var(--text-secondary)', fontSize: 10, fontWeight: 900, textTransform: 'uppercase' }}>{row.status}</span></div><div style={{ display: 'flex', justifyContent: 'flex-end', gap: 4 }}><button onClick={() => window.open(`/certificate/${row.access_token}`, '_blank', 'noopener,noreferrer')} title="View certificate" style={{ border: 0, background: 'transparent', color: 'var(--color-navy-700)', fontWeight: 800, cursor: 'pointer', fontSize: 11 }}>View</button>{row.status === 'active' && row.display_recipient_email && <button onClick={() => sendAward(row.id)} title="Email award" style={{ border: 0, background: 'transparent', color: 'var(--color-navy-700)', cursor: 'pointer' }}><Mail size={14}/></button>}{row.status === 'active' && <button onClick={() => revokeAward(row)} title="Revoke" style={{ border: 0, background: 'transparent', color: '#9B2C2C', cursor: 'pointer', fontSize: 11, fontWeight: 800 }}>Revoke</button>}{row.status !== 'active' && isAdmin && <button onClick={() => reissueAward(row)} title="Reissue" style={{ border: 0, background: 'transparent', color: 'var(--color-navy-700)', cursor: 'pointer', fontSize: 11, fontWeight: 800 }}>Reissue</button>}</div></div>)}{!loading && !awards.length && <div style={{ padding: 28, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>No recognition certificates yet. Your first Trainee of the Day/Week award will appear here.</div>}{loading && <div style={{ padding: 28, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>Loading awards…</div>}</div></div></div>
    </>}
  </section>;
}
