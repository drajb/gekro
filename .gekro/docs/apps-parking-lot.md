# Gekro Apps — Parking Lot

Planned apps that Rohit has approved in concept or surfaced as ideas. Mirrored in `C:\Users\rom8\.claude\projects\G--Git-gekro\memory\app_ideas_backlog.md` (Claude's personal memory) so both agent toolchains (Claude Code + Gemini CLI) can see the same backlog.

**Logging discipline (locked 2026-05-23):** when Rohit gives a new app idea — whether for immediate build, "later", or just brainstorming — append it here AND to the memory file BEFORE building or even replying. Both files must agree at all times. When an app ships (a `apps/web/src/content/apps/{slug}.md` exists), remove it from both files in the same commit.

See `.gekro/docs/apps-platform-standard.md` for the build recipe.

---

## Status as of 2026-05-25

**All 5 items from the 2026-05-22 backlog shipped.** Nothing pending.

| # | Slug | Status |
|---|---|---|
| #9 | `local-model-recommender` | ✅ Shipped 2026-05-25 (gekro-apps@3bced35, content @f0f1f93) |
| #10 | `mcp-trace-visualizer` | ✅ Shipped 2026-05-25 (gekro-apps@c22ef48, content @374da3e) |
| #11 | `rag-eval-toolkit` | ✅ Shipped 2026-05-25 (gekro-apps@599daa2, content @7089095) |
| #14 | `websocket-tester` | ✅ Shipped 2026-05-23 (gekro-apps@aa41f9b, content @00f6e91) |
| #15 | `tax-loss-harvester` | ✅ Shipped 2026-05-25 (gekro-apps@9531ad4, content @7a6e476) |

Catalog count: **66 apps** total (was 61 at start of this batch).

---

## Pending decisions

### #16 — Image Compressor v2 (expand existing app)

**Important:** there's already a shipped `image-compressor` app — single-file, JPEG/PNG/WebP, quality slider + max-width + format selector + before/after preview. Rohit reports having to "go online and use something else" because the existing one is missing features. Path: **expand the existing slug in place** (preserves SEO + URL + the no-delete rule).

**Proposed bells & whistles** (final list pending Rohit's pick):
- Batch upload (drop a folder, compress N files at once)
- ZIP-download of batch output
- Target-size mode ("make this under 500 KB" — binary search on quality)
- Strip EXIF / GPS metadata toggle
- AVIF output (newer, smaller than WebP — supported in modern browsers)
- Drag-to-reorder + per-file enable/disable
- Crop + rotate per file
- Lift the 10 MB hard cap to ~50 MB (only the largest files would struggle)
- Preserve folder structure when outputting ZIP

**Status:** decision-pending on which subset to ship.

### #17 — PDF Merger / Splitter (new app)

100% client-side feasible. Library: `pdf-lib` (MIT, ~280 KB lazy-loaded on first interaction).

**Proposed scope** (final list pending Rohit's pick):
- Drag-drop multiple PDFs into a stack
- Drag handles to reorder files
- Per-file page range picker ("from this file, just pages 1-3 and 5")
- Per-file rotation (90 / 180 / 270)
- Merge → download single PDF
- Optional: split mode (one PDF in → N PDFs out by page range)
- Optional: page thumbnails for visual reorder (would add PDF.js, ~1.5 MB; out of scope for v1)
- Optional: password-protect output (pdf-lib supports basic encryption)
- Optional: image-downsample compress

**Status:** decision-pending on scope.

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
9. Local Model Recommender / Browser → `local-model-recommender`
10. MCP Trace Visualizer (reframed from Workflow Designer) → `mcp-trace-visualizer`
11. RAG Eval Toolkit → `rag-eval-toolkit`
12. Tesla Charge Optimizer → `tesla-charge-optimizer`
13. Refinance comparison → folded into `amortization-calculator` as a refi panel
14. WebSocket / SSE Live Tester → `websocket-tester`
15. Tax-Loss Harvesting Optimizer → `tax-loss-harvester`
- HTML Viewer (added 2026-05-22 separately) → `html-viewer`
- Word Counter (added 2026-05-23 separately) → `word-counter`

---

*This doc and `app_ideas_backlog.md` are the canonical pair. When updating one, update the other in the same turn.*
