if (typeof window !== "undefined" && window.Capacitor?.Plugins?.EnlightenSubscriptions && !window.EnlightenSubscriptions) {
  window.EnlightenSubscriptions = window.Capacitor.Plugins.EnlightenSubscriptions;
}

const TRANSLATION_STORAGE_KEY = "enlighten.translation.v3";
const TRANSLATIONS = {
  en: {
    dataDir: "kjv",
    langUrl: "./lang/en.json",
    locale: "en-US",
    stripeLocale: "en",
    exampleDir: "assets/examples",
    exampleExtension: "png",
    appStoreBadge: "assets/app-store-badge/en.svg",
    legalPaths: {
      privacy: "privacy.html",
      terms: "terms.html",
      refunds: "refund.html",
    },
  },
  "es-MX": {
    dataDir: "rv1909",
    langUrl: "./lang/es-MX.json",
    locale: "es-MX",
    stripeLocale: "es",
    exampleDir: "assets/examples/es-MX",
    exampleExtension: "png",
    appStoreBadge: "assets/app-store-badge/es-MX.svg",
    legalPaths: {
      privacy: "privacy.es-MX.html",
      terms: "terms.es-MX.html",
      refunds: "refund.es-MX.html",
    },
  },
};
const DEFAULT_TRANSLATION_KEY = "en";
const MAX_SEARCH_RESULTS = 50;
const IMAGE_PRODUCT_ID = "enlighten_ai_images_monthly";
const DEFAULT_IMAGE_PRICE_LABEL = "$2.99/month";
const WEB_PREVIEW_ENTITLEMENT_KEY = "enlighten.previewImageSubscription";
const LIBRARY_DB_NAME = "enlightenCardLibrary";
const LIBRARY_DB_VERSION = 1;
const LIBRARY_STORE_NAME = "cards";
const DECK_STORAGE_KEY_PREFIX = "enlighten.passageDeck.v1";

const passageElement = document.getElementById("passage");
const referenceElement = document.getElementById("reference");
const enlightenButton = document.getElementById("enlightenButton");
const copyButton = document.getElementById("copyButton");
const shareCardButton = document.getElementById("shareCardButton");
const pictureButton = document.getElementById("pictureButton");
const actionStatus = document.getElementById("actionStatus");
const homeView = document.getElementById("homeView");
const settingsView = document.getElementById("settingsView");
const libraryView = document.getElementById("libraryView");
const subscriptionPanel = document.getElementById("subscriptionPanel");
const settingsToggle = document.getElementById("settingsToggle");
const settingsBackButton = document.getElementById("settingsBackButton");
const libraryToggle = document.getElementById("libraryToggle");
const libraryBackButton = document.getElementById("libraryBackButton");
const librarySubtitle = document.getElementById("librarySubtitle");
const libraryEmptyState = document.getElementById("libraryEmptyState");
const libraryViewer = document.getElementById("libraryViewer");
const libraryCardImage = document.getElementById("libraryCardImage");
const libraryCardReference = document.getElementById("libraryCardReference");
const libraryCardDate = document.getElementById("libraryCardDate");
const libraryPrevButton = document.getElementById("libraryPrevButton");
const libraryNextButton = document.getElementById("libraryNextButton");
const libraryShareButton = document.getElementById("libraryShareButton");
const libraryDeleteButton = document.getElementById("libraryDeleteButton");
const libraryStatus = document.getElementById("libraryStatus");
const subscriptionStatus = document.getElementById("subscriptionStatus");
const subscriptionStatusBadge = document.getElementById("subscriptionStatusBadge");
const settingsStatus = document.getElementById("settingsStatus");
const subscribeButton = document.getElementById("subscribeButton");
const restorePurchaseButton = document.getElementById("restorePurchaseButton");
const searchInput = document.getElementById("searchInput");
const searchMeta = document.getElementById("searchMeta");
const searchResults = document.getElementById("searchResults");
const testamentFilter = document.getElementById("testamentFilter");
const bookSelect = document.getElementById("bookSelect");
const chapterSelect = document.getElementById("chapterSelect");
const verseSelect = document.getElementById("verseSelect");
const browseMeta = document.getElementById("browseMeta");
const chapterVerses = document.getElementById("chapterVerses");
const shareCardPanel = document.getElementById("shareCardPanel");
const shareCardCanvas = document.getElementById("shareCardCanvas");
const shareCardPreview = document.getElementById("shareCardPreview");
const closeCardButton = document.getElementById("closeCardButton");
const saveCardButton = document.getElementById("saveCardButton");
const shareCardImageButton = document.getElementById("shareCardImageButton");
const imagePanel = document.getElementById("imagePanel");
const imageStatus = document.getElementById("imageStatus");
const messageImage = document.getElementById("messageImage");
const promptDetails = document.getElementById("promptDetails");
const imagePrompt = document.getElementById("imagePrompt");
const languageSelect = document.getElementById("languageSelect");

let books = [];
let passages = [];
let verses = [];
let versesById = new Map();
let versesByBookChapter = new Map();
let lastIndex = -1;
let passageDeck = [];
let deckIndex = 0;
let currentPassage = null;
let currentGeneratedImageSrc = "";
let currentShareCardDataUrl = "";
let currentSavedCardId = "";
let savedCards = [];
let activeLibraryIndex = 0;
let libraryDbPromise = null;
let libraryTouchStartX = 0;
let activeTestament = "all";
let imageSubscription = {
  isActive: false,
  productId: IMAGE_PRODUCT_ID,
  source: "unloaded",
  entitlementToken: "",
};
let isGeneratingImage = false;
let imageGenerationInterruptedByBackground = false;
let appResumeWaiters = [];
let actionStatusTimer = null;
let searchTrackingTimer = null;
const IMAGE_LOAD_RETRY_DELAYS_MS = [250, 750, 1500];
const IMAGE_REQUEST_RETRY_LIMIT = 1;
let activeTranslationKey = resolveInitialTranslationKey();
let localeStrings = {};
let localeStringsReady = false;

function getTranslationConfig() {
  return TRANSLATIONS[activeTranslationKey] || TRANSLATIONS[DEFAULT_TRANSLATION_KEY];
}

function getStoredTranslationKey() {
  try {
    if (typeof localStorage === "undefined") return "";
    return localStorage.getItem(TRANSLATION_STORAGE_KEY) || "";
  } catch (_) {
    return "";
  }
}

function normalizeTranslationKey(value) {
  if (TRANSLATIONS[value]) return value;
  const normalized = String(value || "").toLowerCase();
  if (normalized === "es" || normalized === "es-mx") return "es-MX";
  if (normalized === "en" || normalized === "en-us") return "en";
  return "";
}

function getUrlTranslationKey() {
  try {
    if (typeof window === "undefined") return "";
    const params = new URLSearchParams(window.location.search);
    return normalizeTranslationKey(params.get("lang") || params.get("language") || params.get("locale"));
  } catch (_) {
    return "";
  }
}

function getBrowserTranslationKey() {
  try {
    if (typeof navigator === "undefined") return "";
    const preferred = navigator.languages?.length ? navigator.languages : [navigator.language];
    for (const raw of preferred) {
      const lower = String(raw || "").toLowerCase();
      // Match any regional Spanish (es, es-MX, es-ES, es-419, …) to our es-MX bundle.
      if (lower.startsWith("es")) return "es-MX";
      if (lower.startsWith("en")) return "en";
    }
    return "";
  } catch (_) {
    return "";
  }
}

function resolveInitialTranslationKey() {
  const requested = getUrlTranslationKey();
  if (requested) return requested;
  const stored = normalizeTranslationKey(getStoredTranslationKey());
  if (stored) return stored;
  const browser = getBrowserTranslationKey();
  if (browser) return browser;
  return DEFAULT_TRANSLATION_KEY;
}

function persistActiveTranslationKey() {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(TRANSLATION_STORAGE_KEY, activeTranslationKey);
  } catch (_) {
    // Language still works for the current session if storage is unavailable.
  }
}

function t(key, vars = {}) {
  const template = localeStrings[key] || key;
  return Object.entries(vars).reduce(
    (value, [name, replacement]) => value.replaceAll(`{${name}}`, String(replacement)),
    template
  );
}

function getTranslationTag() {
  return t("_meta.translation");
}

function getImagePriceLabel() {
  const translated = t("subscription.price_label");
  return translated === "subscription.price_label" ? DEFAULT_IMAGE_PRICE_LABEL : translated;
}

function getLegalPath(name) {
  return getTranslationConfig().legalPaths?.[name] || `${name}.html`;
}

function getExampleImageSrc(index) {
  const config = getTranslationConfig();
  return `${config.exampleDir}/example-${index}.${config.exampleExtension}`;
}

// Apple ships the badge already localized and forbids rolling your own, so each language
// points at its own official artwork file.
function getAppStoreBadgeSrc() {
  return getTranslationConfig().appStoreBadge;
}

function getScriptureDataUrl(fileName) {
  return `./data/${getTranslationConfig().dataDir}/${fileName}`;
}

function getDeckStorageKey() {
  return `${DECK_STORAGE_KEY_PREFIX}.${activeTranslationKey}`;
}

async function loadLocaleStrings() {
  localeStringsReady = false;
  localeStrings = await fetchJson(getTranslationConfig().langUrl, "locale strings");
  localeStringsReady = true;
}

if (typeof window !== "undefined") {
  window.EnlightenI18n = {
    t,
    language: () => activeTranslationKey,
    locale: () => getTranslationConfig().locale,
    stripeLocale: () => getTranslationConfig().stripeLocale,
    isReady: () => localeStringsReady,
  };
}

async function fetchJson(url, label) {
  const response = await fetch(url, { cache: "no-cache" });

  if (!response.ok) {
    throw new Error(`Could not load ${label}: ${response.status}`);
  }

  return response.json();
}

