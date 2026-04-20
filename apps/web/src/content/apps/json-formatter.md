---
title: "JSON Formatter & Validator"
category: "dev"
job: "Paste raw JSON to format, colorize, validate, and minify instantly"
description: "A zero-dependency JSON formatter and validator. Paste any JSON string and get instant syntax highlighting, pretty-printing with configurable indent, and precise line/column error reporting. Toggle to minified output for production use. Nothing leaves your browser."
aiSummary: "Client-side JSON formatter using native JSON.parse() for validation and a custom recursive tokenizer for syntax highlighting. Shows precise line:column error positions, supports 2 or 4 space indent, and outputs minified JSON. Zero external dependencies."
personalUse: "I paste API responses here constantly to read nested structures before writing parsers. The line-number error pinpointing is the feature I reach for most when debugging malformed JSON from third-party webhooks."
status: "active"
publishedAt: "2026-04-20"
icon: "{ }"
license: "MIT"
---

## How this works

Paste any JSON string into the input area. The formatter validates it using the native JavaScript `JSON.parse()` engine — no external library involved. On success, it renders a syntax-highlighted, indented tree view. On failure, the exact character position from the `SyntaxError` message is parsed and highlighted.

**Format modes**

| Mode | Description |
|------|-------------|
| Pretty (2 spaces) | Standard readable indent |
| Pretty (4 spaces) | Wider indent for deep nesting |
| Minified | Compact single-line output for production payloads |

**Syntax colours**

Keys are accented, strings are green, numbers are cyan, booleans and `null` are amber. Structural characters (`{`, `}`, `[`, `]`, `,`, `:`) are muted to keep them visually subordinate.

## Limitations

- **Size** — very large JSON (>5 MB) may cause a brief pause during tokenization. The formatter renders into the DOM synchronously; no virtualization is applied.
- **Comments** — JSON5 / JSONC (comments, trailing commas) are not supported. Strip comments before pasting.
- **BigInt** — numbers larger than `Number.MAX_SAFE_INTEGER` are parsed by JavaScript's standard float engine and may lose precision. This is a JavaScript limitation, not a formatter bug.
