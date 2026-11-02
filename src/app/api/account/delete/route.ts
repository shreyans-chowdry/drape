import { z } from 'zod';
import { route, json, fail } from '@/lib/server/http';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { cancelSubscription } from '@/lib/server/razorpay';
import { sendEmail, TEMPLATES } from '@/lib/server/email';

export const maxDuration = 120;

async function removeFolder(bucket: string, prefix: string) {
  const db = supabaseAdmin();
  for (let guard = 0; guard < 50; guard++) {
    const { data } = await db.storage.from(bucket).list(prefix, { limit: 1000 });
    if (!data?.length) return;
    const files = data.filter(f => f.id).map(f => `${prefix}/${f.name}`);
    const dirs = data.filter(f => !f.id).map(f => `${prefix}/${f.name}`);
    for (const d of dirs) await removeFolder(bucket, d);
    if (files.length) await db.storage.from(bucket).remove(files);
    if (!files.length) return;
  }
}

/**
 * Permanently delete the account: photos in every bucket, then the auth user
 * (which cascades to every wardrobe row). Payment records keep amounts only.
 */
export const POST = route(z.object({ confirm: z.literal('DELETE') }), async ({ userId, email }) => {
  const db = supabaseAdmin();
  const { data: subs } = await db.from('subscriptions').select('razorpay_subscription_id').eq('user_id', userId).in('status', ['active', 'authenticated', 'pending']);
  for (const s of subs ?? []) {
    if (s.razorpay_subscription_id) await cancelSubscription(s.razorpay_subscription_id, false).catch(e => console.error('[delete] cancel', e instanceof Error ? e.message : e));
  }
  for (const b of ['originals', 'studio', 'temp', 'backups']) await removeFolder(b, userId);
  const { error } = await db.auth.admin.deleteUser(userId);
  if (error) return fail('Could not delete the account. Please contact support.', 500);
  if (email) await sendEmail(email, TEMPLATES.accountDeleted());
  return json({ ok: true });
});
