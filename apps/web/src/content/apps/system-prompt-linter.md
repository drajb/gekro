---
title: "System Prompt Linter"
category: "ai"
job: "Catch the silent failure modes in your system prompt — vague instructions, conflicting rules, missing output format, role drift — before they cost you tokens"
description: "Paste a system prompt and the linter runs ~20 heuristic checks adapted from documented prompt-engineering anti-patterns. Flags vague instructions ('be helpful'), conflicting rules ('always X, never X-related things'), missing output format, role drift, missing examples, instruction count overload, and more. Severity-rated and token-aware."
aiSummary: "A client-side prompt-engineering linter that scans a system prompt against ~20 documented anti-patterns: vague instructions ('be helpful', 'do your best'), missing output format specification, conflicting directives, missing role definition, instruction count overload, persona drift, missing few-shot examples, ambiguous escalation paths, and unsafe instruction-injection patterns. Each finding is severity-rated (high/medium/low) with explanation and concrete fix suggestion."
personalUse: "I've shipped at least three prompts that worked great in the test loop and then drifted in production because a single ambiguous instruction was being interpreted differently each call. This catches the patterns I keep falling into — especially the 'always do X' / 'never do X-adjacent things' contradictions that are invisible until they fire."
status: "active"
publishedAt: "2026-04-20"
lastVerified: "2026-04-20"
companionPostSlug: ""
license: "MIT"
icon: "🔍"
---

## How this works

Paste your system prompt. The tool runs a sequence of heuristic checks, each looking for a specific anti-pattern. Every finding includes the severity, an explanation, and a concrete suggestion for what to write instead.

This is **not** an LLM-based judge — every rule is a deterministic regex or text-statistics check that runs locally. No API calls, no model needed.

## Anti-patterns checked

### High severity
- **No role definition** — prompt doesn't establish who the model is acting as
- **Conflicting directives** — `always X` followed by `never X-related Y` or similar
- **No output format** — prompt asks for structured output but doesn't specify the format
- **Vague success criteria** — "do your best" / "be helpful" with no measurable target
- **Instruction injection vulnerability** — uses unfenced user input that could break out of the system prompt

### Medium severity
- **Too many instructions** — >15 numbered rules; models tend to drop later items
- **Mixed languages of address** — switches between "you should" and "the assistant must"
- **Missing examples** — for non-trivial output formats, no few-shot exemplar
- **Negative-only framing** — only "don't do X", no positive specification of what to do
- **Ambiguous tense** — past, present, future mixed in instructions
- **Missing escalation path** — no instruction for what to do when the request is out of scope

### Low severity
- **Verbose preamble** — long backstory before the actual instructions (eats context)
- **Trailing whitespace / inconsistent indentation** — usually harmless but suggests sloppy iteration
- **Capitalization inconsistency** — RANDOM emphasis without rhyme or reason
- **Token-heavy examples** — example inputs/outputs longer than the instructions themselves

## Why I built this

The most expensive bugs in agentic systems are the ones where the prompt looked fine, the test cases passed, and then it failed in production for reasons you can't reproduce. Most of those bugs trace back to one of the patterns above. Running this before deploying a prompt catches maybe 70% of them.

This is also a teaching tool — the checks document what good prompts look like by their absence.

## Limitations

- **Heuristic, not semantic** — can't tell if "be helpful" is genuinely vague vs. context-appropriate
- **English only** — regex patterns are tuned for English prompts
- **No model-specific advice** — doesn't know that Claude prefers XML tags vs Llama prefers headers
- **No simulation** — doesn't test the prompt against any model; only static analysis
