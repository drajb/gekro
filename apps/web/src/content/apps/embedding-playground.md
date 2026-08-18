---
title: "Embedding Similarity Playground"
category: "ai"
job: "Type a handful of sentences and see how a real embedding model measures their meaning - a cosine heatmap, the closest and furthest pairs, and a 2D map"
description: "Enter up to 20 short texts and this tool runs them through MiniLM (all-MiniLM-L6-v2) directly in your browser, then shows the full cosine-similarity heatmap, ranks the most and least similar pairs, and plots a 2D PCA map so you can see the clusters. The model downloads once from a CDN and then runs fully offline; nothing you type ever leaves the page."
aiSummary: "An in-browser embedding explorer. It embeds up to 20 texts with all-MiniLM-L6-v2 via transformers.js (no server), then renders a cosine-similarity heatmap, ranks the most and least similar pairs, and draws a 2D PCA scatter computed with hand-rolled power iteration on the Gram matrix. Useful for building intuition about what sentence embeddings actually capture."
personalUse: "When I build a retrieval or dedup step, my mental model of 'these two sentences are similar' rarely matches what the embedding model thinks. So this is a scratchpad: drop in a few real examples, read the cosine numbers straight off a heatmap, and stop guessing at a threshold I was only ever eyeballing."
status: "active"
publishedAt: "2026-07-05"
lastVerified: "2026-07-05"
companionPostSlug: ""
license: "MIT"
icon: "🧬"
---

## What It Does

Embeddings turn text into vectors so that "close in meaning" becomes "close in space." That is the whole foundation of semantic search, retrieval-augmented generation, clustering, and dedup. But the numbers are abstract until you see them on your own examples.

This tool embeds each line you type with **all-MiniLM-L6-v2**, a 384-dimension sentence model, running entirely in your browser through transformers.js and ONNX Runtime Web. The first run downloads the model (about 25 MB) from a CDN; after that it is cached and works offline. Your text is never sent anywhere.

## What You Get

- **Cosine similarity heatmap** - every text against every other, coloured by similarity. Because the embeddings are normalized, cosine similarity is just the dot product.
- **Most and least similar pairs** - the ranked extremes, so you can see which sentences the model thinks are near-duplicates and which are unrelated.
- **2D PCA map** - a scatter plot that projects the 384-dimension vectors down to two dimensions so clusters become visible at a glance.

## How the 2D Map Is Built

Principal component analysis normally means eigendecomposing a 384x384 covariance matrix. With only a handful of texts that is wasteful, so this tool uses the dual formulation: it builds the small N-by-N Gram matrix of the centred vectors and extracts its top two eigenvectors with plain power iteration and deflation. Each point's coordinates are then the scaled eigenvector components. It is a few lines of code, runs instantly, and is exactly what the classic PCA math reduces to when you have more dimensions than samples.

## Why It's Useful

Picking a similarity threshold for retrieval or dedup is guesswork until you have seen the actual distribution on realistic text. Drop in some true positives and some hard negatives, read the cosine values straight off the heatmap, and you have a defensible cut-off. It also makes a fast teaching aid for what "semantic similarity" does and does not capture - try near-synonyms, negations, and topic overlaps and watch where the model agrees with you and where it does not.

For the downstream side of a retrieval pipeline, pair this with the [RAG Chunk Visualizer](/apps/rag-chunk-visualizer/) and the [RAG Eval Toolkit](/apps/rag-eval-toolkit/).

## Limitations

- **One model.** MiniLM is a strong, small general-purpose model, but a domain-tuned or larger model may cluster your text differently. Treat the numbers as directional.
- **Short texts.** It is built for sentences and short passages, not whole documents. Very long inputs are truncated by the model's context window.
- **PCA loses information.** A 2D projection of 384 dimensions is a lossy summary; the heatmap is the ground truth, the scatter is the intuition.
- **First run needs network.** The model is fetched from a CDN once, then cached for offline use.
