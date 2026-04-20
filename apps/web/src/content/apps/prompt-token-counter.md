---
title: "Prompt Token Counter"
category: "ai"
job: "Estimate token count and API cost for any prompt across all major models"
description: "Paste your prompt and get an instant token estimate plus the API input cost for Claude, GPT, and Gemini. Shows context window utilization for each model. Zero dependencies, client-side only."
aiSummary: "A client-side token estimation tool that approximates prompt token counts using the standard 4-chars-per-token heuristic and computes input API cost across Claude, GPT, and Gemini model families. Shows context window utilization percentage for each model."
personalUse: "Before I fire off a big context-stuffed prompt in a script, I paste it here to sanity-check the token count and make sure I'm not burning money on a prompt that's 90% boilerplate."
status: "active"
publishedAt: "2026-04-19"
lastVerified: "2026-04-19"
icon: "🔢"
license: "MIT"
---

## How this works

Paste your prompt or system message and get:

- **Estimated token count** — uses the 4-chars-per-token approximation, which is accurate to ±10% for typical English text with the cl100k-family tokenizers used by Claude and GPT
- **Context window utilization** — what percentage of each model's max context your prompt occupies
- **Input cost** — the API cost to send this prompt once as input, at current published prices

Pricing data is sourced from official provider pages and matches the [LLM Cost Calculator](/apps/llm-cost-calculator/).

## Token estimation accuracy

The 4-characters-per-token rule is a reasonable approximation for English prose. Accuracy varies by content type:

| Content type | Chars/token | Accuracy |
|---|---|---|
| English prose | ~4 | ±10% |
| Code (Python, JS) | ~3–3.5 | ±15% |
| JSON / structured data | ~3–4 | ±15% |
| Non-Latin scripts (Chinese, Japanese) | ~1.5–2 | ±25% |
| Whitespace-heavy content | ~5–6 | ±20% |

For exact counts, use the provider's official tokenizer: [Anthropic tokenizer](https://github.com/anthropics/anthropic-tokenizer-typescript), [OpenAI tiktoken](https://github.com/openai/tiktoken).

## Limitations

- **Estimation only** — actual token counts will differ slightly from the estimate. Use this for ballpark planning, not billing prediction.
- **Input tokens only** — output token cost depends on the model's response, which is unknown before the call. Use the [LLM Cost Calculator](/apps/llm-cost-calculator/) for full cost projections.
- **Pricing may lag** — prices are verified periodically. Check the source URLs for the latest rates.
