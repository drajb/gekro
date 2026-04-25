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

## What It Does

Text Diff compares two text blocks or code files and highlights exactly what changed: additions in green, deletions in red. Two diff modes (line-level and character-level) and two views (unified and side-by-side) let you choose the granularity and layout that suits the content. A summary shows total additions, deletions, and changed lines.

It's for developers comparing API response schemas, prompt engineers comparing system prompt versions, and anyone who needs to see the precise difference between two text documents without a git repository in scope.

## How to Use It

1. Paste the **original text** in the left pane.
2. Paste the **modified text** in the right pane.
3. The diff updates in real time — no submit button needed.
4. Switch between **Line diff** (whole-line additions/deletions) and **Character diff** (character-level changes within lines).
5. Toggle between **Unified** view (single pane, changes interleaved) and **Side-by-side** view (original left, modified right, aligned).
6. Check the summary for total additions (+) and deletions (-) counts.

## The Math / How It Works

The diff algorithm is the **Longest Common Subsequence (LCS)**, implemented in the MIT-licensed `diff` npm package. LCS finds the largest sequence of elements that appear in both inputs in the same order — the "unchanged" backbone. Everything not in the LCS is classified as either an addition or a deletion.

For line diff mode, the algorithm treats each line as a single element. For character diff mode, it treats each character as an element. Character-level diff on large texts is slower (the LCS problem is O(n×m) in the general case) but reveals subtle changes invisible at line granularity.

**Why LCS, not simpler approaches?** A naive character-by-character comparison from left to right would flag an insertion at position 5 as a deletion of everything after position 5 and an addition of the rest. LCS correctly identifies that most of the text is shared and only shows the actual delta. This is what makes git's `diff` output meaningful — it's LCS-based too.

**Two diff views:**

| View | Description |
|------|-------------|
| Unified | Single-pane output showing additions (+) and deletions (-) interleaved |
| Side-by-side | Original on left, modified on right, with aligned change highlighting |

## Why Diff Is Fundamental to Development

Version control is built on diff. Every `git diff`, every pull request review, every merge conflict resolution is LCS-based diffing at its core. Understanding diff output is not a git skill — it's a text reasoning skill that applies wherever two versions of anything exist.

**API schema changes** are where this tool is most immediately useful. When a third-party API updates its response format, the change is often subtle — a renamed field, an added nullable field, a changed type from string to integer. Pasting the before and after JSON (formatted via the [JSON Formatter](/apps/json-formatter/)) into the diff tool shows the exact delta in seconds, without having to read both responses line by line.

**Prompt engineering** generates the most underrated use case. When you're iterating on a system prompt and the model behavior changes between versions, you need to know exactly what changed in the prompt to understand why behavior changed. Comparing prompt v1 and v2 with character-level diff shows every word change, reordering, and deleted instruction — which is the only way to reason causally about model behavior differences.

**Code review without git** happens more often than it should — legacy codebases, configuration files managed outside version control, vendor code that can't be committed. Text diff provides a lightweight review path that doesn't require any tooling setup.

**Documentation migrations** — converting content from one format to another (rich text to Markdown, Word to HTML) — benefit from diffing the original and the converted output to catch truncated sections, mangled formatting, or missing content before publishing.

The unified diff format is also the standard for patch files. A `diff -u` output can be applied with `patch` to recreate the change. This tool doesn't produce patch files, but understanding unified diff output is the same skill.

## Tips & Power Use

- **Use character diff for prose edits.** Line diff on prose shows entire paragraphs as changed when only a word moved. Character diff shows the exact word-level change.
- **Use line diff for code.** Code changes are meaningful at the line level — a changed function signature is one line diff, not hundreds of character changes. Line mode is faster and more readable for structured text.
- **Ignore whitespace toggle** normalizes leading/trailing whitespace before diffing. Use this when comparing code that was re-indented or reformatted without semantic changes.
- **Prompt comparison workflow:** keep a versioned text file of each system prompt iteration. When behavior changes unexpectedly, diff the last two versions at character level to see every change — including the subtle rewordings that are easy to overlook.
- **JSON schema comparison:** format both JSON responses in the [JSON Formatter](/apps/json-formatter/) first (pretty-print at the same indent level), then paste both into the diff tool. The structured, consistent formatting makes the diff far more readable than comparing raw or inconsistently indented JSON.
- **For very large texts (>100KB per pane)**, the diff computation may take a few seconds. The character-level diff mode is slower than line-level on large inputs — switch to line mode if you need interactive speed on big files.

## Limitations

- **Performance** — very large texts (>100 KB per pane) may produce diffs that take a moment to render. The diff runs synchronously on input.
- **Binary content** — binary files or base64-encoded content will produce large character-level diffs and are not a useful comparison target.
- **Whitespace** — trailing whitespace differences are shown as changes by default. The "Ignore whitespace" toggle normalises leading/trailing whitespace before diffing.
