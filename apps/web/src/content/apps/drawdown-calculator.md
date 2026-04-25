---
title: "Drawdown & Sharpe Calculator"
category: "trading"
job: "Paste a return series and get Sharpe, Sortino, max drawdown, Calmar, and equity curve"
description: "Analyze any return series with professional risk metrics. Input daily, weekly, or monthly returns and get Sharpe ratio, Sortino ratio, maximum drawdown, Calmar ratio, win rate, and a visual equity curve — all in your browser with no data uploaded anywhere."
aiSummary: "A client-side return series analyzer computing Sharpe ratio, Sortino ratio, maximum drawdown, Calmar ratio, win rate, and average win/loss from daily/weekly/monthly return inputs. Includes equity curve visualization and top-5 drawdown episode breakdown."
personalUse: "Every backtest I run generates a return series. I paste it here to get the risk-adjusted stats before I ever look at raw P&L. Drawdown tells the real story."
status: "active"
publishedAt: "2026-04-24"
lastVerified: "2026-04-24"
companionPostSlug: ""
license: "MIT"
icon: "📊"
---

## What It Does

Paste any return series — from a backtest, a broker export, or a manual trade log — and this tool computes the full suite of professional risk metrics: Sharpe ratio, Sortino ratio, maximum drawdown, Calmar ratio, win rate, and average win/loss ratio. All calculations happen in your browser. Your data never leaves your machine.

The tool also renders an equity curve showing the growth of $1 invested from the first period, and breaks down the top five drawdown episodes with peak, trough, and recovery information.

## How to Format Your Returns

The calculator accepts three input formats:

