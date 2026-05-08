const RESEND_ENDPOINT = "https://api.resend.com/emails";
const DEDUP_WINDOW_MS = 5 * 60 * 1000;
const recentAlerts = new Map();

function alertKey(error, context) {
  const route = context?.tags?.route || "";
  const stage = context?.tags?.stage || "";
  const message = (error?.message || String(error || "")).slice(0, 120);
  return `${route}|${stage}|${message}`;
}

function alertConfig() {
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.ALERT_EMAIL;
  const from = process.env.ALERT_FROM_EMAIL || "Enlighten Alerts <alerts@enlighten-me.co>";
  if (!apiKey || !to) return null;
  return { apiKey, to, from };
}

function buildBody(error, context) {
  const tagPairs = Object.entries(context?.tags || {}).map(([k, v]) => `${k}=${v}`);
  const lines = [
    `Time: ${new Date().toISOString()}`,
    `Env:  ${process.env.VERCEL_ENV || "development"}`,
    `Sha:  ${(process.env.VERCEL_GIT_COMMIT_SHA || "unknown").slice(0, 7)}`,
  ];
  if (tagPairs.length) lines.push(`Tags: ${tagPairs.join(" | ")}`);
  if (context?.user?.id) lines.push(`User: ${context.user.id}${context.user.email ? ` (${context.user.email})` : ""}`);
  if (context?.extra) lines.push(`Extra: ${JSON.stringify(context.extra)}`);
  lines.push("");
  lines.push(error?.stack || error?.message || String(error));
  return lines.join("\n");
}

async function captureException(error, context = {}) {
  const cfg = alertConfig();
  if (!cfg) return;

  const key = alertKey(error, context);
  const now = Date.now();
  const last = recentAlerts.get(key);
  if (last && now - last < DEDUP_WINDOW_MS) return;
  recentAlerts.set(key, now);

  const subject = `[Enlighten] ${context?.tags?.route || "error"}: ${(error?.message || "unknown").slice(0, 80)}`;

  try {
    await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cfg.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: cfg.from,
        to: [cfg.to],
        subject,
        text: buildBody(error, context),
      }),
    });
  } catch (_deliveryError) {
    // alert delivery must never break the response path
  }
}

async function flush() {
  // No batching — captureException awaits Resend directly. Kept for API parity.
}

module.exports = { captureException, flush };
