---
title: "Punctuation & Typography Fixer"
category: "dev"
job: "Strip the curly quotes, em dashes, and invisible spaces that word processors sneak into your text"
description: "Paste text from Word, Google Docs, a PDF, or a chat app and get clean, plain punctuation back: curly quotes become straight, em and en dashes become hyphens, ellipsis characters become three dots, and non-breaking or zero-width characters disappear. Every rule is a separate toggle and reports exactly how many replacements it made, so nothing changes silently. Runs entirely in your browser."
aiSummary: "A client-side punctuation and typography normalizer. Fourteen independent, toggleable rules convert curly quotes to straight quotes, em/en dashes to hyphens, ellipsis characters to three dots, non-breaking and exotic spaces to regular spaces, and remove zero-width and bidi control characters, plus spacing cleanup (space before punctuation, repeated spaces, trailing whitespace, line-ending normalization). Each rule reports its replacement count. It normalizes characters only and does not affect statistical AI watermarks."
personalUse: "Everything I paste from a doc or a PDF arrives full of characters that break code blocks, corrupt diffs, and look wrong in monospace. I also have a hard rule against em dashes in my own writing, so I was fixing the same handful of characters by hand on every draft. This does the whole sweep in one pass and tells me exactly what it changed."
status: "active"
publishedAt: "2026-08-13"
lastVerified: "2026-08-13"
companionPostSlug: ""
license: "MIT"
icon: "✒️"
---

## What It Does

Word processors and chat apps quietly rewrite your punctuation. Straight quotes become curly ones, double hyphens become em dashes, three dots become a single ellipsis glyph, and ordinary spaces become non-breaking spaces. It looks fine in the original app and causes problems everywhere else: broken code samples, noisy diffs, mismatched search results, and characters that render as boxes in monospace.

This tool normalizes all of it in one pass:

- **Curly quotes → straight quotes**, including the single and double variants
- **Em and en dashes → hyphens**
- **Ellipsis character → three dots**
- **Non-breaking, thin, and ideographic spaces → a regular space**
- **Zero-width and bidi control characters → removed**
- **Spacing cleanup** - space before punctuation, repeated spaces, trailing whitespace, and line-ending normalization

## Every Rule Is A Toggle, With A Count

Fourteen rules, each independently switchable, each reporting how many replacements it made. That matters: a silent bulk-replace tool is one you cannot trust with a long document. If you want curly quotes preserved but em dashes gone, switch off one rule. The counts tell you at a glance whether the text was as messy as you thought.

Sensible defaults are on; the more opinionated rules (primes, bullet characters, collapsing blank lines) are off until you ask for them.

## What It Is Not

This is a **typography** tool - it normalizes characters. It is worth being precise about one thing, because the two get conflated: it does **not** remove statistical AI watermarks like Anthropic's Claude mark or Google's SynthID-Text. Those signals live in *which words a model chose*, not in punctuation, so no character-level cleanup touches them. If you want to know what is genuinely detectable in a piece of text, the [AI Provenance Inspector](/apps/ai-provenance-inspector/) covers it honestly.

Pairs with the [Text Formatter](/apps/text-formatter/) for case and line operations, and the [Hidden Text Inspector](/apps/hidden-text-inspector/) when you want to see hidden characters before removing them.

## Limitations

- **It does not know your intent.** Converting curly quotes to straight ones is correct for code and plain text, and wrong for typeset prose. Switch off what you do not want.
- **Apostrophe direction is not inferred** - every curly apostrophe becomes a straight one regardless of position.
- **Language-specific punctuation** (French guillemets, German low quotes) is normalized to ASCII quotes, which may not be what you want for published prose in those languages.
