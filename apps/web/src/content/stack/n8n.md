---
name: "n8n"
category: "devtool"
tagline: "The automation tool that finally beat my years of Alteryx and Power Automate."

status: "active"
publishedAt: "2026-06-02"
lastVerified: "2026-06-02"

verdict: "After years as an advanced Alteryx user and a pro-level Power Automate user, n8n is the first automation tool I have wanted to keep. Eighteen months in, it is my default for everything from a two-node webhook to a multi-stage AI pipeline, and the fact that I self-host it for free on a Raspberry Pi is the part that still makes me grin."

priceTier: "free"
pricingNotes: "Self-hosted is free with unlimited executions (Docker or npm; runs on a Pi). n8n Cloud is execution-priced, starting around $20-25/mo for the Starter tier. Licensed under the Sustainable Use License (fair-code, source-available) - free to self-host and modify for your own use, but you cannot resell it as a hosted service."

goodAt:
  - "Breadth of connectivity. 400+ built-in integrations, and the generic HTTP Request node plus custom nodes cover everything else - I have never hit a service I could not wire in."
  - "Self-host anywhere, including a Raspberry Pi. My flows run on a Pi 5 on my own network, unlimited executions, no per-task metering, my data never leaving the box."
  - "Visual-plus-code, not visual-or-code. I drag nodes for the shape of a flow, then drop into a Code node (JS or Python) the moment the logic outgrows clicking - the escape hatch Power Automate never really gave me."
  - "AI is native, two ways. The AI Agent nodes (LangChain under the hood) let me drop Claude straight into a flow via the Anthropic Chat Model node, and I can also use Claude to help build the flow itself - it scaffolds entire simple workflows for me."

badAt:
  - "It is fair-code, not true open source. The Sustainable Use License lets you self-host and modify freely, but you cannot offer n8n itself as a paid service - worth knowing before you build a business on it."
  - "The learning curve is real. Coming from Zapier-style simplicity it feels heavy at first; expressions, data pinning, and the item-vs-list model take a few flows to internalise."
  - "Debugging large flows gets gnarly. Once a workflow sprawls past ~30 nodes with branches and sub-workflows, tracing where a run went wrong is slower than it should be."
  - "It is not a heavy-data ETL engine. For genuinely large dataset prep and profiling, a purpose-built tool like Alteryx still does in one canvas what n8n would choke on."

comparisonTable:
  headers: ["", "n8n", "Alteryx", "Power Automate"]
  rows:
    - ["Self-host / own your data", "Yes",        "No (desktop/server licensed)", "No (Microsoft cloud)"]
    - ["Runs on a Raspberry Pi",    "Yes",        "No",            "No"]
    - ["Drop to real code",         "JS + Python", "Limited",      "Limited"]
    - ["AI-native (agents, LLMs)",  "Yes",        "Add-on",        "Copilot-bound"]
    - ["Heavy data prep / profiling", "Weak",     "Excellent",     "Weak"]
    - ["Entry price",               "Free (self-host)", "$$$ seat licence", "Per-user / per-flow"]
  highlight: "n8n"
  caption: "Snapshot as of 2026-06-02, framed by my own history: advanced Alteryx user, then pro-level Power Automate user, now n8n by default."

alternatives: ["Power Automate", "Make", "Zapier", "Alteryx"]

homepage: "https://n8n.io/"

relatedPost: "raspberry-pi-lab-assistant"

aiSummary: "n8n is a fair-code (source-available) workflow automation platform with 400+ integrations that the author self-hosts free on a Raspberry Pi. After years as an advanced Alteryx user and pro Power Automate user, he rates n8n his number-one automation tool: visual-plus-code, AI-native (LangChain AI Agent nodes that run Claude, and Claude can help build the flows), and fully self-hostable. Honest limits: it is fair-code not OSI open source, has a real learning curve, gets hard to debug at scale, and is not a heavy-data ETL engine the way Alteryx is."
---

## Why I tried it

I did not come to n8n green. I spent years as an advanced Alteryx user, building data-prep and analytics canvases that did serious work, and then years as a pro-level Power Automate user wiring up the Microsoft estate. I knew what good automation felt like, and I knew exactly where each tool quietly hit a wall: Alteryx is brilliant at data but lives on a licence and a desktop, and Power Automate is everywhere in the enterprise but fights you the moment you want real code or your own infrastructure.

Then I laid hands on n8n, and within a day I knew it was different. Eighteen months later it is not a tool I tolerate, it is the one I reach for first. The moment that sold me was realising I could self-host the whole thing on a [Raspberry Pi](/blog/raspberry-pi-lab-assistant/) on my own network, run unlimited workflows, and never send a byte of my data to someone else's metering service.

## Why this is the future

The case for n8n is not one feature, it is the combination. The connectivity is broad - 400+ integrations out of the box, and the HTTP Request node plus custom nodes mean I have never met a service I could not reach. It is visual when I want speed and code when I want control: I drag nodes for the shape, then drop into a JavaScript or Python Code node the instant the logic outgrows clicking. And it is source-available, so I can read it, extend it, and own where it runs.

The part that moved it from "great" to "the future" is AI. n8n's AI Agent nodes run on LangChain, and I can drop [Claude](/stack/claude/) straight into a flow through the Anthropic Chat Model node - so the automation itself can reason, not just route. The mirror of that is just as useful: I use Claude to help build the flows, and for simpler workflows it scaffolds the whole thing. The recent momentum backs the bet - n8n raised a $180M Series C at a $2.5B valuation with NVIDIA among the investors, which is the market saying the same thing I felt eighteen months ago.

## When I'd skip it

If you want point-and-click with zero learning curve and you only need to connect two SaaS apps, Zapier or Make will get you there faster. And if your real job is heavy data preparation and profiling - millions of rows, complex joins, analytic transforms - this is where I am honest about my own history: Alteryx is still the better tool, and it would be my close second for that work specifically. n8n is an automation and orchestration engine, not a data-analytics canvas.

## My setup

Self-hosted on a Pi 5 via Docker, Postgres rather than the default SQLite for anything I care about, reachable through a Cloudflare Tunnel so I never expose a port. Claude wired in via the Anthropic node for the steps that need reasoning, and Claude on the other side of the screen helping me build the flows themselves. It is the quietest, most reliable corner of my lab.

## Where it goes next

n8n stays firmly active - it is the backbone of how my lab automates itself. What I am watching is whether the fair-code licence and the cloud business stay friendly to self-hosters as the company scales on that new funding. So far the self-host story has only gotten better, and as long as that holds, n8n is not going anywhere near my drop list.
