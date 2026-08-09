---
title: "LLM Inference Latency Estimator"
category: "ai"
job: "Estimate time-to-first-token, decode speed, and total latency for an LLM on a given GPU - before you rent it"
description: "Pick a model and a GPU (or type in your own numbers) and get a first-order estimate of time-to-first-token, per-request decode speed, total latency, and aggregate throughput at a batch size. It uses the standard roofline model - prefill is compute-bound, decode is memory-bandwidth-bound - and distinguishes total params from active params so MoE models are handled correctly. All client-side."
aiSummary: "A client-side LLM inference latency and throughput estimator using a roofline model: prefill time = 2·active_params·prompt_tokens / (peak_FLOPS·MFU) (compute-bound), decode speed = memory_bandwidth / active_weight_bytes (bandwidth-bound). It separates total params (memory footprint) from active params (compute and decode traffic) to model MoE correctly, checks memory fit, and reports TTFT, decode tok/s, total latency, and aggregate throughput at batch. Curated, editable GPU specs."
personalUse: "Before I rent a GPU or pick a serving config, I want a back-of-envelope for how fast a model will actually run - especially the split between time-to-first-token and streaming speed, which come from completely different bottlenecks. I kept redoing the same roofline arithmetic in a scratchpad, so I turned it into a tool that also makes the prefill-vs-decode distinction obvious."
status: "active"
publishedAt: "2026-08-08"
lastVerified: "2026-08-08"
companionPostSlug: ""
license: "MIT"
icon: "⏱️"
---

## What It Does

Two questions decide whether an LLM feels fast: how long until the first token appears, and how quickly tokens stream after that. They have different bottlenecks, and this tool estimates both.

Pick a model and a GPU (or enter your own bandwidth / FLOPS / memory), set your prompt and output lengths and batch size, and get:

- **Time to first token (TTFT)** - the prefill pass
- **Decode speed** - per-request tokens/second while streaming
- **Total latency** - end to end for one request
- **Aggregate throughput** - tokens/second across the batch

## The Model

It's a first-order roofline estimate, which is the right mental model for LLM serving:

- **Prefill is compute-bound.** Processing the prompt is a big matrix multiply: roughly `2 × active_params × prompt_tokens` FLOPs, divided by the GPU's achievable throughput (peak FLOPS × MFU). This sets TTFT.
- **Decode is memory-bandwidth-bound.** Generating each token re-reads the model's weights from memory, so speed is roughly `memory_bandwidth ÷ active_weight_bytes` - not compute. This is why a bigger, faster GPU with the same bandwidth barely moves decode speed, and why quantization (fewer bytes per weight) speeds decoding up.

Crucially, it separates **total params** (which set the memory footprint) from **active params** (which drive compute and decode traffic), so a Mixture-of-Experts model like Mixtral or GPT-OSS is modelled correctly - huge in memory, cheap per token.

GPU specifications are representative published figures and every field is editable, so you can plug in your exact accelerator.

For the memory-fit side, use the [GPU VRAM Calculator](/apps/gpu-vram-calculator/); for API rate limits, the [Rate-Limit Planner](/apps/rate-limit-planner/); for spend, the [Reasoning Cost Calculator](/apps/reasoning-cost-calculator/).

## Limitations

- **First-order, not a benchmark.** It ignores KV-cache read bandwidth (which grows with context and eventually dominates long-generation decode), attention overhead, kernel-launch latency, speculative decoding, and framework differences. Real numbers will differ; treat it as the right order of magnitude and the right intuition.
- **Ideal sharding assumed** when a model doesn't fit one GPU - it flags the shard count but doesn't model inter-GPU communication cost.
- **MFU is your input.** Achievable utilization varies widely by kernel and sequence length; 30-50% is a reasonable default.
