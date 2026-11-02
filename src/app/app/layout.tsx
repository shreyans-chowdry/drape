import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { currentUser, supabaseServer } from '@/lib/supabase/server';
import { ToastProvider } from '@/components/ui';
import { StoreProvider } from '@/components/app/store';
import { Shell } from '@/components/app/shell';
import { RegisterSW } from '@/components/pwa';

export const metadata: Metadata = { title: 'Your wardrobe', robots: { index: false } };

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  if (!user) redirect('/login?next=/app');
  const sb = await supabaseServer();
  const { data: profile } = await sb.from('profiles').select('onboarding').eq('id', user.id).single();
  if (!(profile?.onboarding as { done?: boolean } | null)?.done) redirect('/onboarding');
  return (
    <ToastProvider>
      <StoreProvider user={user}>
        <Shell>{children}</Shell>
      </StoreProvider>
      <RegisterSW />
    </ToastProvider>
  );
}
