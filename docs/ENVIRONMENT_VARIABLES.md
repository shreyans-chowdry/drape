# Environment variables

| Name | Where | Required | Purpose |
|---|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | public | yes | Canonical URL for metadata, sitemap, emails (e.g. `https://drape.shreyanschowdry.tech`) |
| `NEXT_PUBLIC_SUPABASE_URL` | public | yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | public | yes | Publishable (anon) key. Safe in the browser: RLS protects every table. `NEXT_PUBLIC_SUPABASE_ANON_KEY` is accepted as a fallback |
| `NEXT_PUBLIC_GOOGLE_AUTH` | public | no | `true` shows “Continue with Google” |
| `NEXT_PUBLIC_SUPPORT_EMAIL` | public | no | Public support address shown on the site and used as reply-to. Leave empty until you have one |
| `SUPABASE_SECRET_KEY` | server | yes | Service-role key for server routes (billing, AI writes, account deletion). `SUPABASE_SERVICE_ROLE_KEY` also accepted. **Never expose** |
| `GEMINI_API_KEY` | server | yes | Google Gemini API key. Only read in `src/lib/ai/gemini.ts` (server-only module) |
| `ADMIN_EMAILS` | server | yes | Comma-separated, verified emails allowed into `/admin` |
| `CRON_SECRET` | server | yes on Vercel | Authorises `/api/cron/cleanup` |
| `RAZORPAY_KEY_ID` | server | for payments | `rzp_test_…` in test mode. Returned to checkout per request (public by design) |
| `RAZORPAY_KEY_SECRET` | server | for payments | Signature verification and API calls |
| `RAZORPAY_WEBHOOK_SECRET` | server | for payments | Verifies `/api/razorpay/webhook` |
| `RESEND_API_KEY` | server | for email | Resend API key |
| `EMAIL_FROM` | server | for email | Sender on a domain verified in Resend |

Variables are read at runtime; on Vercel add them under Project → Settings → Environment Variables. `.env*` files are gitignored except `.env.example`.
