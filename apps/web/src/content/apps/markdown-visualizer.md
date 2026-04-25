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

## What It Does

The Markdown Visualizer is a split-pane editor that renders your Markdown to HTML in real time. Left pane is raw text; right pane is the rendered output, updating on every keystroke. The parser is a zero-dependency micro-implementation written in ~100 lines of TypeScript — no network requests, no markdown-it, no remark, no dependencies at all.

It's aimed at developers and writers who work in plain Markdown and want to verify their formatting quickly — without spinning up a local dev server, installing a VS Code extension, or opening GitHub's preview tab. The shareable URL feature lets you share a draft document as a single link with no backend involved.

## How to Use It

1. Type or paste your Markdown in the left pane. The right pane updates live.
2. Check **word count and character count** in the toolbar — useful for keeping READMEs under a target length.
3. Click **Copy HTML** to grab the raw HTML string the parser produced. Paste it directly into a CMS, email template, or HTML file.
4. Click **Share** to generate a shareable URL. The full Markdown is base64-encoded into the URL hash — anyone with the link sees the same document.
5. Click **Download** to save the source as a `.md` file.

## The Math / How It Works

The parser is a line-by-line and inline-pass regex transformer, not a proper AST parser. It processes the input in two stages:

**Block-level pass** — each line is matched against block patterns in priority order: fenced code blocks, headings (`#` through `######`), blockquotes, ordered and unordered lists, horizontal rules, and pipe tables. Matching lines are wrapped in the appropriate HTML element.

**Inline pass** — within each text block, a series of regex substitutions handles bold-italic, bold, italic, strikethrough, inline code, images, and links. The order matters: bold-italic (`***`) must be matched before bold (`**`) to avoid greedy match errors.

The shareable URL uses `btoa(encodeURIComponent(markdown))` to produce a URL-safe base64 string stored in the hash. On load, `decodeURIComponent(atob(hash))` restores it. This is purely client-side — nothing hits a server.

## Why Developers Need This

Seeing rendered Markdown during authoring catches problems that are invisible in raw text. The most common: forgetting to close a code fence (everything after it renders as code), pipe table column misalignment (the table silently breaks), and link syntax mistakes (`[text](url` vs `[text](url)`).

The GFM vs CommonMark distinction matters more than most people realize. GitHub Flavored Markdown (GFM) supports pipe tables, strikethrough, and task lists — CommonMark does not. Many documentation platforms (Docusaurus, MkDocs, Hugo) use a specific Markdown dialect, and a table that renders perfectly in GitHub will break in CommonMark-strict mode if you have unescaped pipes in cells. This tool implements GFM-style tables so you can verify table syntax before committing.

For documentation pipelines and static site generators, this is also useful for one-off conversion checks: paste a chunk of docs, verify it looks right, copy the HTML for a CMS field, or confirm heading hierarchy before publishing.

## Tips & Power Use

- **Use the character count** to manage long READMEs. GitHub truncates READMEs in the repository view beyond a certain render threshold; keeping under ~65,000 characters is safe.
- **The "Copy HTML" button** is particularly useful for CMS systems that accept HTML but not Markdown. Ghost, Substack, and some Webflow inputs accept pasted HTML well.
- **Shareable URLs work in Slack and Discord** — the full document is in the URL, so preview unfurls with the link, not the content. Share the link, not the rendered output.
- **Verify table syntax here before committing to GitHub.** GFM tables need a separator row (`|---|---|`) with at least one dash per cell. Missing separators silently render the table as plain text.
- **The inline code pass escapes HTML before rendering** — so pasting code samples with `<div>` tags won't break the preview output.

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
