# Error visibility

Production server-side errors are emailed via Resend to the address in
`ALERT_EMAIL`. The integration is fully inert (no network calls, no overhead)
until both `RESEND_API_KEY` and `ALERT_EMAIL` are set in the environment, so
this code can ship without breaking anything.

## What is captured

| Endpoint | Failure mode | Tags attached |
|---|---|---|
| `api/picture.js` | rate-limit DB read fails (503) | `route=picture, stage=rate-limit`, user id |
| `api/picture.js` | Anthropic / Freepik / Supabase write fails (500) | `route=picture, stage=generate`, user id |
| `api/stripe/webhook.js` | signature verification fails (400) | `route=stripe-webhook, stage=signature` |
| `api/stripe/webhook.js` | event handler throws (500, Stripe will retry) | `route=stripe-webhook, stage=handler, event_type`, event id |
| `api/stripe/checkout.js` | session creation fails (500) | `route=stripe-checkout`, user id + email |

The wrapper lives in `lib/alerts.js`. Each alert email contains: timestamp,
Vercel environment, deploy commit SHA, tags, user id, and the full stack
trace. Best-effort delivery — a Resend outage will never break the response
path of the originating request.

### Dedup

In-memory dedup with a 5-minute window per `route|stage|message`. This is
per-function-instance, so a flapping error across many cold-starts can still
produce a few duplicate emails. Acceptable at soft-launch volume; if it
becomes noisy, swap the in-memory `Map` for a Supabase table keyed on the
same fingerprint.

## One-time setup

Already in place: `RESEND_API_KEY` (used by Supabase Auth SMTP). Reuse the
same key here.

1. Vercel → project → **Settings → Environment Variables**, add:
   - **Name:** `ALERT_EMAIL`
   - **Value:** the inbox where you want alerts delivered (e.g. `cd@edenic.co`)
   - **Environments:** Production (and Preview if you want preview-deploy errors too)
2. (Optional) `ALERT_FROM_EMAIL` — defaults to
   `Enlighten Alerts <alerts@enlighten-me.co>`. Only override if you want a
   different sender label.
3. Redeploy (any push to `main`, or hit "Redeploy" in Vercel) so functions
   pick up the new env vars.

To verify, force a real error path: temporarily throw inside one of the catch
blocks, deploy, hit the endpoint, confirm the email arrives, revert.

## Recommended inbox setup

Create a Gmail / Fastmail filter:

- From: `alerts@enlighten-me.co`
- Action: apply label `Enlighten/Alerts`, mark as important, optional push
  notification on subject containing `stripe-webhook` (those are payment-state
  divergences and should page you)

## What is *not* captured

- Frontend / client-side errors — these would need a small `/api/client-error`
  endpoint and a `window.onerror` handler in `script.js`. Not yet wired
- Vercel build / deploy failures — surface in Vercel's dashboard and email
- 4xx user errors (validation, auth, rate-limit hit) — these are working as
  designed, not bugs

## When to consider upgrading to a dedicated tool

Sentry / Highlight / similar are worth the account when you start needing:

- Cross-error grouping ("show me all errors from this Anthropic outage")
- Search / filter UI over an error history (>30 days)
- Source-map-aware frontend stack traces
- On-call rotation, paging, or per-team routing

Until then, inbox + Vercel logs cover the soft-launch ground.
