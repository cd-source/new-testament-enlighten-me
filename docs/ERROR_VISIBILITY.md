# Error visibility

Production server-side errors are reported to Sentry. Until `SENTRY_DSN` is
set in the environment, the integration is fully inert (no network calls, no
overhead) — code can ship without breaking anything.

## What is captured

| Endpoint | Failure mode | Tags attached |
|---|---|---|
| `api/picture.js` | rate-limit DB read fails (503) | `route=picture, stage=rate-limit`, user id |
| `api/picture.js` | Anthropic / Freepik / Supabase write fails (500) | `route=picture, stage=generate`, user id |
| `api/stripe/webhook.js` | signature verification fails (400) | `route=stripe-webhook, stage=signature` |
| `api/stripe/webhook.js` | event handler throws (500, Stripe will retry) | `route=stripe-webhook, stage=handler, event_type`, event id |
| `api/stripe/checkout.js` | session creation fails (500) | `route=stripe-checkout`, user id + email |

The wrapper lives in `lib/sentry.js`. PII is off (`sendDefaultPii: false`);
user context is limited to the Supabase user id (and email on checkout, which
the user just typed into Stripe anyway).

## One-time setup (≈5 min)

1. Sign up at [sentry.io](https://sentry.io) — free tier covers 5k errors/mo,
   one user, 30-day retention. More than enough for soft launch.
2. Create a new project → platform **Node.js**. Name it `enlighten-me`.
3. Copy the **DSN** Sentry shows you (looks like
   `https://abc123@o123.ingest.sentry.io/456`).
4. Vercel → project → **Settings → Environment Variables**:
   - Name: `SENTRY_DSN`
   - Value: the DSN from step 3
   - Environments: **Production** (and **Preview** if you want preview-deploy
     errors to land in Sentry too)
5. Redeploy (any push to `main`, or hit "Redeploy" in Vercel) so functions
   pick up the new env var.

To verify, force an error: hit `/api/stripe/checkout` without a valid auth
header, or temporarily throw inside one of the catch blocks. The error should
appear in Sentry within a minute.

## Recommended Sentry alert rules

In Sentry → **Alerts → Create Alert Rule**:

- **First-seen error**: notify on a brand-new exception type (catches new bug
  classes immediately)
- **Stripe webhook handler failure**: filter `tags:route:stripe-webhook AND
  tags:stage:handler` → alert on every occurrence (these are payment-state
  divergences and need eyes)
- **Picture-generate spike**: filter `tags:route:picture` → alert if >5 errors
  in 10 minutes (catches Anthropic / Freepik outages or a bad model rollout)

Slack or email destination — your call. For solo ops, email to
`cd@edenic.co` is fine.

## What is *not* captured

- Frontend / client-side errors (no `@sentry/browser` yet — could add later
  if `script.js` or `web-subscribe.js` start producing user-facing breakage
  in the wild)
- Vercel build / deploy failures (those surface in Vercel's own dashboard
  and email)
- 4xx user errors (validation, auth, rate-limit hit) — these are working as
  designed, not bugs
