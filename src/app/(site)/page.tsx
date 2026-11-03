import Link from 'next/link';
import { Camera, Check, CloudSun, MapPin, MessageCircle, Plane, ScanSearch, Shirt, Sparkles, Wand2 } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/database.types';
import { BRAND } from '@/lib/brand';
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from '@/lib/env';
import { FAQ } from '@/lib/faq';
import { Garment } from '@/components/garments';
import { Silk } from '@/components/site/silk';

export const revalidate = 3600;

async function pricing() {
  try {
    const sb = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
    const [{ data: plans }, { data: packs }] = await Promise.all([
      sb.from('plans').select('id, name, tagline, price_monthly_inr, price_annual_inr, features').eq('active', true).order('sort'),
      sb.from('credit_packs').select('name, price_inr').eq('active', true),
    ]);
    return { plans: (plans ?? []) as { id: string; name: string; tagline: string; price_monthly_inr: number; price_annual_inr: number; features: string[] }[], packs: packs ?? [] };
  } catch { return { plans: [], packs: [] }; }
}
const inr = (n: number) => `₹${n.toLocaleString('en-IN')}`;

const STEPS = [
  { icon: Camera, title: 'Photograph your clothes', body: 'One piece or a whole pile. Drape finds each item and records its type, colour, pattern, season and more.' },
  { icon: Sparkles, title: 'Get a tidy, searchable wardrobe', body: 'Optional studio photos make everything look consistent. Filter, search and see where each piece is kept.' },
  { icon: Wand2, title: 'Know what to wear', body: 'Outfits for today’s weather and your plans — built only from what you own and what’s clean.' },
];
const FEATURES = [
  { icon: CloudSun, title: 'Today', body: 'Three outfits picked for the forecast, the occasion and what you haven’t worn lately.' },
  { icon: Sparkles, title: 'AI Stylist', body: 'Office, wedding, date, travel — three complete looks with the reasoning behind each.' },
  { icon: Shirt, title: 'Match', body: 'Choose one piece and see everything that goes with it, ranked.' },
  { icon: ScanSearch, title: 'Own It', body: 'Snap something in a shop. Find out if you already own it — or something close — before you buy.' },
  { icon: MapPin, title: 'Closet Finder', body: 'Room, wardrobe, shelf, box. Ask “where is my navy blazer?” and get the exact spot.' },
  { icon: Plane, title: 'Trip Planner', body: 'Drop in your itinerary. Each stop is dressed for its own weather, with a packing list you can edit day by day.' },
  { icon: MessageCircle, title: 'Chat', body: 'Ask your stylist anything, with photos. Answers only use clothes you have.' },
  { icon: Check, title: 'Calendar & insights', body: 'Plan ahead, log what you wore, and see cost per wear and what never leaves the shelf.' },
];

