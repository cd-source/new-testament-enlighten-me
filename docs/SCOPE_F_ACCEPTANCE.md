# Scope F Acceptance Checklist

Scope F: native StoreKit 2 + local-first testability in Xcode (no App Store Connect required).

## Completed in Scope F

- [x] Bumped iOS deployment target to 15.0 (Podfile + pbxproj) so StoreKit 2 is available.
- [x] Added local StoreKit configuration at `ios/App/Enlighten.storekit` for `enlighten_ai_images_monthly`.
- [x] Added native Swift plugin at `ios/App/App/EnlightenSubscriptionsPlugin.swift` using StoreKit 2.
- [x] Added Capacitor plugin registration at `ios/App/App/EnlightenSubscriptionsPlugin.m` exposing the plugin to the web bridge as `EnlightenSubscriptions`.
- [x] Patched `App.xcodeproj` to compile the new Swift and Objective-C sources in the App target.
- [x] Added a JS bridge alias in `script.js` so `window.EnlightenSubscriptions` resolves to the Capacitor plugin when running on iOS.
- [x] Updated `docs/IOS_SUBSCRIPTION_ARCHITECTURE.md` and `storekit/README.md` to document the local-first flow.

## Explicitly not completed yet

- [ ] App Store Connect app record.
- [ ] App Store Connect product creation.
- [ ] Server-side Apple transaction verification endpoint.
- [ ] Production entitlement-token issuance.
- [ ] Xcode signing/team configuration (auto-signing only is fine for simulator).
- [ ] App icons, launch screen, screenshots, App Store metadata.
- [ ] Privacy policy and Terms required by App Store review.

## Local validation steps

These do not require App Store Connect:

```bash
npm run validate
sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
npm run cap:sync
npm run cap:open
```

Then in Xcode:

1. Open the App scheme settings.
2. Run → Options → StoreKit Configuration → Enlighten.storekit.
3. Build and run on a simulator or device with iOS 15 or later.
4. In the app, tap `Subscribe — $3/month`.
5. The StoreKit local sheet should display Enlighten AI Imagery (Monthly) at $2.99.
6. Confirm purchase. The button should switch to the unlocked state and the AI imagery feature should become available.
7. Use Xcode's Debug → StoreKit → Manage Transactions to expire, refund, or revoke; the UI should react on next status check.

## Product invariant

Do not gate scripture.

```txt
Free forever:
- KJV corpus
- random curated passages
- search
- browse
- copy
- text share
- branded share cards

Paid (subscription):
- AI imagery only
```
