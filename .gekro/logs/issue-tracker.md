# Gekro Lab — Issue Tracker

This log tracks bugs, user complaints, and regressions. Every entry must include a **Root Cause Analysis (RCA)** to prevent recurrence.

| Date/Time | Issue | Root Cause Analysis | Fix |
|---|---|---|---|
| 2026-03-24 00:30 | Experiment Detail Pages Redirection | Sanity-based fetch was failing due to missing/incomplete data, and the hardcoded fallback lacked the `props` needed for `ExperimentLayout`, causing a route failure/redirect. | Migrated to local-first Content Collections. |
| 2026-03-24 00:46 | ExperimentCard Syntax Error | Manual refactor accidentally stripped the opening `---` frontmatter fence, causing an Astro compiler failure. | Restored frontmatter fences. |
| 2026-03-24 01:00 | Invisible Experiment Cards | GSAP animations on the index page were targeting `.post-card` but were not triggered correctly, and cards had hardcoded `opacity-0`. | Removed hardcoded `opacity-0` and refined GSAP triggers. |
