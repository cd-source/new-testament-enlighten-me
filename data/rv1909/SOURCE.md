# RV1909 scripture source

`verses.json` is normalized from the public-domain Reina-Valera 1909 Spanish Bible text.

## Source used for this import

- Repository: https://github.com/scrollmapper/bible_databases
- Source file: https://raw.githubusercontent.com/scrollmapper/bible_databases/master/formats/json/SpaRV.json
- Source translation label: `SpaRV: La Santa Biblia Reina-Valera (1909)`
- Source license note: `sources/es/SpaRV/README.md` marks this text as Public Domain.
- Source repository license: MIT License for repository software/data packaging.
- Normalized import date: 2026-05-14

## Normalization rules

- Verse IDs use Enlighten's permanent format: `book-id-chapter-verse`, for example `john-3-16`.
- Book IDs, testament labels, canonical order, chapter counts, and verse IDs mirror `data/kjv/`.
- Book display names and references are Spanish, for example `Juan 3:16`.
- Verse whitespace is normalized by trimming leading/trailing whitespace and collapsing repeated whitespace to a single space.
- `passages.json` mirrors the KJV curated passage metadata and resolves text through `verse_ids`; it does not duplicate scripture text.

## Validation counts

- Books: 66
- Chapters: 1,189
- Verses: 31,102

## Product note

RV1909 is the no-license/public-domain Spanish fallback for Enlighten-Me. For stronger Mexican market fit, the preferred product path remains licensing RVR1960, NVI, or NTV and importing it into this same translation-agnostic data shape.
