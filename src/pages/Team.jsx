import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { apiClient } from '../lib/api';
import { fmtDate } from '../lib/format';
import { UserPlus, Check, X, Trash2, Shield, User, AlertCircle } from 'lucide-react';
import SkeletonScreen from '../components/Skeleton';

export default function Team() {
  const { user, profile, isAdmin } = useAuth();
  const [members, setMembers] = useState([]);
  const [invites, setInvites] = useState([]);
  const [pendingApprovals, setPendingApprovals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [reviewingId, setReviewingId] = useState(null);
  const [toast, setToast] = useState(null);

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }

  const teamId = profile?.team_id;

  const loadTeamData = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    const [membersResult, invitesResult, approvalsResult] = await Promise.all([
      apiClient.from('profiles').select('*').eq('team_id', teamId),
      apiClient.from('team_invites').select('*').eq('invited_by', teamId).order('created_at', { ascending: false }),
      isAdmin
        ? apiClient.from('pending_approvals').select('*').eq('team_id', teamId).order('created_at', { ascending: false })
        : Promise.resolve({ data: [], error: null }),
    ]);
    const failure = [membersResult, invitesResult, approvalsResult].find(result => result.error);
    if (failure) setLoadError(failure.error.message || 'Your team could not be loaded.');
    setMembers(membersResult.data || []);
    setInvites(invitesResult.data || []);
    setPendingApprovals(approvalsResult.data || []);
    setLoading(false);
  }, [teamId, isAdmin]);

  useEffect(() => {
    // Without a team there is nothing to fetch, so render the empty state.
    if (teamId) void loadTeamData();
  }, [teamId, loadTeamData]);

  async function sendInvite(e) {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setSending(true);
    const { data, error } = await apiClient.from('team_invites').insert({
      invited_by: teamId,
      email: inviteEmail.trim().toLowerCase(),
      role: 'member',
    }).select().single();

    if (error) {
      showToast('Error: ' + error.message);
    } else {
      setInvites(prev => [data, ...prev]);
      const inviteLink = `${window.location.origin}/join/${data.token}`;
      navigator.clipboard.writeText(inviteLink).catch(() => undefined);
      showToast('Invite created. Link copied to clipboard.');
      setInviteEmail('');
      setShowInvite(false);
    }
    setSending(false);
  }

  async function revokeInvite(id) {
    const { error } = await apiClient.from('team_invites').update({ status: 'revoked' }).eq('id', id);
    if (error) return showToast('Error: ' + error.message);
    setInvites(prev => prev.map(i => i.id === id ? { ...i, status: 'revoked' } : i));
    showToast('Invite revoked');
  }

  async function removeMember(memberId) {
    const { error } = await apiClient.from('profiles').update({ team_id: memberId, team_role: 'admin' }).eq('id', memberId);
    if (error) return showToast('Error: ' + error.message);
    setMembers(prev => prev.filter(m => m.id !== memberId));
    showToast('Member removed from team');
  }

  async function handleApproval(approvalId, approved) {
    if (!isAdmin || reviewingId) return;
    setReviewingId(approvalId);
    try {
      const response = await fetch('/api/mutate', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'review_approval',
          payload: { approvalId, decision: approved ? 'approved' : 'rejected' },
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || 'Could not review approval');

      setPendingApprovals(prev => prev.map(a => a.id === approvalId ? body.approval : a));
      showToast(approved ? 'Approved and executed' : 'Request rejected');
    } catch (error) {
      showToast('Error: ' + (error.message || 'Approval failed'));
    } finally {
      setReviewingId(null);
    }
  }

  const pendingCount = pendingApprovals.filter(a => a.status === 'pending').length;
  const inputStyle = {
    width: '100%', padding: '10px 14px', fontSize: 14,
    border: '1.5px solid var(--border-default)', borderRadius: 'var(--radius-sm)',
    background: 'var(--surface-card)', outline: 'none', color: 'var(--text-primary)',
  };

  if (loading && teamId) return <SkeletonScreen cards={2} label="Loading your team" />;

  if (loadError) {
    return (
      <div className="lx-state lx-state-error" role="alert">
        <AlertCircle className="lx-state-icon" size={20} color="var(--color-danger)" aria-hidden="true" />
        <div>
          <strong>Your team could not be loaded</strong>
          <p>{loadError}</p>
          <div className="lx-state-actions">
            <button type="button" className="lx-btn lx-btn-secondary lx-btn-small" onClick={loadTeamData}>Try again</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 20 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 700 }}>Team</h1>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 6 }}>Manage members, invitations and approval requests.</p>
        </div>
        {isAdmin && (
          <button onClick={() => setShowInvite(true)} style={primaryButton}><UserPlus size={16} /> Invite member</button>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 20, marginTop: 22 }}>
        <Stat label="Team members" value={members.length} />
        <Stat label="Pending invites" value={invites.filter(i => i.status === 'pending').length} />
        <Stat label="Pending approvals" value={pendingCount} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 24, marginTop: 24 }}>
        <Panel title="Members">
          {members.length === 0 ? <Empty>No members found.</Empty> : members.map(m => (
            <Row key={m.id}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Avatar member={m} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>
                    {m.full_name}{m.id === user.id && <span style={{ color: 'var(--text-tertiary)', fontWeight: 400 }}> (you)</span>}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{m.role || 'Team member'}</div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <RolePill admin={m.team_role === 'admin'} />
                {isAdmin && m.id !== user.id && (
                  <button onClick={() => removeMember(m.id)} title="Remove from team" style={iconDanger}><Trash2 size={14} /></button>
                )}
              </div>
            </Row>
          ))}
        </Panel>

        <Panel title="Invitations">
          {invites.length === 0 ? <Empty>No invitations sent yet.</Empty> : invites.map(inv => (
            <Row key={inv.id}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{inv.email}</div>
                <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Sent {fmtDate(inv.created_at?.slice(0, 10))}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <StatusPill status={inv.status} />
                {inv.status === 'pending' && isAdmin && (
                  <button onClick={() => {
                    navigator.clipboard.writeText(`${window.location.origin}/join/${inv.token}`).catch(() => undefined);
                    showToast('Invite link copied');
                  }} style={textButton}>Copy link</button>
                )}
                {inv.status === 'pending' && isAdmin && (
                  <button onClick={() => revokeInvite(inv.id)} title="Revoke" style={iconDanger}><X size={14} /></button>
                )}
              </div>
            </Row>
          ))}
        </Panel>
      </div>

      {isAdmin && pendingCount > 0 && (
        <Panel title={`Pending approvals · ${pendingCount}`} style={{ marginTop: 24 }}>
          {pendingApprovals.filter(a => a.status === 'pending').map(a => {
            const requester = members.find(m => m.id === a.requested_by);
            const busy = reviewingId === a.id;
            return (
              <Row key={a.id}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{approvalTitle(a.action_type)}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 3 }}>
                    Requested by {requester?.full_name || 'Unknown'} · {fmtDate(a.created_at?.slice(0, 10))}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>{approvalDetail(a)}</div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button disabled={busy || Boolean(reviewingId)} onClick={() => handleApproval(a.id, true)} style={approveButton}>
                    <Check size={14} /> {busy ? 'Processing...' : 'Approve'}
                  </button>
                  <button disabled={busy || Boolean(reviewingId)} onClick={() => handleApproval(a.id, false)} style={rejectButton}>
                    <X size={14} /> Reject
                  </button>
                </div>
              </Row>
            );
          })}
        </Panel>
      )}

      {isAdmin && pendingApprovals.some(a => a.status !== 'pending') && (
        <Panel title="Recent decisions" style={{ marginTop: 16 }}>
          {pendingApprovals.filter(a => a.status !== 'pending').slice(0, 10).map(a => (
            <Row key={a.id}>
              <div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{approvalTitle(a.action_type)}</div>
              <StatusPill status={a.status} />
            </Row>
          ))}
        </Panel>
      )}

      {showInvite && (
        <div onClick={() => setShowInvite(false)} style={overlay}>
          <div onClick={e => e.stopPropagation()} style={dialog}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700 }}>Invite team member</h3>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 8, lineHeight: 1.5 }}>
              Enter their email address. They’ll receive a secure link to join this workspace.
            </p>
            <form onSubmit={sendInvite} style={{ marginTop: 20 }}>
              <input type="email" required value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="teammate@example.org" style={inputStyle} />
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
                <button type="button" onClick={() => setShowInvite(false)} style={secondaryButton}>Cancel</button>
                <button type="submit" disabled={sending} style={{ ...primaryButton, opacity: sending ? 0.7 : 1 }}>{sending ? 'Sending...' : 'Send invite'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {toast && <div style={toastStyle}>{toast}</div>}
    </div>
  );
}

