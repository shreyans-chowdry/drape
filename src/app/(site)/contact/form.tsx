'use client';
import { useState } from 'react';
import { Button, Field, Input, Select, Textarea } from '@/components/ui';

export function ContactForm() {
  const [f, setF] = useState({ email: '', topic: 'question', message: '', website: '' });
  const [state, setState] = useState<'idle' | 'busy' | 'sent' | 'error'>('idle');
  const [error, setError] = useState('');
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setState('busy');
    const res = await fetch('/api/contact', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(f) });
    if (res.ok) setState('sent');
    else { setState('error'); setError((await res.json().catch(() => ({}))).error ?? 'Could not send. Please try again.'); }
  };
  if (state === 'sent') return <p role="status" className="mt-10 rounded-2xl bg-sage-soft p-5 text-sage">Thanks — your message is with us. We’ll reply to {f.email}.</p>;
  return (
    <form onSubmit={submit} className="mt-10 space-y-4">
      <Field label="Your email">{id => <Input id={id} type="email" required autoComplete="email" value={f.email} onChange={e => setF({ ...f, email: e.target.value })} />}</Field>
      <Field label="Topic">{id => (
        <Select id={id} value={f.topic} onChange={e => setF({ ...f, topic: e.target.value })}>
          <option value="question">A question</option><option value="billing">Billing or refund</option><option value="data">My data or account deletion</option><option value="bug">Something isn’t working</option><option value="feedback">Feedback</option>
        </Select>
      )}</Field>
      <Field label="Message">{id => <Textarea id={id} required minLength={5} maxLength={4000} value={f.message} onChange={e => setF({ ...f, message: e.target.value })} className="min-h-40" />}</Field>
      {/* Honeypot for bots; hidden from people and screen readers. */}
      <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden className="hidden" value={f.website} onChange={e => setF({ ...f, website: e.target.value })} />
      {state === 'error' && <p role="alert" className="text-sm text-danger">{error}</p>}
      <Button type="submit" loading={state === 'busy'}>Send message</Button>
    </form>
  );
}
