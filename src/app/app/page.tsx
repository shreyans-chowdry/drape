'use client';
import { useEffect, useMemo, useState } from 'react';
import { CloudSun, Droplets, MapPin, RefreshCw, Wind } from 'lucide-react';
import { currentSeason, generateLooks, OCCASIONS, pctScore } from '@/lib/engine';
import { isAvailable, toEngine, type Item } from '@/lib/model';
import { Button, Card, Chip, Empty, LinkButton, PageHeader, useToast } from '@/components/ui';
import { OutfitCard, OutfitGrid, SwapSheet, WhereSheet } from '@/components/app/items';
import { PlanSheet } from '@/components/app/plan';
import { useStore } from '@/components/app/store';

export default function TodayPage() {
  const { items, weather, profile, loading, sb, logWear, saveOutfit, outfits, setOutfitFav } = useStore();
  const toast = useToast();
  const [occasion, setOccasion] = useState('casual');
  const [seed, setSeed] = useState(0);
  const [overrides, setOverrides] = useState<Record<string, Item[]>>({});
  const [swap, setSwap] = useState<{ key: string; piece: Item } | null>(null);
  const [where, setWhere] = useState<Item[] | null>(null);
  const [plan, setPlan] = useState<string[] | null>(null);
  const [recent, setRecent] = useState<string[][]>([]);
  const [worn, setWorn] = useState<Set<string>>(new Set());

  useEffect(() => {
    const since = new Date(Date.now() - 14 * 864e5).toLocaleDateString('en-CA');
    sb.from('wear_history').select('item_ids').gte('worn_on', since).then(({ data }) => setRecent((data ?? []).map(r => r.item_ids)));
  }, [sb]);

  const favColours = useMemo(() => (profile?.preferences as { colours?: string[] } | null)?.colours ?? [], [profile]);
  const looks = useMemo(() => {
    const pool = items.filter(isAvailable).map(toEngine);
    const ctx = { occasion, tempC: weather?.tempC ?? null, rain: weather?.rain, humidity: weather?.humidity, wind: weather?.windKph, season: currentSeason(new Date(), weather?.tempC, weather?.rain) };
    const wornCombos = new Set(recent.map(ids => [...ids].sort().join('|')));
    return generateLooks(pool, ctx, {}, { count: 8, seed })
      // avoid repeating a combination worn in the last two weeks
      .filter(l => !wornCombos.has(l.pieces.filter(p => p.category === 'top' || p.category === 'bottom').map(p => p.id).sort().join('|')) || l.pieces.length < 2)
      .map(l => ({ ...l, s: l.s + l.pieces.filter(p => favColours.includes(p.color ?? '')).length * 0.03 }))
      .sort((a, b) => b.s - a.s)
      .slice(0, 3)
      .map((l, i) => ({ key: `${seed}-${i}`, pieces: l.pieces as Item[], reasons: l.reasons, score: pctScore(l.s) }));
  }, [items, occasion, weather, seed, recent, favColours]);

  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });
  const hasBasics = items.some(i => i.category === 'top' || i.category === 'onepiece') && items.some(i => i.category === 'bottom' || i.category === 'onepiece');

  return (
    <>
      <PageHeader eyebrow={today} title={`Good ${greeting()}, ${profile?.display_name?.split(' ')[0] ?? 'there'}`}
        actions={hasBasics ? <Button variant="secondary" onClick={() => { setSeed(s => s + 1); setOverrides({}); }}><RefreshCw className="size-4" /> New ideas</Button> : undefined}>
        Three outfits from your wardrobe for today.
      </PageHeader>

      <WeatherStrip />

      <div className="no-scrollbar -mx-4 mb-6 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0" role="group" aria-label="Occasion">
        {OCCASIONS.map(o => <Chip key={o.id} active={occasion === o.id} onClick={() => { setOccasion(o.id); setOverrides({}); }}>{o.label}</Chip>)}
      </div>

      {loading ? (
        <OutfitGrid>{[0, 1, 2].map(i => <div key={i} className="skeleton aspect-[4/6] rounded-2xl" />)}</OutfitGrid>
      ) : !hasBasics ? (
        <Empty icon={<CloudSun className="size-6" />} title="Add a few pieces to get outfits"
          action={<LinkButton href="/app/add">Add clothes</LinkButton>}>
          A top, a bottom and a pair of shoes is enough for your first outfit. Photograph them and Drape does the rest.
        </Empty>
      ) : (
        <OutfitGrid>
          {looks.map(l => {
            const pieces = overrides[l.key] ?? l.pieces;
            const ids = pieces.map(p => p.id);
            const savedOutfit = outfits.find(o => o.favourite && o.itemIds.length === ids.length && o.itemIds.every(id => ids.includes(id)));
            return (
              <OutfitCard key={l.key} look={{ ...l, pieces }}
                onSwap={p => setSwap({ key: l.key, piece: p })}
                onWhere={() => setWhere(pieces)}
                onPlan={() => setPlan(ids)}
                saved={!!savedOutfit}
                onSave={async () => {
                  if (savedOutfit) { await setOutfitFav(savedOutfit.id, false); toast('Removed from favourites'); return; }
                  await saveOutfit(ids, { favourite: true, occasion, source: 'engine', title: pieces.slice(0, 2).map(p => p.name).join(' + ') });
                  toast('Saved to favourites', { tone: 'good' });
                }}
                onWear={worn.has(l.key) ? undefined : async () => {
                  await logWear(ids);
                  setWorn(w => new Set(w).add(l.key));
                  toast('Logged as worn today', { tone: 'good' });
                }} />
            );
          })}
        </OutfitGrid>
      )}

      <SwapSheet piece={swap?.piece ?? null} look={swap ? overrides[swap.key] ?? looks.find(l => l.key === swap.key)?.pieces ?? [] : []} items={items}
        onClose={() => setSwap(null)}
        onSwap={next => swap && setOverrides(o => ({ ...o, [swap.key]: (o[swap.key] ?? looks.find(l => l.key === swap.key)!.pieces).map(p => (p.id === swap.piece.id ? next : p)) }))} />
      <WhereSheet pieces={where} onClose={() => setWhere(null)} />
      <PlanSheet pieceIds={plan} onClose={() => setPlan(null)} />
    </>
  );
}

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening';
}

function WeatherStrip() {
  const { weather, profile } = useStore();
  if (!profile?.lat) {
    return (
      <Card className="mb-6 flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="flex items-center gap-3 text-sm"><MapPin className="size-5 text-accent" /> Add your city to get outfits that suit the weather.</div>
        <LinkButton href="/app/profile#location" size="sm" variant="secondary">Set location</LinkButton>
      </Card>
    );
  }
  if (!weather) return <div className="skeleton mb-6 h-[74px] rounded-2xl" />;
  return (
    <Card className="mb-6 flex flex-wrap items-center gap-x-6 gap-y-2 p-4">
      <div className="flex items-center gap-3">
        <span className="text-3xl" aria-hidden>{weather.icon}</span>
        <div>
          <div className="font-serif text-2xl leading-none">{Math.round(weather.tempC)}°C</div>
          <div className="text-sm text-muted">{weather.label}{weather.place ? ` · ${weather.place}` : ''}</div>
        </div>
      </div>
      <div className="flex gap-5 text-sm text-ink-2">
        <span>Feels {Math.round(weather.feelsC)}°</span>
        <span className="inline-flex items-center gap-1"><Droplets className="size-4" />{weather.humidity}%</span>
        <span className="inline-flex items-center gap-1"><Wind className="size-4" />{Math.round(weather.windKph)} km/h</span>
      </div>
    </Card>
  );
}
