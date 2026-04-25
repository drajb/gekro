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

## What It Does

The JSON Formatter takes any JSON string — raw, minified, partially broken — validates it, and renders a syntax-highlighted, properly indented version. When validation fails, it shows the exact line and column number of the error. Toggle to minified output for production payloads. Zero external dependencies; everything runs in the browser using native `JSON.parse()`.

It's aimed at developers who regularly work with API responses, webhook payloads, configuration files, and database exports. Readable JSON is not a luxury — it's how you catch structural bugs before writing the code that depends on the structure.

## How to Use It

1. Paste any JSON string into the input area — raw, minified, or partially formatted.
2. The formatter validates on paste and renders the highlighted output instantly.
3. Select **indent width** (2 or 4 spaces) based on your codebase convention.
4. Toggle **Minify** to produce compact single-line output for production use, log shipping, or embedding in configs.
5. Click **Copy** to grab the formatted or minified output.
6. If the JSON is invalid, the error message shows the exact position — use it to navigate directly to the problem.

## The Math / How It Works

Validation uses native JavaScript `JSON.parse()` — the browser's built-in JSON parser, which is fast, spec-compliant, and produces a precise `SyntaxError` with character position on failure. The formatter extracts the position from the error message string and maps it to a line:column coordinate by walking the input character by character.

Pretty-printing uses `JSON.stringify(parsed, null, indent)` for correctness, then applies a recursive tokenizer for syntax highlighting. The tokenizer walks the JSON string character by character, classifying each token (key, string value, number, boolean, null, structural character) and wrapping it in a `<span>` with the appropriate color class.

**Syntax colors:**
- Keys: accent color (purple/blue)
- String values: green
- Numbers: cyan
- Booleans (`true`/`false`) and `null`: amber
- Structural characters (`{`, `}`, `[`, `]`, `,`, `:`): muted grey

Structural characters are intentionally de-emphasized so the data stands out visually.

**Format modes:**

| Mode | Description |
|------|-------------|
| Pretty (2 spaces) | Standard readable indent |
| Pretty (4 spaces) | Wider indent for deep nesting |
| Minified | Compact single-line output for production payloads |

## Why Readable JSON Matters in Debugging

Minified JSON is machine-readable but not human-readable. A single-line 40KB webhook payload is effectively opaque when you're trying to understand its shape. Formatting it — with proper indentation and syntax highlighting — makes the structure visible in seconds.

The most common debugging workflow that this tool supports: a third-party API starts sending malformed JSON, your parser throws an error, you paste the raw payload here to see what's wrong. The error position points you directly to the problem — a trailing comma, an unquoted key, a mismatched bracket, a control character in a string value.

**JSON5 vs strict JSON** is a distinction worth knowing. JSON5 is a superset of JSON that allows trailing commas, comments, and unquoted keys. It's used in some configuration files (VS Code's `settings.json`, for example). Strict JSON — what this tool validates against — does not allow any of these. If you paste a JSON5 file and get a syntax error at a comment or trailing comma, that's why. Strip those before pasting.

**Trailing commas** are the #1 source of JSON syntax errors in practice. Most programming languages allow trailing commas in arrays and objects. JSON does not. A developer who writes `{"key": "value",}` and pastes it into an API request gets a parse error — often from the server, with a cryptic message. Formatting the payload before sending catches this immediately.

**Unquoted keys** are the #2 source. JavaScript object literals use unquoted keys (`{key: "value"}`); valid JSON requires quoted keys (`{"key": "value"}`). Copy-pasting a JS object literal as JSON is a common mistake in tooling scripts.

**BigInt precision loss** matters for systems that use 64-bit integer IDs (Twitter/X IDs, Snowflake IDs, database primary keys). JavaScript's `JSON.parse()` parses all numbers as IEEE 754 doubles, which can represent integers exactly only up to 2^53. An ID like `1745271000000000001` will silently round to `1745271000000000000`. The formatter warns on this but cannot fix it — this is a JavaScript runtime limitation requiring a BigInt-aware parser.

## Tips & Power Use

- **The line:column error position is the key feature.** When debugging a malformed 2,000-line config file, `SyntaxError at line 847, column 23` is the difference between a 30-second fix and a 20-minute hunt.
- **Use minify for log shipping.** JSON logs in production systems should be minified — each log line is one JSON object, no embedded newlines. Paste your structured log object here, minify, and use the output as your log format template.
- **Validate before writing a parser.** If you're writing code to parse a JSON response, paste an example response here first and walk the structure visually. Spot the field names, nesting depth, and types before writing `response.data.items[0].attributes.name`.
- **Nested arrays of objects** — the most common complex structure — render much more clearly in 4-space indent mode. Use 2-space for shallower structures.
- **For JSON5 configs** (VS Code settings, ESLint, etc.): manually remove comments and trailing commas before pasting. The formatted strict JSON output can then be used as a clean reference copy.
- **Pair with the [Text Diff](/apps/text-diff/)** tool: format two versions of a JSON response here (one before a schema change, one after), then paste both into the diff tool to see exactly which fields changed.

## Limitations

- **Size** — very large JSON (>5 MB) may cause a brief pause during tokenization. The formatter renders into the DOM synchronously; no virtualization is applied.
- **Comments** — JSON5 / JSONC (comments, trailing commas) are not supported. Strip comments before pasting.
- **BigInt** — numbers larger than `Number.MAX_SAFE_INTEGER` are parsed by JavaScript's standard float engine and may lose precision. This is a JavaScript limitation, not a formatter bug.
