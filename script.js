if (typeof window !== "undefined" && window.Capacitor?.Plugins?.EnlightenSubscriptions && !window.EnlightenSubscriptions) {
  window.EnlightenSubscriptions = window.Capacitor.Plugins.EnlightenSubscriptions;
}

const BOOKS_DATA_URL = "./data/kjv/books.json";
const PASSAGES_DATA_URL = "./data/kjv/passages.json";
const VERSES_DATA_URL = "./data/kjv/verses.json";
const MAX_SEARCH_RESULTS = 50;
const IMAGE_PRODUCT_ID = "enlighten_ai_images_monthly";
const IMAGE_PRICE_LABEL = "$3/month";
const WEB_PREVIEW_ENTITLEMENT_KEY = "enlighten.previewImageSubscription";
const LIBRARY_DB_NAME = "enlightenCardLibrary";
const LIBRARY_DB_VERSION = 1;
const LIBRARY_STORE_NAME = "cards";

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
let actionStatusTimer = null;

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
    fetchJson(BOOKS_DATA_URL, "book data"),
    fetchJson(PASSAGES_DATA_URL, "passage data"),
    fetchJson(VERSES_DATA_URL, "KJV verse data"),
  ]);

  validateBooks(nextBooks);
  const nextVersesById = buildVerseIndex(nextVerses);
  validatePassages(nextPassages, nextVersesById);

  books = nextBooks;
  passages = nextPassages;
  verses = nextVerses;
  versesById = nextVersesById;
  versesByBookChapter = buildBookChapterIndex(nextVerses);
}

function getPassageText(passage) {
  if (!passage || !Array.isArray(passage.verse_ids)) return "";

  return passage.verse_ids
    .map((verseId) => versesById.get(verseId)?.text || "")
    .filter(Boolean)
    .join(" ");
}

const SHARE_URL = "https://www.enlighten-me.co";
const SHARE_URL_DISPLAY = "enlighten-me.co";

function getShareText() {
  if (!currentPassage) return "";
  return `${getPassageText(currentPassage)}\n\n— ${currentPassage.reference} (KJV)\n${SHARE_URL}`;
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

const REMOTE_API_BASE = "https://enlighten-me.co";

function apiUrl(path) {
  return isNativeAppRuntime() ? `${REMOTE_API_BASE}${path}` : path;
}

function hasImageSubscription() {
  return Boolean(imageSubscription.isActive);
}

function updateSubscriptionUi() {
  const active = hasImageSubscription();
  const nativeLabel = isNativeAppRuntime() ? "StoreKit" : "web preview";

  const sourceLabel = imageSubscription.source || nativeLabel;

  subscriptionPanel.classList.toggle("is-subscribed", active);
  subscriptionStatusBadge.textContent = active ? "Image creation active" : "Image creation not active";
  subscriptionStatusBadge.classList.toggle("is-active", active);
  subscriptionStatus.textContent = active
    ? `Active via ${sourceLabel}. Renews monthly.`
    : `${IMAGE_PRICE_LABEL} - unlocks unlimited image creation to bring your favorite verses to life`;
  subscribeButton.textContent = active
    ? "Image Creation Active"
    : `Step 2 of 2: click here to subscribe for ${IMAGE_PRICE_LABEL}`;
  subscribeButton.disabled = active;
  restorePurchaseButton.disabled = false;
  pictureButton.textContent = getPictureButtonLabel(active);
}

function getPictureButtonLabel(active = hasImageSubscription()) {
  return active ? "Create Scripture Card" : "Unlock Image Creation";
}

function showView(viewName) {
  const showingHome = viewName === "home";
  homeView.hidden = !showingHome;
  settingsView.hidden = viewName !== "settings";
  libraryView.hidden = viewName !== "library";
  settingsToggle.setAttribute("aria-expanded", String(viewName === "settings"));
  window.scrollTo({ top: 0, behavior: "smooth" });
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
  if (view !== "settings" && view !== "library") return;
  if (view === "settings") setSettingsOpen(true);
  if (view === "library") setLibraryOpen(true);
  params.delete("view");
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
    if (libraryStatus) libraryStatus.textContent = "Library storage is not available on this device.";
  }

  renderLibrary();
}

function formatSavedCardDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Saved on this device";
  return `Saved ${date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`;
}

function updateLibraryButton() {
  if (!libraryToggle) return;
  libraryToggle.textContent = savedCards.length ? `Library (${savedCards.length})` : "Library";
}