**Decimal format** — each line is a fractional return. `0.015` means 1.5%, `-0.032` means a 3.2% loss. This is the standard output format from most backtesting frameworks (Python's `pandas`, `quantstats`, `backtrader`, etc.).

**Percent format** — values greater than 1 in absolute value trigger automatic percent-mode detection. `1.5` is interpreted as 1.5%, `-3.2` as −3.2%. Useful when copying from Excel or a spreadsheet with percent-formatted columns.

**Comma or newline delimited** — either separator works. You can paste a single row of comma-separated values or a vertical column, whatever your source produces.

The minimum input is 3 periods. Meaningful statistics require at least 30 periods — fewer than that and the standard error on Sharpe ratio alone is too large to be actionable.

## The Six Risk Metrics Explained

### Sharpe Ratio

**Formula:** `Sharpe = (mean_excess_return / std_dev) × √periods_per_year`

Where excess return = period return minus the per-period risk-free rate (annual rate divided by 252/52/12).

**Interpretation:** return per unit of total volatility, annualized. A Sharpe of 1.0 means you earn one standard deviation of return above the risk-free rate annually. Above 1.0 is generally acceptable. Above 1.5 is good. Above 2.0 is excellent and uncommon in live trading.

**What it misses:** Sharpe penalizes all volatility equally — including upside volatility. A strategy that sometimes has large winning days is penalized the same as one with equivalent large losing days. For asymmetric strategies (options selling, trend following), Sharpe systematically understates risk-adjusted performance.

**What's a good number:** equity long-only strategies average Sharpe around 0.5–0.7 over long periods. Hedge funds targeting institutional capital typically show 1.0–1.5. Anything above 2.0 in live trading is either exceptional or has a short track record.

### Sortino Ratio

**Formula:** `Sortino = (mean_excess_return / downside_std) × √periods_per_year`

Where downside_std is the standard deviation of *negative* excess returns only (positive returns are excluded from the denominator).

**Interpretation:** return per unit of bad volatility. Conceptually superior to Sharpe for most trading strategies because investors don't object to large gains — only large losses. A strategy with consistent small gains and occasional large losses has a worse Sortino than Sharpe. A strategy with consistent small losses and occasional large gains has a better Sortino than Sharpe.

**What it misses:** downside deviation calculated from a small sample of negative periods is noisy. If your strategy has only 10 losing periods, the downside standard deviation is a weak estimate.

**What's a good number:** a Sortino above 1.0 is good. Above 2.0 is strong. Because Sortino is always ≥ Sharpe (the denominator is smaller or equal), the absolute number matters less than comparing it to peer strategies on the same return series.

### Max Drawdown

**Formula:** `MaxDD = max((peak_equity − trough_equity) / peak_equity)` across all time

**Interpretation:** the largest peak-to-trough decline in the equity curve as a percentage of the peak equity at that time. If your strategy grew from $100 to $150 then fell to $120 before recovering, the drawdown for that episode is (150 − 120) / 150 = 20%.

**What it misses:** max drawdown captures the worst historical episode but says nothing about the duration of that drawdown or how long recovery took. A 30% drawdown that recovered in 10 days is very different from a 30% drawdown that took two years to recover. That's what the drawdown history table addresses.

**What's a good number:** this is highly strategy-dependent. Buy-and-hold equities routinely show max drawdowns of 40–60% during bear markets. Systematically managed funds typically target max drawdowns below 20%. For a fully quantitative strategy, a max drawdown exceeding twice your average annual return is a warning sign.

### Calmar Ratio

**Formula:** `Calmar = annualized_return / |max_drawdown|`

**Interpretation:** how much annual return you earn per unit of worst-case pain. A Calmar of 1.0 means your annualized return equals your maximum drawdown — if you lose 15%, you earn 15% per year on average. Higher is better.

**What it misses:** max drawdown is a backward-looking worst case — it depends on the path of a single historical period. The Calmar can look excellent simply because the maximum drawdown episode hasn't happened yet. It is also highly sensitive to the lookback window: a strategy with one bad year at the start of the record will show a very different Calmar than the same strategy measured from five years later.

**What's a good number:** institutional investors typically look for Calmar above 0.5. Above 1.0 is strong. CTA funds averaging Calmar above 1.5 are considered elite.

### Win Rate

The percentage of periods with positive returns. Win rate in isolation is meaningless — a coin-flip strategy with a 50% win rate and 2× reward/risk ratio has positive expected value. A strategy with a 70% win rate and 0.3× reward/risk ratio is a slow bleed.

The win rate is most useful when combined with the average win/loss ratio (see below) to calculate expected value per period: `EV = win_rate × avg_win − (1 − win_rate) × avg_loss`. If EV > 0, the strategy has positive edge.

### Average Win/Loss Ratio

The ratio of the mean return on winning periods to the mean absolute return on losing periods. A ratio of 2.0 means your average winner is twice your average loser. Combined with win rate, this determines the Kelly-optimal position size (see the Position Sizer tool).

Trend-following strategies typically show low win rates (30–40%) with high win/loss ratios (2–4×). Mean-reversion strategies show high win rates (60–75%) with low win/loss ratios (0.5–1×). Both can be profitable — the math works out as long as `win_rate × avg_win > (1 − win_rate) × avg_loss`.

## Why Traders Need This

Raw P&L is a seductive lie. A strategy that made $100,000 last year might have required a $500,000 drawdown to get there. Another strategy made $60,000 with a maximum drawdown of $10,000. The second strategy is dramatically superior, but the first *looks* better in dollar terms.

Risk-adjusted metrics exist to make this comparison honest. Sharpe ratio normalizes return by the volatility required to achieve it. Sortino makes the same adjustment but only penalizes the volatility you actually care about: the downside. Calmar translates the worst-case experience into return terms.

The case for Sortino over Sharpe is particularly strong for options-selling strategies, which naturally have a return distribution with many small gains and occasional large losses (a left-skewed distribution). Sharpe will understate the risk of such strategies because it treats all volatility symmetrically. Sortino correctly identifies that the losses are the problem, not the occasional large gains.

Max drawdown is the most psychologically honest metric because it answers the question every trader eventually faces: *how bad could it get, and can I stay in the trade?* Strategies are abandoned at maximum drawdown, not at Sharpe ratios. If your strategy shows a 40% historical max drawdown, ask yourself honestly whether you would stay fully invested through a 40% decline. Most people say yes until it happens.

## Reading the Drawdown History

The top five drawdown episodes are sorted by depth (worst to least worst). Each episode shows:

- **Peak period** — the index of the last period before the drawdown began (when equity was at its highest)
- **Trough period** — the period when equity bottomed out
- **Recovery period** — when the equity curve returned to the prior peak level, or "—" if it hasn't recovered yet
- **Depth** — the percentage decline from peak to trough
- **Duration** — periods from peak to trough (how long it took to fall)

Recovery time is an underrated metric. A drawdown that recovers in 5 periods is a bad week. A drawdown still marked "ongoing" after 200 periods means you've been below your high-water mark for most of the strategy's life. Investors (and your own psychology) care about recovery time as much as depth.

The relationship between drawdown depth and recovery time reveals the strategy's resilience. If a 10% drawdown took 50 periods to recover and a 15% drawdown took 8 periods to recover, the strategy has regime-dependent behavior — the second episode was a sharper but transient shock, while the first was a slow structural erosion. That distinction matters for managing the strategy going forward.

## Limitations & Statistical Caveats

**Sample size:** all these metrics are estimates with standard errors. The 95% confidence interval on a Sharpe ratio from 60 months of data is roughly ±0.5. A Sharpe of 1.2 from two years of monthly data is statistically indistinguishable from a Sharpe of 0.5. Use these numbers for directional assessment, not precise ranking.

**Stationarity assumption:** Sharpe and Sortino assume your returns are drawn from a consistent distribution. If the strategy had a different regime in the first half of the data versus the second half, the combined statistics are averages of two different processes — potentially misleading. Split the return series and run both halves separately.

**Max drawdown is path-dependent:** two strategies with identical Sharpe ratios can have very different max drawdowns depending on how their return sequences happen to order. Max drawdown captures the worst realized path in your specific sample. A longer or different sample period might reveal a different worst case.

**Geometric vs arithmetic returns:** this calculator computes annualized return geometrically (`(1 + total_return)^(ppy/n) − 1`), which is the correct compound growth rate. Arithmetic annualization (`mean_period_return × ppy`) overstates returns for volatile strategies due to the variance drag. The difference becomes material above 20% annualized volatility.

**This is not financial advice.** Risk metrics describe historical behavior. Past drawdowns, Sharpe ratios, and win rates do not guarantee future performance. Markets change regimes; strategies that worked in one environment can fail in another. Use these metrics as diagnostic tools, not as performance promises.
