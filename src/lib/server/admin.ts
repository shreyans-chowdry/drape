import 'server-only';
import { notFound } from 'next/navigation';
import { currentUser } from '@/lib/supabase/server';

/** Admins are listed in the ADMIN_EMAILS env var (comma-separated). Checked on the server only. */
export function isAdminEmail(email?: string | null) {
  const list = (process.env.ADMIN_EMAILS ?? '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
  return !!email && list.includes(email.toLowerCase());
}

/** Returns the admin user, or 404s so the admin area isn't discoverable. */
export async function requireAdmin() {
  const user = await currentUser();
  if (!user || !user.email_confirmed_at || !isAdminEmail(user.email)) notFound();
  return user;
}
