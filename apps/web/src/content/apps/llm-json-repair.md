---
title: "LLM JSON Repair"
category: "ai"
job: "Turn a model's almost-JSON output into valid, parseable JSON - and check it against your schema"
description: "Paste the broken JSON a language model just handed you - markdown fences, single quotes, unquoted keys, trailing commas, Python True/None, unclosed brackets, raw newlines - and get valid JSON back, with a plain-English list of every fix. Optionally validate the result against a JSON Schema. Runs entirely in your browser; your data never leaves the page."
aiSummary: "A client-side JSON repair tool for LLM output. A forgiving recursive-descent parser rebuilds guaranteed-valid JSON from malformed model output (fences, single quotes, unquoted keys, trailing commas, Python literals, unclosed brackets, unescaped newlines) and lists every fix, with an optional zero-dependency JSON-Schema validator."
personalUse: "Every agent I build eventually hands me a tool call that is 95% valid JSON with one trailing comma or a stray markdown fence, and re-prompting the model to 'fix your JSON' is slow and unreliable. I wanted a deterministic repair I could paste into in one second, see exactly what was wrong, and confirm it matches the schema my code expects - so a flaky generation stops blocking me."
status: "active"
publishedAt: "2026-07-05"
lastVerified: "2026-07-05"
companionPostSlug: ""
license: "MIT"
icon: "🩹"
---

## What It Does

Language models are great at *almost* producing JSON. The last five percent - a trailing comma, a smart quote, a `True` instead of `true`, a markdown fence wrapped around the whole thing, an object that got cut off mid-generation - is where your parser throws and your pipeline stalls.

This tool takes that broken output and returns valid JSON. It does not patch the text with fragile regexes; it runs a forgiving recursive-descent parser that reads the malformed input, builds a real value, and serializes it back out. Because the output comes from `JSON.stringify` of a genuine object, it is always structurally valid.

## What It Repairs

- **Markdown fences** - strips a surrounding ` ```json ... ``` ` block, the single most common failure.
- **Prose around the JSON** - "Here is the JSON you asked for: {...}" - skips text before the first `{` or `[`.
- **Quotes** - single-quoted strings and keys become double-quoted; curly "smart" quotes are normalized.
- **Unquoted keys** - `{ name: "x" }` becomes `{ "name": "x" }`.
- **Trailing and extra commas** - `[1, 2, 3,]` and `{,"a":1}`.
- **Python and JS literals** - `True/False/None/NaN/Infinity/undefined` are coerced to their JSON equivalents.
- **Unescaped control characters** - a raw newline or tab inside a string value is escaped.
- **Comments** - `//` and `/* */` are removed.
- **Unclosed structures** - a truncated object or array is auto-closed.

Each repair shows up in the "What I fixed" list so you know exactly what changed.

## Schema Validation

Open the schema panel and paste a JSON Schema to check the repaired result. The validator is a deliberately small, dependency-free subset covering the keywords that matter for real tool schemas: `type`, `properties`, `required`, `items`, `enum`, `additionalProperties`, `minimum`, `maximum`, `minLength`, `maxLength`, and `pattern`. Errors are reported per JSON path.

Pairs naturally with the [JSON Formatter](/apps/json-formatter/) (once it is valid) and [JSON Schema to Tool Definition](/apps/json-schema-to-tool/) (going the other direction).

## Limitations

- **It guesses.** Auto-closing a truncated object or quoting a bareword is a best-effort interpretation, not a certainty. Always eyeball the result.
- **First value only.** If the input contains several concatenated JSON values, it repairs the first and notes that the rest was ignored.
- **Schema subset.** The validator does not implement `$ref`, `allOf`/`anyOf`/`oneOf`, `format`, or conditional schemas. It covers the common flat-and-nested tool-schema shape, not the full Draft 2020-12 spec.
- **Not a linter for valid JSON.** If your input already parses, it is passed through and pretty-printed unchanged.
