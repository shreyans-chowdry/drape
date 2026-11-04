import { z } from 'zod';
import { route, json, fail } from '@/lib/server/http';
import { fetchPayment, fetchSubscription, verifyOrderSignature, verifySubscriptionSignature } from '@/lib/server/razorpay';
import { applySubscription, grantPack, notify, recordPayment, TEMPLATES } from '@/lib/server/billing';
import { supabaseAdmin } from '@/lib/supabase/admin';

/**
 * Called by the checkout success handler. Checks Razorpay's signature, then
 * re-reads the payment/subscription from Razorpay before granting anything.
 */
export const POST = route(z.object({
  razorpay_payment_id: z.string().max(60),
  razorpay_signature: z.string().max(200),
  razorpay_subscription_id: z.string().max(60).optional(),
  razorpay_order_id: z.string().max(60).optional(),
}), async ({ userId, body }) => {
  const db = supabaseAdmin();
  if (body.razorpay_subscription_id) {
    if (!verifySubscriptionSignature(body.razorpay_subscription_id, body.razorpay_payment_id, body.razorpay_signature)) return fail('Payment could not be verified.', 400, 'bad_signature');
    const { data: own } = await db.from('subscriptions').select('id, plan_id').eq('razorpay_subscription_id', body.razorpay_subscription_id).eq('user_id', userId).single();
    if (!own) return fail('Subscription not found.', 404, 'not_found');
    const [sub, pay] = await Promise.all([fetchSubscription(body.razorpay_subscription_id), fetchPayment(body.razorpay_payment_id)]);
    await recordPayment(pay, { userId, kind: 'subscription', subscriptionId: sub.id, description: `${own.plan_id} subscription` });
    const r = await applySubscription(sub);
    if (r && ['active', 'authenticated'].includes(sub.status) && r.previous !== 'active') {
      await notify(userId, TEMPLATES.subscriptionConfirmed(own.plan_id === 'pro' ? 'Pro' : 'Plus', sub.current_end ? new Date(sub.current_end * 1000).toDateString() : 'your next billing date'));
    }
    return json({ ok: true, status: sub.status });
  }
  if (body.razorpay_order_id) {
    if (!verifyOrderSignature(body.razorpay_order_id, body.razorpay_payment_id, body.razorpay_signature)) return fail('Payment could not be verified.', 400, 'bad_signature');
    const pay = await fetchPayment(body.razorpay_payment_id);
    if (pay.order_id !== body.razorpay_order_id || pay.notes?.user_id !== userId) return fail('Payment does not match this account.', 400, 'mismatch');
    const granted = await grantPack(pay);
    return json({ ok: granted, status: pay.status });
  }
  return fail('Missing payment reference.');
});
