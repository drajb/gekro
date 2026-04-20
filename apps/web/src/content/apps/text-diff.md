---
title: "Text Diff / Code Compare"
category: "dev"
job: "Compare two text blocks or code files and highlight exact additions and deletions"
description: "A side-by-side and unified diff viewer. Paste two versions of any text or code and see additions highlighted in green, deletions in red, and line-level or character-level diff detail. Uses the MIT-licensed diff library. Nothing leaves your browser."
aiSummary: "Client-side text and code diff tool using the MIT-licensed diff npm package. Offers line-level and character-level diff modes, side-by-side and unified views, with addition/deletion/change statistics. Zero server contact."
personalUse: "I use this to compare API response shapes before and after a schema change, and to review prompt revisions when the diff is too subtle to spot by eye."
status: "active"
publishedAt: "2026-04-20"
icon: "⟷"
license: "MIT"
---

## How this works

Paste the original text in the left pane and the modified text in the right pane. The diff updates in real time. Two diff modes are available:

**Line diff** — compares the text line by line. Each added or removed line is shown as a block. Best for code and structured text where line boundaries are meaningful.

**Character diff** — compares at the character level within lines. Shows the exact characters that changed, including punctuation and whitespace. Best for prose or fine-grained edits.

**Views**

| View | Description |
|------|-------------|
| Unified | Single-pane output showing additions (+) and deletions (-) interleaved |
| Side-by-side | Original on left, modified on right, with aligned change highlighting |

## Limitations

- **Performance** — very large texts (>100 KB per pane) may produce diffs that take a moment to render. The diff runs synchronously on input.
- **Binary content** — binary files or base64-encoded content will produce large character-level diffs and are not a useful comparison target.
- **Whitespace** — trailing whitespace differences are shown as changes by default. The "Ignore whitespace" toggle normalises leading/trailing whitespace before diffing.
