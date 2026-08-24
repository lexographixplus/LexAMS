import { useMemo, useRef, useState } from 'react';
import { Download, FileSpreadsheet, Upload, X } from 'lucide-react';
import { useData } from '../contexts/DataContext';

const FIELDS = [
  ['name', 'Name', true],
  ['email', 'Email', true],
  ['phone', 'Phone', false],
  ['org', 'Organization', false],
  ['category', 'Category', false],
];

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i += 1; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else if (ch !== '\r') cell += ch;
  }
  row.push(cell);
  if (row.some(v => v.trim())) rows.push(row);
  return rows;
}

function normalizeHeader(value) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function autoMap(headers) {
  const aliases = {
    name: ['name', 'fullname', 'participantname'],
    email: ['email', 'emailaddress', 'mail'],
    phone: ['phone', 'phonenumber', 'mobile', 'telephone'],
    org: ['organization', 'organisation', 'org', 'institution', 'company'],
    category: ['category', 'type', 'participantcategory', 'role'],
  };
  const normalized = headers.map(normalizeHeader);
  return Object.fromEntries(FIELDS.map(([key]) => {
    const idx = normalized.findIndex(h => aliases[key].includes(h));
    return [key, idx >= 0 ? String(idx) : ''];
  }));
}

function validEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
}