function approvalTitle(type) {
  if (type === 'issue_certificate') return 'Issue certificate';
  if (type === 'add_participant') return 'Add participant';
  if (type === 'delete_participant') return 'Delete participant';
  return String(type || 'Approval request').replaceAll('_', ' ');
}

function approvalDetail(a) {
  const p = a.payload || {};
  if (a.action_type === 'issue_certificate') return `Participant: ${p.participant_name || p.participant_id} · Activity: ${p.activity_title || p.activity_id} · Type: ${p.certificate_type || 'completion'}`;
  if (a.action_type === 'add_participant' || a.action_type === 'delete_participant') return `${p.name || 'Participant'}${p.email ? ` (${p.email})` : ''}`;
  return '';
}

function Stat({ label, value }) {
  return <div style={{ background: 'var(--surface-card)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-card)', padding: '20px 22px' }}>
    <div style={{ fontSize: 12, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-tertiary)', fontWeight: 600 }}>{label}</div>
    <div style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 700, marginTop: 8 }}>{value}</div>
  </div>;
}

function Panel({ title, children, style }) {
  return <div style={{ background: 'var(--surface-card)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-card)', overflow: 'hidden', ...style }}>
    <div style={{ padding: '16px 22px', fontSize: 14, fontWeight: 600 }}>{title}</div>
    {children}
  </div>;
}

