---
title: "LLM API Request Builder"
category: "ai"
job: "Configure a chat request visually and copy a working curl, Python, or TypeScript snippet for Anthropic, OpenAI, or Gemini"
description: "Point-and-click your model, system prompt, message, sampling, streaming, JSON mode, tools, and provider-specific extras (Anthropic prompt caching and extended thinking, OpenAI reasoning effort) - then copy a correct, ready-to-run curl / Python / TypeScript snippet. The three providers disagree on almost every field name and payload shape; this gets them right. Your key is never entered here."
aiSummary: "A client-side request builder that generates correct curl, Python SDK, and TypeScript SDK code for the Anthropic Messages API, OpenAI Chat Completions API, and Google Gemini API from one visual form. It handles the real cross-provider differences - header names, system-prompt placement, tool schema shape, streaming, JSON mode, prompt caching, extended thinking, reasoning effort - and always references the API key as an environment variable, never as an input."
personalUse: "I switch between Anthropic, OpenAI, and Gemini constantly and I can never remember which one wants the system prompt at the top level versus in the messages array, whether tools use input_schema or parameters, or how streaming differs per SDK. Instead of re-reading three sets of docs, I dial the request in once and copy the exact snippet. It doubles as the reference I check when a payload silently gets ignored."
status: "active"
publishedAt: "2026-07-05"
lastVerified: "2026-07-05"
companionPostSlug: ""
license: "MIT"
icon: "🛠️"
---

## What It Does

The three big LLM APIs do the same job with almost none of the same field names. Anthropic puts the system prompt at the top level; OpenAI puts it as the first message; Gemini calls it `systemInstruction`. Tools are `input_schema` here, `parameters` there, `functionDeclarations` somewhere else. Streaming, JSON output, and token limits each have three spellings.

This tool lets you configure a request once in a plain form and emits a correct, runnable snippet in curl, Python (official SDK), or TypeScript (official SDK) for whichever provider you pick. It is the reference you reach for when a parameter is being silently ignored.

## What It Covers

- **Model, system prompt, user message, max tokens, temperature.**
- **Streaming** - with the correct per-SDK consumption loop (Anthropic's event stream, OpenAI's chunk deltas, Gemini's stream iterator).
- **JSON output** - `response_format` for OpenAI, `responseMimeType` for Gemini.
- **Tools** - each provider's function-definition shape, generated from one JSON array you paste.
- **Provider extras** - Anthropic prompt caching (`cache_control` on the system block) and extended thinking (`budget_tokens`); OpenAI reasoning effort.

## The Key Rule

There is no field for your API key, and there never will be. The snippets reference the standard environment variable (`$ANTHROPIC_API_KEY`, `$OPENAI_API_KEY`, `$GEMINI_API_KEY`), which the SDKs read automatically. Nothing you type is transmitted anywhere; the whole tool runs in your browser.

Pairs with the [LLM Cost Calculator](/apps/llm-cost-calculator/) (what the request will cost) and the [Prompt Cache Optimizer](/apps/prompt-cache-optimizer/) (whether caching is worth it).

## Limitations

- **Chat-shaped requests.** It builds single-turn chat/messages calls. Multi-turn histories, the OpenAI Responses API, batch, files, and the assistants/agents endpoints are out of scope.
- **A curated model list, verified on the date shown.** Provider model names change; check the label date and swap the model string if a newer one shipped.
- **Snippets are a starting point.** They are correct for the shapes above, but you should read your provider's docs for the exact current parameter surface before shipping to production. Model IDs and parameter names move.
