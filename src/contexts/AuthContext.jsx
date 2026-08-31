import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { isReportingPreviewDemo } from '../lib/reportPreviewDemo';

const AuthContext = createContext(null);

async function getCsrfToken() {
  const response = await fetch('/api/auth/csrf', { credentials: 'include' });
  if (!response.ok) throw new Error('Could not start authentication.');
  const data = await response.json();
  return data.csrfToken;
}

/**
 * Reads a JSON body, returning null when the response is not actually JSON.
 * Gateways, CDNs and offline proxies answer with HTML error pages, and an
 * unguarded parse of those throws where nothing is listening.
 */
async function readJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function authErrorFromResponse(data) {
  if (data?.error) return data.error;
  if (typeof data?.url === 'string') {
    try { return new URL(data.url, window.location.origin).searchParams.get('error'); }
    catch { return null; }
  }
  return null;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [billing, setBilling] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sessionError, setSessionError] = useState(null);

  const refreshProfile = useCallback(async () => {
    if (isReportingPreviewDemo()) {
      const previewTrialDays = Math.min(30, Math.max(0, Number(new URLSearchParams(window.location.search).get('trial')) || 0));
      const trialEndsAt = previewTrialDays ? new Date(Date.now() + previewTrialDays * 86400000).toISOString() : null;
      const preview = {
        user: { id: 'preview-user', name: 'Preview Administrator', email: 'preview@example.invalid' },
        profile: { full_name: 'Preview Administrator', org_name: 'LexAMS Demo Workspace', role: 'owner', team_role: 'admin', platform_admin: false },
        billing: { subscription: previewTrialDays
          ? { plan: 'pro', status: 'trialing', trial_ends_at: trialEndsAt, current_period_end: trialEndsAt, trial_days_remaining: previewTrialDays }
          : { plan: 'pro', status: 'active' } },
      };
      setUser(preview.user); setProfile(preview.profile); setBilling(preview.billing);
      setSessionError(null); setLoading(false);
      return preview;
    }
    let response;
    try {
      response = await fetch('/api/me', { credentials: 'include' });
    } catch {
      // The network is unreachable, or the request was blocked. This is
      // recoverable, so surface it rather than leaving the app on its splash.
      setUser(null); setProfile(null); setBilling(null);
      setSessionError('We could not reach LexAMS. Check your connection and try again.');
      setLoading(false);
      return null;
    }
    if (!response.ok) {
      // A signed-out visitor is the normal case here, not a failure.
      setUser(null); setProfile(null); setBilling(null); setSessionError(null); setLoading(false); return null;
    }
    const data = await readJson(response);
    if (!data) {
      // A gateway or CDN returned an error page where session data was expected.
      setUser(null); setProfile(null); setBilling(null);
      setSessionError('LexAMS returned an unexpected response. This is usually temporary.');
      setLoading(false);
      return null;
    }
    setSessionError(null);
    setUser(data.user); setProfile(data.profile); setBilling(data.billing || null);

    const pending = localStorage.getItem('lexams_pending_onboarding');
    if (pending) {
      try {
        await fetch('/api/onboarding', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: pending });
        localStorage.removeItem('lexams_pending_onboarding');
        const refreshed = await fetch('/api/me', { credentials: 'include' });
        const next = refreshed.ok ? await readJson(refreshed) : null;
        if (next) {
          setUser(next.user); setProfile(next.profile); setBilling(next.billing || null);
        }
      } catch {
        // Keep pending onboarding details for a later retry.
      }
    }
    setLoading(false);
    return data;
  }, []);

  useEffect(() => { refreshProfile(); }, [refreshProfile]);

  async function requestMagicLink(email, callbackUrl = '/app') {
    try {
      const csrfToken = await getCsrfToken();
      const absoluteCallback = callbackUrl.startsWith('http') ? callbackUrl : `${window.location.origin}${callbackUrl}`;
      const body = new URLSearchParams({ csrfToken, email: String(email || '').trim().toLowerCase(), callbackUrl: absoluteCallback });
      const response = await fetch('/api/auth/signin/resend', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-Auth-Return-Redirect': '1' }, body,
      });
      const data = await response.json().catch(() => ({}));
      const authError = authErrorFromResponse(data);
      if (!response.ok || authError) {
        const error = new Error(authError === 'AccessDenied' ? 'No LexAMS account found.' : (authError || 'Could not send sign-in link.'));
        return { error, errorCode: authError || 'AuthError', emailSent: false };
      }
      return { error: null, errorCode: null, emailSent: true };
    } catch (error) { return { error }; }
  }

  async function signIn(email, callbackUrl) { return requestMagicLink(email, callbackUrl); }

  async function signUp(email, _password, fullName, orgName, callbackUrl) {
    try {
      const normalizedEmail = String(email || '').trim().toLowerCase();
      const intentResponse = await fetch('/api/signup-intent', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: normalizedEmail }) });
      const intentData = await intentResponse.json().catch(() => ({}));
      if (!intentResponse.ok) throw new Error(intentData.error || 'Could not start account creation.');
      if (fullName || orgName) localStorage.setItem('lexams_pending_onboarding', JSON.stringify({ fullName, orgName }));
      return requestMagicLink(normalizedEmail, callbackUrl);
    } catch (error) { return { error }; }
  }

  async function signOut() {
    try {
      const csrfToken = await getCsrfToken();
      await fetch('/api/auth/signout', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-Auth-Return-Redirect': '1' },
        body: new URLSearchParams({ csrfToken, callbackUrl: window.location.origin }),
      });
    } finally {
      setUser(null); setProfile(null); setBilling(null); window.location.assign('/');
    }
  }

  const isAdmin = ['owner', 'admin'].includes(profile?.team_role);
  const isPro = billing?.subscription?.plan === 'pro';

  return <AuthContext.Provider value={{ user, profile, billing, loading, sessionError, signUp, signIn, signOut, isDemo: isReportingPreviewDemo(), isAdmin, isPro, refreshProfile }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
