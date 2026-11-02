import type { Metadata } from 'next';
import Link from 'next/link';
import { requireAdmin } from '@/lib/server/admin';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { BRAND } from '@/lib/brand';
import { ToastProvider } from '@/components/ui';
import { JsonEditor } from './editor';
import { savePack, savePlan, saveSetting } from './actions';

export const metadata: Metadata = { title: 'Admin', robots: { index: false } };
export const dynamic = 'force-dynamic';

const inr = (n: number) => `₹${n < 100 ? n.toFixed(2) : Math.round(n).toLocaleString('en-IN')}`;
const usd = (n: number) => `$${n.toFixed(n < 10 ? 3 : 2)}`;

export default async function AdminPage() {
  const admin = await requireAdmin();
  const db = supabaseAdmin();
  const since30 = new Date(Date.now() - 30 * 864e5).toISOString();
  const since1 = new Date(Date.now() - 864e5).toISOString();

  const [users, newUsers, items, subs, pays, usage, plans, packs, settings, hooks, feedback, ledger] = await Promise.all([
    db.from('profiles').select('id', { count: 'exact', head: true }),
    db.from('profiles').select('id', { count: 'exact', head: true }).gte('created_at', since30),
    db.from('clothing_items').select('id', { count: 'exact', head: true }),
    db.from('subscriptions').select('plan_id, billing_interval, status, current_period_end').in('status', ['active', 'authenticated']),
    db.from('payments').select('amount_paise, status, kind, created_at, description').gte('created_at', since30).order('created_at', { ascending: false }),
    db.from('user_ai_usage').select('user_id, model, feature, status, cost_usd, cost_inr, images, input_tokens, output_tokens, latency_ms, created_at').gte('created_at', since30).limit(50000),
    db.from('plans').select('*').order('sort'),
    db.from('credit_packs').select('*'),
    db.from('admin_settings').select('key, value'),
    db.from('webhook_events').select('id, event, processed_at, error, received_at').order('received_at', { ascending: false }).limit(15),
    db.from('feedback').select('id, message, context, created_at').order('created_at', { ascending: false }).limit(20),
    db.from('ai_credit_ledger').select('status').gte('created_at', since30),
  ]);

  const u = usage.data ?? [];
  const sum = (rows: typeof u, k: 'cost_usd' | 'cost_inr') => rows.reduce((s, r) => s + Number(r[k]), 0);
  const group = (key: 'feature' | 'model') => {
    const m = new Map<string, typeof u>();
    u.forEach(r => m.set(r[key], [...(m.get(r[key]) ?? []), r]));
    return [...m.entries()].map(([k, rows]) => ({ k, calls: rows.length, errors: rows.filter(r => r.status === 'error').length, usd: sum(rows, 'cost_usd'), inr: sum(rows, 'cost_inr'), images: rows.reduce((s, r) => s + r.images, 0), p50: median(rows.map(r => r.latency_ms ?? 0)) })).sort((a, b) => b.usd - a.usd);
  };
  const today = u.filter(r => r.created_at >= since1);
  const activeUsers = new Set(u.map(r => r.user_id)).size;
  const topUsers = [...u.reduce((m, r) => m.set(r.user_id ?? '—', (m.get(r.user_id ?? '—') ?? 0) + Number(r.cost_inr)), new Map<string, number>())].sort((a, b) => b[1] - a[1]).slice(0, 8);
  const plansById = new Map((plans.data ?? []).map(p => [p.id, p]));
  const mrr = (subs.data ?? []).reduce((s, x) => { const p = plansById.get(x.plan_id); return s + (p ? (x.billing_interval === 'annual' ? p.price_annual_inr / 12 : p.price_monthly_inr) : 0); }, 0);
  const captured = (pays.data ?? []).filter(p => p.status === 'captured').reduce((s, p) => s + p.amount_paise / 100, 0);
  const aiInr = sum(u, 'cost_inr');
  const led = ledger.data ?? [];
  const settingsBy = Object.fromEntries((settings.data ?? []).map(s => [s.key, s.value]));

  return (
    <ToastProvider>
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <header className="mb-8 flex flex-wrap items-center gap-3">
          <h1 className="font-serif text-3xl">{BRAND.name} admin</h1>
          <span className="text-sm text-muted">Signed in as {admin.email} · last 30 days</span>
          <Link href="/app" className="ml-auto text-sm text-accent">Back to app</Link>
        </header>

        <section className="mb-10 grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
          <Stat label="Users" value={String(users.count ?? 0)} note={`+${newUsers.count ?? 0} in 30 days`} />
          <Stat label="AI-active users" value={String(activeUsers)} />
          <Stat label="Wardrobe items" value={String(items.count ?? 0)} />
          <Stat label="Paying subscribers" value={String(subs.data?.length ?? 0)} />
          <Stat label="MRR (est.)" value={inr(mrr)} />
          <Stat label="Collected" value={inr(captured)} />
          <Stat label="AI cost" value={inr(aiInr)} note={usd(sum(u, 'cost_usd'))} />
          <Stat label="AI cost today" value={inr(sum(today, 'cost_inr'))} note={`${today.length} calls`} />
        </section>

        <div className="mb-10 grid gap-6 xl:grid-cols-2">
          <Table title="AI cost by feature" head={['Feature', 'Calls', 'Errors', 'Images', 'Median ms', 'USD', 'INR']} rows={group('feature').map(g => [g.k, g.calls, g.errors, g.images, g.p50, usd(g.usd), inr(g.inr)])} />
          <Table title="AI cost by model" head={['Model', 'Calls', 'Errors', 'Images', 'Median ms', 'USD', 'INR']} rows={group('model').map(g => [g.k, g.calls, g.errors, g.images, g.p50, usd(g.usd), inr(g.inr)])} />
          <Table title="Credits (30 days)" head={['Held', 'Charged', 'Refunded (failures)']} rows={[[led.filter(l => l.status === 'held').length, led.filter(l => l.status === 'charged').length, led.filter(l => l.status === 'refunded').length]]} />
          <Table title="Highest AI spend by user" head={['User id', 'INR']} rows={topUsers.map(([id, v]) => [id.slice(0, 8), inr(v)])} />
          <Table title="Recent payments" head={['Date', 'For', 'Amount', 'Status']} rows={(pays.data ?? []).slice(0, 12).map(p => [new Date(p.created_at).toLocaleDateString('en-IN'), p.description ?? p.kind, inr(p.amount_paise / 100), p.status])} />
          <Table title="Razorpay webhooks" head={['Received', 'Event', 'Processed', 'Error']} rows={(hooks.data ?? []).map(h => [new Date(h.received_at).toLocaleString('en-IN'), h.event, h.processed_at ? 'yes' : 'no', h.error ?? ''])} />
        </div>

        <section className="mb-10">
          <h2 className="mb-1 font-serif text-2xl">Plans & pricing</h2>
          <p className="mb-4 text-sm text-muted">Changes apply to the website and to limits immediately. Razorpay plan ids come from the Razorpay dashboard (Subscriptions → Plans); a plan can’t be bought until its ids are set. Price changes here don’t change existing Razorpay plans — create new Razorpay plans for new prices.</p>
          <div className="grid gap-4 lg:grid-cols-3">
            {(plans.data ?? []).map(p => (
              <JsonEditor key={p.id} title={p.name} action={savePlan}
                value={{ id: p.id, name: p.name, tagline: p.tagline, price_monthly_inr: p.price_monthly_inr, price_annual_inr: p.price_annual_inr, limits: p.limits, features: p.features, razorpay_plan_monthly: p.razorpay_plan_monthly, razorpay_plan_annual: p.razorpay_plan_annual, active: p.active }} />
            ))}
            {(packs.data ?? []).map(k => <JsonEditor key={k.id} title={`Pack: ${k.name}`} action={savePack} value={k} />)}
          </div>
        </section>

        <section className="mb-10">
          <h2 className="mb-1 font-serif text-2xl">AI settings</h2>
          <p className="mb-4 text-sm text-muted">Model choice, per-model prices (USD per 1M tokens; image = USD per generated image) and the USD→INR rate used for cost tracking. Check current prices at ai.google.dev before editing.</p>
          <div className="grid gap-4 lg:grid-cols-3">
            {(['models', 'model_pricing', 'fx'] as const).map(k => <JsonEditor key={k} title={k} action={saveSetting} hidden={{ key: k }} value={settingsBy[k] ?? {}} />)}
          </div>
        </section>

        <section>
          <h2 className="mb-4 font-serif text-2xl">Messages</h2>
          <div className="space-y-2">
            {(feedback.data ?? []).map(f => { const c = (f.context ?? {}) as { email?: string; topic?: string }; return (
              <div key={f.id} className="rounded-2xl border border-line bg-card p-4 text-sm">
                <div className="mb-1 text-xs text-muted">{new Date(f.created_at).toLocaleString('en-IN')} · {c.topic ?? 'feedback'} · {c.email ?? 'signed-in user'}</div>
                <p className="whitespace-pre-wrap">{f.message}</p>
              </div>
            ); })}
            {!feedback.data?.length && <p className="text-sm text-muted">No messages yet.</p>}
          </div>
        </section>
      </div>
    </ToastProvider>
  );
}

function median(xs: number[]) { if (!xs.length) return 0; const s = [...xs].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; }
function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return <div className="rounded-2xl border border-line bg-card p-4"><div className="text-xs text-muted">{label}</div><div className="mt-1 font-serif text-2xl tabular-nums">{value}</div>{note && <div className="text-xs text-muted">{note}</div>}</div>;
}
function Table({ title, head, rows }: { title: string; head: string[]; rows: (string | number)[][] }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-line bg-card">
      <h2 className="px-4 pt-4 font-medium">{title}</h2>
      <table className="mt-2 w-full text-sm">
        <thead><tr className="border-b border-line text-left text-xs text-muted">{head.map(h => <th key={h} className="px-4 py-2 font-normal">{h}</th>)}</tr></thead>
        <tbody>
          {rows.map((r, i) => <tr key={i} className="border-b border-line last:border-0">{r.map((c, j) => <td key={j} className={`px-4 py-2 ${j ? 'tabular-nums' : ''}`}>{c}</td>)}</tr>)}
          {!rows.length && <tr><td colSpan={head.length} className="px-4 py-6 text-center text-muted">No data yet.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
