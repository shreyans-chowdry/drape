import type { Metadata } from 'next';
import { BRAND } from '@/lib/brand';
import { contactLine, Legal } from '@/components/legal';

export const metadata: Metadata = { title: 'Refunds & cancellation', alternates: { canonical: '/refunds' } };

export default function Refunds() {
  return (
    <Legal title="Refunds & cancellation">
      <h2>Cancelling a subscription</h2>
      <p>Cancel any time in Profile → Plan & billing. You won’t be charged again, and you keep your paid plan until the end of the current billing period. After that your account moves to the Free plan; your wardrobe is kept.</p>

      <h2>Refunds</h2>
      <ul>
        <li><b>Charged by mistake:</b> if you were charged twice, or charged after cancelling, contact us and we will refund the duplicate or incorrect charge in full.</li>
        <li><b>New subscriptions:</b> if you subscribe and change your mind within 7 days of the first payment, and have used fewer than half of that period’s studio credits, contact us for a full refund.</li>
        <li><b>Renewals:</b> renewal payments are generally not refunded, because you can cancel before the renewal date. If something went wrong, write to us and we’ll look at it fairly.</li>
        <li><b>Studio credit packs:</b> refundable within 7 days of purchase if none of the pack’s credits have been used.</li>
        <li><b>Failed AI requests</b> never use a credit, so there is nothing to refund for them.</li>
      </ul>
      <p>Approved refunds are returned to the original payment method through Razorpay, usually within 5–7 working days, depending on your bank.</p>

      <h2>How to ask</h2>
      <p>Contact us {contactLine} with the email on your {BRAND.name} account and the payment date. You’ll find payment references in Profile → Plan & billing.</p>
    </Legal>
  );
}