export default async function Home() {
  const { plans, packs } = await pricing();
  return (
    <>
      {/* Hero */}
      <div className="relative isolate overflow-hidden">
      <Silk className="pointer-events-none absolute inset-0 -z-10 size-full" />
      <section className="mx-auto grid max-w-6xl items-center gap-12 px-4 pb-20 pt-12 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:pt-20">
        <div className="animate-rise">
          <p className="mb-4 text-sm font-medium uppercase tracking-[0.18em] text-accent">Your AI wardrobe</p>
          <h1 className="font-serif text-5xl leading-[1.04] sm:text-6xl lg:text-7xl">{BRAND.tagline}</h1>
          <p className="mt-6 max-w-xl text-lg text-ink-2">{BRAND.description}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/signup" className="rounded-full bg-ink px-7 py-3.5 font-medium text-paper transition hover:bg-ink/90">Start free</Link>
            <Link href="/#how" className="rounded-full border border-line-strong px-7 py-3.5 font-medium">See how it works</Link>
          </div>
          <p className="mt-4 text-sm text-muted">Free plan, no card needed. Works on any phone — install it like an app.</p>
        </div>
        <Preview />
      </section>
      </div>

      {/* Promises */}
      <section className="border-y border-line bg-card">
        <ul className="mx-auto flex max-w-6xl flex-wrap justify-center gap-x-10 gap-y-3 px-4 py-6 font-serif text-lg text-ink-2 sm:px-6">
          {BRAND.promises.map(p => <li key={p}>{p}</li>)}
        </ul>
      </section>

      <section id="how" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-24 sm:px-6">
        <Heading eyebrow="How it works" title="From a pile of clothes to a plan, in minutes" />
        <ol className="grid gap-6 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <li key={s.title} className="rounded-3xl border border-line bg-card p-6">
              <div className="flex items-center gap-3"><span className="flex size-10 items-center justify-center rounded-full bg-accent-soft text-accent"><s.icon className="size-5" /></span><span className="text-sm text-muted">Step {i + 1}</span></div>
              <h3 className="mt-5 font-serif text-2xl">{s.title}</h3>
              <p className="mt-2 text-ink-2">{s.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section id="features" className="scroll-mt-20 bg-sunk py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <Heading eyebrow="Features" title="Everything your wardrobe should have done already" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map(f => (
              <div key={f.title} className="rounded-3xl bg-card p-6 shadow-soft">
                <f.icon className="size-6 text-accent" />
                <h3 className="mt-4 font-serif text-xl">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-2">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="pricing" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-24 sm:px-6">
        <Heading eyebrow="Pricing" title="Start free. Upgrade when your wardrobe grows." />
        {plans.length ? (
          <div className="grid gap-4 md:grid-cols-3">
            {plans.map(p => (
              <div key={p.id} className={`flex flex-col rounded-3xl border bg-card p-6 ${p.id === 'plus' ? 'border-accent shadow-lift' : 'border-line'}`}>
                <h3 className="font-serif text-2xl">{p.name}</h3>
                <p className="text-sm text-muted">{p.tagline}</p>
                <p className="mt-5"><span className="font-serif text-5xl">{inr(p.price_monthly_inr)}</span>{p.price_monthly_inr > 0 && <span className="text-muted"> / month</span>}</p>
                <p className="mt-1 h-5 text-sm text-muted">{p.price_annual_inr > 0 && `or ${inr(p.price_annual_inr)} a year`}</p>
                <ul className="my-6 space-y-2.5 text-sm">{p.features.map(f => <li key={f} className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0 text-sage" />{f}</li>)}</ul>
                <Link href="/signup" className={`mt-auto rounded-full py-3 text-center font-medium ${p.id === 'plus' ? 'bg-ink text-paper' : 'border border-line-strong'}`}>{p.price_monthly_inr ? `Choose ${p.name}` : 'Start free'}</Link>
              </div>
            ))}
          </div>
        ) : <p className="text-center text-muted">Pricing is loading — please refresh.</p>}
        {packs.map(k => <p key={k.name} className="mt-6 text-center text-sm text-muted">Need more studio photos? {k.name} for {inr(k.price_inr)}. A photo that fails our quality check never uses a credit.</p>)}
      </section>

      <section id="privacy" className="scroll-mt-20 bg-ink py-20 text-paper">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 sm:px-6 md:grid-cols-2">
          <div><p className="text-sm uppercase tracking-[0.18em] text-accent">Privacy</p><h2 className="mt-3 font-serif text-4xl">Your wardrobe is yours.</h2></div>
          <ul className="space-y-3 text-paper/80">
            <li>Photos live in private storage only your account can open.</li>
            <li>Images are sent to our AI provider only when you ask Drape to analyse them.</li>
            <li>We don’t sell your data or use your photos for advertising.</li>
            <li>Export everything or delete your account from Settings, any time. <Link href="/privacy" className="text-paper underline">Read the policy</Link>.</li>
          </ul>
        </div>
      </section>

      <section id="faq" className="mx-auto max-w-3xl scroll-mt-20 px-4 py-24 sm:px-6">
        <Heading eyebrow="FAQ" title="Questions, answered" />
        <div className="space-y-2">
          {FAQ.map(f => (
            <details key={f.q} className="rounded-2xl border border-line bg-card p-5">
              <summary className="cursor-pointer list-none font-medium">{f.q}</summary>
              <p className="mt-2 leading-relaxed text-ink-2">{f.a}</p>
            </details>
          ))}
        </div>
        <p className="mt-8 text-center text-muted">Something else? <Link href="/contact" className="text-accent">Get in touch</Link>.</p>
      </section>

      <section className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="rounded-[2rem] bg-accent px-6 py-14 text-center text-accent-ink sm:px-12">
          <h2 className="font-serif text-4xl sm:text-5xl">Open your wardrobe.</h2>
          <p className="mx-auto mt-3 max-w-md opacity-90">Add your first pieces in a couple of minutes. Free to start.</p>
          <Link href="/signup" className="mt-8 inline-block rounded-full bg-paper px-8 py-3.5 font-medium text-ink">Create your wardrobe</Link>
        </div>
      </section>
    </>
  );
}

function Heading({ eyebrow, title }: { eyebrow: string; title: string }) {
  return <div className="mx-auto mb-12 max-w-2xl text-center"><p className="text-sm font-medium uppercase tracking-[0.18em] text-accent">{eyebrow}</p><h2 className="mt-3 font-serif text-4xl sm:text-5xl">{title}</h2></div>;
}

/** Illustrated product preview (drawn, not a screenshot of real data). */
function Preview() {
  const looks: { title: string; pieces: [Parameters<typeof Garment>[0]['kind'], string][] }[] = [
    { title: 'Easy Friday', pieces: [['shirt', '#e9e1d2'], ['trousers', '#2c3e5c'], ['sneakers', '#f4f2ee'], ['watch', '#6b5a45']] },
    { title: 'Monsoon commute', pieces: [['jacket', '#5f7356'], ['tee', '#f2efe9'], ['jeans', '#3b4f6b'], ['boots', '#4a3324']] },
  ];
  return (
    <div className="relative animate-fade" aria-label="Illustration of the Today screen with two suggested outfits" role="img">
      <div className="rounded-[2rem] border border-line bg-card p-4 shadow-lift sm:p-5">
        <div className="mb-4 flex items-center justify-between text-sm">
          <span className="font-serif text-xl">Today</span>
          <span className="flex items-center gap-1.5 rounded-full bg-sunk px-3 py-1 text-ink-2"><CloudSun className="size-4" /> 27° · light rain</span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {looks.map(l => (
            <div key={l.title} className="overflow-hidden rounded-2xl border border-line">
              <div className="grid aspect-square grid-cols-2 grid-rows-2 gap-px bg-line">
                {l.pieces.map(([k, c]) => <div key={k} className="flex items-center justify-center bg-studio p-2"><Garment kind={k} color={c} className="h-full" /></div>)}
              </div>
              <div className="p-3"><div className="font-serif">{l.title}</div><div className="mt-1 text-xs text-muted">Tonal colours · weather-ready</div></div>
            </div>
          ))}
        </div>
      </div>
      <div className="absolute -bottom-6 -left-4 hidden rounded-2xl border border-line bg-card px-4 py-3 text-sm shadow-lift sm:block animate-float" style={{ ['--r' as string]: '-2deg' }}>
        <div className="flex items-center gap-2"><ScanSearch className="size-4 text-accent" /> You own something similar</div>
      </div>
    </div>
  );
}
