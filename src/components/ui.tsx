'use client';
import Link from 'next/link';
import { createContext, useCallback, useContext, useEffect, useId, useRef, useState, type ComponentProps, type ReactNode } from 'react';
import { X } from 'lucide-react';

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

// ───────── buttons
const VARIANTS = {
  primary: 'bg-ink text-paper hover:bg-ink/90',
  accent: 'bg-accent text-accent-ink hover:brightness-105',
  secondary: 'bg-card text-ink border border-line hover:border-line-strong',
  ghost: 'text-ink hover:bg-sunk',
  danger: 'bg-danger-soft text-danger hover:brightness-95',
};
const SIZES = { sm: 'h-9 px-3.5 text-sm gap-1.5', md: 'h-11 px-5 text-[15px] gap-2', lg: 'h-12 px-6 text-base gap-2' };
type BtnProps = { variant?: keyof typeof VARIANTS; size?: keyof typeof SIZES; loading?: boolean; block?: boolean };

export function Button({ variant = 'primary', size = 'md', loading, block, className, children, disabled, ...rest }: BtnProps & ComponentProps<'button'>) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={cx('inline-flex select-none items-center justify-center rounded-full font-medium transition active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-50', VARIANTS[variant], SIZES[size], block && 'w-full', className)}
    >
      {loading && <Spinner className="size-4" />}
      {children}
    </button>
  );
}
export function LinkButton({ variant = 'primary', size = 'md', block, className, ...rest }: BtnProps & ComponentProps<typeof Link>) {
  return <Link {...rest} className={cx('inline-flex items-center justify-center rounded-full font-medium transition active:scale-[.98]', VARIANTS[variant], SIZES[size], block && 'w-full', className)} />;
}
export function IconButton({ label, className, children, ...rest }: { label: string } & ComponentProps<'button'>) {
  return (
    <button aria-label={label} title={label} {...rest} className={cx('inline-flex size-10 shrink-0 items-center justify-center rounded-full text-ink-2 transition hover:bg-sunk hover:text-ink disabled:opacity-40', className)}>
      {children}
    </button>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <span role="status" aria-label="Loading" className={cx('inline-block size-5 animate-spin rounded-full border-2 border-current border-r-transparent opacity-70', className)} />;
}

// ───────── surfaces
export function Card({ className, ...rest }: ComponentProps<'div'>) {
  return <div {...rest} className={cx('rounded-2xl border border-line bg-card', className)} />;
}
export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx('text-[11px] font-semibold uppercase tracking-[.14em] text-muted', className)}>{children}</div>;
}
export function PageHeader({ eyebrow, title, children, actions }: { eyebrow?: ReactNode; title: ReactNode; children?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow && <Eyebrow className="mb-1.5">{eyebrow}</Eyebrow>}
        <h1 className="font-serif text-[30px] leading-[1.1] tracking-[-.01em] sm:text-4xl">{title}</h1>
        {children && <div className="mt-2 max-w-2xl text-[15px] text-muted">{children}</div>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  );
}
export function Empty({ icon, title, children, action }: { icon?: ReactNode; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <Card className="flex flex-col items-center px-6 py-12 text-center">
      {icon && <div className="mb-4 flex size-14 items-center justify-center rounded-full bg-sunk text-ink-2">{icon}</div>}
      <h3 className="font-serif text-xl">{title}</h3>
      {children && <p className="mt-2 max-w-sm text-sm text-muted">{children}</p>}
      {action && <div className="mt-5">{action}</div>}
    </Card>
  );
}

