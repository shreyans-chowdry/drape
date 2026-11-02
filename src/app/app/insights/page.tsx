'use client';
import { useEffect, useMemo, useState } from 'react';
import { LineChart } from 'lucide-react';
import { CATEGORIES, colorById } from '@/lib/engine';
import { costPerWear, inr, LAUNDRY, type Item } from '@/lib/model';
import { Card, Empty, LinkButton, PageHeader } from '@/components/ui';
import { ItemTile } from '@/components/app/items';
import { useStore } from '@/components/app/store';

/** Horizontal bars, one series, one hue; values are always printed beside each bar. */
function Bars({ rows, format = String }: { rows: { label: string; value: number; swatch?: string }[]; format?: (n: number) => string }) {
  const max = Math.max(1, ...rows.map(r => r.value));
  return (
    <table className="w-full text-sm">
      <tbody>
        {rows.map(r => (
          <tr key={r.label} title={`${r.label}: ${format(r.value)}`}>
            <th scope="row" className="w-32 py-1 pr-3 text-left font-normal text-ink-2">
              <span className="flex items-center gap-2">{r.swatch && <span className="size-3 shrink-0 rounded-full border border-line" style={{ background: r.swatch }} />}<span className="truncate">{r.label}</span></span>
            </th>
            <td className="py-1"><div className="h-2.5 rounded-r bg-accent" style={{ width: `${(r.value / max) * 100}%`, minWidth: r.value ? 4 : 0 }} /></td>
            <td className="w-14 py-1 pl-3 text-right tabular-nums text-ink">{format(r.value)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Grid({ list, note }: { list: Item[]; note: (i: Item) => string }) {
  return <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{list.map(i => <ItemTile key={i.id} item={i} href={`/app/wardrobe/${i.id}`}><div className="mt-1 text-xs text-muted">{note(i)}</div></ItemTile>)}</div>;
}

function Tile({ label, value, note }: { label: string; value: string; note?: string }) {
  return <Card className="p-4"><div className="text-xs text-muted">{label}</div><div className="mt-1 font-serif text-3xl">{value}</div>{note && <div className="mt-1 text-xs text-muted">{note}</div>}</Card>;
}

export default function InsightsPage() {
  const { items, sb, wardrobeId } = useStore();
  const [wears30, setWears30] = useState<number | null>(null);
  useEffect(() => {
    if (!wardrobeId) return;
    const since = new Date(Date.now() - 30 * 864e5).toLocaleDateString('en-CA');
    sb.from('wear_history').select('id', { count: 'exact', head: true }).eq('wardrobe_profile_id', wardrobeId).gte('worn_on', since).then(({ count }) => setWears30(count ?? 0));
  }, [sb, wardrobeId]);

  const s = useMemo(() => {
    const cutoff = Date.now() - 60 * 864e5;
    const idle = items.filter(i => !i.last_worn_on || new Date(i.last_worn_on).getTime() < cutoff);
    const priced = items.filter(i => i.purchase_price != null);
    const value = priced.reduce((sum, i) => sum + Number(i.purchase_price), 0);
    const cpw = priced.map(i => ({ i, c: costPerWear(i)! })).sort((a, b) => a.c - b.c);
    const colours = new Map<string, number>();
    items.forEach(i => i.color && colours.set(i.color, (colours.get(i.color) ?? 0) + 1));
    return {
      idle, value, priced: priced.length,
      best: cpw.filter(x => x.i.wear_count > 0).slice(0, 4).map(x => x.i), worst: cpw.slice(-4).reverse().map(x => x.i),
      most: [...items].sort((a, b) => b.wear_count - a.wear_count).filter(i => i.wear_count > 0).slice(0, 6),
      byCat: CATEGORIES.map(c => ({ label: c.label, value: items.filter(i => i.category === c.id).length })).filter(r => r.value),
      byColour: [...colours.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([id, n]) => ({ label: colorById(id).label, value: n, swatch: colorById(id).hex.startsWith('#') ? colorById(id).hex : undefined })),
      laundry: LAUNDRY.map(l => ({ label: l.label, value: items.filter(i => i.laundry === l.id).length })),
    };
  }, [items]);

  if (items.length < 3) return (
    <>
      <PageHeader eyebrow="Insights" title="How you really dress" />
      <Empty icon={<LineChart className="size-6" />} title="Not enough to show yet" action={<LinkButton href="/app/add">Add clothes</LinkButton>}>Insights appear once you’ve added a few pieces and logged what you wear.</Empty>
    </>
  );


  return (
    <>
      <PageHeader eyebrow="Insights" title="How you really dress">Built from your wardrobe and the wears you log. Log outfits from Today to make these sharper.</PageHeader>
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label="Pieces" value={String(items.length)} />
        <Tile label="Outfits worn, last 30 days" value={wears30 == null ? '—' : String(wears30)} />
        <Tile label="Not worn in 60 days" value={String(s.idle.length)} note={`${Math.round((s.idle.length / items.length) * 100)}% of your wardrobe`} />
        <Tile label="Wardrobe value" value={s.priced ? inr(s.value) : '—'} note={s.priced ? `from ${s.priced} priced piece${s.priced === 1 ? '' : 's'}` : 'Add prices to see this'} />
      </div>
      <div className="mb-8 grid gap-4 lg:grid-cols-3">
        <Card className="p-4 sm:p-5"><h2 className="mb-3 font-medium">By category</h2><Bars rows={s.byCat} /></Card>
        <Card className="p-4 sm:p-5"><h2 className="mb-3 font-medium">Top colours</h2><Bars rows={s.byColour} /></Card>
        <Card className="p-4 sm:p-5"><h2 className="mb-3 font-medium">Laundry status</h2><Bars rows={s.laundry} /></Card>
      </div>
      {s.most.length > 0 && <section className="mb-8"><h2 className="mb-3 font-serif text-xl">Most worn</h2><Grid list={s.most} note={i => `${i.wear_count} wears`} /></section>}
      {s.best.length > 0 && <section className="mb-8"><h2 className="mb-3 font-serif text-xl">Best value (cost per wear)</h2><Grid list={s.best} note={i => `${inr(costPerWear(i)!)} per wear`} /></section>}
      {s.idle.length > 0 && <section className="mb-8"><h2 className="mb-3 font-serif text-xl">Waiting to be worn</h2><p className="mb-3 text-sm text-muted">Not worn in the last 60 days. Style one of them this week — or let it go.</p><Grid list={s.idle.slice(0, 8)} note={i => (i.last_worn_on ? `Last ${new Date(i.last_worn_on).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}` : 'Never logged')} /></section>}
    </>
  );
}
