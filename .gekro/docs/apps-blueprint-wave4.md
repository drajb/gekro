# Gekro Apps - Wave 4 Blueprint (handoff for Opus)

**Status:** approved for build (Rohit, 2026-07-05). Build in the order listed.
**Read first:** `.gekro/docs/apps-platform-standard.md` (build recipe + quality bar), `CLAUDE.md` §8 (dual-repo), `.gekro/logs/decision-log.md` + `issue-tracker.md` (governance pre-flight).

## Why these six

Selection criteria, in priority order: (1) genuinely useful to the public with real search demand, (2) zero overlap with the 72 live apps, (3) each one teaches Rohit something new as an AI engineer. The catalog is already deep on *cost calculators* and *visualizers*; this wave adds **fixers, builders, and inspectors** - tools people reach for mid-task, which is where habitual traffic comes from.

| # | Slug | One-line job | SEO hook | What Rohit learns |
|---|---|---|---|---|
| 1 | `llm-json-repair` | Fix a model's almost-JSON and validate it against a schema | "fix invalid json from llm", "json repair online" | Writing a forgiving parser/repair engine |
| 2 | `embedding-playground` | Compute embeddings in-browser, see similarity matrix + 2D map | "sentence similarity checker", "embedding visualizer" | Embedding geometry, PCA from scratch |
| 3 | `llm-api-builder` | Point-and-click request builder → curl / Python / TS for 3 providers | long-tail: "anthropic api curl example", "gemini api python request" | Cross-provider API parity incl. caching + thinking params |
| 4 | `finetune-dataset-auditor` | Lint a JSONL training set + estimate fine-tune cost per provider | "fine tuning cost calculator", "jsonl validator openai" | Dataset hygiene, what FT providers actually validate |
| 5 | `rate-limit-planner` | Will your workload hit provider TPM/RPM limits? Queue math | "openai rate limit calculator", "anthropic rate limits" | Capacity planning, Little's law applied to LLM APIs |
| 6 | `gguf-inspector` | Drop a GGUF file, parse the header client-side, see arch/quant/tensors | "gguf inspector", "gguf metadata viewer" (low competition) | Binary format parsing in JS (File.slice, DataView) |

Cross-linking is deliberate: 1↔`json-formatter`/`json-schema-to-tool`, 2↔`rag-eval-toolkit`/`rag-chunk-inspector`, 3↔`llm-cost-calculator`/`prompt-cache-optimizer`, 4↔`finetuning-formatter`/`lora-memory-calculator`, 5↔`agent-loop-cost-estimator`, 6↔`local-model-recommender`/`gpu-vram-calculator`/`llama-cpp-config-builder`. Every methodology section must link its siblings.

---

## Non-negotiable platform contract (every app)

This is the distilled contract from the platform standard + the 61-bug audit (2026-07-05, issue-tracker). The test pipeline enforces most of it mechanically.

1. **Files:** `{slug}/Calculator.astro` in **gekro-apps** (private repo, commit+push there first); `apps/web/src/content/apps/{slug}.md` + import & `CALCULATOR_MAP` entry in `apps/web/src/pages/apps/[slug].astro` in **gekro** (public). The vitest integrity suite fails CI if the three drift.
2. **Scaffold:** idempotency guard (`if (!el || el._xyzInit) return`), re-init on `astro:after-swap`, ALL THREE AppShell events (`app:copy`, `app:reset`, `app:export`) wired through ONE `AbortController` aborted on `astro:before-swap`.
3. **UX:** renders a meaningful result on first paint (sensible defaults or prefilled sample - never a blank state); live recalc on `input`; mobile-first (`inputmode` on numerics, 44px touch targets via the `.app-btn-*` / `.app-input` classes); design tokens only, no invented colors.
4. **Hard lessons from the audit - do these from day one:**
   - **Clamp every numeric input at read time** (min AND max). An unclamped count froze a tab at 999,999,999 iterations (agent-loop bug).
   - **No unbounded O(n²)/O(m×n)** compute or DOM on user input - add an explicit cell/row cap with a visible "too large" message (prompt-diff, rag-chunk lessons).
   - **Escape EVERY user-controlled string** before `innerHTML`, including inside `title="..."` attributes. Prefer `textContent`. The fuzz suite injects an XSS probe into every field and fails if it executes.
   - **Guard nullable browser/library returns** (`getRawData`, `FileReader.result`, blob APIs) - qr-code lesson.
   - **NaN discipline:** `parseFloat || fallback` swallows an intentional 0 (drawdown rfr lesson); use `Number.isFinite` when 0 is a legal value. Every guard must include EVERY input the formula uses (options-pnl DTE lesson).
   - **One number, one convention:** if "monthly" appears twice on the page it must be the same formula (reasoning-cost lesson). Never clamp away a negative result that is the honest answer (prompt-cache lesson).
