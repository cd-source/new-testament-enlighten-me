const {
  SUBSCRIPTION_PRODUCT_ID,
  getStripe,
  getSupabaseAdmin,
  extractCurrentPeriodEnd,
} = require("../../lib/supabase-admin.js");

async function readRawBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

function periodEndIso(subscription) {
  const ts = extractCurrentPeriodEnd(subscription);
  if (typeof ts !== "number") return null;
  return new Date(ts * 1000).toISOString();
}

async function upsertFromSubscription(supabase, subscription, fallbackUserId) {
  const userId = subscription.metadata?.supabase_user_id || fallbackUserId;
  if (!userId) {
    const { data } = await supabase
      .from("subscriptions")
      .select("user_id")
      .eq("stripe_customer_id", subscription.customer)
      .maybeSingle();
    if (!data?.user_id) return;
    return upsertRow(supabase, data.user_id, subscription);
  }
  return upsertRow(supabase, userId, subscription);
}

async function upsertRow(supabase, userId, subscription, overrideStatus) {
  const row = {
    user_id: userId,
    stripe_customer_id: subscription.customer,
    stripe_subscription_id: subscription.id,
    status: overrideStatus || subscription.status,
    current_period_end: periodEndIso(subscription),
    cancel_at_period_end: Boolean(subscription.cancel_at_period_end),
    product_id: SUBSCRIPTION_PRODUCT_ID,
  };
  const { error } = await supabase
    .from("subscriptions")
    .upsert(row, { onConflict: "user_id" });
  if (error) throw error;
}

async function handleEvent(event, stripe, supabase) {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      const userId = session.client_reference_id || session.metadata?.supabase_user_id;
      if (!session.subscription) return;
      const subscription = await stripe.subscriptions.retrieve(session.subscription);
      await upsertFromSubscription(supabase, subscription, userId);
      return;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated": {
      const subscription = await stripe.subscriptions.retrieve(event.data.object.id);
      await upsertFromSubscription(supabase, subscription);
      return;
    }
    case "customer.subscription.deleted": {
      const subscription = event.data.object;
      const userId = subscription.metadata?.supabase_user_id;
      if (userId) {
        await upsertRow(supabase, userId, subscription, "canceled");
      } else {
        const { data } = await supabase
          .from("subscriptions")
          .select("user_id")
          .eq("stripe_customer_id", subscription.customer)
          .maybeSingle();
        if (data?.user_id) {
          await upsertRow(supabase, data.user_id, subscription, "canceled");
        }
      }
      return;
    }
    default:
      return;
  }
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.statusCode = 405;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: "Method not allowed" }));
    return;
  }

  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    res.statusCode = 500;
    res.end("STRIPE_WEBHOOK_SECRET is not configured.");
    return;
  }

  const signature = req.headers["stripe-signature"];
  if (!signature) {
    res.statusCode = 400;
    res.end("Missing stripe-signature header.");
    return;
  }

  let raw;
  try {
    raw = await readRawBody(req);
  } catch (error) {
    res.statusCode = 400;
    res.end(`Could not read body: ${error.message}`);
    return;
  }

  const stripe = getStripe();
  let event;
  try {
    event = stripe.webhooks.constructEvent(raw, signature, secret);
  } catch (error) {
    console.error("stripe webhook signature failed:", error.message);
    res.statusCode = 400;
    res.end(`Webhook Error: ${error.message}`);
    return;
  }

  try {
    const supabase = getSupabaseAdmin();
    await handleEvent(event, stripe, supabase);
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ received: true }));
  } catch (error) {
    console.error("stripe webhook handler error:", error);
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: error.message || "handler failed" }));
  }
};

module.exports.config = {
  api: { bodyParser: false },
};
