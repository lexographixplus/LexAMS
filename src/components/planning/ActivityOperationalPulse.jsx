import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, BookOpenText, CalendarCheck2, WalletCards } from 'lucide-react';
import { calculateBudgetSummary, calculateJournalSummary, calculatePlanningSummary } from '../../../shared/planning.js';
import { isReportingPreviewDemo } from '../../lib/reportPreviewDemo';
import { getPlanningPreview } from '../../lib/planningPreviewDemo';
import './activity-operational-pulse.css';

function money(value, currency) {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 0 }).format(Number(value || 0));
}

export default function ActivityOperationalPulse({ activity, onOpenPlanning }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    const pending = isReportingPreviewDemo()
      ? Promise.resolve(getPlanningPreview(activity))
      : fetch(`/api/activity-planning/${encodeURIComponent(activity.id)}`, { credentials: 'include' }).then(async response => {
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body.error || 'Operational summary unavailable.');
        return body;
      });
    pending.then(result => { if (active) setData(result); }).catch(loadError => { if (active) setError(loadError.message); });
    return () => { active = false; };
  }, [activity]);

  const planning = useMemo(() => calculatePlanningSummary(data || {}), [data]);
  const budget = useMemo(() => calculateBudgetSummary(data?.budgetItems || []), [data?.budgetItems]);
  const journal = useMemo(() => calculateJournalSummary(data?.journalEntries || []), [data?.journalEntries]);
  if (!data) return error ? null : <section className="activity-pulse activity-pulse-loading" aria-label="Loading activity operations"/>;
  const currency = data.activity.budget_currency || 'GMD';

  return <section className="activity-pulse">
    <header><div><span>Training operations</span><h3>Where this activity stands</h3></div><button onClick={onOpenPlanning}>Open workspace <ArrowRight size={14}/></button></header>
    <div className="activity-pulse-grid">
      <article><CalendarCheck2 size={18}/><div><span>Planning readiness</span><strong>{planning.planningProgressPercent}%</strong><small>{planning.overdueTasks} overdue task{planning.overdueTasks === 1 ? '' : 's'}</small></div></article>
      <article><WalletCards size={18}/><div><span>Budget position</span><strong>{budget.itemCount ? `${budget.usedPercent ?? 0}% used` : 'Not started'}</strong><small>{budget.itemCount ? `${money(budget.actual, currency)} spent` : 'Add a lightweight activity budget'}</small></div></article>
      <article><BookOpenText size={18}/><div><span>Implementation record</span><strong>{journal.entryCount} update{journal.entryCount === 1 ? '' : 's'}</strong><small>{journal.openFollowUps} open follow-up{journal.openFollowUps === 1 ? '' : 's'}</small></div></article>
    </div>
    {journal.latestEntry && <p><strong>Latest:</strong> {journal.latestEntry.progress_summary}</p>}
  </section>;
}