function getChapterKey(bookId, chapter) {
  return `${bookId}-${chapter}`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function buildVerseIndex(nextVerses) {
  if (!Array.isArray(nextVerses) || nextVerses.length === 0) {
    throw new Error("Verse data is empty or invalid.");
  }

  return new Map(nextVerses.map((verse) => [verse.id, verse]));
}

function buildBookChapterIndex(nextVerses) {
  const index = new Map();

  for (const verse of nextVerses) {
    const key = getChapterKey(verse.book_id, verse.chapter);
    const chapterVersesForKey = index.get(key) || [];
    chapterVersesForKey.push(verse);
    index.set(key, chapterVersesForKey);
  }

  for (const chapterVersesForKey of index.values()) {
    chapterVersesForKey.sort((a, b) => a.verse - b.verse);
  }

  return index;
}

function validateBooks(nextBooks) {
  if (!Array.isArray(nextBooks) || nextBooks.length !== 66) {
    throw new Error("Book data is empty or invalid.");
  }
}

function validatePassages(nextPassages, nextVersesById) {
  if (!Array.isArray(nextPassages) || nextPassages.length === 0) {
    throw new Error("Passage data is empty or invalid.");
  }

  for (const passage of nextPassages) {
    if (!Array.isArray(passage.verse_ids) || passage.verse_ids.length === 0) {
      throw new Error(`Passage ${passage.id || passage.reference} has no verse IDs.`);
    }

    const missingVerseIds = passage.verse_ids.filter((verseId) => !nextVersesById.has(verseId));
    if (missingVerseIds.length > 0) {
      throw new Error(`Passage ${passage.id || passage.reference} references missing verses: ${missingVerseIds.join(", ")}`);
    }
  }
}

async function loadScriptureData() {
  const [nextBooks, nextPassages, nextVerses] = await Promise.all([
    fetchJson(getScriptureDataUrl("books.json"), "book data"),
    fetchJson(getScriptureDataUrl("passages.json"), "passage data"),
    fetchJson(getScriptureDataUrl("verses.json"), `${getTranslationTag()} verse data`),
  ]);

  validateBooks(nextBooks);
  const nextVersesById = buildVerseIndex(nextVerses);
  validatePassages(nextPassages, nextVersesById);

  books = nextBooks;
  passages = nextPassages;
  verses = nextVerses;
  versesById = nextVersesById;
  versesByBookChapter = buildBookChapterIndex(nextVerses);
  restorePassageDeck();
}

function getPassageText(passage) {
  if (!passage || !Array.isArray(passage.verse_ids)) return "";

  return passage.verse_ids
    .map((verseId) => versesById.get(verseId)?.text || "")
    .filter(Boolean)
    .join(" ");
}

const SHARE_URL = "https://www.enlighten-me.co";
const APP_STORE_URL = "https://apps.apple.com/app/id6768472131";

// Match the share link to the medium: shares from the native iOS app point
// recipients to the App Store (they're almost certainly on a phone), while web
// shares point to the website, which opens anywhere.
function getShareDestinationUrl() {
  return isNativeAppRuntime() ? APP_STORE_URL : SHARE_URL;
}

function getShareText() {
  if (!currentPassage) return "";
  return `${getPassageText(currentPassage)}\n\n— ${currentPassage.reference} (${getTranslationTag()})\n${getShareDestinationUrl()}`;
}

function getShareCardFileName() {
  const referenceSlug = (currentPassage?.reference || "scripture")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  return `enlighten-${referenceSlug || "scripture"}.png`;
}

function isNativeAppRuntime() {
  return Boolean(window.Capacitor?.isNativePlatform?.());
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

const REMOTE_API_BASE = "https://www.enlighten-me.co";

function apiUrl(path) {
  return isNativeAppRuntime() || (isLocalStaticOrigin() && !useLocalApiOverride()) ? `${REMOTE_API_BASE}${path}` : path;
}

const MARKETING_UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"];

function cleanMarketingValue(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .replace(/[^\w .:/?&=+@|-]/g, "")
    .trim()
    .slice(0, 120);
}

function getMarketingContext(extra = {}) {
  const context = {
    language: activeTranslationKey,
    path: window.location.pathname || "/",
    ...extra,
  };

  try {
    const params = new URLSearchParams(window.location.search);
    for (const key of MARKETING_UTM_KEYS) {
      const value = cleanMarketingValue(params.get(key));
      if (value) context[key] = value;
    }
  } catch (_) {}

  return Object.fromEntries(
    Object.entries(context)
      .map(([key, value]) => [key, typeof value === "string" ? cleanMarketingValue(value) : value])
      .filter(([, value]) => value !== "" && value !== null && typeof value !== "undefined")
  );
}

function shouldTrackMarketingEvents() {
  return !isNativeAppRuntime()
    && !isLocalStaticOrigin()
    && ["http:", "https:"].includes(window.location.protocol);
}

// Google Ads conversion tracking. The gtag tag (AW-18196936681) loads web-only in index.html.
// Each label is the "conversion label" from Google Ads > Goals > the action's tag setup — the
// part after the slash in its send_to. Leave a value "" to keep that conversion off: the fire is
// a no-op until a real label is pasted in, so this is safe to ship before the actions exist.
const GOOGLE_ADS_CONVERSION_ID = "AW-18196936681";
const GOOGLE_ADS_CONVERSION_LABELS = {
  subscribe_completed: "", // PRIMARY — a paid Stripe subscription actually completed
  subscribe_clicked: "",   // secondary — the subscribe button was pressed (intent, not a sale)
  app_store_clicked: "",   // secondary — the iOS App Store hand-off (home badge or footer)
};

function fireGoogleAdsConversion(event) {
  const label = GOOGLE_ADS_CONVERSION_LABELS[event];
  if (!label) return; // not a conversion event, or its label isn't filled in yet
  if (typeof window === "undefined" || typeof window.gtag !== "function") return; // tag absent (iOS webview)
  window.gtag("event", "conversion", { send_to: `${GOOGLE_ADS_CONVERSION_ID}/${label}` });
}

// GA4 (web-only). The tag + Measurement ID live in index.html (window.GA4_MEASUREMENT_ID); an empty
// ID means GA4 is off and every call here is a no-op, so this ships safely before the property
// exists. GA4 auto-captures page_view + user_engagement (its own engaged-session timer) once the ID
// is set — that is what turns "bounce" into a real number — while these forwarded events give Google
// Ads a conversion (subscribe_completed) it can import and optimize bidding against.
function ga4Enabled() {
  return typeof window !== "undefined"
    && typeof window.gtag === "function"
    && Boolean(window.GA4_MEASUREMENT_ID);
}

function fireGa4Event(name, params = {}) {
  if (!ga4Enabled()) return;
  window.gtag("event", name, { send_to: window.GA4_MEASUREMENT_ID, ...params });
}

// Vercel Web Analytics counts a "bounce" as a single-pageview visit, and this whole app is one URL,
// so every engaged session looks like a bounce until we register more pageviews. Vercel only counts
// a pageview when the pathname changes, but its manual API (va("pageview", {route})) fires one without
// touching the real URL — no routing, no 404-on-refresh. We emit one when the visitor reaches a
// distinct view or takes a meaningful action, so bounce reflects "landed and left", not "is an SPA".
const VIRTUAL_PAGEVIEW_ROUTES = {
  bible_search: "/search",
  share_card_created: "/card",
  share_card_saved: "/card",
  personal_image_started: "/image",
  personal_image_completed: "/image",
  subscribe_clicked: "/subscribe",
  subscribe_completed: "/subscribe/complete",
  app_store_clicked: "/app-store",
};

let lastVirtualRoute = "/"; // Vercel auto-tracks the initial "/" pageview on load

function trackVirtualPageview(route) {
  if (!route || route === lastVirtualRoute) return; // mirror Vercel: only a genuine route change counts
  if (!shouldTrackMarketingEvents()) return;
  if (typeof window === "undefined" || typeof window.va !== "function") return;
  lastVirtualRoute = route;
  window.va("pageview", { route, path: route });
}

// A visit that stays visible for 15s is genuinely engaged (mirrors GA4's engaged-session idea), so a
// reader who never clicks a tracked control still is not counted as a bounce.
function armEngagementSignal() {
  if (!shouldTrackMarketingEvents()) return;
  let timer = null;
  let done = false;
  const fire = () => {
    if (done) return;
    done = true;
    document.removeEventListener("visibilitychange", onVisibility);
    trackVirtualPageview("/engaged");
    fireGa4Event("engaged_session");
  };
  function onVisibility() {
    if (done) return;
    if (document.visibilityState === "visible") {
      if (timer === null) timer = window.setTimeout(fire, 15000);
    } else if (timer !== null) {
      window.clearTimeout(timer);
      timer = null;
    }
  }
  document.addEventListener("visibilitychange", onVisibility);
  if (document.visibilityState === "visible") timer = window.setTimeout(fire, 15000);
}

function trackMarketingEvent(event, data = {}) {
  if (!shouldTrackMarketingEvents()) return;

  const context = getMarketingContext(data);

  fireGoogleAdsConversion(event);
  fireGa4Event(event, context);
  trackVirtualPageview(VIRTUAL_PAGEVIEW_ROUTES[event]);

  const body = JSON.stringify({ event, data: context });
  const url = apiUrl("/api/marketing-event");

  try {
    if (navigator.sendBeacon) {
      const queued = navigator.sendBeacon(url, new Blob([body], { type: "application/json" }));
      if (queued) return;
    }
  } catch (_) {}

  fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
  }).catch(() => {});
}

function currentPassageMarketingData(extra = {}) {
  return {
    reference: currentPassage?.reference || "",
    translation: getTranslationTag(),
    ...extra,
  };
}

function scheduleSearchTracking(query, resultCount) {
  window.clearTimeout(searchTrackingTimer);
  if (query.length < 2) return;

  searchTrackingTimer = window.setTimeout(() => {
    trackMarketingEvent("bible_search", {
      query_length: query.length,
      result_count: resultCount,
      testament: activeTestament,
    });
  }, 800);
}

