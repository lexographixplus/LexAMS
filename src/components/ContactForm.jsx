import { useState } from 'react';
import { ArrowRight, CheckCircle2 } from 'lucide-react';

const inputStyle = {
  width: '100%', padding: '12px 13px', border: '1px solid #DDE2E8', borderRadius: 8,
  background: '#fff', color: '#122033', font: 'inherit', outline: 'none',
};

export default function ContactForm() {
  const [status, setStatus] = useState('idle');
  const [message, setMessage] = useState('');

  async function submit(event) {
    event.preventDefault();
    if (status === 'sending') return;
    const form = event.currentTarget;
    const formData = new FormData(form);
    setStatus('sending');
    setMessage('');

    try {
      const encoded = new URLSearchParams(formData).toString();
      const payload = Object.fromEntries(formData.entries());
      const [netlifyResponse, emailResponse] = await Promise.all([
        fetch('/__forms.html', {
          method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: encoded,
        }),
        fetch('/api/contact', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
        }),
      ]);
      const emailData = await emailResponse.json().catch(() => ({}));
      if (!emailResponse.ok) throw new Error(emailData.error || 'Your message could not be sent. Please try again.');
      if (!netlifyResponse.ok) console.warn('Netlify Forms did not record the contact submission.');
      form.reset();
      setStatus('sent');
      setMessage('Thanks — your message has been sent to the LexAMS team.');
    } catch (error) {
      setStatus('error');
      setMessage(error.message || 'Your message could not be sent. Please try again.');
    }
  }

  return <form name="lexams-contact" method="POST" data-netlify="true" netlify-honeypot="bot-field" onSubmit={submit} style={{ maxWidth: 760, padding: 28, border: '1px solid #DDE2E8', borderRadius: 18, background: '#fff', boxShadow: '0 16px 42px rgba(0,43,84,.06)' }}>
    <input type="hidden" name="form-name" value="lexams-contact" />
    <p style={{ display: 'none' }} aria-hidden="true"><label>Leave this field empty <input name="bot-field" tabIndex="-1" autoComplete="off" /></label></p>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }} className="lexams-contact-grid">
      <label style={labelStyle}>Name<input required name="name" maxLength="120" autoComplete="name" style={inputStyle} /></label>
      <label style={labelStyle}>Email<input required name="email" type="email" maxLength="254" autoComplete="email" style={inputStyle} /></label>
    </div>
    <label style={{ ...labelStyle, marginTop: 14 }}>Organisation <input name="organization" maxLength="160" autoComplete="organization" style={inputStyle} /></label>
    <label style={{ ...labelStyle, marginTop: 14 }}>How can we help?<textarea required name="message" maxLength="4000" rows="6" style={{ ...inputStyle, resize: 'vertical' }} /></label>
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 18, flexWrap: 'wrap' }}>
      <button type="submit" disabled={status === 'sending'} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, border: 'none', borderRadius: 8, padding: '12px 18px', background: '#002B54', color: '#fff', fontWeight: 700, fontSize: 14, cursor: status === 'sending' ? 'wait' : 'pointer', opacity: status === 'sending' ? .72 : 1 }}>{status === 'sending' ? 'Sending…' : <>Send enquiry <ArrowRight size={16} /></>}</button>
      {message && <span role="status" style={{ color: status === 'sent' ? '#176C39' : '#A01E1E', fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 6 }}>{status === 'sent' && <CheckCircle2 size={16} />}{message}</span>}
    </div>
  </form>;
}

const labelStyle = { display: 'grid', gap: 7, color: '#33445A', fontSize: 13, fontWeight: 700 };
