---
title: "Llama.cpp / Ollama Config Builder"
category: "ai"
job: "Pick hardware + model → get optimal CLI flags and an Ollama Modelfile. No more trial-and-error tuning."
description: "Free browser-based config builder for llama.cpp and Ollama. Pick from 12 popular open-weights models (Llama 3.1/3.3/4, Qwen 3, Mistral 7B/Large 3, Gemma 2, Phi-4, DeepSeek R1 distills, GPT-OSS 120B) and 13 hardware presets (Pi 5 8/16GB, Mac M4 Pro/Max, RTX 3090/4090/5090, A100, H100, H200) - tool computes weight size, KV cache size, layer-offload count, and emits ready-to-paste llama-cli command + Ollama Modelfile. Adjusts for quantization (Q2_K through F16), context length (2K-128K), KV cache precision, Flash Attention, mlock."
aiSummary: "Client-side llama.cpp / Ollama configuration generator. Inputs: hardware spec (CPU threads, RAM, VRAM via preset or custom), model (12-model catalogue with params/layers/kv_heads/head_dim metadata), quantization (Q2_K=2.625 bpw through F16=16 bpw), context length, KV cache precision (f16/q8_0/q4_0). Computes weight memory = params * bpw / 8, KV cache memory = 2 * kv_heads * head_dim * bytes_per_kv * context * layers, then assigns -ngl (gpu layers) by greedily fitting layers into 90% of VRAM after KV reservation. Also recommends -b (batch) and temperature/top_p based on use case (chat/code/rag/agent). Outputs: ready-to-run llama-cli command and equivalent Ollama Modelfile."
personalUse: "Built this after losing 45 minutes binary-searching -ngl for Llama 4 Maverick on my Mac M4 Pro. Should have been a 3-second calculation."
status: "active"
publishedAt: "2026-05-13"
icon: "⚙️"
license: "MIT"
---

## What It Does

Choose your hardware (Pi 5, Mac M4 Pro, RTX 4090, H100, custom) and your target model (Llama 4 Maverick, Qwen 3 32B, GPT-OSS 120B, custom). Tool returns:

- Estimated VRAM/RAM usage including KV cache at your context length
- Recommended `--gpu-layers` (-ngl) for partial offload
- Verdict: fits fully on GPU / partial offload / RAM-only / OOM
- Complete `llama-cli` command with all flags
- Equivalent Ollama Modelfile

## Why It Saves Time

For every new model you deploy locally, you tune the same flags:
- `--gpu-layers` (binary-search until it fits)
- `--ctx-size` (depends on KV cache memory)
- `--threads` (depends on CPU)
- `--batch-size` (depends on use case)
- `--cache-type-k/v` (only matters if you're VRAM-constrained)
- `--mlock` (only on systems prone to swap)

This calculator does the math for all of them based on hardware + model dimensions.

## Quantization Reference

| Type | Bits | Quality | Use when |
|---|---|---|---|
| Q2_K | 2.625 | Bad | You really cannot fit the full model |
| Q3_K_M | 3.91 | Acceptable | Aggressive VRAM constraints |
| Q4_K_M | 4.83 | Sweet spot | Default — best quality/size ratio |
| Q5_K_M | 5.69 | Very good | Have headroom, want better quality |
| Q6_K | 6.56 | Near-lossless | Have plenty of VRAM |
| Q8_0 | 8.5 | Lossless | Reference for evals |
| F16 | 16 | Lossless | Full precision (rarely useful) |

## KV Cache Precision

| Type | VRAM | Quality |
|---|---|---|
| f16 (default) | 100% | None lost |
| q8_0 | 50% | Tiny degradation |
| q4_0 | 25% | Some degradation, fine for chat |

Drop to q8_0 first if you're tight on VRAM; q4_0 is the last resort.

## What's NOT Included

- vLLM, sglang, TGI config (different ecosystem)
- Quantization conversion (use llama.cpp's `quantize` tool)
- Speculative decoding parameters
- Multi-GPU sharding (`--tensor-split`)

## Related Tools

- [GPU VRAM Calculator](/apps/gpu-vram-calculator/) - inference VRAM only, more model variants
- [LoRA Memory Calculator](/apps/lora-memory-calculator/) - training memory
- [Reasoning Cost Calculator](/apps/reasoning-cost-calculator/) - when local isn't worth it
