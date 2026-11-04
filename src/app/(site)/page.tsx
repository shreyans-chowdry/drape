import { Fragment } from 'react';
import Link from 'next/link';
import { CalendarDays, Camera, Check, CloudSun, MapPin, MessageCircle, Plane, ScanSearch, Shirt, Sparkles, Sun, Wand2 } from 'lucide-react';
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

const FEATURES = [
  { icon: CloudSun, title: 'Today', body: 'Three outfits picked for the forecast, the occasion and what you haven’t worn lately.' },
  { icon: Sparkles, title: 'AI Stylist', body: 'Office, wedding, date, travel — three complete looks with the reasoning behind each.' },
  { icon: Shirt, title: 'Match', body: 'Choose one piece and see everything that goes with it, ranked.' },
  { icon: ScanSearch, title: 'Own It', body: 'Snap something in a shop. Find out if you already own it — or something close — before you buy.' },
  { icon: MapPin, title: 'Closet Finder', body: 'Room, wardrobe, shelf, box. Ask “where is my navy blazer?” and get the exact spot.' },
  { icon: Plane, title: 'Trip Planner', body: 'Drop in your itinerary. Each stop is dressed for its own weather, with a packing list you can edit day by day.' },
  { icon: MessageCircle, title: 'Chat', body: 'Ask your stylist anything, with photos. Answers only use clothes you have.' },
  { icon: CalendarDays, title: 'Calendar & insights', body: 'Plan ahead, log what you wore, and see cost per wear and what never leaves the shelf.' },
];

type Kind = Parameters<typeof Garment>[0]['kind'];
const d = (ms: number) => ({ ['--d' as string]: `${ms}ms` }) as React.CSSProperties;

const STATEMENT = 'Every outfit comes from clothes you already own. Nothing invented. Nothing in the wash. Dressed for the weather where you are.';

const STORY = [
  { icon: Camera, title: 'Photograph a pile', body: 'One piece or a whole bed of clothes. Each item is found, named and tagged with its colour, fabric, season and occasion.' },
  { icon: Sparkles, title: 'Get a tidy wardrobe', body: 'Everything sorted and searchable, with optional studio photos and the exact shelf or box each piece lives in.' },
  { icon: Wand2, title: 'Know what to wear', body: 'Three outfits a day for the weather and your plans, built from what’s clean. Never a hoodie at 31°.' },
  { icon: Plane, title: 'Pack for anywhere', body: 'Paste an itinerary. Each stop is dressed for its own forecast, and you can swap anything.' },
];

const STRIP: [Kind, string][][] = [
  [['tee', '#f2efe9'], ['jeans', '#3b4f6b'], ['shirt', '#a9c7e8'], ['sneakers', '#f4f2ee'], ['hoodie', '#9a9ca0'], ['kurta', '#d8c3a0'], ['shorts', '#b5a27a'], ['jacket', '#5f7356'], ['dress', '#6d1f2c'], ['cap', '#1f2a44']],
  [['trousers', '#2c3e5c'], ['boots', '#4a3324'], ['tee', '#c4302b'], ['bag', '#6b4a32'], ['shirt', '#efe6d2'], ['watch', '#6b5a45'], ['jeans', '#4a6a93'], ['sunglasses', '#141414'], ['hoodie', '#5f6b3a'], ['socks', '#f7f6f2']],
];

