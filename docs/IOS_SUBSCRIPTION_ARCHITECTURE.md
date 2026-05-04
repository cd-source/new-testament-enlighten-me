# Enlighten iOS + Subscription Architecture

Scope E establishes the iOS wrapper foundation and the subscription boundary for Enlighten.

## Product rule

All scripture access is free.

Free features:

- Random curated KJV passage from `data/kjv/passages.json`
- Search across all `31,102` local KJV verses
- Browse `Book → Chapter → Verse`
- Copy passage
- Share text
- Make, download, and share branded scripture cards

Paid feature:

- AI-generated scripture imagery from `Picture this Message`

Subscription:

```txt
Product ID: enlighten_ai_images_monthly
Price:      $3/month
Unlocks:    AI image generation only
Does not gate: KJV text, search, browse, copy, text share, or share cards
```

## Local scripture architecture

```txt
data/kjv/books.json      canonical book metadata
data/kjv/verses.json     full local KJV source of truth
data/kjv/passages.json   curated passage index, references verse IDs only
data/kjv/themes.json     theme metadata
```

`script.js` resolves visible scripture by looking up `passage.verse_ids` in `verses.json`. No scripture text should be hardcoded in `script.js`.

## Capacitor architecture

Capacitor is configured with:

```txt
appId:   com.enlighten.daily
appName: Enlighten
webDir:  dist
```

The native bundle is generated from source with:

```bash
npm run build
npx cap copy ios
```

`dist/` is generated and ignored. `ios/App/App/public` is also generated and ignored by Capacitor's iOS `.gitignore`.

## Current machine note

`npx cap sync ios` currently reaches native dependency installation and then fails because this Mac is pointed at Command Line Tools, not full Xcode:

```txt
xcode-select: error: tool 'xcodebuild' requires Xcode, but active developer directory '/Library/Developer/CommandLineTools' is a command line tools instance
```

Final native sync/open requires full Xcode selected:

```bash
sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
npm run cap:sync
npm run cap:open
```

## Subscription bridge contract

The web app now expects an optional native bridge at:

```js
window.EnlightenSubscriptions
```

Expected methods:

```js
getStatus({ productId })
purchase({ productId })
restorePurchases({ productId })
```

Expected return shape:

```js
{
  isActive: true,
  productId: "enlighten_ai_images_monthly",
  entitlementToken: "short-lived-server-token"
}
```

Until the native StoreKit bridge exists, the browser preview uses a local preview unlock in `localStorage`. That is only a development stand-in so the UX can be tested before the StoreKit plugin is implemented.

## Server-side entitlement path

`api/picture.js` now has an optional entitlement check:

```txt
ENLIGHTEN_REQUIRE_IMAGE_ENTITLEMENT=true
```

When enabled, `/api/picture` expects:

```txt
X-Enlighten-Product: enlighten_ai_images_monthly
X-Enlighten-Entitlement: <short-lived entitlement token>
```

Scope E does not yet implement receipt verification. The intended production path is:

1. iOS StoreKit purchase returns a signed transaction.
2. Native bridge sends the transaction to an entitlement endpoint.
3. Server verifies the transaction with Apple.
4. Server returns a short-lived entitlement token.
5. `/api/picture` accepts image-generation requests only with a valid entitlement token.

## Product invariant

Do not gate scripture.

## Acceptance rules

Before App Store work, these must remain true:

- Free scripture features work without subscription.
- The AI imagery button prompts for subscription when entitlement is inactive.
- The AI imagery button generates only when entitlement is active.
- Share-card rendering remains local/free and does not call paid APIs.
- `npm run validate` passes.
- `npx cap copy ios` succeeds.
- `npx cap sync ios` succeeds after full Xcode is selected.
