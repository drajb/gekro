---
title: "Model Benchmark Comparator"
category: "ai"
job: "Compare LLMs on context, pricing, MMLU, HumanEval, and capabilities side by side"
description: "Pick up to 4 LLMs and compare them across context window, pricing, MMLU, HumanEval, GPQA, MATH benchmarks, and capabilities like vision and tool use. Static reference data, no API calls required. Updated April 2026."
aiSummary: "A static comparison tool for 15 major LLMs covering context window size, input/output pricing, MMLU/HumanEval/MATH/GPQA benchmark scores, and capability flags. Pick up to 4 models and see them side-by-side. Data sourced from official model cards and public leaderboards."
personalUse: "I keep getting asked 'which model should I use for X?' and I always end up context-switching to 5 different docs pages. This is my single-pane comparison."
status: "active"
publishedAt: "2026-04-24"
lastVerified: "2026-04-24"
companionPostSlug: ""
license: "MIT"
icon: "📈"
---

## What It Does

Pick up to four LLMs from the model picker and see them side-by-side in a comparison table. Rows are grouped into three categories:

- **Context & Pricing** — input/output context window sizes, price per 1M input and output tokens, and whether the provider offers a batch pricing tier.
- **Benchmarks** — MMLU, HumanEval, MATH, and GPQA-Diamond scores sourced from official model cards and public leaderboards.
- **Capabilities** — vision support, tool use / function calling, extended thinking (chain-of-thought reasoning mode), and training data cutoff date.

Color coding helps you read the table fast: the **best value in each numeric row** is highlighted in green; the **worst** is dimmed in red. Boolean rows (Yes/No) skip this coloring since they are not ordinal.

All data is static and client-side. No API calls, no login, no telemetry.

## How to Use It

1. The tool loads with four defaults selected: GPT-4o, Claude 3.7 Sonnet, Gemini 2.0 Flash, and Llama 3.3 70B. These are my "reference quartet" for most engineering decisions.
2. Uncheck any model to remove it from the table. Check another to add it (maximum 4 columns).
3. Use **Copy Result** to get the full comparison as plain text — useful for pasting into a design doc or Slack message.
4. Use **Export CSV** to download the comparison as a spreadsheet.
5. Use **Reset** to return to the default four models.

## Understanding the Benchmarks

Benchmarks are useful shorthand, but each measures something specific. Here is what each one actually tests:

### MMLU — Massive Multitask Language Understanding

MMLU presents a model with 57 multiple-choice subjects spanning STEM (mathematics, physics, chemistry, computer science), humanities (history, philosophy, law), medicine, and social science. Questions are drawn from university-level exams and standardized tests. A score of 50% is random chance (4 choices); human expert-level performance is roughly 89%.

**What it measures:** Breadth of factual knowledge across domains.

**Limitations:** MMLU is now widely benchmarked-against, meaning frontier models are trained on or close to its distribution. High MMLU scores are necessary but not sufficient for a "smart" model. It does not test reasoning depth, only recall and multiple-choice pattern matching.

### HumanEval — Code Generation

HumanEval is OpenAI's Python programming benchmark: 164 problems where the model is given a function signature and docstring and must write the body. Scoring is pass@1 — the generated code is executed and must pass all test cases on the first attempt.

**What it measures:** Practical code generation quality for standard algorithmic problems.

**Limitations:** HumanEval problems are relatively simple by modern standards. Production code involves understanding large codebases, handling edge cases, and reasoning about side effects — none of which HumanEval captures. Scores above 90% are common among frontier models, making it less discriminating at the top.

### MATH — Mathematical Reasoning

The Hendrycks MATH dataset contains 12,500 competition-style problems from AMC, AIME, HMMT, and similar olympiad tracks. Problems span five difficulty levels (1–5) and seven subjects including algebra, number theory, calculus, and combinatorics. Unlike MMLU, MATH requires multi-step reasoning to produce the correct numerical or symbolic answer.

**What it measures:** Mathematical reasoning and problem solving, not recall.

**Limitations:** Top models now score above 90% on the full set, driven partly by extended thinking modes that let models "work out" problems step by step. Scores from extended-thinking models are not directly comparable to scores from standard completion models.

### GPQA-Diamond — Graduate-Level Science

GPQA (Graduate-Level Google-Proof Q&A) Diamond is a 198-question set written by PhD-level researchers in biology, chemistry, and physics. Questions are designed to be extremely hard: the domain experts who wrote them score around 65%, and randomly guessing would yield 25%. The "Google-proof" design means the answers are not findable by simple web search — the model must reason.

**What it measures:** Deep scientific reasoning at graduate student / early researcher level.

