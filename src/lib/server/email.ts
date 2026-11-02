import 'server-only';
import { BRAND } from '@/lib/brand';

// Transactional email through Resend (https://resend.com/docs/api-reference/emails/send-email).
// Auth emails (verify, reset) are sent by Supabase Auth itself; see supabase/templates and SETUP.md.
// Without RESEND_API_KEY these become logged no-ops, so nothing pretends to be sent.

type Mail = { subject: string; heading: string; body: string; cta?: { label: string; href: string } };

export function layout({ heading, body, cta }: Omit<Mail, 'subject'>) {
  return `<!doctype html><html><body style="margin:0;background:#f6f3ee;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#1c1a17">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" style="max-width:520px;background:#fffdf9;border-radius:16px;border:1px solid #e7e1d6">
<tr><td style="padding:32px 32px 8px;font-family:Georgia,'Times New Roman',serif;font-size:22px;letter-spacing:.3px">${BRAND.name}</td></tr>
<tr><td style="padding:8px 32px 0;font-family:Georgia,'Times New Roman',serif;font-size:26px;line-height:1.25">${heading}</td></tr>
<tr><td style="padding:16px 32px 8px;font-size:15px;line-height:1.6;color:#4a453d">${body}</td></tr>
${cta ? `<tr><td style="padding:16px 32px 8px"><a href="${cta.href}" style="display:inline-block;background:#1c1a17;color:#fffdf9;text-decoration:none;padding:12px 22px;border-radius:999px;font-size:15px">${cta.label}</a></td></tr>` : ''}
<tr><td style="padding:24px 32px 32px;font-size:12px;color:#8a8378">You're receiving this because you have a ${BRAND.name} account. Questions? Reply to ${BRAND.supportEmail}.</td></tr>
</table></td></tr></table></body></html>`;
}

export const TEMPLATES = {
  welcome: (name: string): Mail => ({
    subject: `Welcome to ${BRAND.name}`, heading: `Welcome, ${name}.`,
    body: 'Start by photographing a few favourite pieces — a top, a bottom and a pair of shoes is enough for your first outfit. Then open Today for three looks picked for the weather.',
    cta: { label: 'Add your first pieces', href: `${BRAND.url}/app/wardrobe?add=1` },
  }),
  subscriptionConfirmed: (plan: string, until: string): Mail => ({
    subject: `You're on ${BRAND.name} ${plan}`, heading: `${plan} is active.`,
    body: `Your plan renews on ${until}. You can see your credits and cancel any time from Profile → Plan & billing.`,
    cta: { label: 'Open Drape', href: `${BRAND.url}/app` },
  }),
  paymentFailed: (plan: string): Mail => ({
    subject: 'Your payment did not go through', heading: 'We could not take your payment.',
    body: `Your ${plan} renewal payment failed. Razorpay will retry automatically; you can also update your payment method from Profile → Plan & billing. Your wardrobe is safe either way.`,
    cta: { label: 'Review billing', href: `${BRAND.url}/app/profile/billing` },
  }),
  subscriptionCancelled: (plan: string, until: string | null): Mail => ({
    subject: 'Your subscription is cancelled', heading: 'Cancellation confirmed.',
    body: until ? `You keep ${plan} until ${until}. After that your account moves to the Free plan — nothing in your wardrobe is deleted.` : 'Your account is now on the Free plan. Nothing in your wardrobe is deleted.',
  }),
  usageLimit: (what: string): Mail => ({
    subject: `You've reached your ${what} limit`, heading: `You've used this month's ${what}.`,
    body: 'Your allowance refills at the start of your next billing period. If you need more now, you can upgrade or add a credit pack.',
    cta: { label: 'See plans', href: `${BRAND.url}/app/profile/billing` },
  }),
  accountDeleted: (): Mail => ({
    subject: `Your ${BRAND.name} account has been deleted`, heading: 'Your account is deleted.',
    body: 'Your wardrobe, photos, outfits and chats have been permanently removed. Payment records that the law requires us to keep are retained without your wardrobe data. Thank you for trying Drape.',
  }),
};

export async function sendEmail(to: string, mail: Mail) {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM; // e.g. "Drape <hello@yourdomain.com>" on a domain verified in Resend
  if (!key || !from) {
    console.info(`[email] not configured — skipped "${mail.subject}"`);
    return { sent: false as const };
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to, subject: mail.subject, html: layout(mail), reply_to: BRAND.supportEmail }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) console.error('[email] resend', res.status);
  return { sent: res.ok };
}
