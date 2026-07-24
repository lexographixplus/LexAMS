import { createContext, useContext, useState, useEffect } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const isDemo = !isSupabaseConfigured;

  useEffect(() => {
    if (isDemo) {
      setLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) fetchProfile(session.user.id);
      else setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) fetchProfile(session.user.id);
      else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function fetchProfile(userId) {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    // Auto-set team_id for admins who don't have one yet
    if (data && !data.team_id) {
      await supabase.from('profiles').update({ team_id: userId, team_role: 'admin' }).eq('id', userId);
      data.team_id = userId;
      data.team_role = 'admin';
    }

    setProfile(data);
    setLoading(false);
  }

  async function signUp(email, password, fullName, orgName) {
    if (isDemo) {
      const demoUser = { id: 'demo', email, user_metadata: { full_name: fullName } };
      const demoProfile = { id: 'demo', full_name: fullName, org_name: orgName || 'Horizon Community Foundation', role: 'Institution Administrator', team_role: 'admin' };
      setUser(demoUser);
      setProfile(demoProfile);
      return { user: demoUser, error: null };
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName, org_name: orgName } },
    });

    // After signup, set team_id to self (admin)
    if (data?.user && !error) {
      await supabase.from('profiles').update({ team_id: data.user.id, team_role: 'admin' }).eq('id', data.user.id);
    }

    return { user: data?.user, error };
  }

  async function signIn(email, password) {
    if (isDemo) {
      const demoUser = { id: 'demo', email, user_metadata: { full_name: 'Demo User' } };
      const demoProfile = { id: 'demo', full_name: 'Demo User', org_name: 'Horizon Community Foundation', role: 'Institution Administrator', team_role: 'admin' };
      setUser(demoUser);
      setProfile(demoProfile);
      return { user: demoUser, error: null };
    }

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    return { user: data?.user, error };
  }

  async function signOut() {
    if (isDemo) {
      setUser(null);
      setProfile(null);
      return;
    }
    await supabase.auth.signOut();
  }

  const isAdmin = profile?.team_role === 'admin';

  async function refreshProfile() {
    if (user) await fetchProfile(user.id);
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading, signUp, signIn, signOut, isDemo, isAdmin, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
