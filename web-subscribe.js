// Web-only subscription glue. Bails on Capacitor (iOS uses StoreKit).
// Loads Supabase from CDN, exposes window.EnlightenWeb for script.js to call.

(function () {
  if (typeof window === "undefined") return;
  if (window.Capacitor?.isNativePlatform?.()) return;

  let supabase = null;
  let publicConfig = null;
  let currentSession = null;
  let cachedStatus = { isActive: false, entitlementToken: "", source: "Stripe" };

  async function loadConfig() {
    const response = await fetch("/api/config", { cache: "no-store" });
    if (!response.ok) throw new Error(`Config fetch failed: ${response.status}`);
    return response.json();
  }

  async function loadSupabaseModule() {
    const mod = await import("https://esm.sh/@supabase/supabase-js@2");
    return mod.createClient;
  }

  async function fetchEntitlement() {
    if (!currentSession?.access_token) {
      return { isActive: false, entitlementToken: "", source: "Stripe" };
    }
    try {
      const response = await fetch("/api/web-entitlement", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${currentSession.access_token}`,
        },
      });
      if (!response.ok) {
        return { isActive: false, entitlementToken: "", source: "Stripe" };
      }
      const payload = await response.json();
      return {
        isActive: Boolean(payload.isActive || payload.active),
        entitlementToken: payload.entitlementToken || "",
        productId: payload.productId,
        expiresAt: payload.expiresAt,
        cancelAtPeriodEnd: Boolean(payload.cancelAtPeriodEnd),
        currentPeriodEnd: payload.currentPeriodEnd || null,
        source: "Stripe",
      };
    } catch (error) {
      console.error("entitlement fetch failed:", error);
      return { isActive: false, entitlementToken: "", source: "Stripe" };
    }
  }

  async function startSubscribe() {
    if (!currentSession?.access_token) {
      throw new Error("Please sign in first.");
    }
    const response = await fetch("/api/stripe/checkout", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${currentSession.access_token}`,
      },
      body: JSON.stringify({ origin: window.location.origin }),
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload.error || "Checkout could not start.");
    }
    const payload = await response.json();
    if (!payload.url) throw new Error("Checkout returned no URL.");
    window.location.assign(payload.url);
  }

  async function refreshStatus() {
    cachedStatus = await fetchEntitlement();
    return cachedStatus;
  }

  async function signOut() {
    if (!supabase) return;
    await supabase.auth.signOut();
    cachedStatus = { isActive: false, entitlementToken: "", source: "Stripe" };
    renderSignInState();
    window.refreshEnlightenSubscription?.();
  }

  async function handleCheckoutReturn() {
    const params = new URLSearchParams(window.location.search);
    const justSubscribed = params.has("subscribed");
    const canceled = params.has("subscribe_canceled");
    if (!justSubscribed && !canceled) return;

    const url = new URL(window.location.href);
    url.searchParams.delete("subscribed");
    url.searchParams.delete("session_id");
    url.searchParams.delete("subscribe_canceled");
    window.history.replaceState({}, "", url.toString());

    if (!justSubscribed) return;

    const message = document.getElementById("webSignInMessage");
    if (message) {
      message.textContent = "Activating subscription…";
      message.hidden = false;
    }

    for (let attempt = 0; attempt < 10; attempt += 1) {
      cachedStatus = await fetchEntitlement();
      if (cachedStatus.isActive) {
        window.refreshEnlightenSubscription?.();
        if (message) {
          message.textContent = "Subscription active.";
        }
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    window.refreshEnlightenSubscription?.();
    if (message) {
      message.textContent =
        "Payment received but activation is taking longer than usual — try Restore Purchase in a moment.";
    }
  }

  function addSignInUi() {
    const panel = document.getElementById("subscriptionPanel");
    if (!panel) return;
    const actions = panel.querySelector(".subscription-actions");
    if (!actions || document.getElementById("webSignInRow")) return;

    const row = document.createElement("div");
    row.id = "webSignInRow";
    row.className = "web-sign-in-row";
    row.innerHTML = `
      <p class="tool-meta" id="webSignInStatus" style="margin: 0;"></p>
      <form id="webSignInForm" class="web-sign-in-form" style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
        <label class="sr-only" for="webSignInEmail">Email</label>
        <input id="webSignInEmail" class="text-input" type="email" placeholder="you@example.com" autocomplete="email" required style="flex: 1; min-width: 0;" />
        <button id="webSignInSubmit" class="button button-secondary button-compact" type="submit">Email me a link</button>
      </form>
      <button id="webSignOutButton" class="utility-button" type="button" hidden>Sign out</button>
      <p class="tool-meta" id="webSignInMessage" hidden style="margin: 0;"></p>
    `;
    panel.insertBefore(row, actions);

    document.getElementById("webSignInForm").addEventListener("submit", async (event) => {
      event.preventDefault();
      const input = document.getElementById("webSignInEmail");
      const email = (input.value || "").trim();
      if (!email) return;

      const submit = document.getElementById("webSignInSubmit");
      const message = document.getElementById("webSignInMessage");
      submit.disabled = true;
      submit.textContent = "Sending…";

      try {
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) {
          message.textContent = `Could not send sign-in email: ${error.message}`;
        } else {
          message.textContent = `Check ${email} for a sign-in link.`;
        }
        message.hidden = false;
      } catch (error) {
        message.textContent = error?.message || "Sign-in failed.";
        message.hidden = false;
      } finally {
        submit.disabled = false;
        submit.textContent = "Email me a link";
      }
    });

    document.getElementById("webSignOutButton").addEventListener("click", () => {
      signOut().catch((err) => console.error("sign out failed:", err));
    });
  }

  function renderSignInState() {
    const status = document.getElementById("webSignInStatus");
    const form = document.getElementById("webSignInForm");
    const signOutButton = document.getElementById("webSignOutButton");
    if (!status || !form) return;

    if (currentSession?.user?.email) {
      status.textContent = `Signed in as ${currentSession.user.email}.`;
      form.hidden = true;
      if (signOutButton) signOutButton.hidden = false;
    } else {
      status.textContent =
        "Sign in with email to subscribe. Scripture features stay free without an account.";
      form.hidden = false;
      if (signOutButton) signOutButton.hidden = true;
    }
  }

  async function init() {
    try {
      publicConfig = await loadConfig();
    } catch (error) {
      console.error("Enlighten web subscribe: config load failed", error);
      return;
    }

    if (!publicConfig.supabaseUrl || !publicConfig.supabaseAnonKey) {
      console.warn("Enlighten web subscribe: Supabase config missing — sign-in disabled.");
      return;
    }

    let createClient;
    try {
      createClient = await loadSupabaseModule();
    } catch (error) {
      console.error("Enlighten web subscribe: Supabase SDK load failed", error);
      return;
    }

    supabase = createClient(publicConfig.supabaseUrl, publicConfig.supabaseAnonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    });

    const { data: sessionData } = await supabase.auth.getSession();
    currentSession = sessionData.session;

    supabase.auth.onAuthStateChange((_event, nextSession) => {
      currentSession = nextSession;
      renderSignInState();
      refreshStatus()
        .then(() => window.refreshEnlightenSubscription?.())
        .catch((err) => console.error(err));
    });

    addSignInUi();
    renderSignInState();

    cachedStatus = await fetchEntitlement();

    window.EnlightenWeb = {
      getStatus: async () => cachedStatus,
      refreshStatus,
      startSubscribe,
      signOut,
      isSignedIn: () => Boolean(currentSession),
    };

    window.refreshEnlightenSubscription?.();

    handleCheckoutReturn();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      init().catch((err) => console.error("web-subscribe init failed:", err));
    });
  } else {
    init().catch((err) => console.error("web-subscribe init failed:", err));
  }
})();