export default async function Home() {
  const { plans, packs } = await pricing();
  return (
    <>
      {/* Hero: words rise in; the whole block recedes as you scroll on. */}
      <div data-scene className="relative isolate overflow-hidden">
        <div className="scroll-parallax absolute inset-0 -z-10"><Silk className="pointer-events-none size-full" /></div>
        <section className="scroll-recede mx-auto grid min-h-[calc(100dvh-4rem)] max-w-6xl items-center gap-12 px-4 pb-20 pt-12 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:pt-16">
          <div data-reveal style={d(0)}>
            <p className="mb-4 text-sm font-medium uppercase tracking-[0.18em] text-accent">Your AI wardrobe</p>
            <h1 className="font-serif text-5xl leading-[1.04] sm:text-6xl lg:text-7xl" aria-label={BRAND.tagline}>
              {BRAND.tagline.split(' ').map((w, i) => (
                <Fragment key={i}><span aria-hidden className="word-mask"><span style={d(120 + i * 70)}>{w}</span></span>{' '}</Fragment>
              ))}
            </h1>
            <p className="mt-6 max-w-xl text-lg text-ink-2" data-reveal style={d(500)}>{BRAND.description}</p>
            <div className="mt-8 flex flex-wrap gap-3" data-reveal style={d(650)}>
              <Link href="/signup" className="rounded-full bg-ink px-7 py-3.5 font-medium text-paper transition hover:scale-[1.03] hover:bg-ink/90">Start free</Link>
              <Link href="/#how" className="rounded-full border border-line-strong bg-paper/60 px-7 py-3.5 font-medium backdrop-blur transition hover:bg-card">See how it works</Link>
            </div>
            <p className="mt-4 text-sm text-muted" data-reveal style={d(750)}>Free plan, no card needed. Works on any phone. Install it like an app.</p>
          </div>
          <div data-reveal="zoom" style={d(350)}><Preview /></div>
        </section>
      </div>

      {/* Promises */}
      <section className="border-y border-line bg-card">
        <ul className="mx-auto flex max-w-6xl flex-wrap justify-center gap-x-10 gap-y-3 px-4 py-6 font-serif text-lg text-ink-2 sm:px-6">
          {BRAND.promises.map((p, i) => <li key={p} data-reveal style={d(i * 80)}>{p}</li>)}
        </ul>
      </section>

      {/* Statement: pinned while each word lights up. */}
      <section data-scene className="relative h-[200vh]" aria-label="What makes Drape different">
        <div className="sticky top-16 flex h-[calc(100dvh-4rem)] items-center">
          <p className="mx-auto max-w-5xl px-6 text-center font-serif text-[clamp(2rem,5.6vw,4.75rem)] leading-[1.08] tracking-tight">
            {STATEMENT.split(' ').map((w, i, all) => (
              <span key={i} className="lit-word" style={{ ['--i' as string]: i, ['--n' as string]: all.length }}>{w} </span>
            ))}
          </p>
        </div>
      </section>

      {/* Pinned story: the phone stays put while its screen changes. */}
      <section id="how" data-scene data-steps={STORY.length} className="relative h-[420vh] scroll-mt-0" aria-label="How it works">
        <div className="sticky top-16 flex h-[calc(100dvh-4rem)] flex-col justify-center overflow-hidden py-4">
          <div className="mx-auto grid w-full max-w-6xl items-center gap-8 px-4 sm:px-6 lg:grid-cols-[1fr_auto] lg:gap-16">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.18em] text-accent">How it works</p>
              <h2 className="mt-3 max-w-lg font-serif text-3xl sm:text-5xl">From a pile of clothes to a plan.</h2>
              {/* desktop: the whole list, current step highlighted */}
              <ol className="mt-10 hidden space-y-7 lg:block">
                {STORY.map((s, i) => (
                  <li key={s.title} className={`story-text story-t${i} flex max-w-md gap-4`}>
                    <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent"><s.icon className="size-5" /></span>
                    <span><span className="block font-serif text-2xl">{s.title}</span><span className="mt-1 block text-ink-2">{s.body}</span></span>
                  </li>
                ))}
              </ol>
              {/* mobile: one caption at a time */}
              <div className="relative mt-4 h-28 lg:hidden">
                {STORY.map((s, i) => (
                  <div key={s.title} className={`story-panel story-${i} absolute inset-0`}>
                    <div className="flex items-center gap-2 font-serif text-xl"><s.icon className="size-5 text-accent" /> {s.title}</div>
                    <p className="mt-1 text-sm text-ink-2">{s.body}</p>
                  </div>
                ))}
              </div>
            </div>
            <Phone />
          </div>
          <div className="mx-auto mt-6 h-1 w-40 overflow-hidden rounded-full bg-line"><div className="pin-bar h-full rounded-full bg-accent" /></div>
        </div>
      </section>

      {/* Wardrobe strip: rows drift in opposite directions with scroll. */}
      <section data-scene className="overflow-hidden py-24" aria-label="Every kind of clothing">
        <div className="mx-auto mb-12 max-w-2xl px-4 text-center" data-reveal>
          <h2 className="font-serif text-4xl sm:text-5xl">Shirts to saris. Sneakers to sunglasses.</h2>
          <p className="mt-4 text-lg text-ink-2">Tops, bottoms, layers, shoes, ethnic wear and accessories, each one told apart by its own details.</p>
        </div>
        {STRIP.map((row, r) => (
          <div key={r} className={`${r ? 'drift-right' : 'drift-left'} mb-4 flex w-max gap-4 px-4`} aria-hidden>
            {[...row, ...row].map(([k, c], i) => (
              <div key={i} className="flex size-32 shrink-0 items-center justify-center rounded-3xl border border-line bg-studio p-5 shadow-soft sm:size-40"><Garment kind={k} color={c} className="h-full" /></div>
            ))}
          </div>
        ))}
      </section>

      {/* Features: bento grid with a cursor spotlight. */}
      <section id="features" className="scroll-mt-20 bg-sunk py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <Heading eyebrow="Features" title="Everything your wardrobe should have done already" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((f, i) => (
              <div key={f.title} data-reveal data-spotlight style={d((i % 4) * 90)}
                className={`group rounded-3xl border border-line bg-card p-6 shadow-soft transition duration-500 hover:-translate-y-1 hover:shadow-lift ${i === 0 || i === 5 ? 'lg:col-span-2' : ''}`}>
                <span className="flex size-11 items-center justify-center rounded-2xl bg-accent-soft text-accent transition duration-500 group-hover:rotate-[-6deg] group-hover:scale-110"><f.icon className="size-5" /></span>
                <h3 className="mt-5 font-serif text-2xl">{f.title}</h3>
                <p className="mt-2 leading-relaxed text-ink-2">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Trips: a route that draws itself as you scroll. */}
      <section data-scene className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-28 sm:px-6 lg:grid-cols-2">
        <div data-reveal="left">
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-accent">Trip Planner</p>
          <h2 className="mt-3 font-serif text-4xl sm:text-5xl">Osaka in the sun. Hakone in the cold.</h2>
          <p className="mt-5 text-lg text-ink-2">Paste your itinerary, add a screenshot or a PDF. Every stop gets outfits for its own forecast, and a packing list that tells you exactly what to bring.</p>
          <ul className="mt-6 space-y-2 text-ink-2">
            {['Swap or remove any piece, any day', 'Leave a whole type at home in one tap', 'Add the pieces you insist on taking'].map(t => <li key={t} className="flex gap-2"><Check className="mt-1 size-4 text-sage" />{t}</li>)}
          </ul>
        </div>
        <Route />
      </section>

      <section id="pricing" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-24 sm:px-6">
        <Heading eyebrow="Pricing" title="Start free. Upgrade when your wardrobe grows." />
        {plans.length ? (
          <div className="grid gap-4 md:grid-cols-3">
            {plans.map((p, i) => (
              <div key={p.id} data-reveal data-spotlight style={d(i * 120)} className={`flex flex-col rounded-3xl border bg-card p-6 transition duration-500 hover:-translate-y-1 ${p.id === 'plus' ? 'border-accent shadow-lift' : 'border-line'}`}>
                <h3 className="font-serif text-2xl">{p.name}</h3>
                <p className="text-sm text-muted">{p.tagline}</p>
                <p className="mt-5"><span className="font-serif text-5xl">{inr(p.price_monthly_inr)}</span>{p.price_monthly_inr > 0 && <span className="text-muted"> / month</span>}</p>
                <p className="mt-1 h-5 text-sm text-muted">{p.price_annual_inr > 0 && `or ${inr(p.price_annual_inr)} a year`}</p>
                <ul className="my-6 space-y-2.5 text-sm">{p.features.map(f => <li key={f} className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0 text-sage" />{f}</li>)}</ul>
                <Link href="/signup" className={`mt-auto rounded-full py-3 text-center font-medium transition hover:scale-[1.02] ${p.id === 'plus' ? 'bg-ink text-paper' : 'border border-line-strong'}`}>{p.price_monthly_inr ? `Choose ${p.name}` : 'Start free'}</Link>
              </div>
            ))}
          </div>
        ) : <p className="text-center text-muted">Pricing couldn’t load. Please refresh the page.</p>}
        {packs.map(k => <p key={k.name} className="mt-6 text-center text-sm text-muted">Need more studio photos? {k.name} for {inr(k.price_inr)}. A photo that fails our quality check never uses a credit.</p>)}
      </section>

      <section id="privacy" className="scroll-mt-20 bg-ink py-24 text-paper">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 sm:px-6 md:grid-cols-2">
          <div data-reveal="left"><p className="text-sm uppercase tracking-[0.18em] text-accent">Privacy</p><h2 className="mt-3 font-serif text-5xl">Your wardrobe is yours.</h2></div>
          <ul className="space-y-4 text-lg text-paper/80">
            {[
              'Photos live in private storage only your account can open.',
              'Images are sent to our AI provider only when you ask Drape to analyse them.',
              'We don’t sell your data or use your photos for advertising.',
            ].map((t, i) => <li key={t} data-reveal style={d(i * 100)}>{t}</li>)}
            <li data-reveal style={d(300)}>Export everything or delete your account from Settings, any time. <Link href="/privacy" className="text-paper underline">Read the policy</Link>.</li>
          </ul>
        </div>
      </section>

      <section id="faq" className="mx-auto max-w-3xl scroll-mt-20 px-4 py-24 sm:px-6">
        <Heading eyebrow="FAQ" title="Questions, answered" />
        <div className="space-y-2">
          {FAQ.map((f, i) => (
            <details key={f.q} data-reveal style={d(Math.min(i, 5) * 60)} className="group rounded-2xl border border-line bg-card p-5 transition open:shadow-soft">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium">{f.q}<span className="text-xl text-muted transition duration-300 group-open:rotate-45">+</span></summary>
              <p className="mt-2 leading-relaxed text-ink-2">{f.a}</p>
            </details>
          ))}
        </div>
        <p className="mt-8 text-center text-muted">Something else? <Link href="/contact" className="text-accent">Get in touch</Link>.</p>
      </section>

      <section data-scene className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="scroll-grow relative overflow-hidden rounded-[2rem] bg-accent px-6 py-20 text-center text-accent-ink sm:px-12">
          <h2 className="font-serif text-5xl sm:text-7xl" data-reveal>Open your wardrobe.</h2>
          <p className="mx-auto mt-4 max-w-md text-lg opacity-90" data-reveal style={d(120)}>Add your first pieces in a couple of minutes. Free to start.</p>
          <div data-reveal style={d(240)}><Link href="/signup" className="mt-8 inline-block rounded-full bg-paper px-8 py-3.5 font-medium text-ink transition hover:scale-[1.04]">Create your wardrobe</Link></div>
        </div>
      </section>
    </>
  );
}

