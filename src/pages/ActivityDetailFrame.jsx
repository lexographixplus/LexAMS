import { Award } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import ActivityDetail from './ActivityDetail';
import ActivityOperationsPanel from '../components/ActivityOperationsPanel';
import ActivityWideCheckinPanel from '../components/ActivityWideCheckinPanel';
import { isReportingPreviewDemo } from '../lib/reportPreviewDemo';

export default function ActivityDetailFrame() {
  const { id } = useParams();
  const preview = isReportingPreviewDemo();
  return (
    <div className="lexams-activity-detail-v2">
      <style>{`
        .lexams-activity-detail-v2 > div { max-width: 1240px; margin: 0 auto; }
        .lexams-activity-award-shortcut { max-width:1240px; margin:0 auto 14px; display:flex; justify-content:flex-end; }
        .lexams-activity-award-shortcut a { display:inline-flex; align-items:center; gap:7px; min-height:38px; padding:0 13px; border:1px solid var(--border-default); border-radius:10px; background:var(--surface-card); box-shadow:0 5px 16px rgba(0,43,84,.04); color:var(--color-navy-700); text-decoration:none; font-size:13px; font-weight:800; }
        .lexams-activity-award-shortcut a:hover { border-color:var(--color-gold-500); background:#FFF9EA; }
        .lexams-activity-detail-v2 > div > button:first-child {
          display:inline-flex !important; align-items:center; min-height:38px; padding:0 12px !important;
          border:1px solid var(--border-default) !important; border-radius:10px !important;
          background:var(--surface-card) !important; box-shadow:0 5px 16px rgba(0,43,84,.04);
          color:var(--color-navy-700) !important;
        }
        .lexams-activity-detail-v2 > div > button:first-child:hover { border-color:var(--color-navy-700) !important; }
        .lexams-activity-detail-v2 > div > div:nth-of-type(1) {
          margin-top:16px !important; padding:26px 28px; border:1px solid var(--border-default);
          border-radius:18px; background:linear-gradient(135deg,var(--surface-card),rgba(247,245,239,.72));
          box-shadow:0 14px 36px rgba(0,43,84,.06);
        }
        .lexams-activity-detail-v2 > div > div:nth-of-type(1) h2 {
          font-size:clamp(28px,3vw,38px) !important; letter-spacing:-.025em; color:var(--color-navy-900);
        }
        .lexams-activity-detail-v2 > div > div:nth-of-type(1) p { max-width:820px; line-height:1.65 !important; }
        .lexams-activity-detail-v2 > div > div:nth-of-type(1) button { min-height:40px; border-radius:10px !important; }
        .lexams-activity-detail-v2 > div > div:nth-of-type(2) {
          margin-top:18px !important; padding:7px; gap:5px !important; overflow-x:auto; border:1px solid var(--border-default) !important;
          border-radius:13px; background:var(--surface-card); box-shadow:0 6px 20px rgba(0,43,84,.04);
        }
        .lexams-activity-detail-v2 > div > div:nth-of-type(2) button {
          flex:none; padding:9px 14px !important; border-radius:8px !important; border-bottom:0 !important;
        }
        .lexams-activity-detail-v2 > div > div:nth-of-type(2) button:hover { background:var(--surface-muted) !important; }
        .lexams-activity-detail-v2 > div > div:nth-of-type(n+3) { margin-top:20px; }
        .lexams-activity-detail-v2 .table-scroll { scrollbar-width:thin; }
        .lexams-activity-detail-v2 a[target="_blank"],
        .lexams-activity-detail-v2 button[title="Copy"] {
          display:inline-grid; place-items:center; min-width:32px; min-height:32px; border-radius:8px !important;
        }
        @media(max-width:760px){
          .lexams-activity-award-shortcut { justify-content:stretch; }
          .lexams-activity-award-shortcut a { width:100%; justify-content:center; }
          .lexams-activity-detail-v2 > div > div:nth-of-type(1){padding:20px;}
          .lexams-activity-detail-v2 > div > div:nth-of-type(1) > div:last-child{flex-wrap:wrap;}
          .lexams-activity-detail-v2 > div > div:nth-of-type(2){margin-left:-4px !important;margin-right:-4px !important;}
          .lexams-activity-detail-v2 > div > div:nth-of-type(n+3) > div[style*="grid-template-columns: 2fr 1fr"],
          .lexams-activity-detail-v2 > div > div:nth-of-type(n+3) > div[style*="grid-template-columns: 1fr 1fr"]{grid-template-columns:1fr !important;}
        }
      `}</style>
      <div className="lexams-activity-award-shortcut"><Link to={`/app/certificates?awardActivity=${encodeURIComponent(id || '')}#awards-recognition`}><Award size={15}/>Give award / recognition</Link></div>
      {!preview && <ActivityWideCheckinPanel />}
      {!preview && <ActivityOperationsPanel />}
      <ActivityDetail />
    </div>
  );
}
