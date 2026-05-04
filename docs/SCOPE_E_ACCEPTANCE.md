# Scope E Acceptance Checklist

## Completed in Scope E

- [x] Added npm project metadata and Capacitor dependencies.
- [x] Added deterministic web bundle build script for Capacitor.
- [x] Added KJV data validation script.
- [x] Added `capacitor.config.json` for the Enlighten iOS app shell.
- [x] Generated initial `ios/` Capacitor project structure.
- [x] Added visible subscription panel for AI imagery.
- [x] Kept all scripture features free.
- [x] Gated `Picture this Message` behind image subscription state.
- [x] Added browser-preview subscription unlock for UX testing.
- [x] Added native bridge contract for future StoreKit implementation.
- [x] Added optional `/api/picture` entitlement guard placeholder.

## Explicitly not completed yet

- [ ] Apple Developer App ID creation.
- [ ] App Store Connect app record.
- [ ] StoreKit product creation in App Store Connect.
- [ ] Native StoreKit purchase plugin implementation.
- [ ] Server-side Apple transaction verification endpoint.
- [ ] Production entitlement-token issuance.
- [ ] Xcode signing/team configuration.
- [ ] App icons, launch screen, screenshots, and App Store metadata.

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

Paid at $3/month:
- AI-generated imagery only
```
