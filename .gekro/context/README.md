# `.gekro/context/` — Agent Knowledge Base

This directory is the **deep reference layer** for AI coding agents working on gekro.com. The root [CLAUDE.md](../../CLAUDE.md) gives the high-level orientation; these files zoom into specific dimensions without bloating every session's context window.

Load the specific file you need, not the whole directory.

## Files

| File | When to load it |
|---|---|
| [architecture-map.md](architecture-map.md) | You need to locate a file, understand the monorepo layout, or trace the Turborepo / pnpm workspace wiring. |
| [components.md](components.md) | You need to find or modify a component and want to know what each one does + where it's consumed. |
| [pages.md](pages.md) | You're touching a route, understanding data flow into a page, or wiring up a new route. |
| [conventions.md](conventions.md) | You're about to write or review code and need the distilled rule set (code quality, naming, animations, perf, SEO, a11y, git). |
| [history.md](history.md) | You need historical context — why a decision was made, what issues have been seen, which claims in older docs are stale. |

## Agent-agnostic

These files are shared by Claude Code and Gemini CLI. Don't add agent-specific instructions here — those belong in `CLAUDE.md` / `GEMINI.md`. Don't duplicate the decision log or issue tracker here — those live in `.gekro/logs/` and are updated in real time.

## Maintenance

Update these files when:
- A file or folder is renamed/moved (architecture-map)
- A component is added/removed/heavily refactored (components)
- A route is added/removed (pages)
- A new project-wide convention is adopted (conventions)
- A decision or incident was significant enough to distil into lessons (history)

Keep entries terse. These files exist to **save future context window**, not to be comprehensive documentation.
