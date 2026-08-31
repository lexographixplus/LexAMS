import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import PublicExperienceLayout, { PublicCard, PublicNotice } from '../../components/PublicExperienceLayout';
import useDocumentTitle from '../../lib/useDocumentTitle';

export default function JoinTeam(){
  useDocumentTitle('Join this workspace');
 const {token}=useParams(); const {user,loading:authLoading,signIn,refreshProfile}=useAuth(); const [invite,setInvite]=useState(null); const [loading,setLoading]=useState(true); const [error,setError]=useState(''); const [sending,setSending]=useState(false); const [sent,setSent]=useState(false); const [accepting,setAccepting]=useState(false); const [accepted,setAccepted]=useState(false);
 useEffect(()=>{fetch(`/api/invite/${token}`).then(async r=>{const b=await r.json();if(!r.ok)throw new Error(b.error);setInvite(b.invite)}).catch(e=>setError(e.message||'Invalid or expired invitation.')).finally(()=>setLoading(false))},[token]);
 useEffect(()=>{if(invite&&user&&!authLoading&&!accepted&&!accepting&&invite.status==='pending')accept()},[invite,user,authLoading]);
 async function send(){setSending(true);setError('');const {error:e}=await signIn(invite.email,`/join/${token}`);if(e)setError(e.message);else setSent(true);setSending(false)}
 async function accept(){setAccepting(true);setError('');try{const r=await fetch(`/api/invite/${token}`,{method:'POST',credentials:'include'});const b=await r.json();if(!r.ok)throw new Error(b.error);await refreshProfile();setAccepted(true)}catch(e){setError(e.message)}finally{setAccepting(false)}}
 if(loading||authLoading)return <PublicExperienceLayout eyebrow="Team invitation" title="Loading invitation…" narrow/>;
 if(!invite)return <PublicExperienceLayout eyebrow="Team invitation" title="Invitation unavailable" narrow><PublicNotice tone="error">{error||'Invitation not found.'}</PublicNotice><p><Link to="/login">Go to sign in</Link></p></PublicExperienceLayout>;
 return <PublicExperienceLayout eyebrow="Team invitation" title={accepted?'You’re in':`Join ${invite.organization_name}`} description={accepted?`You’ve joined ${invite.organization_name} on LexAMS.`:`${invite.invited_by_name||'An administrator'} invited ${invite.email} to collaborate.`} organizationName={invite.organization_name} narrow><PublicCard>{accepted?<div style={{textAlign:'center'}}><div style={{fontSize:38}}>✓</div><Link className="lex-public-button" to="/app">Open workspace</Link></div>:<>{error&&<PublicNotice tone="error">{error}</PublicNotice>}{user?<button className="lex-public-button" disabled={accepting||invite.status!=='pending'} onClick={accept}>{accepting?'Joining…':'Accept invitation'}</button>:sent?<PublicNotice tone="success">Check <strong>{invite.email}</strong> for your secure sign-in link. It will return you here.</PublicNotice>:<button className="lex-public-button" disabled={sending||invite.status!=='pending'} onClick={send}>{sending?'Sending…':'Continue with secure email link'}</button>}<p style={{fontSize:12,color:'#616C7D'}}>No password is required. LexAMS verifies the email address the invitation was sent to.</p></>}</PublicCard></PublicExperienceLayout>
}
