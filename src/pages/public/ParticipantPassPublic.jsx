import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import PublicExperienceLayout, { PublicCard, PublicNotice } from '../../components/PublicExperienceLayout';
import QrCode from '../../components/QrCode';
import { fmtRange } from '../../lib/format';

export default function ParticipantPassPublic() {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`/api/public-pass/${encodeURIComponent(token)}`)
      .then(async response => {
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body.error || 'Participant pass could not be loaded.');
        return body;
      })
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) return <PublicExperienceLayout eyebrow="Participant pass" title="Loading pass…" narrow />;
  if (!data) return <PublicExperienceLayout eyebrow="Participant pass" title="Pass unavailable" narrow><PublicNotice tone="error">{error || 'This participant pass is unavailable.'}</PublicNotice></PublicExperienceLayout>;

  const { participant, registrations = [] } = data;
  return (
    <PublicExperienceLayout
      eyebrow="Participant pass"
      title={participant.name}
      description="Use this pass at LexAMS-powered activities. Staff can scan it to identify your confirmed registration."
      organizationName={participant.organization_name}
      organizationLogo={participant.organization_logo}
      narrow
    >
      <PublicCard>
        <div style={{ display: 'grid', justifyItems: 'center', textAlign: 'center', gap: 14 }}>
          <QrCode value={`PASS:${participant.pass_token}`} size={210} label={`${participant.name} participant pass`} />
          <div>
            <div style={{ color: '#687587', fontSize: 12, textTransform: 'uppercase', letterSpacing: '.09em', fontWeight: 800 }}>Pass code</div>
            <div style={{ marginTop: 5, color: '#002B54', fontWeight: 800, fontSize: 14, overflowWrap: 'anywhere' }}>{participant.pass_token}</div>
          </div>
          <PublicNotice>Keep this pass private. It identifies you during activity check-in.</PublicNotice>
        </div>
      </PublicCard>

      <PublicCard style={{ marginTop: 16 }}>
        <h3>Your registrations</h3>
        {registrations.length ? (
          <div style={{ display: 'grid', gap: 12 }}>
            {registrations.map(reg => (
              <div key={`${reg.activity_id}-${reg.reference_code}`} style={{ border: '1px solid #DDE3EA', borderRadius: 11, padding: '14px 15px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ color: '#002B54', fontWeight: 800 }}>{reg.title}</div>
                    <div style={{ marginTop: 4, color: '#687587', fontSize: 12 }}>{reg.type || 'Activity'} · {fmtRange({ start: reg.start_date, end: reg.end_date })}{reg.venue ? ` · ${reg.venue}` : ''}</div>
                  </div>
                  <span style={{ flexShrink: 0, padding: '5px 9px', borderRadius: 999, background: reg.status === 'confirmed' ? '#EAF6EE' : reg.status === 'waitlisted' ? '#FFF6DF' : '#EEF3F8', color: reg.status === 'confirmed' ? '#24633D' : '#31516F', fontSize: 11, fontWeight: 800, textTransform: 'capitalize' }}>{reg.status}</span>
                </div>
                <div style={{ marginTop: 10, fontSize: 12, color: '#687587' }}>Registration reference <strong style={{ color: '#002B54' }}>{reg.reference_code}</strong></div>
              </div>
            ))}
          </div>
        ) : <p style={{ color: '#687587', marginBottom: 0 }}>No active registrations are linked to this pass.</p>}
      </PublicCard>
    </PublicExperienceLayout>
  );
}
