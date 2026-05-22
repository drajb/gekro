---
title: "LoRA / QLoRA Memory Calculator"
category: "ai"
job: "Pick a base model + training mode → see peak fine-tuning VRAM and which GPUs can fit the job."
description: "Free browser-based VRAM estimator for LoRA / QLoRA / full fine-tuning. Pick from 11 popular open-weights models (Llama 3.3 70B, Llama 4 Maverick/Scout, Mistral Large 3, Qwen 3, Gemma 2, Phi-4, GPT-OSS 120B) or enter custom params/hidden/layers. Adjust LoRA rank, target modules, batch × sequence length, gradient checkpointing, Flash Attention 2 — tool computes peak VRAM with breakdown across weights / optimizer / gradients / activations, plus a GPU-fit table covering Pi 5 16GB to B200 192GB."
aiSummary: "Client-side fine-tuning VRAM estimator covering full fine-tune, LoRA, and QLoRA training modes. Computes peak GPU memory across four components: model weights (params × bytes_per_param: bf16=2, NF4=0.5), AdamW optimizer states (8 bytes per trainable param), gradients (4 bytes per trainable param), and activations (batch × seq × hidden × layers × act_factor where act_factor adjusts for Flash Attention 2 and gradient checkpointing). LoRA trainable parameter count = 2 × rank × hidden_dim × target_modules × layers. Output includes per-component breakdown, total peak with 10% framework overhead, and a fit/tight/OOM verdict across 9 common GPUs (4090, 5090, A100, L40S, A6000, H100, H200, B200, plus Pi 5 for comparison). Estimates have ±15% accuracy depending on framework (HF Transformers, Axolotl, Unsloth all behave differently)."
personalUse: "I built this so I could stop the recurring 'will this fit on a 4090?' Slack thread. Picked the LoRA rank, hit Run, OOM at hour 3. Now I check here first."
status: "active"
publishedAt: "2026-05-13"
icon: "🧮"
license: "MIT"
---

## What It Does

Pre-flight memory check before you launch a fine-tune. Pick:
- Base model (or input custom dimensions)
- Training mode: Full / LoRA / QLoRA
- LoRA rank + target modules
- Batch size × sequence length
- Gradient checkpointing on/off
- Flash Attention 2 on/off

Get back: total peak VRAM, per-component breakdown (weights / optimizer / gradients / activations), and a GPU compatibility table.

## How The Math Works

| Component | Formula |
|---|---|
| Model weights | `params × bytes_per_param`  — bf16/fp16 = 2 bytes, NF4 (QLoRA) = ~0.5 |
| LoRA adapter weights | `2 × rank × hidden × modules × layers × 2` bytes (bf16) |
| Optimizer (AdamW) | `8 bytes × trainable_params` (m + v in fp32) |
| Gradients | `4 bytes × trainable_params` (fp32) |
| Activations | `batch × seq × hidden × layers × act_factor`<br>act_factor ≈ 34 → ×0.4 with checkpointing → ×0.5 with FA2 |
| Framework overhead | +10% on subtotal |

LoRA freezes the base model — only adapter params (typically 0.1-2% of total) are trainable, so optimizer and gradient memory shrink ~100×. QLoRA additionally quantises the frozen base to NF4, shrinking weight memory ~4×.

## Worked Example

Llama 3.3 70B with QLoRA, rank 16, batch 4 × seq 2048, gradient checkpointing + FA2:
- Weights: 70B × 0.5 bytes ≈ **35 GB**
- Trainable params: ~167M (0.2% of total)
- Optimizer: 167M × 8 ≈ 1.3 GB
- Gradients: 167M × 4 ≈ 0.7 GB
- Activations (with FA2 + checkpoint): ~4 GB
- **Peak ≈ 41-45 GB** — fits on A100 80GB / L40S 48GB, tight on RTX 5090 32GB.

By contrast, full fine-tune of the same model:
- Weights: 140 GB
- Optimizer: 564 GB
- Gradients: 282 GB
- **Peak ≈ 1+ TB** — needs DeepSpeed ZeRO-3 sharding across 8+ A100s.

## What's NOT Modelled

- **DeepSpeed / FSDP sharding** — multi-GPU training reduces per-GPU memory
- **Unsloth optimizations** — Unsloth can be 30-50% lower than these estimates
- **Inference VRAM** — see [GPU VRAM Calculator](/apps/gpu-vram-calculator/)
- **Mixed-precision edge cases** — fp8 training, MX-FP4 etc.

Estimates carry ±15% error. Always reserve 10-20% headroom.

## Related Tools

- [GPU VRAM Calculator](/apps/gpu-vram-calculator/) — inference VRAM
- [Reasoning Cost Calculator](/apps/reasoning-cost-calculator/) — if you can rent inference instead of training
- [Hyperscaler Pricing Comparison](/apps/hyperscaler-comparison/)
