const {
  PRODUCT_ID,
  SERVER_TOKEN_TTL_SECONDS,
  setCorsHeaders,
  verifyAppleJws,
  issueServerToken,
} = require("../lib/entitlement.js");

function json(req, res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  setCorsHeaders(req, res);
  res.end(JSON.stringify(body));
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch (_error) {
    return {};
  }
}

module.exports = async function handler(req, res) {
  if (req.method === "OPTIONS") {
    setCorsHeaders(req, res);
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method !== "POST") {
    return json(req, res, 405, { error: "Method not allowed" });
  }

  const body = await readBody(req);
  const jws = typeof body.jws === "string" ? body.jws : "";
  const productId = typeof body.productId === "string" ? body.productId : PRODUCT_ID;

  if (!jws) {
    return json(req, res, 400, { error: "Missing jws." });
  }

  const verification = await verifyAppleJws(jws, productId);
  if (!verification.valid) {
    return json(req, res, 401, { error: `Invalid transaction: ${verification.reason}` });
  }

  try {
    const claims = verification.claims;
    const token = issueServerToken({
      productId: claims.productId,
      userId: claims.originalTransactionId,
      source: "ios",
      originalTransactionId: claims.originalTransactionId,
      expiresDate: claims.expiresDate,
    });
    const expiresAt = Math.floor(Date.now() / 1000) + SERVER_TOKEN_TTL_SECONDS;
    return json(req, res, 200, {
      entitlementToken: token,
      productId: claims.productId,
      expiresAt,
    });
  } catch (error) {
    console.error(error);
    return json(req, res, 500, { error: error?.message || "Token issue failed." });
  }
};
