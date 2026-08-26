import { useCallback, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import BillingPlan from '../components/BillingPlan';

export default function BillingPage() {
  const { isAdmin } = useAuth();
  const [toast, setToast] = useState(null);

  const showToast = useCallback((message) => {
    setToast(message);
    setTimeout(() => setToast(null), 2500);
  }, []);

  return (
    <div>
      <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 700 }}>Billing &amp; plan</h2>
      <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 6, maxWidth: 640, lineHeight: 1.55 }}>
        Review your organisation’s current access, usage limits, payment history, and upgrade options.
      </p>
      <BillingPlan isAdmin={isAdmin} notify={showToast} />
      {toast && <div role="status" style={{ position: 'fixed', bottom: 26, left: '50%', transform: 'translateX(-50%)', background: 'var(--color-navy-900)', color: '#FFFFFF', fontSize: 13, fontWeight: 500, padding: '11px 20px', borderRadius: 999, boxShadow: 'var(--shadow-raised)', zIndex: 300 }}>{toast}</div>}
    </div>
  );
}
