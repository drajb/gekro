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

## How this works

Enter your account size, your historical win rate for this setup, and your average reward-to-risk ratio (R-multiple). The calculator outputs the recommended position size under three models and simulates what 50 trades might look like for each.

## The models

**Kelly Criterion** — the theoretically optimal fraction to bet to maximize long-run geometric growth:

```
f* = (bp − q) / b
```

Where `b` = reward/risk ratio, `p` = win rate, `q` = 1 − p.

**Half-Kelly (½K)** — bet half the Kelly fraction. Gives ~75% of the geometric growth rate with significantly lower drawdown variance. The standard professional practice.

**Fixed percent risk** — risk a fixed percentage of account per trade regardless of edge. Common choices: 1% (conservative), 2% (standard), 3% (aggressive). Less optimal than Kelly but more psychologically manageable.

## How to find your inputs

- **Win rate** — from your backtest or trade log. If you don't have 30+ trades in this setup, the estimate is unreliable. Use a conservative (lower) estimate.
- **Reward/risk ratio** — average winner size ÷ average loser size from your trade log. Use realized R, not planned R — slippage matters.
- **Account size** — the capital allocated to this strategy, not your total net worth.

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
