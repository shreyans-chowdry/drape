import { fetchSubscription, verifyWebhookSignature, type RzpPayment } from '@/lib/server/razorpay';
import { applySubscription, grantPack, notify, recordPayment, TEMPLATES } from '@/lib/server/billing';
import { supabaseAdmin } from '@/lib/supabase/admin';
import type { Json } from '@/lib/database.types';

// Razorpay webhooks: signature-checked over the raw body, processed at most once per event id.
export async function POST(req: Request) {
  const raw = await req.text();
  if (!verifyWebhookSignature(raw, req.headers.get('x-razorpay-signature') ?? '')) return new Response('bad signature', { status: 400 });
  let evt: { event: string; payload: Record<string, { entity: Record<string, unknown> }> };
  try { evt = JSON.parse(raw); } catch { return new Response('bad json', { status: 400 }); }
  const eventId = req.headers.get('x-razorpay-event-id') ?? `${evt.event}:${raw.length}:${raw.slice(-64)}`;

  const db = supabaseAdmin();
  const { error: dup } = await db.from('webhook_events').insert({ id: eventId, event: evt.event, payload: evt as unknown as NonNullable<Json> });
  if (dup) {
    const { data: prev } = await db.from('webhook_events').select('processed_at').eq('id', eventId).single();
    if (prev?.processed_at) return new Response('duplicate', { status: 200 });
  }

  try {
    const subEntity = evt.payload.subscription?.entity as { id: string } | undefined;
    const payEntity = evt.payload.payment?.entity as unknown as RzpPayment | undefined;
    switch (evt.event) {
      case 'subscription.authenticated':
      case 'subscription.activated':
      case 'subscription.charged':
      case 'subscription.pending':
      case 'subscription.halted':
      case 'subscription.cancelled':
      case 'subscription.completed':
      case 'subscription.updated':
      case 'subscription.resumed':
      case 'subscription.paused': {
        if (!subEntity) break;
        const sub = await fetchSubscription(subEntity.id); // trust Razorpay's current state, not the event copy
        const r = await applySubscription(sub);
        if (payEntity && r) await recordPayment(payEntity, { userId: r.userId, kind: 'subscription', subscriptionId: sub.id, description: `${sub.notes?.plan_id ?? ''} subscription` });
        if (r && evt.event === 'subscription.halted') await notify(r.userId, TEMPLATES.paymentFailed(sub.notes?.plan_id === 'pro' ? 'Pro' : 'Plus'));
        break;
      }
      case 'payment.captured':
      case 'payment.authorized':
        if (payEntity?.notes?.pack_id) await grantPack(payEntity);
        break;
      case 'payment.failed':
        if (payEntity) {
          await recordPayment(payEntity, { kind: payEntity.notes?.pack_id ? 'credit_pack' : 'subscription', packId: payEntity.notes?.pack_id });
          await db.from('payments').update({ status: 'failed', error: payEntity.error_description ?? null }).eq('razorpay_order_id', payEntity.order_id ?? '__none__').eq('status', 'created');
        }
        break;
      case 'refund.created':
      case 'refund.processed': {
        const refund = evt.payload.refund?.entity as { payment_id: string; amount: number } | undefined;
        if (refund) {
          const { data: p } = await db.from('payments').select('amount_paise, pack_id, user_id').eq('razorpay_payment_id', refund.payment_id).maybeSingle();
          await db.from('payments').update({ status: p && refund.amount < p.amount_paise ? 'partially_refunded' : 'refunded' }).eq('razorpay_payment_id', refund.payment_id);
          // A refunded pack takes its unused credits back.
          if (p?.pack_id && p.user_id) await db.from('ai_credit_ledger').update({ status: 'refunded' }).eq('user_id', p.user_id).eq('ref', refund.payment_id).eq('bucket', 'bonus');
        }
        break;
      }
    }
    await db.from('webhook_events').update({ processed_at: new Date().toISOString(), error: null }).eq('id', eventId);
    return new Response('ok', { status: 200 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await db.from('webhook_events').update({ error: msg.slice(0, 500) }).eq('id', eventId);
    console.error('[webhook]', msg);
    return new Response('retry', { status: 500 }); // Razorpay retries
  }
}
