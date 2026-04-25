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

## What It Does

System Prompt Linter runs your system prompt through approximately 20 heuristic checks based on documented prompt-engineering failure patterns. Every finding is severity-rated (high/medium/low) with an explanation and a concrete suggested fix. This is deterministic static analysis — no LLM is used to evaluate your prompt. Everything runs locally in your browser.

## How to Use It

1. Paste your system prompt into the input area.
2. Click **Lint** (or it runs automatically after a brief pause).
3. Review findings by severity. High-severity issues should be fixed before deployment.
4. For each finding, read the explanation and apply the suggested fix.
5. Re-paste the revised prompt and re-lint until the high-severity issues are resolved.

## Anti-Patterns Checked

### High severity
- **No role definition** — the prompt doesn't establish who the model is acting as. Role definition is the anchor for all subsequent behavior.
- **Conflicting directives** — `always do X` followed by `never do X-adjacent Y` creates undefined behavior when both conditions apply simultaneously.
- **No output format** — the prompt asks for structured output (JSON, a list, a table) but doesn't specify the format. The model guesses.
- **Vague success criteria** — "do your best" and "be helpful" with no measurable target give the model nothing to optimize against.
- **Instruction injection vulnerability** — unfenced user input that could break out of the system prompt context.

### Medium severity
- **Too many instructions** — more than 15 numbered rules; models drop later items under long-context pressure.
- **Mixed languages of address** — switching between "you should" and "the assistant must" creates ambiguity about agency.
- **Missing examples** — for non-trivial output formats, no few-shot exemplar is provided.
- **Negative-only framing** — only "don't do X," no positive specification of what to do instead.
- **Ambiguous tense** — past, present, and future tense mixed in instructions.
- **Missing escalation path** — no instruction for what to do when the request is out of scope.

### Low severity
- **Verbose preamble** — long backstory before the actual instructions (eats context window, models ignore it).
- **Trailing whitespace / inconsistent indentation** — usually harmless but suggests sloppy iteration.
- **Capitalization inconsistency** — RANDOM emphasis without semantic meaning.
- **Token-heavy examples** — example inputs/outputs longer than the instructions themselves.

## Why Prompts Fail Silently

The hardest thing about prompt engineering is that there's no compiler. No error messages, no stack traces. A broken prompt produces output — just wrong output, and often in a way that only manifests under specific input patterns that don't appear in your test cases.

The failure modes are categorical:

**Ambiguity** is interpreted differently on each inference. A prompt that says "respond concisely" without defining what concise means will produce 1-sentence answers sometimes, 3-paragraph answers other times, depending on factors you can't control. This looks like non-determinism but is actually under-specification.

**Conflicting rules** create decision points where the model must choose between two instructions. The choice is model-version-dependent, temperature-dependent, and context-dependent. Your GPT-4 prod prompt may have worked because GPT-4 resolved the conflict one way; when you upgrade to a newer model, it resolves it differently. The behavior was never guaranteed.

**Missing output format** is the most costly in production. If your downstream code expects a JSON object and the model sometimes produces markdown-wrapped JSON and sometimes produces prose, your code breaks on ambiguous inputs. Specifying the exact output format — including an example — reduces this failure mode to near-zero.

**Instruction overload** is a real phenomenon. LLMs under long-context pressure show recency bias: instructions at the end of the system prompt are better followed than instructions in the middle. A prompt with 20 numbered rules will see rules 10–15 partially ignored. The linter flags this because the fix (consolidate rules, prioritize ruthlessly) is structural, not cosmetic.

## The Connection Between Prompt Quality and Agent Reliability

In a single-turn chatbot, a slightly ambiguous prompt produces a slightly wrong answer. The user asks again with clarification. The stakes are low.

In an agentic system — a model that calls tools, runs in a loop, and takes actions — a slightly ambiguous prompt compounds. The agent misinterprets step 2 because step 1's result was ambiguous. By step 5, it's operating in a completely wrong context, and the damage (files created, emails sent, API calls made) is difficult to reverse.

This is why the standard for system prompt quality in production agents is higher than in chatbots. Every ambiguity is a branch point in the agent's decision tree. More branches means more failure modes. The linter catches the ambiguities before they become agent bugs.

**Specific anti-patterns and their agent failure modes:**

- **No escalation path** — the agent encounters an out-of-scope request and either refuses everything or attempts everything. A defined escalation ("if the request is outside your scope, respond with `{action: 'escalate', reason: '...'}` and stop") gives the agent a safe fallback.
- **Vague success criteria** — in an agent that evaluates its own output before proceeding, vague criteria produce approval of bad outputs and rejection of good ones. Make criteria measurable.
- **Missing output format** — tools that receive the agent's output (downstream API calls, parsers) require consistent structure. The agent's output format must be specified and exemplified.

## How to Use This Before Deploying an Agent

1. Write your system prompt.
2. Paste it here and fix all high-severity issues.
3. Fix medium-severity issues that apply to your use case.
4. Pair with the [JSON Schema → LLM Tool](/apps/json-schema-to-tool/) to validate your tool schemas — system prompt quality and tool schema quality together determine agent reliability.
5. Run your test cases. If a case still fails, ask yourself which linter finding might explain the failure.

Think of this as a code review for prompts: it doesn't catch every bug, but it catches the patterns that show up in post-mortems repeatedly.

## Tips & Power Use

- **Re-lint after every revision.** Fixing one issue sometimes introduces another (e.g., adding examples can trigger the "token-heavy examples" warning if you over-index). Re-linting keeps the check list fresh.
- **Use the finding explanations as a learning tool.** Even if you disagree with a specific finding, the explanation documents what good looks like.
- **Medium-severity issues are context-dependent.** "Missing few-shot examples" is critical for a data extraction prompt; it's irrelevant for a simple classification prompt. Apply judgment.
- **The "too many instructions" warning is a design signal.** If your prompt has 20 rules, it's not a linting problem — it's a scope problem. The prompt is doing too many things. Consider splitting into specialized prompts.

## Limitations

- **Heuristic, not semantic** — can't tell if "be helpful" is genuinely vague vs. context-appropriate in a specific domain
- **English only** — regex patterns are tuned for English prompts
- **No model-specific advice** — doesn't know that Claude prefers XML tags vs Llama prefers markdown headers vs GPT-4 prefers numbered lists
- **No simulation** — doesn't test the prompt against any model; purely static analysis. Complement with actual test cases.
