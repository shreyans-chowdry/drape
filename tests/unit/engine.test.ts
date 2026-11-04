import { describe, expect, it } from 'vitest';
import { buildAround, colorScore, generateLooks, pairScore, similarOwned, suggestFor, type EngineItem } from '@/lib/engine';

const item = (id: string, category: EngineItem['category'], type: string, color: string, extra: Partial<EngineItem> = {}): EngineItem => ({ id, name: id, category, type, color, pattern: 'solid', ...extra });
const wardrobe: EngineItem[] = [
  item('t1', 'top', 'shirt', 'white'), item('t2', 'top', 'tshirt', 'navy'), item('t3', 'top', 'polo', 'olive', { unavailable: true }),
  item('b1', 'bottom', 'chinos', 'beige'), item('b2', 'bottom', 'jeans', 'denim'),
  item('s1', 'shoes', 'sneakers', 'white'), item('s2', 'shoes', 'loafers', 'brown'),
];

describe('outfit engine', () => {
  it('only uses owned, available pieces', () => {
    const looks = generateLooks(wardrobe, { occasion: 'casual', tempC: 28 }, {}, { count: 10 });
    expect(looks.length).toBeGreaterThan(0);
    const ids = new Set(wardrobe.map(i => i.id));
    for (const l of looks) {
      for (const p of l.pieces) { expect(ids.has(p.id)).toBe(true); expect(p.unavailable).toBeFalsy(); }
    }
  });

  it('builds complete outfits: a top, a bottom and shoes', () => {
    for (const l of generateLooks(wardrobe, { occasion: 'work' }, {}, { count: 5 })) {
      const cats = l.pieces.map(p => p.category);
      expect(cats).toContain('top'); expect(cats).toContain('bottom'); expect(cats).toContain('shoes');
    }
  });

  it('keeps locked pieces in every look', () => {
    const looks = buildAround([wardrobe[1]], ['bottom', 'shoes'], wardrobe, {}, {}, { count: 3 });
    expect(looks.length).toBeGreaterThan(0);
    for (const l of looks) expect(l.pieces.some(p => p.id === 't2')).toBe(true);
  });

  it('never suggests unavailable pieces to pair with', () => {
    const { groups } = suggestFor(wardrobe[3], wardrobe);
    expect(Object.values(groups).flat().some(r => r!.item.id === 't3')).toBe(false);
  });

  it('scores colour pairs symmetrically', () => {
    expect(colorScore('navy', 'white').s).toBeCloseTo(colorScore('white', 'navy').s);
    expect(pairScore(wardrobe[0], wardrobe[3]).s).toBeCloseTo(pairScore(wardrobe[3], wardrobe[0]).s);
  });

  it('ranks a same-type, same-colour piece as most similar', () => {
    const r = similarOwned({ category: 'top', type: 'shirt', color: 'white', pattern: 'solid' }, wardrobe);
    expect(r[0]?.item.id).toBe('t1');
  });
});
