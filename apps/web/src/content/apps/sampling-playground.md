---
title: "Sampling Playground"
category: "ai"
job: "See exactly how temperature, top-p, top-k, min-p, and repetition penalty reshape a model's next-token probabilities"
description: "An interactive playground for LLM sampling parameters. Start from a fixed next-token distribution and watch live as temperature, top-k, top-p (nucleus), min-p, and repetition penalty filter and reshape the probabilities - with each token's final sampling chance drawn as a bar and filtered-out tokens greyed out. The clearest way to build intuition for why your generations are too random, too repetitive, or too bland. Runs entirely in the browser."
aiSummary: "A client-side visualizer for LLM sampling parameters. It applies repetition penalty, temperature, top-k, top-p (nucleus), and min-p - in the correct order - to a fixed token distribution and shows the resulting probabilities as live bars, making it clear how each knob changes which tokens can be sampled."
personalUse: "I can never remember whether to reach for top-p or min-p when a local model gets repetitive, so I stop guessing and watch the distribution move. Dragging temperature and seeing the tail collapse or fan out does more for my intuition than any blog post, and it's how I now explain sampling to people who think 'temperature' is a single magic dial."
status: "active"
publishedAt: "2026-06-19"
lastVerified: "2026-06-19"
companionPostSlug: ""
license: "MIT"
icon: "🎲"
---

## What It Does

When a language model generates text, it produces a probability for every possible next token. Sampling parameters decide which of those tokens are actually allowed to be picked, and how the odds are weighted. Most people treat them as vague vibes - "turn temperature down to make it less crazy." This tool shows the actual mechanism.

Start from a fixed example distribution (the candidate next-tokens after "The weather today is"), then move the sliders and watch the bars change in real time.

## How to Use It

1. Adjust any slider - temperature, top-k, top-p, min-p, or repetition penalty.
2. Watch the bars: each token's bar width is its final probability of being sampled. Tokens removed by a filter are greyed out and struck through.
3. Two tokens are marked as "already used" so you can see repetition penalty push their probability down.
4. Reset to defaults (temperature 0.8, everything else off) to see the plain softmax baseline.

## How the Knobs Work

The parameters are applied in a specific order, and order matters:

1. **Repetition penalty** - divides the logits of already-used tokens, making them less likely to repeat.
2. **Temperature** - divides all logits. Below 1.0 sharpens the distribution (more confident, more repetitive); above 1.0 flattens it (more random).
3. **Softmax** - turns logits into probabilities.
4. **Top-k** - keeps only the k most probable tokens.
5. **Top-p (nucleus)** - keeps the smallest set of tokens whose cumulative probability reaches p.
6. **Min-p** - keeps only tokens at least as probable as `min_p x (the top token's probability)`.
7. **Renormalize** - the survivors are rescaled to sum to 1. Those are the real odds.

## Why It's Useful

- **Repetitive output** - usually temperature too low, or no repetition penalty. Watch how a penalty redistributes mass to fresh tokens.
- **Incoherent output** - usually temperature too high with no top-p/min-p cutoff, so the long tail of nonsense tokens stays sampleable.
- **top-p vs min-p** - min-p is relative to the top token, so it adapts to how confident the model is on each step; top-p uses a fixed cumulative mass. Toggling both on the same distribution makes the difference obvious.

## Limitations

- **Illustrative distribution** - the token set and logits are a fixed, hand-built example, not a live model. The math is real; the numbers are a teaching set.
- **Greedy and beam search not shown** - this covers the common sampling stack (temperature + truncation), not deterministic decoding.
- **Implementation details vary** - some runtimes apply these filters in a slightly different order or define repetition penalty differently (presence vs frequency). This uses the most common Hugging Face conventions.
