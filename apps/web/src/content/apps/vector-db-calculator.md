---
title: "Vector DB Sizing & Cost Calculator"
category: "ai"
job: "Estimate the RAM a vector index needs and compare self-hosted vs managed monthly cost"
description: "How much memory will N vectors at d dimensions actually take, and is it cheaper to self-host or pay a managed service? Set your vector count, dimensions, precision, and index type (Flat / HNSW / IVF) and get the RAM breakdown - raw vectors plus index overhead plus metadata - alongside a self-hosted vs managed monthly cost comparison. Every cost input is editable; runs entirely in your browser."
aiSummary: "A client-side vector database sizing and cost calculator. Index RAM = raw vectors (N × dims × bytes-per-value) + index overhead (HNSW ≈ N × M × 2 × 4 B; IVF ≈ centroids + assignments; Flat = 0) + metadata (N × bytes). It compares a self-hosted monthly cost (total GB × $/GB-RAM) against a managed-service estimate ($/million vectors), with all pricing editable. Supports float32/float16/int8 precision."
personalUse: "Before I stand up a RAG system I want to know two things fast: will the index fit in RAM, and does paying a managed vector DB beat running my own. The sizing math - raw vectors plus HNSW graph overhead plus metadata - is easy to get wrong by 2x, and pricing pages are deliberately hard to compare. I wanted one place to plug in my numbers and see the tradeoff."
status: "active"
publishedAt: "2026-08-08"
lastVerified: "2026-08-08"
companionPostSlug: ""
license: "MIT"
icon: "🗂️"
---

## What It Does

Two questions decide the shape of a vector search deployment: how much memory the index needs, and whether to self-host or use a managed service. This tool answers both.

Enter your **vector count**, **dimensions**, **precision** (float32 / float16 / int8), and **index type**, and it breaks down the RAM:

- **Raw vectors** - `N × dimensions × bytes-per-value`, the irreducible core
- **Index overhead** - HNSW adds a navigation graph (roughly `N × M × 2` links × 4 bytes); IVF adds centroids and assignments; Flat (exact search) adds nothing
- **Metadata** - the payload you store alongside each vector

Then it compares a **self-hosted** monthly cost (total GB × your $/GB-RAM rate) against a **managed** estimate ($/million vectors), and tells you which wins and by how much per year.

## Why The Overhead Matters

The raw vectors are the easy part; it's the index structure people forget. An HNSW graph over a few million vectors can add gigabytes on top of the vectors themselves, and that's what pushes you into a bigger instance. Seeing raw / index / metadata split out makes the real driver obvious - and shows why dropping from float32 to int8, or choosing IVF over HNSW, changes the bill.

Pairs with the [Embedding Playground](/apps/embedding-playground/) for the vectors themselves, the [GPU VRAM Calculator](/apps/gpu-vram-calculator/) for the compute box, and the [RAG Chunk Inspector](/apps/rag-chunk-inspector/) upstream.

## Limitations

- **In-memory estimate.** Many databases (pgvector, disk-backed FAISS, managed tiers) can keep part of the index on disk, trading memory for latency - this models the fully-in-RAM case, the usual worst case.
- **Overhead formulas are approximations.** Real overhead varies by implementation (FAISS vs hnswlib vs pgvector vs a managed engine) and by build parameters; product quantization (PQ) can shrink vectors far below the raw figure.
- **Costs are rough, editable defaults** - not a live pricing feed. Confirm against your instance type and provider; replicas and high-availability multiply both sides.
