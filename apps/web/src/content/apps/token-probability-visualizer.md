---
title: "Token Probability Visualizer"
category: "ai"
job: "Paste a logprobs-enabled LLM response → see top-K alternative tokens at every position with their probabilities, colour-coded by uncertainty."
description: "Free browser-based visualizer for LLM logprobs. Paste any OpenAI-format logprobs response (or raw logprobs array) → tool renders the response token by token, colour-coded by how confident the model was. Click any token to see the top-K alternatives with their log-probabilities and percent likelihoods. Mean / median / most-uncertain stats per response. Educational for prompt engineers, debugging tool for unexpected outputs, evaluation aid for model comparisons."
aiSummary: "Interactive visualizer for LLM token probabilities (logprobs). Accepts OpenAI chat-completion `logprobs.content` shape, raw logprobs arrays, or Anthropic top-tokens. Renders the model's output as a clickable token stream colour-coded into 5 confidence buckets (green = >85%, red = <15%). Selecting a token shows its top-K alternatives with both percent-probability and raw log-probability. Computes mean/median per-token probability, identifies the most-uncertain token, and reports sequence log-probability (useful for prompt comparison). CSV export of full per-token data."
personalUse: "I built this after staring at one of those huge logprobs JSON blobs in the OpenAI playground and realising I couldn't actually SEE the uncertainty. This is the visualization I wanted."
status: "active"
publishedAt: "2026-05-13"
icon: "🎯"
license: "MIT"
---

## What It Does

LLMs are probability distributions over tokens. At every position the model picks one token from many candidates with different likelihoods. **logprobs** is the request flag that exposes those probabilities. This tool turns that data into a visualization:

- **Token stream**: each token in the response is colour-coded — green where the model was very confident (>85%), red where it was guessing (<15%)
- **Click any token**: see the top-K alternatives the model considered, with their probabilities
- **Stats panel**: mean / median per-token probability, most-uncertain token, total sequence log-probability

## How To Use

1. Make an LLM call with `logprobs: true` and `top_logprobs: N` (most providers support N up to 20)
2. Copy the response JSON
3. Paste it here
4. Hover or tap tokens to inspect alternatives

## When It's Useful

- **Hallucination detection** — low-confidence tokens in factual claims are red flags
- **Prompt comparison** — same prompt, two different system messages — compare mean probabilities
- **Few-shot debugging** — see which example influenced the model and where confidence drops
- **Evaluation** — sequence log-probability is a standard scoring metric for prompt-quality comparison
- **Education** — actually SEE what "the model considered" instead of just imagining it

## Supported Formats

- OpenAI: full chat-completion response with `choices[0].logprobs.content`
- Raw OpenAI logprobs: just the `content` array
- Anthropic: where top-tokens are exposed
- Generic: `[{ token, logprob, top_logprobs: [{token, logprob}] }]`

The parser auto-detects which shape you pasted.

## What's NOT In Scope

- **Embedding visualization** — see [Tokenizer](/apps/tokenizer/) for byte/token splits
- **Token cost** — see [LLM Cost Calculator](/apps/llm-cost-calculator/) and [Reasoning Cost Calculator](/apps/reasoning-cost-calculator/)
- **Live API calls** — paste-only, no backend

## Related Tools

- [Tokenizer](/apps/tokenizer/) — see token boundaries
- [Prompt Token Counter](/apps/prompt-token-counter/) — count before sending
- [System Prompt Linter](/apps/system-prompt-linter/) — catch prompt issues
