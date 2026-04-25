---
title: "Prompt Diff"
category: "ai"
job: "Compare two prompt versions side-by-side — spot every change at a glance"
description: "Paste two versions of a system prompt or user message and get an instant line-by-line and word-by-word diff. Color-coded additions, removals, and changes. See token count delta and similarity score. Zero dependencies, runs in-browser."
aiSummary: "A browser-based prompt comparison tool that runs Myers diff on two prompt versions, highlighting additions in green and deletions in red at both line and word granularity. Shows character delta, estimated token delta, and a Sørensen-Dice similarity score computed from the LCS of the two prompts."
personalUse: "When iterating on a system prompt through 5-6 versions, I lose track of what actually changed. This shows me the exact delta so I know what I'm A/B testing."
status: "active"
publishedAt: "2026-04-24"
lastVerified: "2026-04-24"
companionPostSlug: ""
license: "MIT"
icon: "🔀"
---

## What It Does

Paste Version A (before) and Version B (after) of any prompt — system prompt, user message, few-shot example, whatever — and the tool produces a color-coded diff. Green lines or words were added. Red lines or words were removed. Grey lines are unchanged. The stats bar shows character count delta, line count delta, estimated token delta, and a similarity percentage.

Two diff modes: **Line diff** for high-level structure changes (added paragraphs, moved sections), **Word diff** for fine-grained edits within lines (changed phrasing, substituted words).

Everything runs in the browser. No data leaves your machine.

## How to Use It

1. Paste the original prompt into **Version A — Before** on the left.
2. Paste the revised prompt into **Version B — After** on the right.
3. The diff renders immediately. Switch between **Line diff** and **Word diff** using the tabs.
4. Read the stats bar to see at a glance how much the prompt grew or shrank.
5. Use **Copy Result** to copy the unified plain-text diff to clipboard.
6. Use **Export** to download a `.txt` file with both prompt versions and the diff — useful for sharing with teammates or storing in version history.

## How the Diff Works

### LCS and Myers diff

The diff algorithm is an implementation of the Myers diff approach via dynamic programming on the Longest Common Subsequence (LCS). The idea:

1. Build an `(m+1) × (n+1)` DP table where `m` is the length of sequence A and `n` is the length of sequence B.
2. Fill the table: `dp[i][j] = dp[i-1][j-1] + 1` if `A[i] == B[j]`, otherwise `max(dp[i-1][j], dp[i][j-1])`.
3. Backtrack from `dp[m][n]` to reconstruct the edit script: where elements matched (diagonal move), emit `eq`; where we consumed from B only (left move), emit `add`; where we consumed from A only (up move), emit `rem`.

This is O(m × n) time and space — fine for prompt-sized text (hundreds of lines, thousands of words). It won't degrade at any realistic prompt size.

### Line diff mode

For line diff, the sequence elements are individual lines (split on `\n`). Each line is treated as an atomic unit. If a single word changes inside a line, the entire line is shown as removed and re-added. This gives a clean, git-style view of structural changes.

### Word diff mode

For word diff, the text is tokenized into whitespace-separated tokens (words and whitespace sequences are both tokens, preserving the ability to reconstruct the original). The LCS diff runs on this token array. Changed words are highlighted inline within their line context, unchanged text is shown in muted grey. This mode is better for spotting phrasing changes — a reworded sentence shows exactly which words swapped.

### Similarity score

The similarity score uses Sørensen-Dice on the LCS:

```
similarity = (2 × matched_elements) / (|A| + |B|)
```

Where `matched_elements` is the count of elements in the LCS (the `eq` entries in the edit script). A score of 100% means the prompts are identical. 0% means they share no common elements at all. In practice, iterative prompt refinements tend to score 70–95% — enough shared structure that most elements are unchanged, but meaningful additions and deletions.

The score updates in real time as you type. It's computed on the same sequence used for the diff (lines in line mode, words in word mode), so switching modes will change the score.

