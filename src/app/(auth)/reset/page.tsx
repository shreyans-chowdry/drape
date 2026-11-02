'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase/client';
import { Button, Field, Input } from '@/components/ui';
import { authErrorText } from '@/components/auth';

export default function ResetPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) return setError('Use at least 8 characters.');
    if (password !== confirm) return setError('The passwords don’t match.');
    setBusy(true);
    const { error } = await supabaseBrowser().auth.updateUser({ password });
    setBusy(false);
    if (error) setError(/session/i.test(error.message) ? 'This reset link has expired. Request a new one.' : authErrorText(error.message));
    else { router.replace('/app'); router.refresh(); }
  };
  return (
    <>
      <h1 className="font-serif text-4xl">Choose a new password</h1>
      <form onSubmit={submit} className="mt-8 space-y-4">
        <Field label="New password" hint="At least 8 characters">{id => <Input id={id} type="password" autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} />}</Field>
        <Field label="Confirm password">{id => <Input id={id} type="password" autoComplete="new-password" value={confirm} onChange={e => setConfirm(e.target.value)} />}</Field>
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        <Button type="submit" block loading={busy}>Save password</Button>
      </form>
    </>
  );
}
