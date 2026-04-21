---
title: "Tokenizer Visualizer"
category: "ai"
job: "See exactly how an LLM splits your text into tokens — color-coded, byte-counted, model-aware"
description: "Paste any text and see how OpenAI, Anthropic, Llama, and Google models would tokenize it. Tokens are color-coded by type (word, number, punctuation, whitespace, symbol), with byte counts and a side-by-side total comparison across model families. Pure client-side BPE pre-tokenization — no API calls."
aiSummary: "A client-side tokenizer visualizer that shows how LLMs split input text into tokens. Uses cl100k_base-style BPE pre-tokenization to approximate token boundaries for OpenAI (GPT-4/4o/o1), Anthropic (Claude 3/3.5/4), Meta Llama (3/3.1/3.2), and Google Gemini families. Color-codes each token by type and shows byte counts, character counts, and per-model totals."
personalUse: "When I'm tuning a system prompt or worrying about why a 200-word message ate 600 tokens, I paste it here and immediately see which words and symbols are eating my context window."
status: "active"
publishedAt: "2026-04-20"
lastVerified: "2026-04-20"
companionPostSlug: ""
license: "MIT"
icon: "🪙"
---

## How this works

Paste any text and the tool runs a **BPE pre-tokenization pass** that approximates how the four major LLM tokenizer families split text. Each token is rendered as a colored chip showing its content, byte count, and char count.

### The four tokenizer families covered

| Family | Models | Approach |
|---|---|---|
| OpenAI cl100k / o200k | GPT-4, GPT-4o, GPT-4-turbo, o1, o3 | BPE with regex pre-split |
| Anthropic | Claude 3, 3.5, 3.7, 4 (Sonnet/Opus/Haiku) | BPE, Anthropic-specific vocabulary, ~5% denser than cl100k |
| Meta Llama | Llama 3, 3.1, 3.2, 3.3 | SentencePiece BPE, 128k vocab |
| Google Gemini | Gemini 1.5 Pro/Flash, 2.0 Flash | BPE with sentence-piece preprocessing |

### Color legend

- 🟦 **Word** — alphabetic sequence (most common token type)
- 🟨 **Number** — numeric sequence
- 🟪 **Symbol** — punctuation, brackets, math operators
- 🟫 **Whitespace** — spaces, tabs, newlines (carry leading-space semantics in BPE)
- 🟥 **Special** — non-printable or control characters

## What this is and isn't

This is a **pre-tokenization visualizer**, not the full BPE merge pipeline. It uses the standard cl100k_base regex pattern that real tokenizers use as their first split step. The actual BPE then merges some adjacent tokens (e.g. `hello` is one token, not two). So:

- **Token boundaries shown** are accurate to ~95% for English prose
- **Total token count** is within ±10% of the real tokenizer for English, ±15-20% for code or non-Latin scripts
- For exact counts, use the [Prompt Token Counter](/apps/prompt-token-counter/) (uses chars÷4) or the [LLM Cost Calculator](/apps/llm-cost-calculator/) for full cost projections

## Why I built this

I kept burning context on prompts where a single oddly-formatted JSON blob would eat 200 tokens. Without seeing the tokens, you can't intuit which parts are expensive. This shows you in one glance: long URLs, embedded base64, repetitive whitespace, weird Unicode — those are your token sinks.

## Limitations

- **Approximation only** — exact tokenization requires the actual model's vocabulary, which isn't shipped to the browser (the cl100k_base table alone is ~600KB)
- **Anthropic and Llama are estimates** — both providers use proprietary or large open vocabularies. The displayed count uses calibrated multipliers against the cl100k baseline
- **No special tokens** — `<|im_start|>`, `<|endoftext|>`, etc. are not separately rendered; treat them as regular tokens
- **No fine-tuned tokenizers** — this assumes the base model tokenizer for each family
