// /mobileweb is the scripture-first paid-traffic landing page. It is web-only
// and deliberately does not share the Capacitor bundle, so work here cannot
// change the iOS experience. Google Ads passes the searched term through
// ?verse=, ?keyword= or utm_term so the page opens on what the visitor asked
// for; it also handles manual searching and browsing.

const PRODUCTION_ORIGIN = "https://www.enlighten-me.co";
const DEVICE_ID_STORAGE_KEY = "enlighten.deviceId.v1";
const IMAGE_PRODUCT_ID = "enlighten_ai_images_monthly";
const MARKETING_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "gclid", "gbraid", "wbraid"];
const MAX_SEARCH_RESULTS = 12;

const searchForm = document.getElementById("scriptureSearchForm");
const searchInput = document.getElementById("scriptureSearch");
const browseToggle = document.getElementById("browseToggle");
const browsePanel = document.getElementById("browsePanel");
const bookSelect = document.getElementById("bookSelect");
const chapterSelect = document.getElementById("chapterSelect");
const openChapterButton = document.getElementById("openChapterButton");
const contentRegion = document.getElementById("contentRegion");
const artOffer = document.getElementById("artOffer");
const artOfferCopy = document.getElementById("artOfferCopy");
const createArtButton = document.getElementById("createArtButton");
const generationPanel = document.getElementById("generationPanel");
const generationProgress = document.getElementById("generationProgress");
const generationResult = document.getElementById("generationResult");
const generatedImage = document.getElementById("generatedImage");
const generationError = document.getElementById("generationError");

let books = [];
let verses = [];
let booksById = new Map();
let bookAliases = [];
let currentVerse = null;
let isGenerating = false;
let hasTrackedEngagement = false;

function isLocalStaticOrigin() {
  return ["localhost", "127.0.0.1"].includes(window.location.hostname);
}

function apiUrl(path) {
  return isLocalStaticOrigin() ? `${PRODUCTION_ORIGIN}${path}` : path;
}

