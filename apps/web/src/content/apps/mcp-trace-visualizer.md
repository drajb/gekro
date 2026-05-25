---
title: "MCP / Agent Trace Visualizer"
category: "ai"
job: "Paste a Claude Code, Cursor, Anthropic, or OpenAI trace - see the agent's tool calls as a collapsible tree with categories, results, and failure flags."
description: "Free in-browser visualizer for LLM agent tool-call traces. Auto-detects format: Anthropic SDK messages (tool_use / tool_result blocks), OpenAI chat completions with tool_calls, or Claude Code JSONL transcripts (one JSON per line, as written to ~/.claude/projects/.../*.jsonl). Renders the agent's call sequence as a vertical tree: each tool call is collapsible, categorized (fs / exec / search / web / mcp / meta / other), tagged with success or failure, and shows the matched tool_result side-by-side when 'Show results' is on. Stats panel: total calls, unique tools, failures, assistant turns, top-8 tool frequency. Export the normalized call list as JSON. No data leaves your browser."
aiSummary: "Read-only visualizer for LLM tool-call traces. Three input formats auto-detected: Anthropic messages array (matches tool_use blocks with tool_use_id of subsequent tool_result blocks), OpenAI ChatCompletion messages (matches tool_calls.id with subsequent role:tool messages via tool_call_id), and Claude Code JSONL (line-delimited Anthropic-shape records, unwraps .message envelope). Tools categorized by name heuristics: Read/Write/Edit/Glob/MultiEdit/ls → fs; Bash/shell/exec/run → exec; Grep/search/find → search; WebFetch/fetch/http → web; mcp__* prefix → mcp; Todo/Task/Notebook → meta; else other. Each call rendered as <details> with input JSON pretty-printed and color-tokenized; result attached when 'Show results' toggled. Failures flagged in red. Stats: call count, unique tools, error count, assistant turn count, top-8 by frequency. Export filtered/normalized list as JSON. Per Rohit's 2026-05-22 reframe: deliberately a visualizer, not a workflow designer (no n8n competition)."
personalUse: "I have a long Claude Code session debugging an infra issue and need to retrace what the agent actually did vs what I told it to do. Pasting the JSONL transcript here gives me the tool-call cascade at a glance - much faster than scrolling the chat."
status: "active"
publishedAt: "2026-05-25"
icon: "🌳"
license: "MIT"
---

## What It Does

Paste a trace. See the agent's tool calls as a collapsible tree.

- **Format auto-detection** — Anthropic SDK messages, OpenAI tool_calls, or Claude Code JSONL
- **Categorized tool pills** — fs / exec / search / web / mcp / meta / other (heuristic name match)
- **Pass / fail flags** — green ✓ for successful calls, red ✗ for tool_results marked with `is_error: true`
- **Input + result inspection** — click any call to expand JSON; toggle "Show results" to see the matched tool_result inline
- **Stats panel** — total calls, unique tools, failures, assistant turns, top-8 most-called tools
- **Three samples** — one per supported format, so you can see what it does before pasting your own
- **Export** — download the normalized call list (turn index, tool name, category, input, result, is_error) as JSON

## When To Use It

- Reviewing a long Claude Code session before sharing with a teammate
- Debugging "why did the agent loop on this for 6 calls?" - the tree makes the pattern obvious
- Comparing an OpenAI Assistants run against a Claude run on the same task
- Auditing MCP tool usage for security review (which mcp__ tools fired, in what order, against what inputs)
- Building a screenshot for a postmortem or LinkedIn post about an agent run

## What's NOT Included

- **Token / cost accounting** — that's the [Reasoning Cost Calculator](/apps/reasoning-cost-calculator/) and [LLM Cost Calculator](/apps/llm-cost-calculator/)
- **Editing or replaying the trace** — read-only. To replay an SSE log, see [Streaming Response Player](/apps/streaming-response-player/)
- **Live connection** — paste an existing trace; for live MCP tool inspection see [MCP Server Tester](/apps/mcp-server-tester/)
- **Persistent state** — reload starts fresh

## Why this and not n8n

We deliberately are NOT a visual workflow designer. n8n, Zapier, and Make own that space and they're adding MCP support. This is a **read-only debugging visualizer** for traces that already happened. Different job, no overlap.

## Related Tools

- [MCP Server Tester](/apps/mcp-server-tester/) - validate MCP tool schemas before they get used
- [Streaming Response Player](/apps/streaming-response-player/) - replay raw SSE / streaming logs at original speed
- [LLM Response Unpacker](/apps/llm-response-unpacker/) - extract structured outputs from messy LLM responses
- [Reasoning Token Cost Calculator](/apps/reasoning-cost-calculator/) - cost of the calls you just visualized
