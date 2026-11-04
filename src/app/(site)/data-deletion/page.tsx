import type { Metadata } from 'next';
import Link from 'next/link';
import { BRAND } from '@/lib/brand';
import { contactLine, Legal } from '@/components/legal';

export const metadata: Metadata = { title: 'Delete your data', alternates: { canonical: '/data-deletion' } };

export default function DataDeletion() {
  return (
    <Legal title="Deleting your data">
      <h2>Delete your account yourself</h2>
      <ol className="ml-5 list-decimal space-y-2">
        <li>Sign in and open <Link href="/app/profile/data">Profile → Your data</Link>.</li>
        <li>Optionally download a full backup first.</li>
        <li>Type DELETE and confirm.</li>
      </ol>
      <h2>What happens</h2>
      <ul>
        <li>Any active subscription is cancelled immediately.</li>
        <li>All your photos — originals, studio photos, wishlist images and backups — are deleted from storage.</li>
        <li>Your account, wardrobe profiles, items, outfits, calendar, wear history, trips, chats and preferences are deleted.</li>
        <li>Payment records (amount, date, Razorpay reference) may be kept as long as tax law requires, no longer linked to your photos or wardrobe.</li>
        <li>You get a confirmation email (if email is set up for the service).</li>
      </ul>
      <h2>Can’t sign in?</h2>
      <p>Contact us {contactLine} from the email address on the account and we’ll delete it for you after confirming it’s yours. You can also delete single items, photos or wardrobe profiles at any time inside {BRAND.name}.</p>
    </Legal>
  );
}
