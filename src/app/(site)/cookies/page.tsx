import type { Metadata } from 'next';
import { BRAND } from '@/lib/brand';
import { Legal } from '@/components/legal';

export const metadata: Metadata = { title: 'Cookies', alternates: { canonical: '/cookies' } };

export default function Cookies() {
  return (
    <Legal title="Cookies & local storage">
      <p>{BRAND.name} uses only what it needs to work. There are no advertising or third-party tracking cookies, so there’s no cookie banner.</p>
      <h2>What we use</h2>
      <ul>
        <li><b>Sign-in cookies</b> (set by Supabase) keep you signed in securely. Without them you can’t use your account.</li>
        <li><b>Local storage on your device</b> remembers small conveniences: cached weather (30 minutes), packing-list ticks, and whether you’ve dismissed the install prompt. It never leaves your device.</li>
        <li><b>Payment checkout</b>: when you pay, Razorpay’s checkout loads and may set its own cookies to process the payment and prevent fraud.</li>
      </ul>
      <p>You can clear cookies and local storage in your browser settings at any time; you’ll simply be signed out.</p>
    </Legal>
  );
}