function renderLibrary() {
  updateLibraryButton();

  if (!libraryEmptyState || !libraryViewer) return;
  const hasCards = savedCards.length > 0;
  libraryEmptyState.hidden = hasCards;
  libraryViewer.hidden = !hasCards;

  if (librarySubtitle) {
    librarySubtitle.textContent = hasCards
      ? `${savedCards.length} saved scripture card${savedCards.length === 1 ? "" : "s"} on this device.`
      : "Saved scripture cards live on this device.";
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
  libraryCardImage.alt = `${card.reference} scripture card`;
  libraryCardReference.textContent = card.reference || "Saved card";
  libraryCardDate.textContent = `${formatSavedCardDate(card.createdAt)} · ${activeLibraryIndex + 1} of ${savedCards.length}`;
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
}

async function subscribeToImagePlan() {
  try {
    if (window.EnlightenSubscriptions?.purchase) {
      imageSubscription = {
        ...imageSubscription,
        ...(await window.EnlightenSubscriptions.purchase(nativeBridgeArgs())),
        source: "StoreKit",
      };
    } else if (window.EnlightenWeb?.startSubscribe) {
      setActionStatus("Redirecting to checkout…");
      await window.EnlightenWeb.startSubscribe();
      return;
    } else {
      window.localStorage.setItem(WEB_PREVIEW_ENTITLEMENT_KEY, "active");
      imageSubscription = { ...imageSubscription, isActive: true, source: "web preview" };
    }

    updateSubscriptionUi();
    setActionStatus("Image creation subscription is active.");
  } catch (error) {
    if (error?.name !== "AbortError") {
      console.error(error);
      setActionStatus(error?.message || "Subscription could not be completed. Please try again.");
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
        setActionStatus(`Subscription found, but server token failed: ${exchangeError}`);
      } else {
        setActionStatus("Purchase restored.");
      }
    } else {
      setActionStatus("No active subscription found.");
    }
  } catch (error) {
    console.error(error);
    setActionStatus(`Restore failed: ${error?.message || "Please try again."}`);
  }
}

function showImageSubscriptionPrompt() {
  setSettingsOpen(true);
  setActionStatus(`Image creation requires the ${IMAGE_PRICE_LABEL} subscription. Scripture features remain free.`);
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
  pictureButton.disabled = isLoading || !currentPassage;
  pictureButton.textContent = isLoading ? "Creating…" : getPictureButtonLabel();
  imagePanel.classList.toggle("is-loading", isLoading);
}

function showPleaseWait() {
  imagePanel.hidden = false;
  imageStatus.hidden = false;
  imageStatus.innerHTML = `
    <span class="spinner-clock" aria-hidden="true"></span>
    <span>Please wait — creating your illustration.</span>
  `;
}

function preloadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(src);
    image.onerror = () => reject(new Error("The illustration could not be loaded. Please try again."));
    image.src = src;
  });
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
    translation: "KJV",
    verse_ids: [verse.id],
    passage_type: "single_verse",
    source: "local_kjv_verse",
  };
}

function selectVerse(verse, options = {}) {
  setCurrentPassage(createPassageFromVerse(verse), {
    status: options.status || `Selected ${verse.reference}.`,
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
    return `<option value="${chapterNumber}">Chapter ${chapterNumber}</option>`;
  }).join("");

  chapterSelect.value = String(Math.min(selectedChapter, book.chapters));
  populateVerseSelect(bookId, Number(chapterSelect.value), 1);
}

function populateVerseSelect(bookId, chapter, selectedVerse = 1) {
  const chapterVersesForSelection = versesByBookChapter.get(getChapterKey(bookId, chapter)) || [];

  verseSelect.innerHTML = chapterVersesForSelection
    .map((verse) => `<option value="${verse.verse}">Verse ${verse.verse}</option>`)
    .join("");

  const selectedVerseExists = chapterVersesForSelection.some((verse) => verse.verse === selectedVerse);
  verseSelect.value = String(selectedVerseExists ? selectedVerse : chapterVersesForSelection[0]?.verse || 1);
}

