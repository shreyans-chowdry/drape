# Deployment

Nothing has been deployed yet. These are the steps, in order.

## 1. Supabase (production project)
1. Create a project at https://supabase.com (region: Mumbai `ap-south-1`).
2. `npx supabase link --project-ref <ref>` then `npx supabase db push` (applies all migrations, including buckets and policies).
3. Auth → URL configuration: Site URL `https://drape.shreyanschowdry.tech`; redirect URLs `https://drape.shreyanschowdry.tech/auth/callback`, `https://drape.shreyanschowdry.tech/auth/confirm`.
4. Auth → Email templates: paste `supabase/templates/confirmation.html` and `recovery.html` (they link to `/auth/confirm` with a token hash).
5. Auth → SMTP: use Resend SMTP (`smtp.resend.com`) so auth emails come from your domain; the built-in sender is rate-limited.
6. Optional: Auth → Providers → Google (client id/secret from Google Cloud; authorised redirect `https://<ref>.supabase.co/auth/v1/callback`).

## 2. Vercel
1. Import the GitHub repo, branch `platform` (or merge to `main` first). Framework: Next.js. Node 22 (`engines`).
2. Add every variable from [ENVIRONMENT_VARIABLES.md](ENVIRONMENT_VARIABLES.md) for Production (and Preview with test keys).
3. Deploy. `vercel.json` sets region `bom1` and a daily cron for `/api/cron/cleanup`.

## 3. Domain: drape.shreyanschowdry.tech
In Vercel → Project → Domains add `drape.shreyanschowdry.tech`. At your DNS provider for `shreyanschowdry.tech`, add:

| Type | Name | Value |
|---|---|---|
| CNAME | `drape` | `cname.vercel-dns.com` |

(Vercel may show a project-specific target instead; use exactly what it displays.) HTTPS is issued automatically. Then set `NEXT_PUBLIC_SITE_URL=https://drape.shreyanschowdry.tech` and redeploy.

For Resend, verify the domain you send from (e.g. `mail.shreyanschowdry.tech`) and add the SPF, DKIM and (recommended) DMARC records Resend displays.

## 4. Razorpay
1. Dashboard (Test mode) → Subscriptions → Plans: create Plus monthly ₹199, Plus yearly ₹1,999, Pro monthly ₹349, Pro yearly ₹3,499.
2. Put the plan ids into Admin → Plans (`razorpay_plan_monthly`, `razorpay_plan_annual`).
3. Webhooks → add `https://drape.shreyanschowdry.tech/api/razorpay/webhook` with a secret; events: `subscription.*`, `payment.captured`, `payment.failed`, `order.paid`.
4. Set `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`. Test with Razorpay test cards/UPI, then repeat with live keys after KYC.

## 5. Google Gemini
Enable billing on the Google AI Studio project for image models (studio photos). Text features work on the free tier but production traffic should use the paid tier (Google does not use paid-tier data to improve its products — the privacy policy says so).

## 6. Before launch
- Rotate the Gemini key used during development.
- Review `/privacy`, `/terms`, `/refunds` (drafted; not legal advice).
- Set `NEXT_PUBLIC_SUPPORT_EMAIL` once a domain mailbox exists.
