const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const readJson = (relativePath) => JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));

const books = readJson("data/kjv/books.json");
const passages = readJson("data/kjv/passages.json");
const verses = readJson("data/kjv/verses.json");
const verseIds = new Set(verses.map((verse) => verse.id));

if (books.length !== 66) throw new Error(`Expected 66 books, found ${books.length}`);
const chapterCount = books.reduce((sum, book) => sum + book.chapters, 0);
if (chapterCount !== 1189) throw new Error(`Expected 1,189 chapters, found ${chapterCount}`);
if (verses.length !== 31102) throw new Error(`Expected 31,102 verses, found ${verses.length}`);
if (verseIds.size !== verses.length) throw new Error("Duplicate verse IDs detected");

for (const passage of passages) {
  if ("text" in passage || "display_text" in passage) {
    throw new Error(`${passage.id} duplicates scripture text`);
  }

  for (const verseId of passage.verse_ids || []) {
    if (!verseIds.has(verseId)) throw new Error(`${passage.id} references missing verse ${verseId}`);
  }
}

console.log(`Validated KJV data: ${books.length} books, ${chapterCount} chapters, ${verses.length} verses, ${passages.length} curated passages.`);
