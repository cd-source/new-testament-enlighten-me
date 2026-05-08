# Backlog

Deferred work — not blocking current scope, pick up later.

## Soft-launch pre-flight (Stripe / compliance)

- **Configure custom SMTP via Resend** — REQUIRED for launch. Default Supabase SMTP is capped at ~2 auth emails per hour project-wide (signup + reset + magic link share one bucket). Confirmed in testing: second signup attempt within the hour returns "email rate limit exceeded" and no email is sent. Setup: Resend account → add `enlighten-me.co` sending domain → add SPF + DKIM + DMARC records to Cloudflare → verify in Resend → generate API key → Supabase Auth → Emails → Enable custom SMTP. Re-test across gmail / icloud / outlook after.
- **Error visibility on prod** — at minimum a Vercel log watch routine, ideally Sentry on `/api/picture` and `/api/stripe/*` so silent failures surface

## Web UI / UX

- **Settings page polish** — conflicting colors/weights on email addresses and sign-out notifications; spacing inconsistent
- **Search panel filtering** — needs better filters (e.g. by book) so results are narrowable instead of one flat list
- **Home page top-verse pool expansion** — `data/kjv/passages.json` only has 20 entries. Distribution algorithm now uses shuffle-deck rotation (no repeat until all 20 shown), but the long-tail repetition is unsolvable without more content. Author additional passages following the existing schema (themes, tone, visual_motifs, familiarity, weight, etc.) to grow the pool to 50–100+.
- **App URL on share cards (web)** — when sharing a verse card, include the enlighten-me.co URL so recipients can find/download the app

## Localization

- **Spanish (es) translation** — toggle on the home screen + persist preference to localStorage. Web: extract user-facing strings to a JSON dictionary keyed by locale and route through a tiny `t(key)` helper in `script.js` / `web-subscribe.js`. iOS: same web bundle ships in one binary; add `es` to supported languages in Xcode and provide a Spanish App Store Connect listing (description, screenshots, keywords). Server-side: localize Stripe Checkout via `locale` param and any backend-rendered messages.

## iOS

- **App URL on share cards (iOS)** — same as web, on the iOS share path
- **App Store listing page** — copy, screenshots, keywords, privacy nutrition labels
- **UX / UI polish pass**
- **TestFlight build** — internal testing rollout