// ───────── chips & badges
export function Chip({ active, className, ...rest }: { active?: boolean } & ComponentProps<'button'>) {
  return (
    <button
      type="button"
      aria-pressed={active}
      {...rest}
      className={cx('inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 text-sm transition', active ? 'border-ink bg-ink text-paper' : 'border-line bg-card text-ink-2 hover:border-line-strong', className)}
    />
  );
}
const TONES = { neutral: 'bg-sunk text-ink-2', accent: 'bg-accent-soft text-accent', good: 'bg-sage-soft text-sage', warn: 'bg-warn-soft text-warn', bad: 'bg-danger-soft text-danger' };
export function Badge({ tone = 'neutral', className, children }: { tone?: keyof typeof TONES; className?: string; children: ReactNode }) {
  return <span className={cx('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium', TONES[tone], className)}>{children}</span>;
}
export function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: { value: T; label: ReactNode }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div role="tablist" aria-label={label} className="inline-flex rounded-full border border-line bg-sunk p-1">
      {options.map(o => (
        <button key={o.value} role="tab" aria-selected={value === o.value} onClick={() => onChange(o.value)}
          className={cx('h-9 rounded-full px-4 text-sm transition', value === o.value ? 'bg-card text-ink shadow-soft' : 'text-muted hover:text-ink')}>
          {o.label}
        </button>
      ))}
    </div>
  );
}
export function Progress({ value, className }: { value: number; className?: string }) {
  return (
    <div className={cx('h-1.5 overflow-hidden rounded-full bg-sunk', className)} role="progressbar" aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-full rounded-full bg-accent transition-[width] duration-500" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

// ───────── form fields
export function Field({ label, hint, error, children, className }: { label: string; hint?: ReactNode; error?: string | null; children: (id: string) => ReactNode; className?: string }) {
  const id = useId();
  return (
    <div className={cx('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-sm font-medium text-ink-2">{label}</label>
      {children(id)}
      {error ? <p className="text-xs text-danger" role="alert">{error}</p> : hint ? <p className="text-xs text-muted">{hint}</p> : null}
    </div>
  );
}
const inputCls = 'h-11 w-full rounded-xl border border-line bg-card px-3.5 text-[15px] text-ink outline-none transition placeholder:text-muted/70 focus:border-ink';
export const Input = (p: ComponentProps<'input'>) => <input {...p} className={cx(inputCls, p.className)} />;
export const Select = (p: ComponentProps<'select'>) => <select {...p} className={cx(inputCls, 'appearance-none bg-[length:12px] bg-[right_14px_center] bg-no-repeat pr-9', p.className)} style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%237a7266' stroke-width='1.6' fill='none'/%3E%3C/svg%3E\")" }} />;
export const Textarea = (p: ComponentProps<'textarea'>) => <textarea {...p} className={cx(inputCls, 'h-auto min-h-24 py-3', p.className)} />;

// ───────── sheet: bottom sheet on phones, centred dialog on larger screens
export function Sheet({ open, onClose, title, children, wide, footer }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; wide?: boolean; footer?: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    ref.current?.focus();
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; prev?.focus?.(); };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6" role="presentation">
      <div className="absolute inset-0 animate-fade bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label={typeof title === 'string' ? title : undefined}
        className={cx('relative flex max-h-[92dvh] w-full animate-rise flex-col rounded-t-3xl bg-card shadow-lift outline-none sm:rounded-3xl', wide ? 'sm:max-w-3xl' : 'sm:max-w-lg')}>
        <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3.5">
          <h2 className="font-serif text-xl">{title}</h2>
          <IconButton label="Close" onClick={onClose}><X className="size-5" /></IconButton>
        </div>
        <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-5">{children}</div>
        {footer && <div className="pb-safe border-t border-line px-5 py-3.5">{footer}</div>}
      </div>
    </div>
  );
}

// ───────── toasts
type Toast = { id: number; text: string; tone: 'neutral' | 'good' | 'bad'; action?: { label: string; onClick: () => void } };
const ToastCtx = createContext<(text: string, opts?: { tone?: Toast['tone']; action?: Toast['action'] }) => void>(() => {});
export const useToast = () => useContext(ToastCtx);
export function ToastProvider({ children }: { children: ReactNode }) {
  const [list, setList] = useState<Toast[]>([]);
  const push = useCallback((text: string, opts: { tone?: Toast['tone']; action?: Toast['action'] } = {}) => {
    const id = Date.now() + Math.random();
    setList(l => [...l.slice(-2), { id, text, tone: opts.tone ?? 'neutral', action: opts.action }]);
    setTimeout(() => setList(l => l.filter(t => t.id !== id)), opts.action ? 6000 : 3800);
  }, []);
  return (
    <ToastCtx value={push}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-24 z-[60] flex flex-col items-center gap-2 px-4 lg:bottom-6">
        {list.map(t => (
          <div key={t.id} className={cx('pointer-events-auto flex max-w-md animate-rise items-center gap-3 rounded-full px-4 py-2.5 text-sm shadow-lift', t.tone === 'bad' ? 'bg-danger text-white' : t.tone === 'good' ? 'bg-sage text-white' : 'bg-ink text-paper')}>
            <span>{t.text}</span>
            {t.action && <button className="font-semibold underline underline-offset-2" onClick={t.action.onClick}>{t.action.label}</button>}
          </div>
        ))}
      </div>
    </ToastCtx>
  );
}
