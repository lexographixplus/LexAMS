import { Component } from 'react';

export default class AppErrorBoundary extends Component {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error, info) {
    console.error('LexAMS render failure', error, info);
  }

  render() {
    if (!this.state.failed) return this.props.children;

    return (
      <main role="alert" style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24, background: 'var(--surface-muted)' }}>
        <section style={{ width: 'min(520px, 100%)', padding: '36px 32px', textAlign: 'center', background: 'var(--surface-card)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-card)' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 800, color: 'var(--color-navy-900)' }}>LexAMS</div>
          <h1 style={{ marginTop: 24, fontFamily: 'var(--font-display)', fontSize: 22, color: 'var(--text-primary)' }}>Something went wrong</h1>
          <p style={{ marginTop: 10, fontSize: 14, lineHeight: 1.6, color: 'var(--text-secondary)' }}>Your data is safe. Reload the page to recover, or return to the dashboard if the problem continues.</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 10, marginTop: 24 }}>
            <button onClick={() => window.location.reload()} style={{ padding: '10px 20px', fontSize: 14, fontWeight: 700, color: '#fff', background: 'var(--color-navy-900)', border: 0, borderRadius: 'var(--radius-md)', cursor: 'pointer' }}>Reload page</button>
            <a href="/app" style={{ padding: '10px 20px', fontSize: 14, fontWeight: 700, color: 'var(--color-navy-900)', textDecoration: 'none', background: 'var(--surface-card)', border: '1.5px solid var(--border-default)', borderRadius: 'var(--radius-md)' }}>Go to dashboard</a>
          </div>
        </section>
      </main>
    );
  }
}
