const DATE_NOT_SET = 'Date not set';

function parseDate(value) {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === 'number') {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const text = String(value ?? '').trim();
  if (!text) return null;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(text)
    ? new Date(`${text}T00:00:00`)
    : new Date(text);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function fmtDate(value) {
  const date = parseDate(value);
  if (!date) return DATE_NOT_SET;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function fmtRange(a = {}) {
  const start = parseDate(a.start ?? a.start_date);
  const end = parseDate(a.end ?? a.end_date);
  if (!start && !end) return DATE_NOT_SET;
  if (!start || !end) return fmtDate(start || end);

  if (start.toDateString() === end.toDateString()) return fmtDate(start);
  const sm = start.toLocaleDateString('en-US', { month: 'short' });
  const em = end.toLocaleDateString('en-US', { month: 'short' });
  if (sm === em && start.getFullYear() === end.getFullYear()) return sm + ' ' + start.getDate() + '\u2013' + end.getDate() + ', ' + end.getFullYear();
  return sm + ' ' + start.getDate() + ' \u2013 ' + em + ' ' + end.getDate() + ', ' + end.getFullYear();
}

export function statusChip(status) {
  const tones = {
    Completed: { bg: '#E4F3E9', color: 'var(--color-success)' },
    Ongoing: { bg: '#FDF3DC', color: '#8A6210' },
    Upcoming: { bg: 'var(--surface-muted)', color: 'var(--text-secondary)' },
    present: { bg: '#E4F3E9', color: 'var(--color-success)' },
    late: { bg: '#FCEEDB', color: 'var(--color-warning)' },
    absent: { bg: '#F9E4E2', color: 'var(--color-danger)' },
  };
  const t = tones[status] || tones.Upcoming;
  return {
    display: 'inline-flex', alignItems: 'center',
    padding: '3px 10px', borderRadius: 999,
    fontSize: 12, fontWeight: 600,
    background: t.bg, color: t.color,
    whiteSpace: 'nowrap',
  };
}

export function initials(name) {
  return String(name || '').split(' ').filter(Boolean).map(n => n[0]).join('').slice(0, 2).toUpperCase();
}
