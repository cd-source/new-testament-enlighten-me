# Stripe + Supabase web subscription setup

Web subscribers go through Supabase magic-link auth, then Stripe Checkout. iOS subscribers continue to use StoreKit (untouched). Both rails issue the same `X-Enlighten-Entitlement` JWT that `api/picture.js` already verifies.

## One-time Stripe dashboard setup

1. Confirm the recurring price exists. (Sandbox: `price_1TUX2VRBMJLfqCVqmRVdSTHf`.)
2. **Developers → Webhooks → Add endpoint**
   - URL: `https://new-testament-enlighten-me.vercel.app/api/stripe/webhook`
   - Events: `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`
3. Reveal the **Signing secret** (`whsec_…`) — that's `STRIPE_WEBHOOK_SECRET`.

## Vercel env vars

Set in Vercel → Project → Settings → Environment Variables (production + preview):

| Variable | Value |
|---|---|
| `SUPABASE_URL` | `https://graxhffoeoheaiwcnnhb.supabase.co` |
| `SUPABASE_ANON_KEY` | (anon `eyJ…` from Supabase API settings) |
| `SUPABASE_SERVICE_ROLE_KEY` | (service-role `eyJ…` — server-only) |
| `STRIPE_SECRET_KEY` | `sk_test_…` (test) or `sk_live_…` (prod) |
| `STRIPE_PUBLISHABLE_KEY` | `pk_test_…` / `pk_live_…` (sent to client via `/api/config`) |
| `STRIPE_PRICE_ID` | `price_1TUX2VRBMJLfqCVqmRVdSTHf` (sandbox) |
| `STRIPE_WEBHOOK_SECRET` | `whsec_…` from the webhook endpoint |
| `ENLIGHTEN_JWT_SECRET` | already set — same secret used by iOS entitlement |
| `ENLIGHTEN_REQUIRE_IMAGE_ENTITLEMENT` | `true` (only flip on once Stripe path is verified end-to-end) |

`SUPABASE_SERVICE_ROLE_KEY` and the Stripe secret/webhook secret must be **server-only** (no `NEXT_PUBLIC_` / Vercel "exposed to browser" flag).

## End-to-end test (sandbox)

1. Open `https://new-testament-enlighten-me.vercel.app/` and go to Settings → Subscription.
2. Enter your email → "Email me a link". Click the link.
3. After sign-in, the panel shows "Signed in as …". Click `Subscribe — $3/month`.
4. Stripe test card: `4242 4242 4242 4242`, any future expiry, any CVC, any ZIP.
5. After redirect, panel polls `/api/web-entitlement` and flips to "AI imagery active". The home view's AI imagery button enables.
6. Generate an image — `/api/picture` should accept the Stripe-issued JWT identically to the iOS one.

## Architecture

- `api/config.js` — public config the browser fetches once on load (Supabase URL + anon, Stripe pk, price id).
- `api/stripe/checkout.js` — verifies the Supabase JWT from `Authorization: Bearer …`, finds-or-creates the Stripe customer, creates a Checkout Session in `mode=subscription`, returns the redirect URL.
- `api/stripe/webhook.js` — raw-body Stripe signature verification, upserts `public.subscriptions` via the service role.
- `api/web-entitlement.js` — verifies the Supabase JWT, reads the user's `subscriptions` row; if active, signs the same `enlighten_ai_images_monthly` JWT that iOS uses.
- `web-subscribe.js` — browser-only (no-ops on Capacitor); loads Supabase from CDN, owns the sign-in form + subscribe button, hydrates `window.EnlightenWeb` for `script.js` to call.

## Rotating keys

- Supabase service role: Settings → API → "Reset service role key" → update Vercel env → redeploy.
- Stripe secret: Developers → API keys → Roll → update Vercel env → redeploy.
- Stripe webhook secret: regenerate by deleting + recreating the webhook endpoint, then update env.
