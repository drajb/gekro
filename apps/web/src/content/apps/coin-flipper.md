---
title: "Coin Flipper"
description: "Flip a coin with a satisfying 3D animation. Track heads/tails stats, run multi-flip simulations, and verify probability over thousands of flips."
job: "Single flip · multi-flip · streak tracker · probability stats"
icon: "🪙"
category: "fun"
status: "active"
publishedAt: "2026-04-19"
lastVerified: "2026-04-19"
license: "MIT"
aiSummary: "A coin flipper with animated 3D CSS flip, heads/tails stats tracking, streak counter, and multi-flip simulation (up to 10,000 flips). Results use the browser's cryptographically secure random number generator."
personalUse: "Settling debates and teaching probability with actual run data."
companionPostSlug: ""
---

## What It Does

The Coin Flipper simulates fair coin flips with a 3D CSS animation, tracks running statistics (heads count, tails count, streak length), and lets you simulate up to 10,000 flips at once to verify probability convergence with your own eyes. All randomness comes from `crypto.getRandomValues()` — the browser's cryptographically secure RNG, not the weaker `Math.random()`.

It's useful as a decision tool, a probability teaching aid, and a gambler's fallacy corrector. The multi-flip simulation is the honest answer to "but coins can't really be 50/50 in practice, right?" — they can, and the large-N simulation shows it.

## How to Use It

1. Click **Flip** for a single animated coin flip. The result is decided before the animation starts — the animation is cosmetic.
2. Enter a number and click **Flip N** to simulate multiple flips instantly. Results are computed in one batch; individual flips are not animated.
3. Watch the **stats panel** update: heads count, tails count, heads percentage, and current streak length.
4. The **streak counter** tracks the current consecutive run of the same result.
5. Run a 1,000 or 10,000 flip simulation and watch the heads percentage converge toward 50%.

## The Math / How It Works

**Randomness source:** each flip calls `crypto.getRandomValues(new Uint32Array(1))` to generate a 32-bit cryptographically secure random integer. Even vs. odd determines heads vs. tails — a perfectly unbiased 50/50 split with no modulo bias. `Math.random()` uses a deterministic PRNG seeded at startup; `crypto.getRandomValues()` draws from the OS's entropy pool (hardware events, timing jitter), making it statistically indistinguishable from true randomness for this purpose.

**Law of large numbers:** as N increases, the observed heads percentage converges toward the theoretical probability of 50%. The convergence is proportional to `1/√N` — the standard deviation of the proportion. At 100 flips, the standard deviation is 5 percentage points; at 10,000 flips, it's 0.5 percentage points. This is why small samples look "uneven" and large samples look "correct."

**Streak analysis:** the probability of a streak of length k or more occurring somewhere in N flips is approximately `1 − (1 − (0.5)^k)^(N−k+1)`. For N=100, the probability of seeing a streak of 6 or more is over 80%. Long streaks aren't anomalies — they're expected. The streak counter exists specifically to show this.

## Why This Matters Beyond a Fun Tool

The gambler's fallacy — the belief that past results influence future independent events — is one of the most persistent cognitive errors in human decision-making. It shows up in trading ("I've had 5 losers in a row, the next one must win"), in slot machine play, in penalty kick strategy, and in everyday choices. A coin has no memory. Each flip is independent of all previous flips.

The multi-flip simulation is the empirical refutation of the gambler's fallacy. Run 10,000 flips and watch the cumulative heads percentage converge to 50% even after streaks of 8 or 10. The streak happened and the long-run probability was unaffected. That's the point.

**As a decision tool for genuinely equal options:** when you've analyzed a decision from every angle and the expected value is truly symmetric, flipping a coin is not intellectually weak — it's the mathematically correct tie-breaker. It's also faster and lower-friction than continued deliberation. The coin result also has a useful side effect: your emotional reaction to the outcome reveals which option you actually preferred.

**For teaching probability:** the live statistics panel, especially the convergence of the percentage toward 50% in large batches, makes the law of large numbers concrete rather than abstract. Students can run 100, 1,000, and 10,000 flips and see the convergence themselves in seconds.

## Tips & Power Use

- **Run 10,000 flips, record the percentage, reset, run again.** You'll see the variance across runs narrow as N increases — this is the law of large numbers made visible. Two runs of 100 might give 44% and 58%. Two runs of 10,000 will be much closer.
- **Watch for long streaks in 100-flip sessions.** A streak of 7 or 8 will appear more often than your intuition predicts. When it happens, the subsequent flip probability is still exactly 50/50 — the streak changes nothing.
- **Use the streak counter as a gambler's fallacy calibration.** After a 6-flip heads streak, the probability of the next flip being tails is still 50%. The counter is there to make that concrete, not to suggest the streak "means" anything.
- **For decision-making:** commit to the coin's answer before flipping. If you flip and feel relief or disappointment at the result, that emotion is information about your actual preference — which the deliberation obscured.

## How the randomness works

Each flip uses `crypto.getRandomValues()` — the browser's cryptographically secure random number generator — rather than `Math.random()`. This produces a true 50/50 distribution even over millions of flips. The large-number simulations let you verify the law of large numbers directly.

### Streak analysis

The streak counter tracks the current consecutive run of the same result. Long streaks (8+) feel surprising but are statistically expected: in a sequence of 100 fair flips, the probability of a streak of 6 or more is over 80%.

## Limitations

- Results are random — the animation outcome is decided before the animation starts.
- Multi-flip simulations do not animate individual flips; results are computed instantly.
