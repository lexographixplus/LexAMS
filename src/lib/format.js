export function fmtDate(iso) {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function fmtRange(a) {
  if (a.start === a.end) return fmtDate(a.start);
  const s = new Date(a.start + 'T00:00:00');
  const e = new Date(a.end + 'T00:00:00');
  const sm = s.toLocaleDateString('en-US', { month: 'short' });
  const em = e.toLocaleDateString('en-US', { month: 'short' });
  if (sm === em) return sm + ' ' + s.getDate() + '\u2013' + e.getDate() + ', ' + e.getFullYear();
  return sm + ' ' + s.getDate() + ' \u2013 ' + em + ' ' + e.getDate() + ', ' + e.getFullYear();
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
  return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
}
