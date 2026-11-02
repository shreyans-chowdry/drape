import { NextResponse, type NextRequest } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';
import { supabaseServer } from '@/lib/supabase/server';

const safe = (n: string | null) => (n && n.startsWith('/') && !n.startsWith('//') && !n.startsWith('/\\') ? n : '/app');

/** Finishes email confirmation, password recovery and Google sign-in. */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const next = safe(url.searchParams.get('next'));
  const sb = await supabaseServer();
  const code = url.searchParams.get('code');
  const tokenHash = url.searchParams.get('token_hash');
  const type = url.searchParams.get('type') as EmailOtpType | null;
  const { error } = code
    ? await sb.auth.exchangeCodeForSession(code)
    : tokenHash && type ? await sb.auth.verifyOtp({ token_hash: tokenHash, type }) : { error: new Error('missing') };
  return NextResponse.redirect(new URL(error ? '/login?error=link' : next, url.origin));
}