**Why it matters:** GPQA-Diamond is currently the most reliable frontier discriminator. Human non-expert performance is ~34%; a model that scores 60%+ is demonstrably reasoning at a level most humans cannot match. It reveals the gap between models like Claude 3.5 Sonnet (65%) and o3 (87%) more clearly than any other benchmark in this table.

## Why Developers Need This

Every model selection decision is a set of tradeoffs. The right model depends on what you are building:

**Cost-sensitive production workloads:** Compare the price columns. GPT-4o mini at $0.15/1M input tokens versus o3 at $10.00/1M is a 66× price difference — that is the difference between a viable product margin and a loss-making one at scale.

**Complex reasoning tasks (agents, code review, analysis):** Look at GPQA-Diamond and MATH. Models with extended thinking enabled (o3, o4-mini, Claude 3.7 Sonnet, Claude Opus 4, Gemini 2.5 Pro, DeepSeek R1) outperform their non-thinking counterparts by large margins on these tasks.

**Code generation pipelines:** HumanEval tracks code quality. At the frontier, differences are small — but Claude 3.7 Sonnet at 96.2% vs GPT-4o at 90.2% is a real signal when you are running thousands of completions a day.

**Long-document processing:** Context window size matters if you are summarizing large codebases, legal documents, or research papers. Gemini 1.5 Pro's 2M-token window is in a different category from GPT-4o's 128K.

**Self-hosted inference:** Llama 3.3 70B and Llama 3.1 405B show null for pricing — they are open weights. If you are running models on your own hardware (a Pi 5 cluster, an RTX GPU, a Jetson), these are your options. The [GPU VRAM Calculator](/apps/gpu-vram-calculator/) tells you if they will fit.

## How to Interpret Pricing

Model pricing is quoted per 1M tokens. A token is approximately 0.75 words in English (or 4 characters). This means:

- A 1,000-word document ≈ 1,333 tokens.
- A 10-page PDF ≈ 5,000–8,000 tokens.
- A 100K-token context window holds roughly a 75,000-word novel or a ~5,000-line codebase.

**Input vs. output pricing:** Output tokens are always more expensive than input tokens — typically 3–10× more. This is because generating tokens requires a forward pass per token, while input tokens can be processed in parallel. For tasks like summarization where output is short, input cost dominates. For long code generation, output cost dominates.

**Batch pricing:** Several providers (OpenAI, Anthropic) offer async batch APIs where you submit jobs and receive results within 24 hours at roughly 50% discount. If your use case is not latency-sensitive, always check whether batch pricing applies.

**Cost math at scale:** At 1 million requests/month, each averaging 500 input + 200 output tokens:
- GPT-4o: (500 × $2.50 + 200 × $10.00) / 1M = $1.25 + $2.00 = $3.25 per thousand requests → $3,250/month
- GPT-4o mini: (500 × $0.15 + 200 × $0.60) / 1M = $0.075 + $0.12 = $0.195 per thousand → $195/month
- Gemini 2.0 Flash: (500 × $0.10 + 200 × $0.40) / 1M = $0.05 + $0.08 = $0.13 per thousand → $130/month

The cost difference between a mini/flash-tier model and a frontier model is often 10–50× in production.

## Important Caveats

**Benchmarks do not tell the whole story.** A model that scores 88% on MMLU and 94% on HumanEval might still perform poorly on your specific domain, your prompt style, or your edge cases. Benchmark contamination is real — frontier models are trained on data that overlaps with test sets. Use this table to narrow your shortlist, then test your actual prompts on your actual data.

**Vibes vs. numbers.** Developers who use models daily often have strong intuitions that do not map cleanly to benchmark rankings. "Claude writes better prose." "GPT-4o is more reliably structured." "DeepSeek R1 surprises you on math." These intuitions are real, they are just hard to quantify. The numbers here are a starting point, not a verdict.

**Provider-reported numbers.** Not all benchmark numbers in this table come from independent evaluations. Some are self-reported by the model provider on their own infrastructure with their own prompting conventions. Direct comparisons across providers should be treated as approximate.

## Limitations

- Data is static and updated manually. Model prices change frequently; always verify current pricing on the provider's documentation page before committing to a production decision.
- This tool covers 15 models. Many capable models are not listed (Qwen, Yi, Falcon, Mistral Nemo, etc.). The selection reflects models I actually use or evaluate in my own engineering work.
- Benchmark scores from extended-thinking models (o3, Claude 3.7 Sonnet in thinking mode) are not directly comparable to standard completion models — they use more compute per inference.
- Self-hosted pricing for open-weight models (Llama, DeepSeek R1) depends entirely on your hardware. Use the [LLM Cost Calculator](/apps/llm-cost-calculator/) and [GPU VRAM Calculator](/apps/gpu-vram-calculator/) to estimate real costs.
