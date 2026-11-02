import { z } from 'zod';
import { route, json, fail } from '@/lib/server/http';
import { cancelSubscription } from '@/lib/server/razorpay';
import { applySubscription, notify, TEMPLATES } from '@/lib/server/billing';
import { supabaseAdmin } from '@/lib/supabase/admin';

/** Cancel at the end of the paid period: paid features stay until then. */
export const POST = route(z.object({}), async ({ userId }) => {
  const db = supabaseAdmin();
  const { data: sub } = await db.from('subscriptions').select('id, plan_id, razorpay_subscription_id, current_period_end').eq('user_id', userId)
    .in('status', ['active', 'authenticated', 'pending']).order('current_period_end', { ascending: false }).limit(1).maybeSingle();
  if (!sub?.razorpay_subscription_id) return fail('You have no active subscription.', 404, 'none');
  const rz = await cancelSubscription(sub.razorpay_subscription_id, true);
  await applySubscription(rz);
  await db.from('subscriptions').update({ cancel_at_period_end: true }).eq('id', sub.id);
  await notify(userId, TEMPLATES.subscriptionCancelled(sub.plan_id === 'pro' ? 'Pro' : 'Plus', sub.current_period_end ? new Date(sub.current_period_end).toDateString() : null));
  return json({ ok: true, until: sub.current_period_end });
});