function hasImageSubscription() {
  return Boolean(imageSubscription.isActive);
}

function updateSubscriptionUi() {
  const active = hasImageSubscription();
  const nativeLabel = isNativeAppRuntime() ? "StoreKit" : "web preview";
  const sourceLabel = imageSubscription.source || nativeLabel;
  const priceLabel = getImagePriceLabel();

  subscriptionPanel.classList.toggle("is-subscribed", active);
  subscriptionStatusBadge.textContent = active ? t("subscription.status_active") : t("subscription.status_inactive");
  subscriptionStatusBadge.classList.toggle("is-active", active);
  subscriptionStatus.textContent = active
    ? t("subscription.status_active_detail", { source: sourceLabel })
    : t("subscription.status_inactive_detail", { price: priceLabel });
  subscribeButton.textContent = active
    ? t("subscription.button_active")
    : t("subscription.button_subscribe", { price: priceLabel });
  subscribeButton.disabled = active;
  restorePurchaseButton.textContent = t("subscription.button_restore");
  restorePurchaseButton.disabled = false;
  pictureButton.textContent = getPictureButtonLabel(active);
}

function getPictureButtonLabel(active = hasImageSubscription()) {
  return active ? t("button.create_card") : t("button.unlock_image");
}

function setElementText(element, key, vars) {
  if (element) element.textContent = t(key, vars);
}

function setElementAttr(element, attr, key, vars) {
  if (element) element.setAttribute(attr, t(key, vars));
}

function setElementHref(element, href) {
  if (element) element.setAttribute("href", href);
}

function setMetaContent(selector, key) {
  const element = document.querySelector(selector);
  if (element) element.setAttribute("content", t(key));
}

function applyTranslations() {
  document.documentElement.lang = t("_meta.lang");
  document.title = t("doc.title");
  setMetaContent('meta[name="description"]', "doc.description");
  setMetaContent('meta[property="og:description"]', "doc.description");
  setMetaContent('meta[property="og:image:alt"]', "doc.og_image_alt");
  setMetaContent('meta[name="twitter:description"]', "doc.description");

  setElementAttr(homeView, "aria-label", "home.aria");
  setElementAttr(document.querySelector(".top-actions"), "aria-label", "home.actions_aria");
  setElementText(document.querySelector(".home-view h1"), "home.brand");
  setElementAttr(document.querySelector(".home-focal"), "aria-label", "home.scripture_aria");
  setElementAttr(document.querySelector(".home-actions"), "aria-label", "home.scripture_actions_aria");
  setElementAttr(document.querySelector(".utility-actions"), "aria-label", "home.passage_utilities_aria");
  setElementText(document.getElementById("appStoreCtaText"), "app_store.tagline");
  const appStoreBadge = document.getElementById("appStoreBadgeImage");
  if (appStoreBadge) {
    appStoreBadge.src = getAppStoreBadgeSrc();
    appStoreBadge.alt = t("app_store.badge_alt");
  }
  setElementText(enlightenButton, "button.enlighten");
  setElementText(copyButton, "button.copy");
  setElementText(shareCardButton, "button.share_card");
  setElementText(closeCardButton, "card.button_close");
  setElementText(saveCardButton, currentSavedCardId ? "card.button_saved" : "card.button_save");
  setElementText(shareCardImageButton, "card.button_share");
  setElementAttr(shareCardPanel, "aria-label", "card.aria_finished");
  setElementAttr(shareCardPreview, "alt", "card.preview_alt");

  setElementAttr(document.querySelector(".scripture-tools"), "aria-label", "search.aria_section");
  setElementText(document.querySelector(".search-panel .tool-kicker"), "search.kicker");
  setElementText(document.querySelector(".search-panel h2"), "search.title");
  setElementText(document.querySelector('label[for="searchInput"]'), "search.sr_label");
  setElementAttr(searchInput, "placeholder", "search.placeholder");
  setElementAttr(testamentFilter, "aria-label", "search.filter_aria");
  setElementText(testamentFilter.querySelector('[data-testament="all"]'), "search.filter_both");
  setElementText(testamentFilter.querySelector('[data-testament="old"]'), "search.filter_old");
  setElementText(testamentFilter.querySelector('[data-testament="new"]'), "search.filter_new");
  setElementText(document.querySelector(".browse-panel .tool-kicker"), "browse.kicker");
  setElementText(document.querySelector(".browse-panel h2"), "browse.title");
  const browseLabels = document.querySelectorAll(".browse-controls label span");
  setElementText(browseLabels[0], "browse.label_book");
  setElementText(browseLabels[1], "browse.label_chapter");
  setElementText(browseLabels[2], "browse.label_verse");

  setElementAttr(libraryView, "aria-label", "library.aria");
  setElementText(libraryBackButton, "nav.back_home");
  setElementAttr(libraryBackButton, "aria-label", "nav.back_home_aria");
  setElementText(document.querySelector(".library-header .eyebrow"), "library.eyebrow");
  setElementText(document.querySelector(".library-header h1"), "library.title");
  setElementText(document.querySelector("#libraryEmptyState .tool-kicker"), "library.empty_kicker");
  setElementText(document.querySelector("#libraryEmptyState h2"), "library.empty_title");
  setElementText(document.querySelector("#libraryEmptyState p:last-child"), "library.empty_body");
  setElementAttr(libraryPrevButton, "aria-label", "library.prev_aria");
  setElementAttr(libraryNextButton, "aria-label", "library.next_aria");
  setElementAttr(libraryCardImage, "alt", "library.card_image_alt");
  setElementText(libraryShareButton, "card.button_share");
  setElementText(libraryDeleteButton, "card.button_delete");

  setElementAttr(settingsView, "aria-label", "settings.aria");
  setElementText(settingsBackButton, "nav.back_home");
  setElementAttr(settingsBackButton, "aria-label", "nav.back_home_aria");
  setElementAttr(settingsToggle, "aria-label", "nav.settings_aria");
  setElementText(document.querySelector(".settings-view .settings-title .eyebrow"), "settings.eyebrow");
  setElementText(document.querySelector(".settings-view .settings-title h1"), "settings.title");
  setElementText(document.querySelector(".settings-view .settings-subtitle"), "settings.subtitle");
  setElementText(document.querySelector('[aria-labelledby="subscriptionSettingsTitle"] .tool-kicker'), "subscription.kicker");
  setElementText(document.getElementById("subscriptionSettingsTitle"), "subscription.section_title");
  setElementAttr(subscriptionPanel, "aria-label", "subscription.aria");
  const subscriptionSteps = document.querySelectorAll(".subscription-steps li");
  setElementAttr(document.querySelector(".subscription-steps"), "aria-label", "subscription.steps_aria");
  setElementText(subscriptionSteps[0]?.querySelector("h3"), "subscription.step_signin_title");
  setElementText(subscriptionSteps[0]?.querySelector("p"), "subscription.step_signin_body");
  setElementText(subscriptionSteps[1]?.querySelector("h3"), "subscription.step_checkout_title");
  setElementText(subscriptionSteps[1]?.querySelector("p"), "subscription.step_checkout_body");
  setElementText(subscriptionSteps[2]?.querySelector("h3"), "subscription.step_create_title");
  setElementText(subscriptionSteps[2]?.querySelector("p"), "subscription.step_create_body");
  setElementAttr(document.querySelector(".subscription-examples"), "aria-label", "subscription.examples_aria");
  setElementText(document.querySelector(".subscription-examples-label"), "subscription.examples_label");
  for (const [index, image] of Array.from(document.querySelectorAll(".subscription-examples img")).entries()) {
    image.src = getExampleImageSrc(index + 1);
    image.alt = t("subscription.example_alt");
  }
  setElementText(document.querySelector('[aria-labelledby="appSettingsTitle"] .tool-kicker'), "settings.section_app_kicker");
  setElementText(document.getElementById("appSettingsTitle"), "settings.section_app_title");
  const settingsRows = document.querySelectorAll("#appSettingsTitle + .settings-card .settings-row, [aria-labelledby='appSettingsTitle'] .settings-row");
  setElementText(settingsRows[0]?.querySelector("h3"), "settings.row_language.title");
  setElementText(settingsRows[0]?.querySelector("p"), "settings.row_language.body");
  setElementAttr(languageSelect, "aria-label", "settings.language_aria");
  if (languageSelect) {
    languageSelect.value = activeTranslationKey;
    const enOption = languageSelect.querySelector('option[value="en"]');
    const esOption = languageSelect.querySelector('option[value="es-MX"]');
    if (enOption) enOption.textContent = t("settings.language_en");
    if (esOption) esOption.textContent = t("settings.language_es_mx");
  }
  setElementText(settingsRows[1]?.querySelector("h3"), "settings.row_share_cards.title");
  setElementText(settingsRows[1]?.querySelector("p"), "settings.row_share_cards.body");
  setElementText(settingsRows[1]?.querySelector(".settings-row-meta"), "settings.row_share_cards.tag");
  setElementText(settingsRows[2]?.querySelector("h3"), "settings.row_image_creation.title");
  setElementText(settingsRows[2]?.querySelector("p"), "settings.row_image_creation.body");
  setElementText(settingsRows[2]?.querySelector(".settings-row-meta"), "settings.row_image_creation.tag");
  setElementText(document.querySelector('[aria-labelledby="aboutSettingsTitle"] .tool-kicker'), "settings.section_about_kicker");
  setElementText(document.getElementById("aboutSettingsTitle"), "settings.section_about_title");
  const aboutRows = document.querySelectorAll('[aria-labelledby="aboutSettingsTitle"] .settings-row');
  setElementText(aboutRows[0]?.querySelector("h3"), "settings.row_about.title");
  setElementText(aboutRows[0]?.querySelector("p"), "settings.row_about.body");
  setElementText(aboutRows[1]?.querySelector("h3"), "settings.row_saved.title");
  setElementText(aboutRows[1]?.querySelector("p"), "settings.row_saved.body");
  setElementText(aboutRows[2]?.querySelector("h3"), "settings.row_scripture.title");
  setElementText(aboutRows[2]?.querySelector("p"), "settings.row_scripture.body");

  // Resolve footer links by id rather than position: the Refunds item is removed on iOS, and
  // a positional lookup would then shift every later label onto the wrong link. The App Store
  // link is deliberately absent here — Apple requires that name stay in English.
  const privacyLink = document.getElementById("privacyFooterLink");
  setElementText(privacyLink, "footer.privacy");
  setElementHref(privacyLink, getLegalPath("privacy"));
  const termsLink = document.getElementById("termsFooterLink");
  setElementText(termsLink, "footer.terms");
  setElementHref(termsLink, getLegalPath("terms"));
  const refundsLink = document.querySelector("#refundFooterLink a");
  setElementText(refundsLink, "footer.refunds");
  setElementHref(refundsLink, getLegalPath("refunds"));
  setElementText(document.getElementById("supportFooterLink"), "footer.support");
  setElementText(document.querySelector(".footer-meta"), "footer.meta");

  updateSubscriptionUi();
  updateLibraryButton();
  renderSearchResults(searchVerses(normalizeSearchQuery(searchInput.value)), normalizeSearchQuery(searchInput.value));
  if (!currentPassage) {
    passageElement.textContent = t("home.loading");
    referenceElement.textContent = "—";
  }

  window.dispatchEvent(new CustomEvent("enlighten:language-ready"));
}

