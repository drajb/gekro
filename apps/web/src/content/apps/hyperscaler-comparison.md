---
title: "Hyperscaler AI Pricing — Bedrock vs Foundry vs Vertex"
category: "ai"
job: "Compare on-demand inference pricing for the same model across AWS Bedrock, Azure AI Foundry, and Google Vertex AI"
description: "Side-by-side cost comparison for foundation models on the three managed AI platforms. Plug in your daily token volumes and see where each model is cheapest. Pricing is auto-verified weekly via each platform's official pricing API — every row shows the date it was last confirmed against the live data. Covers Llama 4, Claude, GPT-5, Gemini, DeepSeek, Mistral, Nova, GLM, Qwen and more."
aiSummary: "Browser-based pricing comparison for AWS Bedrock vs Azure AI Foundry vs Google Vertex AI. Reads from a self-maintaining JSON updated weekly via GitHub Actions calling each platform's official pricing API (AWS Bulk Pricing, Azure Retail Prices, GCP Cloud Billing Catalog). Covers ~12 cross-platform foundation models including Llama 4, DeepSeek V3.2/R1, Mistral Large 3, Nova family, GLM 5. Cost calculator: input/output tokens per day → monthly cost on each platform. Highlights cheapest provider per model. Each row stamped with last_verified date from the source API."
personalUse: "I built this because I needed to know — for the same model — which hyperscaler was actually cheapest for my workload's input/output ratio. The pricing pages on each cloud are inconsistent (per-1k vs per-1M, different region defaults, mixed in with provisioned-throughput tiers). Manual comparison is error-prone and goes stale weekly. This solves both."
status: "active"
publishedAt: "2026-05-06"
icon: "⚖️"
license: "MIT"
---

## What It Does

Compares the **on-demand inference price** of the same foundation model across the three managed AI platforms:

- **AWS Bedrock** (us-east-1)
- **Azure AI Foundry** (eastus, global deployment tier)
- **Google Vertex AI** (us-east5)

For each model in the catalogue, you see input + output prices on each platform, the cheapest option highlighted, and "N/A" for platforms where the model isn't offered.

The **cost calculator** at the top lets you input your daily token volumes — the comparison rebuilds with monthly USD figures so you can see the actual dollar difference for your workload.

## How to Use It

1. **Enter your daily volumes**: input tokens per day + output tokens per day. Defaults to 500K input / 100K output (a typical small production app).
2. **Browse the model cards**: each card shows the model's price on Bedrock, Foundry, and Vertex. Cheapest platform gets a green "✓ Cheapest" badge. Unavailable platforms show "N/A" with a one-line reason.
3. **Filter** by vendor (Anthropic, Meta, etc.) or by tier (cheapest first / most capable first).
4. **Read the verification date** at the bottom of each row — that's when the price was last confirmed against the platform's official pricing API.

## How the Pricing Stays Current

Every Monday at 9 AM UTC, a GitHub Actions workflow:

1. Calls AWS Bedrock's public Bulk Pricing JSON
2. Calls Azure's Retail Prices API
3. Calls GCP's Cloud Billing Catalog API
4. Diffs the responses against the canonical JSON in the repo
5. If anything changed, opens a pull request with the diff for human review

Pricing data has a `last_verified` field per row + a `verified_via: api` flag once auto-confirmed. Cost: $0 (all three platforms publish pricing for free; GitHub Actions on public repos has unlimited free minutes).

The pipeline source code lives in `scripts/pricing/` in the [gekro repo](https://github.com/drajb/gekro). The pricing JSON itself is at `apps/web/src/content/data/hyperscaler-pricing.json` — version-controlled, every change is a reviewable PR.

## What's In Scope

- ✅ On-demand inference pricing (input + output tokens)
- ✅ Standard region per platform (us-east-1 / eastus / us-east5)
- ✅ Standard pay-as-you-go tier
- ✅ ~12 cross-platform foundation models with active 2026-era pricing

## What's NOT In Scope (Intentionally)

- ❌ **Provisioned throughput / committed use** — Bedrock PT, Foundry PTU, Vertex PVM. These are negotiated, not generally publishable.
- ❌ **Regional price deltas** — same model can be 0-30% cheaper in different regions; tracking N regions × N models combinatorially explodes maintenance.
- ❌ **Fine-tuning, embedding, image generation, storage, RAG primitives** — different cost dimensions, separate decision.
- ❌ **Every model on every platform** — there are 73 models on Bedrock alone. The comparison tracks the top ~12 with cross-platform interest. Add requests via GitHub issue.

## Why This Matters

The same model is sold at slightly different prices across the three hyperscalers, and the prices change frequently. A static comparison page goes stale within weeks. By the time you've spent an hour comparing manually, AWS has dropped Llama 4 by 20% or Azure has added a new GPT tier.

This tool exists because the comparison is genuinely valuable AND there's no honest way to maintain it without automation. The combination of (a) an auto-fetcher pipeline, (b) a JSON-as-source-of-truth, (c) human-reviewed PR for every change makes the data both fresh AND accountable.

## Where the Numbers Come From

| Platform | Source | Auth required |
|---|---|---|
| AWS Bedrock | [Public Bulk Pricing JSON](https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/AmazonBedrock/current/region_index.json) | None |
| Azure Foundry | [Retail Prices API](https://prices.azure.com/api/retail/prices) | None |
| GCP Vertex | [Cloud Billing Catalog API](https://cloud.google.com/billing/docs/reference/rest/v1/services.skus/list) | API key (free) |

Run discovery locally:
```bash
node scripts/pricing/update-pricing.mjs --discover
```

Outputs every model on every platform with its raw SKU. Useful when adding new models to the comparison.

## Limitations

- **Region locked to defaults**: us-east-1 / eastus / us-east5. Cheaper regions exist for some models but tracking all combinations is unmaintainable.
- **Standard tier only**: Provisioned throughput, batch inference, and flex tiers all have different (often cheaper) pricing not covered here. Standard on-demand is the apples-to-apples comparison.
- **Output may differ ±2%** from the platform's pricing page if the API hasn't propagated yet (pricing API updates can lag the marketing page by a few hours).
- **Catalogue selectivity**: the comparison covers the top ~12 cross-platform models, not every model on every platform. By design — full catalogues are noisy, this surfaces the meaningful comparisons.

## Related Tools

- [LLM Cost Calculator](/apps/llm-cost-calculator/) — direct API pricing (Anthropic, OpenAI, Google direct, not via hyperscalers)
- [Model Benchmark](/apps/model-benchmark/) — capability comparison (not cost)
- [GPU VRAM Calculator](/apps/gpu-vram-calculator/) — local hosting alternative