export default function ParticipantCsvImport() {
  const { activities, participants, addParticipant, updateParticipant, addRegistration, isAdmin } = useData();
  const inputRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [fileName, setFileName] = useState('');
  const [headers, setHeaders] = useState([]);
  const [rows, setRows] = useState([]);
  const [mapping, setMapping] = useState({});
  const [duplicateMode, setDuplicateMode] = useState('skip');
  const [activityId, setActivityId] = useState('');
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const mappedRows = useMemo(() => rows.map((cells, index) => {
    const data = {};
    FIELDS.forEach(([key]) => {
      const col = mapping[key];
      data[key] = col === '' || col == null ? '' : String(cells[Number(col)] || '').trim();
    });
    const problems = [];
    if (!data.name) problems.push('Missing name');
    if (!data.email) problems.push('Missing email');
    else if (!validEmail(data.email)) problems.push('Invalid email');
    return { index: index + 2, data, problems };
  }), [rows, mapping]);

  const duplicateEmails = useMemo(() => new Set(participants.map(p => String(p.email || '').toLowerCase())), [participants]);
  const validRows = mappedRows.filter(r => r.problems.length === 0);
  const duplicateCount = validRows.filter(r => duplicateEmails.has(r.data.email.toLowerCase())).length;
  const invalidCount = mappedRows.length - validRows.length;

  function reset() {
    setFileName(''); setHeaders([]); setRows([]); setMapping({}); setResult(null); setError('');
    setDuplicateMode('skip'); setActivityId('');
    if (inputRef.current) inputRef.current.value = '';
  }

  async function loadFile(file) {
    reset();
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.csv')) { setError('Choose a CSV file.'); return; }
    if (file.size > 2 * 1024 * 1024) { setError('CSV files must be 2 MB or smaller.'); return; }
    const parsed = parseCsv(await file.text());
    if (parsed.length < 2) { setError('The CSV needs a header row and at least one participant.'); return; }
    if (parsed.length > 1001) { setError('Import up to 1,000 participants at a time.'); return; }
    const hdr = parsed[0].map(v => String(v || '').trim());
    setFileName(file.name); setHeaders(hdr); setRows(parsed.slice(1).filter(r => r.some(v => String(v || '').trim()))); setMapping(autoMap(hdr));
  }

  function downloadTemplate() {
    const csv = 'name,email,phone,organization,category\nJane Doe,jane@example.org,+2200000000,Example Organization,Community member\n';
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'lexams-participant-import-template.csv'; a.click(); URL.revokeObjectURL(url);
  }

  function participantForCreate(data) {
    return {
      name: data.name,
      email: data.email,
      phone: data.phone || null,
      org: data.org || null,
      category: data.category || 'Community member',
    };
  }

  function participantUpdates(data) {
    const updates = { name: data.name, email: data.email };
    for (const key of ['phone', 'org', 'category']) {
      if (mapping[key] !== '' && mapping[key] != null && data[key]) updates[key] = data[key];
    }
    return updates;
  }

  async function runImport() {
    setError(''); setResult(null);
    if (mapping.name === '' || mapping.email === '' || mapping.name == null || mapping.email == null) { setError('Map both Name and Email before importing.'); return; }
    if (!validRows.length) { setError('There are no valid rows to import.'); return; }
    setImporting(true);
    let created = 0, updated = 0, skipped = 0, failed = 0;
    const byEmail = new Map(participants.map(p => [String(p.email || '').toLowerCase(), p]));
    for (const row of validRows) {
      const emailKey = row.data.email.toLowerCase();
      const existing = byEmail.get(emailKey);
      try {
        if (existing) {
          if (duplicateMode === 'skip') { skipped += 1; continue; }
          await updateParticipant(existing.id, participantUpdates(row.data));
          if (activityId) await addRegistration(Number(activityId), existing.id);
          updated += 1;
        } else {
          const createdParticipant = await addParticipant(participantForCreate(row.data));
          if (createdParticipant?.pending) { failed += 1; continue; }
          if (activityId) await addRegistration(Number(activityId), createdParticipant.id);
          byEmail.set(emailKey, createdParticipant);
          created += 1;
        }
      } catch (e) {
        console.error('CSV participant import row failed', row.index, e);
        failed += 1;
      }
    }
    setResult({ created, updated, skipped, failed, invalid: invalidCount });
    setImporting(false);
  }

  if (!isAdmin) return null;

  return (
    <>
      <button className="lexams-import-trigger" onClick={() => { reset(); setOpen(true); }}>
        <Upload size={15} /> Import CSV
      </button>
      {open && (
        <div className="lexams-import-backdrop" onMouseDown={e => { if (e.target === e.currentTarget && !importing) setOpen(false); }}>
          <section className="lexams-import-modal" role="dialog" aria-modal="true" aria-labelledby="csv-import-title">
            <div className="lexams-import-head">
              <div><div className="lexams-import-kicker">Bulk participant import</div><h2 id="csv-import-title">Import participants from CSV</h2><p>Preview and validate records before anything is written to LexAMS.</p></div>
              <button className="lexams-icon-button" onClick={() => setOpen(false)} disabled={importing} aria-label="Close"><X size={18}/></button>
            </div>

            <div className="lexams-import-actions">
              <button className="lexams-secondary-action" onClick={() => inputRef.current?.click()} disabled={importing}><FileSpreadsheet size={15}/> {fileName || 'Choose CSV'}</button>
              <button className="lexams-secondary-action" onClick={downloadTemplate}><Download size={15}/> Download template</button>
              <input ref={inputRef} type="file" accept=".csv,text/csv" hidden onChange={e => loadFile(e.target.files?.[0])}/>
            </div>

            {error && <div className="lexams-import-error">{error}</div>}

            {headers.length > 0 && (
              <>
                <div className="lexams-import-section">
                  <div className="lexams-import-section-title">Map CSV columns</div>
                  <div className="lexams-map-grid">
                    {FIELDS.map(([key, label, required]) => <label key={key}><span>{label}{required ? ' *' : ''}</span><select value={mapping[key] ?? ''} onChange={e => setMapping(m => ({ ...m, [key]: e.target.value }))}><option value="">Not mapped</option>{headers.map((h, i) => <option value={String(i)} key={`${h}-${i}`}>{h || `Column ${i + 1}`}</option>)}</select></label>)}
                  </div>
                </div>

                <div className="lexams-import-section lexams-import-options">
                  <label><span>Existing email addresses</span><select value={duplicateMode} onChange={e => setDuplicateMode(e.target.value)}><option value="skip">Skip duplicates</option><option value="update">Update existing participant</option></select></label>
                  <label><span>Assign imported participants to activity</span><select value={activityId} onChange={e => setActivityId(e.target.value)}><option value="">No activity assignment</option>{activities.map(a => <option key={a.id} value={a.id}>{a.title}</option>)}</select></label>
                </div>

                <div className="lexams-import-summary">
                  <div><strong>{mappedRows.length}</strong><span>Rows</span></div><div><strong>{validRows.length}</strong><span>Valid</span></div><div><strong>{duplicateCount}</strong><span>Existing</span></div><div><strong>{invalidCount}</strong><span>Needs fixing</span></div>
                </div>

                <div className="lexams-import-preview table-scroll"><div style={{ minWidth: 720 }}><div className="lexams-import-row lexams-import-row-head"><span>Row</span><span>Name</span><span>Email</span><span>Organization</span><span>Category</span><span>Status</span></div>{mappedRows.slice(0, 8).map(r => <div className="lexams-import-row" key={r.index}><span>{r.index}</span><span>{r.data.name || '—'}</span><span>{r.data.email || '—'}</span><span>{r.data.org || '—'}</span><span>{r.data.category || 'Community member'}</span><span className={r.problems.length ? 'lexams-row-bad' : 'lexams-row-good'}>{r.problems.length ? r.problems.join(', ') : duplicateEmails.has(r.data.email.toLowerCase()) ? 'Existing' : 'Ready'}</span></div>)}</div></div>
                {mappedRows.length > 8 && <div className="lexams-import-more">Showing 8 of {mappedRows.length} rows</div>}
              </>
            )}

            {result && <div className="lexams-import-result"><strong>Import complete.</strong> {result.created} created, {result.updated} updated, {result.skipped} skipped, {result.invalid} invalid, {result.failed} failed.</div>}

            <div className="lexams-import-footer"><button className="lexams-secondary-action" onClick={() => setOpen(false)} disabled={importing}>Close</button><button className="lexams-primary-action" onClick={runImport} disabled={importing || !validRows.length}>{importing ? 'Importing…' : `Import ${validRows.length} valid participant${validRows.length === 1 ? '' : 's'}`}</button></div>
          </section>
        </div>
      )}
    </>
  );
}
