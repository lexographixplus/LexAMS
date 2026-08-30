import MarketingLayout from '../components/MarketingLayout';
import PricingPlanCards from '../components/PricingPlanCards';
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
  ['Manual planning, weekly schedules, budgets and journals', 'Included', 'Included'],
  ['Session and facilitator CSV import', 'No', 'Yes'],
  ['Activity reports', '1 per activity', 'Up to 25 per activity'],
  ['Report templates', 'Built-in templates', 'Built-in and custom templates'],
  ['Narrative generation', 'Manual writing', 'Evidence-grounded drafts'],
  ['Report workflow', 'Draft and Print/PDF', 'Review and approval'],
  ['CSV export', 'No', 'Yes'],
  ['Custom organisation branding', 'No', 'Yes'],
  ['Certificates per month', '5', 'Up to 1,000'],
];

export default function PricingPage() {
  return (
    <MarketingLayout>
      <Seo
        title="LexAMS Pricing | Free & Pro Plans"
        description="Start with a 30-day LexAMS Pro trial, then upgrade or continue on Free with up to 50 participants. No card required."
        path="/pricing"
        schema={productSchema}
      />

      <section className="mk-page-hero mk-pricing-hero">
        <div className="mk-container mk-pricing-heading">
          <div className="mk-kicker">Simple pricing</div>
          <h1>Try every Pro workflow for 30 days.</h1>
          <p>Every new workspace starts with full Pro access. No card is required. Upgrade to keep Pro after day 30, or continue automatically on the useful Free plan.</p>
        </div>
      </section>

      <section className="mk-section mk-pricing-section">
        <div className="mk-container">
          <PricingPlanCards />

          <div className="mk-pricing-compare-head">
            <div>
              <div className="mk-kicker">Compare plans</div>
              <h2>See the limits side by side.</h2>
            </div>
            <p>During the trial you receive the Pro column. Afterward, choose Pro or continue with the Free limits shown here—your existing records remain available.</p>
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
            <p>The 30-day Pro trial requires no card and never charges automatically. To keep Pro, choose monthly billing at GMD 1,000 or annual billing at GMD 10,000 before or after the trial.</p>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}
