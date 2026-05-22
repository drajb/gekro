---
title: "Prompt Cache Optimizer"
category: "ai"
job: "Analyze your prompt → find the optimal cache split point → see projected monthly savings across Anthropic / OpenAI / Google / DeepSeek caching."
description: "Free browser-based prompt-caching analyzer. Paste your system prompt + a typical user message → tool estimates tokens, applies each provider's cache pricing (Anthropic 90% off + 25% write surcharge, OpenAI 90% off no surcharge, Google 75% off, DeepSeek 75% off), and shows projected monthly + annual savings. Generates actionable recommendations like 'your prompt is below the 1024-token minimum cache block' or 'cache hit rate too low for 1.25× write surcharge'."
aiSummary: "Client-side prompt-caching cost analyzer. Calculates the financial impact of restructuring prompts for cacheable prefixes across all four major providers' cache implementations: Anthropic (90% off on hit, 1.25× write surcharge, 1024-token minimum), OpenAI (90% off, no write surcharge, automatic), Google (75% off, 4096-token minimum, explicit TTL), DeepSeek (75% off, 1024-token minimum). Inputs: system prompt text, per-request user content, requests/day, expected hit rate. Outputs: per-request cache hit/miss costs, monthly/annual savings, actionable recommendations (e.g., 'your prefix is below the cache minimum'). Uses universal 4-chars/token heuristic for token estimation."
personalUse: "I built this after realising our agent was paying full price on a 3,500-token system prompt for every single request. The hit-rate math is non-obvious because of Anthropic's write surcharge — needed a tool to actually verify caching would help, not just claim it would."
status: "active"
publishedAt: "2026-05-13"
icon: "💾"
license: "MIT"
---

## What It Does

Prompt caching is the single biggest cost-reduction opportunity in modern LLM apps, but the math is non-obvious because:
- Each provider has different discounts, minimums, and surcharges
- A bad cache hit rate can make caching *more expensive* on Anthropic (write surcharge)
- The cacheable prefix has minimum sizes that vary by provider

This tool answers: **"If I cache my system prompt, how much will I save?"**

Paste your system prompt + a typical user message, set your volume, and see:
- Monthly + annual savings
- Per-request cost in three scenarios (no cache / cache hit / cache miss)
- Recommendations: prefix too short? hit rate too low for the write surcharge? wrong provider for your usage pattern?

## Provider Differences

| Provider | Discount | Write surcharge | Min cache size | TTL |
|---|---|---|---|---|
| Anthropic | 90% off | 1.25× input on write | 1024 (Haiku: 2048) | 5min / 1hr |
| OpenAI | 90% off | None | 1024 | ~5-10min |
| Google | 75% off | None | 4096 | Explicit, paid storage |
| DeepSeek | 75% off | None | 1024 | Standard |

The defaults pre-fill your provider's published rates. Override any field if you have negotiated pricing.

## When To Use This

- **Before adopting caching**: confirm the savings actually beat the implementation effort
- **Choosing a provider**: a 90% Anthropic discount with poor hit rate may net less than 75% Google with perfect caching
- **Architecting prompts**: move persistent content (knowledge docs, examples) ABOVE the user's per-request content to maximise cacheable prefix
- **Budget projections**: realistic annual cost estimates for finance review

## Token Estimation Method

Coarse 4-chars-per-token heuristic. Good enough for cost-projection purposes (typical error ±10%). For precise token counts before sending, use [Prompt Token Counter](/apps/prompt-token-counter/).

## Limitations

- Doesn't model Anthropic's tiered cache hit pricing (5-minute vs 1-hour read rates differ)
- Google Gemini context caching also charges hourly storage at $1/M tokens/hour — not modelled here
- Output token cost isn't modelled — caching only affects input. For full cost see [LLM Cost Calculator](/apps/llm-cost-calculator/) or [Reasoning Cost Calculator](/apps/reasoning-cost-calculator/).

## Related Tools

- [Reasoning Token Cost Calculator](/apps/reasoning-cost-calculator/)
- [LLM Cost Calculator](/apps/llm-cost-calculator/)
- [Prompt Token Counter](/apps/prompt-token-counter/)
- [Hyperscaler Pricing Comparison](/apps/hyperscaler-comparison/)
