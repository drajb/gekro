---
title: "AI Codes Like a Genius. Architects Like a Goldfish."
description: "Why zero-shot AI POCs fall apart at scale, and how constrained architectural templates are the only thing standing between a clean codebase and a production time bomb."
publishedAt: "2026-03-28"
difficulty: "Intermediate"
topics: ["AI Engineering", "Architecture", "Productivity"]
readingTime: 5
aiSummary: "AI coding tools act as stateless engines that degrade without architectural constraints. This post details the exact template and knowledge base strategy that prevents cascading inconsistencies from turning a working POC into an unfixable production codebase."
---

<TLDR>
  Claims of zero-shot application generation might occasionally work for a weekend Proof of Concept, but refining that POC into an end-state product is a ruthless process that takes real time. An occasional coder will happily accept the output, completely blind to the fact that the zero-context code is quietly corrupting the deployable asset. A strong engineering foundation is the only way to scale AI without introducing terminal inconsistencies.
</TLDR>

Two weeks after the demo looked incredible, the build was unfixable. Not broken in one place — broken everywhere, in ways that contradicted each other. That's what zero-shot scaling actually looks like. Non-developers and occasional coders are screaming from the rooftops about how AI can build entire applications in seconds. They look at a shiny, functional Proof of Concept stitched together with zero-shot prompting and assume it's basically finished, completely ignoring the genuine, grinding structural time it takes to refine a product to its end state.

![A brilliantly polished futuristic app hologram on the front, but pulling back the curtain reveals an operational disaster of duct tape, tangled wires, and a tiny goldfish randomly pushing buttons.](/images/blog/ai_goldfish_facade.png)

## The Architecture

AI models like Claude, GPT5, Gemini 3 act as stateless prediction engines. A complex project is only going to hold up if its underlying knowledge base is rock-solid. If the foundation is weak, the product build will inevitably start introducing bugs and inconsistencies as changes are required over time. 

If you expect to zero-shot an application based on a single prompt, or expect magical results after every raw prompt, you will keep going on in endless loops—trying to fix one issue while secretly creating new ones elsewhere. Planning and synthesizing research to map out a system, followed by a constrained series of targeted prompts, is fundamentally the best strategy for building a robust codebase. This is exactly why a rigid knowledge base is critical.

This is the exact dividing line: a good software engineer will immediately spot the structural inconsistencies an AI introduces, whereas an occasional coder might be entirely happy-go-lucky in their approach, blissfully unaware they are merging a catastrophic mess of conflicting state logic. 

| Phase | Unpinned / Raw Prompting | Constrained Architecture / Template |
|---|---|---|
| The POC | Fast. Looks great. | Fast. Uncomfortable structural setup. |
| Sprint 2 | AI hallucinates new UI components. | AI is constrained strictly to `@repo/ui`. |
| Production | Inconsistencies crash the build. | Constrained architecture scales safely. |

```text
# Example: What a strong, constrained knowledge base looks like
/antigravity-base
├── apps
│   ├── web        (Astro 4 + Tailwind v4)
│   └── studio     (Sanity CMS)
├── packages
│   ├── ui         (Strict design tokens - AI CANNOT hallucinate)
│   ├── config     (Shared ESLint/TS - strict boundaries)
│   └── core       (Business logic boundaries)
├── knowledge      (Deep context and architectural decisions)
│   └── routing-rules.md
└── turbo.json     (Build constraints)
```

## The Build

When I built gekro.com, I didn't start with a blank prompt and a naive hope for zero-shot success. I started with a rigid architectural structure. Over time, I've built my own "Antigravity" templates that are highly reusable and help me rigidly constrain the AI to kickstart any complex project really quickly. The starting point of every serious project should be a deep-rooted foundation based on your current and long-term vision. Developers must start templating their own knowledge bases to enforce constraints.

```bash
# Initializing the environment from the core template
# Replace with your own base template repo
git clone https://github.com/your-org/your-base my-new-project
cd my-new-project
pnpm install

# Enforcing strict boundaries before AI touches anything
pnpm turbo run typecheck lint
```

If I need Claude to generate a new feature, it must operate within the strict definitions of my existing template. This isn't just theory—this is the exact configuration block I feed into the agent's system prompt to stop it from going rogue and introducing breaking inconsistencies.

