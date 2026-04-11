# Gekro Blog Post Generator — Portable Drop-In

> **Canonical source:** `drajb/gekro` → `.gekro/docs/BLOG_POST_GENERATOR.md`
> **Purpose:** Drop a copy of this file into the root of *any* repo Rohit is actively working in. When Rohit says "read `BLOG_POST_GENERATOR.md` and write me a deep dive on this project," an AI coding agent (Claude Code, Gemini CLI, Cursor, etc.) has the complete set of instructions to scan the repo, draft the post to a local gitignored folder, and stop for review — without touching the live gekro site.

---

## 0. Read this whole file before doing anything

This file is the *entire contract*. Do not guess, do not skip sections, do not invent structure. If something here conflicts with what you think the user wants, stop and ask.

**Hard rules that override everything else below:**

1. **Never write the draft into any folder that would publish it.** Forbidden output targets include (but are not limited to): `apps/web/src/content/blog/`, `content/blog/`, `posts/`, `src/pages/blog/`, `_posts/`, `docs/blog/`, or anything a static site generator might pick up. The ONLY valid target is `./blog-drafts/` at the root of the current repo.
2. **Never commit, stage, or push the draft.** After writing the file, tell the user where it is. Full stop. The user moves it into gekro manually.
3. **Never auto-generate a LinkedIn / Twitter / social post afterwards.** Even if the deep dive is great. Wait for the user to explicitly say "now write the LinkedIn post".
4. **Never skip the style calibration step (Section 2).** Every draft must be informed by the two most recent posts on gekro.com.
5. **Never scan the whole repo before asking the clarifying questions in Section 3.** You will drown in noise and produce a generic post.

---

## 1. Invocation

The user invokes the generator by saying something like:

- "Read `BLOG_POST_GENERATOR.md` and write me a deep dive about this repo."
- "Use the blog generator. The experiment is [X]."
- "Blog post time — [brain dump]."

Your first action is always to re-read this file top to bottom (fresh, not from memory), then proceed to Section 2.

---

## 2. Style calibration — fetch the two most recent gekro posts

Before writing anything, you must read two real posts to calibrate voice, rhythm, and texture. Do not rely on embedded examples in this file — they go stale.

### 2a. Try the live source (preferred)

Use `WebFetch` (or equivalent) against the GitHub contents API to list the blog folder, then fetch the raw markdown of the 2 most recent non-template posts:

```text
# 1. List the directory
https://api.github.com/repos/drajb/gekro/contents/apps/web/src/content/blog

# 2. Ignore any file starting with an underscore (_template.md).
# 3. Pick two with the most recent "publishedAt" in their frontmatter, OR fall back to
#    whichever two the directory listing returns most recently if frontmatter parse fails.
# 4. Fetch each via its download_url. Example URL shape:
https://raw.githubusercontent.com/drajb/gekro/main/apps/web/src/content/blog/<slug>.md
```

### 2b. Fallback URLs (if the API is unreachable)

If the GitHub contents API call fails but raw fetching still works, use these two as a known-good baseline:

- `https://raw.githubusercontent.com/drajb/gekro/main/apps/web/src/content/blog/ai-codes-like-genius.md`
- `https://raw.githubusercontent.com/drajb/gekro/main/apps/web/src/content/blog/pi5-mcp-orchestrator.md`

### 2b-bis. No network at all

If your environment has no network fetching capability whatsoever (sandboxed CI, air-gapped dev box, disabled WebFetch tool), do NOT proceed blindly — calibration is non-negotiable per Section 0 rule 4. Instead, stop and tell the user:

> "I can't fetch gekro posts from my environment. Before I draft, please paste the raw markdown of the two most recent gekro blog posts into the chat so I can calibrate voice and structure."

Wait for the user to paste them. Then proceed to Section 2c.

### 2c. What to extract from them

After fetching, write down (in your working memory, not the draft) the answers to:

