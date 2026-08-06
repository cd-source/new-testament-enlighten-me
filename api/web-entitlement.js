const {
  PRODUCT_ID,
  SERVER_TOKEN_TTL_SECONDS,
  setCorsHeaders,
  issueServerToken,
} = require("./_lib/entitlement.js");
const {
  getSupabaseAdmin,
  verifySupabaseUserToken,
} = require("./_lib/supabase-admin.js");

function json(req, res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  setCorsHeaders(req, res);
  res.end(JSON.stringify(body));
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

  const user = await verifySupabaseUserToken(req.headers.authorization);
  if (!user) {
    return json(req, res, 401, { error: "Sign in required." });
  }

  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("subscriptions")
      .select(
        "status, current_period_end, stripe_subscription_id, cancel_at_period_end"
      )
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) {
      return json(req, res, 500, { error: error.message });
    }

    const periodEndMs = data?.current_period_end
      ? new Date(data.current_period_end).getTime()
      : 0;
    const active =
      data &&
      ["active", "trialing"].includes(data.status) &&
      periodEndMs > Date.now();

    if (!active) {
      return json(req, res, 200, {
        active: false,
        status: data?.status || "none",
        currentPeriodEnd: data?.current_period_end || null,
      });
    }

    const token = issueServerToken({
      productId: PRODUCT_ID,
      userId: user.id,
      source: "web",
      originalTransactionId: data.stripe_subscription_id || null,
      expiresDate: periodEndMs,
    });
    const expiresAt = Math.floor(Date.now() / 1000) + SERVER_TOKEN_TTL_SECONDS;

    return json(req, res, 200, {
      active: true,
      isActive: true,
      entitlementToken: token,
      productId: PRODUCT_ID,
      expiresAt,
      status: data.status,
      currentPeriodEnd: data.current_period_end,
      cancelAtPeriodEnd: Boolean(data.cancel_at_period_end),
    });
  } catch (error) {
    console.error("web-entitlement error:", error);
    return json(req, res, 500, {
      error: error?.message || "Entitlement issue failed.",
    });
  }
};
