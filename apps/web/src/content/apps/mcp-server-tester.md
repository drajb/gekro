---
title: "MCP Server Tester"
category: "ai"
job: "Paste your MCP server's tools/list output, validate against the protocol spec, simulate a tool call without any LLM cost."
description: "Free browser-based MCP server validator and tool-call simulator. Paste your tools/list response (or raw tool array), tool validates each entry against MCP protocol requirements: name format, required inputSchema, schema type=object, missing descriptions, undocumented properties. Shows exactly the JSON an LLM would receive when these tools are listed, with token estimate. Simulates a tools/call by validating arguments against each tool's inputSchema, catching JSON-Schema violations before they hit a real LLM and burn tokens."
aiSummary: "Client-side MCP (Model Context Protocol) server validator. Inputs: JSON response from tools/list, or a raw array of tool definitions. Validates each tool against MCP 2025-06 requirements: required fields (name, inputSchema), name regex compliance, description quality heuristics, inputSchema must be type=object, properties should have type+description for LLM clarity. Simulates tools/call by validating arguments against the tool's inputSchema using a minimal JSON-Schema validator (type checking, required fields, enum, min/max for numbers, minLength/maxLength for strings, additionalProperties:false enforcement). Auto-populates argument stubs from the schema. Shows the exact JSON-LLM-context format the model would see, with token estimate. No external API calls."
personalUse: "I built this after writing my fifth MCP server and realising I kept making the same schema mistakes (missing descriptions, wrong inputSchema type, fields the LLM couldn't disambiguate). Now I lint locally before I push."
status: "active"
publishedAt: "2026-05-13"
icon: "🔌"
license: "MIT"
---

## What It Does

The Model Context Protocol (MCP) is the standard for exposing tools to LLMs (Anthropic's Claude Code, Cursor, Continue, and many other clients use it). MCP servers ship tools whose schemas the LLM reads to decide when and how to call them. **Bad schemas = bad tool selection = burned tokens.**

This tool catches schema issues before they ship:

1. Paste your server's `tools/list` response (or just an array of tools)
2. Validator runs against MCP protocol requirements + LLM-friendliness heuristics
3. See exactly the JSON-context format the LLM would receive
4. Simulate a `tools/call` to verify arguments validate against your `inputSchema`

## Checks Performed

**Spec requirements (errors):**
- Missing `name` field
- Missing `inputSchema` field
- `inputSchema.type` must be `"object"`

**Best practices (warnings):**
- Name contains chars outside `[a-zA-Z0-9_-]` (some clients restrict)
- No `description` (LLM tool selection works better with detailed descriptions)
- Description shorter than 20 chars (under-specified)
- Properties without `description` (argument purpose unclear)
- Properties without `type` (LLMs may guess wrong)

## Tool-Call Simulation

Pick a tool from the dropdown - the tool auto-generates a starter argument stub from your schema. Edit the JSON, watch the validator catch violations in real time:

- Type mismatches (`"5"` where `"integer"` was expected)
- Missing required properties
- Enum violations (`"meters"` not in `["imperial", "metric"]`)
- Number range violations (`limit: 30` when `maximum: 20`)
- String length / unknown property warnings

This is the same JSON-Schema check your server probably does in code - run it in the browser before round-tripping through an actual LLM.

## What the LLM Sees

The tool also shows you the **exact JSON your tools become** in the LLM's context window, formatted as the major clients format it. The token estimate is your per-request cost when the tools are loaded (use [Prompt Cache Optimizer](/apps/prompt-cache-optimizer/) to see if you can cache them).

## What's NOT In Scope

- **Live server testing** - no network calls. Paste-only.
- **MCP transport protocols** (stdio/SSE/HTTP) - just the schema layer
- **OAuth flows** - MCP authentication isn't covered here
- **Tool result validation** - only input validation

## Related Tools

- [JSON Schema to LLM Tool Definition](/apps/json-schema-to-tool/) - convert plain JSON Schema to MCP/OpenAI tool format
- [System Prompt Linter](/apps/system-prompt-linter/) - lint the rest of your agent prompt
- [Prompt Cache Optimizer](/apps/prompt-cache-optimizer/) - if your tools are big, cache them
- [Reasoning Cost Calculator](/apps/reasoning-cost-calculator/) - what each tool-using request will cost
