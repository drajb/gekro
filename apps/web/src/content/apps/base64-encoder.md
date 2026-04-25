---
title: "Base64 & URL Encoder"
category: "dev"
job: "Encode/decode Base64, URL encoding, HTML entities, and hex — four encodings in one tool"
description: "Encode and decode Base64 (standard, URL-safe, no-padding), URL encoding (encodeURIComponent and encodeURI), HTML entities, and hex. Supports file-to-Base64 encoding. Auto-detects encoded input. Zero dependencies, runs in-browser."
aiSummary: "A client-side encoding utility covering Base64 (standard/URL-safe/no-padding), URL encoding (encodeURIComponent/encodeURI variants), HTML entity encoding, and hex encoding with configurable separators. Supports file-to-Base64 and auto-detects encoding direction."
personalUse: "API debugging, JWT decoding (the payload is just Base64), pasting binary data into configs, URL-encoding query parameters. I use some flavor of this daily."
status: "active"
publishedAt: "2026-04-24"
lastVerified: "2026-04-24"
companionPostSlug: ""
license: "MIT"
icon: "🔢"
---

## What It Does

Four encoding schemes in one tool: Base64, URL encoding, HTML entities, and hex. Each mode has its own options (Base64 variants, URL encoding scope, hex separators). Switch the direction toggle to encode or decode. Hit Auto to let the tool detect which direction makes sense for your input.

Everything runs in the browser. No data is sent anywhere.

## The Four Encodings

### Base64

Converts binary data (or UTF-8 text) to a printable ASCII string using a 64-character alphabet (A-Z, a-z, 0-9, +, /). Output is roughly 33% larger than input. The most common encoding you'll encounter in web development.

**When to use:** embedding binary data in JSON, sending images in API payloads, reading JWT tokens, data URIs (`data:image/png;base64,...`).

### URL Encoding (Percent Encoding)

Converts characters that are unsafe in URLs to `%XX` hexadecimal sequences. The space becomes `%20`, `&` becomes `%26`, and so on.

**When to use:** query string values, form submissions, any time you're embedding user input into a URL.

### HTML Entities

Converts reserved HTML characters to their entity representations: `<` becomes `&lt;`, `&` becomes `&amp;`, `"` becomes `&quot;`. Supports both named entities (`&copy;`) and numeric entities (`&#169;`).

**When to use:** rendering user-generated content in HTML, preventing XSS, generating HTML from code.

### Hex

Converts each byte of UTF-8 text to its two-character hexadecimal representation. "Hello" becomes `48 65 6c 6c 6f`. Configurable separators: space (readable), `0x` prefix (code-style), or none (compact).

**When to use:** debugging binary protocols, inspecting byte values, copying data into tools that expect hex strings.

## Base64 Variants — When URL-Safe Matters

Standard Base64 uses `+` and `/` as the 62nd and 63rd characters. These are reserved characters in URLs, which means a standard Base64 string embedded in a URL must be percent-encoded — turning `+` into `%2B` and `/` into `%2F`. That adds noise and length.

**URL-safe Base64** solves this by substituting `-` for `+` and `_` for `/`. The rest of the encoding is identical. You can convert between the two by swapping these two characters.

| Variant | Characters | Padding | Common use |
|---------|-----------|---------|------------|
| Standard | `+` `/` `=` | Yes | MIME, email, most APIs |
| URL-safe | `-` `_` `=` | Yes | JWTs, OAuth tokens, URL params |
| No padding | `-` `_` | No | JWTs (standard drops `=`), compact storage |

JWTs specifically use URL-safe Base64 without padding. When you decode the header or payload of a JWT, this tool handles the variant automatically — paste the segment and switch to Decode.

## Why Developers Need This

**JWT inspection** — a JWT (`eyJhbGci...`) is three URL-safe Base64 segments separated by dots. The header and payload are plain JSON, base64-encoded. Paste the payload segment here, switch to Decode, and read the claims directly — without sending the token to a third-party site.

**Data URIs** — embedding images or fonts directly in CSS or HTML requires base64-encoding the binary file. Use the "Encode file" toggle in Base64 mode to convert any file to a data URI payload.

**API debugging** — when an API returns an opaque base64-encoded blob, paste it here to see the underlying content. When building a request that requires base64 encoding, test the encoding before it hits the wire.

**Query string construction** — building a URL with user input in a query parameter? `encodeURIComponent` handles the edge cases (it encodes `&`, `=`, `+`, and more) so your parameter values don't corrupt the URL structure.

**HTML template generation** — generating HTML programmatically and need to safely embed user input? HTML entity encoding here shows you exactly what the escaped output looks like before it hits the DOM.

## Common Use Cases — Quick Reference

| Task | Mode | Direction | Notes |
|------|------|-----------|-------|
| Decode a JWT payload | Base64 | Decode | Paste the middle segment only (between the two dots) |
| Encode an image as data URI | Base64 → Encode file | Encode | Toggle "Encode file", drop the image |
| Inspect a percent-encoded URL | URL | Decode | Use either variant — both decode the same |
| Encode a query param value | URL | Encode | Use `encodeURIComponent` (encodes `&` and `=`) |
| Escape HTML for safe rendering | HTML Entities | Encode | Converts `<>&"'` to named entities |
| Debug raw bytes in a string | Hex | Encode | Shows byte values; use `0x` separator for code |
| Decode a hex dump | Hex | Decode | Strips `0x` prefixes and spaces automatically |

## Limitations

- **Binary file decoding** — Base64 decode produces UTF-8 text output. If the original binary was not valid UTF-8 (e.g. a PNG file), the decoded output will contain garbage characters. Use "Encode file" mode for binary-to-base64, not the reverse.
- **Large files** — encoding very large files (100+ MB) in-browser may be slow and memory-intensive. For production use cases at scale, use `base64` CLI or a library.
- **URL encoding scope** — `encodeURI` is designed for full URLs and deliberately leaves some characters unencoded (`/ ? & = # :`). For encoding values inside query strings, always use `encodeURIComponent`.
- **HTML entity completeness** — this tool covers the most common reserved characters. For exhaustive HTML entity handling (all 2000+ named entities), use a dedicated library.
