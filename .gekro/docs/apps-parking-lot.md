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

Catalog count: **87 apps** total (current; see the Wave 6 section above, shipped 2026-08-13).

---

## Wave 6 — ✅ ALL 3 SHIPPED 2026-08-13 (gekro-apps@fa5d369; catalog 84 → 87)

Triggered by Anthropic's AI-content marking (imperceptible **statistical** text watermark + C2PA signed metadata on .svg/.png/.jpg). Verified against source 2026-08-13: models launched **in the EU** on or after 2026-08-02 support it at launch, existing models in progress; driver is the EU AI Act **Art. 50(2) Code of Practice on Transparency** which Anthropic signed. Detection for third parties is **forthcoming, not yet available**. Source: support.claude.com/en/articles/16266773.

| # | Slug | Job | Category | Notes |
|---|---|---|---|---|
| W6-1 | `ai-provenance-inspector` | Check text/files for AI-provenance signals: C2PA manifest presence, hidden Unicode, statistical-watermark status | ai | **Honest-scope rule: Anthropic has NOT published detection yet ("forthcoming"), so this must NEVER claim to detect Claude's statistical watermark.** Reports only what is verifiable + explains the rest. C2PA = presence detection, not signature verification. Absence ≠ human-written. |
| W6-2 | `punctuation-fixer` | Normalize smart quotes, em/en dashes, ellipses, NBSP, stray spacing | dev | Per-rule toggles. Serves Rohit's own no-em-dash rule. **Not to be framed or marketed as watermark removal** (it isn't - the mark is statistical). |
| W6-3 | `text-formatter` | Case conversion + line ops (trim/dedupe/sort/wrap/number) | dev | Evergreen search ("case converter", "text formatter"). Zero-dep. |

**DECLINED (do not build, 2026-08-13):** AI-watermark *removal* tool. Reasons: (1) the mark exists to satisfy EU AI Act Art. 50 transparency, so a remover is a regulatory-circumvention tool; (2) it is a statistical watermark in token choices - there is nothing to "strip", defeating it needs aggressive paraphrase that degrades text, so a client-side tool would be snake oil; (3) dominant use is passing AI text as human (academic fraud, undisclosed AI content). Detection/transparency tooling covers every legitimate need. Rohit raised it twice; declined both times with this rationale.

---

## Wave 5 — ✅ ALL 6 SHIPPED 2026-08-08 (traffic-driven batch)

Rohit asked for high-traffic ideas; picked all 6 from a shortlist. All verified (build clean, vitest 92/92, e2e 252/252). Components in gekro-apps@d4ef357.

| # | Slug | Category | Notes |
|---|---|---|---|
| W5-1 | `ai-energy-calculator` | ai | inference + training energy/CO₂/water + EV-mile equivalences; curated editable coefficients |
| W5-2 | `config-converter` | dev | JSON⇄YAML⇄TOML⇄.env, hand-rolled zero-dep parsers, offline |
| W5-3 | `hidden-text-inspector` | ai | zero-width/tag/bidi/homoglyph detector. XSS guardrail: textContent-only rendering, never innerHTML with user data, never renders input as HTML |
| W5-4 | `markdown-table-generator` | dev | grid editor → GFM/CSV/HTML; escapes pipes + HTML |
| W5-5 | `inference-latency-estimator` | ai | roofline model; total vs active params; curated editable GPU specs |
| W5-6 | `vector-db-calculator` | ai | index RAM (flat/HNSW/IVF) + self-hosted vs managed cost |

Catalog count after Wave 5: **84 apps**.

---

## Wave 4 — ✅ ALL SHIPPED 2026-07-05 (blueprint: `.gekro/docs/apps-blueprint-wave4.md`)

| # | Slug | Job (one line) | Shipped |
|---|---|---|---|
| W4-1 | `llm-json-repair` | Fix a model's almost-JSON + validate against a schema | gekro-apps@9da652c, content @e1d0582 |
| W4-2 | `embedding-playground` | In-browser embeddings → similarity heatmap + PCA scatter | gekro-apps@c8f03ba, content @2c1d6c5 |
| W4-3 | `llm-api-builder` | Visual request builder → curl/Python/TS for Anthropic/OpenAI/Gemini | gekro-apps@9da652c, content @e1d0582 |
| W4-4 | `finetune-dataset-auditor` | JSONL training-set lint + token stats + FT cost per provider | this wave |
| W4-5 | `rate-limit-planner` | Workload vs provider TPM/RPM tiers → binding limit + queue math | this wave |
| W4-6 | `gguf-inspector` | Parse a GGUF header client-side (File.slice) → arch/quant/tensors | this wave |

Catalog count after Wave 4: **78 apps**.

Tier-3 parked ideas (do not build without asking): image-gen cost calculator, vector-DB cost comparator, A/B prompt judge scorecard, latency budget planner. Secret/API-key scanner stays on ice (2026-06-19).

## Pending decisions

*(none — empty queue)*

---

## All shipped — 2026-05-25 wave complete

| Feature | Where | Status |
|---|---|---|
| Site-wide as-is disclaimer | AttributionFooter.astro | ✅ `2b56315` |
| local-models.json auto-fetcher (weekly GH Actions) | `.github/workflows/local-models-update.yml` | ✅ `af07088` |
| image-compressor v3 (target-size mode, EXIF preserve, AVIF) | gekro-apps@ed73f19 | ✅ |
| pdf-merger v2 (thumbnails, split mode, per-page rotation) | gekro-apps@40b67e1 | ✅ |

