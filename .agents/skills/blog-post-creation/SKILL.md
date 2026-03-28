---
name: blog-post-generation
description: Standardized workflow for converting user brainstorming/content into technical blog posts for Gekro.com.
---

# Blog Post Generation Skill

Use this skill whenever the USER provides a topic or brain-dump for a new blog post.

## 1. The Persona: Rohit
- **Role**: AI Engineer building real systems.
- **Narrative**: Document honestly, avoid "success theater".
- **Tone**: First person, no clichés, no marketing jargon. No "I'm excited to share", "In conclusion", "It's worth noting".

## 2. The "Deep Dive" Structure
Every technical post MUST follow the [Gekro Deep Dive Standard](file:///.gekro/docs/deep-dive-standard.md):
1.  **The Hook (No Heading)**: One punchy paragraph directly beneath the TLDR. Mid-action opener. No filler intros. DO NOT use the `## The Hook` heading.
2.  **## The Architecture**: Comparison tables, ASCII diagrams, technical reality.
3.  **## The Build**: Step-by-step, complete and runnable code (no `...`), WSL2/Linux context.
4.  **## The Tradeoffs**: Post-mortem style. What broke, what surprised me, what I'd do differently.
5.  **## Where This Goes**: One forward-looking paragraph. No sign-off.

## 3. Social Media Follow-up
- **CRITICAL**: NEVER automatically generate a LinkedIn post after drafting a blog post.
- You MUST explicitly ask the USER for permission and wait for them to read and refine the blog article first.
- Only when the USER explicitly asks to "share" or "write a LinkedIn post", proceed to use the [Gekro LinkedIn Standard](file:///.gekro/docs/linkedin-standard.md) and the `linkedin-post-generation` skill.

## 4. Core Constraints
- **Reading Time**: 6–8 minutes (calculated after writing).
- **Format**: Follow `apps/web/src/content/blog/_template.md`.
- **Images**: Use `<Image />` component for .astro, standard markdown with alt for .md.

## 4. Workflow (Human-in-the-Loop)

### Step 1: Research & Drafting
1.  Research technical details (versions, architecture, commands).
2.  Draft the post following the Deep Dive structure.
3.  Calculate reading time (~200 words per minute).

### Step 2: Verification (Internal)
1.  Run `pnpm build` from the root to ensure no Astro components or Mermaid diagrams break the build.
2.  Check for prohibited phrases (clichés).

### Step 3: Human Review
1.  **Stop after drafting**. Use `notify_user` to present the draft and ask for verification.
2.  **WAIT** for user approval.

### Step 4: Finalize
1.  Proceed to commit/push only after explicit approval.

## 5. Content Guardrails
- **Honesty First**: If the user hasn't done the work, frame it as exploratory.
- **No Success Theater**: Document the "ugly" parts of engineering.
- **Complete Code**: All scripts and configs must be complete and tested.

