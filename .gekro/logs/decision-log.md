# Gekro Lab — Decision Log

This log tracks architectural and technical decisions. Before implementing counter-intuitive requests, the agent will cross-reference this log and request an **Override** if a conflict is found.

| Date/Time | Decision | Rationale | Implications | Override Count |
|---|---|---|---|---|
| 2026-03-24 00:10 | Use "Technical SVG Schematics" for Lab Gallery | Physical photos are hard to maintain and can feel dated. SVG schematics reinforce the "Engineering Lab" aesthetic. | Consistency in visual storytelling across About/Gallery pages. | 0 |
| 2026-03-24 00:40 | Migrate Experiments to Content Collections | Sanity-based fetching proved fragile for core site features. Local Markdown files provide better build-time stability and SEO. | Local-first architecture; removed Sanity dependency for experiments. | 0 |
| 2026-03-24 01:10 | "Authoritative Engineering Lab" Persona | Shift site tone from "Personal Blog" to "Live Engineering Log." | Impacted all copy, footer heartbeat, and technical depth in posts. | 0 |
| 2026-03-24 01:15 | Continuous Issue & Decision Logging | To prevent development cycles and regressions per user request. | Agent must read logs before every planning/execution phase. | 0 |
| 2026-03-24 02:00 | Gekro "Deep Dive" Content Standard | Establish a rigid structure for technical posts to ensure authority, depth, and persona consistency. | Rewriting 8 posts; impacts all future content structure and voice. | 0 |
