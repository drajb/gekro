---
name: "Claude"
category: "llm-client"
tagline: "The model I trust for real engineering - just not through its own app."

status: "active"
publishedAt: "2026-06-01"
lastVerified: "2026-06-01"

verdict: "Claude is the model I reach for when the code has to be right, and on hard, multi-file reasoning it is still the one I trust most. But I almost never open the Claude app to get there - I run it inside an IDE I control, because the standalone chat window is the part of the experience I actively avoid."

priceTier: "paid-tier"
pricingNotes: "Free tier; Pro $20/mo ($17/mo billed annually); Max 5x $100/mo, Max 20x $200/mo; API billed per token (Opus 4.6 is the current top model). I mostly drive it through the editor, so my real spend tracks usage, not the chat app."

goodAt:
  - "Best-in-class on hard, multi-file reasoning. When a refactor spans ten files and has to stay internally consistent, Opus 4.6 holds the thread better than anything else I run."
  - "It follows constraints. Give it a template and explicit rules and it stays inside them instead of inventing its own structure - the behaviour my whole engineering workflow depends on."
  - "Long context that stays coherent. I can hand it a large slice of a repo and it does not lose the plot halfway through."
  - "Tool use and agentic edits are reliable enough that I let it drive inside an IDE, with a permission gate, on production code."

badAt:
  - "The standalone app is the weak point. A chat window is the wrong surface for engineering - no real diff control, no project context, too much copy-paste - which is exactly why I run Claude elsewhere."
  - "It can be confidently wrong. The prose is so clean that a flawed approach reads as authoritative; you still have to know enough to catch it."
  - "Usage limits bite. Heavy Opus days on Pro hit the ceiling, and the jump to Max ($100-$200/mo) is a real step up in cost."
  - "It will happily over-engineer. Without constraints it reaches for more abstraction than the task needs."

comparisonTable:
  headers: ["", "Claude (Opus 4.6)", "GPT-5.x", "Gemini 3 Pro"]
  rows:
    - ["Multi-file reasoning",   "Excellent",   "Strong",     "Strong"]
    - ["Follows constraints",    "Excellent",   "Good",       "Good"]
    - ["Runs inside Antigravity", "Yes",        "Limited",    "Yes (native)"]
    - ["Standalone app for code", "Weak",       "Weak",       "Weak"]
    - ["Entry price",            "$20/mo Pro",  "$20/mo",     "Free tier"]
  highlight: "Claude (Opus 4.6)"
  caption: "Snapshot as of 2026-06-01. Model line-ups move fast; this reflects what I run today."

alternatives: ["google-antigravity", "ChatGPT", "Gemini 3 Pro", "GitHub Copilot"]

homepage: "https://claude.ai/"
referralLink: "https://claude.ai/referral/Pc4P-aRX5A"

relatedPost: "ai-codes-like-genius"

aiSummary: "Claude is the LLM the author trusts most for hard, multi-file engineering reasoning, but he avoids the standalone Claude app and instead runs Claude Opus and Sonnet 4.6 inside Google Antigravity, an IDE he controls with permission-gated edits. The review is positive but measured: Claude can be confidently wrong, hits usage limits on the Pro tier, and over-engineers without explicit constraints."
---

## Why I use it

I am not here to tell you Claude is magic. It is the model I trust most when the code has to be right, and that is a specific, earned claim - not a blanket one. On a refactor that spans a dozen files and has to stay consistent with itself, Claude holds the thread where other models start contradicting their own earlier edits. That is the job I keep it around for.

What I do not do is use the Claude app to get there. A chat window is the wrong place to do engineering: I am copy-pasting code in and out, it has no real view of my project, and it cannot show me a diff I can approve line by line. The model is excellent; the default wrapper around it is not built for how I work.

## How I actually run it

I run Claude inside the [Antigravity IDE](/stack/google-antigravity/) - the hands-on editor, not Google's 2.0 agent-orchestration rebuild - with Opus 4.6 for the hard problems and Sonnet 4.6 for volume. The editor gives me the structure and the permission gate - it proposes a change, I see the diff, nothing lands until I say so - and Claude does the surgical work inside those rails. That pairing is the actual product I use day to day, and it is the reason I rate Claude highly without rating its app highly.

It is the same idea I argued in [constraining AI inside templates](/blog/ai-codes-like-genius/): the model is only as good as the structure you put around it. Drop Claude into a strong template with explicit rules and it is a genuinely great engineer. Drop it into a blank chat box and you get confident, well-written code that may quietly be wrong.

## When I'd skip it

If your work is light enough that the free tier or a cheaper model covers it, you do not need to pay for Opus. If you live in the terminal, Claude Code may suit you better than any GUI. And if you are doing something where being confidently-but-subtly wrong is dangerous and you cannot check the output yourself, no model - this one included - is ready for that unsupervised.

## My setup

Claude via Antigravity, Opus 4.6 as the default for anything non-trivial, permission prompts on. I keep the standalone app installed only for quick throwaway questions away from the editor.

## Where it goes next

Claude stays active - it is the model my workflow is built around. What I am watching is cost: if Opus-tier usage keeps climbing, the Max tiers stop being a no-brainer, and I will say so here when it happens. The model has earned its place. The app still has not earned a place in my workflow, and that is the honest split.
