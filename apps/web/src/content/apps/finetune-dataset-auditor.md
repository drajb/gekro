---
title: "Fine-tune Dataset Auditor"
category: "ai"
job: "Check a JSONL fine-tuning file before you spend money on it - structure, token distribution, duplicates, and training cost"
description: "Drop or paste a JSONL fine-tuning dataset (OpenAI chat format or legacy prompt/completion) and get a full audit: how many examples are valid, every structural problem with the exact line numbers, the token-count distribution per example, duplicate detection, and an editable training-cost estimate. It parses line by line with a 50 MB cap and never uploads your data."
aiSummary: "A client-side JSONL fine-tuning dataset linter. It validates each example (chat messages or legacy prompt/completion), flags structural errors and warnings with line numbers, detects exact-duplicate examples, computes a per-example token distribution (min/mean/median/p95/max plus a histogram), and estimates fine-tune training cost from an editable price and epoch count. Streams up to 50 MB in-browser; nothing is uploaded."
personalUse: "Every failed fine-tune I have ever kicked off failed for a boring reason - a handful of examples with no assistant turn, a stray non-string content field, or duplicates inflating the token bill. The provider only tells you after you have uploaded and paid. I wanted to catch all of that locally in one drop, see the token distribution so I know if examples are too long, and get a cost number before committing."
status: "active"
publishedAt: "2026-07-05"
lastVerified: "2026-07-05"
companionPostSlug: ""
license: "MIT"
icon: "📊"
---

## What It Does

Fine-tuning fails on dumb, avoidable things: an example with no assistant message to learn from, a `content` field that is an object instead of a string, exact duplicates padding your token bill, or examples so long they blow the context window. Providers validate after you upload and, in some cases, after you pay.

This tool runs that validation locally. Drop a `.jsonl` file (up to 50 MB) or paste a few lines, and it parses every example, checks its structure, measures its token count, and totals the training cost - all in your browser, with nothing uploaded.

## What It Checks

It recognizes both dataset shapes:

- **Chat format** - `{"messages": [{"role": "...", "content": "..."}]}`
- **Legacy format** - `{"prompt": "...", "completion": "..."}`

And flags, with the exact line numbers:

- **Errors** (the example is unusable): invalid JSON, not an object, empty `messages`, unknown roles, no assistant message to train on, missing prompt or completion, unrecognized shape.
- **Warnings** (trainable but suspect): empty assistant content, non-string content, first non-system message not from the user, mixed formats across the file, and **exact duplicate examples**.

## Token Distribution and Cost

For every example it estimates the token count (a GPT-style ~4-chars-per-token approximation, plus per-message overhead for chat format) and reports the full distribution: minimum, mean, median, p95, and maximum, with a histogram so you can spot a long tail of oversized examples. The cost estimator multiplies your billable tokens by an editable price and epoch count. Model presets pre-fill representative training prices, but every field is editable so you can plug in your provider's current rate.

Pair it with the [Prompt Token Counter](/apps/prompt-token-counter/) for single prompts and the [LLM JSON Repair](/apps/llm-json-repair/) tool if some lines need fixing first.

## Limitations

- **Token counts are approximate.** It uses a fast heuristic, not the provider's exact tokenizer, so treat the totals as within a few percent, not to the token.
- **Exact-duplicate detection only.** It catches byte-identical examples, not near-duplicates or paraphrases.
- **Structural, not semantic.** It verifies the file is well-formed and trainable; it cannot tell you whether the examples teach the behaviour you want.
- **50 MB cap.** Larger files are audited on their first 50 MB, which is thousands of examples - enough to catch systemic problems.
