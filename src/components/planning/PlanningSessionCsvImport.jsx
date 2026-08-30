import { useMemo, useRef, useState } from 'react';
import { Download, FileSpreadsheet, Upload, X } from 'lucide-react';
import { autoMapCsvHeaders, parseCsv } from '../../../shared/csv.js';
import { filterSessionFacilitatorsToTeam, normalizeSessionImportRow } from '../../../shared/planning.js';

const FIELDS = [
  { key: 'title', label: 'Session title', required: true, aliases: ['title', 'sessiontitle', 'session', 'topic'] },
  { key: 'session_date', label: 'Date', required: true, aliases: ['date', 'sessiondate', 'deliverydate'] },
  { key: 'starts_at', label: 'Start time', aliases: ['start', 'starttime', 'starts', 'startsat'] },
  { key: 'ends_at', label: 'End time', aliases: ['end', 'endtime', 'ends', 'endsat'] },
  { key: 'venue', label: 'Venue', aliases: ['venue', 'room', 'location'] },
  { key: 'description', label: 'Outline', aliases: ['description', 'outline', 'sessionoutline'] },
  { key: 'learning_objectives', label: 'Objectives', aliases: ['objectives', 'learningobjectives', 'outcomes'] },
  { key: 'planning_status', label: 'Planning status', aliases: ['status', 'planningstatus', 'preparationstatus'] },
  { key: 'lead_facilitator_email', label: 'Lead email', aliases: ['leademail', 'leadfacilitatoremail', 'leadfacilitator'] },
  { key: 'facilitator_emails', label: 'Other facilitator emails', aliases: ['facilitatoremails', 'facilitators', 'cofacilitators'] },
];

function mappedValue(cells, mapping, key) {
  const column = mapping[key];
  return column === '' || column === undefined ? '' : String(cells[Number(column)] || '').trim();
}