const VIEW_ROUTES = { home: "/", settings: "/settings", library: "/library" };

function showView(viewName) {
  const showingHome = viewName === "home";
  homeView.hidden = !showingHome;
  settingsView.hidden = viewName !== "settings";
  libraryView.hidden = viewName !== "library";
  settingsToggle.setAttribute("aria-expanded", String(viewName === "settings"));
  window.scrollTo({ top: 0, behavior: "smooth" });
  trackVirtualPageview(VIEW_ROUTES[viewName]);
}

function setSettingsOpen(isOpen) {
  showView(isOpen ? "settings" : "home");
}

function toggleSettings() {
  setSettingsOpen(true);
}

function openInitialViewFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const view = params.get("view");
  if (view === "settings") setSettingsOpen(true);
  if (view === "library") setLibraryOpen(true);

  const cleanupKeys = ["view", "lang", "language", "locale"];
  const shouldCleanUrl = cleanupKeys.some((key) => params.has(key));
  if (!shouldCleanUrl) return;

  for (const key of cleanupKeys) params.delete(key);
  const newSearch = params.toString();
  const newUrl = `${window.location.pathname}${newSearch ? `?${newSearch}` : ""}${window.location.hash}`;
  window.history.replaceState({}, "", newUrl);
}

function setLibraryOpen(isOpen) {
  showView(isOpen ? "library" : "home");
  if (isOpen) {
    renderLibrary();
  }
}

function nativeBridgeArgs() {
  return { productId: IMAGE_PRODUCT_ID, apiBase: REMOTE_API_BASE };
}

function openLibraryDb() {
  if (!window.indexedDB) {
    return Promise.reject(new Error("Local image storage is not available in this browser."));
  }

  if (libraryDbPromise) return libraryDbPromise;

  libraryDbPromise = new Promise((resolve, reject) => {
    const request = window.indexedDB.open(LIBRARY_DB_NAME, LIBRARY_DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(LIBRARY_STORE_NAME)) {
        const store = db.createObjectStore(LIBRARY_STORE_NAME, { keyPath: "id" });
        store.createIndex("createdAt", "createdAt", { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Could not open local card library."));
  });

  return libraryDbPromise;
}

async function readSavedCards() {
  const db = await openLibraryDb();

  return await new Promise((resolve, reject) => {
    const transaction = db.transaction(LIBRARY_STORE_NAME, "readonly");
    const store = transaction.objectStore(LIBRARY_STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => {
      const cards = Array.isArray(request.result) ? request.result : [];
      cards.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      resolve(cards);
    };
    request.onerror = () => reject(request.error || new Error("Could not read saved cards."));
  });
}

async function writeSavedCard(card) {
  const db = await openLibraryDb();

  await new Promise((resolve, reject) => {
    const transaction = db.transaction(LIBRARY_STORE_NAME, "readwrite");
    const store = transaction.objectStore(LIBRARY_STORE_NAME);
    const request = store.put(card);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error || new Error("Could not save card."));
  });
}

async function removeSavedCard(id) {
  const db = await openLibraryDb();

  await new Promise((resolve, reject) => {
    const transaction = db.transaction(LIBRARY_STORE_NAME, "readwrite");
    const store = transaction.objectStore(LIBRARY_STORE_NAME);
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error || new Error("Could not delete card."));
  });
}

async function loadSavedCards() {
  try {
    savedCards = await readSavedCards();
  } catch (error) {
    console.error("Card library failed to load:", error);
    savedCards = [];
    if (libraryStatus) libraryStatus.textContent = t("library.storage_unavailable");
  }

  renderLibrary();
}

function formatSavedCardDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return t("library.date_unknown");
  const formatted = date.toLocaleDateString(getTranslationConfig().locale, { month: "short", day: "numeric", year: "numeric" });
  return t("library.date_template", { date: formatted });
}

function updateLibraryButton() {
  if (!libraryToggle) return;
  libraryToggle.textContent = savedCards.length
    ? t("nav.library_with_count", { count: savedCards.length })
    : t("nav.library");
}

function renderLibrary() {
  updateLibraryButton();

  if (!libraryEmptyState || !libraryViewer) return;
  const hasCards = savedCards.length > 0;
  libraryEmptyState.hidden = hasCards;
  libraryViewer.hidden = !hasCards;

  if (librarySubtitle) {
    librarySubtitle.textContent = hasCards
      ? t(savedCards.length === 1 ? "library.subtitle_one" : "library.subtitle_many", { count: savedCards.length })
      : t("library.subtitle_default");
  }

  if (!hasCards) {
    activeLibraryIndex = 0;
    libraryCardImage?.removeAttribute("src");
    if (libraryStatus) libraryStatus.textContent = "";
    return;
  }

  activeLibraryIndex = Math.max(0, Math.min(activeLibraryIndex, savedCards.length - 1));
  const card = savedCards[activeLibraryIndex];
  libraryCardImage.src = card.dataUrl;
  libraryCardImage.alt = t("library.card_image_alt_template", { reference: card.reference });
  libraryCardReference.textContent = card.reference || t("library.card_reference_fallback");
  libraryCardDate.textContent = t("library.card_meta_template", {
    saved: formatSavedCardDate(card.createdAt),
    index: activeLibraryIndex + 1,
    total: savedCards.length,
  });
  libraryPrevButton.disabled = activeLibraryIndex <= 0;
  libraryNextButton.disabled = activeLibraryIndex >= savedCards.length - 1;
  libraryShareButton.disabled = false;
  libraryDeleteButton.disabled = false;
}

function showLibraryOffset(offset) {
  if (!savedCards.length) return;
  const next = activeLibraryIndex + offset;
  if (next < 0 || next >= savedCards.length) return;
  activeLibraryIndex = next;
  renderLibrary();
}

function getActiveLibraryCard() {
  return savedCards[activeLibraryIndex] || null;
}

function getLibraryCardFileName(card) {
  const referenceSlug = (card?.reference || "scripture")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const idSlug = String(card?.id || "card").slice(-8);

  return `enlighten-${referenceSlug || "scripture"}-${idSlug}.png`;
}

async function loadImageSubscription() {
  try {
    if (window.EnlightenSubscriptions?.getStatus) {
      imageSubscription = {
        ...imageSubscription,
        ...(await window.EnlightenSubscriptions.getStatus(nativeBridgeArgs())),
        source: "StoreKit",
      };
    } else if (window.EnlightenWeb?.getStatus) {
      imageSubscription = {
        ...imageSubscription,
        ...(await window.EnlightenWeb.getStatus()),
      };
    } else {
      imageSubscription = {
        ...imageSubscription,
        isActive: window.localStorage.getItem(WEB_PREVIEW_ENTITLEMENT_KEY) === "active",
        source: "web preview",
      };
    }
  } catch (error) {
    console.error(error);
    imageSubscription = { ...imageSubscription, isActive: false, source: "unavailable" };
  }

  updateSubscriptionUi();
}

if (typeof window !== "undefined") {
  window.refreshEnlightenSubscription = loadImageSubscription;
  window.trackMarketingEvent = trackMarketingEvent;
}

async function subscribeToImagePlan() {
  trackMarketingEvent("subscribe_clicked", { source: isNativeAppRuntime() ? "ios" : "web" });

  try {
    if (window.EnlightenSubscriptions?.purchase) {
      imageSubscription = {
        ...imageSubscription,
        ...(await window.EnlightenSubscriptions.purchase(nativeBridgeArgs())),
        source: "StoreKit",
      };
    } else if (window.EnlightenWeb?.startSubscribe) {
      setActionStatus(t("subscription.redirecting"));
      await window.EnlightenWeb.startSubscribe();
      return;
    } else {
      window.localStorage.setItem(WEB_PREVIEW_ENTITLEMENT_KEY, "active");
      imageSubscription = { ...imageSubscription, isActive: true, source: "web preview" };
    }

    updateSubscriptionUi();
    setActionStatus(t("subscription.activated"));
  } catch (error) {
    if (error?.name !== "AbortError") {
      console.error(error);
      setActionStatus(error?.message || t("subscription.error_unknown"));
    }
  }
}

async function restoreImagePlan() {
  try {
    if (window.EnlightenSubscriptions?.restorePurchases) {
      imageSubscription = {
        ...imageSubscription,
        ...(await window.EnlightenSubscriptions.restorePurchases(nativeBridgeArgs())),
        source: "StoreKit",
      };
    } else if (window.EnlightenWeb?.refreshStatus) {
      imageSubscription = {
        ...imageSubscription,
        ...(await window.EnlightenWeb.refreshStatus()),
      };
    } else {
      imageSubscription = {
        ...imageSubscription,
        isActive: window.localStorage.getItem(WEB_PREVIEW_ENTITLEMENT_KEY) === "active",
        source: "web preview",
      };
    }

    updateSubscriptionUi();
    if (hasImageSubscription()) {
      const exchangeError = imageSubscription.exchangeError;
      if (exchangeError) {
        setActionStatus(t("subscription.token_error", { error: exchangeError }));
      } else {
        setActionStatus(t("subscription.restored"));
      }
    } else {
      setActionStatus(t("subscription.no_active"));
    }
  } catch (error) {
    console.error(error);
    setActionStatus(t("subscription.restore_failed", { error: error?.message || t("subscription.restore_failed_generic") }));
  }
}

function showImageSubscriptionPrompt() {
  setSettingsOpen(true);
  setActionStatus(t("image.subscribe_prompt", { price: getImagePriceLabel() }));
}

function setActionStatus(message) {
  if (actionStatus) {
    actionStatus.textContent = message;
  }
  if (settingsStatus) {
    settingsStatus.textContent = message;
  }

  window.clearTimeout(actionStatusTimer);
  if (message) {
    actionStatusTimer = window.setTimeout(() => {
      if (actionStatus?.textContent === message) {
        actionStatus.textContent = "";
      }
      if (settingsStatus?.textContent === message) {
        settingsStatus.textContent = "";
      }
    }, 2600);
  }
}

function persistPassageDeck() {
  try {
    if (typeof localStorage === "undefined") return;
    const payload = JSON.stringify({
      poolSize: passages.length,
      deck: passageDeck,
      deckIndex,
      lastIndex,
    });
    localStorage.setItem(getDeckStorageKey(), payload);
  } catch (_) {
    // localStorage may be unavailable (private mode, quota); deck still works in memory
  }
}

function restorePassageDeck() {
  try {
    if (typeof localStorage === "undefined") return;
    const raw = localStorage.getItem(getDeckStorageKey());
    if (!raw) return;
    const saved = JSON.parse(raw);
    if (!saved || saved.poolSize !== passages.length) return;
    if (!Array.isArray(saved.deck) || saved.deck.length !== passages.length) return;
    if (typeof saved.deckIndex !== "number" || saved.deckIndex < 0 || saved.deckIndex > passages.length) return;
    const inRange = saved.deck.every((i) => Number.isInteger(i) && i >= 0 && i < passages.length);
    if (!inRange) return;
    const seen = new Set(saved.deck);
    if (seen.size !== passages.length) return;
    passageDeck = saved.deck;
    deckIndex = saved.deckIndex;
    lastIndex = Number.isInteger(saved.lastIndex) ? saved.lastIndex : -1;
  } catch (_) {
    // Corrupt or unavailable storage; fall back to fresh in-memory deck
  }
}

function shufflePassageDeck(avoidIndex) {
  passageDeck = passages.map((_, i) => i);
  for (let i = passageDeck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [passageDeck[i], passageDeck[j]] = [passageDeck[j], passageDeck[i]];
  }
  deckIndex = 0;
  if (passages.length > 1 && passageDeck[0] === avoidIndex) {
    const swap = 1 + Math.floor(Math.random() * (passageDeck.length - 1));
    [passageDeck[0], passageDeck[swap]] = [passageDeck[swap], passageDeck[0]];
  }
  persistPassageDeck();
}

function getRandomPassage() {
  if (!passages.length) {
    throw new Error("No passages have been loaded.");
  }

  if (passageDeck.length !== passages.length || deckIndex >= passageDeck.length) {
    shufflePassageDeck(lastIndex);
  }

  const nextIndex = passageDeck[deckIndex++];
  lastIndex = nextIndex;
  persistPassageDeck();
  return passages[nextIndex];
}

function resetImagePanel() {
  currentGeneratedImageSrc = "";
  imagePanel.hidden = true;
  imagePanel.classList.remove("is-loading");
  imageStatus.textContent = "";
  imageStatus.hidden = false;
  resetShareCard();
  messageImage.hidden = true;
  messageImage.removeAttribute("src");
  if (promptDetails) promptDetails.hidden = true;
  if (imagePrompt) imagePrompt.textContent = "";
}

function setImageLoading(isLoading) {
  isGeneratingImage = isLoading;
  if (isLoading) imageGenerationInterruptedByBackground = false;
  pictureButton.disabled = isLoading || !currentPassage;
  pictureButton.textContent = isLoading ? t("button.creating") : getPictureButtonLabel();
  imagePanel.classList.toggle("is-loading", isLoading);
}

function showPleaseWait() {
  imagePanel.hidden = false;
  imageStatus.hidden = false;
  imageStatus.innerHTML = `
    <span class="spinner-clock" aria-hidden="true"></span>
    <span>${t("image.please_wait")}</span>
  `;
}

function isAppForeground() {
  return document.visibilityState !== "hidden";
}

function markImageGenerationInterrupted() {
  if (isGeneratingImage) imageGenerationInterruptedByBackground = true;
}

function resolveAppResumeWaiters() {
  if (!isAppForeground()) return;
  const waiters = appResumeWaiters;
  appResumeWaiters = [];
  for (const resolve of waiters) resolve();
}

function waitForAppForeground() {
  if (isAppForeground()) return Promise.resolve();
  return new Promise((resolve) => {
    appResumeWaiters.push(resolve);
  });
}

function delay(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function isBackgroundLoadFailure(error) {
  const message = String(error?.message || error || "").toLowerCase();
  return /load failed|failed to fetch|networkerror|network request failed|abort|cancel|offline|connection/.test(message);
}

async function waitForImageGenerationResume() {
  await waitForAppForeground();
  showPleaseWait();
  imageGenerationInterruptedByBackground = false;
  await delay(400);
}

function bindAppLifecycleEvents() {
  document.addEventListener("visibilitychange", () => {
    if (isAppForeground()) {
      resolveAppResumeWaiters();
    } else {
      markImageGenerationInterrupted();
    }
  });
  window.addEventListener("blur", markImageGenerationInterrupted);
  window.addEventListener("pagehide", markImageGenerationInterrupted);
  window.addEventListener("focus", resolveAppResumeWaiters);
  window.addEventListener("pageshow", resolveAppResumeWaiters);
}

function loadImageElement(src, options = {}) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    if (options.crossOrigin) {
      image.crossOrigin = options.crossOrigin;
    }
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(t("image.load_failed")));
    image.src = src;
  });
}

