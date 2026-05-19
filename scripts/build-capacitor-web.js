const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const dist = path.join(root, "dist");
const entries = [
  "index.html",
  "styles.css",
  "script.js",
  "web-subscribe.js",
  "lang/en.json",
  "lang/es-MX.json",
  "data/kjv/books.json",
  "data/kjv/passages.json",
  "data/kjv/themes.json",
  "data/kjv/verses.json",
  "data/kjv/SOURCE.md",
  "data/rv1909/books.json",
  "data/rv1909/passages.json",
  "data/rv1909/themes.json",
  "data/rv1909/verses.json",
  "data/rv1909/SOURCE.md",
  "assets/examples/example-1.png",
  "assets/examples/example-2.png",
  "assets/examples/example-3.png",
  "assets/examples/es-MX/example-1.png",
  "assets/examples/es-MX/example-2.png",
  "assets/examples/es-MX/example-3.png",
  "privacy.html",
  "terms.html",
  "refund.html",
  "privacy.es-MX.html",
  "terms.es-MX.html",
  "refund.es-MX.html",
];

fs.rmSync(dist, { recursive: true, force: true });

for (const entry of entries) {
  const source = path.join(root, entry);
  const target = path.join(dist, entry);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(source, target);
}

console.log(`Built Capacitor web bundle with ${entries.length} files into ${path.relative(root, dist)}/`);
