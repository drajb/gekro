---
title: "Config Format Converter"
category: "dev"
job: "Convert config between JSON, YAML, TOML, and .env - instantly, in your browser, offline"
description: "Paste a config in any of JSON, YAML, TOML, or .env and convert it to any of the others. Auto-detects the source format, converts live as you type, and never sends your data anywhere - the parsers and serializers are hand-written and run entirely in your browser, so it works offline and your secrets stay local."
aiSummary: "A client-side config format converter between JSON, YAML, TOML, and .env. Hand-rolled zero-dependency parsers and serializers share a common intermediate representation and run fully offline; it auto-detects the source format and converts live. Covers the common-config subset of each format (nested maps, sequences, scalars, quoting, comments)."
personalUse: "I move config between formats constantly - a Docker env into a YAML values file, a JSON snippet into TOML for a Rust project, a settings block into a .env for local dev. The web converters I found either paywall it, wrap it in ads, or - worse - upload whatever I paste, which is a non-starter when the config has secrets in it. So this one never leaves the tab. That is the whole requirement."
status: "active"
publishedAt: "2026-08-08"
lastVerified: "2026-08-08"
companionPostSlug: ""
license: "MIT"
icon: "🔄"
---

## What It Does

Paste a config in one format, get it back in another. It handles the four formats that cover almost all real-world configuration:

- **JSON** - the lingua franca
- **YAML** - Kubernetes, CI pipelines, most modern app config
- **TOML** - Rust/Cargo, Python (pyproject), many Go tools
- **.env** - local development and twelve-factor apps

Pick a target format tab and the conversion happens live as you type. Leave the source on "Auto-detect" and it figures out what you pasted.

## It Runs Entirely In Your Browser

The parsers and serializers are hand-written with zero dependencies - there is no server, no upload, and no network call at any point. That matters because config files routinely contain secrets: database URLs, API keys, tokens. Anything you paste stays in the tab. You can disconnect from the internet and it still works.

## How It Works

Every format is parsed into a single plain-JavaScript intermediate value, then serialized out to the target. That shared representation is what makes any-to-any conversion clean: JSON→TOML and YAML→.env go through exactly the same middle step. The `.env` target is flat by nature, so nested keys are flattened to `PARENT_CHILD` form and arrays or objects are emitted as JSON strings.

Pairs well with the [JSON Formatter](/apps/json-formatter/) for cleaning up the JSON side and [CSV to JSON](/apps/csv-to-json/) when your data starts as a spreadsheet.

## Limitations

It targets the **common-config subset** of each format - the shapes real config files actually use. It does not implement:

- **YAML** anchors/aliases, multi-document streams (`---`), or block scalars (`|` / `>`)
- **TOML** some dotted-key and deeply-nested array-of-tables edge cases
- Comments are stripped on conversion (they have no home in the target structure)

When the input uses something outside the subset, you get a clear parse error rather than a silently wrong result. For anything exotic, treat the output as a strong first draft and eyeball it.
