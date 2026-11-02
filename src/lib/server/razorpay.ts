import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';

// Razorpay over its REST API (https://razorpay.com/docs/api/). Secrets stay on the server.
const API = 'https://api.razorpay.com/v1';

export function razorpayConfigured() {
  return !!(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
}
export const razorpayMode = () => (process.env.RAZORPAY_KEY_ID?.startsWith('rzp_live_') ? 'live' : 'test');

async function rzp<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const id = process.env.RAZORPAY_KEY_ID, secret = process.env.RAZORPAY_KEY_SECRET;
  if (!id || !secret) throw new Error('Razorpay is not configured');
  const res = await fetch(`${API}${path}`, {
    method: init.method ?? 'GET',
    headers: { Authorization: 'Basic ' + Buffer.from(`${id}:${secret}`).toString('base64'), 'Content-Type': 'application/json' },
    body: init.body ? JSON.stringify(init.body) : undefined,
    signal: AbortSignal.timeout(20_000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Razorpay ${res.status}: ${data?.error?.description ?? res.statusText}`);
  return data as T;
}

export type RzpSubscription = { id: string; plan_id: string; status: string; current_start: number | null; current_end: number | null; notes?: Record<string, string>; short_url?: string };
export type RzpPayment = { id: string; order_id?: string; amount: number; currency: string; status: string; notes?: Record<string, string>; error_description?: string };
export type RzpOrder = { id: string; amount: number; currency: string; status: string; notes?: Record<string, string> };

export const createSubscription = (planId: string, totalCount: number, notes: Record<string, string>) =>
  rzp<RzpSubscription>('/subscriptions', { method: 'POST', body: { plan_id: planId, total_count: totalCount, customer_notify: 1, notes } });
export const fetchSubscription = (id: string) => rzp<RzpSubscription>(`/subscriptions/${id}`);
export const cancelSubscription = (id: string, atCycleEnd = true) =>
  rzp<RzpSubscription>(`/subscriptions/${id}/cancel`, { method: 'POST', body: { cancel_at_cycle_end: atCycleEnd ? 1 : 0 } });
export const createOrder = (amountPaise: number, receipt: string, notes: Record<string, string>) =>
  rzp<RzpOrder>('/orders', { method: 'POST', body: { amount: amountPaise, currency: 'INR', receipt, notes } });
export const fetchPayment = (id: string) => rzp<RzpPayment>(`/payments/${id}`);

function hmacEquals(payload: string, secret: string, signature: string) {
  const expected = createHmac('sha256', secret).update(payload).digest('hex');
  const a = Buffer.from(expected), b = Buffer.from(signature ?? '');
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Checkout signature for a one-off order payment. */
export const verifyOrderSignature = (orderId: string, paymentId: string, signature: string, secret = process.env.RAZORPAY_KEY_SECRET ?? '') =>
  !!secret && hmacEquals(`${orderId}|${paymentId}`, secret, signature);

/** Checkout signature for a subscription's first payment. */
export const verifySubscriptionSignature = (subscriptionId: string, paymentId: string, signature: string, secret = process.env.RAZORPAY_KEY_SECRET ?? '') =>
  !!secret && hmacEquals(`${paymentId}|${subscriptionId}`, secret, signature);

/** Webhook body signature (X-Razorpay-Signature), computed over the raw body. */
export const verifyWebhookSignature = (rawBody: string, signature: string, secret = process.env.RAZORPAY_WEBHOOK_SECRET ?? '') =>
  !!secret && hmacEquals(rawBody, secret, signature);
