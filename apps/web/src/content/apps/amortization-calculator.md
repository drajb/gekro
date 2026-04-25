---
title: "Amortization Calculator"
category: "finance"
job: "Monthly payment, total interest, and full amortization schedule for any loan"
description: "Calculate mortgage or loan payments with a full amortization schedule. Enter principal, rate, and term — get monthly payment, total interest, yearly summary table, and CSV export. No login, no signup."
aiSummary: "A client-side amortization calculator that computes monthly payments, total interest paid, and generates a full amortization schedule exportable as CSV. Supports any loan type with principal, annual interest rate, and term inputs."
personalUse: "I run the numbers every time I evaluate a refi or compare loan offers. Having the full amortization schedule in front of you changes how you think about extra payments and payoff timing."
status: "active"
publishedAt: "2026-04-19"
icon: "🏦"
license: "MIT"
---

## What It Does

This calculator takes any loan — mortgage, auto, personal, student — and shows you not just the monthly payment, but the full amortization schedule: every month's split between principal and interest, the running balance, and how long the loan actually takes to pay off.

Most people focus on the monthly payment. The amortization schedule is where the real information lives. A 30-year mortgage at 6.5% isn't just a big number over a long time — it's a document where you pay mostly interest for the first 10 years, and the bank has collected the majority of its interest before you've paid off 30% of the principal. The schedule makes that concrete.

## How to Use It

1. Enter your **loan amount** — the financed principal, not the purchase price.
2. Enter your **annual interest rate** as a percentage (e.g., `6.5` for 6.5% APR).
3. Set the **loan term** in years (or switch to months for shorter-term loans).
4. Optionally enter an **extra monthly payment** to model accelerated payoff.
5. The yearly summary table updates immediately. Click **Export CSV** for the full month-by-month schedule.

The total interest figure at the top is the number worth staring at. On a $500,000 30-year mortgage at 6.5%, that number is over $638,000 — more than the loan itself.

## The Math / How It Works

**Monthly payment formula:**

```
M = P × r × (1 + r)ⁿ / ((1 + r)ⁿ − 1)
```

Where `P` = principal, `r` = monthly rate (annual rate ÷ 12), `n` = total months.

For each month in the schedule: interest portion = remaining balance × monthly rate; principal portion = M − interest; new balance = old balance − principal portion. With extra payments, the extra amount reduces the principal directly each month, which shortens the schedule and reduces total interest — because the next month's interest is calculated on a smaller balance.

The interest-front-loading effect is not a trick — it's a mathematical consequence of the formula. In month 1 of a 30-year loan at 6.5%, roughly 81% of your payment is interest. By month 300 (year 25), that flips to roughly 25% interest. This is why the first few years of extra payments have outsized impact: every extra dollar in month 12 saves ~29 years of compounding interest on that dollar.

## Why Homebuyers and Borrowers Need This

The monthly payment comparison is the wrong frame for evaluating loan offers. Two loans with identical monthly payments can have wildly different total costs depending on the term and rate. A $2,400/month payment on a 30-year loan accumulates a very different total interest load than the same payment on a 25-year loan.

The schedule also reframes the extra payment question. Most people intuitively know extra payments help, but the schedule shows exactly how much. An extra $200/month on a 30-year $400,000 mortgage at 6.5% pays off the loan ~5 years early and saves roughly $90,000 in interest. That's a number that changes behavior.

Compare loan offers by running both through this tool and comparing total interest, not just monthly payment. A loan with a slightly higher rate but shorter term often costs less in total — the schedule makes that comparison transparent.

## Tips & Power Use

- **Export the CSV and open it in a spreadsheet** to model scenarios the tool doesn't cover: lump-sum paydowns, rate changes, or selling the home mid-term (look at the balance column at your expected sale date).
- **To model a refi:** enter the new loan amount as the current remaining balance from your existing schedule, with the new rate and remaining term. Compare total interest remaining on each path.
- **The extra payment field is per month** — but you can also model a one-time paydown by dividing the lump sum by the months remaining and entering that as a "monthly" extra. It's an approximation but directionally correct.
- **For ARM loans:** run the calculator for the initial fixed period only, using the teaser rate. The schedule for the adjustable period is unknowable — but you'll see exactly where you'll be (principal balance, equity) when the rate resets.
- **Use the [Debt-to-Income Calculator](/apps/debt-to-income-calculator/)** alongside this tool — plug the monthly payment from this calculator into the DTI tool to check whether the loan qualifies under lender thresholds before you apply.

## Limitations

- **Simple interest amortization only** — does not model compound interest, balloon payments, interest-only periods, negative amortization, adjustable rates, or biweekly payment schedules.
- **No PMI, taxes, or insurance** — the calculated payment is principal + interest only (P&I). Escrow items are not included.
- **Assumes constant rate** — ARM loans will not match this calculator after the initial fixed period.
