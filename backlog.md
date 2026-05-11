# Backlog

Deferred work — not blocking current scope, pick up later.

## Soft-launch pre-flight

- **Cross-provider deliverability check** — Resend SMTP is live, verified end-to-end with one address. Send signup-confirm + password-reset to gmail / icloud / outlook / yahoo before public launch; confirm none spam-flag. DKIM is in place; if any provider flags, add DMARC (`v=DMARC1; p=none;` at `_dmarc`).

## Web UI / UX

- **Search panel filtering** — needs filters (e.g. by book) so results narrow instead of one flat list. Design call needed.

## Localization

- **Spanish (es) translation** — toggle on home screen + persist to localStorage. Extract user-facing strings to a locale-keyed JSON dictionary, route through a `t(key)` helper in `script.js` / `web-subscribe.js`. iOS ships the same bundle; add `es` to supported languages in Xcode + Spanish App Store Connect listing. Localize Stripe Checkout via `locale` param.

## iOS

- **App Store listing** — copy, screenshots, keywords, privacy nutrition labels
- **UX / UI polish pass**
- **TestFlight build** — internal testing rollout
