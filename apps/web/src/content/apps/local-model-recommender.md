---
title: "Local Model Browser"
category: "ai"
job: "Filter 54+ open-weight LLMs by hardware + task + license + capability. See which fit your VRAM at your chosen quantization, with a clearly-labeled performance estimate."
description: "Free browser for the 2026 open-weight LLM catalog. Filter Llama / Qwen / Mistral / Gemma / Phi / DeepSeek / GPT-OSS / Granite / Command / Yi / StarCoder by hardware (Pi 5 to 2× H100), task (chat / code / vision / reasoning / agentic), required capabilities (tool-use, JSON mode, vision input, reasoning trace), license category (permissive / restricted / non-commercial), and minimum context window. Each result shows estimated weights size at your quantization, fit verdict against your hardware (with CPU-offload warning if it won't fit in VRAM), and a directional throughput estimate based on memory bandwidth. Includes Ollama pull commands and HuggingFace links. Catalog is the same shared data file (`local-models.json`) used by the llama.cpp config builder and LoRA memory calculator."
aiSummary: "Faceted browser over the shared local-models.json catalog (54 entries as of 2026-05-23 across 11 vendors). Per Rohit's 2026-05-22 spec: explicit BROWSER not RECOMMENDER framing - no 'best for you' opinions, just facets. Performance estimate is labeled directional: tok/s = (bandwidth_GB/s * 0.8) / active_weights_GB; weights = (params * bpw) / 8 GB. Hardware presets cover Pi 5 16GB through 2× H100, including Mac unified-memory configs (M2 Ultra 192GB). Filters: hardware + quant (Q2_K to F16), task type (chat/code/vision/reasoning/agentic/any), capability requirements (tool/json/vision/reasoning), license category (permissive/restricted/non-commercial), min context window, fit toggle. Results sortable by best-fit (active params asc), total params, context window, release date, or vendor name. Each result card shows weights at chosen bpw, fit verdict (easy/tight/cant + CPU-offload calculation when hybrid), throughput estimate with tier coloring, Ollama pull tag, HF ID link, model notes. Export filtered list as CSV. AppShell app:copy gives a short text summary. No persistent state. Updates as catalog grows - the planned weekly GH Actions auto-fetcher PR (per #9 design) will keep the catalog current."
personalUse: "I have a Pi 5 cluster, an M4 Pro, and an RTX 4090 sitting in different rooms and constantly forget which models fit which. I built this so I can pick a model + quant and instantly see 'fits comfortably on the M4 Pro at ~25 tok/s, won't fit the 4090 at Q4_K_M without CPU offload'."
status: "active"
publishedAt: "2026-05-25"
icon: "🧭"
license: "MIT"
---

## What It Does

Pick your hardware on the left. The 54-model catalog filters on the right, with weights size and a throughput estimate against your selected quantization.

- **Hardware presets** - Pi 5 16GB / 8GB, Mac M-series (Pro, Max, Ultra) up to 192 GB unified, RTX 3090/4090/5090, A100 40/80, H100, H200, 2× H100, plus Custom
- **Quantization picker** - Q2_K through F16 (default Q4_K_M, the community sweet spot)
- **Task tabs** - Any / Chat / Code / Vision / Reasoning / Agentic
- **Capability requirements** - checkboxes for tool use, JSON mode, vision input, reasoning trace; only show models that support what you need
- **License filter** - toggle Permissive (Apache, MIT), Restricted (Llama Community, Gemma TOU, MRL), Non-commercial (Cohere CC BY-NC) separately
- **Min context window** - 8K / 32K / 128K / 1M
- **Fit-only toggle** - by default hide models that won't fit your hardware (you can turn this off to browse everything)
- **Sort** - best fit (smallest first), total params, context window, release date, or vendor

Each result card shows:
- **Vendor pill** and any MoE marker (with active params)
- **Type tags** (chat / code / vision / reasoning / agentic) and capability tags (tool / vision / json / reasoning)
- **Weights size** at your chosen quantization
- **Fit verdict** color-coded by tier: green (fits comfortably), yellow (tight or needs CPU offload), red (won't fit)
- **Estimated throughput** in tokens/sec (colored by tier - 30+ green, 8-30 yellow, <8 red)
- **Context window**, **release date**, **license**
- **`ollama pull` command** and HuggingFace link
- **Notes** when present (e.g. "MLA cuts KV cache by ~93%", "Tool-use trained")

## How the throughput estimate works

This is the most honest version of model performance estimation I can give without measuring on your hardware:

```
weights_GB        = (params × bits_per_weight) / 8 / 1024³
active_weights_GB = same, but using params_active for MoE
tokens_per_sec    ≈ (memory_bandwidth_GB/s × 0.8) / active_weights_GB
```

It's bandwidth-bound, not FLOPS-bound - for typical LLM inference at batch 1, the GPU/CPU spends most of its time waiting for weights to stream from memory. The 0.8 fudge factor is a generous bandwidth utilization estimate. Real numbers will be lower with longer contexts (KV cache grows), with attention optimizations (FlashAttention), and with quantization-aware kernels.

Don't make purchase decisions from this number - run llama-bench on the actual hardware for that. Do use it for "is this even feasible?" first-cut filtering.

## Why "Browser" not "Recommender"

The original spec was a recommender. We reframed during planning (2026-05-22): we don't want to say "the best model for your Pi 5 is X." Hardware-fit is just one dimension; quality on your specific task is another (and varies per benchmark, per prompt, per fine-tune). A facet browser lets you see all options at a glance and pick based on the tradeoffs you care about. That's the honest framing.

## What's NOT Included

- **Quality benchmarks** - no MMLU / HumanEval / GPQA / AIME scores. Reason: they go stale within weeks (new fine-tunes ship daily), and the leaderboard wars don't tell you how a model behaves on YOUR task. Use [HuggingFace Open LLM Leaderboard](https://huggingface.co/open-llm-leaderboard) and [LMArena](https://lmarena.ai/) for those
- **Actual tokens/sec measurements** - the estimate is directional. For measured numbers run `llama-bench` or [Ollama's bench]
- **Cloud / API models** - this is specifically open-weight models you can run locally. Hosted API models are tracked separately in `reasoning-models.json` and `hyperscaler-pricing.json`
- **Persistent state** - reload starts fresh, by design

## Related Tools

- [Llama.cpp / Ollama Config Builder](/apps/llama-cpp-config-builder/) - once you've picked a model here, generate the optimal CLI flags
- [LoRA / QLoRA Memory Calculator](/apps/lora-memory-calculator/) - VRAM math for fine-tuning these same models
- [GPU VRAM Calculator](/apps/gpu-vram-calculator/) - manual VRAM math with full breakdown
- [Reasoning Token Cost Calculator](/apps/reasoning-cost-calculator/) - cloud equivalent for hosted reasoning models
- [Context Window Visualizer](/apps/context-window-visualizer/) - see what fits in different context windows
