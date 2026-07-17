const { setCorsHeaders } = require("./_lib/entitlement.js");

const ALLOWED_EVENTS = new Set([
  "web_visit",
  "bible_search",
  "language_selected",
  "share_card_created",
  "share_card_saved",
  "share_card_share_started",
  "personal_image_locked",
  "personal_image_started",
  "personal_image_completed",
  "personal_image_failed",
  "free_image_generated",
  "free_image_wall",
  "subscribe_clicked",
  "subscribe_completed",
  "app_store_clicked",
]);

const STRING_FIELDS = new Set([
  "language",
  "previous_language",
  "selected_language",
  "path",
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "testament",
  "reference",
  "translation",
  "source",
  "tier",
]);

const NUMBER_FIELDS = new Set(["query_length", "result_count"]);
const BOOLEAN_FIELDS = new Set(["fallback"]);

function json(req, res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  setCorsHeaders(req, res);
  res.end(JSON.stringify(body));
}

async function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;

  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (!chunks.length) return {};
  const body = chunks.map((chunk) => (Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
  return JSON.parse(Buffer.concat(body).toString("utf8"));
}

function compactString(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .replace(/[^\w .:/?&=+@|-]/g, "")
    .trim()
    .slice(0, 120);
}

function sanitizeEventData(data) {
  const sanitized = {};
  const source = data && typeof data === "object" ? data : {};

  for (const [key, value] of Object.entries(source)) {
    if (STRING_FIELDS.has(key)) {
      const compacted = compactString(value);
      if (compacted) sanitized[key] = compacted;
    } else if (NUMBER_FIELDS.has(key)) {
      const numberValue = Number(value);
      if (Number.isFinite(numberValue)) sanitized[key] = numberValue;
    } else if (BOOLEAN_FIELDS.has(key)) {
      sanitized[key] = Boolean(value);
    }
  }

  return sanitized;
}

module.exports = async function handler(req, res) {
  if (req.method === "OPTIONS") {
    setCorsHeaders(req, res);
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method !== "POST") {
    json(req, res, 405, { error: "Method not allowed" });
    return;
  }

  try {
    const body = await readBody(req);
    const event = compactString(body?.event);

    if (!ALLOWED_EVENTS.has(event)) {
      json(req, res, 400, { error: "Unsupported event" });
      return;
    }

    const data = sanitizeEventData(body?.data);

    try {
      const { track } = await import("@vercel/analytics/server");
      await track(event, data);
    } catch (error) {
      console.warn("marketing event tracking skipped:", error?.message || error);
    }

    json(req, res, 202, { ok: true });
  } catch (error) {
    console.error("marketing event error:", error);
    json(req, res, 202, { ok: false });
  }
};
