---
title: "Options P&L Calculator"
category: "trading"
job: "Visualize profit/loss at expiry across a price range for calls, puts, and spreads"
description: "Calculate maximum profit, maximum loss, and breakeven for long/short calls, puts, covered calls, and vertical spreads. Shows P&L at every price interval with estimated Greeks. No API calls, all math runs in your browser."
aiSummary: "A client-side options P&L calculator supporting long/short calls and puts, covered calls, cash-secured puts, and vertical spreads. Computes breakeven, max profit/loss, and estimated Greeks (Delta/Gamma/Theta/Vega) using Black-Scholes with a polynomial CDF approximation."
personalUse: "Before entering any options trade I run through the P&L profile to make sure the risk/reward and breakeven price match my thesis. Mental math at 0DTE is how you blow up accounts."
status: "active"
publishedAt: "2026-04-24"
lastVerified: "2026-04-24"
companionPostSlug: ""
license: "MIT"
icon: "📉"
---

## What It Does

This calculator shows you exactly what happens to your options position at every price point when the contract expires. You pick a strategy, enter your strike, premium, and number of contracts — the tool maps out your profit and loss across the full price range from 50% below current price to 50% above, in 5% increments.

No simulations, no Monte Carlo. This is deterministic math: at expiry, an option is worth its intrinsic value or zero. That certainty is what makes expiry P&L analysis the single most important exercise before entering any options trade.

The Greeks section runs a Black-Scholes model in parallel so you understand how the position behaves *before* expiry — how sensitive it is to price moves, time passing, and volatility changes.

## The Six Strategies

### Long Call

You pay a premium to own the right to buy 100 shares at the strike price. **Risk profile:** maximum loss is the premium paid (capped, known upfront). Maximum profit is theoretically unlimited as the stock rises.

Best used when you are bullish and want leveraged upside with defined downside. The breakeven is strike + premium — the stock must rise above that level for you to profit.

Long calls expire worthless frequently. The premium decay (theta) works against you every day the position is open.

### Long Put

You pay a premium to own the right to sell 100 shares at the strike price. **Risk profile:** maximum loss is the premium paid. Maximum profit is strike minus premium (capped — the stock can only go to zero).

Best used when you are bearish or hedging an existing long position. Breakeven is strike minus premium — the stock must fall below that level.

Puts are structurally more expensive than calls because institutional investors use them for portfolio hedging, creating persistent demand. This inflates put premiums relative to Black-Scholes fair value — a phenomenon called the volatility skew.

### Covered Call

You own 100 shares of the underlying and sell a call at a higher strike, collecting premium. **Risk profile:** your upside is capped at the strike price, but you collect income regardless of where the stock goes. If the stock collapses, you lose money on the shares minus the premium collected.

Best used on positions you plan to hold and where you're willing to be called away at the strike price. The premium collected reduces your effective cost basis.

This is one of the few strategies where you are *short* an option — you receive premium but accept the obligation to sell at the strike.

### Cash-Secured Put

