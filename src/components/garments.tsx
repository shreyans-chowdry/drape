// Flat garment illustrations: placeholders for items without photos and the
// artwork on the landing page. Each draws in a 100×120 box.
import { colorById } from '@/lib/engine';

type Kind = 'tee' | 'shirt' | 'hoodie' | 'jacket' | 'jeans' | 'trousers' | 'shorts' | 'sneakers' | 'boots' | 'dress' | 'cap' | 'sunglasses' | 'watch' | 'bag' | 'socks' | 'kurta';

const PATHS: Record<Kind, (c: string, d: string) => React.ReactNode> = {
  tee: (c, d) => <><path d="M30 18 18 24 6 44l14 7 6-10v63h48V41l6 10 14-7-12-20-12-6c-3 8-10 12-20 12s-17-4-20-12Z" fill={c} /><path d="M30 18c3 8 10 12 20 12s17-4 20-12" fill="none" stroke={d} strokeWidth="2" /></>,
  shirt: (c, d) => <><path d="M32 16 18 23 6 54l13 5 7-17v62h48V42l7 17 13-5-12-31-14-7-8 6h-20l-8-6Z" fill={c} /><path d="M50 26v78M40 16l10 12 10-12" fill="none" stroke={d} strokeWidth="2" />{[40, 56, 72, 88].map(y => <circle key={y} cx="53" cy={y} r="1.6" fill={d} />)}</>,
  hoodie: (c, d) => <><path d="M34 22c0-12 32-12 32 0l12 6 12 30-12 5-4-12v53H26V51l-4 12-12-5 12-30 12-6Z" fill={c} /><path d="M38 24c2 10 22 10 24 0M44 32v14M56 32v14M34 78h32" fill="none" stroke={d} strokeWidth="2" /></>,
  jacket: (c, d) => <><path d="M34 14 18 20 8 58l12 4 6-18v60h48V44l6 18 12-4-10-38-16-6-8 10h-16l-8-10Z" fill={c} /><path d="M50 24v80M42 14l-8 22 16-12 16 12-8-22M30 70h12M58 70h12" fill="none" stroke={d} strokeWidth="2" /></>,
  jeans: (c, d) => <><path d="M24 12h52l6 98H58L50 46l-8 64H18l6-98Z" fill={c} /><path d="M24 22h52M50 22v24M30 22c0 10 6 14 14 14M70 22c0 10-6 14-14 14" fill="none" stroke={d} strokeWidth="2" /></>,
  trousers: (c, d) => <><path d="M26 12h48l4 98H58L50 40l-8 70H22l4-98Z" fill={c} /><path d="M26 20h48M50 20v20M36 22v86M64 22v86" fill="none" stroke={d} strokeWidth="1.5" opacity=".6" /></>,
  shorts: (c, d) => <><path d="M22 30h56l6 48H56l-6-26-6 26H16l6-48Z" fill={c} /><path d="M22 38h56M50 38v14" fill="none" stroke={d} strokeWidth="2" /></>,
  sneakers: (c, d) => <><path d="M10 74c0-12 6-24 16-24 6 0 10 8 22 10 14 2 30 4 38 12 6 6 6 12 4 14H12c-2 0-2-6-2-12Z" fill={c} /><path d="M10 82h80v6H12c-2 0-2-3-2-6Z" fill={d} opacity=".35" /><path d="M34 58l6 8M42 58l6 8M50 60l6 8" stroke={d} strokeWidth="2" /></>,
  boots: (c, d) => <><path d="M30 20h24v46c10 2 26 6 32 14 4 6 2 10 2 12H24c-2-4-2-8-2-14l8-58Z" fill={c} /><path d="M22 86h66v6H24Z" fill={d} opacity=".35" /><path d="M30 34h24" stroke={d} strokeWidth="2" /></>,
  dress: (c, d) => <><path d="M38 10h24l2 18-6 10 26 72H16l26-72-6-10 2-18Z" fill={c} /><path d="M36 38h28" stroke={d} strokeWidth="2" /></>,
  kurta: (c, d) => <><path d="M34 14 18 20 8 54l12 4 6-14v66h48V44l6 14 12-4-10-34-16-6c-3 6-8 9-16 9s-13-3-16-9Z" fill={c} /><path d="M50 24v24" stroke={d} strokeWidth="2" />{[30, 38, 46].map(y => <circle key={y} cx="53" cy={y} r="1.5" fill={d} />)}</>,
  cap: (c, d) => <><path d="M20 66c0-22 14-34 30-34s30 12 30 34Z" fill={c} /><path d="M18 66h70c6 0 8 6 2 8H18Z" fill={d} opacity=".5" /><circle cx="50" cy="33" r="3" fill={d} /></>,
  sunglasses: (c, d) => <><path d="M10 54h80" stroke={d} strokeWidth="3" /><rect x="14" y="52" width="30" height="20" rx="9" fill={c} /><rect x="56" y="52" width="30" height="20" rx="9" fill={c} /><path d="M44 56c4-3 8-3 12 0" stroke={d} strokeWidth="3" fill="none" /></>,
  watch: (c, d) => <><rect x="38" y="18" width="24" height="84" rx="8" fill={d} opacity=".45" /><circle cx="50" cy="60" r="20" fill={c} stroke={d} strokeWidth="3" /><path d="M50 60V48M50 60l8 4" stroke={d} strokeWidth="2.5" /></>,
  bag: (c, d) => <><path d="M36 40c0-14 28-14 28 0" fill="none" stroke={d} strokeWidth="4" /><rect x="18" y="40" width="64" height="58" rx="8" fill={c} /><path d="M18 56h64" stroke={d} strokeWidth="2" opacity=".5" /></>,
  socks: (c, d) => <><path d="M30 14h18v52l18 18c6 6 0 16-8 12L32 78c-2-2-2-4-2-6V14Z" fill={c} /><path d="M30 22h18" stroke={d} strokeWidth="3" /><path d="M54 14h18v46l12 12" fill="none" stroke={c} strokeWidth="0" /></>,
};

