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

## How this works

Paste a conversation in ChatML-style format. The tool:

1. **Parses each message** by role (`system`, `user`, `assistant`) and counts tokens
2. **Shows fit** against each major context window: 8K, 32K, 128K, 200K, 1M
3. **Visualizes the message stack** with each message sized by token count
4. **Simulates four truncation strategies** when the conversation exceeds a window — shows which messages survive

## Truncation strategies covered

| Strategy | When to use | What gets cut |
|---|---|---|
| **Drop oldest** | Default in most chat APIs | Earliest messages first (after system prompt) |
| **Summarize prefix** | Long agent loops with consistent goals | Replace early turns with an LLM-generated summary |
| **Sliding window (keep last N)** | Conversation where recency matters most | Everything except the last N turns + system prompt |
| **Keep first + last** | Few-shot examples in early turns + recent context | Drops middle turns; preserves examples and recent history |

Each strategy shows the resulting token total + which messages were dropped. Pick the strategy that keeps the messages you care about.

## Input format

Paste in either of these formats:

**Plain text (auto-parsed)**
```
SYSTEM: You are a helpful assistant.

USER: What's the capital of France?

ASSISTANT: Paris.

USER: And of Germany?
```

**JSON (ChatML)**
```json
[
  { "role": "system", "content": "You are..." },
  { "role": "user", "content": "What's..." },
  { "role": "assistant", "content": "Paris." }
]
```

## Why I built this

Long-running agent loops eventually run into context pressure. The default behavior (drop oldest) silently throws away the system prompt's reasoning anchors, the few-shot examples, the early tool-call results — and the agent starts confabulating. Picking a truncation strategy is one of the most impactful decisions in long-context agent design, but it's almost never visualized.

This makes it visualizable.

## Limitations

- **Token estimates are approximate** — uses cl100k_base pre-tokenization, ±10% for English. Use the [Tokenizer Visualizer](/apps/tokenizer/) for the per-token detail
- **Summarization is simulated** — doesn't actually call an LLM to summarize; estimates that summarization compresses ~3:1 and shows the impact
- **Tool-call messages not deeply modeled** — treats `tool` role as `assistant` for accounting
