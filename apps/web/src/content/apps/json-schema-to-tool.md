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

## What It Does

JSON Schema → LLM Tool Definition takes a JSON Schema (or OpenAPI operation object) and converts it into the tool/function calling format for all three major LLM providers simultaneously — OpenAI, Anthropic, and Google Gemini. The formats look similar but differ in key ways that silently break tool calls when you migrate code. This tool handles the differences and flags incompatibilities inline.

## How to Use It

1. Paste a JSON Schema object, an OpenAPI 3.x operation, or an existing tool definition from any of the three providers.
2. The tool validates the input as JSON and surfaces any parse errors immediately.
3. Three output panels appear side by side: OpenAI format, Anthropic format, Gemini format.
4. Any provider-specific incompatibilities (features your schema uses that a provider doesn't support) are flagged with explanations.
5. Copy the output for each provider you need.

## The Three Formats

**OpenAI** (Chat Completions + Responses API):
```json
{
  "type": "function",
  "function": {
    "name": "get_weather",
    "description": "Get current weather for a location",
    "parameters": {
      "type": "object",
      "properties": {
        "location": { "type": "string" },
        "unit": { "type": "string", "enum": ["celsius", "fahrenheit"] }
      },
      "required": ["location"],
      "additionalProperties": false
    },
    "strict": true
  }
}
```

**Anthropic** (Messages API):
```json
{
  "name": "get_weather",
  "description": "Get current weather for a location",
  "input_schema": {
    "type": "object",
    "properties": {
      "location": { "type": "string" },
      "unit": { "type": "string", "enum": ["celsius", "fahrenheit"] }
    },
    "required": ["location"]
  }
}
```

**Google Gemini** (generateContent):
```json
{
  "function_declarations": [{
    "name": "get_weather",
    "description": "Get current weather for a location",
    "parameters": {
      "type": "object",
      "properties": {
        "location": { "type": "string" },
        "unit": { "type": "string", "format": "enum", "enum": ["celsius", "fahrenheit"] }
      },
      "required": ["location"]
    }
  }]
}
```

## Per-Provider Quirks the Tool Handles

| Quirk | OpenAI | Anthropic | Gemini |
|---|---|---|---|
| Wrapper key for schema | `function.parameters` | `input_schema` | `function_declarations[].parameters` |
| `additionalProperties` | Required `false` in strict mode | Optional, allowed | **Not supported** — removed with warning |
| Enum types | Supported | Supported | Strings only — non-string enums coerced |
| `$ref` | Supported | Supported | **Not supported** — referenced schemas must be inlined |
| `oneOf` / `anyOf` | Supported | Supported | **Not supported** — flagged with explanation |
| Strict mode | Opt-in via `strict: true` | Always strict | Always strict |
| Description key position | `function.description` | top-level `description` | top-level `description` |

## Why Tool Schemas Are the Function Calling Ecosystem

LLM function calling (also called tool use) is how LLMs take actions in the real world. Instead of just generating text, a model can emit a structured JSON object requesting that a function be called with specific arguments — and your code can actually call that function and return the result to the model. This is the core mechanism behind agents.

All three major providers support this. The model receives a list of tool definitions (schema + description), generates text or a tool call request, your code runs the requested tool, and the result is fed back into the next model call. The model can then call more tools or generate a final response.

The schema you provide does two things: it tells the model *what arguments are available* (schema validation), and it tells the model *when to call this tool and why* (the description). Both matter. A tool with a clear, specific description gets called at the right moments. A tool with a vague description gets ignored or called with wrong arguments.

## What `strict: true` Means in OpenAI (And Why It Matters)

OpenAI's Structured Outputs feature, enabled via `strict: true` on a tool definition, guarantees that the model's function call arguments will be valid JSON that strictly matches the provided schema — no extra fields, no schema violations. Without `strict: true`, the model is strongly prompted to follow the schema but not guaranteed.

The implications for reliability are significant. In a production agent that calls tools in a loop, a single malformed tool call can break the agent's action chain. With `strict: true`, you get a hard guarantee that the arguments are schema-valid before they reach your function. The tradeoff: `strict: true` requires `additionalProperties: false` throughout the schema tree, and doesn't support `oneOf`/`anyOf`. This tool adds `additionalProperties: false` automatically when generating the OpenAI strict output.

## Gemini's Schema Restrictions and Why They Exist

Gemini's function calling uses a subset of OpenJSON Schema. The restrictions — no `$ref`, no `oneOf`/`anyOf`, no `additionalProperties`, enum values must be strings — exist because Gemini's function calling is implemented over a proprietary schema format internally, and the JSON Schema surface area is mapped to that internal format at API parsing time.

The practical implication: if your schema uses advanced JSON Schema features (`$ref` for shared definitions, `oneOf` for discriminated unions), it will work with OpenAI and Anthropic but silently fail or be rejected by Gemini. This tool inlines `$ref` references and flags `oneOf`/`anyOf` usage so you know where to simplify.

## How to Design Good Tool Schemas

Schema design is where most tool call reliability issues originate.

**Required fields:** Mark every field the model should always provide as `required`. Optional fields with defaults should have those defaults described in the `description` string, not modeled as nullable types — models follow description guidance more reliably than schema optionality.

**Clear, specific descriptions:** The description is the most important part. Compare:
- Bad: `"location": { "type": "string", "description": "The location" }`
- Good: `"location": { "type": "string", "description": "City and country in English, e.g. 'Chicago, US' or 'Tokyo, Japan'" }`

The specific format example in the description dramatically improves the model's output for that field.

**Avoid `oneOf` when possible.** Use separate named tools instead of a single tool with a discriminated union parameter. Models call the right tool more reliably than they fill in a discriminator field. This also maps cleanly to all three providers.

**Limit required fields to what's truly required.** Every required field the model must fill in is an opportunity for an error. For optional context fields, make them optional with clear descriptions of when to omit them.

## Tips & Power Use

- **Round-trip existing definitions.** If you have an OpenAI tool definition, paste it in and get the Anthropic equivalent immediately — useful when porting an agent between providers.
- **Use the incompatibility flags as a compatibility matrix.** If Gemini compatibility is important, design your schema without `oneOf`, `$ref`, or `additionalProperties`. The tool tells you exactly which features to avoid.
- **Pair with the [System Prompt Linter](/apps/system-prompt-linter/)** — linting the system prompt and validating the tool schemas are the two most impactful pre-deployment checks for agentic systems.
- **OpenAPI operations.** If your backend has an OpenAPI spec, paste individual operation objects here to generate LLM tool definitions that map to your real API endpoints. Keeps the tool schema in sync with the backend spec.

## Limitations

- **Doesn't generate the function implementation** — only the schema half of the tool call
- **No runtime API validation** — emits the format; doesn't verify that a specific API version will accept it
- **OpenAPI parsing handles common cases** — complex `$ref` chains across files aren't resolved (inline only)
- **No streaming format** — Gemini's streaming function call format is identical except for delta wrapping; not modeled
- **No tool choice / forced calling** — the `tool_choice` parameter (OpenAI) and `tool_choice: { type: "tool" }` (Anthropic) aren't part of the schema; add those to your SDK call separately
