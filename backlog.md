# Backlog

Deferred work — not blocking current scope, pick up later.

## Copy / UX

- **Drop "AI" from imagery copy.** User-facing strings like "AI imagery active", "AI scripture imagery", "Unlock AI Imagery", "AI scripture-inspired imagery" become the "AI"-less versions ("Imagery active", "Scripture imagery", "Unlock Imagery", etc.). Keep "AI" in code-only identifiers (e.g. product id `enlighten_ai_images_monthly`, anchor names) — copy only. Touches `index.html`, `script.js`, the iOS Settings/Subscription strings, and any server-issued status messages.

## Infrastructure

- **Domain migration to `www.enlighten-me.co`.** User acquired the domain 2026-05-07; not live yet. Trigger when DNS resolves. Touchpoints:
  - `lib/entitlement.js` — add `https://www.enlighten-me.co` + `https://enlighten-me.co` to `ALLOWED_ORIGINS` (and remove the stale `.com` entries if those aren't ours).
  - `script.js` — `REMOTE_API_BASE` constant (currently `https://new-testament-enlighten-me.vercel.app`) used by iOS to call the API; swap once Vercel domain is mapped.
  - **Vercel** — add custom domain to the project, point DNS, set primary.
  - **Supabase Auth → URL Configuration** — update Site URL + Redirect allow-list to the new domain.
  - **Stripe** — update webhook endpoint URL; update success/cancel URLs (currently derived from request `Origin` so they auto-follow, but verify after switch).
  - **iOS app** — `Info.plist` Universal Links / Associated Domains if/when those get added; Capacitor `server` config if it references the host.
  - Decide canonical (apex `enlighten-me.co` vs `www`) and 301 the other.
