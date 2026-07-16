const { createClient } = require("@supabase/supabase-js");
const Stripe = require("stripe");

let cachedAdmin = null;
let cachedStripe = null;

function getSupabaseAdmin() {
  if (cachedAdmin) return cachedAdmin;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.");
  }
  cachedAdmin = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return cachedAdmin;
}

function getStripe() {
  if (cachedStripe) return cachedStripe;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY must be set.");
  cachedStripe = new Stripe(key);
  return cachedStripe;
}

function bearerToken(authorizationHeader) {
  if (typeof authorizationHeader !== "string") return "";
  const match = authorizationHeader.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : "";
}

async function verifySupabaseUserToken(authorizationHeader) {
  const token = bearerToken(authorizationHeader);
  if (!token) return null;
  const admin = getSupabaseAdmin();
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data?.user) return null;
  return { id: data.user.id, email: data.user.email || "" };
}

function extractCurrentPeriodEnd(subscription) {
  if (typeof subscription?.current_period_end === "number") {
    return subscription.current_period_end;
  }
  const item = subscription?.items?.data?.[0];
  if (item && typeof item.current_period_end === "number") {
    return item.current_period_end;
  }
  return null;
}

const SUBSCRIPTION_PRODUCT_ID = "enlighten_ai_images_monthly";

async function countRecentImageGenerations(userId, sinceMs) {
  const supabase = getSupabaseAdmin();
  const sinceIso = new Date(Date.now() - sinceMs).toISOString();
  const { count, error } = await supabase
    .from("image_generations")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("generated_at", sinceIso);
  if (error) {
    throw new Error(`image_generations count failed: ${error.message}`);
  }
  return count || 0;
}

async function recordImageGeneration({ userId, source, reference, promptSummary, anthropicModel }) {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("image_generations").insert({
    user_id: userId,
    source: source || "web",
    reference: reference || null,
    prompt_summary: promptSummary || null,
    anthropic_model: anthropicModel || null,
  });
  if (error) {
    // Log but do not throw: the image was already generated and returned.
    // Undercounting is preferable to failing a successful user request.
    console.error("recordImageGeneration failed:", error.message);
  }
}

module.exports = {
  SUBSCRIPTION_PRODUCT_ID,
  getSupabaseAdmin,
  getStripe,
  verifySupabaseUserToken,
  extractCurrentPeriodEnd,
  countRecentImageGenerations,
  recordImageGeneration,
};
