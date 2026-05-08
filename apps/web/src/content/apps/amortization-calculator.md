---
title: "Amortization Calculator"
category: "finance"
job: "Monthly + bi-weekly payment, lump-sum simulator, payoff date and full amortization schedule"
description: "Calculate mortgage or loan payments with a full amortization schedule. Enter principal, rate, term, and start date - get monthly payment, total interest, projected payoff date, yearly summary table, and CSV export. Simulate one-time lump-sum payments at any month and compare bi-weekly vs monthly schedules to see exact dollar and time savings. No login, no signup."
aiSummary: "Client-side amortization calculator computing monthly + bi-weekly payments, total interest, full schedule, and projected payoff date from a configurable loan start date. Supports unlimited one-time lump-sum payments at user-specified months. Compares bi-weekly schedule against standard monthly payoff. Pure JavaScript math, no API calls. Exports the full period-by-period schedule as CSV."
personalUse: "I run the numbers every time I evaluate a refi, compare loan offers, or sanity-check whether a year-end bonus is better deployed against principal vs invested. Having the schedule + payoff date + bi-weekly toggle in one tool means I can model 'should I switch to bi-weekly + drop my bonus on it' in 10 seconds instead of building a spreadsheet."
status: "active"
publishedAt: "2026-04-19"
icon: "🏦"
license: "MIT"
---

## What It Does

This calculator takes any loan - mortgage, auto, personal, student - and shows you not just the monthly payment, but the full amortization schedule: every month's split between principal and interest, the running balance, and how long the loan actually takes to pay off.

It also models three powerful payoff strategies side-by-side with the baseline:
- **Bi-weekly payment schedule** - pay half your monthly amount every two weeks. Adds up to ~13 monthly payments per year (vs 12), all extra going to principal.
- **One-time lump-sum payments** - schedule unlimited bonus/tax-refund/inheritance payments at specific months. Each one applies entirely to principal at that month, accelerating payoff.
- **Extra monthly payment** - additional principal each month above the required amount.

All three can stack. The "Acceleration impact" panel shows exactly how much time and interest each combination saves vs the standard monthly schedule.

Most people focus on the monthly payment. The amortization schedule is where the real information lives. A 30-year mortgage at 6.5% isn't just a big number over a long time - it's a document where you pay mostly interest for the first 10 years, and the bank has collected the majority of its interest before you've paid off 30% of the principal. The schedule makes that concrete.

## How to Use It

1. **Loan basics**: enter the financed principal (not purchase price), annual interest rate as a percentage, term in years, and the loan start date.
2. **Strategy**: optionally enter an extra monthly payment, and toggle between Monthly and Bi-weekly schedules.
3. **One-time payments**: click "+ Add lump-sum payment" to schedule a bonus or tax-refund payment at a specific month. Add as many as you want - they stack.
4. The summary cards, payoff date, savings panel, and chart all update immediately as you adjust inputs.
5. **Export CSV** to download the full period-by-period schedule with lump-sum applications marked.

The "Acceleration impact" panel at the top of the chart appears whenever you've enabled any acceleration (bi-weekly, extra, or lump-sums) and shows your payoff vs the standard 30-year monthly payoff side-by-side, with exact dollars and months saved.

## The Math / How It Works

### Monthly payment formula
```
M = P × r × (1 + r)ⁿ / ((1 + r)ⁿ − 1)
```
Where `P` = principal, `r` = monthly rate (annual rate ÷ 12), `n` = total months.

For each month: interest portion = remaining balance × monthly rate; principal portion = M − interest; new balance = old balance − principal portion.

### Bi-weekly schedule
Same monthly payment formula, but split in half and paid every 2 weeks. The math: 26 half-payments per year = 13 full monthly payments per year (vs 12 for monthly). The extra annual payment goes entirely to principal, compounding the savings. On a 30-year $300k loan at 6.5%, switching to bi-weekly cuts ~6 years off the loan and saves ~$88,000 in interest - for the same effective payment per dollar.

The per-period interest accrual uses `annualRate / 26`, consistent with how lenders disclose bi-weekly rates. Per-period payment = monthly payment ÷ 2.

### One-time lump-sum payments
Each scheduled lump-sum applies entirely to principal at the specified month. The simulation: at that period, after the regular interest + principal payment is applied, the lump-sum is subtracted from the remaining balance. Subsequent interest is calculated on the smaller balance.

