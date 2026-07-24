import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useAuth } from './AuthContext';

const DataContext = createContext(null);

export function DataProvider({ children }) {
  const { user, profile, isAdmin } = useAuth();
  const [activities, setActivities] = useState([]);
  const [participants, setParticipants] = useState([]);
  const [registrations, setRegistrations] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [certificates, setCertificates] = useState([]);
  const [surveys, setSurveys] = useState([]);
  const [assessments, setAssessments] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    if (!isSupabaseConfigured || !user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const [
      { data: acts },
      { data: parts },
      { data: regs },
      { data: att },
      { data: certs },
      { data: survs },
      { data: assess },
    ] = await Promise.all([
      supabase.from('activities').select('*').order('start_date', { ascending: false }),
      supabase.from('participants').select('*').order('name'),
      supabase.from('registrations').select('*'),
      supabase.from('attendance').select('*'),
      supabase.from('certificates').select('*').order('issued_date', { ascending: false }),
      supabase.from('surveys').select('*').order('created_at', { ascending: false }),
      supabase.from('assessments').select('*').order('created_at', { ascending: false }),
    ]);
    setActivities(acts || []);
    setParticipants(parts || []);
    setRegistrations(regs || []);
    setAttendance(att || []);
    setCertificates(certs || []);
    setSurveys(survs || []);
    setAssessments(assess || []);
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ---- Helper getters ----
  const getActivity = useCallback((id) => activities.find(a => a.id === id), [activities]);
  const getParticipant = useCallback((id) => participants.find(p => p.id === id), [participants]);

  const getRegsForActivity = useCallback((aid) =>
    registrations.filter(r => r.activity_id === aid).map(r => r.participant_id),
  [registrations]);

  const getAttForActivity = useCallback((aid) =>
    attendance.filter(a => a.activity_id === aid),
  [attendance]);

  const getDoneSessions = useCallback((aid) => {
    const set = [];
    attendance.filter(a => a.activity_id === aid).forEach(a => {
      if (!set.includes(a.session_label)) set.push(a.session_label);
    });
    return set;
  }, [attendance]);

  const getAttendancePct = useCallback((aid, pid) => {
    const done = getDoneSessions(aid);
    if (!done.length) return null;
    const recs = attendance.filter(a => a.activity_id === aid && a.participant_id === pid);
    const attended = recs.filter(a => a.status !== 'absent').length;
    return Math.round((attended / done.length) * 100);
  }, [attendance, getDoneSessions]);

  // ---- Mutators ----
  const addActivity = useCallback(async (activity) => {
    const { data, error } = await supabase.from('activities').insert(activity).select().single();
    if (error) throw error;
    setActivities(prev => [data, ...prev]);
    return data;
  }, []);

  const updateActivity = useCallback(async (id, updates) => {
    const { data, error } = await supabase.from('activities').update(updates).eq('id', id).select().single();
    if (error) throw error;
    setActivities(prev => prev.map(a => a.id === id ? data : a));
    return data;
  }, []);

  const deleteActivity = useCallback(async (id) => {
    const { error } = await supabase.from('activities').delete().eq('id', id);
    if (error) throw error;
    // Cascade in local state (DB handles it, but UI needs to stay in sync)
    setActivities(prev => prev.filter(a => a.id !== id));
    setRegistrations(prev => prev.filter(r => r.activity_id !== id));
    setAttendance(prev => prev.filter(a => a.activity_id !== id));
    setCertificates(prev => prev.filter(c => c.activity_id !== id));
    setSurveys(prev => prev.filter(s => s.activity_id !== id));
    setAssessments(prev => prev.filter(a => a.activity_id !== id));
  }, []);

  const addParticipant = useCallback(async (participant, opts = {}) => {
    // Members need approval unless skipApproval is set (e.g. when admin approves)
    if (!isAdmin && !opts.skipApproval) {
      const { error } = await supabase.from('pending_approvals').insert({
        team_id: profile.team_id,
        requested_by: user.id,
        action_type: 'add_participant',
        payload: participant,
      });
      if (error) throw error;
      return { pending: true };
    }
    const { data, error } = await supabase.from('participants').insert(participant).select().single();
    if (error) throw error;
    setParticipants(prev => [...prev, data]);
    return data;
  }, [isAdmin, profile, user]);

  const updateParticipant = useCallback(async (id, updates) => {
    const { data, error } = await supabase.from('participants').update(updates).eq('id', id).select().single();
    if (error) throw error;
    setParticipants(prev => prev.map(p => p.id === id ? data : p));
    return data;
  }, []);

  const deleteParticipant = useCallback(async (id) => {
    const { error } = await supabase.from('participants').delete().eq('id', id);
    if (error) throw error;
    setParticipants(prev => prev.filter(p => p.id !== id));
    setRegistrations(prev => prev.filter(r => r.participant_id !== id));
    setAttendance(prev => prev.filter(a => a.participant_id !== id));
    setCertificates(prev => prev.filter(c => c.participant_id !== id));
  }, []);

  const addRegistration = useCallback(async (activityId, participantId) => {
    const { data, error } = await supabase
      .from('registrations')
      .insert({ activity_id: activityId, participant_id: participantId })
      .select().single();
    if (error) throw error;
    setRegistrations(prev => [...prev, data]);
    return data;
  }, []);

  const upsertAttendance = useCallback(async (activityId, participantId, sessionLabel, status) => {
    const { data, error } = await supabase
      .from('attendance')
      .upsert(
        { activity_id: activityId, participant_id: participantId, session_label: sessionLabel, status },
        { onConflict: 'activity_id,participant_id,session_label' }
      )
      .select().single();
    if (error) throw error;
    setAttendance(prev => {
      const idx = prev.findIndex(a =>
        a.activity_id === activityId && a.participant_id === participantId && a.session_label === sessionLabel
      );
      if (idx >= 0) { const next = [...prev]; next[idx] = data; return next; }
      return [...prev, data];
    });
    return data;
  }, []);

  const issueCertificate = useCallback(async (activityId, participantId, certificateType = 'completion') => {
    // Members need approval for certificate issuance
    if (!isAdmin) {
      const act = activities.find(a => a.id === activityId);
      const part = participants.find(p => p.id === participantId);
      const { error } = await supabase.from('pending_approvals').insert({
        team_id: profile.team_id,
        requested_by: user.id,
        action_type: 'issue_certificate',
        payload: {
          activity_id: activityId,
          participant_id: participantId,
          certificate_type: certificateType,
          activity_title: act?.title || '',
          participant_name: part?.name || '',
        },
      });
      if (error) throw error;
      return { pending: true };
    }

    const { data: noData } = await supabase.rpc('next_cert_no');
    const certNo = noData || `LEX-${new Date().getFullYear()}-${String(certificates.length + 1).padStart(4, '0')}`;
    const { data, error } = await supabase
      .from('certificates')
      .insert({
        cert_no: certNo,
        activity_id: activityId,
        participant_id: participantId,
        issued_date: new Date().toISOString().slice(0, 10),
        certificate_type: certificateType,
      })
      .select().single();
    if (error) throw error;
    setCertificates(prev => [data, ...prev]);
    return data;
  }, [certificates.length, isAdmin, profile, user, activities, participants]);

  return (
    <DataContext.Provider value={{
      loading, refetch: fetchAll,
      activities, participants, registrations, attendance, certificates, surveys, assessments,
      getActivity, getParticipant, getRegsForActivity, getAttForActivity,
      getDoneSessions, getAttendancePct,
      addActivity, updateActivity, deleteActivity,
      addParticipant, updateParticipant, deleteParticipant,
      addRegistration, upsertAttendance, issueCertificate,
      setSurveys, setAssessments,
    }}>
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used within DataProvider');
  return ctx;
}
