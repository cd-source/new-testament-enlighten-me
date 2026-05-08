# Backlog

Deferred work — not blocking current scope, pick up later.

## Soft-launch pre-flight (Stripe / compliance)

- **`help@enlighten-me.co` mailbox deliverability** — send a test from another account, confirm it routes to `cd@edenic.co` via Cloudflare Email Routing
- **Email deliverability for Supabase auth signup** — send signup-confirmation test to gmail / icloud / outlook to make sure they don't land in spam
- **Capacitor App Store guard verification** — confirm `web-subscribe.js` actually no-ops on iOS so Apple doesn't reject the build for routing payments outside StoreKit
- **Error visibility on prod** — at minimum a Vercel log watch routine, ideally Sentry on `/api/picture` and `/api/stripe/*` so silent failures surface

## Documentation

- Update `docs/STRIPE_SUBSCRIPTION_SETUP.md` — replace magic-link copy with current Google + email-password flow (`web-subscribe.js:131-198`)

## Web UI / UX

- **Settings page polish** — conflicting colors/weights on email addresses and sign-out notifications; spacing inconsistent
- **Search panel filtering** — needs better filters (e.g. by book) so results are narrowable instead of one flat list
- **Home page top-verse rotation** — increase the size of the "top verses" pool and improve the random-pick distribution; current rotation feels repetitive
- **App URL on share cards (web)** — when sharing a verse card, include the enlighten-me.co URL so recipients can find/download the app
- **Link-preview thumbnail (Open Graph / Twitter Card meta tags)** — when the site URL is texted/shared, the preview should show an Enlighten image instead of a blank/default. Add `og:image`, `og:title`, `og:description`, `twitter:card` meta tags pointing at a hosted thumbnail

## Localization

- **Spanish (es) translation** — toggle on the home screen + persist preference to localStorage. Web: extract user-facing strings to a JSON dictionary keyed by locale and route through a tiny `t(key)` helper in `script.js` / `web-subscribe.js`. iOS: same web bundle ships in one binary; add `es` to supported languages in Xcode and provide a Spanish App Store Connect listing (description, screenshots, keywords). Server-side: localize Stripe Checkout via `locale` param and any backend-rendered messages.

## iOS

- **App URL on share cards (iOS)** — same as web, on the iOS share path
- **App Store listing page** — copy, screenshots, keywords, privacy nutrition labels
- **UX / UI polish pass**
- **TestFlight build** — internal testing rollout
