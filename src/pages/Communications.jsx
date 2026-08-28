import { useCallback, useEffect, useMemo, useState } from 'react';
import { useData } from '../contexts/DataContext';
import { AlertTriangle, CheckCircle2, History, Mail, Search, Send, Settings as SettingsIcon, Sparkles, Users } from 'lucide-react';
import { isReportingPreviewDemo } from '../lib/reportPreviewDemo';

const templates = {
  announcement: {
    label: 'General announcement',
    subject: 'Programme update',
    message: 'We have an important update to share with you.\n\nPlease review the details below and contact us if you have any questions.',
  },
  reminder: {
    label: 'Activity reminder',
    subject: 'Reminder about your upcoming activity',
    message: 'This is a reminder about your upcoming programme activity.\n\nPlease make sure you have the necessary information and arrive on time. We look forward to seeing you.',
  },
  followup: {
    label: 'Post-activity follow-up',
    subject: 'Thank you for participating',
    message: 'Thank you for taking part in our programme.\n\nWe appreciate your participation and will share any relevant follow-up information with you here.',
  },
};
const EMPTY_HISTORY = [];
const PREVIEW_COMMUNICATIONS = {
  settings: { auto_send_certificates: false, reply_to_email: '' },
  history: [
    { id: -9101, kind: 'certificate', subject: 'Your award — Outstanding Project Award', recipients: 1, sent: 1, delivered: 1, failed: 0, queued: 0, created_at: '2026-08-28T14:20:00Z' },
    { id: -9102, kind: 'announcement', subject: 'September programme schedule', recipients: 8, sent: 8, delivered: 7, failed: 1, queued: 0, created_at: '2026-08-27T09:15:00Z' },
    { id: -9103, kind: 'certificate', subject: 'Your certificate — Youth Digital Skills Bootcamp', recipients: 4, sent: 4, delivered: 3, failed: 0, queued: 1, created_at: '2026-08-26T16:40:00Z' },
  ],
};

function communicationKind(item) {
  if (item.kind !== 'certificate') return item.kind || 'message';
  return /award|recognition/i.test(item.subject || '') ? 'recognition' : 'certificate';
}

function communicationHealth(item) {
  if (Number(item.failed) > 0) return 'issues';
  if (Number(item.queued) > 0) return 'in_progress';
  return 'healthy';
}

function kindLabel(item) {
  const kind = communicationKind(item);
  if (kind === 'recognition') return 'Recognition';
  if (kind === 'certificate') return 'Certificate';
  if (kind === 'announcement') return 'Announcement';
  return 'Message';
}

