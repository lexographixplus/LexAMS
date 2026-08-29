import { useState } from 'react';
import { Link } from 'react-router-dom';

const freeFeatures = [
  'Up to 50 participants',
  '2 active activities',
  '1 team seat',
  '1 survey per activity with up to 5 questions',
  '1 assessment per activity with up to 10 questions',
  'Generate, view and download up to 5 certificates per month',
  'Manual planning, weekly schedules, budgets and journals',
  '1 built-in activity report with linked evidence and PDF',
];

const proFeatures = [
  'Up to 5,000 participants',
  'Up to 100 active activities',
  'Up to 20 team seats with collaboration',
  'Up to 25 surveys per activity with 50 questions each',
  'Up to 25 assessments per activity with 100 questions each',
  'Timed assessments',
  'CSV and advanced report exports',
  'Session and facilitator CSV import',
  'Up to 25 reports per activity',
  'Custom report templates and structures',
  'Evidence-grounded narrative generation',
  'Report review and approval workflows',
  'Custom organisation branding',
  'Up to 1,000 certificates per month',
  'Participant announcements and programme email',
  'Individual and bulk certificate email delivery',
  'Automatic certificate email delivery',
];

function FeatureList({ items, pro = false }) {
  return (
    <ul className={`mk-plan-features${pro ? ' pro' : ''}`}>
      {items.map((item) => (
        <li key={item}>
          <span className="mk-plan-check" aria-hidden="true">✓</span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

export default function PricingPlanCards({
  freeCta = 'Start free',
  proCta = 'Start with Free',
  freeTo = '/signup',
  proTo = '/signup',
}) {
  const [annual, setAnnual] = useState(true);
  const proPrice = annual ? '10,000' : '1,000';
  const proPeriod = annual ? '/year' : '/month';

  return (
    <>
      <div className="mk-billing-toggle" role="group" aria-label="Billing frequency">
        <button type="button" className={!annual ? 'active' : ''} onClick={() => setAnnual(false)}>Monthly</button>
        <button type="button" className={annual ? 'active' : ''} onClick={() => setAnnual(true)}>
          Annually <span>Save 17%</span>
        </button>
      </div>

      <div className="mk-pricing-modern">
        <article className="mk-plan-card mk-plan-free">
          <div className="mk-plan-head">
            <div>
              <div className="mk-plan-label">Free</div>
              <h2>Free</h2>
              <p>For small programmes, pilots and teams getting started.</p>
            </div>
            <div className="mk-plan-price-row"><span className="mk-plan-currency">GMD</span><strong>0</strong></div>
          </div>
          <Link className="mk-plan-cta free" to={freeTo}>{freeCta}</Link>
          <div className="mk-plan-divider" />
          <div className="mk-plan-included">What’s included</div>
          <FeatureList items={freeFeatures} />
        </article>

        <article className="mk-plan-card mk-plan-pro">
          <div className="mk-plan-badge">Recommended</div>
          <div className="mk-plan-head">
            <div>
              <div className="mk-plan-label">Pro</div>
              <h2>Pro</h2>
              <p>For growing organisations running larger or recurring programmes.</p>
            </div>
            <div className="mk-plan-price-row pro"><span className="mk-plan-currency">GMD</span><strong key={proPrice}>{proPrice}</strong><small>{proPeriod}</small></div>
            <p className="mk-plan-price-note">{annual ? 'GMD 833/month equivalent · billed annually' : 'Billed monthly'}</p>
          </div>
          <Link className="mk-plan-cta pro" to={proTo}>{proCta}</Link>
          <div className="mk-plan-divider" />
          <div className="mk-plan-included">Everything in Free, plus</div>
          <FeatureList items={proFeatures} pro />
        </article>
      </div>
    </>
  );
}
