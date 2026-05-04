const PASSAGES_DATA_URL = "./data/kjv/passages.json";
const VERSES_DATA_URL = "./data/kjv/verses.json";

const passageElement = document.getElementById("passage");
const referenceElement = document.getElementById("reference");
const enlightenButton = document.getElementById("enlightenButton");
const pictureButton = document.getElementById("pictureButton");
const imagePanel = document.getElementById("imagePanel");
const imageStatus = document.getElementById("imageStatus");
const messageImage = document.getElementById("messageImage");
const promptDetails = document.getElementById("promptDetails");
const imagePrompt = document.getElementById("imagePrompt");

let passages = [];
let versesById = new Map();
let lastIndex = -1;
let currentPassage = null;
let isGeneratingImage = false;

async function fetchJson(url, label) {
  const response = await fetch(url, { cache: "no-cache" });

  if (!response.ok) {
    throw new Error(`Could not load ${label}: ${response.status}`);
  }

  return response.json();
}

function buildVerseIndex(verses) {
  if (!Array.isArray(verses) || verses.length === 0) {
    throw new Error("Verse data is empty or invalid.");
  }

  return new Map(verses.map((verse) => [verse.id, verse]));
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
  const [nextPassages, nextVerses] = await Promise.all([
    fetchJson(PASSAGES_DATA_URL, "passage data"),
    fetchJson(VERSES_DATA_URL, "KJV verse data"),
  ]);

  const nextVersesById = buildVerseIndex(nextVerses);
  validatePassages(nextPassages, nextVersesById);

  passages = nextPassages;
  versesById = nextVersesById;
}

function getPassageText(passage) {
  if (!passage || !Array.isArray(passage.verse_ids)) return "";

  return passage.verse_ids
    .map((verseId) => versesById.get(verseId)?.text || "")
    .filter(Boolean)
    .join(" ");
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

function enlighten() {
  const passage = getRandomPassage();
  const passageText = getPassageText(passage);

  currentPassage = passage;
  passageElement.textContent = `“${passageText}”`;
  referenceElement.textContent = passage.reference;
  pictureButton.disabled = false;
  resetImagePanel();
}

async function pictureThisMessage() {
  if (!currentPassage || isGeneratingImage) return;

  setImageLoading(true);
  showPleaseWait();
  messageImage.hidden = true;
  messageImage.removeAttribute("src");
  if (promptDetails) promptDetails.hidden = true;
  if (imagePrompt) imagePrompt.textContent = "";

  try {
    const response = await fetch("/api/picture", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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

async function initializeApp() {
  enlightenButton.disabled = true;
  pictureButton.disabled = true;
  passageElement.textContent = "Loading local KJV scripture…";
  referenceElement.textContent = "—";

  try {
    await loadScriptureData();
    enlightenButton.disabled = false;
    enlighten();
  } catch (error) {
    passageElement.textContent = "Unable to load scripture data. Please refresh and try again.";
    referenceElement.textContent = "—";
    console.error(error);
  }
}

enlightenButton.addEventListener("click", enlighten);
pictureButton.addEventListener("click", pictureThisMessage);

initializeApp();
