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

## How conversion works

When you paste into the input area, the browser provides the content as HTML (even when copying from word processors). This tool walks the HTML DOM tree recursively and maps each element to its Markdown equivalent.

### Elements supported

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

### Tips

- **Google Docs**: copy normally, paste into the tool.
- **Microsoft Word**: copy normally; Word exports rich HTML on paste.
- **Raw HTML**: switch to the "HTML input" tab and paste raw markup.
- Nested lists are supported up to 3 levels.

### Limitations

- Complex Word formatting (text colors, page borders, footnotes) is stripped.
- Inline styles (font-size, color) are ignored — only semantic structure is preserved.
- Very large documents (100k+ characters) may be slow to process.