function Row({ children }) {
  return <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 18, padding: '12px 22px', borderTop: '1px solid var(--border-default)' }}>{children}</div>;
}

function Empty({ children }) {
  return <div style={{ padding: '26px 22px', textAlign: 'center', fontSize: 13, color: 'var(--text-tertiary)', borderTop: '1px solid var(--border-default)' }}>{children}</div>;
}

function Avatar({ member }) {
  const admin = member.team_role === 'admin';
  const initials = member.full_name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '?';
  return <div style={{ width: 32, height: 32, borderRadius: 999, background: admin ? 'var(--color-navy-900)' : 'var(--surface-muted)', color: admin ? '#FFFFFF' : 'var(--color-navy-700)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700 }}>{initials}</div>;
}

function RolePill({ admin }) {
  return <span style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 999, fontSize: 12, fontWeight: 600, background: admin ? '#E4F3E9' : 'var(--surface-muted)', color: admin ? 'var(--color-success)' : 'var(--text-secondary)' }}>
    {admin ? <><Shield size={12} /> Admin</> : <><User size={12} /> Member</>}
  </span>;
}

function StatusPill({ status }) {
  const approved = status === 'accepted' || status === 'approved';
  const pending = status === 'pending';
  return <span style={{ padding: '3px 10px', borderRadius: 999, fontSize: 12, fontWeight: 600, background: pending ? '#FDF3DC' : approved ? '#E4F3E9' : '#F9E4E2', color: pending ? '#8A6210' : approved ? 'var(--color-success)' : 'var(--color-danger)' }}>{status}</span>;
}

const primaryButton = { display: 'flex', alignItems: 'center', gap: 6, padding: '10px 20px', fontSize: 14, fontWeight: 600, color: 'var(--color-navy-900)', background: 'var(--color-gold-500)', border: 'none', borderRadius: 'var(--radius-md)', cursor: 'pointer' };
const secondaryButton = { padding: '10px 20px', fontSize: 14, fontWeight: 600, background: 'transparent', border: '1.5px solid var(--border-default)', borderRadius: 'var(--radius-md)', color: 'var(--text-secondary)', cursor: 'pointer' };
const approveButton = { display: 'flex', alignItems: 'center', gap: 4, padding: '7px 14px', fontSize: 13, fontWeight: 600, background: 'var(--color-success)', color: '#FFFFFF', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer' };
const rejectButton = { display: 'flex', alignItems: 'center', gap: 4, padding: '7px 14px', fontSize: 13, fontWeight: 600, background: 'transparent', border: '1.5px solid var(--color-danger)', borderRadius: 'var(--radius-sm)', color: 'var(--color-danger)', cursor: 'pointer' };
const textButton = { background: 'none', border: 'none', color: 'var(--color-navy-700)', cursor: 'pointer', padding: 4, fontSize: 12, fontWeight: 600 };
const iconDanger = { background: 'none', border: 'none', color: 'var(--color-danger)', cursor: 'pointer', padding: 4 };
const overlay = { position: 'fixed', inset: 0, background: 'rgba(0,43,84,0.25)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' };
const dialog = { background: 'var(--surface-card)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-raised)', padding: '28px 32px', width: 420, maxWidth: '95vw' };
const toastStyle = { position: 'fixed', bottom: 26, left: '50%', transform: 'translateX(-50%)', background: 'var(--color-navy-900)', color: '#FFFFFF', fontSize: 13, fontWeight: 500, padding: '11px 20px', borderRadius: 999, boxShadow: 'var(--shadow-raised)', zIndex: 300 };
