---
title: "Position Sizer"
category: "trading"
job: "Calculate optimal trade size with Kelly criterion and fixed-risk models"
description: "Input your account size, risk tolerance, win rate, and reward/risk ratio — get position size recommendations from the Kelly criterion, fractional Kelly, and fixed-percent-risk models side by side. No login, client-side math only."
aiSummary: "A client-side position sizing calculator implementing the Kelly criterion, half-Kelly, and fixed-percent-risk models. Given account size, win rate, and reward-to-risk ratio, it outputs recommended position sizes and simulates 50-trade equity curves for each model."
personalUse: "I run this before sizing any discretionary trade. Kelly tells me the theoretical max; I trade half-Kelly in practice because the variance at full Kelly is brutal even when the math is right."
status: "active"
publishedAt: "2026-04-19"
icon: "📊"
license: "MIT"
---

## What It Does

The Position Sizer computes the mathematically optimal bet size for a trading setup under three models: the Kelly criterion (maximum geometric growth), half-Kelly (the standard professional adjustment), and fixed-percent-risk. Enter your account size, your historical win rate for this setup, and your average reward-to-risk ratio — the tool outputs the recommended position size in dollars and as a percentage, and simulates a 50-trade equity curve for each model.

It's for discretionary and systematic traders who want to size positions from first principles rather than gut feel. The Kelly criterion is the mathematically correct answer to "how much should I bet if I have an edge" — and this tool makes the calculation and its practical application immediate.

## How to Use It

1. Enter your **account size** — capital allocated to this strategy, not your total net worth.
2. Enter your **win rate** as a percentage (e.g., `55` for 55%). Use your historical realized win rate, not a target.
3. Enter your **reward/risk ratio** (R-multiple) — average winner size ÷ average loser size from your trade log. Use realized R, not planned.
4. The tool outputs position sizes under all three models. The 50-trade equity simulation below shows the range of outcomes for each approach.
5. Adjust inputs and re-run as your edge data evolves.

## The Math / How It Works

**Kelly Criterion** — the theoretically optimal fraction to bet to maximize long-run geometric growth:

```
f* = (bp − q) / b
```

Where `b` = reward/risk ratio, `p` = win rate, `q` = 1 − p.

Example: at 55% win rate and 2:1 reward/risk ratio:
`f* = (2 × 0.55 − 0.45) / 2 = (1.10 − 0.45) / 2 = 0.325`

Full Kelly says bet 32.5% of your account on this trade. That's a number most traders find terrifying — and correctly so, because the variance at full Kelly is extreme. A string of losses at 32.5% position sizing creates deep drawdowns that are psychologically and practically difficult to sustain.

**Half-Kelly (½K)** — bet half the Kelly fraction: `f_half = f* / 2`. At the example above, that's 16.25%. Half-Kelly gives approximately 75% of the geometric growth rate of full Kelly with significantly lower variance. It's the standard approach among professional Kelly practitioners.

**Why trade 8–9% rather than 16.25%?** Because Kelly assumes your edge estimate is exact. In practice, your win rate estimate has error bars. If your true win rate is 52% instead of 55%, full Kelly becomes overbet and you're in negative Kelly territory — losing money despite having a real edge. Trading fractional Kelly (quarter or less) provides a margin of safety against estimation error while capturing meaningful geometric growth.

The equity simulation samples 50 trades randomly from your win rate distribution, applies the position sizing for each model, and shows the cumulative equity curve. Run it multiple times — the spread of outcomes across simulations tells you something important about variance at each bet size.

## Why I Built This — and Why You Need It

Position sizing is the most underrated skill in trading. Most retail traders lose not because they can't pick directions but because they size positions emotionally — too small when confident, too large when eager to recover a loss. The Kelly criterion makes sizing a function of measured edge rather than feeling.

The tool exists because I ran into the classic Kelly problem in live trading: Kelly said 30%+ positions were optimal, I traded them, and the variance was brutal even though the math was right. The equity curve was geometrically growing but the path was psychologically unsustainable. Half-Kelly resolved the contradiction — you give up some expected growth rate to get a path you can actually stay on.

The 50-trade simulation is the important part. Most people see a Kelly percentage and think about the average outcome. The simulation shows you the distribution: the best case, the worst case, and how often the worst case looks like a losing strategy even when you have edge. If 20% of the simulated paths end below starting equity at 50 trades, you need to size more conservatively or confirm your edge estimate is solid.

## Tips & Power Use

- **At 55% win rate with 2:1 R, Kelly says 32.5%.** In practice, trade 8–9% (quarter-Kelly) until you have 200+ trades of data confirming that edge. Sample size matters enormously — a 55% win rate estimated from 30 trades has a 95% confidence interval spanning roughly 37–73%, which swings Kelly from deeply negative to 40%+.
- **Use realized R, not planned R.** If you plan 2:1 trades but your average winner is 1.4R after slippage and early exits, your actual edge is significantly lower than the inputs suggest. Kelly is brutally sensitive to this: overestimating R by 20% can result in a 40%+ overestimate of optimal size.
- **Re-run after every 50 trades** as your realized win rate and R stabilize toward their true value. Kelly sizing should converge with your data, not stay fixed.
- **Account size should be strategy-specific.** If you're running two uncorrelated strategies, size each separately from its allocated capital — not your total account.
- **The fixed-percent model is the fallback.** When you don't have 50+ trades of reliable edge data, fixed 1–2% risk per trade is the honest answer. Kelly requires a known edge; without data, use fixed percent and gather it.

## Important warnings

Kelly is extremely sensitive to input accuracy. A win rate estimate that is 5% too high can result in Kelly prescribing 2× the safe bet size. Always:

1. Use realized historical data, not estimates
2. Trade no more than half-Kelly in live markets
3. Re-run the calculation as your edge data improves

## Limitations

- **Assumes independent, identically distributed trades** — real markets have correlation, regime changes, and fat tails. Kelly assumes none of these.
- **No transaction costs** — slippage, commissions, and spread reduce your effective edge and reduce the optimal Kelly fraction.
- **Psychological reality** — even ½ Kelly will feel uncomfortable during drawdowns. Most traders perform better at ¼ Kelly despite the lower expected return.
- **This is not financial advice** — position sizing math does not guarantee profitability. A negative edge traded with perfect Kelly sizing still results in ruin.
