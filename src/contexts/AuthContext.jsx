import { createContext, useContext, useState, useEffect, useCallback } from 'react';

const AuthContext = createContext(null);

async function getCsrfToken() {
  const response = await fetch('/api/auth/csrf', { credentials: 'include' });
  if (!response.ok) throw new Error('Could not start authentication.');
  const data = await response.json();
  return data.csrfToken;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const refreshProfile = useCallback(async () => {
    const response = await fetch('/api/me', { credentials: 'include' });
    if (!response.ok) {
      setUser(null);
      setProfile(null);
      setLoading(false);
      return null;
    }

    const data = await response.json();
    setUser(data.user);
    setProfile(data.profile);

    const pending = localStorage.getItem('lexams_pending_onboarding');
    if (pending) {
      try {
        await fetch('/api/onboarding', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: pending,
        });
        localStorage.removeItem('lexams_pending_onboarding');
        const refreshed = await fetch('/api/me', { credentials: 'include' });
        if (refreshed.ok) {
          const next = await refreshed.json();
          setUser(next.user);
          setProfile(next.profile);
        }
      } catch {
        // Keep the pending onboarding details for a later retry.
      }
    }

    setLoading(false);
    return data;
  }, []);

  useEffect(() => {
    refreshProfile();
  }, [refreshProfile]);

  async function requestMagicLink(email) {
    try {
      const csrfToken = await getCsrfToken();
      const body = new URLSearchParams({
        csrfToken,
        email,
        callbackUrl: `${window.location.origin}/app`,
      });

      const response = await fetch('/api/auth/signin/resend', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-Auth-Return-Redirect': '1',
        },
        body,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.error) throw new Error(data.error || 'Could not send sign-in link.');
      return { error: null, emailSent: true };
    } catch (error) {
      return { error };
    }
  }

  async function signIn(email) {
    return requestMagicLink(email);
  }

  async function signUp(email, _password, fullName, orgName) {
    localStorage.setItem('lexams_pending_onboarding', JSON.stringify({ fullName, orgName }));
    return requestMagicLink(email);
  }

  async function signOut() {
    try {
      const csrfToken = await getCsrfToken();
      await fetch('/api/auth/signout', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-Auth-Return-Redirect': '1',
        },
        body: new URLSearchParams({ csrfToken, callbackUrl: window.location.origin }),
      });
    } finally {
      setUser(null);
      setProfile(null);
      window.location.assign('/');
    }
  }

  const isAdmin = profile?.team_role === 'admin';

  return (
    <AuthContext.Provider value={{
      user, profile, loading,
      signUp, signIn, signOut,
      isDemo: false,
      isAdmin,
      refreshProfile,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