async function loadImageWithResumeRetry(src, options = {}) {
  let lastError = null;

  for (let attempt = 0; attempt <= IMAGE_LOAD_RETRY_DELAYS_MS.length; attempt += 1) {
    if (!isAppForeground()) await waitForImageGenerationResume();

    try {
      return await loadImageElement(src, options);
    } catch (error) {
      lastError = error;
      const canRetry = isBackgroundLoadFailure(error) && attempt < IMAGE_LOAD_RETRY_DELAYS_MS.length;
      if (!canRetry) break;
      if (!isAppForeground() || imageGenerationInterruptedByBackground) await waitForImageGenerationResume();
      await delay(IMAGE_LOAD_RETRY_DELAYS_MS[attempt]);
    }
  }

  throw lastError || new Error(t("image.load_failed"));
}

async function preloadImage(src) {
  await loadImageWithResumeRetry(src);
  return src;
}

function findImageSource(value, seen = new Set()) {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return /^https?:\/\//.test(trimmed) || /^data:image\//.test(trimmed) ? trimmed : "";
  }

  if (!value || typeof value !== "object" || seen.has(value)) return "";
  seen.add(value);

  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findImageSource(item, seen);
      if (found) return found;
    }
    return "";
  }

  const preferredKeys = [
    "imageDataUrl",
    "imageUrl",
    "image_url",
    "url",
    "image",
    "images",
    "generated",
    "result",
    "results",
    "output",
    "outputs",
    "assets",
    "download_url",
    "signed_url",
    "src",
    "data",
  ];

  for (const key of preferredKeys) {
    const found = findImageSource(value[key], seen);
    if (found) return found;
  }

  return "";
}

function setCurrentPassage(passage, options = {}) {
  const passageText = getPassageText(passage);

  currentPassage = passage;
  passageElement.textContent = `“${passageText}”`;
  referenceElement.textContent = passage.reference;
  copyButton.disabled = false;
  shareCardButton.disabled = false;
  pictureButton.disabled = false;
  updateSubscriptionUi();
  resetShareCard();

  if (options.resetImage !== false) {
    resetImagePanel();
  }

  if (options.status) {
    setActionStatus(options.status);
  }
}

function enlighten() {
  setCurrentPassage(getRandomPassage());
}

function createPassageFromVerse(verse) {
  return {
    id: verse.id,
    reference: verse.reference,
    translation: getTranslationTag(),
    verse_ids: [verse.id],
    passage_type: "single_verse",
    source: `local_${getTranslationConfig().dataDir}_verse`,
  };
}

function selectVerse(verse, options = {}) {
  setCurrentPassage(createPassageFromVerse(verse), {
    status: options.status || t("status.selected", { reference: verse.reference }),
  });

  if (bookSelect.value !== verse.book_id) {
    bookSelect.value = verse.book_id;
    populateChapterSelect(verse.book_id, verse.chapter);
  }

  if (Number(chapterSelect.value) !== verse.chapter) {
    chapterSelect.value = String(verse.chapter);
    populateVerseSelect(verse.book_id, verse.chapter, verse.verse);
    renderChapterVerses(verse.book_id, verse.chapter, verse.verse);
  } else if (Number(verseSelect.value) !== verse.verse) {
    verseSelect.value = String(verse.verse);
    renderChapterVerses(verse.book_id, verse.chapter, verse.verse);
  }
}

function populateBookSelect() {
  bookSelect.innerHTML = books
    .map((book) => `<option value="${escapeHtml(book.id)}">${escapeHtml(book.name)}</option>`)
    .join("");
}