function renderChapterVerses(bookId, chapter, activeVerseNumber = Number(verseSelect.value)) {
  const chapterVersesForSelection = versesByBookChapter.get(getChapterKey(bookId, chapter)) || [];
  const book = books.find((nextBook) => nextBook.id === bookId);

  browseMeta.textContent = book
    ? `${book.name} ${chapter} — ${chapterVersesForSelection.length} verses. Tap a verse to use it.`
    : "Select a book, chapter, and verse.";

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

function matchesTestament(verse, testament) {
  if (testament === "old") return verse.testament === "Old";
  if (testament === "new") return verse.testament === "New";
  return true;
}

function testamentLabel(testament) {
  if (testament === "old") return "Old Testament";
  if (testament === "new") return "New Testament";
  return "KJV";
}

function searchVerses(query, testament = activeTestament) {
  const normalizedQuery = normalizeSearchQuery(query);
  if (normalizedQuery.length < 2) return [];

  const pool = testament === "all" ? verses : verses.filter((verse) => matchesTestament(verse, testament));

  const exactReferenceMatches = pool.filter((verse) => verse.reference.toLowerCase() === normalizedQuery);
  const textMatches = pool.filter((verse) => {
    const haystack = `${verse.reference} ${verse.text}`.toLowerCase();
    return haystack.includes(normalizedQuery);
  });

  return [...exactReferenceMatches, ...textMatches]
    .filter((verse, index, allMatches) => allMatches.findIndex((match) => match.id === verse.id) === index)
    .slice(0, MAX_SEARCH_RESULTS);
}

function renderSearchResults(results, query, testament = activeTestament) {
  const scope = testamentLabel(testament);

  if (!query) {
    searchMeta.textContent = testament === "all"
      ? "Search all 31,102 KJV verses locally."
      : `Searching ${scope} verses only.`;
    searchResults.innerHTML = "";
    return;
  }

  if (query.length < 2) {
    searchMeta.textContent = "Type at least 2 characters.";
    searchResults.innerHTML = "";
    return;
  }

  if (results.length === 0) {
    searchMeta.textContent = `No ${scope} matches for “${query}”.`;
    searchResults.innerHTML = "";
    return;
  }

  const cappedLabel = results.length === MAX_SEARCH_RESULTS ? `Top ${MAX_SEARCH_RESULTS}` : results.length;
  searchMeta.textContent = `${cappedLabel} ${scope} match${results.length === 1 ? "" : "es"} for “${query}”.`;
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
  renderSearchResults(searchVerses(query), query);
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
    setActionStatus("Copied passage to clipboard.");
  } catch (error) {
    console.error(error);
    setActionStatus("Copy failed. Select and copy the passage manually.");
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
  saveCardButton.textContent = "Save to Library";
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
  context.fillText(`— ${reference} (KJV)`, 540, y + referenceGap, maxWidth);

  context.save();
  context.fillStyle = "rgba(248, 250, 252, 0.78)";
  context.font = `600 24px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`;
  context.textAlign = "center";
  context.textBaseline = "alphabetic";
  context.fillText(SHARE_URL_DISPLAY, 540, 1300);
  context.restore();
}

function loadCanvasImage(src, options = {}) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (options.crossOrigin) {
      img.crossOrigin = options.crossOrigin;
    }
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Image load failed for canvas use."));
    img.src = src;
  });
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
  context.fillText("ENLIGHTEN", 540, 80);
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

  setActionStatus("Composing share card…");
  try {
    await renderShareCardCanvas();
    setActionStatus("Share card ready.");
    scrollHomeFocalIntoView();
  } catch (error) {
    console.error("Share card render failed:", error);
    setActionStatus("Could not create share card.");
  }
}