/** The phone in the pinned story: four illustrated screens, one per step. */
function Phone() {
  return (
    <div className="relative mx-auto aspect-[9/18] h-[min(56dvh,600px)] rounded-[2.6rem] border-[10px] border-ink bg-card shadow-lift lg:h-[min(72dvh,640px)]" role="img" aria-label="Illustrations of Drape: scanning clothes, the wardrobe grid, today's outfit and a trip plan">
      <div className="absolute left-1/2 top-2 z-10 h-5 w-20 -translate-x-1/2 rounded-full bg-ink" />
      <div className="absolute inset-0 overflow-hidden rounded-[2rem] p-3 pt-10">
        {/* 1 · scan */}
        <div className="story-panel story-0 absolute inset-3 top-10">
          <div className="mb-2 flex items-center justify-between text-xs"><span className="font-serif text-base">Add clothes</span><span className="text-muted">3 found</span></div>
          <div className="relative h-[72%] overflow-hidden rounded-2xl bg-sunk">
            <Garment kind="shirt" color="#d8c3a0" className="absolute left-[6%] top-[8%] h-[42%] -rotate-6" />
            <Garment kind="jeans" color="#3b4f6b" className="absolute right-[6%] top-[14%] h-[48%] rotate-3" />
            <Garment kind="sneakers" color="#f4f2ee" className="absolute bottom-[4%] left-[18%] h-[30%]" />
            {[['left-[4%] top-[6%] h-[46%] w-[44%]', 'Linen shirt', 0], ['right-[4%] top-[12%] h-[52%] w-[42%]', 'Dark jeans', 250], ['bottom-[3%] left-[14%] h-[33%] w-[56%]', 'White sneakers', 500]].map(([pos, label, delay]) => (
              <div key={label as string} className={`pop absolute rounded-xl border-2 border-accent ${pos}`} style={d(delay as number)}>
                <span className="absolute -top-3 left-1 rounded-full bg-accent px-2 py-0.5 text-[10px] font-medium text-accent-ink">{label}</span>
              </div>
            ))}
            <div className="scanline" />
          </div>
          <div className="mt-3 space-y-1.5">{['Linen shirt · beige · summer', 'Dark jeans · denim · all seasons'].map((t, i) => <div key={t} className="pop rounded-lg bg-sunk px-2.5 py-1.5 text-[11px]" style={d(700 + i * 150)}>{t}</div>)}</div>
        </div>
        {/* 2 · wardrobe */}
        <div className="story-panel story-1 absolute inset-3 top-10">
          <div className="mb-2 font-serif text-base">Wardrobe</div>
          <div className="mb-3 flex gap-1.5 overflow-hidden text-[10px]">{['All 42', 'Tops', 'Bottoms', 'Shoes'].map((c, i) => <span key={c} className={`whitespace-nowrap rounded-full px-2 py-1 ${i ? 'border border-line' : 'bg-ink text-paper'}`}>{c}</span>)}</div>
          <div className="grid grid-cols-3 gap-2">
            {([['tee', '#f2efe9'], ['shirt', '#a9c7e8'], ['jeans', '#3b4f6b'], ['hoodie', '#9a9ca0'], ['kurta', '#d8c3a0'], ['sneakers', '#f4f2ee'], ['jacket', '#5f7356'], ['shorts', '#b5a27a'], ['boots', '#4a3324'], ['trousers', '#2c3e5c'], ['watch', '#6b5a45'], ['cap', '#1f2a44']] as [Kind, string][]).map(([k, c], i) => (
              <div key={i} className="pop flex aspect-square items-center justify-center rounded-xl bg-studio p-2" style={d(i * 55)}><Garment kind={k} color={c} className="h-full" /></div>
            ))}
          </div>
        </div>
        {/* 3 · today */}
        <div className="story-panel story-2 absolute inset-3 top-10">
          <div className="mb-2 flex items-center justify-between"><span className="font-serif text-base">Today</span><span className="flex items-center gap-1 rounded-full bg-sunk px-2 py-0.5 text-[10px]"><Sun className="size-3" /> 31° sunny</span></div>
          <div className="overflow-hidden rounded-2xl border border-line">
            <div className="grid aspect-square grid-cols-2 grid-rows-2 gap-px bg-line">
              {([['shirt', '#efe6d2'], ['shorts', '#b5a27a'], ['sneakers', '#f4f2ee'], ['sunglasses', '#141414']] as [Kind, string][]).map(([k, c], i) => <div key={i} className="pop flex items-center justify-center bg-studio p-3" style={d(i * 90)}><Garment kind={k} color={c} className="h-full" /></div>)}
            </div>
            <div className="p-3">
              <div className="flex items-center justify-between"><span className="font-serif">Linen and shorts</span><span className="rounded-full bg-sage-soft px-2 py-0.5 text-[10px] text-sage">94%</span></div>
              <ul className="mt-2 space-y-1 text-[11px] text-ink-2">{['Cream + khaki: a reliable pairing', '31° — shorts weather', 'Not worn in 3 weeks'].map((t, i) => <li key={t} className="pop flex gap-1.5" style={d(400 + i * 120)}><Check className="size-3 text-sage" />{t}</li>)}</ul>
            </div>
          </div>
          <div className="pop mt-3 rounded-full bg-ink py-2 text-center text-xs text-paper" style={d(800)}>Wear today</div>
        </div>
        {/* 4 · trip */}
        <div className="story-panel story-3 absolute inset-3 top-10">
          <div className="mb-3 font-serif text-base">Japan · 6 days</div>
          <div className="space-y-2">
            {([['Osaka', '24°', [['tee', '#f2efe9'], ['jeans', '#3b4f6b']]], ['Hakone', '6°', [['hoodie', '#5f6b3a'], ['jacket', '#1f2a44']]], ['Tokyo', '15°', [['shirt', '#a9c7e8'], ['trousers', '#2c3e5c']]]] as [string, string, [Kind, string][]][]).map(([place, t, pieces], i) => (
              <div key={place} className="pop flex items-center gap-3 rounded-2xl border border-line p-2.5" style={d(i * 160)}>
                <div className="flex gap-1">{pieces.map(([k, c]) => <span key={k} className="flex size-11 items-center justify-center rounded-lg bg-studio p-1"><Garment kind={k} color={c} className="h-full" /></span>)}</div>
                <div className="min-w-0 flex-1"><div className="text-sm font-medium">{place}</div><div className="text-[11px] text-muted">Day {i * 2 + 1}–{i * 2 + 2}</div></div>
                <span className="text-sm">{t}</span>
              </div>
            ))}
          </div>
          <div className="pop mt-3 rounded-2xl bg-sunk p-3 text-[11px]" style={d(600)}><b className="font-medium">Your fit:</b> 5 tops · 3 bottoms · 2 layers · 2 pairs of shoes</div>
        </div>
      </div>
    </div>
  );
}

