# Backlog

Deferred work — not blocking current scope, pick up later.

## Soft-launch pre-flight

- **Cross-provider deliverability check** — Resend SMTP is live, verified end-to-end with one address. Send signup-confirm + password-reset to gmail / icloud / outlook / yahoo before public launch; confirm none spam-flag. DKIM is in place; if any provider flags, add DMARC (`v=DMARC1; p=none;` at `_dmarc`).

## Web UI / UX

- **Search panel filtering** — needs filters (e.g. by book) so results narrow instead of one flat list. Design call needed.

## 1.2 Spanish release scope

- **Spanish (Mexico) localization + scripture licensing** — Spanish ships as the `1.2` release line, not `1.1`. Do not default to RV1909 for market fit. Product-preferred path is to license a modern Spanish translation for the Mexican market, likely RVR1960 for evangelical familiarity or NVI/NTV for more contemporary readability. RV1909 remains only the no-license/public-domain fallback. Keep the language architecture translation-agnostic: toggle on home/settings + persist to localStorage, locale-keyed JSON via `t(key)` in `script.js` / `web-subscribe.js`, dynamic scripture corpus loading, iOS `es-MX` support, Spanish App Store Connect listing, and Stripe Checkout `locale`.
- **Spanish visual QA + copy pass** — test `es-MX` in browser and iOS before archive. Current smoke test passes for language switch, RV1909 loading, settings copy, search, localized subscription price, Spanish legal links, and Spanish settings teaser assets. Still do a real browser/iOS visual QA pass and live subscription checkout after deployment.

## Product variants

- **Jewish Community edition** — reskin the app for Jewish community use and replace KJV with an appropriate Jewish source/corpus. Requires source/licensing decision, terminology review, visual identity pass, legal copy update, and store-positioning review.

## iOS

- **UX / UI polish pass** — driven by TestFlight internal-tester feedback (v1.1 build 2 live on TestFlight; testers added 2026-05-11). Roll known tester fixes into `1.2` with Spanish unless an urgent `1.1.x` patch is needed.
- **App Store listing** — copy, screenshots, keywords, privacy nutrition labels. Screenshots come last, after polish settles.

## TestFlight tester feedback for 1.2

Keep this list visible at the start of each project session and work through it progressively between larger tasks. App Store Connect currently shows no TestFlight screenshot feedback submissions and no crash feedback submissions, so this list is the canonical captured set for now.

- **Image prompt diversity** — implemented for `1.2` in `api/picture.js`: prompts now require historically plausible ancient Near Eastern, Levantine, North African, Mediterranean, and Ethiopian representation, avoid defaulting to white European faces, and vary gender/age/ethnicity when the verse does not specify them.
- **iOS share destination** — iOS card sharing currently includes the generated card plus a second website link preview. Once the App Store URL exists, decide whether native iOS shares should use the App Store/download URL, a website download landing page, or no companion link.
