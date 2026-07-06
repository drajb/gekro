---
title: "GGUF Model Inspector"
category: "ai"
job: "Drop a .gguf file and read its header - architecture, quantization, context length, every metadata key, and the full tensor list - without downloading or loading the whole model"
description: "Point this at any GGUF model file (llama.cpp, Ollama, LM Studio) and it parses just the header, right in your browser, to show the architecture, quantization type, parameter count, context length, the complete metadata table, and every tensor with its shape and dtype. It reads only the first few megabytes with File.slice, so even a 40 GB model is inspected instantly. Nothing is uploaded."
aiSummary: "A client-side GGUF header inspector. Using File.slice and DataView it parses the GGUF v2/v3 header - magic, version, tensor and metadata counts, all key/value metadata, and every tensor descriptor - without reading the whole file, then surfaces architecture, quantization (from general.file_type), parameter count derived from tensor shapes, context length, and load-memory estimates. Every read is bounds-checked against untrusted bytes."
personalUse: "I keep a folder of GGUF files from different quantizers and I can never remember which is Q4_K_M versus Q5_K_M, what context length it was built for, or whether a download finished intact. Opening a multi-gigabyte file in a hex editor to read a header is absurd, so I wanted something that reads just the front of the file and tells me exactly what I am about to load before I waste VRAM on it."
status: "active"
publishedAt: "2026-07-05"
lastVerified: "2026-07-05"
companionPostSlug: ""
license: "MIT"
icon: "🧊"
---

## What It Does

GGUF is the file format llama.cpp, Ollama, and LM Studio use to store quantized models. The header at the front of the file carries everything you need to know before loading it: the architecture, the quantization scheme, the context length it was built for, and a full list of tensors. This tool reads that header and lays it out.

The key trick is that it never reads the whole file. Using the browser's `File.slice`, it pulls only the first 16 MB (and up to 64 MB for models with very large token vocabularies), parses the header with a `DataView`, and shows you the result. A 40 GB model is inspected as fast as a 40 MB one, and because everything runs locally, the file is never uploaded.

## What You See

- **At a glance** - model name, architecture, parameter count (summed from the tensor shapes), and quantization type.
- **Derived estimates** - file size, bits per parameter, context length, and a rough load-memory estimate including a KV-cache figure at the model's context length.
- **Full metadata table** - every key/value pair in the header, filterable, with large arrays (like token vocabularies) previewed rather than dumped.
- **Tensor list** - every tensor with its shape, ggml dtype, and parameter count.

## How It Reads the Header Safely

A GGUF header is a length-prefixed binary format: a magic number, a version, counts of tensors and metadata entries, then the entries themselves. A malformed or truncated file could easily claim a string is four billion bytes long. Every read here is bounds-checked against the size of the slice actually loaded, string and array lengths are validated before use, and the 64-bit counts are read as safe integers. A corrupt file produces a clear error, not a hung tab.

The quantization label comes from the `general.file_type` enum (so you get "Q4_K_M", not a raw number), and the parameter count is computed by multiplying out each tensor's dimensions - the same way the format itself defines model size.

## Why It's Useful

Before you pull a model into VRAM you want to know what it actually is. This answers the everyday questions - which quant is this, what context was it built for, did the download complete, how many parameters - in one drop. For the follow-on question of whether it will fit, hand the numbers to the [GPU VRAM Calculator](/apps/gpu-vram-calculator/) and the [Local Model Recommender](/apps/local-model-recommender/).

## Limitations

- **Header only.** It reads metadata and tensor descriptors, not weights, so it cannot verify that the tensor data itself is intact - only that the header is well-formed.
- **GGUF v2 and v3.** The current format versions are supported; the legacy v1 layout is not.
- **Estimates are rough.** The load-memory figure is a heuristic (file size plus a KV-cache approximation), not a substitute for actually measuring runtime memory on your backend.
- **Parameter count is from shapes.** It sums the tensor dimensions, which matches the true weight count closely but can differ slightly from a model card's advertised figure.