```typescript
// Conceptual representation — actual rules live in your workspace system prompt / .cursorrules
// packages/config/base-agent-rules.ts
export const AgentConstraints = {
  allowAny: false,
  styling: "Tailwind v4 utility classes exclusively",
  state: "No local state for global data - use centralized store",
  components: "Astro islands for interactivity only",
  imports: "Use alias @repo/ui, never relative paths",
  knowledge: "Always refer to /knowledge/routing-rules.md before creating new endpoints"
} as const;
```

This ensures the AI isn't guessing how the state is structured. It reads the constraints, cross-references the targeted knowledge base for deeper context on any specific topic, and executes the change surgically. 

Consistently pointing your rules to a dedicated knowledge base does two very critical things: it makes the agent hyper-focused exclusively on the current task, and it preserves your model's context limit since the agent isn't dragging the entire codebase into memory just to figure out a single implementation pattern.

The damage of ignoring this discipline is visceral. Here is the exact difference between a hallucinated component and a constrained one:

```typescript
// What AI hallucinates without constraints:
import { Button } from '../../components/ui/Button'  
import { Card } from '../../../shared/Card'
import { theme } from './localTheme'  // invented, doesn't exist

// What AI generates with a constrained template:
import { Button, Card } from '@repo/ui'
import { tokens } from '@repo/config/tokens'
```

That single diff communicates the entire argument without a word of explanation.

Beyond just structural boilerplate, introducing "document-as-you-go" workflows, decision logs, and issue trackers at the root of the repository helps out immensely. By creating living, readable context that the agent checks before it acts, you actively prevent the AI from going in circles trying to solve the same problem twice. You're essentially creating your own localized MCP (Model Context Protocol) server right in your file system. A strict file organization setup with context injected directly into the agent rules, alongside a strong README, is non-negotiable for a healthy repo.

For example, explicitly mapping out where the agent must route logic guarantees architectural compliance:

```text
# Agent Prompt: Organization Enforcement
"Generate the new 'Analytics' feature. Follow the established file organization:
- Place all UI components strictly in `packages/ui/src/analytics/`
- Place all business state logic in `packages/core/stores/analytics.ts`
- Do NOT generate local component state. Review the `/knowledge/routing-rules.md` file first and automatically enforce these routing rules."
```


Before writing a single line of application code for a complex project, my standard workflow is to kick off a deep research article about the subject. I synthesize that architectural research and then start outlining my prompt strategy, saving those research findings as Markdown files in an isolated artifacts folder. A well-planned, heavily-researched prompt strategy referencing explicit artifacts is infinitely better than reacting to zero-shot failures and going in circles trying to fix them.

Furthermore, building this way unlocks immense cost control. This strategy works best when you're already in a multi-provider setup, which the abstraction layer makes trivial. Your blueprint and structural synthesis should be generated with the most capable frontier model available—like Gemini Pro or Claude Opus. Once the rigid architectural boundaries are outlined, let a faster, cheaper model like Flash execute the documented blueprint. When the localized code generation is done, have the higher-tier model review the pull request to ensure strict consistency against the base template. This saves massive amounts of money in the long run.

Finally, always require the agent to generate a test suite for each new feature. Ensure the instructions for this live explicitly within the workspace rules or the README, so testing is mandatory for every major prompt cycle rather than an afterthought.

```text
# Agent Prompt: Test Suite Mandate
"Whenever you create or modify a component, you MUST simultaneously generate/update the exact corresponding `vitest` suite in the `packages/core/tests/` directory to cover the failure cases. Do not ask for permission, just include the test in the PR."
```


## The Tradeoffs

The tension here is entirely between the upfront cost of building a template and the deceptive speed of raw prompting. Maintaining reusable templates takes weekend hours I'd rather spend building features. Furthermore, when a new major version of an underlying framework drops, the template fundamentally breaks. Every subsequent AI generation based on it requires heavy manual steering until the foundation is patched.

## Where This Goes

We are moving away from prompting models for code toward prompting models for architectural compliance. Constraining AI within deeply-rooted personal templates isn't just a hack for speed; it is the prerequisite for treating AI as a reliable engineering companion rather than a chaotic entity that slowly destroys your production codebase.
