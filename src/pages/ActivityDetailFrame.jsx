import { useParams } from 'react-router-dom';
import ActivityDetail from './ActivityDetail';
import ActivityOperationsPanel from '../components/ActivityOperationsPanel';
import ActivityWideCheckinPanel from '../components/ActivityWideCheckinPanel';
import { isReportingPreviewDemo } from '../lib/reportPreviewDemo';

export default function ActivityDetailFrame() {
  useParams();
  const preview = isReportingPreviewDemo();
  return (
    <div className="lexams-activity-detail-v2">
      <style>{`
        .lexams-activity-detail-v2 > div { max-width: 1240px; margin: 0 auto; }
        .lexams-activity-detail-v2 > div > div:nth-of-type(1) {
          margin-top:18px !important; padding:7px; gap:5px !important; overflow-x:auto;
          border:1px solid var(--border-default) !important;
          border-radius:13px; background:var(--surface-card); box-shadow:0 6px 20px rgba(0,43,84,.04);
        }
        .lexams-activity-detail-v2 > div > div:nth-of-type(1) button {
          flex:none; padding:9px 14px !important; border-radius:8px !important; border-bottom:0 !important;
        }
        .lexams-activity-detail-v2 > div > div:nth-of-type(1) button:hover { background:var(--surface-muted) !important; }
        .lexams-activity-detail-v2 > div > div:nth-of-type(n+2) { margin-top:20px; }
        .lexams-activity-detail-v2 .table-scroll { scrollbar-width:thin; }
        .lexams-activity-detail-v2 a[target="_blank"],
        .lexams-activity-detail-v2 button[aria-label^="Copy the"] {
          display:inline-grid; place-items:center; min-width:32px; min-height:32px; border-radius:8px !important;
        }
        @media(max-width:760px){
          .lexams-activity-detail-v2 > div > div:nth-of-type(1){margin-left:-4px !important;margin-right:-4px !important;}
          .lexams-activity-detail-v2 > div > div:nth-of-type(n+2) > div[style*="grid-template-columns: 2fr 1fr"],
          .lexams-activity-detail-v2 > div > div:nth-of-type(n+2) > div[style*="grid-template-columns: 1fr 1fr"]{grid-template-columns:1fr !important;}
        }
      `}</style>
      {!preview && <ActivityWideCheckinPanel />}
      {!preview && <ActivityOperationsPanel />}
      <ActivityDetail />
    </div>
  );
}
