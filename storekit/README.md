# StoreKit setup

## Local-first config (current)

Scope F ships a local StoreKit configuration:

```txt
ios/App/Enlighten.storekit
```

Product:

```txt
Reference name:  Enlighten AI Imagery Monthly
Product ID:      enlighten_ai_images_monthly
Type:            Auto-Renewable Subscription
Price:           USD 2.99 / month
Group:           Enlighten AI Imagery
```

This config is only used by Xcode's local StoreKit testing. It does not create anything on Apple's servers, does not require App Store Connect, and does not require a paid Apple Developer account.

To use it:

1. Run `npm run cap:open` to open the Capacitor iOS workspace in Xcode.
2. **Edit Scheme → Run → Options → StoreKit Configuration → Enlighten.storekit**.
3. Build and run on the simulator (iOS 15+) or a device.

The native plugin in `ios/App/App/EnlightenSubscriptionsPlugin.swift` uses StoreKit 2 to:

- list and purchase the product,
- read entitlements via `Transaction.currentEntitlements`,
- restore via `AppStore.sync()`.

## App Store Connect product (later)

When the app is ready for TestFlight or production, create a matching product in App Store Connect with the same product ID:

```txt
Reference name:  Enlighten AI Imagery Monthly
Product ID:      enlighten_ai_images_monthly
Type:            Auto-Renewable Subscription
Price:           USD 2.99 / month
Group:           Enlighten AI Imagery
```

App copy must describe the paid tier as AI imagery only. Do not imply that Bible text, KJV search, browse, copy, text sharing, or share cards require payment.

No code change is required when switching from local config to App Store Connect; the plugin uses whichever store the build is configured against.

## Bridge contract

See `docs/IOS_SUBSCRIPTION_ARCHITECTURE.md` for the JS contract and entitlement flow.
