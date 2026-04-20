---
title: "CSV to JSON Converter"
category: "dev"
job: "Parse CSV files or pasted text into JSON with automatic type detection and edge-case handling"
description: "Upload a CSV file or paste raw CSV text and convert it to JSON instantly. Uses PapaParse for reliable parsing — handles quoted fields, commas inside strings, multi-line values, and custom delimiters. Supports first-row-as-headers mode. Hard 10 MB file limit. Nothing leaves your browser."
aiSummary: "Client-side CSV to JSON converter powered by PapaParse (MIT). Handles edge cases like quoted commas, escaped quotes, multi-line fields, and custom delimiters. Auto-detects delimiter, applies dynamic type casting, and outputs pretty-printed JSON or minified JSON for download."
personalUse: "I use this to turn data exports from Airtable, Notion, and analytics tools into JSON I can pipe into scripts or paste into API calls. PapaParse handles the messy CSV edge cases I'd otherwise debug for 30 minutes."
status: "active"
publishedAt: "2026-04-20"
icon: "📋"
license: "MIT"
---

## How this works

Parsing is handled by [PapaParse](https://www.papaparse.com/) (MIT license), one of the most widely-used CSV parsers in JavaScript. It handles edge cases that naive `split(',')` approaches miss.

**Handled edge cases**

| Case | Example |
|------|---------|
| Commas inside quoted fields | `"Smith, John"` |
| Quotes inside quoted fields | `"He said ""hello"""` |
| Newlines inside quoted fields | Multi-line cell values |
| Different delimiters | Tab, semicolon, pipe, comma |
| Trailing newlines | Ignored automatically |
| Empty rows | Skipped when `skipEmptyLines` is on |

**Options**

| Option | Description |
|--------|-------------|
| Header row | Use the first row as JSON keys |
| Dynamic types | Parse numbers, booleans, and null automatically |
| Delimiter | Auto-detect or specify (comma, tab, semicolon, pipe) |
| Skip empty lines | Omit rows where all fields are empty |

## Limitations

- **10 MB hard limit** — enforced before parsing.
- **Encoding** — files must be UTF-8. Windows-1252 / Latin-1 encoded CSVs may produce garbled characters. Re-encode with a text editor if needed.
- **Date fields** — dates are returned as strings. Dynamic typing does not parse date formats.
