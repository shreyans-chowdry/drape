'use client';
import Link from 'next/link';
import { useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase/client';
import { Button, Field, Input } from '@/components/ui';

export default function ForgotPage() {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    await supabaseBrowser().auth.resetPasswordForEmail(email.trim(), { redirectTo: `${location.origin}/auth/callback?next=/reset` });
    // Same message whether or not the account exists, so emails can't be probed.
    setBusy(false); setDone(true);
  };
  return (
    <>
      <h1 className="font-serif text-4xl">Reset your password</h1>
      {done ? (
        <p className="mt-4 text-ink-2">If an account exists for <b>{email}</b>, a reset link is on its way. It works once and expires in an hour.</p>
      ) : (
        <form onSubmit={submit} className="mt-8 space-y-4">
          <Field label="Email">{id => <Input id={id} type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} />}</Field>
          <Button type="submit" block loading={busy} disabled={!email}>Send reset link</Button>
        </form>
      )}
      <p className="mt-6 text-sm"><Link href="/login" className="text-accent">Back to sign in</Link></p>
    </>
  );
}
