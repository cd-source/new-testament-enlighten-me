const { setCorsHeaders } = require("../lib/entitlement.js");

module.exports = function handler(req, res) {
  if (req.method === "OPTIONS") {
    setCorsHeaders(req, res);
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method !== "GET") {
    setCorsHeaders(req, res);
    res.statusCode = 405;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ error: "Method not allowed" }));
    return;
  }

  setCorsHeaders(req, res);
  res.statusCode = 200;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=300");
  res.end(
    JSON.stringify({
      supabaseUrl: process.env.SUPABASE_URL || "",
      supabaseAnonKey: process.env.SUPABASE_ANON_KEY || "",
      stripePublishableKey: process.env.STRIPE_PUBLISHABLE_KEY || "",
      stripePriceId: process.env.STRIPE_PRICE_ID || "",
      productId: "enlighten_ai_images_monthly",
      priceLabel: "$3/month",
    })
  );
};