5. **Verification gates before commit:** `pnpm --filter web build` clean; `pnpm --filter web test` green (integrity suite auto-discovers the new slug); `pnpm --filter web test:e2e` green - the new app gets a smoke + interaction/fuzz test automatically with ZERO test code. If the app legitimately needs network/CDN (app 2 only), add a tight per-slug allowlist entry in `apps/web/e2e/helpers.ts` (pattern: `translator`, `rag-eval-toolkit`).
6. **Dependencies: none.** Apps 1, 3, 4, 5, 6 are zero-dep by design. App 2 uses the established transformers.js **CDN runtime import** pattern (NOT an npm dep) proven in `translator` and `rag-eval-toolkit`.
7. **Frontmatter:** category `ai` for all six; write `job` as the user's task, not the feature; `personalUse` must be true (Rohit uses each of these weekly - that is why they were chosen); set `lastVerified` for apps 3, 4, 5 (they carry curated pricing/limits data).

---

## App 1 - `llm-json-repair` : LLM Output Repair & Schema Validator

**Job:** "Paste a model's broken JSON output, get valid JSON back, and check it against your schema."
**Why it wins:** every agent builder hits malformed tool-call/structured output daily; existing "JSON fixer" sites are ad-farms. High-intent searches. Distinct from `json-formatter` (assumes valid input) and `json-schema-to-tool` (authoring direction).

**UI (single column):** input textarea (prefilled with a broken sample) → auto-repaired output pane with syntax highlight → "What I fixed" list (one line per repair, e.g. "line 3: single quotes → double quotes") → collapsible schema panel: paste a JSON Schema, validate, show per-path errors.

