---
title: "Streaming Response Player"
category: "ai"
job: "Paste any LLM streaming log → replay it at 1× or 5×, see first-token latency, inter-token deltas, throughput."
description: "Free browser-based replay tool for LLM streaming responses. Paste an OpenAI / Anthropic / Bedrock SSE log → tool parses the events, replays them at original or accelerated speed, and reports first-token latency (TTFT), total stream duration, inter-token p50/p95 deltas, and approximate throughput. Auto-detects OpenAI chat-completions, Anthropic content-block-delta, ndjson, and bracketed-timestamp formats."
aiSummary: "Client-side streaming-log replayer. Parses LLM SSE / event-stream output from any major provider (OpenAI chat-completions delta format, Anthropic content_block_delta, Bedrock invocation events, generic ndjson). Calculates time-to-first-token, total stream time, token throughput, inter-token p50/p95 deltas. Replays at 0.5×/1×/2×/5×/instant. Exports a per-chunk CSV with timestamps and deltas. Use to debug perceived-slow streams, prove or disprove provider latency complaints, or A/B compare two endpoints' streaming behaviour."
personalUse: "I built this after spending an evening trying to figure out why our agent's streaming felt sluggish in production. The provider's status page was green. The total stream time was fine. The culprit was a 1.2-second TTFT on every request - invisible until you replay the log."
status: "active"
publishedAt: "2026-05-13"
icon: "▶️"
license: "MIT"
---

## What It Does

Paste a streaming log from any LLM API and this tool:
- Detects the format automatically (OpenAI SSE, Anthropic content-block-delta, Bedrock event-stream, generic ndjson, or bracketed-timestamp format)
- Reconstructs the chunk timeline
- Replays the response at 1× (real-time), 0.5×, 2×, 5×, or instant
- Reports **time-to-first-token** (TTFT), total stream duration, chunk count, approximate output tokens, throughput (tokens/sec), and inter-token p50 / p95 deltas

## When To Use It

- **"The API got slower" claims** - replay your saved logs side-by-side and prove (or disprove) it with hard numbers
- **TTFT regressions** - first-token latency hides inside the "looks fine" total stream time
- **Provider comparisons** - same prompt, different providers, see whose streaming is actually smoother
- **Demo prep** - record a fast streaming response, replay at 1× during a meeting

## Supported Log Formats

| Format | Example |
|---|---|
| OpenAI SSE | `data: {"choices":[{"delta":{"content":"hi"}}]}` |
| Anthropic SSE | `data: {"type":"content_block_delta","delta":{"text":"hi"}}` |
| Bedrock event-stream | `{"bytes":"<base64>"}` (auto-decoded best-effort) |
| Bracketed timestamp | `[12.456] {"delta":{"text":"hi"}}` |
| Generic ndjson | `{"text":"hi","ts":420}` |

The parser also handles `_ts` / `ts` / `timestamp` / `t` fields when present. If no timestamp is in the log, it falls back to 50ms-per-chunk spacing so you can still see relative ordering.

## What's NOT In Scope

- **Live capture from an API** - paste-only; live capture would need backend
- **Cost calculation** - see [Reasoning Token Cost Calculator](/apps/reasoning-cost-calculator/) and [LLM Cost Calculator](/apps/llm-cost-calculator/)
- **Tokenization** - see [Prompt Token Counter](/apps/prompt-token-counter/). Token counts here are approximate (whitespace-split).

## Related Tools

- [Reasoning Token Cost Calculator](/apps/reasoning-cost-calculator/) - what your stream actually costs
- [LLM Cost Calculator](/apps/llm-cost-calculator/) - direct-API pricing
- [Hyperscaler Pricing Comparison](/apps/hyperscaler-comparison/) - Bedrock vs Foundry vs Vertex
