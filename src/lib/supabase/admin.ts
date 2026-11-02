import 'server-only';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/database.types';
import { SUPABASE_URL } from '@/lib/env';

/**
 * Service-role client. Bypasses RLS: server code only, and only after the
 * caller's identity has been verified. Never import from a client component.
 */
export function supabaseAdmin() {
  const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('SUPABASE_SECRET_KEY is not set');
  return createClient<Database>(SUPABASE_URL, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
