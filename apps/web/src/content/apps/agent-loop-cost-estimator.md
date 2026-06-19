---
title: "Agent Loop Cost Estimator"
category: "ai"
job: "Estimate the real cost, context growth, and latency of a multi-step agent loop - including the tokens you get re-billed for every turn"
description: "Model the true cost of an agentic loop, not just a single call. Set your model, step count, and the tokens added and produced per step, and see cumulative cost, total tokens billed, final context size, and estimated latency - with the key insight most cost math misses: the conversation is re-sent every step, so input tokens billed grow quadratically with loop length. Includes a prompt-caching toggle that shows how much that growth costs you, and how much caching saves. Fully client-side; prices are editable."
aiSummary: "A client-side estimator for multi-step LLM agent loops. It simulates context being re-billed each turn (quadratic token growth), computes cumulative cost, total billed tokens, final context size, and latency, and compares cost with and without prompt caching. Model prices prefill from a built-in table and are user-editable."
personalUse: "I kept being surprised by agent bills until I realized the cost isn't N calls - it's the whole conversation re-sent N times, so a 20-step loop pays for the early turns twenty times over. I built this to sanity-check a loop before I run it a thousand times, and to show, concretely, why prompt caching is the single biggest lever on agent cost."
status: "active"
publishedAt: "2026-06-19"
lastVerified: "2026-06-19"
companionPostSlug: ""
license: "MIT"
icon: "🔁"
---

## What It Does

A single API call is easy to price. An agent loop is not - because at every step the model re-reads the entire conversation so far. Step 10 pays for the system prompt, the original task, and all nine prior turns again. That re-billing is why agent costs balloon, and it's exactly what a per-call price estimate misses.

This tool simulates the loop turn by turn and adds it all up: total cost, total tokens billed, final context size, and estimated wall-clock latency.

## How to Use It

1. Pick a model - input, output, cached-input prices and the context window prefill (all editable, so you can match your provider's current rates).
2. Set the loop shape: number of steps, system prompt size, tokens added per step (tool results and observations), and tokens produced per step.
3. Read the results: total cost, billed vs unique tokens, final context, and latency. The per-step table shows the cost climbing as context grows.
4. Toggle prompt caching to see the savings, and watch for the warning if your loop would overflow the model's context window.

## The Key Insight

The number that surprises people is **billed tokens vs unique tokens**. Unique tokens are everything the conversation ever contained, counted once. Billed tokens are what you actually pay for - and because the context is re-sent each step, billed tokens grow roughly with the square of the step count. A loop that produces 20,000 unique tokens can bill you for 200,000+.

**Prompt caching** is the main defense: the stable prefix of the conversation is charged at the (much cheaper) cached rate, and only the newly added tokens each step pay full price. The tool shows the before/after so you can see the saving in dollars.

## Limitations

- **Estimates, not invoices** - real costs depend on exact tokenization, provider rounding, and how aggressively caching actually hits. Treat the output as a planning figure.
- **Prices are approximate** - the built-in table is a starting point with a last-checked date; edit the fields to match your provider's live pricing.
- **Uniform-step model** - it assumes an average tokens-per-step. Real loops vary turn to turn; for that, run a few scenarios (small, typical, worst-case) and bracket the cost.
- **Latency is a rough output-token estimate** - it uses a throughput figure and ignores network, queueing, and tool-execution time.
