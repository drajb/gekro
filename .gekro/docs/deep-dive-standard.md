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

A Deep Dive follows five **narrative beats**, in this order. The beats are fixed; the
**headings are not**.

**V3 change (2026-08-18):** the canonical headings below are the default, not a
requirement. Where a post has a specific enough subject that a named heading carries
more information, rename it. `## The Tradeoffs` becomes `## What the Pi Cluster Actually
Cost Me`. `## The Build` becomes `## Wiring Ollama Into the Cluster`. Keep the beat,
lose the label.

Why this changed: 13 of the first 14 posts shipped with byte-identical headings
(`The Architecture | The Build | The Tradeoffs | Where This Goes`). Read two posts and
the template is visible, which makes a hand-written post read as machine-generated.

**When to rename** - the post is about one concrete system, and a specific heading would
tell the reader something the generic one does not.
**When to keep the default** - the post is broad, comparative, or conceptual, and the
generic heading genuinely is the most accurate label. Do not rename for the sake of it;
an arbitrary heading is worse than an honest generic one.

Renaming is per-heading, not all-or-nothing. Renaming two of four is fine.

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
- **No sign-off**: no "thanks for reading", no "let me know what you think", no
  ceremonial wrap-up.
- **But land it, do not just stop.** "No sign-off" was being read as "stop mid-air",
  and several posts end on a subordinate clause that leaves the reader mid-step. The
  final sentence should be a complete thought that resolves the post's opening tension.
  End on the point, not on a trailing qualifier.
- **No heading other than these two**: don't invent `## Conclusion`, `## Final Thoughts`, `## TL;DR Redux`, etc.

If a post genuinely has both retrospective lessons AND a forward projection, prefer `## What I Learned` and fold the forward-looking beat into its final sentences. Never use both headings in the same post.

---

## 4. Voice Texture (V3, added 2026-08-18)

The persona in §1 is an expert AI engineer and that does not change. What changed is
that §1 and §2 together were being read as "strip everything that is not technical
density". An audit of the first 14 posts found **zero** instances of emotion, **zero**
admissions of not knowing, and **zero** humour across the entire corpus. Fourteen posts
about building things in a home lab in which nobody is ever confused, annoyed, wrong,
or surprised. That reads as a spec sheet, not a person.

**These are permissions, not quotas.** There is no required number of anything in this
section. A post with none of it is fine if that is how the work actually went. Forcing
a war story into a post that did not have one produces something worse than dryness.

- **Emotion is allowed** when it is real and proportionate. Being irritated that a
  vendor's docs are wrong is in voice. Performing excitement is not.
- **Not knowing is allowed.** "I still do not know why that fixed it" is a stronger
  sentence than a confident wrong explanation, and it is the more honest one.
- **Humour is allowed**, in one register only: dry, understated, aimed at the situation
  or at yourself. Never political, never cruel, never punching at a person or group.
  If you would not say it to a colleague you respect, cut it.
- **Other people are allowed.** Almost nobody appears in the current posts. Real work
  involves other people; when it does, they can be in the writing.
- **Asides are allowed**, one or so per post. A short tangent is often the thing that
  makes prose sound like it came from a person.

This does not license padding. §2's anti-padding rule stands. The test is whether the
sentence carries information a reader could not get elsewhere; a specific frustration
about a specific failure carries information, generic enthusiasm does not.

## 5. Rhythm (V3, added 2026-08-18)

Measured across the corpus, half the posts sit at a sentence-length coefficient of
variation between 0.38 and 0.51. Human technical writing typically runs 0.55 to 0.75.
Four posts contain no sentence shorter than six words at all. Uniform sentence length
is the single most machine-like property of prose, independent of the words chosen.

- **Vary sentence length deliberately.** Long, long, short. The short one lands.
- **Short sentences are structure, not padding.** Do not cut a four-word sentence on
  anti-padding grounds; it is doing rhythmic work.
- **Vary paragraph length too.** A one-sentence paragraph is a legitimate emphasis tool.
- **Meaning is not negotiable.** When editing an existing post for rhythm, the technical
  claim must survive the edit unchanged. Re-cutting a sentence is allowed; changing what
  it asserts is not. If a rhythm edit would alter a number, a causal claim, or a verdict,
  leave the sentence alone.

Reference posts that already do this well: `token-economics.md` and `sonic-phoenix.md`.

## 6. Grounding: never invent lived detail (V3, added 2026-08-18)

**This is a hard rule and it overrides everything in §4.**

Sections §4 and §5 create an obvious failure mode: an author, or an AI assisting one,
can manufacture human texture. Invented 2am debugging sessions, fabricated frustrations,
imagined conversations. Do not do this, ever.

- Every specific detail in a post - a time, a cost, a failure, a quote, a person - must
  correspond to something that actually happened.
- An AI drafting or revising a post **may not add** lived detail. It may only work with
  detail the author supplied. If a passage would read better with a concrete story, the
  correct action is to **ask the author**, not to invent one.
- If the author cannot supply a real detail, the passage stays dry. Dry and true beats
  vivid and false, every time.
- The same applies to technical claims: verify against primary sources before asserting,
  and quote documentation only after reading it.

A post that reads slightly mechanically is a style problem. A post containing a
fabricated personal anecdote is an integrity problem, and it is not recoverable.

## 7. Typography

- **No em-dashes.** Use a regular hyphen (`-`). The em-dash (`—`, U+2014) is a
  well-known AI tell and is banned in all published prose: blog posts, experiments,
  app copy, and LinkedIn drafts. This rule already applied in practice; V3 writes it
  down so it survives a change of author or assistant.
- Straight quotes over curly where the tooling allows.

---
*Last Updated: 2026-08-18 (V3 - structure loosened, voice texture and rhythm added,
grounding rule made explicit, ending rule clarified, no-em-dash rule written down)*
