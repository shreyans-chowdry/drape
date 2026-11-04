# Architecture

```
Browser (Next.js client components, PWA)
  │  Supabase JS (publishable key, user session) ──► Postgres with RLS, Storage (private buckets)
  │  fetch /api/*  ──────────────────────────────►  Next.js route handlers (server)
  │                                                   ├─ Gemini REST API (GEMINI_API_KEY)
  │                                                   ├─ Razorpay REST + webhook
  │                                                   ├─ Resend
  │                                                   └─ Supabase service role (credits, billing, AI writes)
  └─ Open-Meteo via /api/weather, /api/geocode
```

## Principles
- **Secrets stay on the server.** `server-only` modules: `src/lib/ai/*`, `src/lib/server/*`, `src/lib/supabase/admin.ts`. The browser only has the publishable key.
- **RLS everywhere.** Every user table has own-row policies; triggers stop a row pointing at another user’s wardrobe or parent row (`check_wardrobe_owner`, `check_parent_owner`). Plans, payments, usage and credits are read-only to users and written by the server.
- **Credits are a ledger.** `hold_ai_credit` (advisory lock, raises `quota_exceeded`) → AI call → `settle_ai_credit(ok)`. Failed calls are refunded, so a failure never costs a credit. `my_quotas()` exposes the user’s own balance.
- **Plan limits in the database.** `enforce_item_limit` / `enforce_profile_limit` triggers; `user_plan()` derives the plan from server-written subscriptions. Visiting a payment-success URL grants nothing — `/api/billing/verify` and the webhook re-fetch the payment from Razorpay first.

## Code map
| Path | Role |
|---|---|
| `src/proxy.ts` | Session refresh; guards `/app`, `/onboarding`, `/admin` |
| `src/app/(site)` | Landing page and legal pages |
| `src/app/(auth)`, `src/app/auth/*` | Sign in/up, reset, email/OAuth callback, sign-out |
| `src/app/onboarding` | 5-step onboarding, resumable (`profiles.onboarding`) |
| `src/app/app/*` | The product: Today, Wardrobe, Add, Stylist, Match, Own It, Trips, Finder, Chat, Favourites, Calendar, Insights, Profile, Billing, Data, Help |
| `src/app/admin` | Metrics and plan/pricing/model settings (server actions, `ADMIN_EMAILS`) |
| `src/app/api/ai/*` | scan, studio, style, ownit, chat, trip — each wrapped in `route()` (auth, 30 req/min/user, zod) and `withCredit()` |
| `src/lib/engine.ts` | On-device outfit engine (colour theory, formality, weather, repetition) — free features |
| `src/lib/ai/gemini.ts` | Model fallback, retries, usage metering, cost calculation |
| `src/lib/ai/features.ts` | Prompts and schemas; studio pipeline with verification + one retry |
| `src/components/app/store.tsx` | Client store: items, outfits, quotas, signed photo URLs (1 h, refreshed) |
| `src/components/app/items.tsx` | `OutfitCard` (fixed square image grid → aligned cards), pickers, sheets |

## Photo pipeline
1. Client compresses (≤1600 px JPEG), checks blur/brightness locally, uploads to `temp/<uid>/…`.
2. `/api/ai/scan` validates ownership of the path, asks Gemini for quality + every garment (with boxes).
3. Client saves each garment, copies the photo to `originals/<uid>/<item>/original.jpg`, crops a thumbnail.
4. Optional studio photo: `/api/ai/studio` generates at 1K, verifies against the original with a second model call, retries once with the issues, stores in `studio/` (server-write only) and charges only on success. The user compares original vs studio before it is used.
5. `/api/cron/cleanup` removes temp files older than a day.
