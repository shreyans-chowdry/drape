'use client';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, Check } from 'lucide-react';
import { api, ApiError } from '@/lib/api-client';
import { inr } from '@/lib/model';
import { Badge, Button, Card, cx, PageHeader, Segmented, useToast } from '@/components/ui';
import { useStore } from '@/components/app/store';

type PlanRow = { id: string; name: string; tagline: string; price_monthly_inr: number; price_annual_inr: number; features: string[] };
type Pack = { id: string; name: string; studio_credits: number; price_inr: number };
type Sub = { id: string; plan_id: string; billing_interval: string; status: string; current_period_end: string | null; cancel_at_period_end: boolean };
type Pay = { id: string; kind: string; amount_paise: number; status: string; description: string | null; created_at: string };

type RazorpayOptions = Record<string, unknown> & { handler: (r: Record<string, string>) => void };
declare global { interface Window { Razorpay?: new (o: RazorpayOptions) => { open: () => void; on: (e: string, cb: (r: { error?: { description?: string } }) => void) => void } } }

function loadCheckout() {
  return new Promise<boolean>(resolve => {
    if (window.Razorpay) return resolve(true);
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload = () => resolve(true); s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

export default function BillingPage() {
  const { sb, user, profile, quotas, reloadQuotas } = useStore();
  const toast = useToast();
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [packs, setPacks] = useState<Pack[]>([]);
  const [sub, setSub] = useState<Sub | null>(null);
  const [pays, setPays] = useState<Pay[]>([]);
  const [interval, setInterval] = useState<'monthly' | 'annual'>('monthly');
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [p, k, s, y] = await Promise.all([
      sb.from('plans').select('id, name, tagline, price_monthly_inr, price_annual_inr, features').eq('active', true).order('sort'),
      sb.from('credit_packs').select('id, name, studio_credits, price_inr').eq('active', true),
      sb.from('subscriptions').select('id, plan_id, billing_interval, status, current_period_end, cancel_at_period_end').in('status', ['active', 'authenticated', 'pending', 'halted']).order('created_at', { ascending: false }).limit(1).maybeSingle(),
      sb.from('payments').select('id, kind, amount_paise, status, description, created_at').order('created_at', { ascending: false }).limit(30),
    ]);
    setPlans((p.data ?? []) as PlanRow[]); setPacks(k.data ?? []); setSub(s.data); setPays(y.data ?? []);
  }, [sb]);
  useEffect(() => { load(); }, [load]);

  const checkout = async (opts: Record<string, unknown>, what: string) => {
    if (!(await loadCheckout())) { toast('Could not load Razorpay. Check your connection.', { tone: 'bad' }); return; }
    const rzp = new window.Razorpay!({
      ...opts, name: 'Drape', description: what, theme: { color: '#b4532a' },
      prefill: { email: user.email, name: profile?.display_name ?? undefined },
      modal: { ondismiss: () => setBusy(null) },
      handler: async (r: Record<string, string>) => {
        try {
          // Access is only granted after the server re-checks the payment with Razorpay.
          await api('/api/billing/verify', r);
          toast('Payment confirmed — thank you!', { tone: 'good' });
        } catch (e) { toast(e instanceof ApiError ? e.message : 'We could not confirm the payment yet. If you were charged, it will update within a few minutes.', { tone: 'bad' }); }
        setBusy(null); load(); reloadQuotas();
      },
    });
    rzp.on('payment.failed', r => { toast(r.error?.description ?? 'Payment failed. You were not charged.', { tone: 'bad' }); setBusy(null); });
    rzp.open();
  };

  const subscribe = async (planId: string) => {
    setBusy(planId);
    try {
      const r = await api<{ subscriptionId: string; keyId: string }>('/api/billing/subscribe', { planId, interval });
      await checkout({ key: r.keyId, subscription_id: r.subscriptionId }, `${plans.find(p => p.id === planId)?.name} — ${interval}`);
    } catch (e) { toast(e instanceof ApiError ? e.message : 'Could not start checkout.', { tone: 'bad' }); setBusy(null); }
  };
  const buyPack = async (packId: string) => {
    setBusy(packId);
    try {
      const r = await api<{ orderId: string; amount: number; keyId: string; name: string }>('/api/billing/pack', { packId });
      await checkout({ key: r.keyId, order_id: r.orderId, amount: r.amount, currency: 'INR' }, r.name);
    } catch (e) { toast(e instanceof ApiError ? e.message : 'Could not start checkout.', { tone: 'bad' }); setBusy(null); }
  };
  const cancel = async () => {
    if (!confirm('Cancel your subscription? You keep your plan until the end of the current period, then move to Free. Your clothes stay, but you can’t add new pieces while you’re over the Free limit.')) return;
    try { await api('/api/billing/cancel', {}); toast('Subscription cancelled at period end'); load(); }
    catch (e) { toast(e instanceof ApiError ? e.message : 'Could not cancel.', { tone: 'bad' }); }
  };

  const current = quotas?.plan ?? 'free';
  const until = sub?.current_period_end ? new Date(sub.current_period_end).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : null;

  return (
    <>
      <Link href="/app/profile" className="mb-3 inline-flex items-center gap-1 text-sm text-muted"><ArrowLeft className="size-4" /> Profile</Link>
      <PageHeader eyebrow="Billing" title="Plan & billing" actions={<Segmented label="Billing period" value={interval} onChange={setInterval} options={[{ value: 'monthly', label: 'Monthly' }, { value: 'annual', label: 'Yearly (2 months free)' }]} />}>
        Prices are in Indian rupees. Payments are handled by Razorpay; Drape never sees your card details.
      </PageHeader>

      {sub && (
        <Card className="mb-6 flex flex-wrap items-center gap-3 p-4 text-sm">
          <span>You’re on <b>{plans.find(p => p.id === sub.plan_id)?.name}</b> ({sub.billing_interval}).</span>
          {sub.cancel_at_period_end ? <Badge tone="warn">Ends {until}</Badge> : until && <span className="text-muted">Renews {until}</span>}
          {sub.status === 'halted' && <Badge tone="bad">Payment failed — update your payment method in the Razorpay email</Badge>}
          {!sub.cancel_at_period_end && <Button size="sm" variant="ghost" className="ml-auto" onClick={cancel}>Cancel subscription</Button>}
        </Card>
      )}

      <div className="mb-10 grid gap-4 md:grid-cols-3">
        {plans.map(p => {
          const price = interval === 'monthly' ? p.price_monthly_inr : p.price_annual_inr;
          const isCurrent = current === p.id;
          return (
            <Card key={p.id} className={cx('flex flex-col p-5', p.id === 'plus' && 'ring-2 ring-accent')}>
              <div className="flex items-center justify-between"><h2 className="font-serif text-2xl">{p.name}</h2>{isCurrent && <Badge tone="good">Current</Badge>}</div>
              <p className="text-sm text-muted">{p.tagline}</p>
              <p className="mt-4"><span className="font-serif text-4xl">{price ? inr(price) : '₹0'}</span>{price ? <span className="text-sm text-muted"> / {interval === 'monthly' ? 'month' : 'year'}</span> : null}</p>
              <ul className="my-5 space-y-2 text-sm">{p.features.map(f => <li key={f} className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0 text-sage" />{f}</li>)}</ul>
              <div className="mt-auto">
                {p.id === 'free' ? <p className="text-center text-sm text-muted">{isCurrent ? 'Your current plan' : 'Available when a paid plan ends'}</p>
                  : <Button block variant={isCurrent ? 'secondary' : 'primary'} disabled={isCurrent || !!busy} loading={busy === p.id} onClick={() => subscribe(p.id)}>{isCurrent ? 'Current plan' : current !== 'free' ? `Switch to ${p.name}` : `Get ${p.name}`}</Button>}
              </div>
            </Card>
          );
        })}
      </div>

      <section className="mb-10">
        <h2 className="mb-3 font-serif text-2xl">Extra studio photos</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {packs.map(k => (
            <Card key={k.id} className="flex items-center gap-4 p-4">
              <div className="flex-1"><b>{k.name}</b><div className="text-sm text-muted">{inr(k.price_inr)} · never expire · a failed photo never uses one</div></div>
              <Button variant="secondary" loading={busy === k.id} disabled={!!busy} onClick={() => buyPack(k.id)}>Buy</Button>
            </Card>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 font-serif text-2xl">Payment history</h2>
        {pays.length ? (
          <Card className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-line text-left text-muted"><th className="p-3 font-normal">Date</th><th className="p-3 font-normal">For</th><th className="p-3 font-normal">Amount</th><th className="p-3 font-normal">Status</th></tr></thead>
              <tbody>{pays.map(p => (
                <tr key={p.id} className="border-b border-line last:border-0">
                  <td className="p-3">{new Date(p.created_at).toLocaleDateString('en-IN')}</td><td className="p-3">{p.description ?? p.kind}</td>
                  <td className="p-3 tabular-nums">{inr(p.amount_paise / 100)}</td><td className="p-3"><Badge tone={p.status === 'captured' ? 'good' : p.status === 'failed' ? 'bad' : 'neutral'}>{p.status}</Badge></td>
                </tr>
              ))}</tbody>
            </table>
          </Card>
        ) : <p className="text-sm text-muted">No payments yet.</p>}
        <p className="mt-4 text-sm text-muted">Questions about a charge? See our <Link href="/refunds" className="text-accent">refund policy</Link> or <Link href="/contact" className="text-accent">contact us</Link>.</p>
      </section>
    </>
  );
}
