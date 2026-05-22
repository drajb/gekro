---
title: "Multi-modal Token Counter"
category: "ai"
job: "Drop an image → see how many vision tokens each model charges (GPT-5, Claude 4, Gemini 2.5/3 Pro) and the cost at your usage volume."
description: "Free browser-based image-token calculator for vision-capable LLMs. Drop a PNG/JPG/WebP, or enter dimensions manually → tool applies each provider's published vision-token formula (OpenAI tiled resize + 170 tokens/tile, Anthropic w×h/750 capped at 1600, Google Gemini 258/tile at 768²) and shows the per-image cost across 8 models side-by-side. Includes a cost-at-scale view (per-day / per-month) for your image volume."
aiSummary: "Client-side vision-token cost calculator. Image dimensions read locally via FileReader + Image() — image itself never uploaded. Applies provider-specific tokenization formulas: OpenAI's two-stage resize (fit 2048², then short side to 768, then 512²-tile at 170 tok/tile + 85 base) for GPT-5/GPT-5-mini/GPT-4o; Anthropic's (w×h)/750 formula capped at 1600 tokens per image for Claude Opus 4/Sonnet 4/Haiku 4; Google's 258 tokens flat ≤384px / 768²-tile at 258 tok/tile for Gemini 2.5/3 Pro. Compares cost per image and at-scale across all 8 vision models. Distinguishes OpenAI 'low detail' flat 85-token mode from 'high detail' tiled mode."
personalUse: "I built this because vision pricing is opaque. The 'cost' field in the docs is per-1M-tokens, but how many tokens IS my screenshot? It depends on the provider AND the dimensions. This makes the math obvious."
status: "active"
publishedAt: "2026-05-13"
icon: "🖼️"
license: "MIT"
---

## What It Does

Vision-capable LLMs (GPT-5, Claude 4 family, Gemini 2.5/3 Pro) charge for images as tokens. Each provider has a different formula:

- **OpenAI** (GPT-5, GPT-5 mini, GPT-4o): resizes image to fit 2048² then short-side to 768, then tiles into 512² blocks. Each tile = 170 tokens + 85 base. "Low detail" mode = flat 85 tokens, no tiling.
- **Anthropic** (Claude Opus/Sonnet/Haiku 4): tokens ≈ (width × height) / 750, capped at 1600 per image.
- **Google** (Gemini 2.5/3 Pro): ≤384px in any dimension → 258 tokens flat. Larger → tiled at 768², 258 tokens per tile.

Drop an image. The tool reads dimensions client-side and computes tokens + cost for every model side-by-side.

## When To Use This

- **OCR pipelines / document AI**: high-volume images amortise differently across providers
- **Vision-RAG**: thumbnail vs full-res tradeoff — see the cost difference
- **Side-by-side evals**: same image, see which provider charges more for the same context
- **Budget projections**: enter your daily image volume, get monthly/annual estimates

## Privacy

The image never leaves your browser. Only the natural `width` and `height` are read via the `Image()` element. Even the file name isn't sent anywhere.

## Limitations

- Formulas reflect each provider's published documentation as of 2026-05. Actual billed tokens can vary ±5%.
- Multi-image messages aren't modelled — multiply costs by image count.
- Video / PDF tokens use different formulas not covered here.
- "Auto" detail in OpenAI varies based on image size — this tool assumes the high-detail path for the calculation.

## Related Tools

- [Reasoning Token Cost Calculator](/apps/reasoning-cost-calculator/)
- [LLM Cost Calculator](/apps/llm-cost-calculator/)
- [Prompt Token Counter](/apps/prompt-token-counter/)
- [Hyperscaler Pricing Comparison](/apps/hyperscaler-comparison/)
