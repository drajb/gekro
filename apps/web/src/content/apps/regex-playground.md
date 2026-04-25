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

## What It Does

The Regex Playground lets you test regular expressions against sample text and see matches highlighted in real time. Enter a pattern, select flags, paste your test string — every match lights up with its position, length, and any capture groups. The match list below shows all results with index offsets so you can reference them in code.

Twelve built-in presets cover the patterns most developers reach for: email addresses, URLs, IP addresses, dates, UUIDs, phone numbers, and more. Load a preset to see the pattern and test string together, then modify from there.

## How to Use It

1. Enter your regex pattern in the **Pattern** field — no surrounding slashes needed.
2. Select any **flags** you need (g, i, m, s).
3. Paste your **test string** in the text area below.
4. Matches highlight in real time. The match list shows each match's text, start index, and capture groups.
5. Click a **preset** to load a tested pattern for email, URL, IP, date, UUID, etc.

The `g` (global) flag is what enables finding all matches. Without it, only the first match is returned, which is usually not what you want when testing.

## The Math / How It Works

This playground uses the native JavaScript `RegExp` engine — the same engine powering `String.prototype.match()`, `.replace()`, `.split()`, and every regex operation in Node.js and the browser. No external libraries.

The engine runs a match cycle on every input change (debounced at 500ms to prevent runaway patterns). For each match object returned, the tool reads `match.index`, `match[0]` for the full match, and `match[1]` through `match[n]` or named groups from `match.groups` for capture groups.

**Understanding the flags:**

| Flag | Meaning |
|------|---------|
| `g` | Global — find all matches, not just the first |
| `i` | Case-insensitive |
| `m` | Multiline — `^` and `$` match line boundaries |
| `s` | Dotall — `.` matches newlines |

**JavaScript uses the ECMA/Unicode regex dialect, not PCRE.** This distinction matters if you're writing patterns for Python (`re` module), PHP, or Perl — those use PCRE2, which supports features the JS engine doesn't: possessive quantifiers (`a++`), atomic groups (`(?>...)`), and conditional patterns. Named capture groups (`(?<name>...)`) work in JS but require ES2018+.

## Why Developers Need This

Regex is still the most powerful and most misused text processing tool in software. Almost every pipeline that ingests free-form text — logs, form input, API responses, CSV exports — needs pattern matching. The failure mode isn't writing a wrong regex; it's writing a regex that works on test cases but breaks on production data.

The most common bugs: anchoring issues (`^` and `$` in multiline vs single-line mode), greedy vs lazy quantifiers (`.*` vs `.*?`), and forgetting to escape special characters in character classes. This playground catches all three because you're testing against real sample text before the pattern goes anywhere near production code.

**Catastrophic backtracking** is the worst failure mode and worth understanding. A pattern like `(a+)+$` on a string like `aaaaaaaaab` causes the engine to explore an exponential number of paths before failing. In a browser this freezes the tab; in a Node.js server this is a ReDoS (Regular Expression Denial of Service) vulnerability. The 500ms debounce in this tool reduces the risk, but it doesn't timeout the engine — if you write a pathological pattern on a long string, expect a freeze. The safe alternative is to use possessive quantifiers or atomic groups (PCRE) or redesign the pattern to avoid nested quantifiers.

Common patterns worth having memorized:
- **Email (permissive):** `[^\s@]+@[^\s@]+\.[^\s@]+` — matches the structure without over-validating
- **IPv4:** `\b(\d{1,3}\.){3}\d{1,3}\b` — does not validate range (0–255); add a check in code
- **ISO date:** `\d{4}-\d{2}-\d{2}` — basic; add `T\d{2}:\d{2}:\d{2}` for datetime
- **UUID v4:** `[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}`

## Tips & Power Use

- **Named capture groups** (`(?<year>\d{4})-(?<month>\d{2})-(?<day>\d{2})`) make the match object self-documenting and are available in the match list. Use them in any pattern where you're extracting structured data.
- **Lookahead and lookbehind** (`(?=...)`, `(?<=...)`) let you match text in context without including the context in the match. For example, `\d+(?= USD)` matches numbers followed by " USD" without capturing the " USD" part.
- **Test with edge cases deliberately.** If your pattern should match email addresses, test with: no TLD, multiple dots in the domain, plus signs in the local part, international domains. The preset patterns in this tool are intentionally permissive — they match structure, not validity.
- **The `s` (dotall) flag** is often forgotten. Without it, `.` doesn't match newlines — so a pattern meant to match a multi-line JSON block will silently fail. Add `s` whenever your match target spans lines.
- **Copy the pattern directly into code** — the pattern field shows exactly what goes between the `/` slashes in JavaScript. `new RegExp(pattern, flags)` works with the same inputs.

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
