---
# /stack entry template. Copy this file to <slug>.md and fill in.
# Methodology: .gekro/docs/stack-standard.md
# Key invariants enforced by Zod (build fails if violated):
#   - badAt must have >= 1 item (affiliate-fatigue defense)
#   - goodAt must have >= 2 items
#   - droppedReason required when status === 'dropped'
#   - lastVerified is required (ISO YYYY-MM-DD)

name: "Example Tool"
category: "llm-client"   # llm-client | editor | infra | observability | data | devtool | hardware | service
tagline: "One-line summary, max 80 characters."

status: "active"          # active | watching | dropped
publishedAt: "2026-05-15"
lastVerified: "2026-05-15"

# Two sentences. First commits to a recommendation. Second qualifies it
# with a specific case where it shines or fails.
verdict: "Strongly recommend for solo engineers running multi-file refactors on local repos. Falls over above 30 open tabs and the cloud sync occasionally drops context mid-edit."

priceTier: "paid-tier"    # free | paid-tier | paid-only | enterprise
pricingNotes: "$20/mo Pro tier; free trial limited to 2000 completions/mo."

# REQUIRED. Min 2 items. Each item pairs a capability with a number,
# screenshot, or specific workflow - no marketing adjectives.
goodAt:
  - "Multi-file refactor with full repo context. A 200-line change completes in ~4 seconds on M4 Pro."
  - "Tab-to-accept inline edits without breaking flow. Faster than copy-pasting from Claude or ChatGPT."
  - "Codebase search by intent ('where do we initialise the LLM client') routinely beats grep on undocumented code."

# REQUIRED. Min 1 item. Zod refuses an empty array.
# This is the structural defense against affiliate fatigue.
badAt:
  - "Loses chat context after about 30 tabs open in the workspace."
  - "Pricing jumped 30% in Q1 2026 with no warning email."
  - "Sync glitches on flaky wifi corrupt the local index until manual rebuild."

# Optional comparison table - rendered automatically in the "How it compares"
# section between the cons block and the markdown body.
comparisonTable:
  headers: ["Feature", "Example Tool", "Alternative A", "Alternative B"]
  rows:
    - ["Inline edit",         "Yes",       "Yes",        "Yes"]
    - ["Multi-file refactor", "Excellent", "Good",       "Limited"]
    - ["Context window",      "200K",      "1M",         "128K"]
    - ["Local mode",          "No",        "Yes",        "Yes"]
    - ["Price (Pro)",         "$20/mo",    "$15/mo",     "$10/mo"]
  highlight: "Example Tool"
  caption: "Feature snapshot as of 2026-05-15."

# Optional benchmark / pricing bar chart - same section.
barChart:
  title: "Refactor latency on a 200-line file (lower is better)"
  unit: "sec"
  bars:
    - { label: "Example Tool",   value: 4, highlight: true }
    - { label: "Alternative A",  value: 9 }
    - { label: "Alternative B",  value: 6 }
  source: "Measured on Mac Mini M4 Pro 64GB, 2026-05-15. Same prompt, same repo, three runs averaged."

# Optional. Slugs of other /stack entries OR plain competitor names.
alternatives: ["windsurf", "github-copilot", "Aider"]

homepage: "https://example.com/"
referralLink: "https://example.com/?ref=gekro"   # Optional

# Optional cross-links. Slugs only, no leading slash. Omit to skip.
relatedPost: "ai-codes-like-genius"
# relatedExperiment: ""

# 2-sentence plain-text distillation for /llms-full.txt (AI-citation friendly)
aiSummary: "Example Tool is the best AI-first editor for solo engineers running multi-file refactors against a local codebase, but its context window collapses past 30 tabs and pricing has spiked. Recommended for daily use with the caveat that it is not a long-context tool."

# Only fill droppedReason when status === 'dropped'. Otherwise leave out.
# droppedReason: "Replaced by Y in May 2026. Context window stopped scaling and pricing doubled with no warning."
---

## Why I tried it

A short paragraph or two on the real moment that triggered the evaluation. Specific. No "Picture this." Avoid marketing tone - this is the engineer's first-person account.

## When I'd skip it

One or two paragraphs. "If you're doing X, use Y instead." Name the specific alternative.

## My setup

Optional. One paragraph on how Rohit specifically uses the tool. Settings, integrations, plugins, keyboard shortcuts. The "verified engineer" detail that proves real usage.

## Where it goes next

One or two sentences. Is this on the watch-list to drop, or sticking around?