function closeShareCard() {
  resetShareCard();
  imagePanel.hidden = true;
  setActionStatus("Card closed.");
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
    currentSavedCardId = id;
    await loadSavedCards();
    saveCardButton.textContent = "Saved";
    setActionStatus("Saved to Library.");
  } catch (error) {
    console.error(error);
    saveCardButton.disabled = false;
    setActionStatus("Could not save card to Library.");
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

async function shareDataUrlViaCapacitor(dataUrl, fileName) {
  const Plugins = window.Capacitor?.Plugins;
  if (!Plugins || !dataUrl) return false;

  if (Plugins.ImageShare?.shareImage) {
    await Plugins.ImageShare.shareImage({
      base64: dataUrlToBase64(dataUrl),
      dialogTitle: "Share scripture card",
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
    dialogTitle: "Share scripture card",
  });
  return true;
}

async function shareCardDataUrl(dataUrl, fileName, text, statusTarget = setActionStatus) {
  try {
    if (window.Capacitor?.isNativePlatform?.()) {
      const ok = await shareDataUrlViaCapacitor(dataUrl, fileName);
      if (ok) {
        statusTarget("Share sheet opened with image card.");
        return;
      }
    }

    const blob = dataUrlToBlob(dataUrl);
    const file = new File([blob], fileName, { type: "image/png" });

    if (navigator.canShare?.({ files: [file] }) && navigator.share) {
      await navigator.share({
        title: "Enlighten",
        text,
        files: [file],
      });
      statusTarget("Share sheet opened with image card.");
    } else if (navigator.share) {
      await navigator.share({ title: "Enlighten", text });
      statusTarget("Image sharing is not available here, so text share opened.");
    } else {
      await navigator.clipboard.writeText(text);
      statusTarget("Image sharing is not available here, so text was copied.");
    }
  } catch (error) {
    if (error?.name !== "AbortError" && error?.message !== "Share canceled") {
      console.error(error);
      statusTarget("Share image failed. Please try again.");
    }
  }
}

async function shareCardImage() {
  if (!currentPassage) return;
  const dataUrl = currentShareCardDataUrl || (await renderShareCardCanvas());
  const text = `${currentPassage.reference} (KJV)\n${SHARE_URL}`;
  await shareCardDataUrl(dataUrl, getShareCardFileName(), text);
}

async function shareActiveLibraryCard() {
  const card = getActiveLibraryCard();
  if (!card) return;
  const text = `${card.reference} (KJV)\n${SHARE_URL}`;
  await shareCardDataUrl(card.dataUrl, getLibraryCardFileName(card), text, (message) => {
    if (libraryStatus) libraryStatus.textContent = message;
  });
}

async function deleteActiveLibraryCard() {
  const card = getActiveLibraryCard();
  if (!card) return;

  const shouldDelete = window.confirm(`Delete the saved card for ${card.reference}?`);
  if (!shouldDelete) return;

  try {
    await removeSavedCard(card.id);
    if (currentSavedCardId === card.id) {
      currentSavedCardId = "";
      saveCardButton.textContent = "Save to Library";
      saveCardButton.disabled = false;
    }
    savedCards = savedCards.filter((nextCard) => nextCard.id !== card.id);
    activeLibraryIndex = Math.max(0, activeLibraryIndex - 1);
    renderLibrary();
    if (libraryStatus) libraryStatus.textContent = "Deleted saved card.";
  } catch (error) {
    console.error(error);
    if (libraryStatus) libraryStatus.textContent = "Could not delete saved card.";
  }
}

async function pictureThisMessage() {
  if (!currentPassage || isGeneratingImage) return;

  if (!hasImageSubscription()) {
    showImageSubscriptionPrompt();
    return;
  }

  setImageLoading(true);
  showPleaseWait();
  currentGeneratedImageSrc = "";
  resetShareCard();
  messageImage.hidden = true;
  messageImage.removeAttribute("src");
  if (promptDetails) promptDetails.hidden = true;
  if (imagePrompt) imagePrompt.textContent = "";

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
      throw new Error(payload.error || "Image generation failed.");
    }

    const imageSource = payload.imageDataUrl || payload.imageUrl;
    if (!imageSource) {
      throw new Error("Image generation completed, but no image was returned.");
    }

    await preloadImage(imageSource);

    currentGeneratedImageSrc = imageSource;
    messageImage.src = imageSource;
    messageImage.alt = "";
    messageImage.hidden = true;
    imagePanel.hidden = false;
    imageStatus.hidden = false;
    imageStatus.textContent = "Composing scripture card…";

    if (imagePrompt) imagePrompt.textContent = "";

    shareCardPanel.hidden = true;
    shareCardPreview.hidden = true;
    setActionStatus("Composing scripture card…");

    try {
      await renderShareCardCanvas();
      imageStatus.textContent = "";
      imageStatus.hidden = true;
      imagePanel.hidden = true;
      setActionStatus("Scripture card ready. Save it, share it, or close it.");
      scrollHomeFocalIntoView();
    } catch (cardError) {
      console.error("Scripture card render failed:", cardError);
      currentGeneratedImageSrc = "";

      try {
        await renderShareCardCanvas(true);
        imageStatus.textContent = "";
        imageStatus.hidden = true;
        imagePanel.hidden = true;
        setActionStatus("Card ready without the illustration. Save it, share it, or close it.");
        scrollHomeFocalIntoView();
      } catch (fallbackError) {
        console.error("Text-only card render failed:", fallbackError);
        imagePanel.hidden = false;
        imageStatus.hidden = false;
        imageStatus.textContent = "Could not create the finished card. Please try again.";
        setActionStatus("Could not create scripture card.");
      }
    }
  } catch (error) {
    imagePanel.hidden = false;
    imageStatus.hidden = false;
    imageStatus.textContent = error.message || "Image generation failed.";
  } finally {
    setImageLoading(false);
  }
}

function bindEvents() {
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
  settingsToggle.addEventListener("click", toggleSettings);
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
    if (verse) selectVerse(verse, { status: `Selected ${verse.reference} from search.` });
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

    if (verse) selectVerse(verse, { status: `Selected ${verse.reference} from browse.` });
  });

  chapterVerses.addEventListener("click", (event) => {
    const verseRow = event.target.closest("[data-verse-id]");
    if (!verseRow) return;

    const verse = versesById.get(verseRow.dataset.verseId);
    if (verse) selectVerse(verse, { status: `Selected ${verse.reference} from browse.` });
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
  passageElement.textContent = "Loading local KJV scripture…";
  referenceElement.textContent = "—";

  try {
    await loadScriptureData();
    await loadImageSubscription();
    await loadSavedCards();
    initializeBrowseControls();
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
  } catch (error) {
    passageElement.textContent = "Unable to load scripture data. Please refresh and try again.";
    referenceElement.textContent = "—";
    console.error(error);
  }
}

initializeApp();
