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

## What It Does

The Prompt Token Counter gives you an instant estimate of how many tokens your prompt contains and what it costs to send as input across Claude, GPT, and Gemini model families. It also shows context window utilization — what percentage of each model's maximum context your prompt already occupies.

This is a pre-flight tool for AI engineering. Before scripting a large-context call, running a batch job, or finalizing a system prompt for production, pasting it here tells you two things: whether it fits, and what it costs. Both matter more than most people realize until they hit a context limit at runtime or find an unexpected charge on their API bill.

## How to Use It

1. Paste your prompt, system message, or any text into the input area.
2. Read the **estimated token count** at the top.
3. Scan the **model table** — each row shows context window utilization percentage and per-call input cost.
4. If a model row is highlighted red or orange, your prompt is consuming a significant fraction of that model's context window.
5. Use the count to trim your prompt, then re-paste to verify.

For system prompts specifically: measure the system prompt alone first, then measure a typical user turn. The sum is your per-call input token floor.

## The Math / How It Works

**The 4-characters-per-token approximation** is the industry standard for quick estimation. Most tokenizers used by major LLM providers (BPE variants, cl100k, the Gemini SentencePiece variants) average close to 4 English characters per token for prose text. It's not exact — it's a heuristic that's accurate enough for planning.

Accuracy varies by content type:

| Content type | Chars/token | Accuracy |
|---|---|---|
| English prose | ~4 | ±10% |
| Code (Python, JS) | ~3–3.5 | ±15% |
| JSON / structured data | ~3–4 | ±15% |
| Non-Latin scripts (Chinese, Japanese) | ~1.5–2 | ±25% |
| Whitespace-heavy content | ~5–6 | ±20% |

Code tokenizes more cheaply (fewer chars per token) because identifiers, keywords, and operators each map to their own tokens. Non-Latin scripts tokenize more expensively — a single Chinese character often occupies 1.5–2 tokens, which can make multilingual prompts substantially more expensive than the character count suggests.

For exact counts: [Anthropic tokenizer](https://github.com/anthropics/anthropic-tokenizer-typescript) and [OpenAI tiktoken](https://github.com/openai/tiktoken) are the authoritative sources.

## Why AI Engineers Need This

Token count governs both cost and quality, and most people underestimate both risks.

**The cost angle** is obvious but often mistracked. A system prompt that's 6,000 tokens, sent with 1,000 user tokens per call, means 7,000 input tokens per API call. At 10,000 calls/day, that's 70M input tokens daily. The difference between Claude Haiku and Claude Sonnet pricing at that volume can be $500–$2,000/month — and trimming 30% of boilerplate from the system prompt saves proportionally.

**The quality angle** is less obvious. Models degrade as context fills up. The phenomenon — sometimes called "lost in the middle" — is well-documented: information in the middle of a long context window is retrieved less reliably than information at the start or end. A prompt that's using 80% of a model's context window is not getting 80% of peak performance. For RAG pipelines that stuff retrieved chunks into context, this matters a lot. Measuring utilization before production deployment is a basic quality check, not an optimization.

**System prompt optimization** is the highest-leverage use. A well-written system prompt might start at 3,000 tokens of instructions. After a few rounds of tightening — removing redundant phrasing, collapsing examples, eliminating defensive hedging — it might reach 1,800 tokens. Paste both versions here and see the cost difference across your projected call volume.

Pairs well with the [LLM Cost Calculator](/apps/llm-cost-calculator/) for projecting full monthly spend once you know your token volumes.

## Tips & Power Use

- **Measure your system prompt separately.** Paste only the system message, note the count, then paste only a typical user turn. This gives you your per-call token floor (system) and average increment (user).
- **High utilization warnings are real.** If a model is showing 70%+ utilization on your prompt, you're in the degraded-retrieval zone for long-context tasks. Either switch to a model with a larger window or reduce the context.
- **Non-English content needs special attention.** A CJK document that looks like 8,000 characters may tokenize to 12,000–16,000 tokens. Always measure before assuming.
- **Boilerplate inflation is the silent budget killer.** Common examples: verbose persona instructions, defensive disclaimers repeated multiple times, JSON schema examples with excessive fields. Measure the prompt before and after stripping these.
- **The context window utilization column is a decision tool.** If Claude Haiku is at 95% and Claude Sonnet is at 40% for the same prompt, you have a concrete reason to pay for the larger-context model.

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