The interest-front-loading effect makes early lump-sums dramatically more impactful than late ones. A single $5,000 lump-sum at month 12 of a 30-year $300k mortgage at 6.5% saves ~$26,000 in interest and pays off the loan 16 months early. The same $5,000 paid at month 240 (year 20) saves only ~$3,000 in interest.

### Payoff date projection
Given a start date and the calculated number of months/periods to payoff, the tool projects the exact calendar date the loan will be paid off. Useful for: planning around target dates (kids' college, retirement), comparing refi windows, and seeing "time saved" as actual months on the calendar instead of abstract numbers.

### Why early payments matter so much
The interest-front-loading effect is not a trick - it's a mathematical consequence of the amortization formula. In month 1 of a 30-year loan at 6.5%, roughly **81% of your payment is interest**. By month 300 (year 25), that flips to roughly 25% interest. Every extra dollar in month 12 saves ~29 years of compounding interest on that dollar.

This is why the order of strategies matters less than people think - bi-weekly, monthly extras, and early lump-sums all attack the same root cause: high outstanding balance during the early years.

## Why Homebuyers and Borrowers Need This

The monthly payment comparison is the wrong frame for evaluating loan offers. Two loans with identical monthly payments can have wildly different total costs depending on the term and rate. A $2,400/month payment on a 30-year loan accumulates a very different total interest load than the same payment on a 25-year loan.

The schedule also reframes the extra payment question. Most people intuitively know extra payments help, but the schedule shows exactly how much. An extra $200/month on a 30-year $400,000 mortgage at 6.5% pays off the loan ~5 years early and saves roughly $90,000 in interest. That's a number that changes behavior.

The bi-weekly toggle settles a common debate: "Should I pay bi-weekly?" The honest answer most lenders won't volunteer is yes - but the savings come entirely from the extra annual payment, not the cadence itself. If your lender doesn't apply bi-weekly half-payments as accelerated principal (some hold them and pay one full payment per month - defeating the point), you can replicate the effect by adding 1/12 of a monthly payment to your regular monthly payment instead.

Compare loan offers by running both through this tool and comparing total interest, not just monthly payment. A loan with a slightly higher rate but shorter term often costs less in total - the schedule makes that comparison transparent.

## Tips & Power Use

- **Stack all three strategies for maximum impact**: bi-weekly + $200/mo extra + a $5,000 year-end bonus on a 30-year $300k 6.5% loan pays off in **18.8 years instead of 30** and saves **~$166,000 in interest**.
- **The first lump-sum is by far the most valuable**. If you have $20k to deploy, putting it down at year 1 saves dramatically more interest than splitting into $5k chunks across years 5/10/15/20. Run both scenarios in the tool to see the math.
- **To model a refi:** enter the new loan amount as the current remaining balance from your existing schedule, with the new rate and remaining term. Compare total interest remaining on each path. Use the loan start date to align the new payoff date with your target.
- **For ARM loans:** run the calculator for the initial fixed period only, using the teaser rate. The schedule for the adjustable period is unknowable - but you'll see exactly where you'll be (principal balance, equity) when the rate resets.
- **Verify your lender's bi-weekly mechanics first**. Some banks accept bi-weekly enrollment but apply payments as one monthly transaction internally - defeating the savings. Call and ask: "Does each bi-weekly half-payment apply immediately to principal, or are they held until a full monthly amount accumulates?" The honest answer should be "applied immediately."
- **Use the [Debt-to-Income Calculator](/apps/debt-to-income-calculator/)** alongside this tool - plug the monthly payment from this calculator into the DTI tool to check whether the loan qualifies under lender thresholds before you apply.

## Limitations

- **Simple interest amortization only** - does not model compound interest, balloon payments, interest-only periods, negative amortization, or rate adjustments mid-loan.
- **No PMI, taxes, or insurance** - the calculated payment is principal + interest only (P&I). Escrow items are not included.
- **Bi-weekly assumes lender-accelerated application** - savings only materialize if your bank applies each half-payment to principal immediately. Some banks don't (see Tips above).
- **Assumes constant rate** - ARM loans will not match this calculator after the initial fixed period.
- **Lump-sums applied at month boundaries** - within bi-weekly mode, a lump-sum scheduled at "month 12" is applied at the closest bi-weekly period (~period 26), not exactly day 365.
