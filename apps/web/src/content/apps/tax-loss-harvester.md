---
title: "Tax-Loss Harvest Optimizer"
category: "finance"
job: "Paste lot-level positions, see which to sell for max harvested losses while the wash-sale rule keeps the deductions valid. Federal-only. Produces a plan - never places trades."
description: "Free in-browser tax-loss harvesting planner. Paste a CSV of your tax lots (one row per purchase), set your federal tax brackets and harvest target, and the app produces a per-lot HARVEST / WASH / HOLD / GAIN plan. Wash-sale aware: flags lots where another buy of the same ticker within 30 days before or after would disallow the loss. Splits Short-Term vs Long-Term losses, estimates federal tax saved, surfaces what carries forward past the $3,000/yr ordinary-income cap. Lists common ETF replacement pairings (SPY → VOO, AGG → BND, etc.) for keeping market exposure without triggering wash-sale. Download the plan as CSV. Federal-only by design. Never places trades."
aiSummary: "Client-side tax-loss-harvesting planner per IRC §1091 (wash-sale rule). CSV parser auto-detects headers via alias map (ticker/symbol/sym, buy_date/date/acquired, shares/quantity/qty, cost_per_share/cost_basis/price, current_price/last). Optionally accepts a separate recent-transactions CSV (last 60 days) for cross-ticker wash-sale checks. Algorithm: for each lot compute holding period (>365d = LT), P/L = (current - basis) * shares; for losses, check wash-sale risk (recent tx OR same-ticker lot bought within ±30d of today); greedy-select harvest-eligible lots largest-loss-first until target is met, mark surplus as HOLD. Estimates federal tax saved as ST_loss * st_marginal_rate + LT_loss * lt_rate (15/20/23.8% with NIIT). Caps net cap-loss deduction against ordinary income at $3,000/yr per federal rules; surplus carries forward (shown). Hard limits: never places trades (per Rohit's standing rule), never integrates with brokers, federal-only (no state overlay — known omission per 2026-05-23 scope decision), 'substantially identical' detection is exact-ticker only (commonly-cited not-substantially-identical ETF pairings surfaced in a separate panel for human judgment). No persistent state."
personalUse: "Late December every year I run my brokerage exports through a spreadsheet trying to figure out what to harvest. Built this to make next December a 30-second exercise instead of an hour of formulas."
status: "active"
publishedAt: "2026-05-25"
icon: "📉"
license: "MIT"
---

## What It Does

Paste lot-level positions (one row per purchase), set your tax brackets and harvest target. Get a per-lot plan:

- **HARVEST** (green) — sell at a loss, the loss is deductible
- **WASH** (yellow) — sell would trigger wash-sale, loss disallowed
- **HOLD** (grey) — at a loss but the target has already been met
- **GAIN** (blue) — holding avoids realizing a taxable gain

Plus aggregate stats: lots to sell, total losses harvested, ST vs LT split, federal tax saved, carry-forward beyond the $3,000/yr cap.

## Input format

CSV with these columns (case-insensitive, synonyms recognized):

| Required | Aliases |
|---|---|
| `ticker` | `symbol`, `sym`, `stock` |
| `buy_date` | `date`, `purchase_date`, `acquired` |
| `shares` | `quantity`, `qty`, `units` |
| `cost_per_share` *or* `cost_basis` | `price`, `cost`, `unit_cost`, `avg_price` (or basis aliases) |
| `current_price` | `current`, `market_price`, `last` |

```csv
ticker,buy_date,shares,cost_per_share,current_price
AAPL,2024-03-15,100,170.50,225.00
TSLA,2024-01-10,40,400.00,180.00
VOO,2024-06-20,80,490.00,560.00
```

Optionally paste a "recent transactions" CSV for the last 60 days — buys there get cross-checked against the wash-sale window.

## Wash-sale rule

IRC §1091: if you sell a security at a loss and you (or your spouse, or any account you control including IRAs) buy a **substantially identical** security within **30 days before or after** the sale, the loss is disallowed. Instead, the disallowed amount is added to the cost basis of the replacement shares — you eventually get the benefit, but the harvest year's deduction is gone.

This app's detection scope:

| Detected | How |
|---|---|
| ✅ Same-ticker buy within ±30 d of today (from your positions) | Direct match in the lot list |
| ✅ Same-ticker buy in the recent-transactions CSV | Direct match in optional input |
| ❌ Spouse / IRA / 401(k) purchases | You'd have to add them to the recent-tx CSV |
| ❌ ETFs tracking the same index (SPY vs VOO vs IVV) | Listed in the replacement panel for your judgment |
| ❌ Options / warrants of the same underlying | Out of scope |
| ❌ Sales placed in the future | "Today" is the reference point — set the reference date if you're planning ahead |

The IRS hasn't published a definitive list of what counts as "substantially identical." Most tax pros treat SPY/IVV/VOO as not substantially identical (different funds, different sponsors), but two share classes of the same fund clearly are. The replacement panel surfaces commonly-cited pairings — verify with your tax advisor.

## Tax assumptions

**Short-term rate** defaults to 24% (the 2026 federal marginal for ~$100K-$200K MFJ income). Pick yours.

**Long-term rate** defaults to 15% (the standard bracket for most filers). Choose 20% for high earners or 23.8% if you also pay the 3.8% Net Investment Income Tax.

**$3,000 cap**: federal rules let you deduct at most $3,000 of net capital losses against ordinary income per year. Excess carries forward indefinitely (still useful for offsetting future gains). The plan shows the carry-forward amount.

**Federal-only**: state-tax overlay is deliberately out of scope for v1 because state conformity to federal cap-gains treatment varies wildly (CA partial, NJ no LT preference, NH/TN no income tax) and getting it wrong would mislead. Add the state delta manually if you need it.

## What's NOT Included (intentional)

- **Trade execution** — never. The app produces a plan; you review and place trades in your brokerage. This is a hard rule.
- **Broker integration** — same reason
- **Real-time prices** — paste your current prices; if you want live quotes write your own ETL into the CSV
- **State-tax overlay** — see above
- **Cross-account aggregation** — your spouse's IRA can trigger wash-sale on your taxable account. Either add those buys to the recent-tx CSV or remember to check manually
- **Options / futures handling** — equities only for v1
- **Persistent state** — reload starts fresh, by design

## Related Tools

- [Amortization Calculator](/apps/amortization-calculator/) - the other big finance app
- [Position Sizer](/apps/position-sizer/) - position sizing math (Kelly criterion, fixed fractional)
- [Options P&L Visualizer](/apps/options-pnl/) - if your harvest involves options legs
- [Drawdown Calculator](/apps/drawdown-calculator/) - max drawdown from a return series
