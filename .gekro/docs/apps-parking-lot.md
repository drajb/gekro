# Gekro Apps — Parking Lot

Planned apps that Rohit has approved in concept or surfaced as ideas. Mirrored in `C:\Users\rom8\.claude\projects\G--Git-gekro\memory\app_ideas_backlog.md` (Claude's personal memory) so both agent toolchains (Claude Code + Gemini CLI) can see the same backlog.

**Logging discipline (locked 2026-05-23):** when Rohit gives a new app idea — whether for immediate build, "later", or just brainstorming — append it here AND to the memory file BEFORE building or even replying. Both files must agree at all times. When an app ships (a `apps/web/src/content/apps/{slug}.md` exists), remove it from both files in the same commit.

See `.gekro/docs/apps-platform-standard.md` for the build recipe.

---

## Pending decisions

These ideas were proposed, Rohit raised a concern, the concern was answered, and no final go/no-go was given. Surface them at the next planning checkpoint.

### #9 — Local Model Recommender / Model Browser (Tier B — local AI)

**Job:** Hardware (Pi 5 16 GB / M4 Pro / RTX X) + task type + latency budget → ranks Llama / Qwen / GLM / Mistral options.

**Rohit's concern (2026-05-22):** "The data that you are recommending for the local models should be updated. There are new local models every single day, so how do you plan to do that?"

**Proposed answer (2026-05-22T01:26:26):** Two layers combined.
- **Auto-fetcher** — weekly GitHub Actions job hits the Ollama library API and HuggingFace Open LLM Leaderboard, updates `local-models.json`, opens a PR for review. Same pattern as App #51 hyperscaler pricing.
- **Performance numbers** come from a "Submit your benchmark" form that writes to a JSON in the same repo (same model on N hardware configs over time).
- **Reframe as "Model Browser"** rather than "Recommender" — don't say "best model for you is X", just expose facets (license, params, tool-use support) so users filter for themselves. Optionally surface a clearly-labeled estimate of `params × quantization × hardware FLOPS`.

**Outstanding decision:** build with auto-fetcher, or skip until later?

### #10 — MCP Trace Visualizer (Tier C — reframed from "Agentic Workflow Designer")

**Original idea:** visual node-based builder for multi-step agent chains. Rohit pushed back: "I'm not trying to compete with n8n, so what purpose would it really serve?"

**Reframe (2026-05-22T01:26:26):** drop the designer angle entirely. Build a **read-only visualizer**: paste a trace from Claude Code / Cursor / any MCP client → render the agent's tool-call tree as a graph (which tools fired, in what order, what they returned, where reasoning happened). Fits the existing visualizer family (`docker-compose-visualizer`, `context-window-visualizer`). Engineer-debugging utility, zero overlap with n8n.

**Outstanding decision:** build as MCP Trace Visualizer or skip?

---

## Surfaced but not yet discussed

These were in the original 2026-05-22 list of 15 but Rohit didn't address them in his reply. Raise at the next planning checkpoint.

### #11 — RAG Eval Toolkit (Tier C — ambitious)

**Job:** paste corpus + N test queries + expected answers → reports recall@K, precision@K, MRR. Self-hosted alternative to RAGAS / TruLens.

**Effort estimate:** large. Embedding model needs to run in-browser (transformer.js WASM, ~30-80 MB) or fall back to document-side BM25. Confirm dep before building.

### #14 — WebSocket / SSE Live Tester (Tier D — adjacent)

**Job:** connect to any WebSocket or SSE endpoint, see frames live, set headers, log latencies. Most existing testers don't handle modern streaming properly.

**Effort:** small. Browser-native `WebSocket` and `EventSource` APIs.

**Risk:** CORS. Many target servers won't accept cross-origin connections from gekro.com. Frame as "test your own endpoints with a browser-based client" and surface CORS errors clearly.

### #15 — Tax-Loss Harvesting Optimizer (Tier D — adjacent)

**Job:** paste positions CSV (or paste from Alpaca / Robinhood export) → algorithm picks lots to sell for max harvest without triggering wash-sale.

**Effort:** medium. Wash-sale logic is the meat: 30 days before and after, substantially identical securities, replacement-share tracking.

**Seasonal:** year-end relevance, worth shipping by November.

---

## Already shipped (do not re-add)

For reference — these were in the original 2026-05-22 list and have since shipped. Do not re-suggest them.

1. Reasoning Token Cost Calculator → `reasoning-cost-calculator`
2. Prompt Cache Optimizer → `prompt-cache-optimizer`
3. MCP Server Tester → `mcp-server-tester`
4. Streaming Response Player → `streaming-response-player`
5. Multi-modal Token Counter → `multimodal-token-counter`
6. Token Probability Visualizer → `token-probability-visualizer`
7. Llama.cpp / Ollama Config Builder → `llama-cpp-config-builder`
8. LoRA / QLoRA Memory Calculator → `lora-memory-calculator`
12. Tesla Charge Optimizer → `tesla-charge-optimizer`
13. Refinance comparison → folded into `amortization-calculator` as a refi panel
- HTML Viewer (added 2026-05-22 separately, outside this list) → `html-viewer`
- Word Counter (added 2026-05-23 separately) → `word-counter`

---

*This doc and `app_ideas_backlog.md` are the canonical pair. When updating one, update the other in the same turn.*
