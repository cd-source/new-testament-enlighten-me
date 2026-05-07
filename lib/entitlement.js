const jwt = require("jsonwebtoken");

const PRODUCT_ID = "enlighten_ai_images_monthly";
const APPLE_BUNDLE_ID = process.env.APPLE_BUNDLE_ID || "com.enlighten.daily";
const JWT_SECRET = process.env.ENLIGHTEN_JWT_SECRET || "";
const VERIFY_MODE = (process.env.APPLE_JWS_VERIFY_MODE || "lax").toLowerCase();
const SERVER_TOKEN_TTL_SECONDS = 24 * 60 * 60;

const ALLOWED_ORIGINS = new Set([
  "enlighten://localhost",
  "capacitor://localhost",
  "https://enlighten-me.com",
  "https://www.enlighten-me.com",
  "https://new-testament-enlighten-me.vercel.app",
  "http://localhost:3000",
  "http://localhost:5173",
  "http://127.0.0.1:3000",
]);

function setCorsHeaders(req, res) {
  const origin = req.headers.origin || "";
  const allow = ALLOWED_ORIGINS.has(origin) ? origin : "enlighten://localhost";
  res.setHeader("Access-Control-Allow-Origin", allow);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, X-Enlighten-Product, X-Enlighten-Entitlement"
  );
  res.setHeader("Access-Control-Max-Age", "86400");
}

function decodeJwsPayload(jws) {
  if (typeof jws !== "string") return null;
  const parts = jws.split(".");
  if (parts.length !== 3) return null;
  try {
    const json = Buffer.from(parts[1], "base64url").toString("utf8");
    return JSON.parse(json);
  } catch (_error) {
    return null;
  }
}

function validateJwsClaims(claims, expectedProductId) {
  if (!claims || typeof claims !== "object") {
    return { valid: false, reason: "missing claims" };
  }
  if (claims.bundleId !== APPLE_BUNDLE_ID) {
    return { valid: false, reason: `bundleId mismatch: ${claims.bundleId}` };
  }
  if (claims.productId !== expectedProductId) {
    return { valid: false, reason: `productId mismatch: ${claims.productId}` };
  }
  if (typeof claims.expiresDate === "number" && claims.expiresDate < Date.now()) {
    return { valid: false, reason: "transaction expired" };
  }
  if (claims.revocationDate) {
    return { valid: false, reason: "transaction revoked" };
  }
  return { valid: true, claims };
}

async function verifyJwsCryptographically(_jws) {
  // Layer 2: validate the cert chain back to Apple's root CA and check the ES256 signature.
  // Wired through APPLE_JWS_VERIFY_MODE=strict; populate before TestFlight when transactions
  // are real Apple-signed (Xcode local config uses test certs and would fail strict checks).
  return { valid: false, reason: "strict mode not yet implemented" };
}

async function verifyAppleJws(jws, expectedProductId) {
  const claims = decodeJwsPayload(jws);
  const structural = validateJwsClaims(claims, expectedProductId);
  if (!structural.valid) return structural;

  if (VERIFY_MODE === "strict") {
    const crypto = await verifyJwsCryptographically(jws);
    if (!crypto.valid) return crypto;
  }

  return { valid: true, claims };
}

function issueServerToken({ productId, originalTransactionId, expiresDate }) {
  if (!JWT_SECRET) {
    throw new Error("ENLIGHTEN_JWT_SECRET is not configured.");
  }
  const now = Math.floor(Date.now() / 1000);
  const cap = now + SERVER_TOKEN_TTL_SECONDS;
  const exp = expiresDate
    ? Math.min(Math.floor(expiresDate / 1000), cap)
    : cap;
  return jwt.sign(
    { product: productId, otid: originalTransactionId || null, exp },
    JWT_SECRET,
    { algorithm: "HS256" }
  );
}

function verifyServerToken(token, expectedProductId) {
  if (!JWT_SECRET || typeof token !== "string" || !token) return null;
  try {
    const decoded = jwt.verify(token, JWT_SECRET, { algorithms: ["HS256"] });
    if (decoded.product !== expectedProductId) return null;
    return decoded;
  } catch (_error) {
    return null;
  }
}

module.exports = {
  PRODUCT_ID,
  SERVER_TOKEN_TTL_SECONDS,
  setCorsHeaders,
  verifyAppleJws,
  issueServerToken,
  verifyServerToken,
};
