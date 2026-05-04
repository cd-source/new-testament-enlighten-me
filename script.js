const PASSAGES_DATA_URL = "./data/kjv/passages.json";

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
let lastIndex = -1;
let currentPassage = null;
let isGeneratingImage = false;

async function loadPassages() {
  const response = await fetch(PASSAGES_DATA_URL, { cache: "no-cache" });

  if (!response.ok) {
    throw new Error(`Could not load passage data: ${response.status}`);
  }

  const data = await response.json();

  if (!Array.isArray(data) || data.length === 0) {
    throw new Error("Passage data is empty or invalid.");
  }

  passages = data;
}

function getPassageText(passage) {
  return passage?.display_text || passage?.text || "";
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
  passageElement.textContent = "Loading KJV passages…";
  referenceElement.textContent = "—";

  try {
    await loadPassages();
    enlightenButton.disabled = false;
    enlighten();
  } catch (error) {
    passageElement.textContent = "Unable to load passage data. Please refresh and try again.";
    referenceElement.textContent = "—";
    console.error(error);
  }
}

enlightenButton.addEventListener("click", enlighten);
pictureButton.addEventListener("click", pictureThisMessage);

initializeApp();
