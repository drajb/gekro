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

## How this works

Three modes in one calculator:

**API Cost** — enter your daily token volume and cache hit rate; see the monthly/annual cost for each cloud model side by side. Models are sorted cheapest-first so the decision is immediate.

**Local Hardware TCO** — pick a hardware option and a model, set your token volume and electricity rate. The calculator derives inference time from published benchmarks (decode tok/s), computes electricity cost from that actual runtime (not 24/7 assumption), and amortizes hardware over your chosen period.

**Break-even** — compare one cloud model against one local hardware option. See the month where local pays for itself and the 3-year total cost difference.

## Inputs explained

- **Input tokens/day** — tokens in your prompt + context per day across all requests. 500k is a typical small-production workload.
- **Output tokens/day** — tokens generated in responses. Usually 10–20% of input volume.
- **Cache hit rate** — percentage of input tokens served from prompt cache. 0% = no caching, 30% = aggressive prefix caching. Cache reads are 10% of base input price for Anthropic models.
- **Electricity rate** — US residential average is 17.45 ¢/kWh (EIA, Jan 2026). Enter your local rate for accurate results.
- **Amortization period** — how many years to spread hardware cost over. 3 years is the standard assumption for consumer GPU / accelerator hardware.

## Sources

- [Anthropic pricing](https://platform.claude.com/docs/en/docs/about-claude/pricing) — Claude Opus 4.7, Sonnet 4.6, Haiku 4.5. Verified 2026-04-19.
- [OpenAI pricing](https://developers.openai.com/api/docs/pricing) — GPT-5.4, GPT-5.4 mini. Verified 2026-04-19.
- [Google Gemini pricing](https://ai.google.dev/gemini-api/docs/pricing) — Gemini 2.5 Pro, Gemini 2.5 Flash. Verified 2026-04-19.
- [CNX-Software Pi AI HAT+ 2 review](https://www.cnx-software.com/2026/01/20/raspberry-pi-ai-hat-2-review-a-40-tops-ai-accelerator-tested-with-computer-vision-llm-and-vlm-workloads/) — Hailo-10H benchmarks (Llama 3.2 3B, Qwen 2.5 1.5B). January 2026.
- [LocalScore RTX 5060 Ti](https://www.localscore.ai/accelerator/860) — Llama 3.1 8B Q4_K_M on RTX 5060 Ti 16GB. llama.cpp methodology.
- [DatabaseMart RTX 5060 GPU benchmark](https://www.databasemart.com/blog/ollama-gpu-benchmark-rtx5060) — Llama 3.1 8B, Mistral 7B on RTX 5060 8GB. Ollama 0.9.5, Q4 quantization.
- [EIA Electricity Monthly Update](https://www.eia.gov/electricity/monthly/update/end-use.php) — US residential average 17.45 ¢/kWh, January 2026.

## Limitations

- **Power draw** uses TGP (total graphics power) as a conservative upper bound. Actual inference draw is typically 60–85% of TGP; your real electricity cost may be lower.
- **Pi AI HAT+ 2 (Hailo-10H)** can only run 1.5–3B models. 7B+ models are not supported on any current Pi hardware.
- **Null benchmarks** are shown as "No published data" — several model/hardware combinations have no reproducible published benchmark. These are never estimated.
- **Cloud pricing changes** frequently. Always verify against the official provider pricing page before making infrastructure decisions. Last verified date is shown in the app.
- **This calculator does not model** batch API discounts, reserved capacity pricing, cold-start latency, multi-GPU scaling, or quantization quality degradation.
