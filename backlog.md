# Backlog

Deferred work — not blocking current scope, pick up later.

## Soft-launch pre-flight (Stripe / compliance)

- **Privacy + Terms pages at stable URLs** — Stripe Live mode requires policy URLs that don't 404; link from app footer
- **Refund policy page** — required by card networks; surfaced on Stripe Checkout
- **`help@enlighten-me.co` mailbox deliverability** — send a test from another account, confirm it routes to `cd@edenic.co` via Cloudflare Email Routing
- **Email deliverability for Supabase auth signup** — send signup-confirmation test to gmail / icloud / outlook to make sure they don't land in spam
- **Capacitor App Store guard verification** — confirm `web-subscribe.js` actually no-ops on iOS so Apple doesn't reject the build for routing payments outside StoreKit
- **Rate-limit `/api/picture`** — at $3/mo unlimited, a single subscriber could spam generations and burn Anthropic+Freepik budget; add per-user / per-IP cap
- **Error visibility on prod** — at minimum a Vercel log watch routine, ideally Sentry on `/api/picture` and `/api/stripe/*` so silent failures surface

## Documentation

- Update `docs/STRIPE_SUBSCRIPTION_SETUP.md` — replace magic-link copy with current Google + email-password flow (`web-subscribe.js:131-198`)

## Web UI / UX

- **Settings page polish** — conflicting colors/weights on email addresses and sign-out notifications; spacing inconsistent
- **Search panel filtering** — needs better filters (e.g. by book) so results are narrowable instead of one flat list
- **App URL on share cards (web)** — when sharing a verse card, include the enlighten-me.co URL so recipients can find/download the app
- **Link-preview thumbnail (Open Graph / Twitter Card meta tags)** — when the site URL is texted/shared, the preview should show an Enlighten image instead of a blank/default. Add `og:image`, `og:title`, `og:description`, `twitter:card` meta tags pointing at a hosted thumbnail

## iOS

- **App URL on share cards (iOS)** — same as web, on the iOS share path
- **App Store listing page** — copy, screenshots, keywords, privacy nutrition labels
- **UX / UI polish pass**
- **TestFlight build** — internal testing rollout
