const fs = require("fs");
const https = require("https");
const path = require("path");

const root = path.resolve(__dirname, "..");
const sourceUrl = "https://raw.githubusercontent.com/scrollmapper/bible_databases/master/formats/json/SpaRV.json";
const outputDir = path.join(root, "data", "rv1909");

const spanishBooks = [
  ["Génesis", "Gen"],
  ["Éxodo", "Ex"],
  ["Levítico", "Lev"],
  ["Números", "Num"],
  ["Deuteronomio", "Deut"],
  ["Josué", "Jos"],
  ["Jueces", "Jue"],
  ["Rut", "Rut"],
  ["1 Samuel", "1 Sam"],
  ["2 Samuel", "2 Sam"],
  ["1 Reyes", "1 Rey"],
  ["2 Reyes", "2 Rey"],
  ["1 Crónicas", "1 Crón"],
  ["2 Crónicas", "2 Crón"],
  ["Esdras", "Esd"],
  ["Nehemías", "Neh"],
  ["Ester", "Est"],
  ["Job", "Job"],
  ["Salmos", "Sal"],
  ["Proverbios", "Prov"],
  ["Eclesiastés", "Ecl"],
  ["Cantares", "Cant"],
  ["Isaías", "Isa"],
  ["Jeremías", "Jer"],
  ["Lamentaciones", "Lam"],
  ["Ezequiel", "Ez"],
  ["Daniel", "Dan"],
  ["Oseas", "Os"],
  ["Joel", "Joel"],
  ["Amós", "Am"],
  ["Abdías", "Abd"],
  ["Jonás", "Jon"],
  ["Miqueas", "Miq"],
  ["Nahúm", "Nah"],
  ["Habacuc", "Hab"],
  ["Sofonías", "Sof"],
  ["Hageo", "Hag"],
  ["Zacarías", "Zac"],
  ["Malaquías", "Mal"],
  ["Mateo", "Mat"],
  ["Marcos", "Mar"],
  ["Lucas", "Luc"],
  ["Juan", "Juan"],
  ["Hechos", "Hch"],
  ["Romanos", "Rom"],
  ["1 Corintios", "1 Cor"],
  ["2 Corintios", "2 Cor"],
  ["Gálatas", "Gál"],
  ["Efesios", "Ef"],
  ["Filipenses", "Fil"],
  ["Colosenses", "Col"],
  ["1 Tesalonicenses", "1 Tes"],
  ["2 Tesalonicenses", "2 Tes"],
  ["1 Timoteo", "1 Tim"],
  ["2 Timoteo", "2 Tim"],
  ["Tito", "Tit"],
  ["Filemón", "Flm"],
  ["Hebreos", "Heb"],
  ["Santiago", "Sant"],
  ["1 Pedro", "1 Ped"],
  ["2 Pedro", "2 Ped"],
  ["1 Juan", "1 Jn"],
  ["2 Juan", "2 Jn"],
  ["3 Juan", "3 Jn"],
  ["Judas", "Jud"],
  ["Apocalipsis", "Ap"],
];

const themes = [
  { id: "comfort", label: "Consuelo", description: "Pasajes para paz, duelo, cargas y ánimo." },
  { id: "peace", label: "Paz", description: "Pasajes centrados en calma, quietud y descanso espiritual." },
  { id: "trust", label: "Confianza", description: "Pasajes sobre confiar en Dios en vez del temor o la autosuficiencia." },
  { id: "guidance", label: "Guía", description: "Pasajes para dirección, discernimiento y el camino por delante." },
  { id: "wisdom", label: "Sabiduría", description: "Pasajes que enseñan juicio, prioridades y entendimiento." },
  { id: "faith", label: "Fe", description: "Pasajes sobre creencia, confianza y visión espiritual." },
  { id: "strength", label: "Fortaleza", description: "Pasajes para valor, perseverancia y renovación." },
  { id: "hope", label: "Esperanza", description: "Pasajes que elevan el corazón hacia restauración y promesa." },
  { id: "courage", label: "Valor", description: "Pasajes para temor, riesgo y perseverancia." },
  { id: "prayer", label: "Oración", description: "Pasajes que invitan a pedir, buscar, agradecer y tener comunión con Dios." },
  { id: "gratitude", label: "Gratitud", description: "Pasajes para agradecimiento y gozo." },
  { id: "love", label: "Amor", description: "Pasajes sobre caridad, servicio y devoción." },
  { id: "humility", label: "Humildad", description: "Pasajes sobre caminar humildemente, arrepentimiento y renovación." },
  { id: "justice", label: "Justicia", description: "Pasajes sobre rectitud, misericordia y acción moral." },
  { id: "light", label: "Luz", description: "Pasajes que usan la luz como guía, salvación y vida." },
];

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
}

function writeJson(fileName, value) {
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(path.join(outputDir, fileName), `${JSON.stringify(value, null, 2)}\n`);
}

function getJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (response) => {
      if (response.statusCode < 200 || response.statusCode >= 300) {
        reject(new Error(`Download failed ${response.statusCode}: ${url}`));
        response.resume();
        return;
      }

      let body = "";
      response.setEncoding("utf8");
      response.on("data", (chunk) => {
        body += chunk;
      });
      response.on("end", () => {
        try {
          resolve(JSON.parse(body));
        } catch (error) {
          reject(error);
        }
      });
    }).on("error", reject);
  });
}

