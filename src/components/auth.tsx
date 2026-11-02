'use client';
import { GOOGLE_AUTH_ENABLED } from '@/lib/env';
import { supabaseBrowser } from '@/lib/supabase/client';
import { Button } from '@/components/ui';

/** A same-site path only — never redirect to another origin after sign-in. */
export const safeNext = (n: string | null | undefined, fallback = '/app') => (n && n.startsWith('/') && !n.startsWith('//') && !n.startsWith('/\\') ? n : fallback);

export function GoogleButton({ next }: { next: string }) {
  if (!GOOGLE_AUTH_ENABLED) return null;
  return (
    <>
      <Button type="button" variant="secondary" block onClick={() => supabaseBrowser().auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${location.origin}/auth/callback?next=${encodeURIComponent(next)}` } })}>
        <svg viewBox="0 0 24 24" className="size-4" aria-hidden><path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.2-2.1 3.5-5.1 3.5-8.7Z" /><path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3c-1.1.7-2.5 1.2-4.1 1.2-3.1 0-5.8-2.1-6.7-5H1.3v3.1A12 12 0 0 0 12 24Z" /><path fill="#FBBC05" d="M5.3 14.3a7.2 7.2 0 0 1 0-4.6V6.6H1.3a12 12 0 0 0 0 10.8l4-3.1Z" /><path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.3 6.6l4 3.1c.9-2.9 3.6-4.9 6.7-4.9Z" /></svg>
        Continue with Google
      </Button>
      <div className="my-5 flex items-center gap-3 text-xs text-muted"><span className="h-px flex-1 bg-line" />or<span className="h-px flex-1 bg-line" /></div>
    </>
  );
}

export function authErrorText(message: string) {
  if (/invalid login credentials/i.test(message)) return 'That email and password don’t match.';
  if (/email not confirmed/i.test(message)) return 'Please confirm your email first — check your inbox for the link.';
  if (/already registered|already exists/i.test(message)) return 'An account with this email already exists. Try signing in.';
  if (/rate limit|too many/i.test(message)) return 'Too many attempts. Please wait a minute and try again.';
  if (/password/i.test(message)) return 'Choose a stronger password: at least 8 characters.';
  return 'Something went wrong. Please try again.';
}