function getDeviceId() {
  try {
    let id = localStorage.getItem(DEVICE_ID_STORAGE_KEY);
    if (!id) {
      id = window.crypto?.randomUUID?.() || `web-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      localStorage.setItem(DEVICE_ID_STORAGE_KEY, id);
    }
    return id;
  } catch (_) {
    return "";
  }
}

function cleanMarketingValue(value) {
  return String(value || "").trim().slice(0, 180);
}

function marketingContext(extra = {}) {
  const context = { page: "mobileweb", ...extra };
  try {
    const params = new URLSearchParams(window.location.search);
    for (const key of MARKETING_KEYS) {
      const value = cleanMarketingValue(params.get(key));
      if (value) context[key] = value;
    }
  } catch (_) {
    // Tracking is strictly best-effort.
  }
  return context;
}

function track(eventName, data = {}) {
  if (isLocalStaticOrigin()) {
    console.info("[mobileweb-analytics]", eventName, data);
    return;
  }

  const context = marketingContext(data);
  try {
    if (typeof window.gtag === "function" && window.GA4_MEASUREMENT_ID) {
      window.gtag("event", eventName, { send_to: window.GA4_MEASUREMENT_ID, ...context });
    }
  } catch (_) {
    // Analytics must never affect reading Scripture.
  }

  try {
    const body = JSON.stringify({ event: eventName, data: context });
    const url = apiUrl("/api/marketing-event");
    if (navigator.sendBeacon) {
      navigator.sendBeacon(url, new Blob([body], { type: "application/json" }));
    } else {
      fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        keepalive: true,
      }).catch(() => {});
    }
  } catch (_) {
    // ditto
  }
}

function normalize(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[’'.,]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function makeElement(name, className, text) {
  const element = document.createElement(name);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function clearElement(element) {
  element.replaceChildren();
}

function setContentBusy(isBusy) {
  contentRegion.setAttribute("aria-busy", String(isBusy));
}

function showLoading(message = "Loading KJV Scripture…") {
  clearElement(contentRegion);
  const card = makeElement("div", "loading-card");
  card.append(makeElement("span", "loading-mark"), makeElement("p", "", message));
  contentRegion.append(card);
  setContentBusy(true);
}

function showEmpty(title, detail) {
  clearElement(contentRegion);
  const card = makeElement("div", "empty-state");
  card.append(makeElement("strong", "", title), makeElement("p", "", detail));
  contentRegion.append(card);
  setContentBusy(false);
}

function buildBookAliases() {
  const aliases = [];
  for (const book of books) {
    const candidates = new Set([
      book.name,
      book.abbreviation,
      book.id.replace(/-/g, " "),
    ]);
    for (const alias of candidates) {
      const value = normalize(alias);
      if (value) aliases.push({ alias: value, book });
    }
  }
  // Longest first prevents "John" from winning before "1 John".
  bookAliases = aliases.sort((a, b) => b.alias.length - a.alias.length);
}

function populateBooks() {
  clearElement(bookSelect);
  const placeholder = new Option("Choose a book", "");
  bookSelect.add(placeholder);
  for (const book of books) bookSelect.add(new Option(book.name, book.id));
  bookSelect.disabled = false;
  chapterSelect.disabled = true;
  openChapterButton.disabled = true;
}

function populateChapters(bookId, selectedChapter = "") {
  const book = booksById.get(bookId);
  clearElement(chapterSelect);
  chapterSelect.add(new Option(book ? "Choose a chapter" : "Choose a book first", ""));
  if (!book) {
    chapterSelect.disabled = true;
    openChapterButton.disabled = true;
    return;
  }
  for (let chapter = 1; chapter <= book.chapters; chapter += 1) {
    chapterSelect.add(new Option(String(chapter), String(chapter)));
  }
  chapterSelect.disabled = false;
  chapterSelect.value = String(selectedChapter || "");
  openChapterButton.disabled = !chapterSelect.value;
}

function parseReference(value) {
  const source = normalize(value).replace(/[–—-]/g, "-");
  if (!source || source.includes("{") || source.includes("}")) return null;

  for (const { alias, book } of bookAliases) {
    const prefix = new RegExp(`^${escapeRegExp(alias)}(?:\\s|$)`);
    if (!prefix.test(source)) continue;
    const remainder = source.slice(alias.length).trim();
    const match = remainder.match(/^(\d+)(?:\s*:\s*|\s+)(\d+)(?:\s*-\s*\d+)?$/) || remainder.match(/^(\d+)$/);
    if (!match) continue;

    const chapter = Number(match[1]);
    const verse = match[2] ? Number(match[2]) : null;
    if (!Number.isInteger(chapter) || chapter < 1 || chapter > book.chapters) return null;
    if (verse !== null && (!Number.isInteger(verse) || verse < 1)) return null;
    return { book, chapter, verse };
  }
  return null;
}

function findVerse(reference) {
  const parsed = parseReference(reference);
  if (!parsed?.verse) return null;
  return verses.find((verse) => verse.book_id === parsed.book.id && verse.chapter === parsed.chapter && verse.verse === parsed.verse) || null;
}

function getInitialIntent() {
  try {
    const params = new URLSearchParams(window.location.search);
    for (const key of ["verse", "keyword", "utm_term"]) {
      const value = cleanMarketingValue(params.get(key));
      if (value && !value.includes("{") && !value.includes("}")) return { value, source: key };
    }
  } catch (_) {
    // The ordinary landing state remains usable if URL parsing fails.
  }
  return null;
}

function updateVerseUrl(reference) {
  try {
    const url = new URL(window.location.href);
    url.searchParams.set("verse", reference);
    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
  } catch (_) {
    // A selected verse is still readable if history access is unavailable.
  }
}

function scrollToContent() {
  contentRegion.scrollIntoView({ behavior: "smooth", block: "start" });
}

function setCurrentVerse(verse, source) {
  currentVerse = verse;
  artOfferCopy.textContent = `${verse.reference} is open. Create a one-of-a-kind image from this verse whenever you are ready.`;
  artOffer.hidden = false;
  updateVerseUrl(verse.reference);
  track("scripture_opened", { reference: verse.reference, open_source: source });
}

function renderPassage(verse, source) {
  clearElement(contentRegion);
  const figure = makeElement("figure", "passage-card");
  const label = makeElement("span", "passage-reference", "KJV Scripture");
  const quote = makeElement("blockquote", "", `“${verse.text}”`);
  const caption = makeElement("figcaption", "", verse.reference);
  figure.append(label, quote, caption);
  contentRegion.append(figure);
  setContentBusy(false);
  setCurrentVerse(verse, source);
}

function renderChapter(book, chapter, source) {
  const chapterVerses = verses.filter((verse) => verse.book_id === book.id && verse.chapter === chapter);
  if (!chapterVerses.length) {
    showEmpty("That chapter is not available yet.", "Try another chapter or use the search above.");
    return;
  }

  currentVerse = null;
  artOffer.hidden = true;
  clearElement(contentRegion);

  const card = makeElement("section", "chapter-card");
  card.append(
    makeElement("span", "chapter-reference", "KJV Scripture"),
    makeElement("h2", "", `${book.name} ${chapter}`),
    makeElement("p", "", "Tap a verse to read it on its own and create a card from it."),
  );
  const list = makeElement("div", "chapter-verses");
  for (const verse of chapterVerses) {
    const button = makeElement("button", "chapter-verse");
    button.type = "button";
    button.append(makeElement("span", "verse-number", String(verse.verse)), makeElement("span", "verse-text", verse.text));
    button.addEventListener("click", () => {
      renderPassage(verse, "chapter_verse");
      scrollToContent();
    });
    list.append(button);
  }
  card.append(list);
  contentRegion.append(card);
  setContentBusy(false);
  updateVerseUrl(`${book.name} ${chapter}`);
  track("chapter_opened", { reference: `${book.name} ${chapter}`, open_source: source });
}

function verseSearchScore(verse, terms) {
  const reference = normalize(verse.reference);
  const text = normalize(verse.text);
  let score = 0;
  for (const term of terms) {
    if (reference.includes(term)) score += 8;
    if (text.includes(term)) score += 2;
  }
  return score;
}

function renderSearchResults(query) {
  const terms = normalize(query).split(" ").filter((term) => term.length > 1);
  const matches = terms.length
    ? verses
      .filter((verse) => {
        const haystack = `${normalize(verse.reference)} ${normalize(verse.text)}`;
        return terms.every((term) => haystack.includes(term));
      })
      .sort((a, b) => verseSearchScore(b, terms) - verseSearchScore(a, terms))
      .slice(0, MAX_SEARCH_RESULTS)
    : [];

  currentVerse = null;
  artOffer.hidden = true;
  clearElement(contentRegion);

  const summary = makeElement("div", "search-summary");
  const summaryText = makeElement("p");
  if (matches.length) {
    summaryText.append(makeElement("strong", "", matches.length === MAX_SEARCH_RESULTS ? "Here are the first 12 matches." : `${matches.length} match${matches.length === 1 ? "" : "es"}.`));
    summaryText.append(` Tap a verse to read it.`);
  } else {
    summaryText.append(makeElement("strong", "", "No exact text matches."));
    summaryText.append(" Try a book and chapter such as Psalm 23, a reference such as Romans 8:28, or browse by book.");
  }
  summary.append(summaryText);
  contentRegion.append(summary);

  if (matches.length) {
    const list = makeElement("div", "results-list");
    for (const verse of matches) {
      const result = makeElement("button", "search-result");
      result.type = "button";
      result.append(makeElement("span", "result-reference", verse.reference), makeElement("p", "result-text", verse.text));
      result.addEventListener("click", () => {
        renderPassage(verse, "search_result");
        scrollToContent();
      });
      list.append(result);
    }
    contentRegion.append(list);
  }

  setContentBusy(false);
  track("scripture_search", {
    query_length: String(query).trim().length,
    result_count: matches.length,
    exact_reference: false,
  });
}

function runSearch(query, source = "search") {
  const cleaned = String(query || "").trim();
  if (!cleaned) {
    showEmpty("What would you like to read?", "Try Psalm 23, Romans 8:28, or a phrase such as fear not.");
    artOffer.hidden = true;
    return;
  }

  const parsed = parseReference(cleaned);
  if (parsed) {
    if (parsed.verse) {
      const verse = findVerse(cleaned);
      if (verse) {
        renderPassage(verse, source);
        track("scripture_search", { query_length: cleaned.length, result_count: 1, exact_reference: true });
        return;
      }
    } else {
      renderChapter(parsed.book, parsed.chapter, source);
      track("scripture_search", { query_length: cleaned.length, result_count: 1, exact_reference: true, chapter_query: true });
      return;
    }
  }

  renderSearchResults(cleaned);
}

function openBrowse() {
  browsePanel.hidden = false;
  browseToggle.setAttribute("aria-expanded", "true");
  track("browse_opened", {});
}

function closeBrowse() {
  browsePanel.hidden = true;
  browseToggle.setAttribute("aria-expanded", "false");
}

async function requestGeneratedArt(verse) {
  const response = await fetch(apiUrl("/api/picture"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Enlighten-Product": IMAGE_PRODUCT_ID,
      "X-Enlighten-Device": getDeviceId(),
    },
    body: JSON.stringify({ passage: verse.text, reference: verse.reference }),
  });
  const payload = await response.json().catch(() => ({}));
  if (response.status === 402) {
    const error = new Error(payload.error || "Your free image has been used.");
    error.code = "free_used";
    throw error;
  }
  if (!response.ok) throw new Error(payload.error || "Image creation failed.");
  const source = payload.imageDataUrl || payload.imageUrl;
  if (!source) throw new Error("Image creation finished, but no image came back.");
  return source;
}

async function createArt() {
  if (!currentVerse || isGenerating) return;
  isGenerating = true;
  createArtButton.disabled = true;
  generationPanel.hidden = false;
  generationProgress.hidden = false;
  generationResult.hidden = true;
  generationError.hidden = true;
  generationPanel.scrollIntoView({ behavior: "smooth", block: "center" });
  track("art_offer_clicked", { reference: currentVerse.reference });

  try {
    const imageSource = await requestGeneratedArt(currentVerse);
    generatedImage.src = imageSource;
    generationProgress.hidden = true;
    generationResult.hidden = false;
    track("free_image_generated", { reference: currentVerse.reference });
  } catch (error) {
    generationProgress.hidden = true;
    generationError.hidden = false;
    if (error?.code === "free_used") {
      generationError.textContent = "Your free image has already been used. Scripture is still free to read, and you can subscribe from the main site for more creations.";
    }
    track("art_generation_failed", { reference: currentVerse.reference, free_used: error?.code === "free_used" });
  } finally {
    isGenerating = false;
    createArtButton.disabled = false;
  }
}

async function fetchJson(path) {
  const response = await fetch(path, { cache: "force-cache" });
  if (!response.ok) throw new Error(`Could not load ${path}`);
  return response.json();
}

function initializeEngagementTracking() {
  window.setTimeout(() => {
    if (!hasTrackedEngagement && !document.hidden) {
      hasTrackedEngagement = true;
      track("scripture_landing_engaged", { engaged_seconds: 10 });
    }
  }, 10_000);

  document.addEventListener("pointerdown", () => {
    if (!hasTrackedEngagement) {
      hasTrackedEngagement = true;
      track("scripture_landing_engaged", { engaged_seconds: 0, engaged_by: "interaction" });
    }
  }, { once: true, passive: true });
}

function bindEvents() {
  searchForm.addEventListener("submit", (event) => {
    event.preventDefault();
    runSearch(searchInput.value, "search_form");
    scrollToContent();
  });

  browseToggle.addEventListener("click", () => {
    if (browsePanel.hidden) {
      openBrowse();
      bookSelect.focus();
    } else {
      closeBrowse();
    }
  });

  bookSelect.addEventListener("change", () => populateChapters(bookSelect.value));
  chapterSelect.addEventListener("change", () => {
    openChapterButton.disabled = !chapterSelect.value;
  });
  openChapterButton.addEventListener("click", () => {
    const book = booksById.get(bookSelect.value);
    const chapter = Number(chapterSelect.value);
    if (!book || !chapter) return;
    renderChapter(book, chapter, "browse");
    scrollToContent();
  });
  createArtButton.addEventListener("click", createArt);
}

async function initialize() {
  showLoading();
  bindEvents();
  initializeEngagementTracking();

  try {
    [books, verses] = await Promise.all([
      fetchJson("data/kjv/books.json"),
      fetchJson("data/kjv/verses.json"),
    ]);
    booksById = new Map(books.map((book) => [book.id, book]));
    buildBookAliases();
    populateBooks();

    const initialIntent = getInitialIntent();
    if (initialIntent) {
      searchInput.value = initialIntent.value;
      runSearch(initialIntent.value, `url_${initialIntent.source}`);
      const parsed = parseReference(initialIntent.value);
      track("web_visit", {
        landing_intent_source: initialIntent.source,
        intent_matched: Boolean(parsed),
      });
    } else {
      showEmpty("What would you like to read?", "Search for a verse, a book and chapter, or words from Scripture.");
      track("web_visit", { landing_intent_source: "none", intent_matched: false });
    }
  } catch (error) {
    console.error("Could not load Scripture data", error);
    showEmpty("Scripture could not load just now.", "Please check your connection and try again.");
    track("scripture_load_failed", {});
  }
}

initialize();
