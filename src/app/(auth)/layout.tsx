import Link from 'next/link';
import { BRAND } from '@/lib/brand';
import { Garment } from '@/components/garments';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <div className="flex flex-col px-4 py-6 sm:px-10">
        <Link href="/" className="font-serif text-2xl">{BRAND.name}</Link>
        <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10">{children}</main>
      </div>
      <div aria-hidden className="relative hidden overflow-hidden bg-sunk lg:block">
        <div className="absolute inset-0 grid grid-cols-3 gap-6 p-16 opacity-90">
          {(['shirt', 'jeans', 'sneakers', 'jacket', 'dress', 'kurta', 'bag', 'tee', 'boots'] as const).map((k, i) => (
            <div key={k} className="flex items-center justify-center rounded-3xl bg-card shadow-soft animate-float" style={{ animationDelay: `${i * 0.6}s`, ['--r' as string]: `${(i % 3 - 1) * 3}deg` }}>
              <Garment kind={k} color={['#c9b79c', '#2c3e5c', '#f2efe9', '#6b5a45', '#b4532a', '#e3d7c3', '#3b3632', '#d8cdbb', '#5a3d2b'][i]} className="w-1/2" />
            </div>
          ))}
        </div>
        <p className="absolute inset-x-0 bottom-10 text-center font-serif text-2xl text-ink-2">{BRAND.tagline}</p>
      </div>
    </div>
  );
}