Password-protect PDF output: pdf-lib removed encryption in v2; no alternative <200 KB. Not shipped — tell user to use their PDF reader instead.
Image-downsample in PDF: would need separate WASM lib. Tell user to run images through image-compressor first.

---

## In flight 2026-05-25 (Rohit: "build everything with all the bells and whistles, fix all the bugs")

**Scope, in build order:**

1. **Site-wide "as-is" disclaimer** — added to every app page via a shared component so the legal note shows everywhere. Tone per Rohit: casual/joking ("don't blame me if your PC catches fire"). Single source of truth so it can be updated once.

2. **Auto-fetcher for `local-models.json`** — weekly GitHub Actions workflow that pulls Ollama library API + HF Open LLM Leaderboard, regenerates the JSON, opens a PR for human review. Same pattern as the hyperscaler-pricing pipeline. Keeps the Local Model Browser fresh without manual maintenance.

3. **Image-compressor v3 — full bells & whistles:**
   - Target-size mode (binary-search the quality slider until output ≤ a chosen KB)
   - EXIF / GPS metadata strip toggle
   - AVIF output format

4. **PDF-merger v2 — full bells & whistles:**
   - Visual page thumbnails for reorder (PDF.js, ~1.5 MB lazy-loaded)
   - Split mode (one PDF in → N PDFs out by range)
   - Per-page rotation
   - Password-protect the output PDF
   - Image-downsample compression of embedded images

**Explicitly NOT in scope** (Rohit's instruction): the tax-loss harvester state-tax overlay stays deferred per the federal-only decision.

**Known bugs queue:** empty (the two QR-generator bugs from earlier today are both shipped fixes).

---

## Recently shipped (2026-05-25 later)

| # | Slug | What | Commits |
|---|---|---|---|
| #16 | `image-compressor` (v2, expanded in place) | Added batch upload + ZIP-all download (JSZip lazy-loaded). Per-file cap raised 10 MB → 50 MB. Single-file UX preserved. Other bells/whistles (target-size, EXIF strip, AVIF) deferred — Rohit picked the focused win. | gekro-apps@bffff37, content@ad40afe |
| #17 | `pdf-merger` (new app #67) | Drop multiple PDFs, drag-to-reorder, per-file page-range syntax ("1-3, 5, 7-9"), merge & download. pdf-lib lazy-loaded (~280 KB). No thumbnails / no split / no rotation in v1 — those are v2 candidates. | gekro-apps@bffff37, content@ad40afe |

V2 candidates if Rohit asks later: image-compressor target-size mode, EXIF strip, AVIF output; pdf-merger thumbnails (PDF.js ~1.5 MB), split mode, per-page rotation.

---

Catalog count at this point in history: **67 apps** (was 66 — pdf-merger added; image-compressor v2 expansion didn't add a new slug). Current total is **78** (see the Wave 4 section for the latest additions).

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

## Shipped — 2026-06-02

### Translator (EN / ES / HI, live, client-side) → `translator`
- SHIPPED. Google-Translate-style live translator, three languages fully interchangeable (English, Spanish, Hindi) including direct ES↔HI.
- Built on **Meta M2M-100 418M** (`Xenova/m2m100_418M`) via transformers.js, CDN-imported at runtime (no npm dep added), cached in-browser. Many-to-many model so ES↔HI is direct, no English pivot. Category `ai`.
- Features: live debounced translation, source auto-detect (3-language heuristic), language swap, browser TTS, copy/export. Fully offline after the one-time ~250 MB model download. Tradeoffs surfaced honestly in the methodology (download size, 3 languages only, quality below largest cloud models, heuristic auto-detect).

---

## Shipped — 2026-06-19 (Rohit picked 3 of 4 proposed)

Proposed 4 new AI-eng apps; Rohit selected 3 (skipped the Secret/API-key Scanner). **All 3 shipped same day** (gekro-apps@e095f2b). Browser-verified: templates/sampling-math/cost-model correct, XSS-safe, no console errors. Catalog now **72 apps**. Zero-dep, client-only, category `ai`.

| Slug | Job | Notes |
|---|---|---|
| `chat-template-builder` | messages[] (system/user/assistant) → exact prompt string for Llama-3, ChatML (GPT/Qwen), Mistral, Gemma, Phi-3, with special tokens shown | pairs with `tokenizer`; zero-dep; hand-rolled templates per family |
| `sampling-playground` | temperature / top-p / top-k / min-p / repetition-penalty applied live to a sample logit distribution, visualized | pairs with `token-probability-visualizer`; canvas/SVG, zero-dep |
| `agent-loop-cost-estimator` | model + N steps + avg tokens & tool-calls/step → cumulative $ cost, context growth, latency estimate | extends `llm-cost-calculator` + `context-window-visualizer`; zero-dep |

**Not selected (keep on ice):** Secret / API-key Scanner (paste code → flag leaked creds by pattern + redact).

---

*This doc and `app_ideas_backlog.md` are the canonical pair. When updating one, update the other in the same turn.*
