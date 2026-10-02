# awesome-llm-apps review (2026-10-02)

Source: https://github.com/shubhamsaboo/awesome-llm-apps. Research agent read the full repo (read-only, nothing executed). Status: **report done; nothing implemented yet; Rohit has not picked from the shortlist.**

## Repo facts
- License Apache-2.0 at root (blank copyright line, no NOTICE). Five `generative_ui_agents/*` folders are MIT (Atai Barkai x4, Tyler Slaton x1). Skills in `ai-mcp-app-builder` Apache-2.0.
- 140,555 stars, 20,646 forks, last push 2026-09-30. 222 MB; Windows clone needs `core.longpaths=true`.
- About 151 projects + 2 crash courses (Google ADK, OpenAI Agents SDK) across 11 folders. Stack: Streamlit, OpenAI, Agno, Gemini, Claude, LangChain, Ollama, FastAPI, Qdrant, ADK, MCP.
- **Key finding: no code is liftable.** Every project needs a Python or Next.js process and almost all need a cloud API key. Only ideas transfer.

## Portable gekro app shortlist (client-only, no key, no LLM calls)
| Slug | Cat | What it does | Inspired by | Overlap | Effort |
|---|---|---|---|---|---|
| `agent-skill-linter` | ai | Validate SKILL.md vs agentskills.io spec, description/trigger checks, flag `curl \| sh`, base64-exec, credential reads; trigger-collision grid | agent_skills/evals | system-prompt-linter (neighbour) | M |
| `mcp-config-builder` | ai | Verified server catalog x client (Claude Desktop, .mcp.json, Cursor, VS Code, Gemini CLI, Antigravity) x OS; Windows `cmd /c` wrapper; env placeholders only | MCP agents | complements mcp-server-tester | M |
| `agent-permission-tester` | ai | Paste Claude Code allow/ask/deny rules, test tool calls, see decision + matching rule + precedence (label as simulator; follow documented rules exactly) | ai_agent_governance, trust_layer | none | M |
| `toon-format-converter` | ai | JSON to TOON/CSV/YAML/min JSON with token counts and cost; honest about where TOON loses | toonify | config-converter | S-M |
| `tool-output-compressor` | ai | Keep head/tail/anomaly/keyword rows of tool output or logs; tokens and cost before/after | headroom | agent-loop-cost-estimator | M |
| `agent-topology-planner` | ai | Sequential/parallel/loop/router/MoA/advisor-worker/blind panel cost + critical path vs one model (or a tab in agent-loop-cost-estimator) | MoA, advisor-orchestrator-worker, llm-panel | agent-loop-cost-estimator | M |
| `diff-scope-checker` | dev | Unified diff + one-line intent: flag unrelated files, new deps, renames, CI edits, big hunks | scope-creep-detector | text-diff | M |
| `dependency-manifest-linter` | dev | requirements.txt / pyproject / package.json problems + semver range explainer | dependency-doctor, release-radar | none | S-M |
| `rag-failure-triage` | ai | Symptom decision tree to failure pattern + fix, routing to rag-chunk-inspector / embedding-playground / rag-eval-toolkit | failure-diagnostics-clinic | complements those | S |
| `seo-meta-auditor` | dev | Paste HTML: title/description length, headings, canonical, OG preview, JSON-LD parse, alt coverage | seo-audit team | none | M |
| `debt-payoff-planner` | finance | Avalanche vs snowball month by month, interest saved | financial-coach | amortization-calculator (single loan) | S |
| `audit-chain-verifier` | ai | Recompute SHA-256 prev_hash chains, find first break, tamper demo | trust-gated-team | hash-generator | S-M |

Recommended first four: agent-skill-linter, mcp-config-builder, agent-permission-tester, toon-format-converter. debt-payoff-planner is the biggest pure-traffic play.
Caveats: npm returns 404 for `@modelcontextprotocol/server-fetch` and marks `server-github` deprecated (checked 2026-10-02), a hook for mcp-config-builder. The linter must not become the on-ice Secret/API-key Scanner. A judge-agreement tool overlaps the parked "A/B prompt judge scorecard": ask Rohit first. **Log any approved idea in apps-parking-lot.md + app_ideas_backlog.md before building.**

## Content ideas
- Blog: "Calculators wearing an agent costume" (LLMs used for plain formulas; fair tone, not a dunk). Nearest: ai-codes-like-genius.
- Blog: "Fencing Claude Code off my own content" (deny rules + content protection as governance). Pairs with agent-permission-tester.
- Experiments: TOON vs JSON on TeslaMate/OHLC payloads (near token-economics); x402 seller on a Pi 5 with budget caps (near pi5-mcp-orchestrator); advisor/worker with Ollama workers + Claude advisor; local RAG Pi 5 vs M4 Pro (near self-hosted-llm); auditing `.claude/skills` supply chain.
- Stack reviews only for tools Rohit actually uses: Google ADK, OpenRouter, Qdrant, Unsloth.

## Site enhancements
1. Curated "Start here" gallery on /apps using existing OG images (optional `featured` field needs a decision-log entry).
2. Category intros (DONE 2026-10-02 via category hubs).
3. `/api/apps.json` next to `api/posts.json.ts`.
4. Topic hubs that mix posts, news, apps and stack entries (`pages/topics/[topic].astro`).
5. "The bar" checklist in the /apps hero: client-only, no key, sourced data, last-verified, e2e-tested.
6. Monthly new-tool newsletter prompt on /apps and AppShell (NewsletterEmbed).
7. GitHub: README says "75+" apps (now 92); add screenshot gallery; mark pnpm-lock.yaml `linguist-generated`.
8. Homepage "run one now" deep-link row.
9. /news: deterministic pre-scoring before the LLM picks (keyword hits x16 + capped comments/3 + capped points/10 + freshness).
Don't borrow: sponsor banners, trending badges, emoji-heavy headings.

## Licensing
Ideas are free; write from public specs (agentskills.io, TOON spec MIT, Claude Code docs) to keep MIT. Porting their code or regex lists makes that part Apache-2.0 derivative: keep notice, state changes, add to LICENSES/. Credit line: "Inspired by [project] in Shubhamsaboo/awesome-llm-apps (Apache-2.0)". Never copy README prose, the 12-pattern RAG table wording, gallery images, Unwind AI tutorials, or names/logos implying endorsement. Check their model names against gekro's model canon before reuse.
