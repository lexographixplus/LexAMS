import { useState } from 'react';
import { Link } from 'react-router-dom';
import MarketingLayout from '../components/MarketingLayout';
import Seo from '../components/Seo';

const productSchema = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'LexAMS',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web',
  url: 'https://lexams.netlify.app',
  offers: [
    { '@type': 'Offer', price: '0', priceCurrency: 'GMD', name: 'Free' },
    { '@type': 'Offer', price: '1000', priceCurrency: 'GMD', name: 'Pro Monthly' },
    { '@type': 'Offer', price: '10000', priceCurrency: 'GMD', name: 'Pro Annual' },
  ],
  publisher: {
    '@type': 'Organization',
    name: 'LexoGraphix Plus',
    address: { '@type': 'PostalAddress', addressLocality: 'Banjul', addressCountry: 'GM' },
  },
};

const freeFeatures = [
  'Up to 50 participants',
  '2 active activities',
  '1 team seat',
  '1 survey per activity with up to 5 questions',
  '1 assessment per activity with up to 10 questions',
  '5 certificates per month',
];

const proFeatures = [
  'Up to 5,000 participants',
  'Up to 100 active activities',
  'Up to 20 team seats with collaboration',
  'Up to 25 surveys per activity with 50 questions each',
  'Up to 25 assessments per activity with 100 questions each',
  'Timed assessments',
  'CSV exports',
  'Custom organisation branding',
  'Up to 1,000 certificates per month',
];

const comparison = [
  ['Participants', 'Up to 50', 'Up to 5,000'],
  ['Active activities', '2', '100'],
  ['Team seats', '1', 'Up to 20'],
  ['Team collaboration', 'No', 'Yes'],
  ['Surveys per activity', '1', '25'],
  ['Survey questions', 'Up to 5', 'Up to 50'],
  ['Assessments per activity', '1', '25'],
  ['Assessment questions', 'Up to 10', 'Up to 100'],
  ['Timed assessments', 'No', 'Yes'],
  ['CSV export', 'No', 'Yes'],
  ['Custom organisation branding', 'No', 'Yes'],
  ['Certificates per month', '5', 'Up to 1,000'],
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

export default function PricingPage() {
  const [annual, setAnnual] = useState(true);
  const proPrice = annual ? '10,000' : '1,000';
  const proPeriod = annual ? '/year' : '/month';

  return (
    <MarketingLayout>
      <Seo
        title="LexAMS Pricing | Free & Pro Plans"
        description="Start LexAMS free with up to 50 participants, or upgrade to Pro for expanded capacity, collaboration and professional reporting."
        path="/pricing"
        schema={productSchema}
      />

      <section className="mk-page-hero mk-pricing-hero">
        <div className="mk-container mk-pricing-heading">
          <div className="mk-kicker">Simple pricing</div>
          <h1>Start useful. Upgrade when your programmes grow.</h1>
          <p>Choose the plan that fits your programme today. Start Free with no card required and upgrade when you need more capacity and collaboration.</p>
          <div className="mk-billing-toggle" role="group" aria-label="Billing frequency">
            <button type="button" className={!annual ? 'active' : ''} onClick={() => setAnnual(false)}>Monthly</button>
            <button
              type="button"
              className={annual ? 'active' : ''}
              onClick={() => setAnnual(true)}
            >
              Annually <span>Save 17%</span>
            </button>
          </div>
        </div>
      </section>

      <section className="mk-section mk-pricing-section">
        <div className="mk-container">
          <div className="mk-pricing-modern">
            <article className="mk-plan-card mk-plan-free">
              <div className="mk-plan-head">
                <div>
                  <div className="mk-plan-label">Free</div>
                  <h2>Free</h2>
                  <p>For small programmes, pilots and teams getting started.</p>
                </div>
                <div className="mk-plan-price-row">
                  <span className="mk-plan-currency">GMD</span>
                  <strong>0</strong>
                </div>
              </div>

              <Link className="mk-plan-cta free" to="/signup">Start free</Link>

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
                <div className="mk-plan-price-row pro">
                  <span className="mk-plan-currency">GMD</span>
                  <strong key={proPrice}>{proPrice}</strong>
                  <small>{proPeriod}</small>
                </div>
                <p className="mk-plan-price-note">
                  {annual ? 'GMD 833/month equivalent · billed annually' : 'Billed monthly'}
                </p>
              </div>

              <Link className="mk-plan-cta pro" to="/signup">Start with Free</Link>

              <div className="mk-plan-divider" />
              <div className="mk-plan-included">Everything in Free, plus</div>
              <FeatureList items={proFeatures} pro />
            </article>
          </div>

          <div className="mk-pricing-compare-head">
            <div>
              <div className="mk-kicker">Compare plans</div>
              <h2>See the limits side by side.</h2>
            </div>
            <p>Free is designed to be genuinely useful. Pro expands the exact areas that typically become constraints as programme delivery grows.</p>
          </div>

          <div className="mk-table-wrap">
            <table className="mk-table">
              <thead><tr><th>Capability</th><th>Free</th><th>Pro</th></tr></thead>
              <tbody>
                {comparison.map(([capability, free, pro]) => (
                  <tr key={capability}><td>{capability}</td><td>{free}</td><td>{pro}</td></tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mk-card mk-payment-note">
            <h3>Payment</h3>
            <p>Payments for LexAMS Pro are handled securely. Monthly billing is GMD 1,000 and annual billing is GMD 10,000.</p>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}
