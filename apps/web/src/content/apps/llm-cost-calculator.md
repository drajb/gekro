---
title: "LLM Cost Calculator"
slug: "llm-cost-calculator"
category: "ai"
job: "Compare LLM API costs and local inference TCO side by side"
description: "Calculate and compare the real cost of running LLMs — cloud API pricing vs local hardware total cost of ownership, with break-even analysis. Sourced data, no login."
aiSummary: "A client-side calculator comparing cloud LLM API costs (Claude, GPT, Gemini) against local inference hardware TCO (RTX 5060 Ti, Pi AI HAT+ 2), with break-even month analysis. All pricing data is sourced from official provider pages and verified quarterly."
personalUse: "I run a Pi 5 cluster and regularly debate whether to use Haiku or run Llama locally. I built this to settle that argument with actual numbers, not vibes."
status: "active"
publishedAt: "2026-04-19"
lastVerified: "2026-04-19"
companionPostSlug: ""
license: "MIT"
icon: "💰"
---

## What It Does

This calculator solves the question every AI engineer eventually hits: "Should I pay for API calls or buy hardware?" It compares cloud LLM API costs (Claude, GPT-5, Gemini) against local inference hardware total cost of ownership — and tells you the exact month where local pays for itself.

Three modes in one tool: API Cost mode shows your monthly spend across all major models side by side. Local Hardware TCO models the real cost of running a GPU or Pi accelerator, including electricity derived from actual inference time (not a naïve 24/7 power-draw assumption). Break-even mode overlays the two and draws the crossover line.

## How to Use It

**API Cost mode** — enter your daily input and output token volumes, your cache hit rate, and select which models to compare. The table sorts cheapest-first. Start here if you're running or planning a cloud-only workload.

**Local Hardware TCO mode** — pick a hardware option (RTX 5060 Ti 16GB, RTX 5060 8GB, Pi AI HAT+ 2), select a model that runs on it, enter your token volume and local electricity rate, and set an amortization period. The calculator computes inference time from published tok/s benchmarks, then derives actual electricity cost from that runtime.

**Break-even mode** — choose one cloud model and one hardware option. The chart shows cumulative cost over 36 months for each path, and marks the month where local becomes cheaper.

Key inputs:
- **Input tokens/day** — prompt + context tokens across all requests. 500k/day is a small production workload; a RAG pipeline answering 1,000 queries/day with 2k-token contexts is 2M input tokens/day.
- **Cache hit rate** — Anthropic charges 10% of base input price for cached reads. If your system prompt is large and static, a 40–60% cache hit rate is achievable with prefix caching and dramatically cuts spend.
- **Output tokens/day** — typically 10–20% of input volume for summarization/QA tasks; can equal or exceed input for generation tasks.

## The Math / How It Works

**API cost:** `monthly_cost = (input_tokens/day × 30 × (1 − cache_rate) × input_price_per_Mtok) + (input_tokens/day × 30 × cache_rate × cached_price_per_Mtok) + (output_tokens/day × 30 × output_price_per_Mtok)`

**Local TCO:** inference time is derived from published decode benchmarks (tok/s). Electricity cost = `(inference_seconds/day × TGP_watts × 30) / (3_600_000)` kilowatt-hours × your rate. Hardware cost is amortized linearly over your chosen period. Total monthly cost = amortized_hardware + electricity.

TGP (Total Graphics Power) is used as a conservative upper bound. Real inference draw is typically 60–85% of TGP, so your actual electricity cost may run lower.

## Why AI Engineers Need This

The 10x cost surprise is real. A prototype that costs $50/month at toy load scales to $500–$5,000/month in production, and the developers who get hit hardest are the ones who never modeled the token math before launch.

Two failure modes I've seen: (1) teams that default to GPT-4-class models for everything because "quality" — not realizing that Claude Haiku or Gemini Flash handles 80% of their tasks at 10–15× lower cost; (2) teams that buy expensive GPU hardware expecting to save money, without doing the break-even math — and find out the card pays off in 18 months at their actual load, by which time a cheaper API model has launched.

The cache hit rate input exists because most people underestimate it. If your system prompt is 4,000 tokens and most requests share it, prompt caching can cut your input bill by 40–50% with zero code complexity on the Anthropic API. This calculator lets you model that directly.

Use this tool before you commit to an architecture. Run the break-even tab before you order hardware. The numbers will change your decision more often than you expect.

## Tips & Power Use

- **Benchmark your actual prompt/completion ratio** before projecting costs. Most production systems are input-heavy (10:1 or higher), which means input price matters far more than output price.
- **Model the cache hit rate realistically.** Cold start (0%) vs. warm cache (40–60%) can be a 2–3× difference in monthly spend for Anthropic models.
- **Use the break-even tab to stress-test hardware purchases.** If local only pays off in month 28 and you expect model quality to shift in 12 months, the ROI case is much weaker than it looks.
- **Pi AI HAT+ 2 is a real option for narrow use cases.** At roughly $80 all-in and sub-watt inference, it makes economic sense for lightweight 1.5B–3B model serving at very low volume — but the model quality ceiling is hard.
- **Cross-reference with the [Prompt Token Counter](/apps/prompt-token-counter/)** to measure your actual prompt sizes before plugging numbers into the volume fields here.

## Limitations

- **Power draw** uses TGP as a conservative upper bound. Actual inference draw is typically 60–85% of TGP; your real electricity cost may be lower.
- **Pi AI HAT+ 2 (Hailo-10H)** can only run 1.5–3B models. 7B+ models are not supported on any current Pi hardware.
- **Null benchmarks** are shown as "No published data" — several model/hardware combinations have no reproducible published benchmark. These are never estimated.
- **Cloud pricing changes** frequently. Always verify against the official provider pricing page before making infrastructure decisions. Last verified date is shown in the app.
- **This calculator does not model** batch API discounts, reserved capacity pricing, cold-start latency, multi-GPU scaling, or quantization quality degradation.

## Sources

- [Anthropic pricing](https://platform.claude.com/docs/en/docs/about-claude/pricing) — Claude Opus 4.7, Sonnet 4.6, Haiku 4.5. Verified 2026-04-19.
- [OpenAI pricing](https://developers.openai.com/api/docs/pricing) — GPT-5.4, GPT-5.4 mini. Verified 2026-04-19.
- [Google Gemini pricing](https://ai.google.dev/gemini-api/docs/pricing) — Gemini 2.5 Pro, Gemini 2.5 Flash. Verified 2026-04-19.
- [CNX-Software Pi AI HAT+ 2 review](https://www.cnx-software.com/2026/01/20/raspberry-pi-ai-hat-2-review-a-40-tops-ai-accelerator-tested-with-computer-vision-llm-and-vlm-workloads/) — Hailo-10H benchmarks (Llama 3.2 3B, Qwen 2.5 1.5B). January 2026.
- [LocalScore RTX 5060 Ti](https://www.localscore.ai/accelerator/860) — Llama 3.1 8B Q4_K_M on RTX 5060 Ti 16GB. llama.cpp methodology.
- [DatabaseMart RTX 5060 GPU benchmark](https://www.databasemart.com/blog/ollama-gpu-benchmark-rtx5060) — Llama 3.1 8B, Mistral 7B on RTX 5060 8GB. Ollama 0.9.5, Q4 quantization.
- [EIA Electricity Monthly Update](https://www.eia.gov/electricity/monthly/update/end-use.php) — US residential average 17.45 ¢/kWh, January 2026.
