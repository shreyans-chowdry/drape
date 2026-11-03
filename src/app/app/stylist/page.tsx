'use client';
import { useState } from 'react';
import { Lock, RefreshCw, Sparkles, X } from 'lucide-react';
import { buildAround, CATEGORIES, generateLooks, OCCASIONS, pctScore, type Category } from '@/lib/engine';
import { isAvailable, toEngine, type Item } from '@/lib/model';
import { api } from '@/lib/api-client';
import type { AILook } from '@/lib/ai/features';
import { Button, Card, Chip, Empty, LinkButton, PageHeader, Textarea, useToast } from '@/components/ui';
import { ItemImage, ItemPicker, OutfitGrid, type OutfitView } from '@/components/app/items';
import { LookList } from '@/components/app/looks';
import { aiErrorText, isQuotaError, QuotaNote, weatherCtx, weatherText } from '@/components/app/ai';
import { useStore } from '@/components/app/store';

export default function StylistPage() {
  const { items, byId, weather, reloadQuotas, wardrobeId } = useStore();
  const toast = useToast();
  const [occasion, setOccasion] = useState('casual');
  const [brief, setBrief] = useState('');
  const [locked, setLocked] = useState<string[]>([]);
  const [need, setNeed] = useState<Category[]>([]);
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [looks, setLooks] = useState<OutfitView[]>([]);
  const [missing, setMissing] = useState('');
  const [offline, setOffline] = useState(false);
  const [round, setRound] = useState(0);

  const available = items.filter(isAvailable);
  const enough = available.length >= 3;

  const ask = async () => {
    setBusy(true); setOffline(false);
    try {
      const r = await api<{ looks: AILook[]; missing: string }>('/api/ai/style', {
        wardrobeId, occasion, brief, lockedIds: locked, need, weather: weatherText(weather),
        tempC: weather?.tempC ?? null, rain: !!weather?.rain, avoidIds: [...new Set(looks.flatMap(l => l.pieces.map(p => p.id)))].slice(0, 30),
      });
      setLooks(r.looks.map((l, i) => ({ key: `${round}-${i}`, title: l.title, why: l.why, tip: l.tip, pieces: l.pieceIds.map(byId).filter(Boolean) as Item[], badges: [l.occasionFit, l.weatherFit].filter(Boolean) })).filter(l => l.pieces.length >= 2));
      setMissing(r.missing);
    } catch (e) {
      toast(aiErrorText(e), { tone: 'bad' });
      if (isQuotaError(e)) quick();
    } finally { setBusy(false); setRound(r => r + 1); reloadQuotas(); }
  };

  /** Free, on-device ideas from the matching engine — used when out of credits. */
  const quick = () => {
    const pool = available.map(toEngine), ctx = weatherCtx(weather, occasion);
    const lockedItems = pool.filter(p => locked.includes(p.id));
    const res = lockedItems.length ? buildAround(lockedItems, need.length ? need : ['bottom', 'top', 'shoes'], pool, ctx) : generateLooks(pool, ctx, {}, { count: 3, seed: round + 1, avoid: new Set(looks.flatMap(l => l.pieces.map(p => p.id))) });
    setLooks(res.map((l, i) => ({ key: `q${round}-${i}`, pieces: l.pieces as Item[], reasons: l.reasons, score: pctScore(l.s) })));
    setMissing(''); setOffline(true); setRound(r => r + 1);
  };

  if (!enough) return (
    <>
      <PageHeader eyebrow="AI Stylist" title="Three looks, any occasion" />
      <Empty icon={<Sparkles className="size-6" />} title="Add a few more pieces first" action={<LinkButton href="/app/add">Add clothes</LinkButton>}>
        The stylist only ever uses clothes you own, so it needs at least a top, a bottom and shoes.
      </Empty>
    </>
  );

  return (
    <>
      <PageHeader eyebrow="AI Stylist" title="Three looks, any occasion">Only from your own wardrobe — nothing invented, nothing in the wash.</PageHeader>
      {!items.some(i => i.category === 'bottom' || i.category === 'onepiece') && (
        <p className="mb-6 rounded-xl bg-warn-soft px-4 py-3 text-sm text-warn">
          There are no trousers, jeans or shorts in your wardrobe yet, so looks will be tops, layers and shoes only. <a href="/app/add" className="font-medium underline">Add your bottoms</a> for complete outfits.
        </p>
      )}

      <Card className="mb-6 space-y-5 p-4 sm:p-6">
        <div>
          <div className="mb-2 text-sm font-medium">Occasion</div>
          <div className="flex flex-wrap gap-2">{OCCASIONS.map(o => <Chip key={o.id} active={occasion === o.id} onClick={() => setOccasion(o.id)}>{o.label}</Chip>)}</div>
        </div>
        <div>
          <label htmlFor="brief" className="mb-2 block text-sm font-medium">Anything specific? <span className="font-normal text-muted">(optional)</span></label>
          <Textarea id="brief" value={brief} maxLength={400} onChange={e => setBrief(e.target.value)} placeholder="e.g. Office dinner, want to look relaxed but put-together" className="min-h-20" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <div className="mb-2 text-sm font-medium">Must include</div>
            <div className="flex flex-wrap items-center gap-2">
              {locked.map(id => { const it = byId(id); return it ? (
                <span key={id} className="inline-flex items-center gap-2 rounded-full border border-line bg-sunk py-1 pl-1 pr-2 text-sm">
                  <span className="block size-7 overflow-hidden rounded-full"><ItemImage item={it} ratio="aspect-square" /></span>
                  <span className="max-w-32 truncate">{it.name}</span>
                  <button aria-label={`Remove ${it.name}`} onClick={() => setLocked(l => l.filter(x => x !== id))}><X className="size-3.5" /></button>
                </span>
              ) : null; })}
              <Button size="sm" variant="secondary" onClick={() => setPicking(true)}><Lock className="size-4" /> {locked.length ? 'Change' : 'Pick pieces'}</Button>
            </div>
          </div>
          <div>
            <div className="mb-2 text-sm font-medium">Only fill these <span className="font-normal text-muted">(optional)</span></div>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map(c => <Chip key={c.id} active={need.includes(c.id)} onClick={() => setNeed(n => (n.includes(c.id) ? n.filter(x => x !== c.id) : [...n, c.id]))}>{c.one}</Chip>)}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3 border-t border-line pt-4">
          <Button onClick={ask} loading={busy}>{looks.length ? <><RefreshCw className="size-4" /> Regenerate</> : <><Sparkles className="size-4" /> Style me</>}</Button>
          <Button variant="ghost" onClick={quick}>Quick ideas (free)</Button>
          <span className="ml-auto"><QuotaNote kind="styling" /></span>
        </div>
      </Card>

      {busy ? (
        <OutfitGrid>{[0, 1, 2].map(i => <div key={i} className="skeleton aspect-[4/6] rounded-2xl" />)}</OutfitGrid>
      ) : looks.length > 0 && (
        <>
          {offline && <p className="mb-3 text-sm text-muted">Quick ideas come from Drape’s matching engine on your device and don’t use a credit.</p>}
          <LookList looks={looks} occasion={occasion} source={offline ? 'engine' : 'stylist'} comparable />
          {missing && <Card className="mt-6 p-4 text-sm"><b>Worth adding:</b> {missing}</Card>}
        </>
      )}

      <ItemPicker open={picking} onClose={() => setPicking(false)} items={available} multi selected={locked} title="Pieces to include" onPick={setLocked} />
    </>
  );
}