/** Illustrated trip route; the line draws with scroll and the stops rise in. */
function Route() {
  const stops = [
    { x: 70, y: 250, place: 'Osaka', t: '24° · sunny', look: 'Tee and jeans' },
    { x: 250, y: 120, place: 'Hakone', t: '6° · mist', look: 'Hoodie and jacket' },
    { x: 420, y: 200, place: 'Tokyo', t: '15° · cloud', look: 'Shirt and a light layer' },
  ];
  return (
    <div className="relative rounded-[2rem] border border-line bg-card p-4 shadow-lift" role="img" aria-label="Illustration of a trip from Osaka to Hakone to Tokyo, with outfits for each stop's weather">
      <svg viewBox="0 0 490 330" className="w-full">
        <path d="M70 250 C 130 250, 170 120, 250 120 S 370 200, 420 200" fill="none" stroke="var(--line-strong)" strokeWidth="3" strokeDasharray="2 8" strokeLinecap="round" />
        <path d="M70 250 C 130 250, 170 120, 250 120 S 370 200, 420 200" fill="none" stroke="var(--accent)" strokeWidth="3.5" strokeLinecap="round" pathLength={1} className="draw-path" />
        {stops.map(s => <circle key={s.place} cx={s.x} cy={s.y} r="8" fill="var(--card)" stroke="var(--accent)" strokeWidth="3.5" />)}
      </svg>
      {stops.map((s, i) => (
        <div key={s.place} data-reveal style={{ ...d(200 + i * 220), left: `${(s.x / 490) * 100}%`, top: `${(s.y / 330) * 100}%` }}
          className={`absolute translate-y-4 whitespace-nowrap rounded-2xl border border-line bg-paper/95 px-3 py-2 text-xs shadow-soft backdrop-blur ${['-translate-x-[20%]', '-translate-x-1/2', '-translate-x-[82%]'][i]}`}>
          <div className="flex items-center gap-1 font-medium"><MapPin className="size-3 text-accent" />{s.place} <span className="font-normal text-muted">{s.t}</span></div>
          <div className="text-muted">{s.look}</div>
        </div>
      ))}
    </div>
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
