import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import PublicExperienceLayout, { PublicCard, PublicNotice } from '../../components/PublicExperienceLayout';
import { publicApi } from '../../lib/publicApi';

function fmtRange(a) {
  const s = new Date(a.start_date + 'T00:00:00');
  const e = new Date(a.end_date + 'T00:00:00');
  const opts = { month: 'short', day: 'numeric', year: 'numeric' };
  if (a.start_date === a.end_date) return s.toLocaleDateString('en-GB', opts);
  return `${s.toLocaleDateString('en-GB', { month: 'short', day: 'numeric' })} – ${e.toLocaleDateString('en-GB', opts)}`;
}

export default function RegisterPublic() {
  const { token } = useParams();
  const [activity, setActivity] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [step, setStep] = useState('email');
  const [email, setEmail] = useState('');
  const [participant, setParticipant] = useState(null);
  const [form, setForm] = useState({ name: '', phone: '', org: '', category: 'Community member' });
  const [submitting, setSubmitting] = useState(false);
  const [registeredName, setRegisteredName] = useState('');

  useEffect(() => {
    publicApi('registration', token)
      .then(({ activity }) => setActivity(activity))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [token]);

  async function lookup(e) {
    e.preventDefault(); setSubmitting(true); setError('');
    try {
      const body = await publicApi('registration', token, { method: 'POST', body: JSON.stringify({ action: 'lookup', email }) });
      if (body.state === 'already') setStep('already');
      else if (body.state === 'found') { setParticipant(body.participant); setStep('found'); }
      else setStep('form');
    } catch (e) { setError(e.message); }
    finally { setSubmitting(false); }
  }

  async function submit(data) {
    setSubmitting(true); setError('');
    try {
      const body = await publicApi('registration', token, { method: 'POST', body: JSON.stringify({ email, ...data }) });
      setRegisteredName(body.name || data.name || participant?.name || 'Participant'); setStep('done');
    } catch (e) { setError(e.message); }
    finally { setSubmitting(false); }
  }

  if (loading) return <PublicExperienceLayout eyebrow="Registration" title="Loading activity…" narrow />;
  if (!activity) return <PublicExperienceLayout eyebrow="Registration" title="Registration unavailable" narrow><PublicNotice tone="error">{error || 'This registration link is unavailable.'}</PublicNotice></PublicExperienceLayout>;

  return <PublicExperienceLayout eyebrow="Activity registration" title={activity.title} description={`${activity.type || 'Activity'} · ${fmtRange(activity)}${activity.venue ? ` · ${activity.venue}` : ''}`} organizationName={activity.organization_name} organizationLogo={activity.organization_logo} narrow>
    <PublicCard>
      {activity.description && <p style={{ color:'#687587', lineHeight:1.65, marginTop:0 }}>{activity.description}</p>}
      {step === 'email' && <form onSubmit={lookup}>
        <h3>Register with your email</h3><p style={{color:'#687587'}}>Returning participants are recognised automatically.</p>
        <label className="lex-public-label">Email address</label><input className="lex-public-input" type="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="name@example.org" />
        {error && <PublicNotice tone="error">{error}</PublicNotice>}
        <div className="lex-public-actions"><button className="lex-public-button" disabled={submitting}>{submitting?'Checking…':'Continue'}</button></div>
      </form>}
      {step === 'found' && participant && <div><h3>Welcome back, {participant.name?.split(' ')[0]}</h3><p style={{color:'#687587'}}>We found your participant profile. Confirm to register for this activity.</p>
        <PublicNotice><strong>{participant.name}</strong>{participant.org ? ` · ${participant.org}` : ''}</PublicNotice>
        {error && <PublicNotice tone="error">{error}</PublicNotice>}
        <div className="lex-public-actions"><button className="lex-public-button ghost" onClick={()=>{setForm({name:participant.name||'',phone:participant.phone||'',org:participant.org||'',category:participant.category||'Community member'});setStep('form')}}>Edit details</button><button className="lex-public-button" disabled={submitting} onClick={()=>submit({name:participant.name,phone:participant.phone,org:participant.org,category:participant.category})}>Confirm registration</button></div></div>}
      {step === 'form' && <form onSubmit={e=>{e.preventDefault();submit(form)}}><h3>Your details</h3><div className="lex-public-fields"><input className="lex-public-input" required value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="Full name"/><input className="lex-public-input" value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})} placeholder="Phone number"/><input className="lex-public-input" value={form.org} onChange={e=>setForm({...form,org:e.target.value})} placeholder="Organisation"/><select className="lex-public-select" value={form.category} onChange={e=>setForm({...form,category:e.target.value})}>{['Volunteer','Staff','Community member','Partner','Youth','Teacher','Parent','External'].map(x=><option key={x}>{x}</option>)}</select></div>{error&&<PublicNotice tone="error">{error}</PublicNotice>}<div className="lex-public-actions"><button type="button" className="lex-public-button ghost" onClick={()=>setStep('email')}>Back</button><button className="lex-public-button" disabled={submitting}>{submitting?'Registering…':'Register'}</button></div></form>}
      {step === 'already' && <div><h3>You’re already registered</h3><p style={{color:'#687587'}}>This email is already registered for {activity.title}.</p><div className="lex-public-actions"><button className="lex-public-button ghost" onClick={()=>{setEmail('');setStep('email')}}>Use another email</button></div></div>}
      {step === 'done' && <div style={{textAlign:'center'}}><div style={{fontSize:36}}>✓</div><h3>You’re registered</h3><p style={{color:'#687587'}}>{registeredName} is confirmed for {activity.title}.</p><button className="lex-public-button ghost" onClick={()=>{setEmail('');setParticipant(null);setStep('email')}}>Register someone else</button></div>}
    </PublicCard>
  </PublicExperienceLayout>;
}
