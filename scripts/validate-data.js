const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const readJson = (relativePath) => JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));

function validateCorpus(name, dir) {
  const books = readJson(`data/${dir}/books.json`);
  const passages = readJson(`data/${dir}/passages.json`);
  const verses = readJson(`data/${dir}/verses.json`);
  const verseIds = new Set(verses.map((verse) => verse.id));

  if (books.length !== 66) throw new Error(`${name}: expected 66 books, found ${books.length}`);
  const chapterCount = books.reduce((sum, book) => sum + book.chapters, 0);
  if (chapterCount !== 1189) throw new Error(`${name}: expected 1,189 chapters, found ${chapterCount}`);
  if (verses.length !== 31102) throw new Error(`${name}: expected 31,102 verses, found ${verses.length}`);
  if (verseIds.size !== verses.length) throw new Error(`${name}: duplicate verse IDs detected`);

  for (const passage of passages) {
    if ("text" in passage || "display_text" in passage) {
      throw new Error(`${name}: ${passage.id} duplicates scripture text`);
    }

    for (const verseId of passage.verse_ids || []) {
      if (!verseIds.has(verseId)) throw new Error(`${name}: ${passage.id} references missing verse ${verseId}`);
    }
  }

  return { books, passages, verses, verseIds, chapterCount };
}

const kjv = validateCorpus("KJV", "kjv");
const rv1909 = validateCorpus("RV1909", "rv1909");

if (kjv.verses.length !== rv1909.verses.length) {
  throw new Error("KJV and RV1909 verse counts do not match");
}

for (let index = 0; index < kjv.verses.length; index += 1) {
  const kjvVerse = kjv.verses[index];
  const rvVerse = rv1909.verses[index];
  if (kjvVerse.id !== rvVerse.id) {
    throw new Error(`Verse ID mismatch at index ${index}: ${kjvVerse.id} !== ${rvVerse.id}`);
  }
  if (kjvVerse.book_id !== rvVerse.book_id || kjvVerse.chapter !== rvVerse.chapter || kjvVerse.verse !== rvVerse.verse) {
    throw new Error(`Verse position mismatch for ${kjvVerse.id}`);
  }
}

console.log(`Validated KJV data: ${kjv.books.length} books, ${kjv.chapterCount} chapters, ${kjv.verses.length} verses, ${kjv.passages.length} curated passages.`);
console.log(`Validated RV1909 data: ${rv1909.books.length} books, ${rv1909.chapterCount} chapters, ${rv1909.verses.length} verses, ${rv1909.passages.length} curated passages.`);
