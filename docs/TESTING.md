# Testing

| Check | Command | Status at handover |
|---|---|---|
| Types | `npm run typecheck` | passes |
| Lint | `npm run lint` | 0 errors; warnings only (advisory React Compiler rules) |
| Unit | `npm test` | engine rules, Razorpay signatures, CSV injection guard, redirect safety |
| Integration | `npm run test:integration` (local Supabase running) | RLS isolation, spoofed ownership, child-row ownership, storage isolation, self-granting plans/credits blocked, item limit, credit hold/charge/refund, quota exhaustion |
| Build | `npm run build` | passes |

## Browser checks performed (local)
- Sign up → confirmation email (Mailpit) → onboarding (all 5 steps, resumable) → tour → Today.
- Real photo scan through Gemini: queue, upload, analysis, item + original + thumbnail saved, usage metered.
- Today outfit cards at 360, 768, 1024, 1440, 1920 px: 1/2/3 columns, identical card heights and square image areas, no horizontal scroll.
- Stylist (3 looks from owned pieces), studio failure path (credit refunded, provider error hidden), admin metrics and settings validation, sign-out and protected-route redirect.

## Not yet tested
- Razorpay checkout end-to-end (needs test keys and plan ids).
- Resend delivery (needs a verified domain).
- Studio image success path (needs Gemini billing).
- Google sign-in (needs OAuth credentials).
