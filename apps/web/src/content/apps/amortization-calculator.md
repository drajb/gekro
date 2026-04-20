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

## How this works

Enter your loan principal, annual interest rate, and term. The calculator solves the standard amortization formula to find the fixed monthly payment, then builds the full schedule month by month — showing how each payment splits between principal and interest.

**Monthly payment formula:**

```
M = P × r × (1 + r)ⁿ / ((1 + r)ⁿ − 1)
```

Where `P` = principal, `r` = monthly rate (annual rate ÷ 12), `n` = total months.

**Yearly summary** — the default table shows one row per year: principal paid, interest paid, and remaining balance. Use the Export button for the full month-by-month CSV.

**Extra payment** — enter a monthly extra payment to see how much faster the loan pays off and how much interest you save.

## Inputs explained

- **Loan amount** — the total borrowed (principal). Does not include a down payment — enter the financed portion only.
- **Annual interest rate** — the nominal APR, not the APY. Most mortgages and personal loans quote APR.
- **Loan term** — in years or months. 30-year fixed = 360 months.
- **Extra monthly payment** — additional principal paid each month beyond the required payment. Reduces term and total interest significantly even at modest amounts.

## Limitations

- **Simple interest amortization only** — does not model compound interest, balloon payments, interest-only periods, negative amortization, adjustable rates, or biweekly payment schedules.
- **No PMI, taxes, or insurance** — the calculated payment is principal + interest only (P&I). Escrow items are not included.
- **Assumes constant rate** — ARM loans will not match this calculator after the initial fixed period.
