---
title: "Rich Text → Markdown"
description: "Paste rich text from Google Docs, Word, or any web page and convert it to clean Markdown instantly. Handles headings, bold, italic, lists, tables, links, and code."
job: "Paste rich text or HTML → clean Markdown, copy in one click"
icon: "✍️"
category: "dev"
status: "active"
publishedAt: "2026-04-19"
lastVerified: "2026-04-19"
license: "MIT"
aiSummary: "Converts rich text or raw HTML to Markdown. Accepts clipboard paste from Google Docs, Microsoft Word, or any web source. Handles headings, bold, italic, strikethrough, inline code, fenced code blocks, ordered and unordered lists, nested lists, blockquotes, links, images, and GFM tables."
personalUse: "I write in Notion and Google Docs, then paste into markdown files constantly. The format is always mangled. This fixes it in one paste."
companionPostSlug: ""
---

## What It Does

Rich Text to Markdown converts content copied from Google Docs, Microsoft Word, Notion, web pages, or any rich-text source into clean, portable Markdown. Paste the content and the converter walks the underlying HTML structure — which every rich-text clipboard provides — and maps it to semantic Markdown: headings, bold, italic, lists, tables, links, code blocks, and blockquotes.

The result is plain-text Markdown you can paste directly into a `.md` file, a static site generator, a GitHub PR description, or any Markdown-accepting input — without the formatting garbage that accumulates when you paste rich text directly.

## How to Use It

1. Copy content from Google Docs, Microsoft Word, a web page, or any rich-text source.
2. **Paste** into the input area. The browser delivers the clipboard HTML automatically.
3. The Markdown output appears instantly in the right pane.
4. Click **Copy** to grab the Markdown output with one click.
5. Alternatively, switch to the **HTML input** tab and paste raw HTML markup directly.

For Google Docs: standard copy (Cmd+C / Ctrl+C) is sufficient. For Microsoft Word: same — Word exports semantic HTML on paste. For web pages: select the text and copy; the browser provides the underlying HTML.

## The Math / How It Works

When you paste rich text into a browser input, the browser exposes both plain text and HTML versions via the Clipboard API. This tool reads the HTML version — which retains structural information that the plain text version discards — and walks the DOM tree recursively.

Each HTML element is mapped to its Markdown equivalent:

| HTML | Markdown output |
|------|----------------|
| `<h1>`–`<h6>` | `#` through `######` |
| `<strong>`, `<b>` | `**bold**` |
| `<em>`, `<i>` | `*italic*` |
| `<del>`, `<s>` | `~~strikethrough~~` |
| `<code>` | `` `inline code` `` |
| `<pre><code>` | Fenced code block |
| `<a>` | `[text](url)` |
| `<img>` | `![alt](src)` |
| `<ul>` / `<li>` | `- item` |
| `<ol>` / `<li>` | `1. item` |
| `<blockquote>` | `> quote` |
| `<table>` | GFM pipe table |
| `<hr>` | `---` |

Nested lists are handled recursively, preserving up to 3 levels of indentation. `<div>` and `<span>` elements are treated as transparent wrappers — only their children are processed, not the container itself.

Inline styles (color, font-size, margin) are stripped entirely. Only semantic structure is preserved.

## Why Markdown Portability Matters

Rich text is not portable. A Google Doc looks correct in Google Docs, a Word document in Word, a Notion page in Notion — but copy that content into a different system and the formatting either breaks or imports with proprietary markup that requires cleanup. This is the fundamental problem with rich text: it ties content to the rendering system.

Markdown is format-portable. The same `.md` file renders correctly in GitHub, Obsidian, Hugo, Docusaurus, MkDocs, Astro, VS Code, and every other Markdown-aware system. It's plain text — it diffs cleanly in git, stores in any database, and survives format changes without data loss.

**The documentation pipeline problem** is where this matters most in engineering contexts. Technical documentation often originates in Google Docs (where stakeholders can comment) and needs to land in a static site generator (where developers maintain it). The conversion path — Google Docs → copy → paste into `.md` file — is a regular task that accumulates formatting debt unless you have a clean converter. This tool eliminates one step in that pipeline.

**Prompt engineering** is a newer use case. When I'm writing system prompts, I often draft them in a rich-text editor where I have spell check, history, and collaboration. Converting to plain Markdown before pasting into a prompt template keeps the output clean and avoids hidden formatting characters that occasionally confuse tokenizers.

**Static site generator workflows (Astro, Hugo, etc.)** need clean Markdown front matter and body. Pasting from any rich-text source without conversion creates character encoding issues, non-breaking spaces, and Microsoft-specific quotation marks that break syntax highlighting and code blocks in the rendered output.

## Tips & Power Use

- **Google Docs tables paste cleanly** as GFM pipe tables. This is the most valuable conversion for documentation work — HTML tables from Docs become portable Markdown tables.
- **Check nested list depth.** The converter handles 3 levels. If your source has 4+ levels of nesting, the deepest levels will flatten. Restructure the source first.
- **Word documents with tracked changes** may produce unexpected output — Accept All Changes before copying if your content has revisions pending.
- **Code blocks require semantic markup.** If the source uses `<pre><code>`, it converts to a fenced code block. If the source just has a bold monospace paragraph (a common shortcut in Google Docs), it won't be detected as code. Use the Docs "Insert > Building blocks > Code block" feature for code that should convert correctly.
- **Use the HTML tab for raw HTML input** — useful when you have a CMS's HTML export and need to convert it to Markdown for migration to a static site generator.
- **Pair with the [Markdown Visualizer](/apps/markdown-visualizer/)** — convert here, then paste the output there to verify the Markdown renders as expected before committing it to a file.

## Limitations

- Complex Word formatting (text colors, page borders, footnotes) is stripped.
- Inline styles (font-size, color) are ignored — only semantic structure is preserved.
- Very large documents (100k+ characters) may be slow to process.
