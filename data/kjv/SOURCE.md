# KJV scripture source

`verses.json` is normalized from the public-domain King James Version text.

## Source used for this import

- Repository: https://github.com/scrollmapper/bible_databases
- Source file: https://raw.githubusercontent.com/scrollmapper/bible_databases/master/formats/json/KJV.json
- Source translation label: `KJV: King James Version (1769) with Strongs Numbers and Morphology and CatchWords`
- Source repository license: MIT License
- Normalized import date: 2026-05-04

## Normalization rules

- Verse IDs use Enlighten's permanent format: `book-id-chapter-verse`, for example `john-3-16`.
- Book IDs, book names, testament labels, and canonical order are taken from `books.json`.
- Source book text is mapped to `books.json` by canonical order, then chapter and verse number.
- Verse whitespace is normalized by trimming leading/trailing whitespace and collapsing repeated whitespace to a single space.
- `passages.json` does not duplicate scripture text; it stores curated metadata plus `verse_ids` that resolve into `verses.json`.

## Validation counts

- Books: 66
- Chapters: 1,189
- Verses: 31,102

## Product note

The KJV is public domain in the United States. Enlighten uses KJV scripture as the free local text layer. Paid subscription functionality should remain limited to AI imagery and related paid compute features, not access to scripture text.
