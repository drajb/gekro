---
title: "RAG Chunk Inspector"
category: "ai"
job: "Visualize exactly how your chunking strategy splits documents — with overlap regions highlighted and per-chunk token estimates"
description: "Paste text and pick a chunking strategy (fixed-size, recursive, sentence-aware), chunk size, and overlap. See every chunk rendered separately with its token estimate, character count, and overlap zones color-coded. The interactive way to choose RAG chunk parameters before committing them in production."
aiSummary: "A client-side RAG chunking visualizer for tuning retrieval pipelines. Supports three strategies (fixed-size, recursive split on paragraph→sentence→word, sentence-aware) with configurable chunk size and overlap. Shows resulting chunks with token estimates per family (OpenAI, Anthropic, Llama, Google), highlighted overlap regions, and chunk count summaries. Pure browser-side — no document leaves the page."
personalUse: "Choosing chunk size for RAG is more art than science. Before I run an indexing job over hundreds of MB, I paste a representative document here and see whether 512 tokens with 50 overlap gives me cohesive chunks or splits paragraphs mid-sentence."
status: "active"
publishedAt: "2026-04-20"
lastVerified: "2026-04-20"
companionPostSlug: ""
license: "MIT"
icon: "✂️"
---

## How this works

Paste a document, pick a chunking strategy, set the chunk size and overlap, and the tool splits the text exactly the way a real RAG pipeline would. Each resulting chunk renders separately with:

- **Chunk index** and total chunk count
- **Token estimate** (using cl100k_base-style pre-tokenization, calibrated per model family)
- **Character count**
- **Overlap zones** highlighted at chunk boundaries

## Strategies covered

### 1. Fixed-size (character-based)
Naïve approach: cut every N characters with M characters of overlap. Fast but ignores semantic boundaries — splits sentences and even words mid-token. Use this as a baseline to see how much worse it is than the alternatives.

### 2. Recursive (paragraph → sentence → word)
The standard approach used by LangChain, LlamaIndex, and most RAG frameworks. Tries to split on paragraph breaks (`\n\n`) first; if a chunk is still too big, falls back to sentence boundaries (`. ! ?`); finally word boundaries. Preserves semantic units when possible.

### 3. Sentence-aware
Splits text into sentences first, then groups sentences greedily until each group is just under the chunk size. Preserves sentence integrity 100% of the time but produces variable-size chunks.

## Why chunking matters

Bad chunking is the silent killer of RAG quality:

- **Too small** → loses surrounding context, retrieval finds the right chunk but the LLM lacks enough information to answer
- **Too large** → context-window pressure, slower retrieval, dilutes embedding quality (one chunk covering 3 topics retrieves for all 3 even when only one is relevant)
- **No overlap** → information that crosses chunk boundaries becomes invisible to retrieval
- **Wrong split points** → retrieving a chunk that starts mid-sentence makes the LLM hallucinate the missing context

The right chunk size depends on (a) your document structure, (b) your embedding model's optimal input length, and (c) how much you can afford to stuff into context at retrieval time. There's no universal answer — only a calibration exercise. This tool is that exercise.

## Recommended starting points

| Use case | Strategy | Chunk size | Overlap |
|---|---|---|---|
| General RAG over prose | Recursive | 512 tokens | 50 tokens (10%) |
| Code documentation | Recursive | 1024 tokens | 100 tokens |
| Long-form articles | Sentence-aware | 768 tokens | 1 sentence |
| Tabular / structured data | Fixed-size | 256 tokens | 0 |
| Conversational logs | Recursive on speaker turns | 512 tokens | 1 turn |

These are starting points — paste your actual data and tune from there.

## Limitations

- **Token estimates are approximate** — uses the same cl100k_base pre-tokenization as the [Tokenizer Visualizer](/apps/tokenizer/). Within ±10% for English prose
- **No semantic chunking** — actual semantic chunkers use embedding similarity to find topic boundaries; that requires an embedding model running in the browser, which is on the roadmap
- **No metadata extraction** — production RAG often attaches headers, page numbers, source URLs to each chunk. This tool shows only the text split
