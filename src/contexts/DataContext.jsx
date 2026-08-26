import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { isReportingPreviewDemo, mixReportingPreviewData } from '../lib/reportPreviewDemo';

const DataContext = createContext(null);

async function apiFetch(url, options = {}) {
  if (typeof window !== 'undefined' && isReportingPreviewDemo() && String(options.method || 'GET').toUpperCase() !== 'GET') {
    throw new Error('This demo preview is read-only. Changes are disabled here.');
  }
  const response = await fetch(url, {
    credentials: 'include',
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {}),
    },
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
  return data;
}

async function maybeAutoEmailCertificate(certificateId) {
  if (!certificateId) return { sent: false };
  try {
    const meta = await apiFetch('/api/communications');
    if (!meta.pro || !meta.settings?.auto_send_certificates) return { sent: false };
    const result = await apiFetch('/api/communications', {
      method: 'POST',
      body: JSON.stringify({ action: 'send_certificates', certificateIds: [certificateId] }),
    });
    return { sent: true, result };
  } catch (error) {
    console.error('Automatic certificate email failed', error);
    return { sent: false, error };
  }
}

export function DataProvider({ children }) {
  const { user, isAdmin } = useAuth();
  const [organization, setOrganization] = useState(null);
  const [activities, setActivities] = useState([]);
  const [participants, setParticipants] = useState([]);
  const [registrations, setRegistrations] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [certificates, setCertificates] = useState([]);
  const [surveys, setSurveys] = useState([]);
  const [assessments, setAssessments] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    setLoading(true);
    try {
      const data = mixReportingPreviewData(await apiFetch('/api/bootstrap'));
      setOrganization(data.organization || null);
      setActivities(data.activities || []);
      setParticipants(data.participants || []);
      setRegistrations(data.registrations || []);
      setAttendance(data.attendance || []);
      setCertificates(data.certificates || []);
      setSurveys(data.surveys || []);
      setAssessments(data.assessments || []);
    } finally { setLoading(false); }
  }, [user]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const getActivity = useCallback((id) => activities.find(a => String(a.id) === String(id)), [activities]);
  const getParticipant = useCallback((id) => participants.find(p => p.id === id), [participants]);
  const getRegsForActivity = useCallback((aid) => registrations.filter(r => r.activity_id === aid).map(r => r.participant_id), [registrations]);
  const getAttForActivity = useCallback((aid) => attendance.filter(a => a.activity_id === aid), [attendance]);
  const getDoneSessions = useCallback((aid) => {
    const sessions = [];
    attendance.filter(a => a.activity_id === aid).forEach(a => { if (!sessions.includes(a.session_label)) sessions.push(a.session_label); });
    return sessions;
  }, [attendance]);
  const getAttendancePct = useCallback((aid, pid) => {
    const done = getDoneSessions(aid);
    if (!done.length) return null;
    const recs = attendance.filter(a => a.activity_id === aid && a.participant_id === pid);
    const attended = recs.filter(a => a.status !== 'absent').length;
    return Math.round((attended / done.length) * 100);
  }, [attendance, getDoneSessions]);

  const mutate = useCallback((action, payload) => apiFetch('/api/mutate', { method: 'POST', body: JSON.stringify({ action, payload }) }), []);

  const addActivity = useCallback(async (activity) => {
    const data = await mutate('add_activity', { activity }); setActivities(prev => [data, ...prev]); return data;
  }, [mutate]);
  const updateActivity = useCallback(async (id, updates) => {
    const data = await mutate('update_activity', { id, updates }); setActivities(prev => prev.map(a => a.id === id ? data : a)); return data;
  }, [mutate]);
  const deleteActivity = useCallback(async (id) => {
    await mutate('delete_activity', { id });
    setActivities(prev => prev.filter(a => a.id !== id));
    setRegistrations(prev => prev.filter(r => r.activity_id !== id));
    setAttendance(prev => prev.filter(a => a.activity_id !== id));
    setCertificates(prev => prev.filter(c => c.activity_id !== id));
    setSurveys(prev => prev.filter(s => s.activity_id !== id));
    setAssessments(prev => prev.filter(a => a.activity_id !== id));
  }, [mutate]);
  const addParticipant = useCallback(async (participant, opts = {}) => {
    const activityIds = Array.isArray(opts.activityIds) ? opts.activityIds : [];
    const normalized = { ...participant, email: String(participant.email || '').trim().toLowerCase() };
    const data = isAdmin
      ? await apiFetch('/api/participant-create-v2', { method: 'POST', body: JSON.stringify({ participant: normalized, activityIds }) })
      : await mutate('add_participant', { participant: normalized, activityIds });
    if (!data.pending) {
      setParticipants(prev => prev.some(p => p.id === data.id) ? prev.map(p => p.id === data.id ? data : p) : [...prev, data]);
      if (Array.isArray(data.registrations) && data.registrations.length) {
        setRegistrations(prev => {
          const next = [...prev];
          for (const reg of data.registrations) {
            const index = next.findIndex(item => item.id === reg.id);
            if (index >= 0) next[index] = reg;
            else next.push(reg);
          }
          return next;
        });
      }
    }
    return data;
  }, [mutate, isAdmin]);
  const updateParticipant = useCallback(async (id, updates) => {
    const normalized = { ...updates, ...(updates.email != null ? { email: String(updates.email).trim().toLowerCase() } : {}) };
    const data = await mutate('update_participant', { id, updates: normalized }); setParticipants(prev => prev.map(p => p.id === id ? data : p)); return data;
  }, [mutate]);
  const deleteParticipant = useCallback(async (id) => {
    const data = await mutate('delete_participant', { id });
    if (!data.pending) {
      setParticipants(prev => prev.filter(p => p.id !== id));
      setRegistrations(prev => prev.filter(r => r.participant_id !== id));
      setAttendance(prev => prev.filter(a => a.participant_id !== id));
      setCertificates(prev => prev.filter(c => c.participant_id !== id));
    }
    return data;
  }, [mutate]);
  const addRegistration = useCallback(async (activityId, participantId) => {
    const data = await mutate('add_registration', { activityId, participantId });
    setRegistrations(prev => prev.some(r => r.id === data.id) ? prev : [...prev, data]); return data;
  }, [mutate]);
  const upsertAttendance = useCallback(async (activityId, participantId, sessionLabel, status) => {
    const data = await mutate('upsert_attendance', { activityId, participantId, sessionLabel, status });
    setAttendance(prev => {
      const idx = prev.findIndex(a => a.activity_id === activityId && a.participant_id === participantId && a.session_label === sessionLabel);
      if (idx >= 0) { const next = [...prev]; next[idx] = data; return next; }
      return [...prev, data];
    });
    return data;
  }, [mutate]);
  const issueCertificate = useCallback(async (activityId, participantId, certificateType = 'completion') => {
    const data = await mutate('issue_certificate', { activityId, participantId, certificateType });
    if (!data.pending) {
      setCertificates(prev => [data, ...prev]);
      const delivery = await maybeAutoEmailCertificate(data.id);
      return { ...data, autoEmailSent: delivery.sent };
    }
    return data;
  }, [mutate]);

  return <DataContext.Provider value={{
    loading, refetch: fetchAll, organization,
    activities, participants, registrations, attendance, certificates, surveys, assessments,
    getActivity, getParticipant, getRegsForActivity, getAttForActivity, getDoneSessions, getAttendancePct,
    addActivity, updateActivity, deleteActivity, addParticipant, updateParticipant, deleteParticipant,
    addRegistration, upsertAttendance, issueCertificate, setSurveys, setAssessments, isAdmin,
  }}>{children}</DataContext.Provider>;
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used within DataProvider');
  return ctx;
}