function populateChapterSelect(bookId, selectedChapter = 1) {
  const book = books.find((nextBook) => nextBook.id === bookId);
  if (!book) return;

  chapterSelect.innerHTML = Array.from({ length: book.chapters }, (_, index) => {
    const chapterNumber = index + 1;
    return `<option value="${chapterNumber}">${escapeHtml(t("browse.option_chapter", { number: chapterNumber }))}</option>`;
  }).join("");

  chapterSelect.value = String(Math.min(selectedChapter, book.chapters));
  populateVerseSelect(bookId, Number(chapterSelect.value), 1);
}

function populateVerseSelect(bookId, chapter, selectedVerse = 1) {
  const chapterVersesForSelection = versesByBookChapter.get(getChapterKey(bookId, chapter)) || [];

  verseSelect.innerHTML = chapterVersesForSelection
    .map((verse) => `<option value="${verse.verse}">${escapeHtml(t("browse.option_verse", { number: verse.verse }))}</option>`)
    .join("");

  const selectedVerseExists = chapterVersesForSelection.some((verse) => verse.verse === selectedVerse);
  verseSelect.value = String(selectedVerseExists ? selectedVerse : chapterVersesForSelection[0]?.verse || 1);
}

function renderChapterVerses(bookId, chapter, activeVerseNumber = Number(verseSelect.value)) {
  const chapterVersesForSelection = versesByBookChapter.get(getChapterKey(bookId, chapter)) || [];
  const book = books.find((nextBook) => nextBook.id === bookId);

  browseMeta.textContent = book
    ? t("browse.meta_chapter", { book: book.name, chapter, count: chapterVersesForSelection.length })
    : t("browse.meta_select");

  chapterVerses.innerHTML = chapterVersesForSelection
    .map((verse) => `
      <button class="verse-row${verse.verse === activeVerseNumber ? " is-active" : ""}" type="button" data-verse-id="${escapeHtml(verse.id)}">
        <span class="verse-ref">${escapeHtml(verse.reference)}</span>
        <span class="verse-text">${escapeHtml(verse.text)}</span>
      </button>
    `)
    .join("");
}

function initializeBrowseControls() {
  populateBookSelect();
  bookSelect.value = "john";
  populateChapterSelect("john", 3);
  populateVerseSelect("john", 3, 16);
  renderChapterVerses("john", 3, 16);
}

function normalizeSearchQuery(value) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function escapeSearchRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function createWholeTermSearchPattern(normalizedQuery) {
  const escapedPhrase = normalizedQuery.split(" ").map(escapeSearchRegex).join("\\s+");
  return new RegExp(`(^|[^a-z0-9])${escapedPhrase}(?=$|[^a-z0-9])`, "i");
}

function matchesTestament(verse, testament) {
  if (testament === "old") return verse.testament === "Old";
  if (testament === "new") return verse.testament === "New";
  return true;
}

function testamentLabel(testament) {
  if (testament === "old") return t("search.scope_old");
  if (testament === "new") return t("search.scope_new");
  return t("search.scope_all");
}

function searchVerses(query, testament = activeTestament) {
  const normalizedQuery = normalizeSearchQuery(query);
  if (normalizedQuery.length < 2) return [];

  const pool = testament === "all" ? verses : verses.filter((verse) => matchesTestament(verse, testament));

  const referenceMatches = pool.filter((verse) => verse.reference.toLowerCase().includes(normalizedQuery));
  const searchPattern = createWholeTermSearchPattern(normalizedQuery);
  const textMatches = pool.filter((verse) => searchPattern.test(verse.text));

  return [...referenceMatches, ...textMatches]
    .filter((verse, index, allMatches) => allMatches.findIndex((match) => match.id === verse.id) === index)
    .slice(0, MAX_SEARCH_RESULTS);
}

function renderSearchResults(results, query, testament = activeTestament) {
  const scope = testamentLabel(testament);

  if (!query) {
    searchMeta.textContent = testament === "all"
      ? t("search.meta_all_default", { count: verses.length.toLocaleString(getTranslationConfig().locale) })
      : t("search.meta_filtered", { scope });
    searchResults.innerHTML = "";
    return;
  }

  if (query.length < 2) {
    searchMeta.textContent = t("search.meta_too_short");
    searchResults.innerHTML = "";
    return;
  }

  if (results.length === 0) {
    searchMeta.textContent = t("search.meta_no_match", { scope, query });
    searchResults.innerHTML = "";
    return;
  }

  searchMeta.textContent = results.length === MAX_SEARCH_RESULTS
    ? t("search.meta_top", { count: MAX_SEARCH_RESULTS, scope, query })
    : t(results.length === 1 ? "search.meta_one_match" : "search.meta_count", { count: results.length, scope, query });
  searchResults.innerHTML = results
    .map((verse) => `
      <button class="result-row" type="button" data-verse-id="${escapeHtml(verse.id)}">
        <span class="result-ref">${escapeHtml(verse.reference)}</span>
        <span class="result-text">${escapeHtml(verse.text)}</span>
      </button>
    `)
    .join("");
}

function runSearch() {
  const query = normalizeSearchQuery(searchInput.value);
  const results = searchVerses(query);
  renderSearchResults(results, query);
  scheduleSearchTracking(query, results.length);
}

function setTestamentFilter(testament) {
  if (testament === activeTestament) return;
  activeTestament = testament;
  for (const pill of testamentFilter.querySelectorAll(".filter-pill")) {
    pill.setAttribute("aria-pressed", pill.dataset.testament === testament ? "true" : "false");
  }
  runSearch();
}

async function copyCurrentPassage() {
  if (!currentPassage) return;

  try {
    await navigator.clipboard.writeText(getShareText());
    setActionStatus(t("card.copied"));
  } catch (error) {
    console.error(error);
    setActionStatus(t("card.copy_failed"));
  }
}

function setFocalCardVisible(isVisible) {
  homeView.classList.toggle("has-focal-card", isVisible);
  passageElement.hidden = isVisible;
  referenceElement.hidden = isVisible;
}

function scrollHomeFocalIntoView() {
  homeView.scrollIntoView({ behavior: "smooth", block: "start" });
}

function resetShareCard() {
  currentShareCardDataUrl = "";
  currentSavedCardId = "";
  shareCardPanel.hidden = true;
  shareCardPreview.hidden = true;
  shareCardPreview.removeAttribute("src");
  setFocalCardVisible(false);
  closeCardButton.disabled = true;
  saveCardButton.disabled = true;
  saveCardButton.textContent = t("card.button_save");
  shareCardImageButton.disabled = true;
}

function wrapCanvasText(context, text, maxWidth) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";

  for (const word of words) {
    const testLine = line ? `${line} ${word}` : word;
    if (context.measureText(testLine).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = testLine;
    }
  }

  if (line) lines.push(line);
  return lines;
}

function drawRoundedRect(context, x, y, width, height, radius) {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.lineTo(x + width - radius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + radius);
  context.lineTo(x + width, y + height - radius);
  context.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  context.lineTo(x + radius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - radius);
  context.lineTo(x, y + radius);
  context.quadraticCurveTo(x, y, x + radius, y);
  context.closePath();
}

function drawShareCardText(context, text, reference, compact = false) {
  const maxWidth = compact ? 920 : 940;
  const minFont = compact ? 30 : 42;
  const maxLines = compact ? 6 : 10;
  const centerY = compact ? 1060 : 720;
  const minTop = compact ? 830 : 200;
  const referenceGap = compact ? 44 : 60;
  const referenceFontSize = compact ? 32 : 42;
  let quoteFontSize = compact
    ? (text.length > 330 ? 38 : text.length > 220 ? 46 : 54)
    : (text.length > 330 ? 56 : text.length > 220 ? 66 : 76);
  let lines = [];

  do {
    context.font = `${quoteFontSize}px Georgia, serif`;
    lines = wrapCanvasText(context, `“${text}”`, maxWidth);
    if (lines.length <= maxLines || quoteFontSize <= minFont) break;
    quoteFontSize -= 4;
  } while (quoteFontSize >= minFont);

  const lineHeight = quoteFontSize * 1.34;
  const quoteBlockHeight = lines.length * lineHeight;
  let y = Math.max(minTop, centerY - quoteBlockHeight / 2);

  context.fillStyle = "#f8fafc";
  context.textAlign = "center";
  context.textBaseline = "alphabetic";
  context.font = `${quoteFontSize}px Georgia, serif`;

  for (const line of lines) {
    context.fillText(line, 540, y, maxWidth);
    y += lineHeight;
  }

  context.fillStyle = "#facc15";
  context.font = `700 ${referenceFontSize}px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`;
  context.fillText(`— ${reference} (${getTranslationTag()})`, 540, y + referenceGap, maxWidth);
}

async function loadCanvasImage(src, options = {}) {
  return await loadImageWithResumeRetry(src, options);
}

async function getImageForCanvas(src) {
  if (!src) return null;

  if (src.startsWith("data:") || src.startsWith("blob:")) {
    if (messageImage.src === src && messageImage.naturalWidth > 0) {
      return messageImage;
    }
    return await loadCanvasImage(src);
  }

  return await loadCanvasImage(src, { crossOrigin: "anonymous" });
}

