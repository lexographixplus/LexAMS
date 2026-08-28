import { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Check, PenLine, Plus, Save, Upload, UserRoundCheck } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const card = {
  background: 'var(--surface-card)',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-lg)',
  boxShadow: 'var(--shadow-card)',
};

const input = {
  width: '100%',
  border: '1px solid var(--border-default)',
  borderRadius: 8,
  padding: '9px 10px',
  background: 'var(--surface-card)',
  color: 'var(--text-primary)',
  fontSize: 13,
};

const smallLabel = {
  display: 'block',
  marginBottom: 5,
  color: 'var(--text-tertiary)',
  fontSize: 10,
  fontWeight: 800,
  letterSpacing: '.06em',
  textTransform: 'uppercase',
};

async function request(options = {}) {
  const response = await fetch('/api/signatories', {
    credentials: 'include',
    ...options,
    headers: {
      ...(options.body && !(options.body instanceof FormData) ? { 'content-type': 'application/json' } : {}),
      ...(options.headers || {}),
    },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || 'Could not update certificate signatories');
  return body;
}

function defaultConfigItem(id) {
  return {
    signatory_id: Number(id),
    show_signature: true,
    show_name: true,
    show_title: true,
    show_organization: false,
  };
}

function ConfigEditor({ signatories, config, onChange, disabled }) {
  const active = signatories.filter(item => item.active);
  const selectedIds = new Set(config.map(item => Number(item.signatory_id)));

  function toggle(id) {
    if (disabled) return;
    const numeric = Number(id);
    if (selectedIds.has(numeric)) {
      onChange(config.filter(item => Number(item.signatory_id) !== numeric));
      return;
    }
    if (config.length >= 4) return;
    onChange([...config, defaultConfigItem(numeric)]);
  }

  function patch(index, key, value) {
    onChange(config.map((item, current) => current === index ? { ...item, [key]: value } : item));
  }

  function move(index, direction) {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= config.length) return;
    const next = [...config];
    [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
    onChange(next);
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {active.map(item => {
          const selected = selectedIds.has(Number(item.id));
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => toggle(item.id)}
              disabled={disabled || (!selected && config.length >= 4)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '7px 10px', borderRadius: 999,
                border: selected ? '1px solid var(--color-navy-700)' : '1px solid var(--border-default)',
                background: selected ? '#EEF3F8' : 'var(--surface-card)', color: 'var(--text-primary)',
                fontSize: 12, fontWeight: selected ? 800 : 600, cursor: disabled ? 'default' : 'pointer',
                opacity: disabled ? .65 : 1,
              }}
            >
              {selected && <Check size={13} />}{item.full_name}
            </button>
          );
        })}
        {!active.length && <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Add an active signatory first.</span>}
      </div>

      {config.length > 0 && (
        <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
          {config.map((item, index) => {
            const signatory = signatories.find(row => Number(row.id) === Number(item.signatory_id));
            if (!signatory) return null;
            return (
              <div key={item.signatory_id} style={{ border: '1px solid var(--border-default)', borderRadius: 9, padding: 10, background: 'var(--surface-muted)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 800 }}>{index + 1}. {signatory.full_name}</div>
                    <div style={{ marginTop: 2, fontSize: 11, color: 'var(--text-secondary)' }}>{signatory.title || 'No title set'}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button type="button" disabled={disabled || index === 0} onClick={() => move(index, -1)} title="Move left" style={{ border: '1px solid var(--border-default)', background: '#fff', borderRadius: 6, padding: 5 }}><ArrowUp size={13} /></button>
                    <button type="button" disabled={disabled || index === config.length - 1} onClick={() => move(index, 1)} title="Move right" style={{ border: '1px solid var(--border-default)', background: '#fff', borderRadius: 6, padding: 5 }}><ArrowDown size={13} /></button>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 8, fontSize: 11, color: 'var(--text-secondary)' }}>
                  {[
                    ['show_signature', 'Signature'],
                    ['show_name', 'Name'],
                    ['show_title', 'Title'],
                    ['show_organization', 'Organisation'],
                  ].map(([key, label]) => (
                    <label key={key} style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                      <input type="checkbox" disabled={disabled} checked={item[key] === true} onChange={event => patch(index, key, event.target.checked)} /> {label}
                    </label>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
      <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-tertiary)' }}>Up to four signatories. Their order here is the order shown on the certificate.</div>
    </div>
  );
}

export default function CertificateSignatoriesSettings() {
  const { isAdmin } = useAuth();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [signatories, setSignatories] = useState([]);
  const [defaultConfig, setDefaultConfig] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [templateConfig, setTemplateConfig] = useState([]);
  const [draft, setDraft] = useState({ fullName: '', title: '', organizationLabel: '' });
  const [edits, setEdits] = useState({});

  async function load() {
    setLoading(true); setError('');
    try {
      const data = await request();
      setSignatories(data.signatories || []);
      setDefaultConfig(data.default_config || []);
      setTemplates(data.award_templates || []);
      setEdits(Object.fromEntries((data.signatories || []).map(item => [item.id, {
        fullName: item.full_name || '',
        title: item.title || '',
        organizationLabel: item.organization_label || '',
        signatureMode: item.signature_mode || 'typed',
      }])));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const selectedTemplate = useMemo(
    () => templates.find(item => String(item.id) === String(selectedTemplateId)) || null,
    [templates, selectedTemplateId]
  );

  useEffect(() => {
    setTemplateConfig(selectedTemplate?.signatory_config || []);
  }, [selectedTemplate]);

  function show(message) {
    setNotice(message);
    window.setTimeout(() => setNotice(''), 3000);
  }

  async function createSignatory() {
    if (!draft.fullName.trim() || busy) return;
    setBusy(true); setError('');
    try {
      await request({ method: 'POST', body: JSON.stringify({ action: 'create', ...draft }) });
      setDraft({ fullName: '', title: '', organizationLabel: '' });
      await load(); show('Signatory added.');
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  async function saveSignatory(id) {
    if (busy) return;
    setBusy(true); setError('');
    try {
      await request({ method: 'POST', body: JSON.stringify({ action: 'update', id, ...edits[id] }) });
      await load(); show('Signatory details saved.');
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  async function setActive(id, active) {
    if (busy) return;
    setBusy(true); setError('');
    try {
      await request({ method: 'POST', body: JSON.stringify({ action: 'set_active', id, active }) });
      await load(); show(active ? 'Signatory activated.' : 'Signatory deactivated.');
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  async function uploadSignature(id, file) {
    if (!file || busy) return;
    const form = new FormData();
    form.append('action', 'upload_signature');
    form.append('signatoryId', String(id));
    form.append('file', file);
    setBusy(true); setError('');
    try {
      await request({ method: 'POST', body: form });
      await load(); show('Signature image uploaded securely.');
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  async function saveDefaults() {
    if (busy) return;
    setBusy(true); setError('');
    try {
      await request({ method: 'POST', body: JSON.stringify({ action: 'set_defaults', config: defaultConfig }) });
      await load(); show('Default certificate signatories saved.');
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  async function saveTemplateConfig() {
    if (!selectedTemplate || busy) return;
    setBusy(true); setError('');
    try {
      await request({ method: 'POST', body: JSON.stringify({ action: 'set_template_config', templateId: selectedTemplate.id, config: templateConfig }) });
      await load(); show(templateConfig.length ? 'Award template signatories saved.' : 'Award template will use organisation defaults.');
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  if (loading) return <div style={{ ...card, marginTop: 24, padding: 24, color: 'var(--text-secondary)', fontSize: 13 }}>Loading certificate signatories…</div>;

  return (
    <section style={{ ...card, marginTop: 24, overflow: 'hidden' }}>
      <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-default)', display: 'flex', gap: 12, justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><UserRoundCheck size={19} color="var(--color-gold-600)" /><h3 style={{ margin: 0, fontSize: 17 }}>Certificate signatories</h3></div>
          <p style={{ margin: '6px 0 0', color: 'var(--text-secondary)', fontSize: 13, maxWidth: 760, lineHeight: 1.55 }}>
            Maintain authorised signers once and reuse them on completion certificates and awards. Newly issued certificates keep a permanent snapshot of the signer details used at issuance.
          </p>
        </div>
      </div>

      {error && <div role="alert" style={{ margin: '16px 24px 0', padding: 11, borderRadius: 8, background: '#FFF1F0', color: '#9B2C2C', fontSize: 13 }}>{error}</div>}
      {notice && <div role="status" style={{ margin: '16px 24px 0', padding: 11, borderRadius: 8, background: '#EDF8F0', color: '#176B3A', fontSize: 13 }}>{notice}</div>}
      {!isAdmin && <div style={{ margin: '16px 24px 0', padding: 11, borderRadius: 8, background: 'var(--surface-muted)', color: 'var(--text-secondary)', fontSize: 13 }}>Only workspace owners and administrators can change signatories or signature files.</div>}

      <div className="lex-signatory-settings-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.1fr) minmax(300px,.9fr)', gap: 20, padding: 24 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 800 }}>Signatory directory</div>
          <div style={{ marginTop: 4, fontSize: 12, color: 'var(--text-secondary)' }}>Use transparent PNG signatures when available. Typed display signatures remain clearly distinct from uploaded handwritten signatures.</div>

          {isAdmin && (
            <div style={{ marginTop: 14, padding: 14, border: '1px solid var(--border-default)', borderRadius: 10, background: 'var(--surface-muted)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr 1fr', gap: 9 }}>
                <div><label style={smallLabel}>Full name</label><input style={input} value={draft.fullName} onChange={event => setDraft(current => ({ ...current, fullName: event.target.value }))} placeholder="Full name" /></div>
                <div><label style={smallLabel}>Title / position</label><input style={input} value={draft.title} onChange={event => setDraft(current => ({ ...current, title: event.target.value }))} placeholder="Executive Director" /></div>
                <div><label style={smallLabel}>Organisation label</label><input style={input} value={draft.organizationLabel} onChange={event => setDraft(current => ({ ...current, organizationLabel: event.target.value }))} placeholder="Optional" /></div>
              </div>
              <button type="button" onClick={createSignatory} disabled={busy || !draft.fullName.trim()} style={{ marginTop: 10, display: 'flex', gap: 6, alignItems: 'center', border: 0, borderRadius: 8, background: 'var(--color-navy-900)', color: '#fff', padding: '9px 12px', fontWeight: 800 }}><Plus size={14} />Add signatory</button>
            </div>
          )}

          <div style={{ display: 'grid', gap: 11, marginTop: 14 }}>
            {signatories.map(item => {
              const edit = edits[item.id] || {};
              return (
                <div key={item.id} style={{ border: '1px solid var(--border-default)', borderRadius: 11, padding: 14, opacity: item.active ? 1 : .65 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '88px minmax(0,1fr)', gap: 14 }}>
                    <div style={{ minHeight: 72, borderRadius: 8, border: '1px solid var(--border-default)', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                      {item.signature_mode === 'uploaded' && item.signature_preview_url
                        ? <img src={`${item.signature_preview_url}&v=${encodeURIComponent(item.updated_at || '')}`} alt={`${item.full_name} signature`} style={{ maxWidth: 82, maxHeight: 58, objectFit: 'contain' }} />
                        : <span style={{ fontFamily: 'cursive', fontSize: 17, color: '#002B54', padding: 8, textAlign: 'center' }}>{item.full_name}</span>}
                    </div>
                    <div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                        <input disabled={!isAdmin} style={input} value={edit.fullName || ''} onChange={event => setEdits(current => ({ ...current, [item.id]: { ...edit, fullName: event.target.value } }))} />
                        <input disabled={!isAdmin} style={input} value={edit.title || ''} onChange={event => setEdits(current => ({ ...current, [item.id]: { ...edit, title: event.target.value } }))} placeholder="Title / position" />
                        <input disabled={!isAdmin} style={input} value={edit.organizationLabel || ''} onChange={event => setEdits(current => ({ ...current, [item.id]: { ...edit, organizationLabel: event.target.value } }))} placeholder="Organisation label (optional)" />
                        <select disabled={!isAdmin} style={input} value={edit.signatureMode || 'typed'} onChange={event => setEdits(current => ({ ...current, [item.id]: { ...edit, signatureMode: event.target.value } }))}>
                          <option value="typed">Typed display signature</option>
                          <option value="uploaded" disabled={!item.has_signature}>Uploaded signature</option>
                        </select>
                      </div>
                      {isAdmin && (
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 9 }}>
                          <button type="button" onClick={() => saveSignatory(item.id)} disabled={busy} style={{ display: 'flex', gap: 5, alignItems: 'center', padding: '7px 10px', border: '1px solid var(--border-default)', borderRadius: 7, background: '#fff', fontSize: 12, fontWeight: 800 }}><Save size={13} />Save</button>
                          <label style={{ display: 'flex', gap: 5, alignItems: 'center', padding: '7px 10px', border: '1px solid var(--border-default)', borderRadius: 7, background: '#fff', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}><Upload size={13} />{item.has_signature ? 'Replace signature' : 'Upload signature'}<input type="file" accept="image/png,image/jpeg,image/webp" onChange={event => { uploadSignature(item.id, event.target.files?.[0]); event.target.value = ''; }} style={{ display: 'none' }} /></label>
                          <button type="button" onClick={() => setActive(item.id, !item.active)} disabled={busy} style={{ padding: '7px 10px', border: '1px solid var(--border-default)', borderRadius: 7, background: '#fff', fontSize: 12, fontWeight: 800 }}>{item.active ? 'Deactivate' : 'Activate'}</button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            {!signatories.length && <div style={{ padding: 18, border: '1px dashed var(--border-default)', borderRadius: 10, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>No signatories configured yet.</div>}
          </div>
        </div>

        <div style={{ display: 'grid', alignContent: 'start', gap: 16 }}>
          <div style={{ border: '1px solid var(--border-default)', borderRadius: 11, padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}><PenLine size={16} /><div style={{ fontSize: 14, fontWeight: 800 }}>Default certificate signatories</div></div>
            <p style={{ margin: '5px 0 13px', fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>These signers are automatically captured when a completion certificate or one-off award is issued.</p>
            <ConfigEditor signatories={signatories} config={defaultConfig} onChange={setDefaultConfig} disabled={!isAdmin || busy} />
            {isAdmin && <button type="button" onClick={saveDefaults} disabled={busy} style={{ marginTop: 12, display: 'flex', gap: 6, alignItems: 'center', border: 0, borderRadius: 8, background: 'var(--color-navy-900)', color: '#fff', padding: '9px 12px', fontWeight: 800 }}><Save size={14} />Save defaults</button>}
          </div>

          {templates.length > 0 && (
            <div style={{ border: '1px solid var(--border-default)', borderRadius: 11, padding: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 800 }}>Award template override</div>
              <p style={{ margin: '5px 0 11px', fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>Optionally give a reusable award template its own signers. An empty override inherits the organisation defaults.</p>
              <select style={input} value={selectedTemplateId} onChange={event => setSelectedTemplateId(event.target.value)}>
                <option value="">Select award template</option>
                {templates.map(template => <option key={template.id} value={template.id}>{template.name}</option>)}
              </select>
              {selectedTemplate && (
                <div style={{ marginTop: 12 }}>
                  <ConfigEditor signatories={signatories} config={templateConfig} onChange={setTemplateConfig} disabled={!isAdmin || busy} />
                  {isAdmin && <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
                    <button type="button" onClick={saveTemplateConfig} disabled={busy} style={{ display: 'flex', gap: 6, alignItems: 'center', border: 0, borderRadius: 8, background: 'var(--color-navy-900)', color: '#fff', padding: '9px 12px', fontWeight: 800 }}><Save size={14} />Save template signers</button>
                    <button type="button" onClick={() => setTemplateConfig([])} disabled={busy} style={{ border: '1px solid var(--border-default)', borderRadius: 8, background: '#fff', padding: '9px 12px', fontWeight: 800 }}>Use defaults</button>
                  </div>}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
