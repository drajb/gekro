---
title: "LLM Response Unpacker"
category: "ai"
job: "Paste any OpenAI, Anthropic, or Gemini API response and extract content, tokens, and cost"
description: "Paste a raw JSON response from any major LLM API and instantly extract the content, stop reason, token usage, tool calls, and compute an accurate cost estimate. Supports OpenAI, Anthropic Claude, and Google Gemini response formats."
aiSummary: "A client-side LLM API response parser that auto-detects provider format (OpenAI/Anthropic/Gemini), extracts content, stop reason, token counts, tool calls, and thinking blocks, then computes cost from hardcoded per-model pricing tables."
personalUse: "When debugging an agent pipeline, I'm constantly pasting raw API responses into jq or Python to fish out the content and token counts. This does it in one click."
status: "active"
publishedAt: "2026-04-24"
lastVerified: "2026-04-24"
companionPostSlug: ""
license: "MIT"
icon: "📦"
---

## What It Does

Paste any raw JSON API response from OpenAI, Anthropic Claude, or Google Gemini and this tool will:

1. **Auto-detect the provider** from the response schema — no manual selection required.
2. **Extract the content** — the main text output the model generated.
3. **Surface metadata**: stop reason, model name, creation timestamp, and system fingerprint.
4. **Show token usage**: input, output, total, and (where available) cached tokens.
5. **Show tool calls**: if the model requested a function call, each tool name and its arguments are rendered as formatted JSON.
6. **Show thinking blocks**: Claude's extended thinking content (when present) is extracted into its own section.
7. **Compute cost**: if the model ID is recognized, the cost of that specific API call is computed from the hardcoded pricing table. If not, a dropdown lets you pick the model family manually.

Everything runs client-side. Your response data is never sent anywhere.

## How to Use It

1. Copy a raw JSON response from your terminal, IDE, or API client. The response should be the complete JSON object as returned by the API — not a streamed chunk, not partial output.
2. Paste it into the input box. The tool parses and extracts on-the-fly as you type.
3. Use **Load OpenAI / Anthropic / Gemini example** buttons to see the tool in action without needing your own API key.
4. If the model is recognized (e.g., `gpt-4o-2024-08-06`, `claude-3-7-sonnet-20250219`), the cost estimate appears automatically.
5. If the model is not recognized, use the **Model family** dropdown in the cost section to select the closest match.
6. Use **Copy Result** to get the extracted content text — useful for pasting into docs or tickets.
7. Use **Export** to download the full extraction as a structured JSON file — useful for logging or archiving.

## The Three API Response Formats

The three major LLM providers use meaningfully different JSON schemas. Here is what each looks like:

### OpenAI

OpenAI's chat completion response wraps output in a `choices` array. Each choice has a `message` (for non-streaming) or `delta` (for streaming chunks). The main content lives at `choices[0].message.content`.

```json
{
  "id": "chatcmpl-abc123",
  "object": "chat.completion",
  "created": 1714000000,
  "model": "gpt-4o-2024-08-06",
  "system_fingerprint": "fp_abc123",
  "choices": [{
    "index": 0,
    "message": {
      "role": "assistant",
      "content": "The answer is 42.",
      "tool_calls": null
    },
    "finish_reason": "stop"
  }],
  "usage": {
    "prompt_tokens": 18,
    "completion_tokens": 7,
    "total_tokens": 25,
    "prompt_tokens_details": { "cached_tokens": 0 }
  }
}
```

Tool calls appear as `choices[0].message.tool_calls` — an array of objects with `function.name` and `function.arguments` (a JSON string).

### Anthropic

Anthropic's Messages API uses a `content` array at the top level. Each block has a `type`: `"text"` for main content, `"thinking"` for extended thinking blocks, `"tool_use"` for function calls. This flat content array is more extensible than OpenAI's single-field design.

```json
{
  "id": "msg_01XyZ",
  "type": "message",
  "role": "assistant",
  "model": "claude-3-7-sonnet-20250219",
  "content": [
    {
      "type": "thinking",
      "thinking": "Let me work through this step by step..."
    },
    {
      "type": "text",
      "text": "The answer is 42."
    }
  ],
  "stop_reason": "end_turn",
  "usage": {
    "input_tokens": 18,
    "output_tokens": 7,
    "cache_creation_input_tokens": 0,
    "cache_read_input_tokens": 0
  }
}
```

Tool calls appear as `content` blocks with `"type": "tool_use"`, containing `name` and `input` (an object, not a JSON string).

### Gemini

Google's Gemini API uses `candidates` at the top level. Each candidate has a `content.parts` array where text lives in `parts[0].text`. Function calls appear as parts with a `functionCall` key instead of `text`. Usage metadata is a separate top-level field.

