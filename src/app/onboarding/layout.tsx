import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { currentUser } from '@/lib/supabase/server';
import { ToastProvider } from '@/components/ui';
import { StoreProvider } from '@/components/app/store';

export const metadata: Metadata = { title: 'Welcome', robots: { index: false } };

export default async function OnboardingLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  if (!user) redirect('/login?next=/onboarding');
  return <ToastProvider><StoreProvider user={user}>{children}</StoreProvider></ToastProvider>;
}
