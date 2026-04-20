---
title: "Markdown Visualizer"
category: "dev"
job: "Live Markdown editor with split preview, word count, and raw HTML export"
description: "A zero-dependency split-pane Markdown editor and renderer. Live preview, word and character count, copy raw HTML output, shareable URLs via base64 encoding, download as .md. No login, no upload."
aiSummary: "A client-side Markdown editor with live HTML preview, word count, raw HTML copy, and shareable URL state. No external dependencies — the parser is a ~100-line zero-dep micro-implementation."
personalUse: "I draft blog posts and READMEs in plain Markdown, then need to quickly check how they render without spinning up a local server. Built this to close that loop in one tab."
status: "active"
publishedAt: "2026-04-19"
icon: "📝"
license: "MIT"
---

## How this works

Type or paste Markdown in the left pane — the right pane renders it live using a zero-dependency micro-parser written in ~100 lines of TypeScript. No network requests, no external libraries.

**Word and character count** updates in real time. Useful for keeping READMEs under a target length or hitting a word count for documentation.

**Copy HTML** grabs the raw HTML string that the parser produced — the actual tags, not the stripped text. Paste it directly into a CMS, email template, or HTML file.

**Shareable URL** — the full Markdown content is base64-encoded into the URL. Sharing the URL gives someone else the same document. Works with Astro View Transitions.

## Supported syntax

- **Headings** — `#` through `######`
- **Inline formatting** — bold, italic, bold-italic, strikethrough, inline code
- **Links and images** — `[label](url)` and `![alt](url)`
- **Fenced code blocks** — ` ```lang ``` ` (language class preserved for downstream highlighters)
- **Blockquotes** — `>`
- **Unordered and ordered lists** (including mixed)
- **Tables** — GFM-style pipe tables
- **Horizontal rules** — `---`

## Limitations

- **No nested list indentation** — multi-level list items flatten to one level.
- **Single-line blockquotes only** — multi-line `>` blocks are not merged.
- **No footnotes, task lists, or math** — these require a full parser (e.g., markdown-it or remark).
- **HTML in source is escaped** — raw HTML in the Markdown input is treated as text, not rendered. This is intentional (XSS prevention).
- **URL length cap** — very large documents may exceed browser URL limits (~8k characters after encoding). The app silently skips URL sync above that threshold.
