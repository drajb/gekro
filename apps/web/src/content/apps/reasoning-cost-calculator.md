---
title: "Reasoning Token Cost Calculator"
category: "ai"
job: "Calculate the real cost of reasoning models — including the hidden reasoning tokens every other cost calculator ignores."
description: "Free browser-based cost calculator for extended-thinking models: OpenAI o3 + GPT-5 thinking, Claude Opus/Sonnet/Haiku 4 extended-thinking, DeepSeek R1, Grok 4 thinking, Gemini 2.5/3 Pro thinking. Shows the visible-output cost AND the hidden-reasoning-token cost broken down separately, scales to your real request volume, compares all reasoning-capable models side-by-side. Direct-API pricing, no signup."
aiSummary: "Client-side calculator that surfaces the true cost of reasoning models by separating reasoning-token cost from visible output cost. Reasoning tokens are billed at each model's output rate by every major provider (OpenAI, Anthropic, Google, xAI, DeepSeek) but are invisible to the user — most cost estimators ignore them. This tool models reasoning effort (low/medium/high/custom) per the published multipliers each model exhibits and reports cost per request, cost at scale (1k-100k req/day), and a cross-model comparison table. Direct-API pricing as of 2026-05. Companion to the Hyperscaler Pricing Comparison app (App #51) which covers Bedrock/Foundry/Vertex routing of the same model families."
personalUse: "I built this after a $200 surprise bill from a DeepSeek R1 evaluation run — the visible answers were tiny but the hidden reasoning traces were 20× longer. The mainstream LLM cost calculators (OpenAI's, third-party ones) all assume output = billable. For reasoning models that's flat wrong."
status: "active"
publishedAt: "2026-05-13"
icon: "🧠"
license: "MIT"
---

## What It Does

Extended-thinking models (OpenAI o3, GPT-5 thinking, Claude 4 extended-thinking, DeepSeek R1, Grok 4 thinking, Gemini 2.5/3 Pro thinking) charge you for **two** kinds of output tokens:

1. **Visible output** — what the model actually shows the user
2. **Reasoning tokens** — hidden chain-of-thought the model "thought" before answering

Every major provider bills reasoning tokens at the model's normal output rate. Most cost calculators (including the official ones) ignore them. The result is real bills that are **2-30× higher** than the estimate.

This tool fixes that.

## How To Use It

1. Pick your reasoning model
2. Enter typical input tokens + visible-output tokens per request
3. Pick reasoning effort (or supply a custom multiplier)
4. See the breakdown: input + output + hidden reasoning + cached
5. Scale to your real request volume (10/day to 100k/day)
6. Compare across all reasoning-capable models in one table

## Why Reasoning Effort Multipliers Vary By Model

Each model reasons differently. The "medium" effort multiplier in the dropdown reflects calibrated estimates of typical reasoning-token-to-visible-output ratios:

| Model | Low | Medium | High |
|---|---|---|---|
| o3 | 3× | 8× | 20× |
| GPT-5 thinking | 1× | 3× | 8× |
| Claude Opus 4 thinking | 2× | 5× | 12× |
| DeepSeek R1 | 5× | 15× | 30× |
| Grok 4 thinking | 2× | 5× | 12× |
| Gemini 2.5/3 Pro thinking | 1× | 3× | 8× |

DeepSeek R1 is famously reasoning-heavy — its hidden traces can be 15-30× the visible output even at default effort. GPT-5 is the opposite extreme; its thinking is short and efficient.

## What's In Scope

- ✅ Direct-API pricing for OpenAI, Anthropic, Google, DeepSeek, xAI
- ✅ Reasoning-token cost calculation per provider
- ✅ Cached input tokens (Anthropic prompt caching, OpenAI cached input, Google context caching)
- ✅ Cost scaling: per request → daily → monthly → annual
- ✅ Side-by-side comparison across all reasoning models

## What's Not In Scope

- ❌ Hyperscaler routing (Bedrock / Azure / Vertex) — that's what [App #51 Hyperscaler Pricing Comparison](/apps/hyperscaler-comparison/) covers
- ❌ Fine-tuning, embeddings, image/audio generation — different cost dimensions
- ❌ Non-reasoning models — for those use [LLM Cost Calculator](/apps/llm-cost-calculator/)

## Where the Numbers Come From

Direct-API pricing pages from each provider, as of 2026-05. The data lives in `apps/web/src/content/data/reasoning-models.json` — version-controlled, every change is a git commit. An auto-fetcher pipeline is planned (provider direct-pricing pages don't expose APIs the way hyperscaler catalogues do).

## Related Tools

- [Hyperscaler Pricing Comparison](/apps/hyperscaler-comparison/) — Bedrock vs Foundry vs Vertex for the same models
- [LLM Cost Calculator](/apps/llm-cost-calculator/) — non-reasoning model costs
- [Prompt Token Counter](/apps/prompt-token-counter/) — tokenize before you estimate
- [Context Window Visualizer](/apps/context-window-visualizer/) — see where context is going

## Limitations

- **Effort multipliers are calibrated estimates.** Actual reasoning usage varies wildly by prompt complexity. A "medium" coding question might be 3× while a "medium" math proof is 15×.
- **Cached-input pricing assumed at provider documented rate.** Anthropic's tiered cache hit / write pricing isn't fully modeled.
- **Direct-API only.** Routing via Bedrock/Azure/Vertex changes both pricing and reasoning availability for some models.