- What does the opening sentence of each post look like? (Mid-action? Declarative? A failure?)
- How dense are the specific numbers? (Dollar amounts, token counts, hardware specs, version strings.)
- How long is the TLDR? Does it spoil the ending?
- Does the post use one comparison table or several?
- How does each post end? (Look for the final paragraph. No sign-off. Identify whether the heading is `## What I Learned` — retrospective closing — or `## Where This Goes` — forward-looking closing. Both are valid per V2.1; the choice tells you the post's mode.)
- Any phrases you would *not* have written instinctively but Rohit does? Capture them.

**Genuine structure drift is rare but possible.** The canonical five-section structure lives in Section 5 of this file. If a fetched post uses a section heading that is NOT one of the documented ones — e.g. `## Conclusion`, `## Final Thoughts`, a merged `## Tradeoffs & Learnings` hybrid, or a missing section — flag it to the user as possible drift, but still follow the canonical structure in Section 5 unless the user says otherwise. Note: `## What I Learned` vs `## Where This Goes` is **not** drift — both are canonical as of V2.1. Do not flag that choice as a problem.

---

## 3. Clarifying questions — ask these before scanning

Do not scan the repo until the user has answered these. Keep the question batch short and unblocking.

1. **What's the experiment / story?** One sentence from the user describing what the post is actually *about*. ("The caching layer I rewrote." / "Moving from Postgres to DuckDB for analytics." / "How I got the WebGPU renderer to stop crashing.")
2. **What's the scan scope?** One of:
   - `whole-repo` — scan everything except `node_modules/`, `.git/`, `dist/`, `build/`, `.next/`, `.astro/`, `.turbo/`, `target/`, `venv/`, `__pycache__/`, lockfiles, binary assets.
   - `path:<glob>` — scan only this directory or glob. (e.g. `path:src/cache/**`)
   - `diff:<ref>` — scan only files changed between a git ref and HEAD. (e.g. `diff:main`, `diff:HEAD~20`)
   - `files:<list>` — scan only the specific files the user lists.
3. **Difficulty + topics?** Beginner / Intermediate / Advanced, and 2–4 topic tags. If the user doesn't say, propose your best guess after the scan and let them correct.

If the user just says "go" without answering, default to: ask them for the one-sentence story, and propose `whole-repo` with the standard excludes.

---

## 4. The Persona — Rohit Burani

This is non-negotiable. If any draft sentence fails these checks, rewrite it.

- **Who:** AI Engineer with an engineering + management background. Sole contributor to gekro.com. Builds real systems on a Pi 5 cluster, Tesla telemetry, trading experiments, local-first AI.
- **Voice:** First person throughout. "I built", "I hit", "I learned". No "we". No royal plural.
- **Tone:** Confident, direct, post-mortem honest. This is an engineering log, not a marketing piece. Document the broken parts, the surprises, the wrong turns.
- **Register:** Technical but never academic. Assume the reader is a peer engineer. Don't explain common terms. Do explain *your* weird choices.
- **Anti-patterns (prohibited phrases, no exceptions):**
  - "I'm excited to share"
  - "In this post, I will..."
  - "In conclusion"
  - "It's worth noting"
  - "Let's dive in" / "Let's get started"
  - "Stay tuned"
  - "In today's fast-paced world"
  - "Revolutionary", "game-changing", "cutting-edge", "seamless", "leverage" (as a verb)
  - **Classic LLM-slop tells:** "delve into", "delve deeper", "tapestry", "in the realm of", "testament to", "navigate the landscape", "unlock the potential", "at the intersection of", "the world of". If you catch yourself typing any of these, rewrite the sentence — they are the strongest signal that a post was ghost-written by an AI.
  - Any closing sign-off ("Happy coding!", "Thanks for reading!", "Until next time!")
- **Specificity discipline:** Every claim worth making should have a number attached when possible. Not "fast" — `47ms p95`. Not "cheap" — `$8–$15/month`. Not "big model" — `Gemini 2.5 Pro with 1M context`. If you don't have the real number, say so explicitly rather than reach for a vague adjective.

---

## 5. The Deep Dive Structure — five sections, exact order

Every post follows this structure. The section headings must match exactly (including the *absence* of a heading for the Hook).

### I. The Hook — no heading

- One punchy paragraph directly below the `<TLDR>` block.
- **Do NOT** write `## The Hook` as a heading. The paragraph is the hook.
- Start mid-action, mid-thought, or with a surprising failure. Examples from real posts: *"Two weeks after the demo looked incredible, the build was unfixable."* / *"I isolated one of my three Raspberry Pi 5 (16GB + M.2 256GB) nodes to act as a financially air-gapped AI orchestrator."*
- Never start with "In this post" or "Today I want to talk about".

### II. `## The Architecture`

- The technical reality of how it actually works. Not how it *should* work, how it *does*.
- **Required:** at least one Markdown comparison table when relevant (and it's almost always relevant — contrast the chosen approach against alternatives, or phases, or layers).
- ASCII directory trees or code-block diagrams where they clarify structure.
- Focus on systems, interfaces, and decisions. Not line-by-line code — that's Section III.

### III. `## The Build`

- Step-by-step implementation. This is the meat.
- **Code must be real, complete, and runnable.** No `...` placeholders. No `// your code here`. If you're showing a config, show the whole config.
- Real commands (actual `docker run`, actual `pnpm`, actual file paths).
- WSL2 / Linux context where relevant — the user is on Windows 11 with WSL, running a Pi 5 cluster.
- Narrate the decisions between code blocks. Don't just dump commands — explain *why each command*.

### IV. `## The Tradeoffs`

- The honest post-mortem.
- What broke. What surprised you. What you'd do differently. What's still unresolved.
- Document the ugly parts — the two-day silent failure, the 40k-token debugging cost, the security compromise you accepted.
- Minimum one concrete failure or surprise. A Tradeoffs section without a war story is a failure of the format.

### V. Closing — `## What I Learned` OR `## Where This Goes`

Section V has **two valid headings** and you must pick the right one based on the post's mode:

- **`## What I Learned`** — use for **retrospective / hands-on** posts where Rohit actually built the thing. Default for posts generated by this file, because this generator runs inside a working repo where code has just been written. The closing paragraph reflects on specific lessons: what he now knows that he didn't before, what he'd do differently, what the grind changed about his mental model.
- **`## Where This Goes`** — use for **forward-looking / speculative / framing** posts where the subject is an idea, a trend, a decision not yet executed, or a piece of tech being predicted about (e.g. green tech, future architectures, exploratory research). The closing paragraph points outward and ahead — what this unlocks, what question it opens, what the next build or industry shift is.

Heuristic for picking: if the repo scan turned up real commits, real commands, real errors → `## What I Learned`. If the post is exploratory / opinion / framing with little or no committed code → `## Where This Goes`. If you're unsure, ask the user before drafting section V.

Shared rules for both:

- **One paragraph.** (Retrospective in tone if `## What I Learned`, forward-looking in tone if `## Where This Goes` — not both.)
- **No sign-off.** The post ends when the paragraph ends.
- Don't use both headings in the same post. Don't invent a third heading (no `## Conclusion`, `## Final Thoughts`, etc.).

Canonical reference: [`deep-dive-standard.md`](./deep-dive-standard.md) V2.2.

### Length discipline — soft target, not a hard cap

- **Default target:** 6–8 minutes of dense technical content. Most posts should land here.
- **Going long is allowed** when the subject genuinely demands it — a layered architecture with multiple sub-systems, a multi-stage build, a deep post-mortem with several distinct war stories. Do not artificially trim load-bearing content to hit 8 minutes.
- **Padding is not allowed.** Before going over, audit honestly: is the extra length filler (restated points, ceremonial transitions, hedging in Tradeoffs, context that adds no technical weight)? If yes, cut it. Only exceed the target when the additional minutes are carrying real information.
- **Rare, not default.** Overshooting is an exception, not a license to sprawl. If three posts in a row all run to 12 minutes, something is wrong with how you're scoping them, not with the target.
- **Don't flag it to the user as a warning** if you exceed 8 minutes for valid content reasons — just write the accurate `readingTime` in the frontmatter and mention the final length in the Section 10 step 9 report ("Draft came out to 11 minutes because the architecture has five layers, each carrying its own post-mortem — let me know if you want me to compress.").

---

## 6. Frontmatter — exact schema

Every draft starts with this YAML frontmatter block, filled in completely:

```yaml
---
title: "[Detailed, Actionable Title — specific, no vague nouns]"
description: "[1-sentence technical description, ~15 words, ends with a period]"
publishedAt: "YYYY-MM-DD"   # Today's date in the user's timezone
difficulty: "Intermediate"   # Beginner | Intermediate | Advanced
topics: ["Topic 1", "Topic 2", "Topic 3"]
readingTime: 7               # Integer minutes. Calculate: ceil(word_count / 200). Default target 6–8, but do not trim or pad — let content-rich posts run longer when the subject genuinely demands it. See Section 5 "Length discipline" above.
aiSummary: "[2-sentence plain-text summary optimized for AI citation. First sentence = what. Second sentence = why it matters.]"
---
```

Title rules: action-oriented, specific, no clickbait. Good: *"Financially Air-Gapping A Raspberry Pi AI Swarm"*. Bad: *"My Thoughts on AI Infrastructure"*.

---

## 7. Template shell to fill in

Outer fence uses four backticks so the inner triple-backtick fences render cleanly.

````markdown
---
title: "..."
description: "..."
publishedAt: "YYYY-MM-DD"
difficulty: "Intermediate"
topics: ["...", "..."]
readingTime: 7
aiSummary: "..."
---

<TLDR>
  [2–3 sentences. What was built, what was learned, why it matters. Dense, plain prose.]
</TLDR>

<!-- The Hook (No Heading) -->

[One punchy paragraph. Mid-action opener. A failure, a surprise, or a reframing question.]

## The Architecture

[Technical reality. At least one comparison table below.]

| Component | Choice | Rationale |
|---|---|---|
| ... | ... | ... |

[ASCII tree or diagram if it clarifies structure.]

## The Build

[Narrated, step-by-step implementation with real commands and complete code.]

```bash
# real commands
```

```typescript
// complete, runnable code — no ellipsis
```

## The Tradeoffs

[What broke. What surprised me. What I'd do differently. Minimum one war story.]

## What I Learned  <!-- OR: ## Where This Goes — pick per Section 5.V -->

[One forward-looking paragraph. No sign-off.]
````

---

## 8. The scan — how to actually read the repo

Once you have the user's answers from Section 3, execute the scan in this order:

1. **Orientation pass** (always, regardless of scope):
   - Read `README.md`, `CLAUDE.md`, `AGENTS.md`, `GEMINI.md`, `.cursorrules` if any exist.
   - Read `package.json` / `pyproject.toml` / `Cargo.toml` / `go.mod` — whatever identifies the stack.
   - Glance at the directory tree to one level deep.
   - Check `git log --oneline -20` for the 20 most recent commits — this tells you what the user has actually been doing lately, which is usually the real subject of the post.
2. **Scope pass** (respect the scan scope from Section 3):
   - `whole-repo`: glob all source files, skip the exclude list in Section 3.
   - `path:<glob>`: glob only that path.
   - `diff:<ref>`: run `git diff --name-only <ref>...HEAD` and read only those files.
   - `files:<list>`: read exactly those files.
3. **Targeted re-reads**: once you've identified the 3–6 files that are actually the story, re-read them carefully and take notes on specific numbers, specific decisions, specific gotchas.
4. **Gap check**: is there a specific number, config value, or error message you'd need to quote and don't have? Ask the user before drafting, not after.

---

## 9. Output location and naming — the one place this draft may go

- **Folder:** `./blog-drafts/` at the root of the current repo.
- **Filename:** `YYYY-MM-DD-kebab-case-slug.md` where the date is today and the slug matches the eventual post slug.
- **First-run setup:** if `./blog-drafts/` does not exist:
  1. Create it.
  2. Check `.gitignore`. If it does not already contain a line matching `blog-drafts/` or `blog-drafts`, append `blog-drafts/` to `.gitignore` with a comment: `# Gekro blog drafts — never committed from source repos`.
  3. If there is no `.gitignore` at all, create one with just that entry.
- **Never** write the draft anywhere else. If the user asks you to put it somewhere unusual, stop and confirm they understand it won't be gitignored.

---

## 10. Workflow — the exact sequence, every time

1. Re-read this file.
2. Style calibration: fetch 2 recent gekro posts (Section 2).
3. Ask clarifying questions (Section 3). Wait for answers.
4. Scan the repo according to the scope (Section 8).
5. Draft the post into `./blog-drafts/YYYY-MM-DD-slug.md` following Sections 5–7.
6. Calculate reading time (`ceil(word_count / 200)`) and write it into the frontmatter.
7. Self-check against the anti-pattern list in Section 4. Rewrite any sentence that fails.
8. Self-check against the specificity rule: is every paragraph grounded in a real number, file, command, or error message? If not, either add the specificity or delete the paragraph.
9. Report back to the user: draft location, word count, reading time, a one-line summary of what you wrote, and any open questions you couldn't answer from the repo alone.
10. **Stop.** Do not commit. Do not push. Do not offer a LinkedIn version. Wait for user feedback.
11. After the user responds with feedback, iterate on the draft in place (same file).
12. When the user is satisfied, tell them the draft is ready to move into `drajb/gekro` at `apps/web/src/content/blog/<slug>.md`. You do not move it yourself from this repo.

---

## 11. Scope examples — how different invocations should play out

### Example A — "Whole repo, caching rewrite"

> **User:** "I just finished rewriting the caching layer. Use the blog generator."

1. Fetch 2 recent gekro posts.
2. Ask: "One-sentence version of the story? Scope — I'd suggest `diff:HEAD~30` since the rewrite is recent. Difficulty/topics?"
3. User answers, you scan the diff.
4. Draft → `blog-drafts/2026-04-11-caching-layer-rewrite.md`.

### Example B — "Scoped path, one subsystem"

> **User:** "Blog post about the WebGPU renderer in `src/gfx/`. Scope is just that folder."

1. Fetch 2 recent gekro posts.
2. Confirm scope `path:src/gfx/**`. Ask difficulty/topics.
3. Scan only `src/gfx/` plus orientation files.
4. Draft.

### Example C — "Brain dump, no code yet"

> **User:** "I want a post about why I'm moving off Supabase but I haven't started the migration yet."

1. Fetch 2 recent gekro posts.
2. Flag: this is exploratory, not a post-mortem. The post should be framed as *"The decision and the plan"* not *"The rebuild and what broke"*. Ask the user to confirm exploratory framing is OK.
3. Scope probably = orientation-only scan + the current Supabase integration files.
4. Draft with The Tradeoffs section repositioned as *"What I expect to break"*.

### Example D — "Quick fix post"

> **User:** "Just write a quick post about the bug I fixed yesterday."

1. Check `git log --since="2 days ago"` to find the fix commit.
2. Read the diff of that commit and the files it touched.
3. Offer: "Deep Dives typically land in 6–8 minutes of dense content. A single bugfix might be too thin to carry that weight on its own. Want me to (a) draft it anyway and we'll see how it reads, or (b) expand the scope to include the investigation + related context so there's enough material for a real post?"
4. Wait for the user's answer before drafting.

---

## 12. Evolving this document

This file is versioned at `drajb/gekro` → `.gekro/docs/BLOG_POST_GENERATOR.md`. Copies in other repos are downstream and will go stale.

**After every blog post generation session**, as your final step:

1. Ask the user: "Anything in the feedback cycle we just did that should become a permanent rule in `BLOG_POST_GENERATOR.md`? For example: a new prohibited phrase, a structural tweak, a specificity rule, a scan pattern that worked unusually well, or a new example worth adding to Section 11."
2. If the user says yes, propose the exact edit — section number, old text, new text — and apply it to the file **in the gekro repo only**, not in the downstream copy in the current working repo. This preserves the single source of truth.
3. If the downstream copy (in the current repo) is stale relative to the gekro canonical, mention it, but do not auto-sync — the user controls when to re-copy.

**Update discipline:**

- Keep the file under ~400 lines. If it grows past that, look for redundancy or push detail into an appendix section.
- Every rule should have a *why*. If you can't justify a rule, delete it.
- Examples in Section 11 can rotate out. Replace with better ones over time.
- When the user produces a post that breaks new ground stylistically (a structure variation that works, a new rhythm), ask whether it should be codified before the next session loses the lesson.

---

## 13. Things this file deliberately does NOT do

- **Does not attempt to match gekro's Astro frontmatter Zod schema exactly.** The frontmatter in Section 6 is a faithful copy as of 2026-04-11, but the user is expected to review it before pasting into gekro. If gekro's schema has changed, the user fixes the frontmatter during the move.
- **Does not embed reference posts inline.** They go stale. Fetch live every run (Section 2).
- **Does not run builds, tests, or linters in the target repo.** That's the user's call — this generator writes markdown, nothing else.
- **Does not know the reading-time formula gekro uses internally.** Uses the standard `ceil(word_count / 200)` approximation. The user can correct after moving the draft into gekro where the real reading-time util runs at build time.
- **Does not cross-reference the user's memory / decision log / issue tracker.** Those are gekro-internal files that don't exist in downstream repos.

---

*Canonical version lives at `drajb/gekro` → `.gekro/docs/BLOG_POST_GENERATOR.md`. Last updated: 2026-04-11.*
