'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { MailCheck } from 'lucide-react';
import { supabaseBrowser } from '@/lib/supabase/client';
import { Button, Field, Input } from '@/components/ui';
import { authErrorText, GoogleButton } from '@/components/auth';

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [agree, setAgree] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) { setError('Use at least 8 characters for your password.'); return; }
    setBusy(true); setError('');
    const { data, error } = await supabaseBrowser().auth.signUp({
      email: email.trim(), password,
      options: { data: { display_name: name.trim() }, emailRedirectTo: `${location.origin}/auth/callback?next=/onboarding` },
    });
    setBusy(false);
    if (error) { setError(authErrorText(error.message)); return; }
    if (data.session) { router.replace('/onboarding'); router.refresh(); } // email confirmation turned off
    else setSent(true);
  };

  if (sent) return (
    <div className="text-center">
      <MailCheck className="mx-auto size-10 text-accent" />
      <h1 className="mt-4 font-serif text-3xl">Check your email</h1>
      <p className="mt-2 text-muted">We sent a confirmation link to <b className="text-ink">{email}</b>. Open it on this device to finish creating your account.</p>
      <p className="mt-6 text-sm text-muted">Nothing after a few minutes? Check spam, or <button className="text-accent" onClick={() => supabaseBrowser().auth.resend({ type: 'signup', email, options: { emailRedirectTo: `${location.origin}/auth/callback?next=/onboarding` } }).then(() => setError('Sent again.'))}>send it again</button>.</p>
      {error && <p className="mt-2 text-sm text-muted">{error}</p>}
    </div>
  );

  return (
    <>
      <h1 className="font-serif text-4xl">Create your wardrobe</h1>
      <p className="mb-8 mt-2 text-muted">Free to start. No card needed.</p>
      <GoogleButton next="/onboarding" />
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Your name">{id => <Input id={id} autoComplete="name" value={name} maxLength={60} onChange={e => setName(e.target.value)} />}</Field>
        <Field label="Email">{id => <Input id={id} type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} />}</Field>
        <Field label="Password" hint="At least 8 characters">{id => <Input id={id} type="password" autoComplete="new-password" required minLength={8} value={password} onChange={e => setPassword(e.target.value)} />}</Field>
        <label className="flex items-start gap-2 text-sm text-ink-2">
          <input type="checkbox" className="mt-0.5 size-4 accent-[var(--accent)]" checked={agree} onChange={e => setAgree(e.target.checked)} />
          <span>I agree to the <Link href="/terms" className="text-accent" target="_blank">Terms</Link> and <Link href="/privacy" className="text-accent" target="_blank">Privacy Policy</Link>.</span>
        </label>
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        <Button type="submit" block loading={busy} disabled={!email || !password || !agree}>Create account</Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted">Already have an account? <Link href="/login" className="text-accent">Sign in</Link></p>
    </>
  );
}
