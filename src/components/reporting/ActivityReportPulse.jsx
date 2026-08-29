import { useEffect, useState } from 'react';
import { AlertTriangle, BookOpenCheck, ChevronRight } from 'lucide-react';
import { getActivityReportPreview } from '../../lib/activityReportPreviewDemo';
import { isReportingPreviewDemo } from '../../lib/reportPreviewDemo';
import '../planning/activity-operational-pulse.css';

export default function ActivityReportPulse({ activity, onOpenReport }) {
  const preview = isReportingPreviewDemo();
  const [data, setData] = useState(() => preview ? getActivityReportPreview(activity) : null);

  useEffect(() => {
    if (preview) return;
    const controller = new AbortController();
    fetch(`/api/activity-reports/${activity.id}`, { credentials: 'include', signal: controller.signal })
      .then(response => response.ok ? response.json() : null)
      .then(body => { if (body) setData(body); })
      .catch(() => undefined);
    return () => controller.abort();
  }, [activity.id, preview]);

  const report = data?.reports?.[0];
  if (!report) return <section className="activity-report-pulse empty"><div><BookOpenCheck size={20}/><span>Living report</span></div><h4>Reporting can start now</h4><p>Choose a template and let activity records fill the report progressively.</p><button onClick={onOpenReport}>Start report <ChevronRight size={14}/></button></section>;
  const stale = report.sections.filter(section => section.source_changed).length;
  return <section className="activity-report-pulse"><header><div><BookOpenCheck size={19}/><span>Living report</span></div><strong>{report.completion.percent}%</strong></header><h4>{report.title}</h4><div className="activity-report-pulse-progress"><i style={{ width: `${report.completion.percent}%` }}/></div><p>{report.completion.completed} of {report.completion.total} sections complete · {report.status.replaceAll('_', ' ')}</p>{stale > 0 && <div className="activity-report-pulse-warning"><AlertTriangle size={13}/>{stale} section{stale === 1 ? '' : 's'} need source review</div>}<button onClick={onOpenReport}>Open report <ChevronRight size={14}/></button></section>;
}
