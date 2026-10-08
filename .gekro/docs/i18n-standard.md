# Blog translation standard

Status: Phase 1 live (2026-10-07). Scope: **blog only**. News, stack, experiments and apps stay English.
Decision record: `.gekro/logs/decision-log.md` rows dated 2026-10-06 and 2026-10-07.

## What exists

- Eight languages beside English: `hi bn mr te ta zh es ar`. Registry: `apps/web/src/lib/languages.ts` (the only list of languages; adding one means one entry there, one in `lib/i18n.ts`, one font rule in `styles/global.css`).
- English stays at `/blog/<slug>/` and is never routed through translation. Translations live at `/blog/<lang>/<slug>/`, and each language with at least one translation has an archive at `/blog/<lang>/`.
- Translations are files: `apps/web/src/translations/<lang>/<slug>.md`, where `<slug>` is the English file name under `src/content/blog/`. They sit outside `src/content/` on purpose, so CLAUDE.md section 6a (protection of hand-written article markdown) is not triggered by tooling that writes or refreshes them. English article markdown stays protected as before.
- `getAllPosts()` is untouched and English-only. Translations never reach the archive, topic hubs, related posts, RSS, the posts API, `llms-full.txt` or the OG image generator. All language-aware code goes through `lib/utils/translations.ts`.

## Translation file contract

```yaml
---
title: "..."            # translated
description: "..."      # translated
summary: "..."          # translated, only if the English post has it
tldr: "..."             # translated, only if the English post has it
aiSummary: "..."        # translated, only if the English post has it
publishedAt: "2026-02-15"   # copied verbatim
updatedAt: "..."            # copied verbatim, only if English has it
difficulty: "Beginner"      # copied verbatim
topics: ["Hardware", "Raspberry Pi", "AI Agents"]   # copied verbatim (English names; they are tag labels linked to English topic hubs)
readingTime: 8              # copied verbatim
sourceHash: "<64 hex>"      # see below
translatedAt: "2026-10-07"  # ISO date
translator: "claude-sonnet-5-5"   # who or what produced it
reviewed: false             # true only after a human who reads the language has read it
---
```

No `mainImage` (translated pages reuse the English image). The body is the English body translated, with every structural element kept.

`sourceHash` is `sha256(title + "\n---\n" + description + "\n---\n" + normalizedBody)` of the English post, computed by `scripts/i18n/source-hash.mjs` (`sourceHash()`); every producer must use that function. Normalised means CRLF to LF and trimmed. A mismatch means the English post changed after the translation: reported as a warning, or an error with `--strict`.

## What a translation may and may not change

May change: the words in `title`, `description`, `summary`, `tldr`, `aiSummary`, headings, paragraphs, list items, table cell text, link text, alt text.

Must not change (checked by `scripts/verify-i18n.mjs`):

- Fenced code blocks and inline code spans: byte-identical (mermaid labels included).
- Every external URL, and every internal link (an internal `/blog/<slug>/` link may become `/blog/<lang>/<slug>/` only if that translation exists).
- Counts of paragraphs, headings per level, list items, table rows, `<TLDR>` blocks, fenced blocks.
- Every number from the English prose appears in the translation (digits are compared without separators, so `1.5`, `1,5` and `4,500` vs `4500` all pass). Extra numbers warn.
- No em-dash (U+2014) anywhere, including the Chinese "——".
- No `mainImage`; copied fields identical to English.
- Proper nouns, product names, model names, units and commands stay in Latin script (Docker, Postgres, SSH, MQTT, Tailscale, Raspberry Pi, Tesla, GB, W).

Voice: the English posts are first-person, plain, engineer-to-engineer. Translate the voice, not word by word. No added claims, no softened numbers, no explanations the English does not contain. If a sentence cannot be translated without inventing something, keep it close to literal and flag it in the commit message.

Dashes: use the target language's normal punctuation; where English uses " - " as a pause, use a comma, colon or full stop. Never U+2014.

## Pages, SEO and typography

- Each translated page is self-canonical, carries `<html lang dir>`, `og:locale`, JSON-LD `inLanguage` plus `translationOfWork`, and an `hreflang` cluster (all translations, English, `x-default` = English). The same cluster is in `sitemap-0.xml` (built in `astro.config.mjs` `serialize()`). English pages with no translation carry no hreflang, so their output is unchanged.
- Page chrome (Header, Footer, search) stays English; the blog post chrome (TOC title, share, footer, author card, TL;DR label, reading time, dates) is translated from `lib/i18n.ts`. Newsletter, comments and related posts are English-only and not rendered on translations. Every page says it is a machine translation and links to the English original.
- Fonts: Noto Sans per script, loaded only on pages in that language (`SEOHead.astro`); `html:lang(...)` rules in `global.css` swap the three font tokens. Letter-spacing and synthetic italics are turned off for non-Latin scripts. Arabic is RTL: code, tables and site chrome stay left-to-right.
- Search: Pagefind indexes per `<html lang>`, so each language searches its own pages.

## Checks and commands

```bash
node scripts/verify-i18n.mjs                      # source checks (repo root)
node scripts/verify-i18n.mjs --strict             # stale translations become errors
node scripts/verify-i18n.mjs --lang hi            # one language
node scripts/verify-i18n.mjs --dist apps/web/dist # plus built-HTML checks (lang, dir, canonical, og:locale, hreflang reciprocity, sitemap)
```

`verify-i18n.mjs --dist dist` runs in the `postbuild` step and in CI, so a broken translation fails the build.

## Producing translations

Until further notice translations are produced by Claude in a Claude Code session on the owner's machine: translate one post into one language, write the file, set `sourceHash` with `sourceHash()`, run `verify-i18n`, fix what it reports, and read the rendered page. Later the same files can be produced by a local model service; its output must pass the same checks and is promoted into `src/translations/` only when `verify-i18n` is clean. Machine output that has not been read by a person who reads the language keeps `reviewed: false` and the on-page "machine translation" notice.

## Known limits

- Non-English UI strings in `lib/i18n.ts` were written by Claude and have not been read by native speakers.
- Mermaid diagram labels stay English (they live inside fenced code).
- Topic chips show English tag names, matching the English topic hubs.
- No translated RSS feed or translated OG images; social previews use the English image and the translated title and description.