```json
{
  "candidates": [{
    "content": {
      "parts": [{ "text": "The answer is 42." }],
      "role": "model"
    },
    "finishReason": "STOP",
    "index": 0
  }],
  "usageMetadata": {
    "promptTokenCount": 18,
    "candidatesTokenCount": 7,
    "totalTokenCount": 25
  },
  "modelVersion": "gemini-2.0-flash-001"
}
```

## Why Developers Need This

**Debugging agent pipelines.** When an agent makes an unexpected decision, the first step is reading the raw API response. Was it a tool call gone wrong? Did it hit `max_tokens`? Was content filtered? This tool answers those questions in seconds without needing `jq`, Python, or opening a console.

**Understanding token usage.** Token counts drive cost and latency. Developers often build intuitions like "a typical request costs N tokens" without ever measuring. Pasting real responses here builds calibration quickly.

**Catching streaming vs. non-streaming issues.** Streaming responses (`"object": "chat.completion.chunk"` for OpenAI) have different schemas than non-streaming ones. If you accidentally paste a streaming chunk instead of a complete response, the parser will flag the content as empty — which tells you something went wrong in your client code.

**Comparing providers on the same workload.** Run the same prompt through OpenAI and Anthropic, paste both responses here, and see the token counts and costs side by side. The schema differences become obvious and the relative cost/quality tradeoffs surface immediately.

## Understanding Stop Reasons

Every provider signals why generation ended via a stop reason field. The field name and values differ by provider:

| OpenAI `finish_reason` | Anthropic `stop_reason` | Gemini `finishReason` | Meaning |
|---|---|---|---|
| `stop` | `end_turn` | `STOP` | Model finished naturally — response is complete |
| `length` | `max_tokens` | `MAX_TOKENS` | Hit the token limit — response may be truncated |
| `tool_calls` | `tool_use` | `(see function_call part)` | Model wants to call a function |
| `content_filter` | `(varies)` | `SAFETY` | Output blocked by content policy |
| `null` | `stop_sequence` | — | Matched a user-specified stop sequence |

**`length` / `max_tokens` is the most dangerous stop reason in production.** It means the model was mid-sentence when it hit your token ceiling. If your application treats the response as complete in this case, you will silently serve truncated output to users. Always handle this explicitly in your code.

**`tool_calls` / `tool_use`** is not an error — it means the model is requesting a tool call. Your agent loop should detect this, execute the tool, and send the result back as a follow-up message.

## Cost Calculation Methodology

Cost is computed as:

```
cost = (input_tokens / 1,000,000) × price_per_million_input
     + (output_tokens / 1,000,000) × price_per_million_output
```

Pricing data is hardcoded in the tool and updated manually. The table covers OpenAI (o3, o4-mini, GPT-4o, GPT-4o mini, GPT-4 Turbo, GPT-3.5 Turbo), Anthropic (Claude Opus 4, Claude 3.7 Sonnet, Claude 3.5 Sonnet/Haiku, Claude 3 family), Google (Gemini 2.5 Pro, 2.0 Flash, 1.5 Pro/Flash), DeepSeek (R1, V3), and Mistral (Large, Small, Mixtral 8x22B).

**Cached token discounts are not applied automatically.** If a provider offers prompt caching at a discounted rate (Anthropic's cache read tokens are billed at ~10% of standard input rates), the displayed cost uses standard rates for all input tokens. The cached token count is shown separately so you can estimate the discount manually.

**Batch API discounts are not applied.** OpenAI and Anthropic both offer ~50% discounts for async batch requests. If your response came from a batch job, the displayed cost is approximately 2× the actual bill.

**Self-hosted models show no cost.** Open-weight models (Llama, Mistral self-hosted) are excluded from the pricing table because cost depends entirely on your hardware, electricity, and amortization assumptions. Use the [LLM Cost Calculator](/apps/llm-cost-calculator/) for that.

## Limitations

- **Streaming responses are not supported.** Paste a complete, non-streaming response. Streaming chunks have incomplete schemas and do not contain final token counts.
- **Model ID matching is substring-based.** If the model ID in your response does not contain a recognized substring, it falls back to the manual picker. This can happen with fine-tuned model IDs (`ft:gpt-4o:org:custom:abc123`) or provider-specific aliases.
- **Pricing data drifts.** Model prices change — sometimes with very short notice. The rates displayed are current as of April 2026. Verify against official provider pricing pages before making financial decisions.
- **Multimodal input costs are not computed.** Image tokens (for vision models) are priced differently from text tokens and require knowing the image resolution. This tool only uses the text token counts as reported by the API.
- **Anthropic batch API responses** have a slightly different wrapper schema. If you paste a batch result file entry, extract the inner `result.message` object before pasting.
