---
title: "RAG Eval Toolkit"
category: "ai"
job: "Paste a corpus + labelled queries → measure recall@K, precision@K, MRR, nDCG for BM25 (and optionally semantic) retrieval. Local, free, self-hosted alternative to RAGAS / TruLens."
description: "Free in-browser retrieval evaluation. Paste your corpus (one doc per line or JSON), paste test queries with the expected document IDs, pick K and a retrieval mode (BM25 / semantic / hybrid RRF), see MRR / Recall@K / Precision@K / nDCG / Hit-Rate across the whole eval set plus a per-query breakdown showing which docs each query retrieved and which were hits. BM25 runs instantly with zero downloads. Semantic mode lazy-loads transformer.js + all-MiniLM-L6-v2 from a CDN (~30 MB) on first use, then runs entirely in the browser. Hybrid mode combines both via Reciprocal Rank Fusion. Export results as CSV. No data leaves your browser."
aiSummary: "Client-side intrinsic-retrieval eval harness. Three retrieval modes: (1) BM25 lexical with default k1=1.5 / b=0.75 and a small English stopword list - runs instantly; (2) Semantic dense retrieval via @xenova/transformers + all-MiniLM-L6-v2 lazy-loaded from jsdelivr CDN on first use (one-time ~30 MB cached by browser in IndexedDB); (3) Hybrid via Reciprocal Rank Fusion of BM25 and semantic with RRF_K=60. Computes per-query Recall@K, Precision@K, Reciprocal Rank, nDCG@K, plus aggregate MRR, Recall@K, Precision@K, nDCG@K, Hit-Rate. Per-query breakdown shows expected vs retrieved IDs with hit highlighting; filterable to 'only failed' (recall@K = 0) for debugging. CSV export of per-query results. Honest framing: this evaluates intrinsic retrieval quality (did the retriever find the right docs?), not end-to-end answer faithfulness (did the LLM use them correctly?). For end-to-end eval point users to RAGAS/TruLens. No persistent state for user corpus/queries; transformer.js model cached by browser at framework level."
personalUse: "I've been comparing my chunking strategies (fixed 512 vs semantic vs propositions) for a RAG project and need a quick way to ablate without standing up RAGAS or paying for an eval API. Pasting corpus + 20 labelled queries here gives the comparison numbers in seconds."
status: "active"
publishedAt: "2026-05-25"
icon: "🧪"
license: "MIT"
---

## What It Does

Three retrieval modes, four metrics, instant per-query breakdown:

- **BM25** - classic lexical retrieval, k1=1.5 / b=0.75, small English stopword list. Zero downloads, runs in microseconds per query.
- **Semantic** - dense embeddings via `all-MiniLM-L6-v2` (Xenova/transformer.js). Lazy-loaded from jsdelivr on first use, then ~10-50 ms per query in your browser.
- **Hybrid** - Reciprocal Rank Fusion of BM25 + semantic with RRF_K=60.

Metrics computed across the whole eval set:

| Metric | Definition |
|---|---|
| **MRR** | Mean Reciprocal Rank - average of 1/rank-of-first-correct |
| **Recall@K** | fraction of expected docs found in top-K, averaged across queries |
| **Precision@K** | fraction of top-K that were expected, averaged across queries |
| **Hit Rate** | fraction of queries with at least one correct doc in top-K |
| **nDCG@K** | discounted cumulative gain normalized by ideal ordering |

Per-query breakdown shows the actual top-K retrieved with hit highlighting, plus a "only failed" toggle for fast debugging of queries with recall@K=0.

## Input format

**Corpus** - three accepted forms:

1. **One doc per line** (default) - IDs are the 0-indexed line number.
2. **JSON array of strings** - same IDs (array index).
3. **JSON array of objects** with `{id, text}` - your own IDs.

**Queries** - one per line: `query text | expected_id_1, expected_id_2, ...`

The IDs you put on the right of the `|` must match either the line-index of your corpus or the explicit `id` field in your JSON corpus.

## When To Use It

- Comparing chunking strategies (fixed-size vs semantic vs propositions) on the same corpus
- Choosing between BM25 / dense / hybrid for a specific domain (medical vs legal vs casual)
- Debugging "why does my RAG miss this query?" - load the failed queries, see what it retrieved, eyeball the corpus
- Setting K - sweep K=3, 5, 10, 20 and see at what point you saturate recall

## How semantic mode works

When you first click "Semantic" or "Hybrid", or hit "Load model now", the app dynamically imports `@xenova/transformers@2.17.2` from jsdelivr's CDN. The library downloads `Xenova/all-MiniLM-L6-v2` (the JS port of the popular sentence-transformers model) - about 30 MB of WASM + ONNX weights. The browser caches it in IndexedDB after the first download so subsequent uses are instant.

Embedding happens locally in your browser. Your corpus and queries are never sent anywhere.

Notes on the model: 384-dimensional, mean-pooled + L2-normalized. Cosine similarity reduces to dot product. Good baseline for English; for multilingual see `Xenova/paraphrase-multilingual-MiniLM-L12-v2`. For better quality at higher cost see `Xenova/all-mpnet-base-v2` (~110 MB).

## What's NOT Included (and why)

- **End-to-end faithfulness eval** - this measures retrieval, not generation. RAG quality has two stages and they fail differently. For "did the LLM use the retrieved docs correctly?" use [RAGAS](https://github.com/explodinggradients/ragas) or [TruLens](https://www.trulens.org/) or a custom LLM-as-judge.
- **Larger embedding models** - kept to MiniLM for the bandwidth/quality tradeoff. The transformer.js library supports more; advanced users can fork and swap.
- **Re-rankers** - cross-encoder rerankers (e.g. `bge-reranker-large`) are out of scope for v1. Manual workaround: export top-K from this app, feed to your re-ranker offline, compare metrics.
- **Persistent state** - your corpus/queries don't persist across reloads. The 30 MB embedding model IS cached by the browser at the framework level (IndexedDB) - that's transformer.js behavior, not app behavior.

## Related Tools

- [RAG Chunk Inspector](/apps/rag-chunk-inspector/) - visualize how different chunking strategies split your corpus
- [Tokenizer Visualizer](/apps/tokenizer/) - see how each chunk gets tokenized
- [Context Window Visualizer](/apps/context-window-visualizer/) - check how much retrieved context fits in your model's window
- [Prompt Cache Optimizer](/apps/prompt-cache-optimizer/) - once you've picked a retriever, cache the system + retrieved prefix for $-savings
