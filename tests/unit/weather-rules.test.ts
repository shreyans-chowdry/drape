import { describe, expect, it } from 'vitest';
import { generateLooks, lookWeatherOk, weatherOk, type EngineItem } from '@/lib/engine';
import { completeLook, dayClimate, fitSummary, placeFor, plural, quickPlan, type TripDay } from '@/lib/trip';

const item = (id: string, category: EngineItem['category'], type: string, color = 'navy'): EngineItem => ({ id, name: id, category, type, color });
const wardrobe = [
  item('tee1', 'top', 'tshirt', 'white'), item('tee2', 'top', 'tshirt', 'black'), item('linen', 'top', 'linen', 'beige'),
  item('hoodie', 'top', 'hoodie', 'grey'), item('sweat', 'top', 'sweatshirt', 'charcoal'),
  item('jeans', 'bottom', 'jeans', 'denim'), item('shorts', 'bottom', 'shorts', 'khaki'), item('chinos', 'bottom', 'chinos', 'beige'),
  item('sneak', 'shoes', 'sneakers', 'white'), item('jacket', 'outer', 'bomber', 'olive'), item('puffer', 'outer', 'puffer', 'black'),
];

describe('weather rules', () => {
  it('keeps hoodies, sweatshirts and jackets out of hot days', () => {
    for (const id of ['hoodie', 'sweat', 'jacket', 'puffer']) expect(weatherOk(wardrobe.find(i => i.id === id)!, 30)).toBe(false);
    expect(weatherOk(wardrobe.find(i => i.id === 'tee1')!, 30)).toBe(true);
  });
  it('never puts a warm top under a jacket on a mild day', () => {
    const [sweat, jacket, jeans] = ['sweat', 'jacket', 'jeans'].map(id => wardrobe.find(i => i.id === id)!);
    expect(lookWeatherOk([sweat, jacket, jeans], 19)).toBe(false);
    expect(lookWeatherOk([sweat, jacket, jeans], 6)).toBe(true);
  });
  it('Today-style looks at 31°C contain no warm pieces', () => {
    for (const seed of [0, 1, 2, 3]) {
      for (const l of generateLooks(wardrobe, { tempC: 31 }, {}, { count: 3, seed })) {
        expect(l.pieces.some(p => ['hoodie', 'sweat', 'jacket', 'puffer'].includes(p.id))).toBe(false);
      }
    }
  });
  it('varies the tops across looks and steers away from recently shown ones', () => {
    const looks = generateLooks(wardrobe, { tempC: 28 }, {}, { count: 3 });
    const tops = looks.map(l => l.pieces.find(p => p.category === 'top')!.id);
    expect(new Set(tops).size).toBe(tops.length);
    const next = generateLooks(wardrobe, { tempC: 28 }, {}, { count: 1, avoid: new Set(tops.slice(0, 2)) });
    expect(tops.slice(0, 2)).not.toContain(next[0].pieces.find(p => p.category === 'top')!.id);
  });
  it('adds a layer to a light top on a cold day', () => {
    for (const l of generateLooks(wardrobe.filter(i => i.category !== 'top' || i.type !== 'hoodie' && i.type !== 'sweatshirt'), { tempC: 12 }, {}, { count: 3 })) {
      expect(l.pieces.some(p => p.category === 'outer')).toBe(true);
    }
    const ids = completeLook(['linen', 'chinos', 'sneak'], wardrobe, dayClimate({ maxC: 15, minC: 6, rainChance: 0 }));
    expect(ids).toContain('jacket');
  });
  it('still suggests something when no bottoms are catalogued', () => {
    expect(generateLooks(wardrobe.filter(i => i.category !== 'bottom'), { tempC: 25 }).length).toBeGreaterThan(0);
  });
});

describe('trip planning', () => {
  const stops = [{ place: 'Osaka', start: '2026-11-07', end: '2026-11-09' }, { place: 'Hakone', start: '2026-11-09', end: '2026-11-11' }];
  it('assigns each date to the right stop (the arrival stop wins on a travel day)', () => {
    expect(placeFor('2026-11-08', stops).place).toBe('Osaka');
    expect(placeFor('2026-11-09', stops).place).toBe('Hakone');
  });
  it('dresses a hot city day and a cold mountain day differently', () => {
    const days: TripDay[] = [
      { date: '2026-11-07', plan: '', weather: { date: '2026-11-07', maxC: 31, minC: 24, code: 0, label: 'Clear', icon: '', rainChance: 0 } },
      { date: '2026-11-10', plan: '', weather: { date: '2026-11-10', maxC: 7, minC: 1, code: 3, label: 'Overcast', icon: '', rainChance: 10 } },
    ];
    const [hot, cold] = quickPlan(days, wardrobe);
    const hotTop = hot.day!.pieceIds.find(id => wardrobe.find(i => i.id === id)!.category === 'top');
    expect(['tee1', 'tee2', 'linen']).toContain(hotTop);
    expect(cold.day!.pieceIds.some(id => ['hoodie', 'sweat', 'jacket', 'puffer'].includes(id))).toBe(true);
  });
  it('completeLook drops a too-warm piece and refills the slot', () => {
    const ids = completeLook(['hoodie', 'jeans', 'sneak'], wardrobe, dayClimate({ maxC: 32, minC: 26, rainChance: 0 }));
    expect(ids).not.toContain('hoodie');
    expect(ids.some(id => wardrobe.find(i => i.id === id)!.category === 'top')).toBe(true);
  });
});

describe('packing summary wording', () => {
  it('pluralises properly', () => {
    expect(plural('Casual shirt', 2)).toBe('casual shirts');
    expect(plural('Jeans', 1)).toBe('jeans');
    expect(fitSummary([{ category: 'outer', type: 'bomber' }, { category: 'shoes', type: 'sneakers' }]).map(g => `${g.count} ${g.label}`)).toEqual(['1 layer', '1 pair of shoes']);
  });
});
