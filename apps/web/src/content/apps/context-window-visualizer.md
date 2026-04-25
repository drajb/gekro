---
title: "Context Window Visualizer"
category: "ai"
job: "Paste a conversation. See exactly what fits in 8K / 32K / 128K / 200K windows — and which truncation strategy preserves the most"
description: "Drop in a multi-turn conversation (system + user/assistant pairs). The tool shows what fits in each context window, color-codes by message role, and simulates four truncation strategies (drop oldest, summarize prefix, sliding window, keep last N) so you can see which preserves the most relevant history before you hit the wall."
aiSummary: "A client-side context window visualizer for multi-turn LLM conversations. Parses ChatML-style conversations (system / user / assistant turns), estimates per-message tokens via cl100k_base pre-tokenization, and shows fit against 8K/32K/128K/200K windows. Simulates four truncation strategies — drop oldest, summarize prefix, sliding window, keep first+last — and shows the resulting message stack for each. Built for iterating on long-running agent loops where context pressure determines which messages survive."
personalUse: "When my agent loops start dropping past context window limits, I want to see which messages are being sacrificed and whether a different truncation policy would keep the important ones. This shows the trade-off concretely instead of by intuition."
status: "active"
publishedAt: "2026-04-20"
lastVerified: "2026-04-20"
companionPostSlug: ""
license: "MIT"
icon: "📏"
---

## What It Does

Context Window Visualizer takes a multi-turn conversation and shows you exactly how it fills different context windows. Each message is sized proportionally by its token count and color-coded by role. Four truncation strategies are simulated — showing which messages survive when the conversation exceeds a given window size. The goal is to make context window management a visual exercise, not a guesswork one.

## How to Use It

1. Paste a conversation in either plain text or JSON (ChatML) format.
2. The tool estimates per-message token counts using cl100k_base pre-tokenization.
3. The message stack visualization shows which messages fit in each window size (8K, 32K, 128K, 200K, 1M).
4. For windows where the conversation exceeds the limit, four truncation strategies are simulated — see which messages survive under each strategy.
5. Pick the strategy that preserves the messages your application most needs.

**Input formats accepted:**

Plain text:
```
SYSTEM: You are a helpful assistant.

USER: What's the capital of France?

ASSISTANT: Paris.

USER: And of Germany?
```

JSON (ChatML):
```json
[
  { "role": "system", "content": "You are..." },
  { "role": "user", "content": "What's..." },
  { "role": "assistant", "content": "Paris." }
]
```

## Truncation Strategies Simulated

| Strategy | What gets cut | Best for |
|---|---|---|
| **Drop oldest** | Earliest messages first (after system prompt) | Simple chatbots where recency dominates |
| **Summarize prefix** | Replace early turns with a compressed summary | Long agent loops with consistent goals |
| **Sliding window (keep last N)** | Everything except last N turns + system prompt | Conversation where only recent context matters |
| **Keep first + last** | Middle turns; preserves early examples + recent history | Few-shot prompts in early turns |

Each strategy shows the resulting token total and which messages were kept vs. dropped. There's no universally correct strategy — the right choice depends on what information is most important to preserve.

## The Context Window Management Problem

This is one of the most consistently underestimated challenges in long-running LLM applications. Here's the actual scale of the problem with real numbers:

**200K tokens sounds enormous.** Claude 3.5 Sonnet has a 200K context window. That sounds like you can fit everything. But consider a real long-running agent loop:

- System prompt: 2,000 tokens
- Per-turn user message: 300 tokens average
- Per-turn assistant response: 500 tokens average
- Per-turn tool call + result: 400 tokens average
- **Total per turn: ~1,200 tokens**

At that rate, 200K tokens = approximately 166 turns. A complex multi-step task that runs 200 agent turns will hit the context limit. And that's before you consider that many real agent loops include much heavier messages — file contents, API responses, search results, code outputs.

**In practice, most production agents start hitting context pressure around turn 50–100.** The question is not "will I hit the limit?" but "what happens when I do, and how do I design for it?"

## Why Truncation Strategy Determines Quality Degradation Pattern

When you hit the context limit, *something* has to be dropped. The default behavior in most frameworks and APIs is "drop oldest messages first." This default is frequently wrong, and understanding why matters for agent design.

**What drop-oldest destroys:**
- The system prompt's detailed instructions (often in early turns or a long system message)
- Few-shot examples provided at the start of the conversation
- Early tool-call results that established key facts the agent is still relying on
- The original task description, which the agent needs to stay on track

When these are dropped, the agent starts generating responses that drift from its original behavior, lose track of established facts, and eventually confabulate. This looks like model degradation or prompt sensitivity, but it's actually context management failure.

**Summarize-prefix is the best general approach** for agents with consistent long-term goals. The strategy: when context exceeds the limit, call the model one more time with the early turns and the instruction "summarize the progress so far, key decisions made, and current state in 500 tokens." Replace those early turns with the summary. The agent retains a compressed version of its history and continues with context to spare.

The downside: summarization is a separate LLM call (latency + cost). For latency-sensitive applications, sliding window or keep-first+last may be acceptable tradeoffs.

**Keep-first+last** is the right strategy when early turns contain high-value, long-lived information (detailed instructions, few-shot examples, reference data) and recent turns contain the active task state. Middle turns — often transitional back-and-forth — are safely dropped.

## Real Numbers on Context Filling Speed

| Content type | Tokens per unit | 128K window fills in |
|---|---|---|
| Average chatbot exchange (user+assistant) | ~200 tokens | 640 exchanges |
| Agent loop with tool calls | ~1,200 tokens/turn | ~107 turns |
| Agent with file attachment (~5 pages) | ~4,000 tokens/turn | ~32 turns |
| Agent with code generation + review | ~3,000 tokens/turn | ~43 turns |
| RAG with top-3 retrieved chunks (512 tokens each) | ~2,000 tokens per query | ~64 queries |

128K context is generous for interactive chat. For agents doing real work — reading files, generating code, making tool calls — 128K fills in 30–100 turns. Plan for context pressure from the design phase, not as an afterthought.

## Tips & Power Use

- **Paste your actual agent loop conversation,** not a toy example. The token count distribution across message types is what determines your real pressure point.
- **The message stack visualization** shows at a glance which message types dominate token usage. If tool call results are 60% of your context, that's where to optimize — summarizing or truncating tool results.
- **Use alongside the [Tokenizer Visualizer](/apps/tokenizer/)** to understand why a specific message is costing so many tokens. Long URLs, verbose JSON, redundant preambles — the tokenizer shows you where the waste is.
- **The "keep first + last" strategy** is underused. For prompts with rich few-shot examples, preserving the examples while dropping middle turns is almost always better than dropping oldest-first.
- **Summarization compression ratio** — the tool estimates ~3:1 compression for summarization (500 tokens of summary replacing 1,500 tokens of conversation). Real compression depends heavily on conversation content; dense technical content compresses less than conversational back-and-forth.

## Limitations

- **Token estimates are approximate** — uses cl100k_base pre-tokenization, ±10% for English. Use the [Tokenizer Visualizer](/apps/tokenizer/) for per-token detail
- **Summarization is simulated** — doesn't actually call an LLM to summarize; estimates ~3:1 compression and shows the hypothetical impact
- **Tool-call messages not deeply modeled** — treats `tool` role as `assistant` for token accounting purposes
- **No streaming support** — the visualizer works on static conversation snapshots, not live streaming conversations
