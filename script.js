if (typeof window !== "undefined" && window.Capacitor?.Plugins?.EnlightenSubscriptions && !window.EnlightenSubscriptions) {
  window.EnlightenSubscriptions = window.Capacitor.Plugins.EnlightenSubscriptions;
}

const BOOKS_DATA_URL = "./data/kjv/books.json";
const PASSAGES_DATA_URL = "./data/kjv/passages.json";
const VERSES_DATA_URL = "./data/kjv/verses.json";
const MAX_SEARCH_RESULTS = 50;
const AI_IMAGE_PRODUCT_ID = "enlighten_ai_images_monthly";
const AI_IMAGE_PRICE_LABEL = "$3/month";
const WEB_PREVIEW_ENTITLEMENT_KEY = "enlighten.previewImageSubscription";

const passageElement = document.getElementById("passage");
const referenceElement = document.getElementById("reference");
const enlightenButton = document.getElementById("enlightenButton");
const copyButton = document.getElementById("copyButton");
const shareTextButton = document.getElementById("shareTextButton");
const shareCardButton = document.getElementById("shareCardButton");
const pictureButton = document.getElementById("pictureButton");
const actionStatus = document.getElementById("actionStatus");
const subscriptionPanel = document.getElementById("subscriptionPanel");
const subscriptionStatus = document.getElementById("subscriptionStatus");
const subscribeButton = document.getElementById("subscribeButton");
const restorePurchaseButton = document.getElementById("restorePurchaseButton");
const searchForm = document.getElementById("searchForm");
const searchInput = document.getElementById("searchInput");
const searchButton = document.getElementById("searchButton");
const searchMeta = document.getElementById("searchMeta");
const searchResults = document.getElementById("searchResults");
const bookSelect = document.getElementById("bookSelect");
const chapterSelect = document.getElementById("chapterSelect");
const verseSelect = document.getElementById("verseSelect");
const browseMeta = document.getElementById("browseMeta");
const chapterVerses = document.getElementById("chapterVerses");
const shareCardPanel = document.getElementById("shareCardPanel");
const shareCardCanvas = document.getElementById("shareCardCanvas");
const shareCardPreview = document.getElementById("shareCardPreview");
const downloadCardButton = document.getElementById("downloadCardButton");
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
let currentPassage = null;
let currentShareCardDataUrl = "";
let imageSubscription = {
  isActive: false,
  productId: AI_IMAGE_PRODUCT_ID,
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

function getShareText() {
  if (!currentPassage) return "";
  return `${getPassageText(currentPassage)}\n\n— ${currentPassage.reference} (KJV)\n\nFrom Enlighten, your daily dose.`;
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

const REMOTE_API_BASE = "https://new-testament-enlighten-me.vercel.app";

function apiUrl(path) {
  return isNativeAppRuntime() ? `${REMOTE_API_BASE}${path}` : path;
}

function hasImageSubscription() {
  return Boolean(imageSubscription.isActive);
}

function updateSubscriptionUi() {
  const active = hasImageSubscription();
  const nativeLabel = isNativeAppRuntime() ? "StoreKit" : "web preview";

  subscriptionPanel.classList.toggle("is-subscribed", active);
  subscriptionStatus.textContent = active
    ? `AI imagery unlocked via ${imageSubscription.source || nativeLabel}. KJV scripture remains free for everyone.`
    : `All KJV scripture, search, browse, copy, text share, and share cards stay free. Subscribe for ${AI_IMAGE_PRICE_LABEL} to unlock AI image generation.`;
  subscribeButton.textContent = active ? "AI Imagery Active" : `Subscribe — ${AI_IMAGE_PRICE_LABEL}`;
  subscribeButton.disabled = active;
  restorePurchaseButton.disabled = false;
  pictureButton.textContent = active ? "Picture this Message" : "Unlock AI Imagery";
}

function nativeBridgeArgs() {
  return { productId: AI_IMAGE_PRODUCT_ID, apiBase: REMOTE_API_BASE };
}

async function loadImageSubscription() {
  try {
    if (window.EnlightenSubscriptions?.getStatus) {
      imageSubscription = {
        ...imageSubscription,
        ...(await window.EnlightenSubscriptions.getStatus(nativeBridgeArgs())),
        source: "StoreKit",
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

async function subscribeToImagePlan() {
  try {
    if (window.EnlightenSubscriptions?.purchase) {
      imageSubscription = {
        ...imageSubscription,
        ...(await window.EnlightenSubscriptions.purchase(nativeBridgeArgs())),
        source: "StoreKit",
      };
    } else {
      window.localStorage.setItem(WEB_PREVIEW_ENTITLEMENT_KEY, "active");
      imageSubscription = { ...imageSubscription, isActive: true, source: "web preview" };
    }

    updateSubscriptionUi();
    setActionStatus("AI imagery subscription is active.");
  } catch (error) {
    if (error?.name !== "AbortError") {
      console.error(error);
      setActionStatus("Subscription could not be completed. Please try again.");
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
    } else {
      imageSubscription = {
        ...imageSubscription,
        isActive: window.localStorage.getItem(WEB_PREVIEW_ENTITLEMENT_KEY) === "active",
        source: "web preview",
      };
    }

    updateSubscriptionUi();
    setActionStatus(hasImageSubscription() ? "Purchase restored." : "No active AI imagery subscription found.");
  } catch (error) {
    console.error(error);
    setActionStatus("Restore failed. Please try again.");
  }
}

function showImageSubscriptionPrompt() {
  subscriptionPanel.scrollIntoView({ behavior: "smooth", block: "center" });
  setActionStatus(`AI imagery requires the ${AI_IMAGE_PRICE_LABEL} subscription. Scripture features remain free.`);
}

function setActionStatus(message) {
  if (!actionStatus) return;
  actionStatus.textContent = message;

  window.clearTimeout(actionStatusTimer);
  if (message) {
    actionStatusTimer = window.setTimeout(() => {
      actionStatus.textContent = "";
    }, 2600);
  }
}

function getRandomPassage() {
  if (!passages.length) {
    throw new Error("No passages have been loaded.");
  }

  let nextIndex = Math.floor(Math.random() * passages.length);

  if (passages.length > 1) {
    while (nextIndex === lastIndex) {
      nextIndex = Math.floor(Math.random() * passages.length);
    }
  }

  lastIndex = nextIndex;
  return passages[nextIndex];
}

function resetImagePanel() {
  imagePanel.hidden = true;
  imagePanel.classList.remove("is-loading");
  imageStatus.textContent = "";
  imageStatus.hidden = false;
  messageImage.hidden = true;
  messageImage.removeAttribute("src");
  if (promptDetails) promptDetails.hidden = true;
  if (imagePrompt) imagePrompt.textContent = "";
}

function setImageLoading(isLoading) {
  isGeneratingImage = isLoading;
  pictureButton.disabled = isLoading || !currentPassage;
  pictureButton.textContent = isLoading ? "Please wait…" : "Picture this Message";
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
  shareTextButton.disabled = false;
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

function searchVerses(query) {
  const normalizedQuery = normalizeSearchQuery(query);
  if (normalizedQuery.length < 2) return [];

  const exactReferenceMatches = verses.filter((verse) => verse.reference.toLowerCase() === normalizedQuery);
  const textMatches = verses.filter((verse) => {
    const haystack = `${verse.reference} ${verse.text}`.toLowerCase();
    return haystack.includes(normalizedQuery);
  });

  return [...exactReferenceMatches, ...textMatches]
    .filter((verse, index, allMatches) => allMatches.findIndex((match) => match.id === verse.id) === index)
    .slice(0, MAX_SEARCH_RESULTS);
}

function renderSearchResults(results, query) {
  if (!query) {
    searchMeta.textContent = "Search all 31,102 KJV verses locally.";
    searchResults.innerHTML = "";
    return;
  }

  if (query.length < 2) {
    searchMeta.textContent = "Type at least 2 characters.";
    searchResults.innerHTML = "";
    return;
  }

  if (results.length === 0) {
    searchMeta.textContent = `No local KJV matches for “${query}”.`;
    searchResults.innerHTML = "";
    return;
  }

  const cappedLabel = results.length === MAX_SEARCH_RESULTS ? `Top ${MAX_SEARCH_RESULTS}` : results.length;
  searchMeta.textContent = `${cappedLabel} local KJV match${results.length === 1 ? "" : "es"} for “${query}”.`;
  searchResults.innerHTML = results
    .map((verse) => `
      <button class="result-row" type="button" data-verse-id="${escapeHtml(verse.id)}">
        <span class="result-ref">${escapeHtml(verse.reference)}</span>
        <span class="result-text">${escapeHtml(verse.text)}</span>
      </button>
    `)
    .join("");
}

function handleSearch(event) {
  event.preventDefault();
  const query = normalizeSearchQuery(searchInput.value);
  renderSearchResults(searchVerses(query), query);
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

async function shareCurrentPassage() {
  if (!currentPassage) return;

  const text = getShareText();

  try {
    if (navigator.share) {
      await navigator.share({ title: "Enlighten", text });
      setActionStatus("Share sheet opened.");
    } else {
      await navigator.clipboard.writeText(text);
      setActionStatus("Sharing is not available here, so the passage was copied.");
    }
  } catch (error) {
    if (error?.name !== "AbortError") {
      console.error(error);
      setActionStatus("Share failed. Passage copied where supported.");
    }
  }
}

function resetShareCard() {
  currentShareCardDataUrl = "";
  shareCardPanel.hidden = true;
  shareCardPreview.hidden = true;
  shareCardPreview.removeAttribute("src");
  downloadCardButton.disabled = true;
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

function drawShareCardText(context, text, reference) {
  const maxWidth = 780;
  let quoteFontSize = text.length > 330 ? 44 : text.length > 220 ? 50 : 58;
  let lines = [];

  do {
    context.font = `${quoteFontSize}px Georgia, serif`;
    lines = wrapCanvasText(context, `“${text}”`, maxWidth);
    if (lines.length <= 10 || quoteFontSize <= 36) break;
    quoteFontSize -= 4;
  } while (quoteFontSize >= 36);

  const lineHeight = quoteFontSize * 1.34;
  const quoteBlockHeight = lines.length * lineHeight;
  let y = Math.max(366, 690 - quoteBlockHeight / 2);

  context.fillStyle = "#f8fafc";
  context.textAlign = "center";
  context.textBaseline = "alphabetic";
  context.font = `${quoteFontSize}px Georgia, serif`;

  for (const line of lines) {
    context.fillText(line, 540, y, maxWidth);
    y += lineHeight;
  }

  context.fillStyle = "#facc15";
  context.font = "700 34px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
  context.fillText(`— ${reference} (KJV)`, 540, y + 52, maxWidth);
}

function renderShareCardCanvas() {
  if (!currentPassage) return "";

  const context = shareCardCanvas.getContext("2d");
  const width = shareCardCanvas.width;
  const height = shareCardCanvas.height;
  const passageText = getPassageText(currentPassage);

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

  context.save();
  context.strokeStyle = "rgba(250, 204, 21, 0.28)";
  context.lineWidth = 2;
  drawRoundedRect(context, 70, 70, 940, 1210, 56);
  context.stroke();

  context.fillStyle = "rgba(15, 23, 42, 0.62)";
  drawRoundedRect(context, 112, 188, 856, 910, 44);
  context.fill();
  context.strokeStyle = "rgba(255, 255, 255, 0.14)";
  context.stroke();
  context.restore();

  context.textAlign = "center";
  context.fillStyle = "#facc15";
  context.font = "800 24px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
  context.letterSpacing = "4px";
  context.fillText("ENLIGHTEN", 540, 150);
  context.letterSpacing = "0px";

  drawShareCardText(context, passageText, currentPassage.reference);

  context.fillStyle = "#cbd5e1";
  context.font = "600 30px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
  context.fillText("From Enlighten, your daily dose.", 540, 1162);

  context.fillStyle = "rgba(250, 204, 21, 0.14)";
  drawRoundedRect(context, 314, 1200, 452, 58, 29);
  context.fill();
  context.strokeStyle = "rgba(250, 204, 21, 0.34)";
  context.stroke();
  context.fillStyle = "#fde68a";
  context.font = "800 22px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
  context.fillText("Save • Send • Share", 540, 1238);

  currentShareCardDataUrl = shareCardCanvas.toDataURL("image/png");
  shareCardPreview.src = currentShareCardDataUrl;
  shareCardPreview.hidden = false;
  downloadCardButton.disabled = false;
  shareCardImageButton.disabled = false;

  return currentShareCardDataUrl;
}

function showShareCard() {
  if (!currentPassage) return;

  shareCardPanel.hidden = false;
  renderShareCardCanvas();
  setActionStatus("Share card ready.");
}

function getShareCardBlob() {
  return new Promise((resolve, reject) => {
    shareCardCanvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Could not create share card image."));
    }, "image/png");
  });
}

async function downloadShareCard() {
  if (!currentPassage) return;
  if (!currentShareCardDataUrl) renderShareCardCanvas();

  const link = document.createElement("a");
  link.href = currentShareCardDataUrl;
  link.download = getShareCardFileName();
  document.body.append(link);
  link.click();
  link.remove();
  setActionStatus("Downloaded share card.");
}

async function shareCardImage() {
  if (!currentPassage) return;
  if (!currentShareCardDataUrl) renderShareCardCanvas();

  try {
    const blob = await getShareCardBlob();
    const file = new File([blob], getShareCardFileName(), { type: "image/png" });

    if (navigator.canShare?.({ files: [file] }) && navigator.share) {
      await navigator.share({
        title: "Enlighten",
        text: `${currentPassage.reference} (KJV) — From Enlighten, your daily dose.`,
        files: [file],
      });
      setActionStatus("Share sheet opened with image card.");
    } else if (navigator.share) {
      await navigator.share({ title: "Enlighten", text: getShareText() });
      setActionStatus("Image sharing is not available here, so text share opened.");
    } else {
      await navigator.clipboard.writeText(getShareText());
      setActionStatus("Image sharing is not available here, so text was copied.");
    }
  } catch (error) {
    if (error?.name !== "AbortError") {
      console.error(error);
      setActionStatus("Share image failed. Try Download Card instead.");
    }
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
  messageImage.hidden = true;
  messageImage.removeAttribute("src");
  if (promptDetails) promptDetails.hidden = true;
  if (imagePrompt) imagePrompt.textContent = "";

  try {
    const response = await fetch(apiUrl("/api/picture"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Enlighten-Product": AI_IMAGE_PRODUCT_ID,
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

    messageImage.src = imageSource;
    messageImage.alt = "";
    messageImage.hidden = false;
    imageStatus.textContent = "";
    imageStatus.hidden = true;

    if (imagePrompt) imagePrompt.textContent = "";
  } catch (error) {
    imageStatus.textContent = error.message || "Image generation failed.";
  } finally {
    setImageLoading(false);
  }
}

function bindEvents() {
  enlightenButton.addEventListener("click", enlighten);
  copyButton.addEventListener("click", copyCurrentPassage);
  shareTextButton.addEventListener("click", shareCurrentPassage);
  shareCardButton.addEventListener("click", showShareCard);
  downloadCardButton.addEventListener("click", downloadShareCard);
  shareCardImageButton.addEventListener("click", shareCardImage);
  subscribeButton.addEventListener("click", subscribeToImagePlan);
  restorePurchaseButton.addEventListener("click", restoreImagePlan);
  pictureButton.addEventListener("click", pictureThisMessage);
  searchForm.addEventListener("submit", handleSearch);

  searchInput.addEventListener("input", () => {
    const query = normalizeSearchQuery(searchInput.value);
    if (query.length === 0 || query.length >= 3) {
      renderSearchResults(searchVerses(query), query);
    }
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
  shareTextButton.disabled = true;
  shareCardButton.disabled = true;
  downloadCardButton.disabled = true;
  shareCardImageButton.disabled = true;
  pictureButton.disabled = true;
  subscribeButton.disabled = true;
  restorePurchaseButton.disabled = true;
  searchButton.disabled = true;
  searchInput.disabled = true;
  bookSelect.disabled = true;
  chapterSelect.disabled = true;
  verseSelect.disabled = true;
  passageElement.textContent = "Loading local KJV scripture…";
  referenceElement.textContent = "—";

  try {
    await loadScriptureData();
    await loadImageSubscription();
    initializeBrowseControls();
    bindEvents();

    enlightenButton.disabled = false;
    subscribeButton.disabled = hasImageSubscription();
    restorePurchaseButton.disabled = false;
    searchButton.disabled = false;
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
