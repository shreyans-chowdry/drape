import 'server-only';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { fetchSubscription, type RzpPayment, type RzpSubscription } from './razorpay';
import { sendEmail, TEMPLATES } from './email';

// Turns verified Razorpay state into entitlements. Called only after a
// signature check (checkout or webhook) and with data re-fetched from Razorpay.

const ts = (s: number | null | undefined) => (s ? new Date(s * 1000).toISOString() : null);

export async function applySubscription(sub: RzpSubscription) {
  const db = supabaseAdmin();
  const { data: row } = await db.from('subscriptions').select('id, user_id, plan_id, status').eq('razorpay_subscription_id', sub.id).maybeSingle();
  const userId = row?.user_id ?? sub.notes?.user_id;
  if (!userId) return null;
  const status = sub.status;
  const update = {
    status,
    current_period_start: ts(sub.current_start),
    current_period_end: ts(sub.current_end),
    cancel_at_period_end: status === 'cancelled',
  };
  if (row) await db.from('subscriptions').update(update).eq('id', row.id);
  else await db.from('subscriptions').insert({ ...update, user_id: userId, plan_id: sub.notes?.plan_id ?? 'plus', billing_interval: (sub.notes?.interval as 'monthly' | 'annual') ?? 'monthly', razorpay_subscription_id: sub.id });

  // A new paid plan became active: end any other running subscription (upgrade / switch).
  if (status === 'active') {
    const { data: others } = await db.from('subscriptions').select('id, razorpay_subscription_id').eq('user_id', userId).neq('razorpay_subscription_id', sub.id).in('status', ['active', 'authenticated', 'pending']);
    for (const o of others ?? []) {
      try { if (o.razorpay_subscription_id) await (await import('./razorpay')).cancelSubscription(o.razorpay_subscription_id, false); } catch (e) { console.error('[billing] cancel old', e instanceof Error ? e.message : e); }
      await db.from('subscriptions').update({ status: 'cancelled', current_period_end: new Date().toISOString() }).eq('id', o.id);
    }
  }
  return { userId, status, previous: row?.status };
}

export async function refreshSubscription(id: string) {
  return applySubscription(await fetchSubscription(id));
}

/** Record a payment row (idempotent on the Razorpay payment id). */
export async function recordPayment(p: RzpPayment, extra: { userId?: string | null; kind: string; subscriptionId?: string; packId?: string; description?: string }) {
  const db = supabaseAdmin();
  await db.from('payments').upsert({
    user_id: extra.userId ?? p.notes?.user_id ?? null,
    kind: extra.kind,
    razorpay_payment_id: p.id,
    razorpay_order_id: p.order_id ?? null,
    razorpay_subscription_id: extra.subscriptionId ?? null,
    amount_paise: p.amount,
    currency: p.currency,
    status: p.status,
    pack_id: extra.packId ?? null,
    description: extra.description ?? null,
    error: p.error_description ?? null,
  }, { onConflict: 'razorpay_payment_id' });
}

/** Credit pack: grant bonus studio credits once per captured payment. */
export async function grantPack(p: RzpPayment) {
  const db = supabaseAdmin();
  const userId = p.notes?.user_id, packId = p.notes?.pack_id;
  if (!userId || !packId) return false;
  if (!['captured', 'authorized'].includes(p.status)) return false;
  const { data: pack } = await db.from('credit_packs').select('studio_credits, price_inr').eq('id', packId).single();
  if (!pack || p.amount !== pack.price_inr * 100) return false;
  const { data: existing } = await db.from('ai_credit_ledger').select('id').eq('user_id', userId).eq('ref', p.id).maybeSingle();
  if (existing) return true;
  await db.from('ai_credit_ledger').insert({ user_id: userId, kind: 'studio', bucket: 'bonus', delta: pack.studio_credits, status: 'charged', reason: `pack:${packId}`, ref: p.id });
  await recordPayment(p, { userId, kind: 'credit_pack', packId, description: `${pack.studio_credits} studio credits` });
  return true;
}

export async function notify(userId: string, mail: Parameters<typeof sendEmail>[1]) {
  const { data } = await supabaseAdmin().auth.admin.getUserById(userId);
  if (data.user?.email) await sendEmail(data.user.email, mail);
}
export { TEMPLATES };
