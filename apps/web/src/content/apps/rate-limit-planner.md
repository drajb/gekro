---
title: "LLM Rate-Limit Planner"
category: "ai"
job: "Find out whether your workload fits a provider's RPM/TPM limits, which limit binds first, and how long a burst will take to drain"
description: "Enter your provider tier (or your real RPM/TPM numbers) and your workload - tokens per request and target throughput - and this planner tells you which limit binds first, the maximum sustainable request rate, whether your target fits, how long a burst of N requests takes to clear, and the minimum tier that would unblock you. Everything is editable and recalculates live."
aiSummary: "A client-side LLM rate-limit calculator. Given RPM and TPM limits (from editable provider-tier presets) and a workload (input/output tokens per request, target requests per minute, burst size), it computes which limit binds first (RPM vs TPM), the maximum sustainable request rate, target utilization, burst drain time, and the minimum preset tier that clears the target. All math runs in the browser and updates live."
personalUse: "I have hit 429s in production more than once because I reasoned about requests per minute and forgot that a few-thousand-token prompt makes the tokens-per-minute limit bind long before the request limit does. So now I do the binding-limit math before shipping a batch job, not after the 429s show up in the logs. If it does not fit, this tells me which tier or which throttle setting makes it fit."
status: "active"
publishedAt: "2026-07-05"
lastVerified: "2026-07-05"
companionPostSlug: ""
license: "MIT"
icon: "🚦"
---

## What It Does

Provider rate limits come in two flavours that interact: requests per minute (RPM) and tokens per minute (TPM). The one that bites you is whichever runs out first, and it is usually not the one you were watching. A 100-requests-per-minute target sounds modest against a 1,000 RPM limit - until each request carries 2,000 tokens and your 80,000 TPM budget caps you at 40 requests per minute.

This planner does that arithmetic. Pick a provider tier (or type in your real numbers), describe your workload, and it tells you which limit binds, whether your target fits, and what to change if it does not.

## What You Get

- **Binding limit** - RPM-bound or TPM-bound, and the resulting maximum sustainable request rate.
- **Fit verdict** - whether your target throughput clears the ceiling, with the utilization percentage of the tighter limit.
- **Burst drain time** - how long a one-shot burst of N requests takes to process at the binding rate, so you can size a queue.
- **Tier suggestion** - if you are over the limit, the minimum preset tier in the same provider family that would clear your target.
- A single-request check that flags the nasty case where one request alone exceeds the whole per-minute token budget.

## About the Numbers

The tier presets are representative published limits (verified on the date shown) and every field is editable - pull your actual RPM and TPM from your provider dashboard for an exact answer. One caveat worth knowing: Anthropic meters input and output tokens as separate per-minute budgets, while this planner models a single combined TPM. When in doubt, enter the tighter of your two token limits.

For the per-request side of the picture, size your prompts with the [Prompt Token Counter](/apps/prompt-token-counter/) and your spend with the [Reasoning Cost Calculator](/apps/reasoning-cost-calculator/).

## Limitations

- **Steady-state model.** It computes sustainable rates and simple burst drain; it does not simulate token-bucket refill dynamics or provider-side smoothing second by second.
- **Combined TPM.** Providers that split input and output token limits are approximated with one number - use the tighter limit.
- **Presets drift.** Published limits change; the presets are a starting point, not a live feed. The verified date tells you how fresh they are.
