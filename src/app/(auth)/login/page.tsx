'use client';
import Link from 'next/link';
import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase/client';
import { Button, Field, Input } from '@/components/ui';
import { authErrorText, GoogleButton, safeNext } from '@/components/auth';

export default function LoginPage() { return <Suspense><Login /></Suspense>; }

function Login() {
  const params = useSearchParams();
  const router = useRouter();
  const next = safeNext(params.get('next'));
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(params.get('error') === 'link' ? 'That link has expired or was already used. Please try again.' : '');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError('');
    const { error } = await supabaseBrowser().auth.signInWithPassword({ email: email.trim(), password });
    if (error) { setError(authErrorText(error.message)); setBusy(false); return; }
    router.replace(next);
    router.refresh();
  };

  return (
    <>
      <h1 className="font-serif text-4xl">Welcome back</h1>
      <p className="mb-8 mt-2 text-muted">Sign in to your wardrobe.</p>
      <GoogleButton next={next} />
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Email">{id => <Input id={id} type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} />}</Field>
        <Field label="Password">{id => <Input id={id} type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} />}</Field>
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        <Button type="submit" block loading={busy} disabled={!email || !password}>Sign in</Button>
      </form>
      <div className="mt-6 flex justify-between text-sm">
        <Link href="/forgot" className="text-accent">Forgot password?</Link>
        <Link href={`/signup${next !== '/app' ? `?next=${encodeURIComponent(next)}` : ''}`} className="text-accent">Create an account</Link>
      </div>
    </>
  );
}
