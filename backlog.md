# Backlog

Deferred work — not blocking current scope, pick up later.

## Infrastructure

- **Domain migration to `www.enlighten-me.co`.** User acquired the domain 2026-05-07; not live yet. Trigger when DNS resolves. Touchpoints:
  - `lib/entitlement.js` — add `https://www.enlighten-me.co` + `https://enlighten-me.co` to `ALLOWED_ORIGINS` (and remove the stale `.com` entries if those aren't ours).
  - `script.js` — `REMOTE_API_BASE` constant (currently `https://new-testament-enlighten-me.vercel.app`) used by iOS to call the API; swap once Vercel domain is mapped.
  - **Vercel** — add custom domain to the project, point DNS, set primary.
  - **Supabase Auth → URL Configuration** — update Site URL + Redirect allow-list to the new domain.
  - **Stripe** — update webhook endpoint URL; update success/cancel URLs (currently derived from request `Origin` so they auto-follow, but verify after switch).
  - **iOS app** — `Info.plist` Universal Links / Associated Domains if/when those get added; Capacitor `server` config if it references the host.
  - Decide canonical (apex `enlighten-me.co` vs `www`) and 301 the other.
