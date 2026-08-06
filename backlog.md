# Backlog

Deferred work — not blocking current scope, pick up later.

## Repo / deploy

- ~~`release/1.2` predates the deploy-root fix~~ — done 2026-08-06: `main` merged into `release/1.2` (5405265) and pushed; branch now has `.vercelignore`, `api/_lib/`, green button, free-first paywall, and art-first. In-progress iOS work was committed first (fcc52ca); the worktree's stale untracked art-first prototype files were backed up to `~/Documents/Gee/cos/release12-untracked-backup-2026-08-06/`.

## Soft-launch pre-flight

- **Cross-provider deliverability check** — in progress 2026-08-06. mail-tester scored the real signup-confirm email **10/10** (SpamAssassin clean, no blocklists, no broken links). DMARC fixed 2026-08-06: Clive used Cloudflare's DMARC Management wizard (not a manual DNS edit) — `_dmarc` now serves `v=DMARC1; p=none; rua=mailto:…@dmarc-reports.cloudflare.net`, so aggregate Yahoo/Microsoft/Gmail reports land in Cloudflare's Email Security → DMARC Management dashboard (charts, not raw XML to help@). Verified live via dig. Still open: iCloud inbox-placement spot check via Clive's address. Note: signup test created an unconfirmed Supabase user `test-99b2whhbz@srv1.mail-tester.com` — harmless, can be deleted from Supabase Auth.

## Web UI / UX

- **Search panel filtering** — needs filters (e.g. by book) so results narrow instead of one flat list. Design call needed.

## Localization

- **Spanish (es) translation** — toggle on home screen + persist to localStorage. Extract user-facing strings to a locale-keyed JSON dictionary, route through a `t(key)` helper in `script.js` / `web-subscribe.js`. iOS ships the same bundle; add `es` to supported languages in Xcode + Spanish App Store Connect listing. Localize Stripe Checkout via `locale` param.

## iOS

- **UX / UI polish pass** — driven by TestFlight internal-tester feedback (v1.1 build 2 live on TestFlight; testers added 2026-05-11).
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
- **Ads test LIVE 2026-08-06** — `EM_WEB_GS_ARTFIRST` (Search, US/EN, $15/day, id 24111391619) enabled via the Ads API, pending Google ad review. Read-out: `~/Documents/Gee/cos/ga4-report/art_first_funnel.py --sources`; baseline to beat is 11.8% press rate.
- **Decide the promotion path** — once the test reads out: make /art-first the default landing on `/` (and/or keep it the ads destination), then import the GA4 conversion into Google Ads.
- **iOS follow-up** — port the art-first flow into the Capacitor app and submit an update once web numbers validate it (per Clive, web first).
- **Deck refresh** — `node scripts/generate-art-first-deck.js` regenerates the 8 curated backgrounds through the prod pipeline (needs fresh `.env.local` via `vercel env pull`; images then need `sips --resampleWidth 1400`). Consider rotating/expanding the deck later.
