---
title: "Markdown Table Generator"
category: "dev"
job: "Build a markdown table in a spreadsheet-style grid - then copy it as Markdown, CSV, or HTML"
description: "Edit a table in a familiar grid: add and remove rows and columns, set per-column alignment, and watch the GitHub-Flavored-Markdown update live. Import an existing CSV or markdown table to keep editing it, then copy the result as Markdown, CSV, or HTML. Runs entirely in your browser."
aiSummary: "A client-side markdown table editor. A spreadsheet-style grid with add/remove rows and columns and per-column alignment emits a GitHub-Flavored-Markdown table live, plus CSV and HTML output. Imports existing CSV or pipe/markdown tables. Pipes are escaped for markdown and values HTML-escaped for the HTML output; zero dependencies."
personalUse: "Writing markdown tables by hand is miserable - counting pipes, lining up the separator row, re-aligning everything when one cell gets longer. I wanted to edit the table like a spreadsheet and have the correct markdown fall out, including the alignment colons, so my READMEs and blog posts stop having broken tables."
status: "active"
publishedAt: "2026-08-08"
lastVerified: "2026-08-08"
companionPostSlug: ""
license: "MIT"
icon: "▦"
---

## What It Does

Markdown tables are tedious to write by hand and easy to break - a missing pipe, a misaligned separator row, and the whole thing renders as plain text. This tool lets you edit the table as a grid, the way you would in a spreadsheet, and produces correct GitHub-Flavored Markdown automatically.

- Add and remove rows and columns with one click
- Set each column's alignment (left / center / right) - the markdown separator row gets the right `:---:` colons
- Watch the output update live as you type
- Copy the result as **Markdown**, **CSV**, or **HTML**

## Import What You Already Have

Paste an existing CSV or a markdown/pipe table into the import box and it loads straight into the grid, so you can keep editing a table you already started instead of rebuilding it.

## Correct and Safe Output

Cell content that contains a pipe (`|`) is escaped as `\|` so it can't break the markdown table structure, and the HTML output HTML-escapes every value. Nothing you type is rendered as live HTML - it is only ever emitted as text - so pasted content can't corrupt the output or the page.

Handy alongside the [Rich Text to Markdown](/apps/rich-text-to-markdown/) converter and the [Markdown Visualizer](/apps/markdown-visualizer/) for previewing the result.

## Limitations

- Markdown tables themselves don't support multi-line cells, merged cells, or nested blocks - that's a limitation of the format, not the tool. Newlines in a cell are collapsed to spaces.
- The grid is capped at 100 rows and 26 columns, which is far beyond what a readable markdown table should ever be.
