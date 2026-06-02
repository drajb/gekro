---
name: "Claude"
category: "llm-client"
tagline: "The model I trust for real engineering - just not through its own app."

status: "active"
publishedAt: "2026-06-01"
lastVerified: "2026-06-02"

verdict: "Claude is the model I reach for when the code has to be right, and on hard, multi-file reasoning it is the one I trust most. I do not code in the Claude app though - I genuinely like its Cowork side for non-coding work, but for real engineering I run Claude inside an IDE I control."

priceTier: "paid-tier"
pricingNotes: "Free tier; Pro $20/mo ($17/mo billed annually); Max 5x $100/mo, Max 20x $200/mo; API billed per token (Opus 4.8 is the current top model). I'm on the Max plan and run Claude mostly through the editor, so my real usage is the Max allotment driving an IDE, not the chat app."

goodAt:
  - "Best-in-class on hard, multi-file reasoning. When a refactor spans ten files and has to stay internally consistent, Opus 4.8 holds the thread better than anything else I run."
  - "It follows constraints. Give it a template and explicit rules and it stays inside them instead of inventing its own structure - the behaviour my whole engineering workflow depends on."
  - "Long context that stays coherent. I can hand it a large slice of a repo and it does not lose the plot halfway through."
  - "Tool use and agentic edits are reliable enough that I let it drive inside an IDE, with a permission gate, on production code."

badAt:
  - "The app is the wrong surface for code. A chat window has no line-by-line diff control and no real project context, so I never engineer in it (its Cowork mode is genuinely good for non-coding work - I just don't write code there)."
  - "It can be confidently wrong. The prose is so clean that a flawed approach reads as authoritative; you still have to know enough to catch it."
  - "Usage limits still bite. Even on Max, a heavy Opus day can hit session caps, and Max ($100-$200/mo) is a real step up in cost from Pro."
  - "It will happily over-engineer. Without constraints it reaches for more abstraction than the task needs."

comparisonTable:
  headers: ["", "Claude (Opus 4.8)", "GPT-5.x", "Gemini 3.1 Pro"]
  rows:
    - ["Multi-file reasoning",    "Excellent",  "Strong",     "Strong"]
    - ["Follows constraints",     "Excellent",  "Good",       "Good"]
    - ["Runs inside Antigravity", "Yes",        "Limited",    "Yes (native)"]
    - ["App for coding",          "Weak",       "Weak",       "Weak"]
    - ["Entry price",             "$20/mo Pro", "$20/mo",     "Free tier"]
  highlight: "Claude (Opus 4.8)"
  caption: "Snapshot as of 2026-06-02. Model line-ups move fast; this reflects what I run today."

alternatives: ["google-antigravity", "ChatGPT", "Gemini 3.1 Pro", "GitHub Copilot"]

homepage: "https://claude.ai/"
referralLink: "https://claude.ai/referral/Pc4P-aRX5A"

relatedPost: "ai-codes-like-genius"

aiSummary: "Claude is the LLM the author trusts most for hard, multi-file engineering reasoning. He does not code in the Claude app (though he likes its Cowork mode for non-coding work); for engineering he runs Claude Opus 4.8 inside the Google Antigravity IDE with permission-gated edits, on a Max plan. Measured take: Claude can be confidently wrong, usage limits bite even on Max, and it over-engineers without explicit constraints."
---

## Why I use it

I am not here to tell you Claude is magic. It is the model I trust most when the code has to be right, and that is a specific, earned claim - not a blanket one. On a refactor that spans a dozen files and has to stay consistent with itself, Claude holds the thread where other models start contradicting their own earlier edits. That is the job I keep it around for.

What I do not do is write code in the Claude app. A chat window is the wrong place to engineer: I am copy-pasting code in and out, it has no real view of my project, and it cannot show me a diff I can approve line by line. I actually like the app's Cowork mode for non-coding work - research, drafting, thinking out loud - but for code the default chat wrapper is not built for how I work.

## How I actually run it

I run Claude as an extension inside the [Antigravity IDE](/stack/google-antigravity/), the VS Code fork I use as my main editor, and I route by task: Opus for planning, evaluation, and breaking work into steps; Sonnet for executing those steps and for daily flow; Haiku for ad-hoc fixes and long agentic runs that are mechanical rather than reasoning-heavy. The editor gives me the structure and the permission gate - it proposes a change, I see the diff, nothing lands until I say so - and it will even SSH into my Raspberry Pi and work there. That pairing is the actual product I use day to day, and it is why I rate the Claude model highly without coding in its app.

It is the same idea I argued in [constraining AI inside templates](/blog/ai-codes-like-genius/): the model is only as good as the structure you put around it. Drop Claude into a strong template with explicit rules and it is a genuinely great engineer. Drop it into a blank chat box and you get confident, well-written code that may quietly be wrong.

## When I'd skip it

If your work is light enough that the free tier or a cheaper model covers it, you do not need to pay for Opus. If you live in the terminal, Claude Code may suit you better than any GUI. And if you are doing something where being confidently-but-subtly wrong is dangerous and you cannot check the output yourself, no model - this one included - is ready for that unsupervised.

## My setup

Claude via the extension in the Antigravity IDE, models routed by task - Opus to plan, Sonnet to execute, Haiku for ad-hoc fixes - permission prompts on. I am on the Max plan. I keep the Claude app around for Cowork and chat, but I do not write code in it - that always goes through the editor.

## Where it goes next

Claude stays active - it is the model my workflow is built around. What I am watching is cost: I am already on Max, and if Opus-tier usage keeps climbing the value math gets harder, which I will say so here when it happens. The model has earned its place. For coding, its app still has not, and that is the honest split.
