---
title: "Text Formatter & Case Converter"
category: "dev"
job: "Convert case and run the line operations you always need - trim, dedupe, sort, number, wrap - in one pass"
description: "Ten case conversions (sentence, title, camelCase, snake_case, kebab-case, CONSTANT_CASE and more) plus the line operations that usually mean opening an editor: trim each line, remove blanks, remove duplicates, sort, reverse, number, and hard-wrap at a column. Operations apply in a fixed, documented order so the result is predictable. Runs entirely in your browser."
aiSummary: "A client-side text formatter combining ten case conversions (lower, upper, sentence, title, camelCase, PascalCase, snake_case, kebab-case, CONSTANT_CASE) with six line operations applied in a fixed order (trim, remove blank lines, dedupe, sort, reverse, number) plus optional hard-wrapping at a configurable column. Reports line, word, and character counts. Zero dependencies, no upload."
personalUse: "I convert a list of names to snake_case, dedupe a pasted log, or sort a block of imports several times a week, and the honest answer is I was doing it with throwaway regex in an editor or trusting some ad-covered site with the text. This is the same handful of operations in one place, running locally, with the order they apply in written down so the output is never a surprise."
status: "active"
publishedAt: "2026-08-13"
lastVerified: "2026-08-13"
companionPostSlug: ""
license: "MIT"
icon: "🔠"
---

## What It Does

Two families of transformation that almost always get used together.

**Case conversion** - ten options covering both prose and code conventions:

`lower` · `UPPER` · `Sentence case` · `Title Case` · `camelCase` · `PascalCase` · `snake_case` · `kebab-case` · `CONSTANT_CASE`

The programming cases share one word-splitter that handles existing camelCase boundaries, so `parseHTTPResponse` and `parse-http-response` both convert cleanly rather than collapsing into one word.

**Line operations** - the ones that otherwise mean opening an editor and writing a regex:

- Trim each line
- Remove blank lines
- Remove duplicate lines (keeps first occurrence)
- Sort A→Z (locale-aware)
- Reverse line order
- Number lines (right-aligned to the widest index)
- Hard-wrap at a column you choose, breaking on word boundaries

## Order Is Fixed And Documented

Operations apply in the order they appear in the interface: case conversion first, then trim, remove blanks, dedupe, sort, reverse, number, and finally wrap. That is a deliberate choice - a tool where the result depends on which checkbox you clicked last is a tool that quietly corrupts data. Trimming before deduping means lines differing only in trailing whitespace collapse correctly, and numbering before wrapping keeps the numbers attached to the right lines.

Live line, word, and character counts sit under the output so you can confirm the shape of the result.

Pairs with the [Punctuation Fixer](/apps/punctuation-fixer/) for character-level cleanup and [Word Counter](/apps/word-counter/) for deeper text statistics.

## Limitations

- **Title Case is mechanical** - it capitalizes every word rather than applying a style guide's rules about articles and prepositions.
- **Sentence case uses punctuation boundaries** (`.`, `!`, `?`), so abbreviations like "e.g." will trigger a capital after them.
- **Sorting is lexicographic**, not natural - `item10` sorts before `item2`.
- **Wrapping is a hard wrap** that inserts real newlines; it does not understand markdown, code indentation, or hanging indents.