export default function PlanningSessionCsvImport({ activity, members, saving, onMutate, preview = false }) {
  const inputRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [fileName, setFileName] = useState('');
  const [headers, setHeaders] = useState([]);
  const [rows, setRows] = useState([]);
  const [mapping, setMapping] = useState({});
  const [duplicateMode, setDuplicateMode] = useState('skip');
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const activityStart = String(activity.start_date || '').slice(0, 10);
  const activityEnd = String(activity.end_date || activityStart).slice(0, 10);

  const teamEmails = useMemo(() => new Set(members.map(member => String(member.email || '').toLowerCase())), [members]);
  const preparedRows = useMemo(() => rows.map((cells, index) => {
    const raw = Object.fromEntries(FIELDS.map(field => [field.key, mappedValue(cells, mapping, field.key)]));
    const problems = [];
    const warnings = [];
    let data = raw;
    let displayFacilitatorEmails = [];
    try {
      data = normalizeSessionImportRow(raw, { minDate: activityStart, maxDate: activityEnd });
      if (data.session_date < activityStart || data.session_date > activityEnd) {
        problems.push(`Date ${data.session_date} is outside the activity period (${activityStart} to ${activityEnd})`);
      }
      const facilitatorMatch = filterSessionFacilitatorsToTeam(data, teamEmails);
      displayFacilitatorEmails = facilitatorMatch.facilitator_emails;
      if (facilitatorMatch.skipped_facilitator_emails.length) {
        warnings.push(`${facilitatorMatch.skipped_facilitator_emails.join(', ')} not on the team and will be skipped; session will still import`);
      }
    } catch (rowError) {
      problems.push(rowError.message);
    }
    return { rowNumber: index + 2, data, displayFacilitatorEmails, problems, warnings };
  }), [activityEnd, activityStart, mapping, rows, teamEmails]);

  const validRows = preparedRows.filter(row => !row.problems.length);
  const invalidCount = preparedRows.length - validRows.length;
  const warningCount = preparedRows.filter(row => row.warnings.length).length;
  const skippedFacilitatorCount = new Set(preparedRows.flatMap(row => row.warnings.length
    ? row.data.facilitator_emails.filter(email => !teamEmails.has(email))
    : [])).size;
  const importButtonLabel = preview
    ? 'Preview only'
    : saving
      ? 'Importing…'
      : invalidCount
        ? `Fix ${invalidCount} row${invalidCount === 1 ? '' : 's'} to import`
        : `Import ${validRows.length} session${validRows.length === 1 ? '' : 's'}`;

  function reset() {
    setFileName(''); setHeaders([]); setRows([]); setMapping({}); setError(''); setResult(null); setDuplicateMode('skip');
    if (inputRef.current) inputRef.current.value = '';
  }

  async function loadFile(file) {
    reset();
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.csv')) { setError('Choose a CSV file.'); return; }
    if (file.size > 2 * 1024 * 1024) { setError('CSV files must be 2 MB or smaller.'); return; }
    const parsed = parseCsv(await file.text());
    if (parsed.length < 2) { setError('The CSV needs a header row and at least one session.'); return; }
    if (parsed.length > 201) { setError('Import up to 200 sessions at a time.'); return; }
    const nextHeaders = parsed[0].map(value => String(value || '').trim());
    setFileName(file.name);
    setHeaders(nextHeaders);
    setRows(parsed.slice(1).filter(row => row.some(value => String(value || '').trim())));
    setMapping(autoMapCsvHeaders(nextHeaders, FIELDS));
  }

  function downloadTemplate() {
    const secondDateValue = new Date(`${activityStart}T00:00:00Z`);
    secondDateValue.setUTCDate(secondDateValue.getUTCDate() + 7);
    const secondDate = secondDateValue.toISOString().slice(0, 10) > activityEnd ? activityEnd : secondDateValue.toISOString().slice(0, 10);
    const facilitatorEmails = members.map(member => String(member.email || '').trim().toLowerCase()).filter(Boolean);
    const leadEmail = facilitatorEmails[0] || '';
    const coFacilitatorEmail = facilitatorEmails[1] || '';
    const secondLeadEmail = coFacilitatorEmail || leadEmail;
    const secondFacilitatorEmail = coFacilitatorEmail ? leadEmail : '';
    const csv = [
      'session_title,date,start_time,end_time,venue,objectives,outline,planning_status,lead_facilitator_email,facilitator_emails',
      `Opening and orientation,${activityStart},09:00,12:00,Training room A,Agree expectations and baseline skills,Welcome and practical orientation,ready,${leadEmail},${coFacilitatorEmail}`,
      `Applied practice lab,${secondDate},09:00,15:00,Innovation lab,Apply the learning in a practical task,Facilitated group project,draft,${secondLeadEmail},${secondFacilitatorEmail}`,
    ].join('\r\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'lexams-session-facilitator-import-template.csv';
    link.click();
    URL.revokeObjectURL(url);
  }

  async function runImport() {
    setError(''); setResult(null);
    if (invalidCount) { setError('Fix every highlighted row before importing.'); return; }
    if (!validRows.length) { setError('There are no valid sessions to import.'); return; }
    const response = await onMutate('import_sessions', { rows: validRows.map(row => row.data), duplicateMode }, 'Sessions and facilitator assignments imported.');
    if (response) setResult(response);
  }

  return <>
    <button className="planning-secondary-button" onClick={() => { reset(); setOpen(true); }}><Upload size={15}/>Import CSV</button>
    {open && <div className="planning-modal-backdrop" onMouseDown={event => event.target === event.currentTarget && !saving && setOpen(false)}>
      <section className="planning-modal planning-import-modal" role="dialog" aria-modal="true" aria-labelledby="planning-import-title">
        <header><div><span className="planning-kicker">Bulk schedule setup</span><h4 id="planning-import-title">Import sessions & facilitators</h4><p>Map your spreadsheet, review every row, then add the schedule in one step.</p></div><button className="planning-icon-button" onClick={() => setOpen(false)} aria-label="Close"><X size={18}/></button></header>
        <div className="planning-import-body">
          {preview && <div className="planning-message neutral">The importer is available for review in this preview. Production imports require an authenticated planning manager.</div>}
          <div className="planning-import-actions">
            <button className="planning-secondary-button" onClick={() => inputRef.current?.click()} disabled={saving}><FileSpreadsheet size={15}/>{fileName || 'Choose CSV'}</button>
            <button className="planning-secondary-button" onClick={downloadTemplate}><Download size={15}/>Download template</button>
            <input ref={inputRef} hidden type="file" accept=".csv,text/csv" onChange={event => loadFile(event.target.files?.[0])}/>
          </div>
          <p className="planning-import-help">Only <strong>Session title</strong> and <strong>Date</strong> are required. All other columns may be blank and completed later. Activity period: <strong>{activityStart} to {activityEnd}</strong>. Use YYYY-MM-DD where possible; dates saved by Excel in DD/MM/YYYY, MM/DD/YYYY, or serial form are also accepted. Use semicolons between multiple facilitator emails.</p>
          {error && <div className="planning-message error">{error}</div>}
          {headers.length > 0 && <>
            <section className="planning-import-section"><div className="planning-import-section-heading"><div><span className="planning-kicker">Step 1</span><h5>Map spreadsheet columns</h5></div><label><span>Existing session titles</span><select value={duplicateMode} onChange={event => setDuplicateMode(event.target.value)}><option value="skip">Skip existing</option><option value="update">Update existing</option></select></label></div>
              <div className="planning-import-map">{FIELDS.map(field => <label key={field.key}><span>{field.label}{field.required ? ' *' : ''}</span><select value={mapping[field.key] ?? ''} onChange={event => setMapping(current => ({ ...current, [field.key]: event.target.value }))}><option value="">Not mapped</option>{headers.map((header, index) => <option key={`${header}-${index}`} value={String(index)}>{header || `Column ${index + 1}`}</option>)}</select></label>)}</div>
            </section>
            <div className="planning-import-summary"><div><strong>{preparedRows.length}</strong><span>Rows</span></div><div><strong>{validRows.length}</strong><span>Ready</span></div><div><strong>{invalidCount}</strong><span>Needs fixing</span></div><div><strong>{new Set(validRows.flatMap(row => row.data.facilitator_emails)).size}</strong><span>Facilitators</span></div></div>
            {invalidCount > 0 && <div id="planning-import-blocker" className="planning-message error"><span><strong>Import is paused.</strong> {invalidCount} row{invalidCount === 1 ? '' : 's'} need fixing. Check the Status column below for the exact date, mapping, or facilitator issue.</span></div>}
            {warningCount > 0 && <div className="planning-message warning"><span><strong>{warningCount} row{warningCount === 1 ? '' : 's'} will still import.</strong> {skippedFacilitatorCount} facilitator email{skippedFacilitatorCount === 1 ? '' : 's'} will be skipped because they are not active team members. Assign them after import when ready.</span></div>}
            <section className="planning-import-preview"><div className="planning-import-row planning-import-row-head"><span>Row</span><span>Session</span><span>Date & time</span><span>Facilitators</span><span>Status</span></div>{preparedRows.slice(0, 10).map(row => <div className="planning-import-row" key={row.rowNumber}><span>{row.rowNumber}</span><span><strong>{row.data.title || '—'}</strong><small>{row.data.venue || 'Venue not set'}</small></span><span>{row.data.session_date || '—'}<small>{row.data.starts_at || 'Time not set'}{row.data.ends_at ? `–${row.data.ends_at}` : ''}</small></span><span>{row.displayFacilitatorEmails.join(', ') || 'Unassigned'}</span><span className={row.problems.length ? 'planning-import-invalid' : row.warnings.length ? 'planning-import-warning' : 'planning-import-valid'}>{row.problems.length ? row.problems.join(' · ') : row.warnings.length ? row.warnings.join(' · ') : 'Ready'}</span></div>)}</section>
            {preparedRows.length > 10 && <p className="planning-import-help">Showing 10 of {preparedRows.length} rows.</p>}
          </>}
          {result && <div className="planning-message success"><span><strong>Import complete.</strong> {result.created || 0} created, {result.updated || 0} updated, {result.skipped || 0} skipped, {result.facilitatorsAssigned || 0} facilitator assignments{result.facilitatorsSkipped ? `, ${result.facilitatorsSkipped} unavailable facilitator ${result.facilitatorsSkipped === 1 ? 'email' : 'emails'} left unassigned` : ''}.</span></div>}
        </div>
        <footer><button className="planning-secondary-button" onClick={() => setOpen(false)} disabled={saving}>Close</button><button className="planning-primary-button" onClick={runImport} disabled={saving || !validRows.length || Boolean(invalidCount) || preview} aria-describedby={invalidCount ? 'planning-import-blocker' : undefined}>{importButtonLabel}</button></footer>
      </section>
    </div>}
  </>;
}
