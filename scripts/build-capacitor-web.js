const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const dist = path.join(root, "dist");
const entries = [
  "index.html",
  "styles.css",
  "script.js",
  "web-subscribe.js",
  "data/kjv/books.json",
  "data/kjv/passages.json",
  "data/kjv/themes.json",
  "data/kjv/verses.json",
  "data/kjv/SOURCE.md",
  "assets/examples/example-1.png",
  "assets/examples/example-2.png",
  "assets/examples/example-3.png",
];

fs.rmSync(dist, { recursive: true, force: true });

for (const entry of entries) {
  const source = path.join(root, entry);
  const target = path.join(dist, entry);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(source, target);
}

console.log(`Built Capacitor web bundle with ${entries.length} files into ${path.relative(root, dist)}/`);
