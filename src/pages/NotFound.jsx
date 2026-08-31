import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import useDocumentTitle from '../lib/useDocumentTitle';

/**
 * Renders for any address that matches no route. `inWorkspace` is set by the
 * catch-all inside /app, where the sidebar and top bar are already on screen and
 * the card should sit in the content column rather than fill the viewport.
 */
export default function NotFound({ inWorkspace = false }) {
  const { user } = useAuth();
  useDocumentTitle('Page not found');

  return (
    <main className={inWorkspace ? 'lx-message-inline' : 'lx-message-page'}>
      <section className="lx-message-card">
        {inWorkspace
          ? <span className="lx-message-brand">LexAMS</span>
          : <Link to={user ? '/app' : '/'} className="lx-message-brand">LexAMS</Link>}
        <p className="lx-message-code">Error 404</p>
        <h1>We could not find that page</h1>
        <p>
          The address may have been mistyped, or the page may have moved. Registration
          and check-in links also stop working once their activity is closed.
        </p>
        <div className="lx-message-actions">
          {user
            ? <Link to="/app" className="lx-btn lx-btn-primary">Go to dashboard</Link>
            : <Link to="/" className="lx-btn lx-btn-primary">Go to the home page</Link>}
          <Link to="/contact" className="lx-btn lx-btn-secondary">Contact support</Link>
        </div>
      </section>
    </main>
  );
}
