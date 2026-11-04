import { z } from 'zod';
import { route, json, fail } from '@/lib/server/http';
import { createSubscription, razorpayConfigured } from '@/lib/server/razorpay';
import { supabaseAdmin } from '@/lib/supabase/admin';

/** Start a Razorpay subscription; access is granted only after verification. */
export const POST = route(z.object({ planId: z.enum(['plus', 'pro']), interval: z.enum(['monthly', 'annual']) }), async ({ userId, body }) => {
  if (!razorpayConfigured()) return fail('Payments are not switched on yet.', 503, 'payments_off');
  const db = supabaseAdmin();
  const { data: plan } = await db.from('plans').select('id, name, active, razorpay_plan_monthly, razorpay_plan_annual').eq('id', body.planId).single();
  const rzpPlan = body.interval === 'monthly' ? plan?.razorpay_plan_monthly : plan?.razorpay_plan_annual;
  if (!plan?.active || !rzpPlan) return fail('This plan is not available for purchase yet.', 503, 'plan_unavailable');
  const { data: current } = await db.from('subscriptions').select('plan_id, status').eq('user_id', userId).in('status', ['active', 'authenticated']).gt('current_period_end', new Date().toISOString()).maybeSingle();
  if (current?.plan_id === body.planId) return fail(`You're already on ${plan.name}.`, 409, 'already_subscribed');

  const sub = await createSubscription(rzpPlan, body.interval === 'monthly' ? 120 : 10, { user_id: userId, plan_id: body.planId, interval: body.interval });
  await db.from('subscriptions').insert({ user_id: userId, plan_id: body.planId, billing_interval: body.interval, status: sub.status, razorpay_subscription_id: sub.id });
  return json({ subscriptionId: sub.id, keyId: process.env.RAZORPAY_KEY_ID });
});