**Repair engine (zero-dep, ordered passes - implement as pure functions, each returning `{fixed, note?}`):**
1. Strip markdown fences and any prose before the first `{`/`[` and after the last `}`/`]` (the #1 LLM failure).
2. Extract first balanced JSON value if multiple concatenated.
3. Normalize smart quotes; single-quoted strings/keys → double-quoted; unquoted object keys → quoted (identifier regex).
4. Remove trailing commas; insert missing commas between adjacent `"}"` `"{"` pairs; balance unclosed brackets/braces by scanning a stack.
5. `True/False/None/NaN/Infinity/undefined` → `true/false/null/null/null/null` (note each).
6. Escape raw newlines/tabs inside string literals (single-pass char scanner with an in-string state machine - do NOT regex this).
7. After each pass, try `JSON.parse`; stop at first success. If all fail, show the parse error with line:column and a caret, like `json-formatter` does.
**Schema validation (zero-dep subset):** support `type`, `properties`, `required`, `items`, `enum`, `additionalProperties`, `minimum/maximum`, `minLength/maxLength`, `pattern` - that covers real tool-schema use. State the subset honestly in the methodology.
**Edge cases to handle + test manually:** input >2 MB (cap with message), deeply nested (recursion depth cap ~200), lone `[` , emoji/astral in strings (the char scanner must iterate code points), the XSS probe string as a JSON string value.
**Copy/export:** copy = repaired JSON; export = `.json` file download; reset = clear + reload sample.
**Learning angle:** state machines and forgiving parsers - write the in-string scanner by hand, no library.

---

## App 2 - `embedding-playground` : Embedding Similarity Playground

**Job:** "Paste up to 20 texts, compute real embeddings in your browser, and see which ones the model thinks are similar."
**Why it wins:** makes an abstract concept tangible; nothing comparable that is client-only/private; great screenshots (LinkedIn quality bar). Distinct from `rag-eval-toolkit` (retrieval metrics, BM25 default) - this is about the geometry itself.

**Model:** `Xenova/all-MiniLM-L6-v2` via transformers.js CDN import, lazy-loaded on first Compute click with the streamed progress bar pattern from `translator` (~25 MB, cached). A "sample texts" button must populate 8 sentences (2 obvious clusters + 1 odd one out) so the first screenshot is instant.
**UI:** textarea one-text-per-line (cap 20 lines, warn beyond) → Compute → (a) N×N cosine similarity **heatmap** (CSS grid of colored cells, tooltip = pair + score; color scale token-based: accent for high, bg-elevated for low), (b) **top-5 / bottom-5 pairs** table, (c) **2D scatter** of PCA-projected embeddings (SVG, labeled points; hand-rolled PCA: mean-center → covariance → top-2 eigenvectors via power iteration ~50 iters - document this in the methodology, it is the learning payload).
**Math to get right:** cosine = dot/(|a||b|) with zero-vector guard; PCA power iteration with deflation for the 2nd component; normalize scatter to the viewBox with padding (no NaN paths - amortization lesson: validate every coordinate finite before writing SVG).
**e2e note:** add `'embedding-playground': [/transformers/i, /failed to fetch/i, /huggingface|jsdelivr|cdn|onnx/i]` to `e2e/helpers.ts` ALLOWED_ERRORS (CDN blocked in headless).
**Copy/export:** copy = top pairs text summary; export = CSV of the full similarity matrix.
**Learning angle:** PCA + eigenvectors by hand; what cosine similarity actually looks like on real sentences.

---

## App 3 - `llm-api-builder` : LLM API Request Builder

**Job:** "Configure a chat request visually, copy a working curl / Python / TypeScript snippet for Anthropic, OpenAI, or Gemini."
**Why it wins:** docs-adjacent long-tail SEO with high developer intent; showcases parity knowledge (cache_control, extended thinking, reasoning effort, JSON mode, tool defs) that generic tutorials get wrong. Distinct from `mcp-server-tester` (live calls) - this GENERATES code, never calls anything.

**UI (two columns):** left = provider tabs (Anthropic / OpenAI / Gemini) + form: model dropdown (reuse the pricing/model list conventions from `llm-cost-calculator/data.ts`), system prompt, one user message, max_tokens, temperature, streaming toggle, JSON-mode/structured toggle, tools textarea (JSON, validated), provider-specific extras (Anthropic: `cache_control` on system + extended `thinking` budget; OpenAI: `reasoning_effort`; Gemini: `safety_settings` preset). Right = output tabs curl / Python (official SDK) / TypeScript (official SDK), syntax-highlighted, per-tab copy buttons.
**Correctness bar (this is the whole product):** each provider's payload shape must match current docs exactly - header names (`x-api-key` + `anthropic-version` vs `Authorization: Bearer`), system prompt placement (top-level `system` vs messages[0] vs `systemInstruction`), tool schema field names (`input_schema` vs `parameters`), streaming flags. **The API key is always the literal placeholder `$ANTHROPIC_API_KEY` / env-var reference - never an input field** (site rule: no credential inputs, ever). Snippets are built by string templates from a single normalized request object; escape user strings per target language (JSON-encode for curl/TS, triple-quote-safe for Python).
**Data freshness:** model lists + parameter surfaces carry `lastVerified` in frontmatter; methodology links each provider's docs page.
**Copy/export:** copy = active snippet; export = all three snippets in one `.md` file.
**Learning angle:** the real deltas between the three APIs - the stuff you only learn by implementing all three.

---

## App 4 - `finetune-dataset-auditor` : Fine-Tuning Dataset Auditor & Cost Estimator

**Job:** "Drop your JSONL training file - get format lint, token stats, duplicate detection, and what a fine-tune run costs per provider."
**Why it wins:** completes the FT trio (`finetuning-formatter` creates data → THIS audits it → `lora-memory-calculator` sizes local training). "Will my file pass OpenAI validation and what will it cost" is a real pre-flight ritual with search demand.

**Input:** file drop or paste (cap 50 MB / 100k lines, stream-parse line-by-line - never `JSON.parse` the whole file). All client-side (privacy is the selling point - training data is sensitive).
**Checks (each a pass/warn/fail row with line numbers, capped at first 50 offenders per rule):** valid JSON per line; expected shape (`{messages:[...]}` chat format, with a format auto-detect for prompt/completion legacy); roles valid + alternating; empty/whitespace content; per-example token count (reuse the shared CL100K×0.92 estimator) vs provider max (e.g. examples over context limit get truncated by providers - flag them); exact-duplicate examples (hash of normalized text); near-empty assistant turns; dataset-level stats: examples count, token histogram (SVG bars), min/median/p95/max tokens, total training tokens.
**Cost model:** `total_training_tokens × epochs × $/1M-training-token` per provider (OpenAI FT prices; note which models are tunable; Anthropic/Gemini rows shown as "not publicly self-serve / see docs" if that is still true at build time - verify and set `lastVerified`). Epochs input (default 3, clamp 1-50).
**Perf guard:** hashing/duping via incremental loop with a `await new Promise(r=>setTimeout(r))` yield every 5k lines so the tab never freezes (audit lesson).
**Copy/export:** copy = summary report; export = CSV of per-line findings.
**Learning angle:** what production FT pipelines validate, and why; streaming parsers.

---

## App 5 - `rate-limit-planner` : Rate Limit & Throughput Planner

**Job:** "Enter your workload (requests/min, tokens/request) and your provider tier - see whether you'll hit TPM/RPM limits, and what your real throughput ceiling is."
**Why it wins:** every builder hits 429s; the mental math (two coupled limits + burstiness) is genuinely unintuitive; pairs with `agent-loop-cost-estimator` (cost) by answering the "can I even run this fast enough" half.

**Data (curated `data.ts`, `lastVerified` mandatory, source URLs per row):** TPM + RPM (+ concurrent where applicable) for Anthropic tiers 1-4, OpenAI usage tiers 1-5, Gemini free/pay-as-you-go - for the handful of flagship models per provider (do not try to be exhaustive; say so).
**Math:** effective ceiling = `min(RPM, TPM / tokens_per_request)` requests/min; utilization % against each limit with a two-bar visual (the binding constraint highlighted in accent-warm/danger); burst modeling: given arrivals as a Poisson-ish burst input (peak multiplier slider 1-10×), time-to-429 and required client-side queue depth = `(peak_rate - ceiling) × burst_duration`; simple wait-time estimate for a token-bucket at the sustained rate (state assumptions plainly in the methodology - this is an estimator, not a simulator). Recommendations panel: "you are TPM-bound - cutting avg tokens/request 30% raises ceiling to X" style, computed not canned.
**Edge cases:** tokens/request = 0 (clamp ≥1), workload of 0, tier that lacks a published number (render "n/a", exclude from the min()).
**Copy/export:** copy = verdict summary; export = CSV across all tiers for the entered workload.
**Learning angle:** applied queueing intuition; how the two-dimensional limit actually binds.

---

## App 6 - `gguf-inspector` : GGUF Model File Inspector

**Job:** "Drop a .gguf file (any size) - read its header locally and see the architecture, quantization, tensor map, and whether it fits your GPU."
**Why it wins:** nothing client-side exists; "what exactly is in this 40 GB file" is a real question; pure lab-cred differentiation; near-zero SEO competition for "gguf inspector".

**Critical technique:** NEVER read the whole file. `file.slice(0, 16 MB).arrayBuffer()` and parse with `DataView` (little-endian): magic `GGUF`, version (support v2 + v3), tensor_count (u64), metadata_kv_count (u64), then the typed KV records (all 13 GGUF value types incl. arrays and nested strings), then tensor descriptors (name, n_dims, dims, ggml dtype enum, offset). If the metadata region exceeds the slice, read a bigger slice lazily (loop, cap 64 MB, then fail gracefully with "header larger than expected").
**Display:** hero card (name, architecture, param count derived from tensor dims, file quant e.g. Q4_K_M from `general.file_type`, context length, license if present) → metadata KV table (searchable, values truncated at 200 chars, ESCAPED - metadata strings are attacker-controlled bytes) → tensor table capped at 200 rows with "+N more" → derived summary: total params, bytes/param actual (file size ÷ params), estimated RAM/VRAM to load = file size × 1.1 + KV-cache estimate at a chosen context (reuse formula conventions from `gpu-vram-calculator`, cross-link it and `local-model-recommender`).
**Edge cases (must handle without crashing - the fuzz suite will click everything with no file loaded):** no file, non-GGUF file (magic check → friendly error), truncated file, v1 files (unsupported → say so), u64 values beyond `Number.MAX_SAFE_INTEGER` (read as BigInt, convert with a range check), malformed string lengths (bounds-check every read against the buffer - a corrupt length must show an error, not throw a RangeError to the console).
**Copy/export:** copy = summary block; export = metadata + tensor list CSV.
**Learning angle:** the deepest of the wave - binary layouts, alignment, BigInt handling, defensive parsing of untrusted bytes.

---

## Parked (Tier 3 - do not build without asking Rohit)

- **Image/video generation cost calculator** (output-side pricing per resolution/steps) - good SEO, heavy price-data upkeep.
- **Vector DB cost comparator** (Pinecone/Qdrant/pgvector/managed-vs-self-host) - pairs with the hyperscaler pipeline, real curation burden.
- **A/B prompt judge scorecard** (blind human eval with win-rate + sign test) - strong learning/brand, lower search volume.
- **Latency budget planner** (TTFT + TPS → perceived-UX verdicts) - solid, but closest cousin `streaming-response-player` should get usage data first.
- **Secret/API-key scanner** - remains on ice per Rohit (2026-06-19).

## Build order & batching

Ship in pairs and verify between: (1+3) zero-dep, pure logic - fastest wins; then (2+6) the two "wow" apps; then (4+5) the data-curation pair. After EACH pair: build + vitest + full e2e (must stay green: currently 144/144 → grows by 2 per app), update parking-lot + memory backlog (shipped items removed per the locked logging discipline), commit both repos per the dual-repo recipe, batched commits.

*Blueprint authored 2026-07-05. When an app ships, delete its section reference from the parking lot and memory backlog in the same commit (locked rule).*