async function renderShareCardCanvas(forceTextOnly = false) {
  if (!currentPassage) return "";

  const context = shareCardCanvas.getContext("2d");
  const width = shareCardCanvas.width;
  const height = shareCardCanvas.height;
  const passageText = getPassageText(currentPassage);

  let imageForCanvas = null;
  const src = currentGeneratedImageSrc || messageImage.src || "";
  const wantImage = !forceTextOnly && Boolean(src);
  if (wantImage) {
    try {
      imageForCanvas = await getImageForCanvas(src);
    } catch (error) {
      console.warn("Could not prepare generated image for card canvas:", error);
      imageForCanvas = null;
    }
  }

  const background = context.createLinearGradient(0, 0, width, height);
  background.addColorStop(0, "#0b1020");
  background.addColorStop(0.48, "#172554");
  background.addColorStop(1, "#111827");
  context.fillStyle = background;
  context.fillRect(0, 0, width, height);

  const glowOne = context.createRadialGradient(170, 150, 0, 170, 150, 620);
  glowOne.addColorStop(0, "rgba(250, 204, 21, 0.34)");
  glowOne.addColorStop(1, "rgba(250, 204, 21, 0)");
  context.fillStyle = glowOne;
  context.fillRect(0, 0, width, height);

  const glowTwo = context.createRadialGradient(900, 1120, 0, 900, 1120, 620);
  glowTwo.addColorStop(0, "rgba(59, 130, 246, 0.34)");
  glowTwo.addColorStop(1, "rgba(59, 130, 246, 0)");
  context.fillStyle = glowTwo;
  context.fillRect(0, 0, width, height);

  context.textAlign = "center";
  context.fillStyle = "#facc15";
  context.font = "800 24px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
  context.letterSpacing = "4px";
  context.fillText("ENLIGHTEN-ME", 540, 80);
  context.letterSpacing = "0px";

  const hasImage = imageForCanvas !== null;

  if (hasImage) {
    context.save();
    drawRoundedRect(context, 24, 120, 1032, 650, 36);
    context.clip();
    const sourceRatio = imageForCanvas.naturalWidth / imageForCanvas.naturalHeight;
    const targetRatio = 1032 / 650;
    let drawW, drawH, drawX, drawY;
    if (sourceRatio > targetRatio) {
      drawH = 650;
      drawW = drawH * sourceRatio;
      drawX = 24 + (1032 - drawW) / 2;
      drawY = 120;
    } else {
      drawW = 1032;
      drawH = drawW / sourceRatio;
      drawX = 24;
      drawY = 120 + (650 - drawH) / 2;
    }
    context.drawImage(imageForCanvas, drawX, drawY, drawW, drawH);
    context.restore();

    context.save();
    context.fillStyle = "rgba(15, 23, 42, 0.78)";
    drawRoundedRect(context, 24, 800, 1032, 520, 32);
    context.fill();
    context.restore();

    drawShareCardText(context, passageText, currentPassage.reference, true);
  } else {
    context.save();
    context.fillStyle = "rgba(15, 23, 42, 0.62)";
    drawRoundedRect(context, 24, 120, 1032, 1200, 44);
    context.fill();
    context.restore();

    drawShareCardText(context, passageText, currentPassage.reference);
  }

  let dataUrl;
  try {
    dataUrl = shareCardCanvas.toDataURL("image/png");
  } catch (error) {
    if (hasImage) {
      console.warn("Share card export tainted; retrying without scripture image:", error);
      return await renderShareCardCanvas(true);
    }
    throw error;
  }

  currentShareCardDataUrl = dataUrl;
  shareCardPanel.hidden = false;
  shareCardPreview.src = currentShareCardDataUrl;
  shareCardPreview.hidden = false;
  setFocalCardVisible(true);
  closeCardButton.disabled = false;
  saveCardButton.disabled = false;
  shareCardImageButton.disabled = false;

  return currentShareCardDataUrl;
}

async function showShareCard() {
  if (!currentPassage) return;

  setActionStatus(t("card.composing"));
  try {
    await renderShareCardCanvas();
    trackMarketingEvent("share_card_created", currentPassageMarketingData());
    setActionStatus(t("card.ready"));
    scrollHomeFocalIntoView();
  } catch (error) {
    console.error("Share card render failed:", error);
    setActionStatus(t("card.could_not_create"));
  }
}

function closeShareCard() {
  resetShareCard();
  imagePanel.hidden = true;
  setActionStatus(t("card.closed"));
}

