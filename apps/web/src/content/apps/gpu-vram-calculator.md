---
title: "GPU VRAM Calculator"
category: "ai"
job: "Estimate VRAM needed to run or fine-tune any LLM at any quantization, then see which GPUs fit"
description: "Pick a model size (1B → 405B), quantization (FP16 → INT4 → Q4_K_M), context length, and batch size. Get exact VRAM breakdown — model weights, KV cache, activations — and see at a glance which GPUs (RTX 3060/4090, A6000, H100, M-series Macs, Pi AI HAT) can run it. Inference and LoRA fine-tuning modes covered."
aiSummary: "A client-side GPU VRAM estimator for LLM inference and LoRA fine-tuning. Computes weights memory (params × bytes_per_param at chosen quantization), KV cache (2 × layers × heads × head_dim × seq_len × batch × bytes), and activation overhead. Compares against a curated hardware table covering NVIDIA consumer (RTX 3060/4070/4080/4090/5090), datacenter (A100/H100/A6000), Apple Silicon unified memory (M2 Ultra, M4 Max), and Raspberry Pi AI HAT 2 (Hailo-10H). Flags fit/no-fit per device."
personalUse: "Before I commit to spinning up an A100 hour or buying yet another consumer GPU, I want to know if the model I'm targeting will actually fit. This is the calculation that should happen before the cloud bill."
status: "active"
publishedAt: "2026-04-20"
lastVerified: "2026-04-20"
companionPostSlug: ""
license: "MIT"
icon: "🎮"
---

## What It Does

GPU VRAM Calculator tells you whether a specific LLM will fit on specific hardware. Choose a model parameter count, quantization format, context length, and batch size — and get a VRAM breakdown (weights + KV cache + activations) with a fit/no-fit verdict against a curated hardware table covering consumer GPUs, datacenter cards, Apple Silicon, and edge devices.

## How to Use It

1. Set the **model size** in billions of parameters (1B, 7B, 13B, 34B, 70B, 140B, 405B, or custom).
2. Choose **quantization** (FP32, FP16/BF16, FP8, INT8, Q5_K_M, Q4_K_M, INT4/Q4_0, Q3_K_M, Q2_K).
3. Set **context length** (sequence length in tokens, 512–512K).
4. Set **batch size** (simultaneous sequences, default 1 for interactive inference).
5. Toggle **LoRA fine-tuning mode** if you're estimating training VRAM, not inference VRAM.
6. Read the VRAM breakdown and the hardware fit table.

## The Math / How It Works

VRAM for LLM inference has three components:

### 1. Model weights — the dominant factor
`params × bytes_per_param`

| Quantization | Bytes/param | 7B model | 70B model |
|---|---|---|---|
| FP32 | 4.0 | 28 GB | 280 GB |
| FP16 / BF16 | 2.0 | 14 GB | 140 GB |
| FP8 | 1.0 | 7 GB | 70 GB |
| INT8 / Q8_0 | 1.0 | 7 GB | 70 GB |
| Q5_K_M | 0.6875 | 4.8 GB | 48 GB |
| Q4_K_M | 0.5625 | 3.9 GB | 39 GB |
| INT4 / Q4_0 | 0.5 | 3.5 GB | 35 GB |
| Q3_K_M | 0.4375 | 3.1 GB | 31 GB |
| Q2_K | 0.3125 | 2.2 GB | 22 GB |

### 2. KV cache — the underestimated factor
`2 × layers × num_heads × head_dim × seq_len × batch × bytes_per_element`

KV cache grows linearly with context length and batch size. For a 70B model at 32K context with batch 1 and FP16 KV, this is approximately 10 GB on top of the weights. Doubling context length doubles the KV cache. This is why long-context inference is significantly more expensive than short-context inference even for the same model weights.

### 3. Activations + overhead
Approximately 10–15% of weights memory for inference (12% used as the default). This covers the intermediate tensors produced during each forward pass.

### LoRA fine-tuning (additional)
LoRA fine-tuning adds:
- **Optimizer states**: ~3× LoRA parameter size for Adam; ~1.5× with 8-bit Adam
- **Gradients**: 1× LoRA parameter size
- **LoRA adapters**: typically 0.1–2% of base model size (rank 16 default)

## Why VRAM Is the Binding Constraint

This is the single most important thing to understand about LLM inference on consumer hardware: **VRAM is the binding constraint, not compute (TFLOPS).**

A 70B model at FP16 needs 140 GB of VRAM for the weights alone. An RTX 4090 has 24 GB. It doesn't matter that the 4090 has 82.6 TFLOPS of FP16 performance — the model physically cannot fit. TFLOPS determines how fast tokens generate once the model is loaded; VRAM determines whether it can load at all.

