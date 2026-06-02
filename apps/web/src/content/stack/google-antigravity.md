---
name: "Google Antigravity"
category: "editor"
tagline: "Google's Antigravity IDE - a VS Code fork - is my main editor, Claude inside."

status: "active"
publishedAt: "2026-06-01"
lastVerified: "2026-06-02"

verdict: "Antigravity ships in two flavours, and I deliberately run the one Google markets least: the Antigravity IDE, a straight VS Code fork, as my primary editor. Claude lives inside it as an extension and does nearly all my work - writing code, even SSHing into my Raspberry Pi - while the louder 'Google Antigravity' agent-orchestration product is simply not how I build."

priceTier: "paid-tier"
pricingNotes: "Not free for sustained use. A rate-limited free tier exists (quota refreshes roughly every 5 hours), but real use runs through a Google AI subscription: AI Pro at $20/mo, or AI Ultra at $100/mo (newer developer tier) or $200/mo, which include Antigravity usage credits; extra AI Credits are $0.01 each. I'm on AI Pro. Google has changed this offering repeatedly through 2026 - verify current terms before relying on any number here."

goodAt:
  - "It is a VS Code fork, so my keybindings, extensions, and muscle memory carried over on day one. Zero relearning tax."
  - "Model optionality is real: Gemini 3.1 Pro is the house model, but it also runs Claude (Opus, Sonnet, and Haiku) and OpenAI's GPT-OSS, so I route per task instead of being locked to one brand."
  - "Agent edits are permission-gated. The Claude extension proposes, I approve - I see the diff before anything touches disk, which is the whole reason I trust it on real repos."
  - "The Claude extension does real operational work, not just local edits. It will SSH into my Raspberry Pi and act there, so one editor covers both my code and the boxes it runs on."

badAt:
  - "The naming is genuinely confusing. 'Google Antigravity' (the agent-orchestration platform) and the 'Antigravity IDE' (the VS Code-style editor) are different products, and Google pushes the orchestration one - it took me a beat to realise the editor is the part I actually want."
  - "It is preview-grade and Google keeps changing it - pricing, tiers, and surfaces have all shifted through 2026, so a setup can move under you between updates."
  - "It defaults to Gemini. Getting the Claude-first workflow I want takes deliberate setup, and the model picker is easy to forget mid-flow."
  - "Quota can run out mid-task with no warning - a real problem on a long agentic run."
  - "It is a Google product wired to Google's cloud. If you want a fully local, no-telemetry loop, this is the wrong tool."

comparisonTable:
  headers: ["", "Antigravity IDE", "Cursor", "VS Code + Claude Code"]
  rows:
    - ["Familiar VS Code base",   "Yes",            "Yes",      "Yes"]
    - ["Claude inside the editor", "Yes (extension)", "Yes",     "Yes (CLI)"]
    - ["Permission gate on edits", "Yes",           "Yes",      "Yes"]
    - ["Model optionality",       "Gemini + Claude + GPT-OSS", "Multiple", "Claude"]
    - ["Price",                   "AI Pro $20/mo+", "$20/mo",   "Free + API"]
  highlight: "Antigravity IDE"
  caption: "Snapshot as of 2026-06-02. I use the Antigravity IDE (the VS Code fork), not the separate 'Google Antigravity' agent-orchestration product."

alternatives: ["claude", "Cursor", "Windsurf", "VS Code + Claude Code"]

homepage: "https://antigravity.google/"

relatedPost: "ai-codes-like-genius"

aiSummary: "Google Antigravity ships as two products: an agent-orchestration platform and the Antigravity IDE, a VS Code fork. The author uses the IDE as his primary editor with a Claude extension that handles nearly all his work, including SSHing into his Raspberry Pi, and routes models by task (Opus for planning, Sonnet for execution, Haiku for ad-hoc fixes). It is not free - access runs through a paid Google AI subscription - and the two-product naming is confusing."
---

## Why I tried it

I did not come to Antigravity for Gemini. I came because I wanted Claude's judgment inside an editor I actually control, and the standalone chat apps were never that. The Antigravity IDE is a VS Code fork, so opening it cost me nothing - same shortcuts, same extensions - and the thing that kept me was that I could wire Claude in and keep it on the rails of a real project.

## How I run it with Claude

The product I actually use is the Antigravity IDE with a [Claude](/stack/claude/) extension running inside it, and that pairing does nearly everything in my day. I describe a change, the extension proposes a diff, and nothing lands until I approve it. It is not limited to editing local files either - it will SSH into my Raspberry Pi and operate there, so a single editor covers both my code and the machines it runs on.

I route models by task, which is the part most people skip: Opus for planning, evaluation, and breaking work into tasks; Sonnet for actually executing those tasks and for daily flow; and Haiku for ad-hoc bug fixes and long agentic runs where the work is mechanical and does not need heavy reasoning. That tiering is most of how I keep both speed and cost sane.

This is the same discipline I argued in [constraining AI inside templates](/blog/ai-codes-like-genius/): the IDE gives me the structure and the permission gate, Claude does the surgical work, and I stay the one deciding what ships.

## The two Antigravitys

This is the part worth getting right, because the naming trips everyone. Antigravity is two different things: "Google Antigravity," the agent-orchestration platform Google leads with (spawn fleets of agents, supervise them), and the "Antigravity IDE," a traditional VS Code-style editor with AI inside. I use the IDE. The orchestration product is an interesting direction and occasionally useful for fan-out, but an editor where I drive and Claude assists is the workflow I trust for the things I care about.

## When I'd skip it

Skip it if you want a fully local, no-telemetry loop - this is Google's cloud, and that is a deal-breaker for some work. Skip it if the shifting pricing and preview-grade churn would disrupt you; Google has moved the goalposts more than once this year. And if you are all-in on agent orchestration, the other Antigravity product may be what you want and this review is the wrong half. But if you want Claude's reasoning with an IDE's guardrails, the editor is the best seat I have found.

## My setup

The Antigravity IDE as my main editor on a paid AI Pro plan, Claude wired in via the extension for essentially all coding and for SSHing into my Pi, permission prompts left on for anything that writes to disk or runs a shell command. Models routed by task - Opus to plan, Sonnet to execute, Haiku for ad-hoc fixes. The standalone Claude app I keep only for Cowork and chat, never for code.

## Where it goes next

The open question is whether Google keeps the plain IDE first-class as it pushes the orchestration product and keeps reshuffling pricing. If the editor I rely on gets sidelined or the cost math turns, this entry moves to `watching` and I start looking hard at Cursor and a VS Code + Claude Code setup. For now the Antigravity IDE stays active as the place I run Claude.