export default function Communications() {
  const { activities, participants, registrations } = useData();
  const previewReadOnly = isReportingPreviewDemo();
  const [tab, setTab] = useState('compose');
  const [meta, setMeta] = useState({ settings: { auto_send_certificates: false, reply_to_email: '' }, history: [] });
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [toast, setToast] = useState('');
  const [template, setTemplate] = useState('announcement');
  const [subject, setSubject] = useState(templates.announcement.subject);
  const [message, setMessage] = useState(templates.announcement.message);
  const [audience, setAudience] = useState({ activityId: 'all', category: 'all', organization: 'all', participantId: 'all' });
  const [autoSendCertificates, setAutoSendCertificates] = useState(false);
  const [replyToEmail, setReplyToEmail] = useState('');
  const [showSendReview, setShowSendReview] = useState(false);
  const [historySearch, setHistorySearch] = useState('');
  const [historyKind, setHistoryKind] = useState('all');
  const [historyHealth, setHistoryHealth] = useState('all');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (previewReadOnly) {
        setMeta(PREVIEW_COMMUNICATIONS);
        setAutoSendCertificates(false);
        setReplyToEmail('');
        return;
      }
      const response = await fetch('/api/communications', { credentials: 'include' });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || 'Could not load communications');
      setMeta(body);
      setAutoSendCertificates(Boolean(body.settings?.auto_send_certificates));
      setReplyToEmail(body.settings?.reply_to_email || '');
    } catch (error) {
      setToast(error.message);
    } finally {
      setLoading(false);
    }
  }, [previewReadOnly]);

  useEffect(() => { load(); }, [load]);

  const categories = useMemo(() => [...new Set(participants.map(p => p.category).filter(Boolean))].sort(), [participants]);
  const organizations = useMemo(() => [...new Set(participants.map(p => p.org).filter(Boolean))].sort(), [participants]);
  const communicationHistory = meta.history || EMPTY_HISTORY;

  const historySummary = useMemo(() => communicationHistory.reduce((summary, item) => ({
    messages: summary.messages + 1,
    recipients: summary.recipients + Number(item.recipients || 0),
    delivered: summary.delivered + Number(item.delivered || 0),
    issues: summary.issues + Number(item.failed || 0),
  }), { messages: 0, recipients: 0, delivered: 0, issues: 0 }), [communicationHistory]);

  const filteredHistory = useMemo(() => {
    const search = historySearch.trim().toLowerCase();
    return communicationHistory.filter(item => {
      if (historyKind !== 'all' && communicationKind(item) !== historyKind) return false;
      if (historyHealth !== 'all' && communicationHealth(item) !== historyHealth) return false;
      return !search || [item.subject, item.kind, kindLabel(item)].some(value => String(value || '').toLowerCase().includes(search));
    });
  }, [communicationHistory, historyHealth, historyKind, historySearch]);

  const matchedParticipants = useMemo(() => {
    const registeredIds = audience.activityId === 'all'
      ? null
      : new Set(registrations.filter(r => String(r.activity_id) === audience.activityId).map(r => String(r.participant_id)));
    return participants.filter(participant => {
      if (!participant.email || !String(participant.email).includes('@')) return false;
      if (audience.participantId !== 'all' && String(participant.id) !== audience.participantId) return false;
      if (audience.category !== 'all' && participant.category !== audience.category) return false;
      if (audience.organization !== 'all' && (participant.org || '') !== audience.organization) return false;
      if (registeredIds && !registeredIds.has(String(participant.id))) return false;
      return true;
    });
  }, [audience, participants, registrations]);

  function chooseTemplate(key) {
    setTemplate(key);
    setSubject(templates[key].subject);
    setMessage(templates[key].message);
  }

  async function sendAnnouncement() {
    if (previewReadOnly) {
      setToast('This demo preview is read-only. No emails will be sent.');
      return;
    }
    if (!subject.trim() || !message.trim() || !matchedParticipants.length) return;
    setSending(true);
    setToast('');
    try {
      const response = await fetch('/api/communications', {
        method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          action: 'send_announcement', subject, message,
          audience: {
            activityId: audience.activityId,
            category: audience.category,
            organization: audience.organization,
            participantIds: audience.participantId === 'all' ? [] : [Number(audience.participantId)],
          },
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || 'Could not send message');
      setToast(`Message sent to ${body.recipients} participant${body.recipients === 1 ? '' : 's'}.`);
      setShowSendReview(false);
      await load();
      setTab('history');
    } catch (error) {
      setToast(error.message);
    } finally {
      setSending(false);
    }
  }

  async function saveSettings() {
    if (previewReadOnly) {
      setToast('This demo preview is read-only. Delivery settings cannot be changed.');
      return;
    }
    setSending(true);
    setToast('');
    try {
      const response = await fetch('/api/communications', {
        method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'save_settings', autoSendCertificates, replyToEmail }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || 'Could not save communication settings');
      setMeta(current => ({ ...current, settings: body.settings }));
      setToast('Communication settings saved.');
    } catch (error) {
      setToast(error.message);
    } finally {
      setSending(false);
    }
  }

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)' }}>Loading communications…</div>;

  const input = { width: '100%', padding: '10px 12px', border: '1px solid var(--border-default)', borderRadius: 8, background: 'var(--surface-card)', color: 'var(--text-primary)', fontSize: 13 };

  return (
    <div style={{ display: 'grid', gap: 22 }}>
      <style>{`
        .lex-comm-tabs{display:flex;gap:8px;flex-wrap:wrap}.lex-comm-grid{display:grid;grid-template-columns:minmax(0,1.45fr) minmax(260px,.7fr);gap:18px}.lex-comm-filters{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.lex-comm-summary{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}.lex-comm-history-tools{display:grid;grid-template-columns:minmax(220px,1fr) 180px 180px;gap:10px;padding:14px 16px;border-top:1px solid var(--border-default)}.lex-comm-search{display:flex;align-items:center;gap:8px;padding:0 11px;border:1px solid var(--border-default);border-radius:8px;background:var(--surface-card)}.lex-comm-search input{width:100%;padding:9px 0;border:0;outline:0;background:transparent}.lex-comm-review-backdrop{position:fixed;inset:0;z-index:400;display:grid;place-items:center;padding:20px;background:rgba(0,43,84,.45)}.lex-comm-review{width:min(520px,100%);padding:24px;border-radius:16px;background:var(--surface-card);box-shadow:var(--shadow-raised)}@media(max-width:820px){.lex-comm-grid{grid-template-columns:1fr}.lex-comm-filters{grid-template-columns:1fr}.lex-comm-summary{grid-template-columns:repeat(2,minmax(0,1fr))}.lex-comm-history-tools{grid-template-columns:1fr}.lex-comm-history-row{grid-template-columns:1fr!important}.lex-comm-history-status{text-align:left!important}.lex-comm-history-status>div:first-child{justify-content:flex-start!important}}
      `}</style>

      {previewReadOnly && <div role="status" style={{ padding: '12px 15px', border: '1px solid var(--border-default)', borderRadius: 12, background: 'var(--surface-muted)', color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.5 }}><strong style={{ color: 'var(--color-navy-900)' }}>Read-only demo preview:</strong> audience data is available for review, but sending email and saving delivery settings are disabled so this preview cannot change Neon or contact real participants.</div>}

      <section style={{ padding: 24, border: '1px solid var(--border-default)', borderRadius: 18, background: 'var(--surface-card)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 18, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--color-navy-700)', fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.09em' }}><Mail size={16}/> Participant communications</div>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 28, color: 'var(--color-navy-900)', margin: '8px 0 0' }}>Announcements, updates and certificate delivery</h2>
            <p style={{ margin: '8px 0 0', color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.6, maxWidth: 720 }}>Send programme messages to one participant or a filtered audience. Certificate delivery is managed from the Certificates page and recorded here.</p>
          </div>
          <span style={{ padding: '6px 10px', borderRadius: 999, fontSize: 12, fontWeight: 800, background: '#E4F3E9', color: 'var(--color-success)' }}>Pro</span>
        </div>
      </section>

      <div className="lex-comm-tabs">
        {[
          ['compose', Send, 'Compose'], ['history', History, 'History'], ['settings', SettingsIcon, 'Settings'],
        ].map(([key, Icon, label]) => <button key={key} onClick={() => setTab(key)} style={{ display: 'flex', gap: 7, alignItems: 'center', padding: '9px 14px', borderRadius: 8, border: '1px solid var(--border-default)', background: tab === key ? 'var(--color-navy-900)' : 'var(--surface-card)', color: tab === key ? '#fff' : 'var(--text-secondary)', fontWeight: 700 }}><Icon size={15}/>{label}</button>)}
      </div>

      {toast && <div role="status" aria-live="polite" style={{ padding: '11px 14px', borderRadius: 9, background: 'var(--surface-muted)', color: 'var(--text-primary)', fontSize: 13 }}>{toast}</div>}

      {tab === 'compose' && (
        <div className="lex-comm-grid">
          <section style={{ padding: 22, border: '1px solid var(--border-default)', borderRadius: 14, background: 'var(--surface-card)' }}>
            <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 14 }}>Message</div>
            <label style={{ fontSize: 12, fontWeight: 700 }}>Template</label>
            <select value={template} onChange={e => chooseTemplate(e.target.value)} style={{ ...input, marginTop: 6 }}>{Object.entries(templates).map(([key, value]) => <option key={key} value={key}>{value.label}</option>)}</select>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginTop: 14 }}>Subject</label>
            <input value={subject} onChange={e => setSubject(e.target.value)} style={{ ...input, marginTop: 6 }}/>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginTop: 14 }}>Message</label>
            <textarea value={message} onChange={e => setMessage(e.target.value)} rows={9} style={{ ...input, marginTop: 6, resize: 'vertical', lineHeight: 1.55 }}/>
            <button onClick={() => setShowSendReview(true)} disabled={sending || !matchedParticipants.length || !subject.trim() || !message.trim()} style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 8, padding: '11px 18px', border: 0, borderRadius: 9, background: 'var(--color-navy-900)', color: '#fff', fontWeight: 800, opacity: sending || !matchedParticipants.length ? .5 : 1 }}><Send size={16}/>Review message to {matchedParticipants.length}</button>
          </section>

          <aside style={{ padding: 20, border: '1px solid var(--border-default)', borderRadius: 14, background: 'var(--surface-card)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 800 }}><Users size={17}/> Audience</div>
            <div className="lex-comm-filters" style={{ marginTop: 14 }}>
              <div><label style={{ fontSize: 11, fontWeight: 700 }}>Activity</label><select style={{ ...input, marginTop: 5 }} value={audience.activityId} onChange={e => setAudience(a => ({ ...a, activityId: e.target.value }))}><option value="all">All activities</option>{activities.map(a => <option key={a.id} value={String(a.id)}>{a.title}</option>)}</select></div>
              <div><label style={{ fontSize: 11, fontWeight: 700 }}>Specific participant</label><select style={{ ...input, marginTop: 5 }} value={audience.participantId} onChange={e => setAudience(a => ({ ...a, participantId: e.target.value }))}><option value="all">Everyone matching filters</option>{participants.map(p => <option key={p.id} value={String(p.id)}>{p.name}</option>)}</select></div>
              <div><label style={{ fontSize: 11, fontWeight: 700 }}>Category</label><select style={{ ...input, marginTop: 5 }} value={audience.category} onChange={e => setAudience(a => ({ ...a, category: e.target.value }))}><option value="all">All categories</option>{categories.map(value => <option key={value}>{value}</option>)}</select></div>
              <div><label style={{ fontSize: 11, fontWeight: 700 }}>Organisation</label><select style={{ ...input, marginTop: 5 }} value={audience.organization} onChange={e => setAudience(a => ({ ...a, organization: e.target.value }))}><option value="all">All organisations</option>{organizations.map(value => <option key={value}>{value}</option>)}</select></div>
            </div>
            <div style={{ marginTop: 16, padding: 14, borderRadius: 10, background: 'var(--surface-muted)' }}><div style={{ fontSize: 28, fontFamily: 'var(--font-display)', fontWeight: 800, color: 'var(--color-navy-900)' }}>{matchedParticipants.length}</div><div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>participants with valid email addresses match this audience</div></div>
          </aside>
        </div>
      )}

      {tab === 'history' && (
        <div style={{ display: 'grid', gap: 14 }}>
          <div className="lex-comm-summary">
            {[
              ['Messages', historySummary.messages],
              ['Recipients', historySummary.recipients],
              ['Delivered', historySummary.delivered],
              ['Delivery issues', historySummary.issues],
            ].map(([label, value]) => <div key={label} style={{ padding: 16, border: '1px solid var(--border-default)', borderRadius: 12, background: 'var(--surface-card)' }}><div style={{ fontFamily: 'var(--font-display)', fontSize: 25, fontWeight: 800, color: label === 'Delivery issues' && value ? 'var(--color-danger)' : 'var(--color-navy-900)' }}>{value}</div><div style={{ marginTop: 4, color: 'var(--text-secondary)', fontSize: 12 }}>{label}</div></div>)}
          </div>
          <section style={{ border: '1px solid var(--border-default)', borderRadius: 14, overflow: 'hidden', background: 'var(--surface-card)' }}>
          <div style={{ padding: '16px 20px', fontWeight: 800 }}>Recent communications</div>
          <div className="lex-comm-history-tools">
            <label className="lex-comm-search"><Search size={15}/><span className="sr-only">Search communications</span><input value={historySearch} onChange={event => setHistorySearch(event.target.value)} placeholder="Search subject or type"/></label>
            <select aria-label="Communication type" value={historyKind} onChange={event => setHistoryKind(event.target.value)} style={input}><option value="all">All types</option><option value="announcement">Announcements</option><option value="recognition">Recognition</option><option value="certificate">Certificates</option></select>
            <select aria-label="Delivery health" value={historyHealth} onChange={event => setHistoryHealth(event.target.value)} style={input}><option value="all">All delivery states</option><option value="healthy">Healthy</option><option value="in_progress">In progress</option><option value="issues">Needs attention</option></select>
          </div>
          {filteredHistory.length ? filteredHistory.map(item => {
            const health = communicationHealth(item);
            return (
            <div key={item.id} className="lex-comm-history-row" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', gap: 18, padding: '14px 20px', borderTop: '1px solid var(--border-default)' }}>
              <div><div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}><span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.07em', fontWeight: 800, color: communicationKind(item) === 'recognition' ? 'var(--color-warning)' : 'var(--color-navy-700)' }}>{kindLabel(item)}</span><strong style={{ fontSize: 13 }}>{item.subject}</strong></div><div style={{ marginTop: 5, fontSize: 12, color: 'var(--text-tertiary)' }}>{new Date(item.created_at).toLocaleString()}</div></div>
              <div className="lex-comm-history-status" style={{ textAlign: 'right', fontSize: 12, color: 'var(--text-secondary)' }}>
                <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 5, color: health === 'issues' ? 'var(--color-danger)' : health === 'healthy' ? 'var(--color-success)' : 'var(--text-secondary)', fontWeight: 700 }}>{health === 'issues' ? <AlertTriangle size={14}/> : health === 'healthy' ? <CheckCircle2 size={14}/> : null}{health === 'issues' ? 'Needs attention' : health === 'in_progress' ? 'In progress' : 'Healthy'}</div>
                <div style={{ marginTop: 4 }}><strong>{item.delivered || 0}</strong> delivered · {item.sent || 0}/{item.recipients || 0} accepted/currently healthy</div>
                {(item.failed || item.queued) ? <div style={{ marginTop: 3, color: item.failed ? 'var(--color-danger)' : 'var(--text-tertiary)' }}>{item.failed ? `${item.failed} delivery issue${item.failed === 1 ? '' : 's'}` : ''}{item.failed && item.queued ? ' · ' : ''}{item.queued ? `${item.queued} queued` : ''}</div> : null}
              </div>
            </div>
          ); }) : <div style={{ padding: 30, textAlign: 'center', color: 'var(--text-tertiary)', borderTop: '1px solid var(--border-default)' }}>{communicationHistory.length ? 'No communications match these filters.' : 'No participant communications have been sent yet.'}</div>}
        </section>
        </div>
      )}

      {tab === 'settings' && (
        <section style={{ maxWidth: 700, padding: 22, border: '1px solid var(--border-default)', borderRadius: 14, background: 'var(--surface-card)' }}>
          <div style={{ display: 'flex', gap: 9, alignItems: 'center', fontSize: 14, fontWeight: 800 }}><Sparkles size={17}/> Delivery settings</div>
          <label style={{ display: 'flex', gap: 11, alignItems: 'flex-start', marginTop: 18, cursor: previewReadOnly ? 'not-allowed' : 'pointer' }}><input type="checkbox" checked={autoSendCertificates} disabled={previewReadOnly} onChange={e => setAutoSendCertificates(e.target.checked)} style={{ marginTop: 3 }}/><div><strong style={{ fontSize: 13 }}>Automatically email certificates when awarded</strong><div style={{ marginTop: 4, color: 'var(--text-secondary)', fontSize: 12, lineHeight: 1.5 }}>When a certificate is issued, LexAMS sends the recipient a secure branded certificate link automatically if a valid email address is available.</div></div></label>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginTop: 20 }}>Reply-to email</label>
          <input type="email" value={replyToEmail} disabled={previewReadOnly} onChange={e => setReplyToEmail(e.target.value)} placeholder="programmes@yourorganisation.org" style={{ ...input, marginTop: 6 }}/>
          <div style={{ marginTop: 7, fontSize: 11, color: 'var(--text-tertiary)', lineHeight: 1.5 }}>Participant replies will go to this address. Sending still uses the authenticated LexAMS delivery domain.</div>
          <button onClick={saveSettings} disabled={previewReadOnly || sending} style={{ marginTop: 18, padding: '10px 16px', border: 0, borderRadius: 8, background: 'var(--color-navy-900)', color: '#fff', fontWeight: 800 }}>{previewReadOnly ? 'Settings locked in preview' : sending ? 'Saving…' : 'Save settings'}</button>
        </section>
      )}

      {showSendReview && <div className="lex-comm-review-backdrop" role="presentation" onMouseDown={event => event.target === event.currentTarget && setShowSendReview(false)}>
        <section className="lex-comm-review" role="dialog" aria-modal="true" aria-labelledby="communication-review-title">
          <h3 id="communication-review-title" style={{ fontFamily: 'var(--font-display)', fontSize: 20, color: 'var(--color-navy-900)' }}>Review before sending</h3>
          <p style={{ marginTop: 8, color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.55 }}>{previewReadOnly ? 'This review uses demo recipients. Sending remains disabled in this preview.' : 'LexAMS will send this branded message and record its delivery status in Communications history.'}</p>
          <dl style={{ display: 'grid', gap: 10, marginTop: 18, padding: 16, borderRadius: 10, background: 'var(--surface-muted)', fontSize: 13 }}>
            <div><dt style={{ color: 'var(--text-tertiary)', fontSize: 11, textTransform: 'uppercase' }}>Recipients</dt><dd style={{ marginTop: 3, fontWeight: 800 }}>{matchedParticipants.length} participant{matchedParticipants.length === 1 ? '' : 's'}</dd></div>
            <div><dt style={{ color: 'var(--text-tertiary)', fontSize: 11, textTransform: 'uppercase' }}>Subject</dt><dd style={{ marginTop: 3, fontWeight: 700 }}>{subject}</dd></div>
            <div><dt style={{ color: 'var(--text-tertiary)', fontSize: 11, textTransform: 'uppercase' }}>Audience</dt><dd style={{ marginTop: 3 }}>{audience.participantId !== 'all' ? participants.find(participant => String(participant.id) === audience.participantId)?.name : 'Everyone matching the selected filters'}</dd></div>
          </dl>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}><button onClick={() => setShowSendReview(false)} disabled={sending} style={{ padding: '10px 16px', border: '1px solid var(--border-default)', borderRadius: 8, background: 'var(--surface-card)', color: 'var(--text-secondary)', fontWeight: 700 }}>Cancel</button><button onClick={sendAnnouncement} disabled={previewReadOnly || sending} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '10px 16px', border: 0, borderRadius: 8, background: 'var(--color-navy-900)', color: '#fff', fontWeight: 800, opacity: previewReadOnly ? .5 : 1 }}><Send size={15}/>{previewReadOnly ? 'Sending disabled in preview' : sending ? 'Sending…' : `Send to ${matchedParticipants.length}`}</button></div>
        </section>
      </div>}
    </div>
  );
}
