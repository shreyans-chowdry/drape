import { z } from 'zod';
import { route, json, fail } from '@/lib/server/http';
import { createOrder, razorpayConfigured } from '@/lib/server/razorpay';
import { supabaseAdmin } from '@/lib/supabase/admin';

/** Create an order for a studio credit pack. Credits are granted after verification. */
export const POST = route(z.object({ packId: z.string().max(40) }), async ({ userId, body }) => {
  if (!razorpayConfigured()) return fail('Payments are not switched on yet.', 503, 'payments_off');
  const db = supabaseAdmin();
  const { data: pack } = await db.from('credit_packs').select('id, name, price_inr, active').eq('id', body.packId).single();
  if (!pack?.active) return fail('That pack is not available.', 404, 'not_found');
  const order = await createOrder(pack.price_inr * 100, `pack_${Date.now()}`, { user_id: userId, pack_id: pack.id });
  await db.from('payments').insert({ user_id: userId, kind: 'credit_pack', razorpay_order_id: order.id, amount_paise: order.amount, status: 'created', pack_id: pack.id, description: pack.name });
  return json({ orderId: order.id, amount: order.amount, keyId: process.env.RAZORPAY_KEY_ID, name: pack.name });
});
