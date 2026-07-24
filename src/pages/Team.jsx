import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { fmtDate } from '../lib/format';
import { UserPlus, Check, X, Clock, Trash2, Shield, User } from 'lucide-react';

export default function Team() {
  const { user, profile, isAdmin } = useAuth();
  const [members, setMembers] = useState([]);
  const [invites, setInvites] = useState([]);
  const [pendingApprovals, setPendingApprovals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [toast, setToast] = useState(null);

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(null), 2500); }

  const teamId = profile?.team_id;

  useEffect(() => {
    if (!teamId) return;
    loadTeamData();
  }, [teamId]);

  async function loadTeamData() {
    setLoading(true);
    const [{ data: m }, { data: inv }, { data: pa }] = await Promise.all([
      supabase.from('profiles').select('*').eq('team_id', teamId),
      supabase.from('team_invites').select('*').eq('invited_by', teamId).order('created_at', { ascending: false }),
      supabase.from('pending_approvals').select('*').eq('team_id', teamId).order('created_at', { ascending: false }),
    ]);
    setMembers(m || []);
    setInvites(inv || []);
    setPendingApprovals(pa || []);
    setLoading(false);
  }

  async function sendInvite(e) {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setSending(true);

    const { data, error } = await supabase.from('team_invites').insert({
      invited_by: teamId,
      email: inviteEmail.trim().toLowerCase(),
      role: 'member',
    }).select().single();

    if (error) {
      showToast('Error: ' + error.message);
    } else {
      setInvites(prev => [data, ...prev]);
      const inviteLink = `${window.location.origin}/join/${data.token}`;
      navigator.clipboard.writeText(inviteLink);
      showToast('Invite created! Link copied to clipboard.');
      setInviteEmail('');
      setShowInvite(false);
    }
    setSending(false);
  }

  async function revokeInvite(id) {
    await supabase.from('team_invites').update({ status: 'revoked' }).eq('id', id);
    setInvites(prev => prev.map(i => i.id === id ? { ...i, status: 'revoked' } : i));
    showToast('Invite revoked');
  }

  async function removeMember(memberId) {
    // Set their team_id to themselves (they become their own admin)
    await supabase.from('profiles').update({ team_id: memberId, team_role: 'admin' }).eq('id', memberId);
    setMembers(prev => prev.filter(m => m.id !== memberId));
    showToast('Member removed from team');
  }

  async function handleApproval(approvalId, approved) {
    const approval = pendingApprovals.find(a => a.id === approvalId);
    if (!approval) return;

    if (approved && approval.action_type === 'issue_certificate') {
      const p = approval.payload;
      // Actually issue the certificate
      const { data: noData } = await supabase.rpc('next_cert_no');
      const certNo = noData || `LEX-${new Date().getFullYear()}-0000`;
      await supabase.from('certificates').insert({
        cert_no: certNo,
        activity_id: p.activity_id,
        participant_id: p.participant_id,
        issued_date: new Date().toISOString().slice(0, 10),
        certificate_type: p.certificate_type || 'completion',
      });
    }

    if (approved && approval.action_type === 'add_participant') {
      const p = approval.payload;
      await supabase.from('participants').insert({
        name: p.name, email: p.email, phone: p.phone || '',
        org: p.org || '', category: p.category || 'Community member',
      });
    }

    await supabase.from('pending_approvals').update({
      status: approved ? 'approved' : 'rejected',
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
    }).eq('id', approvalId);

    setPendingApprovals(prev =>
      prev.map(a => a.id === approvalId ? { ...a, status: approved ? 'approved' : 'rejected' } : a)
    );
    showToast(approved ? 'Approved and executed' : 'Request rejected');
  }

  const inputStyle = {
    width: '100%', padding: '10px 14px', fontSize: 14,
    border: '1.5px solid var(--border-default)', borderRadius: 'var(--radius-sm)',
    background: 'var(--surface-card)', outline: 'none', color: 'var(--text-primary)',
  };

  const pendingCount = pendingApprovals.filter(a => a.status === 'pending').length;

  if (loading) return <div style={{ padding: 40, textAlign: 'center', fontSize: 14, color: 'var(--text-tertiary)' }}>Loading team...</div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 20 }}>
        <div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 700 }}>Team</h2>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 6 }}>
            Manage your team members and review pending approvals.
          </p>
        </div>
        {isAdmin && (
          <button onClick={() => setShowInvite(true)} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '10px 20px', fontSize: 14, fontWeight: 600,
            color: 'var(--color-navy-900)', background: 'var(--color-gold-500)',
            border: 'none', borderRadius: 'var(--radius-md)', cursor: 'pointer',
          }}><UserPlus size={16} /> Invite member</button>
        )}
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20, marginTop: 22 }}>
        {[
          { label: 'Team members', value: members.length },
          { label: 'Pending invites', value: invites.filter(i => i.status === 'pending').length },
          { label: 'Pending approvals', value: pendingCount },
        ].map(s => (
          <div key={s.label} style={{
            background: 'var(--surface-card)', border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-card)', padding: '20px 22px',
          }}>
            <div style={{ fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-tertiary)', fontWeight: 600 }}>{s.label}</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 700, marginTop: 8 }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginTop: 24 }}>
        {/* Members */}
        <div style={{
          background: 'var(--surface-card)', border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-card)', overflow: 'hidden',
        }}>
          <div style={{ padding: '16px 22px', fontSize: 14, fontWeight: 600 }}>Members</div>
          {members.map(m => (
            <div key={m.id} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '12px 22px', borderTop: '1px solid var(--border-default)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 999,
                  background: m.team_role === 'admin' ? 'var(--color-navy-900)' : 'var(--surface-muted)',
                  color: m.team_role === 'admin' ? '#FFFFFF' : 'var(--color-navy-700)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 700,
                }}>{m.full_name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}</div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>
                    {m.full_name}
                    {m.id === user.id && <span style={{ color: 'var(--text-tertiary)', fontWeight: 400 }}> (you)</span>}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{m.role || 'Team member'}</div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 600,
                  background: m.team_role === 'admin' ? '#E4F3E9' : 'var(--surface-muted)',
                  color: m.team_role === 'admin' ? 'var(--color-success)' : 'var(--text-secondary)',
                }}>
                  {m.team_role === 'admin' ? <><Shield size={12} /> Admin</> : <><User size={12} /> Member</>}
                </span>
                {isAdmin && m.id !== user.id && (
                  <button onClick={() => removeMember(m.id)} title="Remove from team" style={{
                    background: 'none', border: 'none', color: 'var(--color-danger)', cursor: 'pointer', padding: 4,
                  }}><Trash2 size={14} /></button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Invites */}
        <div style={{
          background: 'var(--surface-card)', border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-card)', overflow: 'hidden',
        }}>
          <div style={{ padding: '16px 22px', fontSize: 14, fontWeight: 600 }}>Invitations</div>
          {invites.length === 0 ? (
            <div style={{
              padding: '26px 22px', textAlign: 'center', fontSize: 13,
              color: 'var(--text-tertiary)', borderTop: '1px solid var(--border-default)',
            }}>No invitations sent yet.</div>
          ) : invites.map(inv => (
            <div key={inv.id} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '12px 22px', borderTop: '1px solid var(--border-default)',
            }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{inv.email}</div>
                <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                  Sent {fmtDate(inv.created_at?.slice(0, 10))}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{
                  padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 600,
                  background: inv.status === 'pending' ? '#FDF3DC' : inv.status === 'accepted' ? '#E4F3E9' : '#F9E4E2',
                  color: inv.status === 'pending' ? '#8A6210' : inv.status === 'accepted' ? 'var(--color-success)' : 'var(--color-danger)',
                }}>{inv.status}</span>
                {inv.status === 'pending' && isAdmin && (
                  <button onClick={() => {
                    const link = `${window.location.origin}/join/${inv.token}`;
                    navigator.clipboard.writeText(link);
                    showToast('Invite link copied');
                  }} title="Copy invite link" style={{
                    background: 'none', border: 'none', color: 'var(--color-navy-700)',
                    cursor: 'pointer', padding: 4, fontSize: 12, fontWeight: 600,
                  }}>Copy link</button>
                )}
                {inv.status === 'pending' && isAdmin && (
                  <button onClick={() => revokeInvite(inv.id)} title="Revoke" style={{
                    background: 'none', border: 'none', color: 'var(--color-danger)',
                    cursor: 'pointer', padding: 4,
                  }}><X size={14} /></button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Pending Approvals */}
      {isAdmin && pendingCount > 0 && (
        <div style={{
          background: 'var(--surface-card)', border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-card)', overflow: 'hidden', marginTop: 24,
        }}>
          <div style={{ padding: '16px 22px', fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
            Pending approvals
            <span style={{
              padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 600,
              background: '#FDF3DC', color: '#8A6210',
            }}>{pendingCount}</span>
          </div>
          {pendingApprovals.filter(a => a.status === 'pending').map(a => {
            const requester = members.find(m => m.id === a.requested_by);
            return (
              <div key={a.id} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '14px 22px', borderTop: '1px solid var(--border-default)',
              }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>
                    {a.action_type === 'issue_certificate' && `Issue certificate`}
                    {a.action_type === 'add_participant' && `Add participant`}
                    {a.action_type === 'delete_participant' && `Delete participant`}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 3 }}>
                    Requested by {requester?.full_name || 'Unknown'} &middot; {fmtDate(a.created_at?.slice(0, 10))}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>
                    {a.action_type === 'issue_certificate' && (
                      <>Participant: {a.payload.participant_name} &middot; Activity: {a.payload.activity_title} &middot; Type: {a.payload.certificate_type || 'completion'}</>
                    )}
                    {a.action_type === 'add_participant' && (
                      <>{a.payload.name} ({a.payload.email})</>
                    )}
                    {a.action_type === 'delete_participant' && (
                      <>{a.payload.name} ({a.payload.email})</>
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => handleApproval(a.id, true)} style={{
                    display: 'flex', alignItems: 'center', gap: 4,
                    padding: '7px 14px', fontSize: 13, fontWeight: 600,
                    background: 'var(--color-success)', color: '#FFFFFF',
                    border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                  }}><Check size={14} /> Approve</button>
                  <button onClick={() => handleApproval(a.id, false)} style={{
                    display: 'flex', alignItems: 'center', gap: 4,
                    padding: '7px 14px', fontSize: 13, fontWeight: 600,
                    background: 'transparent', border: '1.5px solid var(--color-danger)',
                    borderRadius: 'var(--radius-sm)', color: 'var(--color-danger)', cursor: 'pointer',
                  }}><X size={14} /> Reject</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Approval history */}
      {isAdmin && pendingApprovals.filter(a => a.status !== 'pending').length > 0 && (
        <div style={{
          background: 'var(--surface-card)', border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-card)', overflow: 'hidden', marginTop: 16,
        }}>
          <div style={{ padding: '16px 22px', fontSize: 14, fontWeight: 600 }}>Recent decisions</div>
          {pendingApprovals.filter(a => a.status !== 'pending').slice(0, 10).map(a => {
            const requester = members.find(m => m.id === a.requested_by);
            return (
              <div key={a.id} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '11px 22px', borderTop: '1px solid var(--border-default)', fontSize: 13,
              }}>
                <div style={{ color: 'var(--text-secondary)' }}>
                  {a.action_type.replace('_', ' ')} &middot; by {requester?.full_name || 'Unknown'}
                </div>
                <span style={{
                  padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 600,
                  background: a.status === 'approved' ? '#E4F3E9' : '#F9E4E2',
                  color: a.status === 'approved' ? 'var(--color-success)' : 'var(--color-danger)',
                }}>{a.status}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Invite dialog */}
      {showInvite && (
        <div onClick={() => setShowInvite(false)} style={{
          position: 'fixed', inset: 0, background: 'rgba(0,43,84,0.25)',
          zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: 'var(--surface-card)', borderRadius: 'var(--radius-lg)',
            boxShadow: 'var(--shadow-raised)', padding: '28px 32px',
            width: 420, maxWidth: '95vw',
          }}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700 }}>Invite team member</h3>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 8, lineHeight: 1.5 }}>
              Enter their email address. They'll receive a link to join your team. Members can add participants
              and request certificate issuance, but these actions require your approval.
            </p>
            <form onSubmit={sendInvite} style={{ marginTop: 20 }}>
              <input type="email" required value={inviteEmail} onChange={e => setInviteEmail(e.target.value)}
                placeholder="teammate@example.org" style={inputStyle} />
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
                <button type="button" onClick={() => setShowInvite(false)} style={{
                  padding: '10px 20px', fontSize: 14, fontWeight: 600,
                  background: 'transparent', border: '1.5px solid var(--border-default)',
                  borderRadius: 'var(--radius-md)', color: 'var(--text-secondary)', cursor: 'pointer',
                }}>Cancel</button>
                <button type="submit" disabled={sending} style={{
                  padding: '10px 20px', fontSize: 14, fontWeight: 600,
                  background: 'var(--color-navy-900)', color: '#FFFFFF',
                  border: 'none', borderRadius: 'var(--radius-md)', cursor: 'pointer',
                  opacity: sending ? 0.7 : 1,
                }}>{sending ? 'Sending...' : 'Send invite'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {toast && (
        <div style={{
          position: 'fixed', bottom: 26, left: '50%', transform: 'translateX(-50%)',
          background: 'var(--color-navy-900)', color: '#FFFFFF', fontSize: 13, fontWeight: 500,
          padding: '11px 20px', borderRadius: 999, boxShadow: 'var(--shadow-raised)', zIndex: 300,
        }}>{toast}</div>
      )}
    </div>
  );
}
