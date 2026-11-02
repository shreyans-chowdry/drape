import type { Metadata } from 'next';
import Link from 'next/link';
import { BRAND } from '@/lib/brand';
import { contactLine, Legal } from '@/components/legal';

export const metadata: Metadata = { title: 'Terms of service', alternates: { canonical: '/terms' } };

export default function Terms() {
  return (
    <Legal title="Terms of service">
      <p>These terms are an agreement between you and {BRAND.operator}, an individual based in {BRAND.country}, who operates {BRAND.name}. By creating an account you agree to them. If you don’t agree, please don’t use {BRAND.name}.</p>

      <h2>Your account</h2>
      <p>You must be at least 18, give accurate details, and keep your password safe. You are responsible for activity on your account. One person per account.</p>

      <h2>Your content</h2>
      <p>You own the photos and information you add. You give us permission to store, process and display them only to provide {BRAND.name} to you — including sending them to our AI provider when you use AI features. Only upload photos you have the right to use, and don’t upload photos of other people without their permission.</p>

      <h2>AI features</h2>
      <p>Outfit suggestions, item details, studio photos, Own It results and trip plans are generated automatically and can be wrong. Studio photos are a representation of your item, not a guarantee of its exact appearance. Use your own judgement — particularly before buying something based on an Own It result.</p>

      <h2>Plans, credits and payments</h2>
      <ul>
        <li>Prices are shown in Indian rupees on the <Link href="/#pricing">pricing section</Link> and at checkout. Payments are processed by Razorpay.</li>
        <li>Subscriptions renew automatically each month or year until cancelled. You can cancel any time from Profile → Plan & billing; your plan stays active until the end of the paid period.</li>
        <li>Monthly allowances reset each billing month and don’t carry over. Purchased studio credit packs don’t expire while your account exists.</li>
        <li>A request that fails doesn’t use a credit. We may change prices for future billing periods with notice; changes never affect a period you’ve already paid for.</li>
        <li>Refunds are covered by our <Link href="/refunds">refund policy</Link>.</li>
      </ul>

      <h2>Acceptable use</h2>
      <p>Don’t misuse {BRAND.name}: no attempts to access other people’s data, overload or reverse-engineer the service, get around plan limits, resell access, or upload illegal or abusive content. We may suspend accounts that do.</p>

      <h2>Availability</h2>
      <p>We work to keep {BRAND.name} running, but it is provided “as is” without guarantees of uninterrupted availability. Features may change. Keep your own backups using the export feature.</p>

      <h2>Liability</h2>
      <p>To the extent the law allows, we are not liable for indirect or consequential losses, and our total liability for any claim is limited to the amount you paid us in the 12 months before it arose. Nothing in these terms limits rights you have under Indian consumer protection law.</p>

      <h2>Ending your account</h2>
      <p>You can delete your account at any time from Profile → Your data. We may close accounts that break these terms, and will give notice where reasonable.</p>

      <h2>Law and disputes</h2>
      <p>These terms are governed by the laws of India. Please contact us first {contactLine} — most issues can be resolved quickly.</p>

      <h2>Changes</h2>
      <p>We will notify you of material changes before they take effect. Continuing to use {BRAND.name} after that means you accept them.</p>
    </Legal>
  );
}
