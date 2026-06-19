---
title: "Chat Template Builder"
category: "ai"
job: "Compose a system/user/assistant conversation and see the exact prompt string each model family receives - special tokens and all"
description: "Build a chat conversation (system, user, assistant turns) and instantly see the exact formatted prompt string for Llama 3, ChatML (GPT/Qwen), Mistral, Gemma, and Phi-3 - with every special token (<|im_start|>, <|eot_id|>, [INST], <start_of_turn>, etc.) shown in place. Toggle the generation prompt to get a string that's ready for the model to continue. Pure client-side, nothing leaves the browser."
aiSummary: "A client-side chat template builder that turns a system/user/assistant message array into the exact prompt string each model family expects. Supports Llama 3, ChatML (OpenAI/Qwen/Yi), Mistral/Mixtral, Gemma, and Phi-3, rendering all special tokens explicitly and optionally appending the assistant generation prompt."
personalUse: "When I'm wiring up a local model in llama.cpp or Ollama and the output looks slightly off, nine times out of ten it's the chat template - a missing <|eot_id|> or the system prompt folded into the wrong place. I built this so I can paste my turns, flip between families, and see the literal bytes the model will read, instead of guessing from a half-remembered Hugging Face model card."
status: "active"
publishedAt: "2026-06-19"
lastVerified: "2026-06-19"
companionPostSlug: ""
license: "MIT"
icon: "💬"
---

## What It Does

Every instruction-tuned model expects its conversation wrapped in a specific format - a set of special tokens that mark where each turn starts and ends, who is speaking, and where the model should begin generating. Get that format wrong and the model still produces text, but quality quietly degrades: it ignores the system prompt, runs past where it should stop, or treats your instructions as content to echo.

This tool makes the format visible. Compose a conversation with system, user, and assistant turns, pick a model family, and see the exact string that family's tokenizer would receive - special tokens and all.

## How to Use It

1. Edit the message rows - pick a role (system / user / assistant) and type the content. Add or remove turns as needed.
2. Choose a template family: ChatML, Llama 3, Mistral, Gemma, or Phi-3.
3. Read the formatted output. Special tokens are highlighted so you can see exactly where each turn begins and ends.
4. Leave "Add generation prompt" on to append the assistant priming tokens - the string is then ready to hand to a model for completion.
5. Copy the raw string (without highlighting) or download it.

## The Families

- **ChatML** - used by OpenAI models, Qwen, Yi, and many fine-tunes. `<|im_start|>role` / `<|im_end|>` markers.
- **Llama 3** - Llama 3, 3.1, 3.2 Instruct. `<|begin_of_text|>`, header blocks, `<|eot_id|>` turn terminators.
- **Mistral / Mixtral** - `[INST] ... [/INST]` instruction blocks. No dedicated system role, so the system prompt is folded into the first user turn (exactly as the official template does it).
- **Gemma** - `<start_of_turn>` / `<end_of_turn>` with the assistant role renamed to `model`. No system role - system content is folded into the first user turn.
- **Phi-3** - `<|system|>` / `<|user|>` / `<|assistant|>` markers with `<|end|>` terminators.

## What This Is and Isn't

This renders the chat template - the turn-structure wrapping. It does not run the BPE tokenizer, so the per-token breakdown lives in the companion [Tokenizer](/apps/tokenizer/). For exact behavior on a specific checkpoint, the model's own `tokenizer_config.json` (its `chat_template` Jinja string) is always the final authority - vendors occasionally tweak these between releases. The templates here match the documented format for each family as of the last-verified date.

## Limitations

- **Five families** - the most common ones. Less common formats (Alpaca, Vicuna, Zephyr, command-r) are not included.
- **No tool/function-call formatting** - this covers plain chat turns, not the tool-call block syntax some models layer on top.
- **Template, not tokenizer** - token counts are approximate (characters / 4); use the Tokenizer for real counts.