const KIND_OF: Record<string, Kind> = {
  tshirt: 'tee', graphic: 'tee', tank: 'tee', polo: 'tee', longsleeve: 'tee', croptop: 'tee', jersey: 'tee', othertop: 'tee',
  shirt: 'shirt', dressshirt: 'shirt', linen: 'shirt', blouse: 'shirt', hoodie: 'hoodie', sweatshirt: 'hoodie', sweater: 'hoodie',
  kurta: 'kurta', ethnictop: 'kurta', jeans: 'jeans', cargo: 'jeans', chinos: 'trousers', trousers: 'trousers', casualtrousers: 'trousers',
  joggers: 'trousers', trackpants: 'trousers', leggings: 'trousers', pyjama: 'trousers', otherbottom: 'trousers', shorts: 'shorts', skirt: 'shorts',
  boots: 'boots', dress: 'dress', jumpsuit: 'dress', saree: 'dress', lehenga: 'dress', suit: 'jacket', otherpiece: 'dress',
  cap: 'cap', hat: 'cap', beanie: 'cap', sunglasses: 'sunglasses', watch: 'watch', bracelet: 'watch', bag: 'bag', backpack: 'bag', wallet: 'bag', socks: 'socks',
};
const BY_CATEGORY: Record<string, Kind> = { top: 'tee', bottom: 'jeans', outer: 'jacket', shoes: 'sneakers', onepiece: 'dress', accessory: 'bag' };

export function garmentKind(category: string, subcategory?: string): Kind {
  return KIND_OF[subcategory ?? ''] ?? BY_CATEGORY[category] ?? 'tee';
}

export function Garment({ kind, color = '#b5a27a', className, title }: { kind: Kind; color?: string; className?: string; title?: string }) {
  const c = color.startsWith('#') ? color : colorById(color).hex.startsWith('#') ? colorById(color).hex : '#b5a27a';
  const d = 'rgba(30,24,18,.55)';
  return (
    <svg viewBox="0 0 100 120" className={className} role={title ? 'img' : undefined} aria-label={title} aria-hidden={title ? undefined : true}>
      {PATHS[kind](c, d)}
    </svg>
  );
}
