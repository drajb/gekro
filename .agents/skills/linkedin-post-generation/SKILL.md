---
name: linkedin-post-generation
description: Standardized workflow for converting technical blog posts into LinkedIn content for Rohit (gekro.com).
---

# LinkedIn Post Generation Skill

Use this skill whenever the USER asks to write a LinkedIn post based on a technical Deep Dive from gekro.com.

## 1. Input Context
- **Post Title**: From frontmatter.
- **Post Summary**: From `aiSummary` or TLDR.
- **Post Hook**: The first paragraph of the blog post.
- **Post URL**: The canonical URL.

## 2. The 8-Line Structure
Every LinkedIn post MUST follow the [Gekro LinkedIn Standard](file:///.gekro/docs/linkedin-standard.md):
1.  **Line 1 (Hook Line)**: Drop the most surprising/counterintuitive line from the Hook cold.
2.  **Line 2 (Tension)**: One sentence of contrast or tension.
3.  **Line 3-6 (Insight)**: Plain language explanation of what was built, revealed, and why it matters.
4.  **Line 7 (Result)**: Concrete number, failure, or finding.
5.  **Line 8 (CTA)**: One-line link to the full post.
6.  **Hashtags**: 3–5 on the final line.

## 3. Style Rules
- **Formatting**: Single lines ONLY. No bullets, no bold, no headers.
- **Tone**: Human, direct, slightly opinionated. 
- **Prohibited Phrases**: "I'm excited", "Game-changer", "Dive deep", "Thrilled to share".
- **Word Count**: 150–250 words total.

## 4. Workflow

### Step 1: Content Extraction
- Read the blog post's Hook and Architecture sections.
- Identify the "surprising" element.

### Step 2: Image Generation (MANDATORY)
- Use the `generate_image` tool to create a relevant workflow diagram, technical schematic, or conceptual art for the post.
- Provide the image alongside the text.

### Step 3: Drafting
- Draft the 8 lines following the structure.
- Select 3–5 relevant hashtags.

### Step 4: Verification
- Check word count (150-250 range).
- Ensure no prohibited phrases were used.
- Confirm single line formatting (no formatting markers).

## 5. Output Format
- Write the final LinkedIn post into a new text file at `linkedin-drafts/[post-topic].txt` (this folder is gitignored).
- DO NOT commit these posts to the main repository track.
- Present the file link to the USER alongside the generated image.
