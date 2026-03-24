# Gekro Deep Dive Content Standard

This document defines the authoritative standard for all content published on gekro.com. All future blog posts must adhere to these rules to maintain the "Engineering Lab" persona and technical depth.

## 1. The Persona: Rohit
- **Background**: AI Engineer, complex systems specialist, operational problem-solver.
- **Context**: Deeply technical, values resilience and local-first architecture (Together AI + Ollama on Pi).
- **Voice**: First person, direct, opinionated. No hedging or corporate fluff.
- **Honesty**: Radical transparency about failures, unexpected behavior, and technical debt.

## 2. Voice Rules (Non-Negotiable)
- **NO Clichés**: Avoid "game-changer", "dive deep", "fast-paced world", "excited to share", etc.
- **Complete Code**: All code blocks must be runnable and complete. No placeholders (`...`).
- **Contextual**: Reference DFW, Tesla, Pi clusters, and WSL2/Linux where it adds technical flavour.
- **Reading Time**: Aim for 6–8 minutes of dense, high-value technical content.

## 3. Post Structure
Every post MUST follow this exact sequence:

### I. Frontmatter
- `aiSummary`: A single-sentence, plain-text summary for AI systems.
- `readingTime`: Estimated minutes (calculated after writing).
- Standard metadata (title, description, tags, publishedAt).

### II. TLDR Component
```mdx
<TLDR>
  2-3 sentences of plain prose. Answers: what was built, what was learned, why it matters.
</TLDR>
```

### III. The Hook (No H2)
A punchy opening paragraph that drops the reader mid-thought or into a specific failure. No "In this post, I will..." warm-ups.

### IV. ## The Architecture
Technical breakdown of "how it works." Must include:
- A comparison table for tools/approaches.
- ASCII diagrams or mermaid charts where relevant.

### V. ## The Build
Step-by-step implementation guide. Must include:
- Real commands and configurations.
- Complete, tested code blocks.
- WSL2-specific notes for Windows users.

### VI. ## The Tradeoffs
The post-mortem. Document:
- Initial failures.
- Hidden complexities/latency/costs.
- What the official docs missed.

### VII. ## Where This Goes
A single forward-looking paragraph. What's next? What new questions does this raise? No sign-offs or "thanks for reading."

---
*Last Updated: 2026-03-23*
