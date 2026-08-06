// Web-only subscription glue. Bails on Capacitor (iOS uses StoreKit).
// Loads Supabase from CDN, exposes window.EnlightenWeb for script.js to call.

(function () {
  if (typeof window === "undefined") return;
  if (window.Capacitor?.isNativePlatform?.()) return;

  const subscribeButton = document.getElementById("subscribeButton");
  if (subscribeButton) subscribeButton.hidden = false;

  const PRODUCTION_ORIGIN = "https://www.enlighten-me.co";

  let supabase = null;
  let publicConfig = null;
  let currentSession = null;
  let cachedStatus = { isActive: false, entitlementToken: "", source: "Stripe" };
  let signInUiMode = "";

  function t(key, vars = {}) {
    const translate = window.EnlightenI18n?.t;
    if (typeof translate === "function") return translate(key, vars);
    return Object.entries(vars).reduce(
      (value, [name, replacement]) => value.replaceAll(`{${name}}`, String(replacement)),
      key
    );
  }

  function isLocalStaticOrigin() {
    return ["localhost", "127.0.0.1"].includes(window.location.hostname);
  }

  function useLocalApiOverride() {
    try {
      return isLocalStaticOrigin() && new URLSearchParams(window.location.search).get("api") === "local";
    } catch (_) {
      return false;
    }
  }

  function apiUrl(path) {
    return isLocalStaticOrigin() && !useLocalApiOverride() ? `${PRODUCTION_ORIGIN}${path}` : path;
  }

  function currentLanguage() {
    return window.EnlightenI18n?.language?.() || "en";
  }

  function currentStripeLocale() {
    return window.EnlightenI18n?.stripeLocale?.() || (currentLanguage().startsWith("es") ? "es" : "en");
  }

  function isLanguageReady() {
    const i18n = window.EnlightenI18n;
    if (typeof i18n?.isReady === "function") return i18n.isReady();
    return Boolean(i18n?.t && document.documentElement.lang);
  }

  function waitForLanguageReady() {
    if (isLanguageReady()) return Promise.resolve();

    return new Promise((resolve) => {
      let settled = false;
      let timer = 0;
      const finish = () => {
        if (settled) return;
        settled = true;
        window.removeEventListener("enlighten:language-ready", finish);
        window.removeEventListener("enlighten:language-changed", finish);
        clearTimeout(timer);
        resolve();
      };

      window.addEventListener("enlighten:language-ready", finish);
      window.addEventListener("enlighten:language-changed", finish);
      timer = setTimeout(finish, 1500);
    });
  }

  function rerenderSignInUi() {
    const row = document.getElementById("webSignInRow");
    if (!row || !signInUiMode) return;

    row.remove();
    if (signInUiMode === "unavailable") {
      showUnavailableState();
    } else {
      addSignInUi();
      renderSignInState();
    }
  }

  window.addEventListener("enlighten:language-ready", rerenderSignInUi);
  window.addEventListener("enlighten:language-changed", rerenderSignInUi);

  function settingsReturnUrl(origin = window.location.origin) {
    const url = new URL(origin);
    url.searchParams.set("view", "settings");
    url.searchParams.set("lang", currentLanguage());
    if (useLocalApiOverride()) url.searchParams.set("api", "local");
    return url.toString();
  }

  async function loadConfig() {
    const response = await fetch(apiUrl("/api/config"), { cache: "no-store" });
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
      const response = await fetch(apiUrl("/api/web-entitlement"), {
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
      addSignInUi();
      renderSignInState();
      const message = document.getElementById("webSignInMessage");
      if (message) {
        message.textContent = t("web_signin.signin_prompt");
        message.hidden = false;
      }
      document.getElementById("webGoogleSignInButton")?.focus();
      throw new Error(t("web_signin.signin_prompt"));
    }
    const response = await fetch(apiUrl("/api/stripe/checkout"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${currentSession.access_token}`,
      },
      body: JSON.stringify({
        origin: window.location.origin,
        language: currentLanguage(),
        locale: currentStripeLocale(),
      }),
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload.error || t("web_signin.error_checkout_generic"));
    }
    const payload = await response.json();
    if (!payload.url) throw new Error(t("web_signin.error_checkout_no_url"));
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

    // A Stripe subscription just completed — the real revenue conversion. Route it through the
    // shared tracker so it lands in both the Vercel funnel and Google Ads (gtag) at once.
    window.trackMarketingEvent?.("subscribe_completed", { source: "web" });

    const message = document.getElementById("webSignInMessage");
    if (message) {
      message.textContent = t("web_signin.activating");
      message.hidden = false;
    }

    for (let attempt = 0; attempt < 10; attempt += 1) {
      cachedStatus = await fetchEntitlement();
      if (cachedStatus.isActive) {
        window.refreshEnlightenSubscription?.();
        if (message) {
          message.textContent = t("web_signin.activated");
        }
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    window.refreshEnlightenSubscription?.();
    if (message) {
      message.textContent = t("web_signin.activation_slow");
    }
  }

  function addSignInUi() {
    signInUiMode = "auth";
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
          ${t("web_signin.continue_with_google")}
        </button>
        <div class="web-sign-in-divider"><span>${t("web_signin.divider_or")}</span></div>
        <form id="webSignInForm" class="web-sign-in-form">
          <label class="sr-only" for="webSignInEmail">${t("web_signin.email_sr")}</label>
          <input id="webSignInEmail" class="text-input" type="email" placeholder="${t("web_signin.email_placeholder")}" autocomplete="email" required />
          <label class="sr-only" for="webSignInPassword">${t("web_signin.password_sr")}</label>
          <input id="webSignInPassword" class="text-input" type="password" placeholder="${t("web_signin.password_placeholder")}" autocomplete="current-password" minlength="8" required />
          <div class="web-sign-in-buttons">
            <button id="webSignInSubmit" class="button button-secondary button-compact" type="submit">${t("web_signin.button_signin")}</button>
            <button id="webSignUpSubmit" class="button button-compact" type="button">${t("web_signin.button_signup")}</button>
          </div>
        </form>
        <p class="tool-meta web-sign-in-help">${t("web_signin.forgot_prefix")} <a href="mailto:help@enlighten-me.co?subject=Enlighten-Me%20password%20reset">${t("web_signin.forgot_link")}</a> ${t("web_signin.forgot_suffix")}</p>
      </div>
      <div id="webAccountRow" class="web-account-row" hidden>
        <div class="web-account-info">
          <span class="web-account-label">${t("web_signin.signed_in_as")}</span>
          <span class="web-account-email" id="webAccountEmail"></span>
        </div>
        <button id="webSignOutButton" class="web-sign-out-button" type="button">${t("web_signin.button_signout")}</button>
      </div>
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
          options: { redirectTo: settingsReturnUrl() },
        });
        if (error) {
          message.textContent = t("web_signin.error_google_start", { error: error.message });
          message.hidden = false;
        }
      } catch (error) {
        message.textContent = error?.message || t("web_signin.error_google_generic");
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
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: settingsReturnUrl() },
        });
        if (error) {
          message.textContent = t("web_signin.error_create_account", { error: error.message });
          message.hidden = false;
        } else if (data?.user && (data.user.identities?.length ?? 0) === 0) {
          message.textContent = t("web_signin.error_account_exists", { email });
          message.hidden = false;
        } else {
          message.textContent = t("web_signin.account_created", { email });
          message.hidden = false;
          if (passwordInput) passwordInput.value = "";
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          message.textContent = t("web_signin.error_signin", { error: error.message });
          message.hidden = false;
        }
      }
    } catch (error) {
      message.textContent = error?.message || t("web_signin.error_signin_generic");
      message.hidden = false;
    } finally {
      signInBtn.disabled = false;
      signUpBtn.disabled = false;
    }
  }

  function renderSignInState() {
    const status = document.getElementById("webSignInStatus");
    const controls = document.getElementById("webSignInControls");
    const accountRow = document.getElementById("webAccountRow");
    const accountEmail = document.getElementById("webAccountEmail");
    if (!status || !controls) return;

    if (currentSession?.user?.email) {
      status.hidden = true;
      controls.hidden = true;
      if (accountEmail) accountEmail.textContent = currentSession.user.email;
      if (accountRow) accountRow.hidden = false;
      if (subscribeButton) subscribeButton.hidden = false;
    } else {
      status.hidden = false;
      status.textContent = t("web_signin.signin_prompt");
      controls.hidden = false;
      if (accountRow) accountRow.hidden = true;
      if (subscribeButton) subscribeButton.hidden = false;
    }
  }

  function showUnavailableState() {
    signInUiMode = "unavailable";
    const panel = document.getElementById("subscriptionPanel");
    if (!panel || document.getElementById("webSignInRow")) return;
    const actions = panel.querySelector(".subscription-actions");
    if (!actions) return;

    if (subscribeButton) {
      subscribeButton.hidden = false;
      subscribeButton.disabled = false;
    }

    window.EnlightenWeb = {
      getStatus: async () => cachedStatus,
      refreshStatus: async () => cachedStatus,
      startSubscribe: async () => {
        window.location.assign(settingsReturnUrl(PRODUCTION_ORIGIN));
      },
      signOut: async () => {},
      isSignedIn: () => false,
    };

    const row = document.createElement("div");
    row.id = "webSignInRow";
    row.className = "web-sign-in-row";
    row.innerHTML = `<p class="tool-meta" id="webSignInStatus">${t("web_signin.unavailable")}</p>`;
    panel.insertBefore(row, actions);
  }

  async function init() {
    await waitForLanguageReady();

    try {
      publicConfig = await loadConfig();
    } catch (error) {
      console.error("Enlighten web subscribe: config load failed", error);
      showUnavailableState();
      return;
    }

    if (!publicConfig.supabaseUrl || !publicConfig.supabaseAnonKey) {
      console.warn("Enlighten web subscribe: Supabase config missing — sign-in disabled.");
      showUnavailableState();
      return;
    }

    let createClient;
    try {
      createClient = await loadSupabaseModule();
    } catch (error) {
      console.error("Enlighten web subscribe: Supabase SDK load failed", error);
      showUnavailableState();
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