You sell a put option and hold enough cash to buy the underlying if assigned. **Risk profile:** maximum profit is the premium received. Maximum loss is strike minus premium (you'd buy the stock at the strike, partially offset by premium).

Best used when you want to potentially buy a stock at a discount. If assigned, you acquire shares at an effective price of strike minus premium — potentially below current market price. If the put expires worthless, you keep the premium as income.

### Bull Call Spread

You buy a lower-strike call and sell a higher-strike call, paying a net debit (the difference in premiums). **Risk profile:** both max profit and max loss are capped. Max profit = width of strikes minus net debit. Max loss = net debit paid.

Best used when you are moderately bullish and want to reduce the cost of a long call by giving up some upside. The short call caps your gains but also reduces the premium you risk. Breakeven is lower strike plus net debit.

Spreads are the professional standard for directional plays — they trade unlimited upside for a better risk/reward ratio on a bounded move.

### Bear Put Spread

You buy a higher-strike put and sell a lower-strike put, paying a net debit. **Risk profile:** both max profit and max loss are capped. Max profit = spread width minus net debit. Max loss = net debit.

Best used when you are moderately bearish. The long put gives you downside exposure; the short put reduces cost but caps how far you profit if the stock collapses. Breakeven is upper strike minus net debit.

## Reading the P&L Table

The table shows 21 price points from −50% to +50% of the current underlying price in 5% steps. Each row shows:

- **Underlying Price** — where the stock settles at expiry
- **vs Current** — how far it moved from when you entered
- **P&L (total)** — your net gain or loss across all contracts at that price
- **Return on Premium** — P&L as a percentage of the premium you paid (only meaningful for debit strategies)

**Color coding:** green rows are profitable, red rows are losses, amber marks the breakeven zone. Look at the shape of the color pattern — a sharp transition from red to green indicates a binary outcome (often poor for risk management). A gradual green-to-red transition is more characteristic of spread strategies where the risk scales with movement.

## The Greeks — What They Mean

Greeks quantify how your option's value changes in response to the four key variables: price, time, volatility, and interest rates.

**Delta** — how much your position gains or loses for every $1 move in the underlying. A delta of 0.50 means the option moves approximately $0.50 for every $1 the stock moves. Calls have positive delta (0 to 1); puts have negative delta (−1 to 0). Deep in-the-money options approach delta 1 (or −1); far out-of-the-money options approach delta 0. Delta is also a rough proxy for the probability that an option expires in-the-money.

**Gamma** — the rate of change of delta. High gamma means your delta is unstable and changes rapidly as the stock moves. Near-expiry at-the-money options have extremely high gamma — small moves in the stock cause large delta shifts. This is why 0DTE trading is so dangerous: your risk can accelerate faster than you can manage it.

**Theta** — time decay measured in dollars per calendar day. Every day you hold a long option, theta erodes its value, all else being equal. A theta of −0.05 means you lose roughly $5 per day per contract (100 shares × $0.05). Theta accelerates as expiry approaches — the last week of an option's life sees the sharpest decay. Short options have *positive* theta: time passing profits the seller.

**Vega** — sensitivity to implied volatility. A vega of 0.15 means the option gains (or loses) $0.15 for every 1% increase (or decrease) in IV. Long options benefit from rising IV — they gain even if the stock doesn't move. This is why buying options before earnings (when IV is elevated) and holding through the announcement (when IV collapses) often results in losses despite being directionally correct. The "IV crush" destroys more value than the stock's move creates.

The Greeks interact: a position can be delta-neutral but heavily exposed to gamma and vega. Understanding these interactions is the difference between managing an options book and gambling.

## Why Traders Need This

Options are non-linear instruments. The P&L from a stock position scales linearly with price movement — double the move, double the gain. Options don't work that way. The relationship between underlying price and option value is curved (the convexity, driven by gamma), and that curve changes shape as time passes and volatility shifts.

Before entering any options trade, you need to know three things:

1. **What is my maximum loss?** If you don't know this number exactly, you don't understand your position. For long options it's the premium. For short naked options it's theoretically unlimited — which is why naked shorts require substantial margin requirements.

2. **What price does the underlying need to reach for me to break even?** If your thesis requires the stock to move 15% in 30 days and your breakeven is 12%, you have margin for error. If breakeven requires 18% movement and the stock has 20% IV, you're betting on a 3-standard-deviation move.

3. **What does the P&L shape look like?** A covered call has a completely different risk profile from a long call even if both are "bullish." The table makes this visual. Look for whether losses are bounded, where the position starts gaining, and whether the risk/reward ratio matches your conviction.

The P&L shape drives strategy selection. High conviction, defined risk → long option. Moderate conviction, want to reduce cost → spread. Income generation with obligation to own → cash-secured put or covered call.

## Black-Scholes: The Math

Black-Scholes (1973) gives a closed-form price for European options under five assumptions: the underlying follows geometric Brownian motion with constant volatility, no dividends, no arbitrage, continuous trading, and a constant risk-free rate.

The formula for a call option price:

```
C = S × N(d1) − K × e^(−rT) × N(d2)
d1 = [ln(S/K) + (r + σ²/2) × T] / (σ × √T)
d2 = d1 − σ × √T
```

Where S = current price, K = strike, r = risk-free rate, σ = implied volatility, T = time to expiry in years, and N() = cumulative normal distribution.

This calculator uses the **Abramowitz-Stegun rational approximation** for N(x) — a polynomial that approximates the normal CDF with maximum error under 7.5×10⁻⁸. No external library needed, the full implementation is ~15 lines of arithmetic.

The Greeks are analytical derivatives of this formula. Delta is ∂C/∂S = N(d1) for calls. Gamma is ∂²C/∂S² = N'(d1)/(S×σ×√T). Theta is ∂C/∂T (negative — value decays with time). Vega is ∂C/∂σ (positive for long options).

The "estimates only" disclaimer on the Greeks exists because Black-Scholes assumes constant volatility — real markets don't. Volatility smiles, skews, term structure, and correlation to price all mean the model's Greeks are approximations. They're accurate enough for intuition and initial risk assessment; execution-grade hedging requires more sophisticated models.

## Important Disclaimers & Limitations

**This calculator models expiry P&L only** (with Greeks as an approximation for pre-expiry behavior). It does not model the path-dependent value of an option before expiry. If you close a long call 15 days before expiry, your actual P&L will differ from what the table shows — it depends on IV, theta decay to that point, and the current underlying price.

**American-style options** can be exercised early. This calculator models European-style exercise (at expiry only). Most equity options are American-style. Early exercise is rarely optimal for calls (except around dividend dates) but can be optimal for puts in some scenarios.

**Dividends** are not modeled. Dividends reduce call value and increase put value. For high-dividend stocks, the Black-Scholes Greeks will be less accurate.

**Transaction costs** (commissions, bid-ask spread) are not included. A spread strategy with $0.10 slippage on each leg costs you $40 per round trip per contract — meaningful on a $50 debit spread.

**This is not financial advice.** Options involve substantial risk and are not suitable for all investors. The calculator is a mathematical tool. Markets can move beyond the ±50% range shown, and implied volatility can change dramatically, affecting pre-expiry position values far more than this tool shows.
