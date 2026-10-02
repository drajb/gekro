# App rename proposal (2026-10-02) - APPLIED 2026-10-02

> Rohit approved on 2026-10-02 ("Renames are ok. Update the verification dates."). All 32 titles and all 13 lastVerified bumps below were applied exactly as listed. NOT applied (not part of the approval): the optional GB to GiB wording pass in the guide bodies, and old names quoted in blog prose (e.g. token-economics.md; its links use the unchanged slugs, so nothing breaks).

Rohit asked for simple, popular names over mechanical ones because they drive more search traffic. **Titles only; slugs stay unchanged** so every indexed URL, backlink and share link keeps working (a slug change would need redirects and resets ranking).

Each change is a single `title:` line in `apps/web/src/content/apps/<slug>.md`. Content Protection (CLAUDE.md §6a) blocks editing those files without an instruction naming them, so nothing here is applied yet. To apply: reply with "approve renames" (all) or list the slugs to apply.

Page titles also get the automatic " - Free Online Tool | gekro" suffix when it fits 60 characters (`lib/utils/apps-seo.ts`), so the names below are short on purpose.

| Slug (unchanged) | Current title | Proposed title | Why |
|---|---|---|---|
| regex-playground | Regex Playground | Regex Tester | "regex tester" is the dominant query |
| text-diff | Text Diff / Code Compare | Diff Checker | dominant query; drops the slash |
| prompt-token-counter | Prompt Token Counter | Token Counter | broader, higher volume |
| options-pnl | Options P&L Calculator | Options Profit Calculator | "options profit calculator" is the head term |
| position-sizer | Position Sizer | Position Size Calculator | matches the query exactly |
| drawdown-calculator | Drawdown & Sharpe Calculator | Max Drawdown Calculator | head term; Sharpe stays in the description |
| tax-loss-harvester | Tax-Loss Harvest Optimizer | Tax-Loss Harvesting Calculator | users search "harvesting calculator" |
| india-ctc-salary-calculator | India CTC to In-Hand Salary Calculator | In-Hand Salary Calculator (India) | the Indian head query, shorter |
| india-tax-regime-comparator | Old vs New Tax Regime Comparator | Old vs New Tax Regime Calculator | "calculator" out-searches "comparator" |
| bmi-calculator | BMI & Health Metrics | BMI Calculator | exact head term |
| password-generator | Password & Passphrase Generator | Password Generator | head term |
| text-formatter | Text Formatter & Case Converter | Case Converter | head term |
| gradient-generator | Glass & Mesh Gradient Generator | CSS Gradient Generator | head term |
| base64-encoder | Base64 & URL Encoder | Base64 Encoder & Decoder | matches both directions people search |
| rich-text-to-markdown | Rich Text → Markdown | HTML to Markdown Converter | no arrow; the common query |
| json-schema-to-tool | JSON Schema → LLM Tool Definition | LLM Tool Schema Generator | no arrow; plain words |
| code-snippet-png | Code Snippet to PNG | Code to Image | "code to image" is the common query |
| dummy-data-generator | Dummy Data Generator | Mock Data Generator | developer term of choice |
| cron-builder | Cron Expression Builder | Cron Expression Generator | "generator" out-searches "builder" |
| device-info | Device & Browser Info | What Is My Browser | query-shaped name |
| hyperscaler-comparison | Hyperscaler AI Pricing - Bedrock vs Foundry vs Vertex | AI Cloud Pricing Comparison | 53 chars to 27; keeps vendors in the description |
| lora-memory-calculator | LoRA / QLoRA Memory Calculator | LoRA Memory Calculator | no slash |
| llama-cpp-config-builder | Llama.cpp / Ollama Config Builder | Ollama & llama.cpp Config Generator | leads with the bigger brand |
| local-model-recommender | Local Model Browser | Local LLM Picker | says what it does |
| model-benchmark | Model Benchmark Comparator | LLM Benchmark Comparison | common phrasing |
| mcp-trace-visualizer | MCP / Agent Trace Visualizer | MCP Trace Viewer | no slash |
| multimodal-token-counter | Multi-modal Token Counter | Image Token Calculator | what people actually search for |
| rate-limit-planner | LLM Rate-Limit Planner | LLM Rate Limit Calculator | "calculator" is the searched noun |
| translator | Translator (EN · ES · HI) | Offline Translator | the differentiator, no parenthetical |
| websocket-tester | WebSocket / SSE Live Tester | WebSocket Tester | head term; SSE stays in the description |
| systemd-unit-generator | systemd Unit File Generator | systemd Service Generator | "service file" is the common phrasing |
| vector-db-calculator | Vector DB Sizing & Cost Calculator | Vector Database Calculator | shorter, spelled out |

**Leave alone (already simple and popular):** JSON Formatter & Validator, LLM Cost Calculator, GPU VRAM Calculator, QR Code Generator, PDF Merger, Image Compressor, Word Counter, Unit Converter, Unix Timestamp Converter, JWT Decoder, Hash Generator, CSV to JSON Converter, Currency Converter, Amortization Calculator, Debt-to-Income Calculator, EV Charging Cost Calculator, Tesla Trip Cost Calculator, Tesla Charge Optimizer, Graphing Calculator, Dice Roller, Coin Flipper, Global Clock, Color Toolkit, Markdown Table Generator, HTML Viewer, Nginx Config Generator, SSH Config Generator, Ambigram Generator, and the AI-niche names where the mechanical term is the search term (Tokenizer Visualizer, RAG Chunk Inspector, GGUF Model Inspector, System Prompt Linter, etc.).

After approval also update: the sidebar and OG images regenerate automatically from `title`; `published_catalog` memory and any blog links that quote old names.

## Also awaiting approval: `lastVerified` date bumps (same Content Protection rule)

These apps had their data or memory math re-verified in the 2026-09/10 review, but their guide frontmatter still shows an old `lastVerified` (or none). That date drives the SoftwareApplication `dateModified` and the sitemap `lastmod`, so a stale value tells Google the page has not changed. Proposed: set `lastVerified: "2026-10-02"` in each file below (add the line where missing).

| File (`apps/web/src/content/apps/`) | Current | Reason |
|---|---|---|
| llm-cost-calculator.md | 2026-04-19 | prices refreshed 2026-09-11 (data.ts) |
| agent-loop-cost-estimator.md | 2026-06-19 | prices + Fable 5.1 / Gemini 3.7 added |
| llm-response-unpacker.md | 2026-04-24 | prices + new model rows |
| model-benchmark.md | 2026-04-24 | full roster + benchmark rewrite |
| multimodal-token-counter.md | none | prices + detail=auto fix |
| prompt-cache-optimizer.md | none | prices + 1h TTL text |
| reasoning-cost-calculator.md | none | reasoning-models.json refresh |
| lora-memory-calculator.md | none | GiB labelling |
| gpu-vram-calculator.md, llama-cpp-config-builder.md, local-model-recommender.md, apple-silicon-llm-configurator.md, inference-latency-estimator.md | 2026-08-28 | memory now computed in GiB |

Some of these guides also say "GB" where the tool now says "GiB"; worth a wording pass in the same approval.
