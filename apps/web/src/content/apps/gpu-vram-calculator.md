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

## How this works

VRAM for LLM inference comes from three places. This tool computes each separately and shows the breakdown:

### 1. Model weights
The dominant factor. `params × bytes_per_param`. A 7B model at FP16 needs 14GB just for weights; at Q4 quantization, it drops to ~4GB.

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

### 2. KV cache (key-value attention cache)
The often-underestimated factor. Grows linearly with context length and batch size: `2 × layers × num_heads × head_dim × seq_len × batch × bytes`. For a 70B model at 32K context with batch 1 and FP16 KV, this is ~10GB on top of the weights. Doubling context doubles the KV cache.

### 3. Activations + overhead
~10-15% of weights memory for inference, much higher for training. This tool uses 12% as the inference default.

### LoRA fine-tuning mode (additional)
LoRA fine-tuning adds:
- **Optimizer states**: ~3× LoRA parameter size for Adam (8-bit Adam halves this)
- **Gradients**: 1× LoRA parameter size
- **LoRA adapters**: typically 0.1-2% of base model size

This tool defaults to rank 16 + 8-bit Adam, which is the sweet spot for most consumer-GPU fine-tuning.

## Hardware coverage

The tool checks fit against this curated list (all VRAM in GB, prices as of 2026-Q1):

**NVIDIA Consumer**
- RTX 3060 (12 GB) | RTX 3090 (24 GB)
- RTX 4070 (12 GB) | RTX 4080 (16 GB) | RTX 4090 (24 GB)
- RTX 5060 (8 GB) | RTX 5080 (16 GB) | RTX 5090 (32 GB)

**NVIDIA Datacenter**
- A100 40GB / 80GB
- H100 80GB
- H200 141GB
- A6000 (48 GB)

**Apple Silicon (unified memory — practical limit ~75% of total)**
- M2 Ultra (192 GB total → ~144 GB usable for LLM)
- M3 Max (128 GB total → ~96 GB usable)
- M4 Max (128 GB total → ~96 GB usable)
- M4 Pro (48 GB → ~36 GB)

**Edge / Pi**
- Pi AI HAT 2 (Hailo-10H, 40 TOPS) — limited to 1.5–3B models
- Jetson Orin Nano (8 GB) | Jetson Orin AGX (32 / 64 GB)

## Why I built this

Buying GPU hours blind is the most common LLM-engineering money pit. Cloud providers' "what GPU do I need?" pages are sales tools, not engineering tools. This is the math, exposed: weights + KV cache + activations + (optional) training overhead, with a fit/no-fit verdict against actual hardware.

Companion to the [LLM Cost Calculator](/apps/llm-cost-calculator/) — which covers the API-vs-self-host *cost* question; this covers the *will it even fit* question.

## Limitations

- **Inference VRAM is approximate** — production inference engines (vLLM, TGI, llama.cpp) have different overheads. This tool models "naïve transformer inference" and adds 12% slack for activations
- **Multi-GPU not modeled** — the tool checks single-GPU fit. For 405B at FP16 (810GB), you need to plan tensor parallelism manually
- **Apple Silicon limit is empirical** — macOS reserves memory for the OS and other processes. The 75% figure is conservative; some users get away with more
- **Pi AI HAT model assumes Hailo-10H, INT8, batch 1** — the architecture has hard limits at ~3B params regardless of how the math works out
- **KV cache assumes standard attention** — Grouped-Query Attention (GQA) used in Llama 3+ reduces KV cache by 4-8×. This tool models standard MHA; subtract roughly 75% from the KV figure for GQA models
