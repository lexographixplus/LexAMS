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
  ['CSV export', 'No', 'Yes'],
  ['Custom organisation branding', 'No', 'Yes'],
  ['Certificates per month', '5', 'Up to 1,000'],
];

export default function PricingPage() {
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
