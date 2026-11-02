import Link from 'next/link';
import { BRAND } from '@/lib/brand';
import { currentUser } from '@/lib/supabase/server';

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  return (
    <>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-ink focus:px-4 focus:py-2 focus:text-paper">Skip to content</a>
      <header className="sticky top-0 z-30 border-b border-line/70 bg-paper/85 backdrop-blur pt-safe">
        <nav className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4 sm:px-6" aria-label="Main">
          <Link href="/" className="font-serif text-2xl">{BRAND.name}</Link>
          <div className="hidden flex-1 gap-6 text-sm text-ink-2 md:flex">
            <Link href="/#how" className="hover:text-ink">How it works</Link>
            <Link href="/#features" className="hover:text-ink">Features</Link>
            <Link href="/#pricing" className="hover:text-ink">Pricing</Link>
            <Link href="/#faq" className="hover:text-ink">FAQ</Link>
          </div>
          <div className="ml-auto flex items-center gap-2 text-sm">
            {user ? <Link href="/app" className="rounded-full bg-ink px-4 py-2 text-paper">Open wardrobe</Link> : (
              <>
                <Link href="/login" className="px-3 py-2 text-ink-2 hover:text-ink">Sign in</Link>
                <Link href="/signup" className="rounded-full bg-ink px-4 py-2 text-paper">Start free</Link>
              </>
            )}
          </div>
        </nav>
      </header>
      <main id="main">{children}</main>
      <footer className="mt-24 border-t border-line">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 text-sm sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
          <div>
            <div className="font-serif text-2xl">{BRAND.name}</div>
            <p className="mt-2 text-muted">{BRAND.tagline}</p>
          </div>
          <FooterCol title="Product" links={[['/#features', 'Features'], ['/#pricing', 'Pricing'], ['/#faq', 'FAQ'], ['/signup', 'Create an account']]} />
          <FooterCol title="Legal" links={[['/privacy', 'Privacy policy'], ['/terms', 'Terms of service'], ['/refunds', 'Refunds & cancellation'], ['/cookies', 'Cookies'], ['/data-deletion', 'Delete your data']]} />
          <FooterCol title="Contact" links={[['/contact', 'Contact us'], ...(BRAND.supportEmail ? [[`mailto:${BRAND.supportEmail}`, BRAND.supportEmail] as [string, string]] : [])]} />
        </div>
        <p className="mx-auto max-w-6xl px-4 pb-10 text-xs text-muted sm:px-6">© {new Date().getFullYear()} {BRAND.name}. Made in {BRAND.country}.</p>
      </footer>
    </>
  );
}

function FooterCol({ title, links }: { title: string; links: [string, string][] }) {
  return (
    <div>
      <h2 className="mb-3 font-medium">{title}</h2>
      <ul className="space-y-2 text-muted">{links.map(([h, l]) => <li key={h}><Link href={h} className="hover:text-ink">{l}</Link></li>)}</ul>
    </div>
  );
}
