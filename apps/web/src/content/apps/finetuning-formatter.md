---
title: "Fine-tuning Dataset Formatter"
category: "ai"
job: "Convert Q&A pairs into JSONL training data for OpenAI, Axolotl, ShareGPT, and Unsloth"
description: "Format multi-turn conversations into fine-tuning JSONL for any major training framework. Supports OpenAI fine-tuning, Alpaca, ShareGPT, and Unsloth/Llama formats. Add turns interactively, preview output live, and export with one click."
aiSummary: "A client-side fine-tuning dataset formatter that converts multi-turn conversations into JSONL training data. Supports OpenAI fine-tuning format, Alpaca JSON, ShareGPT JSONL, and Unsloth/Llama chat template format. Zero dependencies, export with one click."
personalUse: "Every time I'm collecting examples to fine-tune a model, I end up fighting with format inconsistencies. This takes the raw Q&A pairs I've been collecting and spits them out in whichever schema the framework expects."
status: "active"
publishedAt: "2026-04-24"
lastVerified: "2026-04-24"
companionPostSlug: ""
license: "MIT"
icon: "🗃️"
---

## What It Does

Paste your conversation turns — system prompt, user messages, assistant responses — and the formatter outputs a properly structured JSONL or JSON record in whichever training format your fine-tuning framework expects. It handles four schemas: OpenAI's chat fine-tuning format, Alpaca's instruction-response JSON, ShareGPT's conversation JSONL, and the Unsloth/Llama variant. Live preview updates as you type. One-click export drops a ready-to-use `.jsonl` or `.json` file.

It also catches the mistakes that cause silent training failures: missing user turns, missing assistant turns, multiple system messages, and Alpaca's single-turn constraint.

## How to Use It

1. **Add turns** using the `+ User`, `+ Assistant`, and `+ System` buttons. Each row has a role selector and a content textarea that auto-resizes.
2. **Select a format** from the four tabs. The output updates immediately.
3. **Watch the stats bar** — it shows turn count, estimated token count, and character count across all turns.
4. **Fix any warnings** shown in amber — these flag structural issues that will cause training problems.
5. **Copy or export** the output. The Copy button copies the current output to clipboard. Export downloads a `.jsonl` file (or `.json` for Alpaca).

To build a full training dataset, format each example one at a time and append the output lines to your `.jsonl` file. One line per training example.

## The Formats Explained

| Format | File Type | Role Labels | Multi-turn? | Best For |
|---|---|---|---|---|
| **OpenAI (JSONL)** | `.jsonl` | `system`, `user`, `assistant` | Yes | OpenAI fine-tuning API (gpt-3.5-turbo, gpt-4o-mini) |
| **Alpaca (JSON)** | `.json` | `instruction`, `input`, `output` | No — single turn | LLaMA/Alpaca trainers, many HuggingFace scripts |
| **ShareGPT (JSONL)** | `.jsonl` | `system`, `human`, `gpt` | Yes | LLaMA-Factory, Axolotl, Open-Hermes style datasets |
| **Unsloth/Llama** | `.jsonl` | `system`, `human`, `gpt` | Yes | Unsloth trainer — add chat template separately |

### OpenAI format
The canonical format for OpenAI's supervised fine-tuning API. Each JSONL line is a `{"messages": [...]}` object where each message has `role` and `content`. System messages are optional but heavily influence behaviour. You upload your `.jsonl` to the OpenAI fine-tuning endpoint; they handle batching and training.

### Alpaca format
Originally from the Stanford Alpaca paper (2023). A flat JSON object with three keys: `instruction` (the user's task), `input` (optional context), and `output` (the target response). Many HuggingFace training scripts default to this format because of its simplicity. The downside: it's single-turn by design. Multi-turn conversations don't fit cleanly. This formatter collapses them and warns you.

### ShareGPT format
The format used by datasets like Open-Hermes and LLaMA-Factory's data pipeline. A `{"conversations": [...]}` object where each turn uses `from: "human"` or `from: "gpt"` instead of the OpenAI role names. This is the de-facto standard for community fine-tuning datasets on HuggingFace.

### Unsloth/Llama format
Structurally identical to ShareGPT. Unsloth's `FastLanguageModel` reads the same `conversations` schema. The difference is downstream: you apply a chat template (Llama-3 or ChatML) via `get_chat_template()` before training, which inserts the model-specific special tokens. The raw JSONL you export here does not include those tokens — that's intentional.

## Why AI Engineers Need This

Fine-tuning is one of the most format-sensitive operations in the ML stack. Every framework has a slightly different JSON schema, different role name conventions, different line-ending requirements. The diff between `"role": "user"` (OpenAI) and `"from": "human"` (ShareGPT) is trivial to a human but catastrophic to a training script — it will either crash with a key error or silently produce a dataset where every example has empty assistant turns.

The pain compounds when you're collecting training examples from multiple sources: some from ChatGPT exports (which use OpenAI format), some from manual annotation, some from synthetic generation scripts that output Alpaca, some from HuggingFace datasets in ShareGPT format. Normalising all of this by hand is tedious and error-prone.

Common mistakes this tool helps avoid:

- **Swapped role names**: `assistant` vs `gpt` vs `output` — these cause silent data corruption, not parser errors, so you don't find out until eval
- **Missing system turn**: System messages are optional in the schema but heavily influence fine-tuned behaviour; forgetting them produces a model that ignores system prompts at inference time
- **Multiple system messages**: Only one system message per conversation is valid in most frameworks; extras are silently dropped or cause training loss spikes
- **Single-turn Alpaca with multi-turn data**: The Alpaca format only has one instruction/output pair. Using it for multi-turn data loses all but the first exchange

## Building a Good Dataset

The format is the easy part. The hard part is the data quality. A few principles that hold across all four formats:

**Diversity over volume.** 100 examples covering 50 different task types train better than 500 examples of the same type. Models learn patterns, not memorization. Repetitive data trains the model to be repetitive.

**Match your inference distribution.** If your system prompt at inference time starts with "You are a concise assistant who replies in JSON", your training examples should use the same system prompt. Fine-tuning on conversations without a system prompt produces a model that ignores system prompts.

**Assistant turns should be your target output, not your current model's output.** If you generate training data by running GPT-4 and using its responses as ground truth, you're distilling GPT-4. That's a valid use case (knowledge distillation), but be deliberate about it.

**Keep conversations short per example.** Long multi-turn conversations create long context windows during training, which increases batch memory usage and training time. Prefer 2–5 turn conversations. If your use case involves long conversations, include a representative sample, not every possible length.

**Include failure cases.** If you want the model to refuse certain requests gracefully, include examples of refusals. The model learns what the assistant does in context — it needs to see refusals to produce them.

**Validate with actual training before scaling.** Run 10–20 examples through your training script before generating thousands. Catch format errors early.

## Limitations

- **One example at a time** — this is a formatter, not a dataset manager. It formats one conversation record per session. To build a 1,000-example dataset, use it to verify your format and then automate generation.
- **Token estimates are approximate** — the cl100k_base regex used here is a close approximation of OpenAI's tokenizer but not exact. For billing-sensitive calculations, use the official `tiktoken` library.
- **No deduplication** — does not check if the conversation you're formatting already exists in your dataset.
- **Alpaca single-turn collapse is lossy** — when you switch to Alpaca format with a multi-turn conversation, turns after the first are discarded. Switch back to OpenAI or ShareGPT for multi-turn data.
- **No validation of assistant quality** — warns on structural issues (missing turns, empty content) but cannot assess whether the assistant turn is a good training target.
