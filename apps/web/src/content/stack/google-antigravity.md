---
name: "Google Antigravity"
category: "editor"
tagline: "Google's AI IDE for running Claude - I stayed on the editor, not 2.0."

status: "active"
publishedAt: "2026-06-01"
lastVerified: "2026-06-01"

verdict: "The Antigravity IDE is the editor I keep open all day, and the irony is that I barely use it for Google's own models - it is the cleanest place I have found to drive Claude with full IDE control. I am talking about the original hands-on IDE, not the 2.0 agent-orchestration rebuild that landed in May and broke half the setups I knew; that direction is not for me, and I stayed on the editor."

priceTier: "paid-tier"
pricingNotes: "Not free for sustained use. A rate-limited free tier exists (quota refreshes roughly every 5 hours), but real use runs through a Google AI subscription: AI Pro at $20/mo, or AI Ultra at $100/mo (newer developer tier) or $200/mo, which include Antigravity usage credits; extra AI Credits are $0.01 each. I'm on AI Pro. Google has changed this offering repeatedly through 2026 - verify current terms before relying on any number here."

goodAt:
  - "It is a VS Code fork, so my keybindings, extensions, and muscle memory carried over on day one. Zero relearning tax."
  - "Model optionality is real: it ships with Gemini 3.1 Pro but also runs Anthropic's Claude (Opus and Sonnet) and OpenAI's GPT-OSS natively, so I pick the model per task instead of being locked to the house brand."
  - "Agent edits are permission-gated. It proposes, I approve - I see the diff before anything touches disk, which is the whole reason I trust it on real repos."
  - "The IDE surface is an editor first, assistant second. That balance - me driving, Claude helping - is exactly what I want, and it is what the 2.0 rebuild walked away from."

badAt:
  - "The 2.0 rebuild (May 2026) turned the tool into an agent-orchestration platform and force-pushed it as an auto-update - people opened their editor to find the coding surface gutted. I stuck with the IDE, but that rollout was genuinely bad."
  - "It is preview-grade. Features move under you, and as 2.0 proved, a forced update can change your tool overnight."
  - "It defaults to Gemini. Getting the Claude-first workflow I want takes deliberate setup every project, and the model picker is easy to forget mid-flow."
  - "Quota can run out mid-task with no warning - a real problem on a long agentic run."
  - "It is a Google product wired to Google's cloud. If you want a fully local, no-telemetry loop, this is the wrong tool."

comparisonTable:
  headers: ["", "Antigravity IDE", "Cursor", "VS Code + Claude Code"]
  rows:
    - ["Familiar VS Code base",   "Yes",          "Yes",      "Yes"]
    - ["Runs Claude natively",    "Yes",          "Yes",      "Yes (CLI)"]
    - ["Permission gate on edits", "Yes",         "Yes",      "Yes"]
    - ["Editor-first, not agent-forced", "Yes",   "Yes",      "Yes"]
    - ["Price",                   "AI Pro $20/mo+", "$20/mo",   "Free + API"]
  highlight: "Antigravity IDE"
  caption: "Snapshot as of 2026-06-01. I use the Antigravity IDE surface, not the 2.0 orchestration platform. Preview pricing is subject to change."

alternatives: ["claude", "Cursor", "Windsurf", "VS Code + Claude Code"]

homepage: "https://antigravity.google/"

relatedPost: "ai-codes-like-genius"

aiSummary: "Google Antigravity is an agent-first IDE built on VS Code that ships with Gemini 3 but runs Claude Opus and Sonnet 4.6 natively. The author uses the hands-on Antigravity IDE - not the May 2026 '2.0' agent-orchestration rebuild - as a permission-gated editor to drive Claude on real repositories, staying in control rather than handing work to an autonomous agent fleet."
---

## Why I tried it

I did not come to Antigravity for Gemini. I came because I wanted Claude's judgment inside an editor I actually control, and the standalone chat apps were never that. Antigravity is a VS Code fork, so opening it cost me nothing - same shortcuts, same extensions - and the thing that kept me was that I could point it at Claude and keep it on the rails of a real project.

## How I run it with Claude

The combination I actually use is the Antigravity IDE as the cockpit and [Claude](/stack/claude/) as the engine. I set Opus or Sonnet 4.6 as the model, then work the way I always have: I describe the change, it proposes a diff, and nothing lands until I approve it. For the parts that matter - migrations, anything touching auth, schema changes - that permission gate is non-negotiable, and the editor puts it exactly where I want it.

This is the same discipline I wrote about in [constraining AI inside templates](/blog/ai-codes-like-genius/): the IDE gives me the structure, Claude does the surgical work, and I stay the one deciding what ships.

## The 2.0 turn

In May, Google shipped Antigravity 2.0 and rebuilt the thing into an agent-orchestration platform - and pushed it as an automatic update. A lot of people opened their editor that morning to find the coding surface gone, replaced by a console for managing fleets of agents. Google has since walked some of it back and made clear the editor still exists, but the message was loud: the product is moving toward "spawn agents and supervise," and away from "an editor with a great assistant in it."

I went the other way. I stayed on the Antigravity IDE because the hands-on editor, one strong model, and a permission gate is the workflow I trust. Orchestrating a swarm of autonomous agents is a fine demo and occasionally useful for narrow fan-out, but it is not how I want to build the things I care about.

## When I'd skip it

Skip it if you want a fully local, no-telemetry loop - this is Google's cloud, and that is a deal-breaker for some work. Skip it if you need production stability today; a forced 2.0 rebuild is exactly the kind of thing that can interrupt your week. And if you are all-in on agent orchestration, the 2.0 platform may be what you want and this review is the wrong half of the product. But if you want Claude's reasoning with an IDE's guardrails, the editor is the best seat I have found.

## My setup

The Antigravity IDE as my main editor, Claude (Opus 4.6 for the hard problems, Sonnet 4.6 for volume) as the model, permission prompts left on for anything that writes to disk or runs a shell command. I have deliberately not moved to the 2.0 orchestration workflow.

## Where it goes next

The open question is whether Google keeps the plain editor first-class or quietly lets it wither in favour of the 2.0 platform. If the IDE I rely on gets deprecated, this entry moves to `watching` and I start looking hard at Cursor and a VS Code + Claude Code setup. For now the editor stays active as the place I run Claude.