## Why Prompt Engineers Need This

Prompt engineering is software engineering in disguise, with one important difference: version control tooling built for code treats prompts as opaque text blobs. `git diff` on a prompt file works, but it doesn't render in context, doesn't show token counts, and you can't run it on two prompts you're comparing in a notebook or chat interface.

In practice, prompt iteration looks like this: you have v1 that performs at 80% on your eval set. You make what you think is a targeted tweak and get v2. Did v2 actually do what you intended? Without a diff, you're comparing two blocks of text by memory, which degrades fast past 200 words.

**The most common failure mode** is a prompt that works in testing because you subconsciously remember the intended behavior, but the actual text change was broader than you realized — you rephrased a constraint slightly and the model stopped following it in edge cases. A diff makes that visible.

**Prompt regression testing** is another use case. If you're running evaluations and a previously-passing test starts failing after a prompt update, the diff tells you exactly which lines changed so you can isolate the cause. Without it, you're debugging a black box by re-reading a 500-word document and trying to spot the difference.

**Collaboration** is a third case. Sending `v7_final_FINAL.txt` to a teammate is bad enough. Sending them the diff alongside it tells them precisely what changed and why those changes should matter — it's the commit message for your prompt.

## Reading the Diff

**Green lines / words** — present in Version B but not Version A. These are additions.

**Red lines / words** — present in Version A but not Version B. These are deletions. In line mode, a changed line appears as one red line (removed) followed by one green line (added). In word mode, changed words appear inline as red struck-through text next to the green replacement.

**Grey lines** — unchanged. Present in both versions. In line mode, all unchanged lines are shown. There's no context collapse (no `...` ellipsis hiding lines) — prompt diffs are short enough that full context is always useful.

**Stats bar:**
- **Char delta** — net change in character count. A positive number means the prompt grew.
- **Line delta** — net change in line count. Useful for spotting added paragraphs.
- **Token delta** — estimated cl100k token change. Relevant for context window planning and cost estimation.
- **Similarity** — Sørensen-Dice score. High (>85%): minor edits. Medium (50–85%): significant rewrites. Low (<50%): substantially different prompts.

## Tips & Power Use

**Use line diff first, then word diff.** Line diff shows you which paragraphs changed. Word diff shows you the exact phrasing changes within those paragraphs. The two modes are complementary.

**Paste system prompt and user message together** if you're comparing full prompt compositions. The diff doesn't care — it just compares two text blocks.

**Track your prompt history manually.** Export the diff after each significant version. Filename with a timestamp or version number. You now have a readable change log for your prompt. This is lightweight prompt version control that works without any tooling overhead.

**Use the token delta to budget changes.** If you added 150 tokens to your system prompt, that's 150 tokens less available for context in every call. The stat makes that cost explicit.

**Similarity as a sanity check.** If you intended to make a small tweak but the similarity dropped from 95% to 70%, something broader changed. Review the diff before deploying.

**Comparing few-shot examples.** If you're iterating on the examples in your prompt (the user/assistant turns you include as demonstrations), word diff is especially useful — it shows the exact word substitutions in your target outputs.

## Limitations

- **O(m × n) complexity** — the LCS algorithm is quadratic. For extremely long prompts (multi-thousand line documents), the diff may take 1–2 seconds. This tool is designed for prompt-sized text (up to a few thousand tokens), not full document comparison.
- **Line diff treats lines atomically** — a single changed word causes the entire line to appear as removed-and-added. Use word diff for finer granularity.
- **Token estimate is approximate** — uses a regex approximation of cl100k_base, accurate to ±5%. For exact token counts, use `tiktoken` with the specific model's encoder.
- **No three-way merge** — compares exactly two versions. If you have three candidates (A, B, C), run two diffs: A vs B and B vs C.
- **No semantic diff** — the diff is purely textual. Two lines that mean the same thing but are worded differently will show as changed.
