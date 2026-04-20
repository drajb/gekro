---
title: "Regex Playground"
category: "dev"
job: "Test regular expressions against sample text with live match highlighting"
description: "A zero-dependency regex tester. Type a pattern, set flags, paste your test string — matches highlight in real time with index positions and capture groups. Includes 12 common pattern presets. No login, no server."
aiSummary: "A client-side regex playground using the native JavaScript RegExp engine. Shows live match highlights, match indices, and named/numbered capture groups. Includes presets for email, URL, date, IP, UUID, and other common patterns."
personalUse: "I test regex while writing parsers and data pipeline transformers. Having the pattern, flags, and test string in one view — with live highlighting — is faster than any REPL loop."
status: "active"
publishedAt: "2026-04-19"
icon: "🔍"
license: "MIT"
---

## How this works

Enter a regular expression pattern (without the surrounding `/` slashes) and select your flags. Paste or type your test string in the text area below. Matches are highlighted in real time.

**Match list** — each match shows the matched text, start index, length, and any numbered or named capture groups.

**Presets** — click any preset to load a common pattern. Useful as a starting point for email validation, URL extraction, date parsing, and more.

## Flags

| Flag | Meaning |
|------|---------|
| `g` | Global — find all matches, not just the first |
| `i` | Case-insensitive |
| `m` | Multiline — `^` and `$` match line boundaries |
| `s` | Dotall — `.` matches newlines |

## Limitations

- **JavaScript RegExp engine** — no PCRE features (possessive quantifiers, atomic groups, lookbehind in older browsers). Named capture groups require ES2018+.
- **No PCRE syntax** — patterns written for Python, PHP, or PCRE may need adjustment for JS.
- **Performance** — catastrophic backtracking on pathological patterns will freeze the tab. The playground applies a 500ms debounce on input to reduce runaway regex risk, but it does not timeout the engine.
- **Unicode** — the `u` flag is not currently exposed (add manually in the pattern if needed).
