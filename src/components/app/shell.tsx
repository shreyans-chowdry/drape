'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { MoreHorizontal, Plus } from 'lucide-react';
import { BRAND } from '@/lib/brand';
import { cx, Sheet } from '@/components/ui';
import { NAV, MOBILE_TABS } from './nav';
import { useStore } from './store';
import { Tour } from './tour';
import { AccountButton, AccountMenu } from './account-menu';

const active = (path: string, href: string) => (href === '/app' ? path === '/app' : path === href || path.startsWith(href + '/'));

export function Shell({ children }: { children: ReactNode }) {
  const path = usePathname();
  const { wardrobes, wardrobeId, setWardrobe, quotas } = useStore();
  const [more, setMore] = useState(false);
  const current = wardrobes.find(w => w.id === wardrobeId);

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[248px_1fr]">
      {/* desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-line bg-card/60 px-4 py-6 lg:flex">
        <Link href="/app" className="mb-6 px-2 font-serif text-2xl tracking-tight">{BRAND.name}</Link>
        {wardrobes.length > 1 && (
          <label className="mb-4 block px-2">
            <span className="sr-only">Wardrobe profile</span>
            <select value={wardrobeId} onChange={e => setWardrobe(e.target.value)} className="h-9 w-full rounded-lg border border-line bg-card px-2 text-sm">
              {wardrobes.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </label>
        )}
        <Link href="/app/add" data-tour="add" className="mb-4 flex h-11 items-center justify-center gap-2 rounded-full bg-ink text-sm font-medium text-paper transition hover:bg-ink/90">
          <Plus className="size-4" /> Add clothes
        </Link>
        <nav aria-label="Main" className="flex-1 space-y-0.5 overflow-y-auto">
          {NAV.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} data-tour={href} aria-current={active(path, href) ? 'page' : undefined}
              className={cx('flex h-10 items-center gap-3 rounded-xl px-3 text-[15px] transition', active(path, href) ? 'bg-sunk font-medium text-ink' : 'text-ink-2 hover:bg-sunk/60')}>
              <Icon className="size-[18px]" strokeWidth={1.8} /> {label}
            </Link>
          ))}
        </nav>
        {quotas && (
          <Link href="/app/profile/billing" className="mt-4 rounded-xl border border-line px-3 py-2.5 text-xs text-muted hover:border-line-strong">
            <div className="flex justify-between"><span className="font-medium capitalize text-ink">{quotas.plan} plan</span><span>{current?.name}</span></div>
            <div className="mt-1">{quotas.studio.remaining} studio · {quotas.styling.remaining} styling left</div>
          </Link>
        )}
        <AccountMenu />
      </aside>

      <div className="min-w-0">
        {/* mobile top bar */}
        <header className="pt-safe sticky top-0 z-30 border-b border-line bg-paper/85 backdrop-blur lg:hidden">
          <div className="flex h-14 items-center justify-between px-4">
            <Link href="/app" className="font-serif text-xl">{BRAND.name}</Link>
            <div className="flex items-center gap-2">
              {wardrobes.length > 1 && (
                <select aria-label="Wardrobe profile" value={wardrobeId} onChange={e => setWardrobe(e.target.value)} className="h-8 max-w-[9rem] rounded-lg border border-line bg-card px-2 text-xs">
                  {wardrobes.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              )}
              <AccountButton />
            </div>
          </div>
        </header>

        <main id="main" className="mx-auto w-full max-w-6xl px-4 pb-28 pt-6 sm:px-6 lg:px-10 lg:pb-12 lg:pt-10">{children}</main>

        {/* mobile bottom bar */}
        <nav aria-label="Main" className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-line bg-card/95 backdrop-blur lg:hidden">
          <div className="mx-auto grid h-16 max-w-md grid-cols-5 items-center">
            {MOBILE_TABS.slice(0, 2).map(href => <Tab key={href} href={href} path={path} />)}
            <Link href="/app/add" aria-label="Add clothes" data-tour="add" className="mx-auto flex size-12 -translate-y-3 items-center justify-center rounded-full bg-ink text-paper shadow-lift">
              <Plus className="size-6" />
            </Link>
            {MOBILE_TABS.slice(2, 3).map(href => <Tab key={href} href={href} path={path} />)}
            <button onClick={() => setMore(true)} data-tour="more" className="flex flex-col items-center gap-0.5 text-[11px] text-muted">
              <MoreHorizontal className="size-[22px]" strokeWidth={1.8} /> More
            </button>
          </div>
        </nav>
        <Sheet open={more} onClose={() => setMore(false)} title="Everything in Drape">
          <div className="grid grid-cols-3 gap-2">
            {NAV.filter(n => !(['/app', '/app/wardrobe', '/app/stylist'] as string[]).includes(n.href)).map(({ href, label, icon: Icon }) => (
              <Link key={href} href={href} onClick={() => setMore(false)} className={cx('flex flex-col items-center gap-2 rounded-2xl border px-2 py-4 text-center text-[13px]', active(path, href) ? 'border-ink bg-sunk' : 'border-line')}>
                <Icon className="size-5" strokeWidth={1.8} /> {label}
              </Link>
            ))}
          </div>
        </Sheet>
      </div>
      <Tour />
    </div>
  );
}

function Tab({ href, path }: { href: string; path: string }) {
  const item = NAV.find(n => n.href === href)!;
  const Icon = item.icon;
  const on = active(path, href);
  return (
    <Link href={href} data-tour={href} aria-current={on ? 'page' : undefined} className={cx('flex flex-col items-center gap-0.5 text-[11px]', on ? 'text-ink' : 'text-muted')}>
      <Icon className="size-[22px]" strokeWidth={on ? 2.2 : 1.8} /> {item.label === 'AI Stylist' ? 'Stylist' : item.label}
    </Link>
  );
}
