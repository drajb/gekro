# Gekro — Agent Context (GEMINI.md)

> This file is a thin pointer. The canonical agent context lives in **[CLAUDE.md](CLAUDE.md)** and the knowledge base under **[.gekro/context/](.gekro/context/)** — they are intentionally agent-agnostic and shared by Claude Code and Gemini CLI.

## Start here

1. **Read [CLAUDE.md](CLAUDE.md) first** — stack summary, monorepo layout, data flow, commands, env vars, governance rules. Everything in it applies to Gemini identically.
2. **Before any non-trivial change, read the always-on governance files:**
   - [.agents/rules/project-rules.md](.agents/rules/project-rules.md) — workspace rules (code, animation, perf, SEO, content, git, design, a11y)
   - [.agents/rules/decisions-issues.md](.agents/rules/decisions-issues.md) — pre-flight + override protocol
   - [.gekro/logs/decision-log.md](.gekro/logs/decision-log.md) — active architectural decisions
   - [.gekro/logs/issue-tracker.md](.gekro/logs/issue-tracker.md) — known pitfalls with RCAs
3. **Deep navigation when you need it:** [.gekro/context/](.gekro/context/)
   - `architecture-map.md` — file-level map
   - `components.md` — every component catalogued
   - `pages.md` — routes + data sources
   - `conventions.md` — distilled rules
   - `history.md` — decision + issue highlights

## Content Protection Protocol — applies to Gemini identically

Published article markdown and the `.content-backup/` snapshot are off-limits without explicit user instruction. See **[CLAUDE.md §6a](CLAUDE.md)** and **[.agents/rules/content-protection.md](.agents/rules/content-protection.md)** — the rules are agent-agnostic and bind Gemini CLI, Antigravity, and any other Google-family agent equally.

The override phrase for refreshing `.content-backup/` is literally **`cross sync content backup`**. No paraphrase counts. Full procedure: [.content-backup/AGENT_PROTOCOL.md](.content-backup/AGENT_PROTOCOL.md).

Supporting enforcement for Gemini/Antigravity: **`.aiexclude`** and **`.geminiignore`** at repo root block the directory at the file-visibility layer. Honour both.

## Dual-agent coordination

This repo is worked on by both Claude Code and Gemini CLI. Treat `.gekro/logs/decision-log.md` and `.gekro/logs/issue-tracker.md` as **shared mutable state** — append in real time, commit in batches, so the other agent picks up your context at the start of their next session.

The override protocol ("stop, cite, wait for literal 'Override'") applies to **both agents**. If you find yourself about to contradict a logged decision, stop and ask.

## When to update this file

Only when Gemini-specific workflows diverge from the shared ones. Otherwise keep this file as a pointer — changes to agent context belong in `CLAUDE.md` (the canonical copy) or in `.gekro/context/`.
