'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronUp, CreditCard, Database, HelpCircle, LogOut, UserRound } from 'lucide-react';
import { cx, Sheet } from '@/components/ui';
import { useStore } from './store';

const LINKS = [
  { href: '/app/profile', label: 'Profile & preferences', icon: UserRound },
  { href: '/app/profile/billing', label: 'Plan & billing', icon: CreditCard },
  { href: '/app/profile/data', label: 'Your data', icon: Database },
  { href: '/app/help', label: 'Help', icon: HelpCircle },
];

function Avatar({ className }: { className?: string }) {
  const { profile, user } = useStore();
  const letter = (profile?.display_name || user.email || '?').trim().slice(0, 1).toUpperCase();
  return <span aria-hidden className={cx('flex shrink-0 items-center justify-center rounded-full bg-accent-soft font-medium text-accent', className)}>{letter}</span>;
}

function Items({ onPick }: { onPick: () => void }) {
  return (
    <>
      {LINKS.map(({ href, label, icon: Icon }) => (
        <Link key={href} href={href} onClick={onPick} role="menuitem" className="flex h-10 items-center gap-3 rounded-lg px-3 text-sm text-ink-2 hover:bg-sunk hover:text-ink">
          <Icon className="size-4" strokeWidth={1.8} /> {label}
        </Link>
      ))}
      <form action="/auth/signout" method="post" className="mt-1 border-t border-line pt-1">
        <button type="submit" role="menuitem" className="flex h-10 w-full items-center gap-3 rounded-lg px-3 text-sm text-danger hover:bg-danger-soft">
          <LogOut className="size-4" strokeWidth={1.8} /> Sign out
        </button>
      </form>
    </>
  );
}

/** Sidebar footer: who's signed in, with profile links and sign-out. */
export function AccountMenu() {
  const { profile, user } = useStore();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', close); };
  }, [open]);
  return (
    <div ref={ref} className="relative mt-3">
      {open && (
        <div role="menu" aria-label="Account" className="absolute inset-x-0 bottom-full mb-2 rounded-xl border border-line bg-card p-1 shadow-lift">
          <Items onPick={() => setOpen(false)} />
        </div>
      )}
      <button onClick={() => setOpen(o => !o)} aria-haspopup="menu" aria-expanded={open}
        className={cx('flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition hover:bg-sunk', open && 'bg-sunk')}>
        <Avatar className="size-9 text-sm" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{profile?.display_name || 'Your account'}</span>
          <span className="block truncate text-xs text-muted">{user.email}</span>
        </span>
        <ChevronUp className={cx('size-4 text-muted transition', !open && 'rotate-180')} />
      </button>
    </div>
  );
}

/** Mobile top bar: avatar that opens the same menu as a sheet. */
export function AccountButton() {
  const { profile, user } = useStore();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)} aria-label="Account and sign out" className="rounded-full">
        <Avatar className="size-8 text-sm" />
      </button>
      {/* Portalled: the top bar's backdrop blur would otherwise trap the fixed sheet inside it. */}
      {open && createPortal(<Sheet open onClose={() => setOpen(false)} title="Account">
        <div className="mb-3 flex items-center gap-3 px-1">
          <Avatar className="size-11" />
          <div className="min-w-0">
            <div className="truncate font-medium">{profile?.display_name || 'Your account'}</div>
            <div className="truncate text-sm text-muted">{user.email}</div>
          </div>
        </div>
        <div role="menu" aria-label="Account"><Items onPick={() => setOpen(false)} /></div>
      </Sheet>, document.body)}
    </>
  );
}