This is why quantization exists and why it's the first lever engineers reach for. Quantization converts FP16 (2 bytes per parameter) to lower precision (INT4 = 0.5 bytes per parameter) — a 4× reduction in memory footprint. The tradeoff is quality degradation that increases as precision decreases.

**The quantization quality/size tradeoff in practice:**
- **FP16/BF16** — reference quality. No quantization loss. Requires the most VRAM.
- **Q8_0** — nearly indistinguishable from FP16 for most tasks. 2× size reduction.
- **Q4_K_M** — small, measurable quality loss on complex reasoning tasks; negligible loss on factual recall and instruction following. 4× size reduction. The practical sweet spot for consumer hardware.
- **Q2_K** — significant quality degradation. Outputs become less reliable. Use only if Q4 still doesn't fit.

**Practical example: can I run Llama 3 70B Q4 on an RTX 4090?**
- Weights: 70B × 0.5625 bytes = ~39 GB — already over the 24 GB VRAM limit, before KV cache.
- Answer: No. A single RTX 4090 cannot run Llama 3 70B at any quantization. You need two RTX 4090s, an A100 80GB, or an M2 Ultra (192 GB unified memory).

**Practical example: can I run Llama 3 8B Q4 on an RTX 4090?**
- Weights: 8B × 0.5625 bytes = ~4.5 GB
- KV cache (4K context, batch 1, FP16): ~0.5 GB
- Activations: ~0.5 GB
- Total: ~5.5 GB — comfortably fits in 24 GB. Fast inference with plenty of headroom.

## GQA vs MHA — Why Context Length Affects Some Models More

Standard multi-head attention (MHA) allocates a separate KV cache entry per attention head. For a 70B model with 64 heads, this is expensive. Modern models (Llama 3+, Mistral, Gemma) use **Grouped-Query Attention (GQA)**, which shares KV cache across groups of query heads. GQA reduces KV cache memory by 4–8×.

This calculator models standard MHA — if you're running a GQA model (which most recent models are), the actual KV cache will be significantly lower than shown. Subtract roughly 75–87% from the KV cache figure for GQA models at group size 8. This means context length pressure is much less severe for modern GQA models than older MHA models.

## LoRA Fine-Tuning Memory Footprint

LoRA (Low-Rank Adaptation) is the standard approach for fine-tuning large models on consumer hardware. Instead of updating all 70 billion parameters, LoRA inserts low-rank adapter matrices into each attention layer and trains only those. A rank-16 LoRA adapter for a 70B model has approximately 150M trainable parameters — about 0.2% of the total. This makes fine-tuning feasible on hardware that can barely run inference:

- The base model weights are loaded in quantized form (typically INT4 or INT8, frozen)
- Only the LoRA adapters are in full precision and updated during training
- Optimizer states (Adam) are only for the adapter parameters

With 8-bit Adam and rank 16, a 13B model fine-tunes on approximately 16–20 GB of VRAM — achievable on an RTX 3090/4090.

## Tips & Power Use

- **Start with Q4_K_M.** It's the practical sweet spot: 4× size reduction with minimal quality loss on most tasks. If it fits, you're done. Only go lower if Q4 doesn't fit.
- **Context length is quadratic in attention cost but linear in VRAM.** Setting context to 32K when you're only sending 2K prompts wastes KV cache allocation. Set context length to 2–3× your actual expected input length.
- **Apple Silicon is a different constraint.** Unified memory means the GPU and CPU share the same RAM pool. A Mac Studio with 192 GB of unified memory can technically fit a 70B FP16 model. The constraint is bandwidth — inference is slower than NVIDIA VRAM because the memory bandwidth is lower per dollar.
- **Pair with the [LLM Cost Calculator](/apps/llm-cost-calculator/)** to compare self-hosting cost (GPU amortization + power) against API cost for your use case.

## Hardware Coverage

The tool checks fit against NVIDIA consumer (RTX 3060 through 5090), NVIDIA datacenter (A100 40/80GB, H100, H200, A6000), Apple Silicon (M2 Ultra through M4 Max), and edge devices (Pi AI HAT 2, Jetson Orin).

## Limitations

- **Inference VRAM is approximate** — production inference engines (vLLM, TGI, llama.cpp) have different overheads. This tool adds 12% slack for activations; real engines vary
- **Multi-GPU not modeled** — the tool checks single-GPU fit; for 405B at FP16 you need to plan tensor parallelism manually
- **Apple Silicon limit is empirical** — macOS reserves memory for the OS; the 75% figure is conservative
- **KV cache assumes standard MHA** — GQA models (Llama 3+) have significantly lower KV cache; subtract ~75% from the KV figure
- **Pi AI HAT is hard-limited at ~3B params** — the Hailo-10H architecture has fixed constraints regardless of the math
