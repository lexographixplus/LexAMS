import ContactForm from '../components/ContactForm';
import MarketingLayout from '../components/MarketingLayout';
import Seo from '../components/Seo';

export default function ContactPage() {
  return (
    <MarketingLayout>
      <Seo
        title="Contact LexAMS"
        description="Contact the LexAMS team for product, institutional deployment or billing questions."
        path="/contact"
      />

      <section className="mk-page-hero">
        <div className="mk-container">
          <div className="mk-kicker">Contact</div>
          <h1>Talk to LexAMS.</h1>
          <p>Tell us about your organisation, programme size, product needs or billing question.</p>
          <p>Banjul, The Gambia, West Africa</p>
        </div>
      </section>

      <section className="mk-section">
        <div className="mk-container">
          <div className="mk-section-head">
            <div>
              <div className="mk-kicker">Send an enquiry</div>
              <h2>How can we help?</h2>
            </div>
            <p className="mk-lede">
              Complete the form and the LexAMS team will receive your enquiry through the same secure contact workflow used on the home page.
            </p>
          </div>
          <ContactForm />
        </div>
      </section>
    </MarketingLayout>
  );
}
