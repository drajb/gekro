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

## What It Does

RAG Chunk Inspector lets you visualize exactly how a chunking strategy splits a document before you commit to running it against a real corpus. Paste any text, pick one of three strategies, set chunk size and overlap, and see every resulting chunk rendered separately with token estimates, character counts, and overlap zones highlighted in color. No document leaves your browser.

## How to Use It

1. Paste a representative sample of your target document type — a paragraph or two of the same content you'll index.
2. Select a chunking strategy: **Fixed-size**, **Recursive**, or **Sentence-aware**.
3. Set chunk size (in tokens) and overlap (in tokens or as a percentage).
4. Inspect the resulting chunks. Look for mid-sentence splits, coherence within each chunk, and whether the overlap region actually captures meaningful context.
5. Adjust until the chunks look right for your document type, then implement those parameters in your pipeline.

## Strategies Covered

### Fixed-size (character-based)
Naïve approach: cut every N characters with M characters of overlap. Fast, deterministic, ignores semantic boundaries. Splits sentences and even words mid-token. Use this as a baseline to see how much worse it is than the alternatives — often worse than you expect.

### Recursive (paragraph → sentence → word)
The standard approach used by LangChain, LlamaIndex, and most RAG frameworks. Tries to split on paragraph breaks (`\n\n`) first; if a chunk is still too big, falls back to sentence boundaries (`. ! ?`); finally word boundaries. Preserves semantic units when possible. This is the right default for general-purpose prose.

### Sentence-aware
Splits text into sentences first, then groups sentences greedily until each group is just under the chunk size. Preserves sentence integrity 100% of the time but produces variable-size chunks. Good for dialogue transcripts, FAQ content, and any corpus where sentence boundaries are high-signal.

## The Fundamental Tradeoff in RAG Chunking

Chunk size is the most impactful tunable parameter in a RAG pipeline, and it has no universally correct value. Here's the tradeoff clearly:

**Too small (e.g., 128 tokens):**
- Retrieval finds the exact right chunk
- But the LLM receives a chunk with insufficient surrounding context to formulate a complete answer
- Hallucination risk increases because the model fills in missing context from its weights rather than the retrieved document
- Embedding quality suffers — a 3-sentence chunk often doesn't have enough semantic signal for the embedding model to place it accurately in vector space

**Too large (e.g., 2048 tokens):**
- Each chunk covers multiple topics — retrieval precision drops because one chunk matches queries about three different things
- Context window pressure during synthesis — if you retrieve top-3 chunks at 2048 tokens each, you've consumed 6K tokens before your query and system prompt
- Embedding quality suffers differently — the embedding averages over too many concepts and becomes a poor representative of any single topic

**The empirically useful starting range is 256–1024 tokens.** Most production RAG systems live in this range, with 512 tokens being the most common starting point.

## Why Overlap Prevents Boundary Blindness

Chunking creates artificial boundaries in continuous text. A fact that spans the boundary between chunk 47 and chunk 48 is invisible to retrieval: chunk 47 ends mid-sentence and chunk 48 starts without context. The retrieval system will never return a relevant answer for a query about that fact unless it lands solidly inside a single chunk.

Overlap is the mitigation: each chunk includes N tokens from the end of the previous chunk. This ensures that boundary-spanning content appears fully in at least one chunk. The cost is redundant storage and embedding computation for the overlapping portions.

A 10% overlap (50 tokens of overlap on a 512-token chunk) is the practical minimum. Going above 25% produces diminishing returns — you're mostly duplicating context that the embedding model will learn to treat as background.

## How Chunk Strategy Affects Embedding Quality

Embedding models have an optimal input length — a sweet spot where the input is long enough to have rich semantic content but not so long that the single embedding vector is a blurry average of too many concepts. For most production embedding models (OpenAI `text-embedding-3`, Cohere `embed-v3`, BGE), this optimal range is roughly 256–512 tokens.

A chunk that perfectly captures one coherent thought — one section of a document, one FAQ question + answer, one code function with its docstring — will embed closer to queries that ask about that thought, and farther from queries that don't. That's what "good retrieval" means at the embedding layer.

This is why recursive splitting, which tries to preserve paragraph and sentence boundaries, tends to outperform fixed-size character splitting: it produces chunks that align with natural semantic boundaries, which align better with how the embedding model learned to represent meaning.

## When to Use Each Strategy

| Use case | Strategy | Chunk size | Overlap |
|----------|----------|------------|---------|
| General prose (docs, articles) | Recursive | 512 tokens | 50 tokens (10%) |
| Code documentation | Recursive | 1024 tokens | 100 tokens |
| Long-form articles | Sentence-aware | 768 tokens | 1 sentence |
| Tabular / structured data | Fixed-size | 256 tokens | 0 |
| Conversational logs | Recursive on speaker turns | 512 tokens | 1 turn |
| Legal / medical text | Recursive | 512–768 tokens | 75 tokens |

These are starting points. Paste your actual data and tune from there.

## How This Fits Into a RAG Pipeline

This tool sits in the pre-indexing stage of your pipeline:

```
Document ingestion
    ↓
[RAG Chunk Inspector] ← tune here
    ↓
Chunk embedding (text-embedding-3, etc.)
    ↓
Vector store indexing (Chroma, Pinecone, Weaviate, pgvector)
    ↓
Query → embedding → ANN search → top-k chunks → LLM synthesis
```

The chunk strategy and size you pick here directly determines the shape of your embedding space and the quality of retrieval at query time. Getting this wrong doesn't produce an error — it produces subtle quality degradation that's hard to diagnose post-hoc. The correct time to tune it is here, before indexing.

## Tips & Power Use

- **Use a representative sample.** Paste a document that's typical of your corpus, not the cleanest or most structured one. The hard cases are what reveal chunking problems.
- **Look for mid-sentence splits in the fixed-size output.** They're always there. The contrast between fixed-size and recursive makes a good intuition-building exercise.
- **Pair with the [Tokenizer Visualizer](/apps/tokenizer/)** for consistent token count estimates — both tools use the same cl100k_base pre-tokenizer.
- **Overlap zone highlighting** shows you exactly what content will be duplicated. If the highlighted region includes a key sentence, that sentence is safe from boundary blindness.
- **Short documents don't need chunking.** If your documents are consistently < 512 tokens, index them whole. Chunking short documents loses context and adds retrieval noise.

## Limitations

- **Token estimates are approximate** — uses cl100k_base pre-tokenization, ±10% for English prose
- **No semantic chunking** — actual semantic chunkers use embedding similarity to find topic boundaries; that requires an embedding model running in the browser, which is on the roadmap
- **No metadata extraction** — production RAG often attaches headers, page numbers, and source URLs to each chunk; this tool shows only the text split
- **No production pipeline integration** — this is a tuning/visualization tool. The output parameters need to be implemented in your actual pipeline (LangChain, LlamaIndex, or custom code)
