#!/usr/bin/env node
// Regenerates assets/art-first/bg-*.jpg through the production pipeline in
// api/picture.js (Claude prompt writer → Freepik Mystic) so the curated
// art-first deck is stylistically identical to live subscriber generations.
// Reads keys from .env.local (vercel env pull). Run from the repo root:
//   node scripts/generate-art-first-deck.js
"use strict";

const fs = require("fs");
const path = require("path");

const envPath = path.join(__dirname, "..", ".env.local");
for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
  if (!line || line.startsWith("#")) continue;
  const eq = line.indexOf("=");
  if (eq === -1) continue;
  const key = line.slice(0, eq).trim();
  let value = line.slice(eq + 1).trim();
  if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
  if (!(key in process.env)) process.env[key] = value;
}

const {
  writeIllustrationPrompt,
  startFreepikImage,
  pollFreepikImage,
} = require("../api/picture.js");

// Must stay in sync with DECK in art-first.js.
const DECK = [
  { reference: "Psalm 23:1–2", text: "The Lord is my shepherd; I shall not want. He maketh me to lie down in green pastures: he leadeth me beside the still waters." },
  { reference: "Isaiah 41:10", text: "Fear thou not; for I am with thee: be not dismayed; for I am thy God: I will strengthen thee; yea, I will help thee; yea, I will uphold thee with the right hand of my righteousness." },
  { reference: "Philippians 4:7", text: "And the peace of God, which passeth all understanding, shall keep your hearts and minds through Christ Jesus." },
  { reference: "John 8:12", text: "Then spake Jesus again unto them, saying, I am the light of the world: he that followeth me shall not walk in darkness, but shall have the light of life." },
  { reference: "Psalm 46:10", text: "Be still, and know that I am God: I will be exalted among the heathen, I will be exalted in the earth." },
  { reference: "Matthew 11:28", text: "Come unto me, all ye that labour and are heavy laden, and I will give you rest." },
  { reference: "Jeremiah 29:11", text: "For I know the thoughts that I think toward you, saith the Lord, thoughts of peace, and not of evil, to give you an expected end." },
  { reference: "1 Corinthians 16:14", text: "Let all your things be done with charity." },
];

const OUT_DIR = path.join(__dirname, "..", "assets", "art-first");

async function saveImage(imageUrl, outPath) {
  if (/^data:image\//.test(imageUrl)) {
    const base64 = imageUrl.split(",")[1];
    fs.writeFileSync(outPath, Buffer.from(base64, "base64"));
    return;
  }
  const response = await fetch(imageUrl);
  if (!response.ok) throw new Error(`Download failed ${response.status} for ${imageUrl}`);
  fs.writeFileSync(outPath, Buffer.from(await response.arrayBuffer()));
}

async function generateOne(entry, index) {
  const { prompt } = await writeIllustrationPrompt({ passage: entry.text, reference: entry.reference });
  const started = await startFreepikImage(prompt);
  const image = started.immediateUrl
    ? { imageUrl: started.immediateUrl }
    : await pollFreepikImage(started.taskId);
  if (!image?.imageUrl) throw new Error("No image returned.");

  const outPath = path.join(OUT_DIR, `bg-${index + 1}.jpg`);
  await saveImage(image.imageUrl, outPath);
  console.log(`✓ bg-${index + 1}.jpg  ${entry.reference}\n  prompt: ${prompt.slice(0, 110)}…`);
}

(async () => {
  const missing = ["ANTHROPIC_API_KEY", "FREEPIK_API_KEY"].filter((name) => !process.env[name]);
  if (missing.length) {
    console.error(`Missing env: ${missing.join(", ")}`);
    process.exit(1);
  }
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const only = process.argv.slice(2).map(Number).filter(Boolean);
  const targets = DECK.map((entry, i) => [entry, i]).filter(([, i]) => !only.length || only.includes(i + 1));

  const results = await Promise.allSettled(targets.map(([entry, i]) => generateOne(entry, i)));
  let failed = 0;
  results.forEach((result, n) => {
    if (result.status === "rejected") {
      failed += 1;
      console.error(`✗ bg-${targets[n][1] + 1}.jpg  ${targets[n][0].reference}: ${result.reason?.message || result.reason}`);
    }
  });
  if (failed) {
    console.error(`\n${failed} failed — re-run with the failed indices, e.g. node scripts/generate-art-first-deck.js 3 7`);
    process.exit(1);
  }
  console.log("\nDeck complete.");
})();
