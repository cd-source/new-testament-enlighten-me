// Web-only subscription glue. Bails on Capacitor (iOS uses StoreKit).
// Loads Supabase from CDN, exposes window.EnlightenWeb for script.js to call.

(function () {
  if (typeof window === "undefined") return;
  if (window.Capacitor?.isNativePlatform?.()) return;

  const subscribeButton = document.getElementById("subscribeButton");
  if (subscribeButton) subscribeButton.hidden = true;

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
      <p class="tool-meta" id="webSignInStatus"></p>
      <div id="webSignInControls" class="web-sign-in-controls">
        <button id="webGoogleSignInButton" class="button button-secondary button-compact web-google-button" type="button">
          <span class="web-google-icon" aria-hidden="true">G</span>
          Continue with Google
        </button>
        <div class="web-sign-in-divider"><span>or</span></div>
        <form id="webSignInForm" class="web-sign-in-form">
          <label class="sr-only" for="webSignInEmail">Email</label>
          <input id="webSignInEmail" class="text-input" type="email" placeholder="you@example.com" autocomplete="email" required />
          <label class="sr-only" for="webSignInPassword">Password</label>
          <input id="webSignInPassword" class="text-input" type="password" placeholder="Password (8+ characters)" autocomplete="current-password" minlength="8" required />
          <div class="web-sign-in-buttons">
            <button id="webSignInSubmit" class="button button-secondary button-compact" type="submit">Sign in</button>
            <button id="webSignUpSubmit" class="button button-compact" type="button">Create account</button>
          </div>
        </form>
        <p class="tool-meta web-sign-in-help">Forgot password? <a href="mailto:help@enlighten-me.co?subject=Enlighten%20password%20reset">Email us</a> to reset.</p>
      </div>
      <button id="webSignOutButton" class="utility-button" type="button" hidden>Sign out</button>
      <p class="tool-meta" id="webSignInMessage" hidden></p>
    `;
    panel.insertBefore(row, actions);

    document.getElementById("webSignInForm").addEventListener("submit", (event) => {
      event.preventDefault();
      handleEmailAuth("signin");
    });

    document.getElementById("webSignUpSubmit").addEventListener("click", () => {
      handleEmailAuth("signup");
    });

    document.getElementById("webGoogleSignInButton").addEventListener("click", async () => {
      const message = document.getElementById("webSignInMessage");
      const button = document.getElementById("webGoogleSignInButton");
      button.disabled = true;
      try {
        const { error } = await supabase.auth.signInWithOAuth({
          provider: "google",
          options: { redirectTo: `${window.location.origin}/?view=settings` },
        });
        if (error) {
          message.textContent = `Could not start Google sign-in: ${error.message}`;
          message.hidden = false;
        }
      } catch (error) {
        message.textContent = error?.message || "Google sign-in failed.";
        message.hidden = false;
      } finally {
        button.disabled = false;
      }
    });

    document.getElementById("webSignOutButton").addEventListener("click", () => {
      signOut().catch((err) => console.error("sign out failed:", err));
    });
  }

  async function handleEmailAuth(mode) {
    const emailInput = document.getElementById("webSignInEmail");
    const passwordInput = document.getElementById("webSignInPassword");
    const email = (emailInput?.value || "").trim();
    const password = passwordInput?.value || "";
    if (!email || !password) return;

    const signInBtn = document.getElementById("webSignInSubmit");
    const signUpBtn = document.getElementById("webSignUpSubmit");
    const message = document.getElementById("webSignInMessage");
    signInBtn.disabled = true;
    signUpBtn.disabled = true;
    message.hidden = true;

    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) {
          message.textContent = `Could not create account: ${error.message}`;
          message.hidden = false;
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          message.textContent = `Could not sign in: ${error.message}`;
          message.hidden = false;
        }
      }
    } catch (error) {
      message.textContent = error?.message || "Sign-in failed.";
      message.hidden = false;
    } finally {
      signInBtn.disabled = false;
      signUpBtn.disabled = false;
    }
  }

  function renderSignInState() {
    const status = document.getElementById("webSignInStatus");
    const controls = document.getElementById("webSignInControls");
    const signOutButton = document.getElementById("webSignOutButton");
    if (!status || !controls) return;

    if (currentSession?.user?.email) {
      status.textContent = `Signed in as ${currentSession.user.email}.`;
      controls.hidden = true;
      if (signOutButton) signOutButton.hidden = false;
      if (subscribeButton) subscribeButton.hidden = false;
    } else {
      status.textContent =
        "Step 1 of 2: Sign in to subscribe. Scripture features stay free without an account.";
      controls.hidden = false;
      if (signOutButton) signOutButton.hidden = true;
      if (subscribeButton) subscribeButton.hidden = true;
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