function cleanText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function getVerseId(bookId, chapter, verse) {
  return `${bookId}-${chapter}-${verse}`;
}

function buildReference(verseRecords) {
  if (verseRecords.length === 1) return verseRecords[0].reference;

  const first = verseRecords[0];
  const last = verseRecords[verseRecords.length - 1];
  if (first.book_id === last.book_id && first.chapter === last.chapter) {
    return `${first.book} ${first.chapter}:${first.verse}–${last.verse}`;
  }
  if (first.book_id === last.book_id) {
    return `${first.book} ${first.chapter}:${first.verse}–${last.chapter}:${last.verse}`;
  }
  return `${first.reference}; ${last.reference}`;
}

async function main() {
  const kjvBooks = readJson("data/kjv/books.json");
  const kjvPassages = readJson("data/kjv/passages.json");
  const source = await getJson(sourceUrl);

  if (!Array.isArray(source.books) || source.books.length !== kjvBooks.length) {
    throw new Error(`Expected ${kjvBooks.length} source books, found ${source.books?.length || 0}`);
  }

  const books = kjvBooks.map((book, index) => {
    const [name, abbreviation] = spanishBooks[index];
    return { ...book, name, abbreviation };
  });

  const verses = [];
  for (let bookIndex = 0; bookIndex < kjvBooks.length; bookIndex += 1) {
    const kjvBook = kjvBooks[bookIndex];
    const [bookName] = spanishBooks[bookIndex];
    const sourceBook = source.books[bookIndex];
    if (!sourceBook || !Array.isArray(sourceBook.chapters)) {
      throw new Error(`Missing source book at order ${bookIndex + 1}`);
    }
    if (sourceBook.chapters.length !== kjvBook.chapters) {
      throw new Error(`${kjvBook.id} expected ${kjvBook.chapters} chapters, found ${sourceBook.chapters.length}`);
    }

    for (const chapter of sourceBook.chapters) {
      for (const verse of chapter.verses || []) {
        verses.push({
          id: getVerseId(kjvBook.id, chapter.chapter, verse.verse),
          book_id: kjvBook.id,
          book: bookName,
          testament: kjvBook.testament,
          book_order: kjvBook.order,
          chapter: chapter.chapter,
          verse: verse.verse,
          reference: `${bookName} ${chapter.chapter}:${verse.verse}`,
          translation: "RV1909",
          text: cleanText(verse.text),
        });
      }
    }
  }

  const versesById = new Map(verses.map((verse) => [verse.id, verse]));
  const passages = kjvPassages.map((passage) => {
    const passageVerses = passage.verse_ids.map((verseId) => {
      const verse = versesById.get(verseId);
      if (!verse) throw new Error(`${passage.id} references missing RV1909 verse ${verseId}`);
      return verse;
    });
    return {
      ...passage,
      reference: buildReference(passageVerses),
      translation: "RV1909",
      source: passage.source === "local_kjv_verse" ? "local_rv1909_verse" : passage.source,
    };
  });

  const sourceMarkdown = `# RV1909 scripture source\n\n\`verses.json\` is normalized from the public-domain Reina-Valera 1909 Spanish Bible text.\n\n## Source used for this import\n\n- Repository: https://github.com/scrollmapper/bible_databases\n- Source file: ${sourceUrl}\n- Source translation label: \`SpaRV: La Santa Biblia Reina-Valera (1909)\`\n- Source license note: \`sources/es/SpaRV/README.md\` marks this text as Public Domain.\n- Source repository license: MIT License for repository software/data packaging.\n- Normalized import date: 2026-05-14\n\n## Normalization rules\n\n- Verse IDs use Enlighten's permanent format: \`book-id-chapter-verse\`, for example \`john-3-16\`.\n- Book IDs, testament labels, canonical order, chapter counts, and verse IDs mirror \`data/kjv/\`.\n- Book display names and references are Spanish, for example \`Juan 3:16\`.\n- Verse whitespace is normalized by trimming leading/trailing whitespace and collapsing repeated whitespace to a single space.\n- \`passages.json\` mirrors the KJV curated passage metadata and resolves text through \`verse_ids\`; it does not duplicate scripture text.\n\n## Validation counts\n\n- Books: ${books.length}\n- Chapters: ${books.reduce((sum, book) => sum + book.chapters, 0).toLocaleString("en-US")}\n- Verses: ${verses.length.toLocaleString("en-US")}\n\n## Product note\n\nRV1909 is the no-license/public-domain Spanish fallback for Enlighten-Me. For stronger Mexican market fit, the preferred product path remains licensing RVR1960, NVI, or NTV and importing it into this same translation-agnostic data shape.\n`;

  writeJson("books.json", books);
  writeJson("verses.json", verses);
  writeJson("passages.json", passages);
  writeJson("themes.json", themes);
  fs.writeFileSync(path.join(outputDir, "SOURCE.md"), sourceMarkdown);

  console.log(`Imported RV1909: ${books.length} books, ${verses.length} verses, ${passages.length} curated passages.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
