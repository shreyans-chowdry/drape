import type { Metadata, Viewport } from 'next';
import { DM_Sans, Fraunces } from 'next/font/google';
import { BRAND } from '@/lib/brand';
import './globals.css';

const body = DM_Sans({ subsets: ['latin'], variable: '--font-body', display: 'swap' });
const display = Fraunces({ subsets: ['latin'], variable: '--font-display', display: 'swap', axes: ['opsz', 'SOFT'] });

export const metadata: Metadata = {
  metadataBase: new URL(BRAND.url),
  title: { default: `${BRAND.name} — ${BRAND.tagline}`, template: `%s · ${BRAND.name}` },
  description: BRAND.description,
  applicationName: BRAND.name,
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, title: BRAND.name, statusBarStyle: 'default' },
  icons: { icon: [{ url: '/icons/icon-192.png', sizes: '192x192' }], apple: '/icons/apple-touch-icon.png' },
  openGraph: { type: 'website', siteName: BRAND.name, title: `${BRAND.name} — ${BRAND.tagline}`, description: BRAND.description, images: ['/og.png'] },
  twitter: { card: 'summary_large_image', title: BRAND.name, description: BRAND.description, images: ['/og.png'] },
  alternates: { canonical: '/' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [{ media: '(prefers-color-scheme: light)', color: '#f6f3ee' }, { media: '(prefers-color-scheme: dark)', color: '#141210' }],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN" className={`${body.variable} ${display.variable}`} suppressHydrationWarning>
      <body className="min-h-dvh bg-paper text-ink antialiased">{children}</body>
    </html>
  );
}
