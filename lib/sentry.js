const Sentry = require("@sentry/node");

let initialized = false;

function ensureInit() {
  if (initialized) return;
  initialized = true;
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;
  Sentry.init({
    dsn,
    environment: process.env.VERCEL_ENV || "development",
    release: process.env.VERCEL_GIT_COMMIT_SHA || undefined,
    tracesSampleRate: 0,
    sendDefaultPii: false,
  });
}

function captureException(error, context = {}) {
  ensureInit();
  if (!process.env.SENTRY_DSN) return;
  Sentry.withScope((scope) => {
    if (context.tags) scope.setTags(context.tags);
    if (context.extra) scope.setExtras(context.extra);
    if (context.user) scope.setUser(context.user);
    Sentry.captureException(error);
  });
}

async function flush(timeoutMs = 2000) {
  if (!process.env.SENTRY_DSN) return;
  try {
    await Sentry.flush(timeoutMs);
  } catch (_error) {
    // best-effort flush; never let Sentry break the response
  }
}

module.exports = { captureException, flush };
