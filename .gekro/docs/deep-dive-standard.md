# Gekro Deep Dive Content Standard

This document defines the authoritative standard for all "Technical Deep Dive" content published on gekro.com. All professional posts must adhere to these rules to maintain the "Engineering Lab" persona and technical depth.

## 1. The Persona: Rohit
- **Background**: AI Engineer who builds real systems and documents them honestly.
- **Voice**: First person throughout. Confident, direct, and transparent.
- **Tone**: No clichés, no marketing language. No "I'm excited to share", "In conclusion", or "It's worth noting".
- **Honesty**: Engineering log style. Document failures, surprises, and what broke. This is not a success story; it's a post-mortem of the build.

## 2. Reading Time & Length

- **Default target**: 6–8 minutes of dense technical content. This is the soft target, not a hard ceiling.
- **Exception — let content-rich posts run long**: If the subject genuinely demands more space (a layered architecture with multiple sub-systems, a multi-stage build, a deep post-mortem with several distinct war stories), let the post exceed 8 minutes. Do not artificially trim dense, load-bearing content just to hit the target.
- **Anti-exception — don't pad**: Before going over 8 minutes, honestly check whether the extra length is filler: restated points, excess transitions, hedging in Tradeoffs, ceremonial context that adds no technical weight. Only exceed the target when the additional minutes are carrying real information. Going long is permitted; padding is not.
- **Rare, not default**: Most posts should still land in the 6–8 minute band. Overshooting is an exception reserved for subjects that genuinely can't be compressed.
- **Sign-off**: End without a sign-off — just stop when the content is done.

## 3. Post Structure
Every Deep Dive MUST follow this exact five-section structure:

### I. The Hook (No Heading)
- **Length**: One punchy opening paragraph directly below the TLDR.
- **Rule**: Do NOT use the literal `## The Hook` heading.
- **Goal**: A surprising observation, a failure, or a question that reframes the topic.
- **Rule**: NO "In this post I will..." openers. Start mid-action or mid-thought.

### II. ## The Architecture
- **Goal**: The technical reality of how it actually works.
- **Requirements**:
  - Always include a Markdown comparison table where relevant.
  - Diagrams as ASCII or code blocks where helpful.
  - Focus on systems, not just code.

### III. ## The Build
- **Goal**: Step-by-step implementation.
- **Requirements**:
  - Code must be complete and runnable — NO placeholder ellipsis (`...`).
  - WSL2/Linux context where relevant.
  - Show the real commands, the real file structure, and the real configuration.

### IV. ## The Tradeoffs
- **Goal**: The honest post-mortem.
- **Requirements**:
  - What broke.
  - What surprised me.
  - What I'd do differently.
  - Document the "ugly" parts of the engineering process.

### V. Closing Section — pick the right heading for the post's mode

Section V has **two valid headings**. Pick the one that matches the nature of the post, not your mood.

- **`## What I Learned`** — use for **retrospective / hands-on** posts where you actually built the thing and are writing a post-mortem. The closing paragraph reflects on the specific lessons from the grind: what you now know that you didn't know before, what you'd do differently next time, what the experience changed about your mental model. Default for posts authored alongside real code work in a repo.
- **`## Where This Goes`** — use for **forward-looking / speculative / framing** posts where the subject is an idea, a trend, a decision not yet executed, or a piece of tech you're predicting about (e.g. green tech, future architectures, exploratory research). The closing paragraph points outward and ahead: what this unlocks, what question it opens, what the next build or industry shift is.

Both share the same rules:

- **Length**: one forward-looking paragraph.
- **No sign-off**: end when the paragraph ends.
- **No heading other than these two**: don't invent `## Conclusion`, `## Final Thoughts`, `## TL;DR Redux`, etc.

If a post genuinely has both retrospective lessons AND a forward projection, prefer `## What I Learned` and fold the forward-looking beat into its final sentences. Never use both headings in the same post.

---
*Last Updated: 2026-04-11 (V2.1 — Section V split into two modes)*
