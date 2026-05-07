const { setCorsHeaders } = require("../../lib/entitlement.js");
const {
  SUBSCRIPTION_PRODUCT_ID,
  getStripe,
  getSupabaseAdmin,
  verifySupabaseUserToken,
} = require("../../lib/supabase-admin.js");

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

function resolveOrigin(req) {
  const origin = req.headers.origin;
  if (typeof origin === "string" && /^https?:\/\//.test(origin)) return origin;
  return "https://new-testament-enlighten-me.vercel.app";
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

  const priceId = process.env.STRIPE_PRICE_ID;
  if (!priceId) {
    return json(req, res, 500, { error: "STRIPE_PRICE_ID is not configured." });
  }

  const user = await verifySupabaseUserToken(req.headers.authorization);
  if (!user) {
    return json(req, res, 401, { error: "Sign in required." });
  }

  try {
    const stripe = getStripe();
    const supabase = getSupabaseAdmin();

    const { data: existing } = await supabase
      .from("subscriptions")
      .select("stripe_customer_id, status")
      .eq("user_id", user.id)
      .maybeSingle();

    let customerId = existing?.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email || undefined,
        metadata: { supabase_user_id: user.id },
      });
      customerId = customer.id;
      await supabase.from("subscriptions").upsert(
        {
          user_id: user.id,
          stripe_customer_id: customerId,
          status: "incomplete",
          product_id: SUBSCRIPTION_PRODUCT_ID,
        },
        { onConflict: "user_id" }
      );
    }

    const body = await readBody(req);
    const origin = (typeof body.origin === "string" && /^https?:\/\//.test(body.origin))
      ? body.origin
      : resolveOrigin(req);

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      client_reference_id: user.id,
      subscription_data: {
        metadata: { supabase_user_id: user.id },
      },
      success_url: `${origin}/?subscribed=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/?subscribe_canceled=true`,
      allow_promotion_codes: true,
    });

    return json(req, res, 200, { url: session.url, sessionId: session.id });
  } catch (error) {
    console.error("checkout error:", error);
    return json(req, res, 500, {
      error: error?.message || "Checkout session creation failed.",
    });
  }
};
