# Backlog

Deferred work — not blocking current scope, pick up later.

## Repo / deploy

- **`release/1.2` predates the deploy-root fix** — it still has `lib/` at the repo root and no `.vercelignore`, so its previews still serve internal files (SSO-protected and noindex, so not urgent). Merging `main` in resolves both; the rename applies cleanly because the branch never touched `lib/` or `api/`. Its untracked local `api/marketing-event.js` still requires `../lib/entitlement.js` and would need repointing at `./_lib/` — `main`'s committed copy is already correct.

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

### TestFlight tester feedback backlog

Items received from internal testers; worked through progressively alongside other tasks.

| # | Item | Status | Notes |
|---|------|--------|-------|
| 1 | Image prompt diversity — biblical cards skewed white/male; add ethnic diversity + women when verse does not specify sex | ✅ Done 2026-05-19 | `api/picture.js:90-91` — system prompt enforces Semitic/African/Mediterranean complexions and sex inclusivity |
| 2 | iOS share destination — share sheet targets unclear/broken | 🔍 Analysis done — needs device test | See notes below |

**Item #2 code analysis (2026-05-19):**

Share is implemented via `ImageSharePlugin.swift` (custom Capacitor plugin). The share path:
1. JS calls `Plugins.ImageShare.shareImage({ base64, dialogTitle, text: SHARE_URL })`
2. Swift builds `activityItems = [ImageActivityItem(image), URL("https://www.enlighten-me.co")]`
3. Presents `UIActivityViewController`

The image+URL combination was intentional (commit 80b4194) — iMessage unfurls the URL into a rich link preview alongside the image. The card no longer has a footer URL (removed in 6139ed9), so the URL in the share text is still needed.

**Possible causes of "targets unclear/broken":**

- **Mixed item types expand the share sheet** — `UIActivityViewController` with both image and URL shows destinations for *both* types. URL-only apps (Notes, Freeform, Copy Link, etc.) appear alongside image apps, which may confuse users expecting only image destinations.
- **Some apps receive the URL instead of the image** — if a destination only handles one item type and picks the URL over the image, the share silently sends just a link.
- **Share sheet not opening** — `ImageSharePlugin.swift:57` rejects if `viewController.presentedViewController != nil`. If a subscription modal is open when share is tapped, it silently fails and shows "Share image failed."

**Device test matrix needed:**
1. Tap "Share" on a finished card → does the share sheet open?
2. Share to **iMessage** → does recipient see image + link preview (not just URL)?
3. Share to **Save to Photos** → does image save correctly?
4. Share to **Instagram Stories** → does the image appear?
5. Try sharing while the subscription modal is open → does it fail gracefully?

**If mixed-type share sheet is the issue:** remove the URL from `activityItems` (pass empty `text` to `shareImage`) and instead re-add the URL to the card image footer. The card canvas already had a footer (removed in 6139ed9) — restoring it would achieve the same discoverability without polluting the share sheet.

## Art-first landing flow (/art-first) — live 2026-08-05
- **Decide the promotion path** — /art-first is a standalone noindex page. Once web efficacy looks good: point resumed Google Ads traffic at it, and/or make it the default landing experience on `/`.
- **iOS follow-up** — port the art-first flow into the Capacitor app and submit an update once web numbers validate it (per Clive, web first).
- **Deck refresh** — `node scripts/generate-art-first-deck.js` regenerates the 8 curated backgrounds through the prod pipeline (needs fresh `.env.local` via `vercel env pull`; images then need `sips --resampleWidth 1400`). Consider rotating/expanding the deck later.