async function saveCurrentCardToLibrary() {
  if (!currentPassage) return;
  if (!currentShareCardDataUrl) await renderShareCardCanvas();

  const id = currentSavedCardId || `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const card = {
    id,
    reference: currentPassage.reference,
    passageText: getPassageText(currentPassage),
    verseIds: Array.isArray(currentPassage.verse_ids) ? currentPassage.verse_ids : [],
    passageId: currentPassage.id || "",
    dataUrl: currentShareCardDataUrl,
    createdAt: currentSavedCardId
      ? (savedCards.find((nextCard) => nextCard.id === currentSavedCardId)?.createdAt || new Date().toISOString())
      : new Date().toISOString(),
  };

  saveCardButton.disabled = true;
  try {
    await writeSavedCard(card);
    trackMarketingEvent("share_card_saved", currentPassageMarketingData());
    currentSavedCardId = id;
    await loadSavedCards();
    saveCardButton.textContent = t("card.button_saved");
    setActionStatus(t("card.saved_to_library"));
  } catch (error) {
    console.error(error);
    saveCardButton.disabled = false;
    setActionStatus(t("card.save_failed"));
  }
}

function dataUrlToBase64(dataUrl) {
  const idx = dataUrl.indexOf(",");
  return idx >= 0 ? dataUrl.slice(idx + 1) : dataUrl;
}

function dataUrlToBlob(dataUrl) {
  const [header, base64] = dataUrl.split(",");
  const mime = header?.match(/data:(.*?);base64/)?.[1] || "image/png";
  const binary = atob(base64 || "");
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }

  return new Blob([bytes], { type: mime });
}

async function shareDataUrlViaCapacitor(dataUrl, fileName, text) {
  const Plugins = window.Capacitor?.Plugins;
  if (!Plugins || !dataUrl) return false;

  if (Plugins.ImageShare?.shareImage) {
    await Plugins.ImageShare.shareImage({
      base64: dataUrlToBase64(dataUrl),
      dialogTitle: t("card.dialog_title"),
      text: text || "",
    });
    return true;
  }

  if (!Plugins.Filesystem || !Plugins.Share) return false;
  await Plugins.Filesystem.writeFile({
    path: fileName,
    data: dataUrlToBase64(dataUrl),
    directory: "DOCUMENTS",
  });
  const { uri } = await Plugins.Filesystem.getUri({
    path: fileName,
    directory: "DOCUMENTS",
  });
  await Plugins.Share.share({
    files: [uri],
    dialogTitle: t("card.dialog_title"),
  });
  return true;
}

async function shareCardDataUrl(dataUrl, fileName, text, statusTarget = setActionStatus) {
  try {
    if (window.Capacitor?.isNativePlatform?.()) {
      const ok = await shareDataUrlViaCapacitor(dataUrl, fileName, text);
      if (ok) {
        statusTarget(t("card.share_with_image"));
        return;
      }
    }

    const blob = dataUrlToBlob(dataUrl);
    const file = new File([blob], fileName, { type: "image/png" });

    if (navigator.canShare?.({ files: [file] }) && navigator.share) {
      await navigator.share({
        title: "Enlighten-Me",
        text,
        files: [file],
      });
      statusTarget(t("card.share_with_image"));
    } else if (navigator.share) {
      await navigator.share({ title: "Enlighten-Me", text });
      statusTarget(t("card.share_text_fallback"));
    } else {
      await navigator.clipboard.writeText(text);
      statusTarget(t("card.share_copy_fallback"));
    }
  } catch (error) {
    if (error?.name !== "AbortError" && error?.message !== "Share canceled") {
      console.error(error);
      statusTarget(t("card.share_failed"));
    }
  }
}

async function shareCardImage() {
  if (!currentPassage) return;
  trackMarketingEvent("share_card_share_started", currentPassageMarketingData());
  const dataUrl = currentShareCardDataUrl || (await renderShareCardCanvas());
  await shareCardDataUrl(dataUrl, getShareCardFileName(), getShareDestinationUrl());
}

async function shareActiveLibraryCard() {
  const card = getActiveLibraryCard();
  if (!card) return;
  await shareCardDataUrl(card.dataUrl, getLibraryCardFileName(card), getShareDestinationUrl(), (message) => {
    if (libraryStatus) libraryStatus.textContent = message;
  });
}

async function deleteActiveLibraryCard() {
  const card = getActiveLibraryCard();
  if (!card) return;

  const shouldDelete = window.confirm(t("card.delete_confirm", { reference: card.reference }));
  if (!shouldDelete) return;

  try {
    await removeSavedCard(card.id);
    if (currentSavedCardId === card.id) {
      currentSavedCardId = "";
      saveCardButton.textContent = t("card.button_save");
      saveCardButton.disabled = false;
    }
    savedCards = savedCards.filter((nextCard) => nextCard.id !== card.id);
    activeLibraryIndex = Math.max(0, activeLibraryIndex - 1);
    renderLibrary();
    if (libraryStatus) libraryStatus.textContent = t("card.deleted");
  } catch (error) {
    console.error(error);
    if (libraryStatus) libraryStatus.textContent = t("card.delete_failed");
  }
}

async function fetchPersonalImageSourceWithResumeRetry() {
  let lastError = null;

  for (let attempt = 0; attempt <= IMAGE_REQUEST_RETRY_LIMIT; attempt += 1) {
    if (attempt > 0) await waitForImageGenerationResume();

    try {
      const response = await fetch(apiUrl("/api/picture"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Enlighten-Product": IMAGE_PRODUCT_ID,
          ...(imageSubscription.entitlementToken ? { "X-Enlighten-Entitlement": imageSubscription.entitlementToken } : {}),
        },
        body: JSON.stringify({
          passage: getPassageText(currentPassage),
          reference: currentPassage.reference,
        }),
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload.error || t("image.failed_generic"));
      }

      const imageSource = findImageSource(payload);
      if (!imageSource) {
        throw new Error(t("image.no_image_returned"));
      }

      return imageSource;
    } catch (error) {
      lastError = error;
      const canRetry = imageGenerationInterruptedByBackground
        && isBackgroundLoadFailure(error)
        && attempt < IMAGE_REQUEST_RETRY_LIMIT;
      if (!canRetry) break;
    }
  }

  throw lastError || new Error(t("image.failed_generic"));
}

async function pictureThisMessage() {
  if (!currentPassage || isGeneratingImage) return;

  if (!hasImageSubscription()) {
    trackMarketingEvent("personal_image_locked", currentPassageMarketingData());
    showImageSubscriptionPrompt();
    return;
  }

  trackMarketingEvent("personal_image_started", currentPassageMarketingData());
  setImageLoading(true);
  showPleaseWait();
  currentGeneratedImageSrc = "";
  resetShareCard();
  messageImage.hidden = true;
  messageImage.removeAttribute("src");
  if (promptDetails) promptDetails.hidden = true;
  if (imagePrompt) imagePrompt.textContent = "";

  try {
    const imageSource = await fetchPersonalImageSourceWithResumeRetry();
    await preloadImage(imageSource);

    currentGeneratedImageSrc = imageSource;
    messageImage.src = imageSource;
    messageImage.alt = "";
    messageImage.hidden = true;
    imagePanel.hidden = false;
    imageStatus.hidden = false;
    imageStatus.textContent = t("card.composing_scripture");

    if (imagePrompt) imagePrompt.textContent = "";

    shareCardPanel.hidden = true;
    shareCardPreview.hidden = true;
    setActionStatus(t("card.composing_scripture"));

    try {
      await renderShareCardCanvas();
      imageStatus.textContent = "";
      imageStatus.hidden = true;
      imagePanel.hidden = true;
      trackMarketingEvent("personal_image_completed", currentPassageMarketingData({ fallback: false }));
      setActionStatus(t("card.ready_full"));
      scrollHomeFocalIntoView();
    } catch (cardError) {
      console.error("Scripture card render failed:", cardError);
      currentGeneratedImageSrc = "";

      try {
        await renderShareCardCanvas(true);
        imageStatus.textContent = "";
        imageStatus.hidden = true;
        imagePanel.hidden = true;
        trackMarketingEvent("personal_image_completed", currentPassageMarketingData({ fallback: true }));
        setActionStatus(t("card.ready_text_only"));
        scrollHomeFocalIntoView();
      } catch (fallbackError) {
        trackMarketingEvent("personal_image_failed", currentPassageMarketingData());
        console.error("Text-only card render failed:", fallbackError);
        imagePanel.hidden = false;
        imageStatus.hidden = false;
        imageStatus.textContent = t("card.could_not_finish");
        setActionStatus(t("card.could_not_create_scripture"));
      }
    }
  } catch (error) {
    trackMarketingEvent("personal_image_failed", currentPassageMarketingData());
    imagePanel.hidden = false;
    imageStatus.hidden = false;
    imageStatus.textContent = error.message || t("image.failed_generic");
  } finally {
    setImageLoading(false);
  }
}

function setScriptureControlsDisabled(disabled) {
  enlightenButton.disabled = disabled;
  copyButton.disabled = disabled || !currentPassage;
  shareCardButton.disabled = disabled || !currentPassage;
  pictureButton.disabled = disabled || !currentPassage;
  searchInput.disabled = disabled;
  bookSelect.disabled = disabled;
  chapterSelect.disabled = disabled;
  verseSelect.disabled = disabled;
  if (languageSelect) languageSelect.disabled = disabled;
}

function resetTestamentFilter() {
  activeTestament = "all";
  for (const pill of testamentFilter.querySelectorAll(".filter-pill")) {
    pill.setAttribute("aria-pressed", pill.dataset.testament === activeTestament ? "true" : "false");
  }
}

async function changeTranslation(nextTranslationKey) {
  if (!TRANSLATIONS[nextTranslationKey] || nextTranslationKey === activeTranslationKey) return;

  const previousTranslationKey = activeTranslationKey;
  setScriptureControlsDisabled(true);
  activeTranslationKey = nextTranslationKey;
  persistActiveTranslationKey();
  currentPassage = null;
  passageElement.textContent = t("home.loading");
  referenceElement.textContent = "—";
  resetImagePanel();

  try {
    await loadLocaleStrings();
    applyTranslations();
    await loadScriptureData();
    initializeBrowseControls();
    resetTestamentFilter();
    searchInput.value = "";
    renderSearchResults([], "");
    setScriptureControlsDisabled(false);
    enlighten();
    setActionStatus(t("status.language_changed"));
    trackMarketingEvent("language_selected", {
      previous_language: previousTranslationKey,
      selected_language: activeTranslationKey,
    });
    window.dispatchEvent(new CustomEvent("enlighten:language-changed"));
  } catch (error) {
    console.error(error);
    activeTranslationKey = previousTranslationKey;
    persistActiveTranslationKey();
    await loadLocaleStrings().catch(() => {});
    applyTranslations();
    setScriptureControlsDisabled(false);
    setActionStatus(t("home.scripture_load_failed"));
  }
}

function bindEvents() {
  bindAppLifecycleEvents();
  enlightenButton.addEventListener("click", enlighten);
  copyButton.addEventListener("click", copyCurrentPassage);
  shareCardButton.addEventListener("click", showShareCard);
  closeCardButton.addEventListener("click", closeShareCard);
  saveCardButton.addEventListener("click", saveCurrentCardToLibrary);
  shareCardImageButton.addEventListener("click", shareCardImage);
  subscribeButton.addEventListener("click", subscribeToImagePlan);
  restorePurchaseButton.addEventListener("click", restoreImagePlan);
  if (!isNativeAppRuntime()) {
    restorePurchaseButton.hidden = true;
  }
  if (isNativeAppRuntime()) {
    document.getElementById("refundFooterLink")?.remove();
  }
  settingsToggle.addEventListener("click", toggleSettings);
  languageSelect?.addEventListener("change", () => changeTranslation(languageSelect.value));
  document.getElementById("appStoreFooterLink")?.addEventListener("click", () => {
    trackMarketingEvent("app_store_clicked", { source: "footer" });
  });
  document.getElementById("appStoreBadgeLink")?.addEventListener("click", () => {
    trackMarketingEvent("app_store_clicked", { source: "home_badge" });
  });
  settingsBackButton.addEventListener("click", () => setSettingsOpen(false));
  libraryToggle.addEventListener("click", () => setLibraryOpen(true));
  libraryBackButton.addEventListener("click", () => setLibraryOpen(false));
  libraryPrevButton.addEventListener("click", () => showLibraryOffset(-1));
  libraryNextButton.addEventListener("click", () => showLibraryOffset(1));
  libraryShareButton.addEventListener("click", shareActiveLibraryCard);
  libraryDeleteButton.addEventListener("click", deleteActiveLibraryCard);
  libraryCardImage.addEventListener("touchstart", (event) => {
    libraryTouchStartX = event.touches?.[0]?.clientX || 0;
  });
  libraryCardImage.addEventListener("touchend", (event) => {
    const endX = event.changedTouches?.[0]?.clientX || 0;
    const deltaX = endX - libraryTouchStartX;
    if (Math.abs(deltaX) > 40) showLibraryOffset(deltaX < 0 ? 1 : -1);
  });
  pictureButton.addEventListener("click", pictureThisMessage);

  searchInput.addEventListener("input", runSearch);

  testamentFilter.addEventListener("click", (event) => {
    const pill = event.target.closest(".filter-pill");
    if (!pill) return;
    setTestamentFilter(pill.dataset.testament);
  });

  searchResults.addEventListener("click", (event) => {
    const resultRow = event.target.closest("[data-verse-id]");
    if (!resultRow) return;

    const verse = versesById.get(resultRow.dataset.verseId);
    if (verse) selectVerse(verse, { status: t("status.selected_from_search", { reference: verse.reference }) });
  });

  bookSelect.addEventListener("change", () => {
    populateChapterSelect(bookSelect.value, 1);
    renderChapterVerses(bookSelect.value, Number(chapterSelect.value));
  });

  chapterSelect.addEventListener("change", () => {
    populateVerseSelect(bookSelect.value, Number(chapterSelect.value), 1);
    renderChapterVerses(bookSelect.value, Number(chapterSelect.value));
  });

  verseSelect.addEventListener("change", () => {
    const verse = versesByBookChapter
      .get(getChapterKey(bookSelect.value, Number(chapterSelect.value)))
      ?.find((nextVerse) => nextVerse.verse === Number(verseSelect.value));

    if (verse) selectVerse(verse, { status: t("status.selected_from_browse", { reference: verse.reference }) });
  });

  chapterVerses.addEventListener("click", (event) => {
    const verseRow = event.target.closest("[data-verse-id]");
    if (!verseRow) return;

    const verse = versesById.get(verseRow.dataset.verseId);
    if (verse) selectVerse(verse, { status: t("status.selected_from_browse", { reference: verse.reference }) });
  });
}

async function initializeApp() {
  enlightenButton.disabled = true;
  copyButton.disabled = true;
  shareCardButton.disabled = true;
  closeCardButton.disabled = true;
  saveCardButton.disabled = true;
  shareCardImageButton.disabled = true;
  pictureButton.disabled = true;
  subscribeButton.disabled = true;
  restorePurchaseButton.disabled = true;
  searchInput.disabled = true;
  bookSelect.disabled = true;
  chapterSelect.disabled = true;
  verseSelect.disabled = true;
  referenceElement.textContent = "—";

  try {
    persistActiveTranslationKey();
    await loadLocaleStrings();
    applyTranslations();
    passageElement.textContent = t("home.loading");
    await loadScriptureData();
    await loadImageSubscription();
    await loadSavedCards();
    initializeBrowseControls();
    renderSearchResults([], "");
    bindEvents();
    openInitialViewFromUrl();

    enlightenButton.disabled = false;
    subscribeButton.disabled = hasImageSubscription();
    restorePurchaseButton.disabled = false;
    searchInput.disabled = false;
    bookSelect.disabled = false;
    chapterSelect.disabled = false;
    verseSelect.disabled = false;

    enlighten();
    trackMarketingEvent("web_visit");
    armEngagementSignal();
  } catch (error) {
    passageElement.textContent = t("home.scripture_load_failed");
    referenceElement.textContent = "—";
    console.error(error);
  }
}

initializeApp();
