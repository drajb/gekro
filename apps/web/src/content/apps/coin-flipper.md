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

## How the randomness works

Each flip uses `crypto.getRandomValues()` — the browser's cryptographically secure random number generator — rather than `Math.random()`. This produces a true 50/50 distribution even over millions of flips. The large-number simulations let you verify the law of large numbers directly.

### Streak analysis

The streak counter tracks the current consecutive run of the same result. Long streaks (8+) feel surprising but are statistically expected: in a sequence of 100 fair flips, the probability of a streak of 6 or more is over 80%.

### Limitations

- Results are random — the animation outcome is decided before the animation starts.
- Multi-flip simulations do not animate individual flips; results are computed instantly.
