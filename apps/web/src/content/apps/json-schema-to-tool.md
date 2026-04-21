---
title: "JSON Schema → LLM Tool Definition"
category: "ai"
job: "Convert any JSON Schema or OpenAPI operation into an OpenAI / Anthropic / Google tool/function definition — the three formats differ subtly"
description: "Paste a JSON Schema or OpenAPI operation object. Get back the equivalent tool definition for OpenAI Chat Completions, Anthropic Messages API, and Google Gemini all at once. Handles the per-provider quirks: OpenAI's strict schema rules, Anthropic's input_schema wrapper, Gemini's parameter type-coercion."
aiSummary: "A client-side converter that translates JSON Schema or OpenAPI operation objects into the tool/function calling formats used by OpenAI Chat Completions, Anthropic Messages, and Google Gemini APIs. Handles the format differences: OpenAI requires `function.parameters`, Anthropic uses `input_schema`, Gemini uses `function_declarations[].parameters` with restricted type set. Validates input as JSON, surfaces incompatibilities (e.g., Gemini doesn't support `additionalProperties`), and exposes side-by-side outputs for direct copy-paste into SDK calls."
personalUse: "When wiring up agentic workflows, I keep needing to convert the same schema between provider formats. Doing it by hand is error-prone — Anthropic wants `input_schema`, OpenAI wants `parameters`, Gemini doesn't support all JSON Schema features. This does it once, correctly, for all three."
status: "active"
publishedAt: "2026-04-20"
lastVerified: "2026-04-20"
companionPostSlug: ""
license: "MIT"
icon: "🔧"
---

## How this works

Each major LLM provider has its own format for tool/function calling. The schemas are *almost* the same but not quite — and the differences silently break tool calls when you migrate code between providers.

This tool takes a single JSON Schema input and emits all three formats side by side.

### The three formats

**OpenAI** (Chat Completions + Responses API):
```json
{
  "type": "function",
  "function": {
    "name": "get_weather",
    "description": "Get current weather",
    "parameters": { /* JSON Schema */ }
  }
}
```

**Anthropic** (Messages API):
```json
{
  "name": "get_weather",
  "description": "Get current weather",
  "input_schema": { /* JSON Schema */ }
}
```

**Google Gemini** (generateContent):
```json
{
  "function_declarations": [{
    "name": "get_weather",
    "description": "Get current weather",
    "parameters": { /* JSON Schema with type restrictions */ }
  }]
}
```

### Per-provider quirks the tool handles

| Quirk | OpenAI | Anthropic | Gemini |
|---|---|---|---|
| Wrapper key for params | `function.parameters` | `input_schema` | `function_declarations[].parameters` |
| `additionalProperties` | Required `false` in strict mode | Optional | **Not supported** (warns) |
| Enum types | Supported | Supported | Strings only |
| `$ref` | Supported | Supported | **Not supported** (warns) |
| `oneOf` / `anyOf` | Supported | Supported | **Not supported** (warns) |
| Strict mode | Opt-in via `strict: true` | Always strict | Always strict |
| Description position | `function.description` | top-level `description` | top-level `description` |

## What you can paste

The tool accepts:
- A bare JSON Schema (with `type`, `properties`, `required`)
- An OpenAPI 3.x operation object (with `operationId`, `summary`, `requestBody.content."application/json".schema`)
- A complete tool definition in any of the three provider formats (round-trips them)

## Why I built this

The amount of time I've wasted hand-translating schemas between OpenAI and Anthropic format is embarrassing. The format differences are all in the wrapper keys, but you don't notice them until your tool call returns "Function not callable" with no useful debug info.

Companion to the [Tokenizer Visualizer](/apps/tokenizer/) and [Prompt Token Counter](/apps/prompt-token-counter/) — together they cover the most common LLM-engineer prep tasks.

## Limitations

- **Doesn't generate the function implementation** — only the schema half of the tool call
- **No validation against the provider's runtime API** — emits the format; doesn't verify the API will accept it
- **OpenAPI parsing handles common cases** — complex `$ref` chains across files aren't resolved
- **No streaming format** — Gemini's streaming function call format is identical except for delta wrapping; not modeled here
