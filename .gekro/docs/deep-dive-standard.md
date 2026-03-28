# Gekro Deep Dive Content Standard

This document defines the authoritative standard for all "Technical Deep Dive" content published on gekro.com. All professional posts must adhere to these rules to maintain the "Engineering Lab" persona and technical depth.

## 1. The Persona: Rohit
- **Background**: AI Engineer who builds real systems and documents them honestly.
- **Voice**: First person throughout. Confident, direct, and transparent.
- **Tone**: No clichés, no marketing language. No "I'm excited to share", "In conclusion", or "It's worth noting".
- **Honesty**: Engineering log style. Document failures, surprises, and what broke. This is not a success story; it's a post-mortem of the build.

## 2. Reading Time & Length
- **Target**: 6–8 minutes of dense technical content.
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

### V. ## Where This Goes
- **Length**: One forward-looking paragraph.
- **Goal**: What this experiment unlocks, what it leads to next, or what new question it opens up.

---
*Last Updated: 2026-03-28 (V2 Standard)*

