import { BRAND } from '@/lib/brand';

export const UPDATED = '3 November 2026';
export const contactLine = BRAND.supportEmail ? `by email at ${BRAND.supportEmail} or through the contact form at ${BRAND.url}/contact` : `through the contact form at ${BRAND.url}/contact`;

export function Legal({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <article className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <p className="text-sm text-muted">Last updated {UPDATED}</p>
      <h1 className="mt-2 font-serif text-4xl sm:text-5xl">{title}</h1>
      <div className="mt-10 space-y-5 leading-relaxed text-ink-2 [&_h2]:mt-10 [&_h2]:font-serif [&_h2]:text-2xl [&_h2]:text-ink [&_li]:ml-5 [&_li]:list-disc [&_li]:pl-1 [&_a]:text-accent [&_ul]:space-y-2">{children}</div>
    </article>
  );
}
