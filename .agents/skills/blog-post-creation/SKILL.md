---
name: blog-post-generation
description: Standardized workflow for converting user brainstorming/content into technical blog posts for Gekro.com.
---

# Blog Post Generation Skill

Use this skill whenever the USER provides a topic or brain-dump for a new blog post.

## 1. The Template
All posts MUST follow the format defined in `apps/web/src/content/blog/_template.md`.

## 2. Core Constraints (from project-rules.md)
- **Tone**: 1st person ("I"), confident, direct, engineering-focused. No "I'm excited to share" or "In this article...".
- **Structure**: Every post MUST have:
    1.  Frontmatter (YAML).
    2.  `<TLDR>` block.
    3.  At least one complete **Code Block**.
    4.  A **Conclusion** starting with what was learned.
- **Language**: No "In conclusion", "It's worth noting", or other filler. Technical accuracy is priority.

## 3. Workflow (Human-in-the-Loop)

### Step 1: Research & Drafting
1.  Research the technical details (hardware specs, library versions, architectural patterns).
2.  Draft the post following the template.
3.  Calculate reading time (~200 words per minute).

### Step 2: Verification (Internal)
1.  Run `pnpm build` from the root to ensure no Astro components or Mermaid diagrams break the build.
2.  Run `pnpm lint` and `pnpm typecheck` if code snippets were copied from the codebase.

### Step 3: Human Review
1.  **Stop after drafting**. Use `notify_user` to present the draft and ask for verification.
2.  Provide a link to the draft file and a short summary of the technical angle taken.
3.  **WAIT** for user approval.

### Step 4: Finalize
1.  Only after user says "Proceed" or "Looks good", proceed to final commit/push (if requested).
2.  Update the `api/posts.json.ts` or any RSS feeds if necessary (usually handled by Astro).


## 4. Content Guardrails (CRITICAL)

- **Status Check**: Always verify if the topic is a **Live Lab Note** (something the user has built) or **Exploratory Research** (something the user is learning about).
- **Prohibited Claims**:
  - NEVER claim the Gekro Lab is actively doing/using a technology unless the USER has provided logs, code, or explicit confirmation of implementation.
  - NEVER use phrases like "In the lab, we do..." or "My setup involves..." for exploratory topics.
  - NEVER invent "success narratives" or "achieved metrics" (e.g., "we reduced waste by 30%") unless directly supported by user data.
- **Exploratory Tone**: For research-based posts, use phrases like "I've been looking into...", "The potential for...", or "The research suggests...".
- **Honesty First**: If the user hasn't done the work, the article must clearly frame it as a future direction or a theoretical exploration.

## 5. Safety Checks

- Ensure `publishedAt` is in `YYYY-MM-DD` format.
- Ensure `aiSummary` is exactly 2 sentences, plain text.
- Ensure all images use the `<Image />` component if added in .astro templates, or standard markdown with alt text in .md.
- **NEVER** use placeholders like `...` in code blocks.
