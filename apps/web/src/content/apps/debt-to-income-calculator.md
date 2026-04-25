---
title: "Debt-to-Income Calculator"
description: "Calculate your front-end and back-end DTI ratios, compare against FHA/Conventional/VA/USDA thresholds, and find out how much income you need to qualify."
job: "Front-end & back-end DTI — lender thresholds, max debt, income needed"
icon: "💳"
category: "finance"
status: "active"
publishedAt: "2026-04-19"
lastVerified: "2026-04-19"
license: "MIT"
aiSummary: "Calculates front-end DTI (housing costs / gross income) and back-end DTI (all monthly debts / gross income). Compares results to FHA, Conventional, VA, and USDA lender thresholds. Shows how much additional debt you can carry, and how much income you'd need to qualify at a given DTI."
personalUse: "Was running the numbers before refinancing and wanted a tool that showed all four loan types at once — not just a single threshold."
companionPostSlug: ""
---

## What It Does

The Debt-to-Income Calculator computes your front-end and back-end DTI ratios and immediately compares them against the qualification thresholds for four major loan types: Conventional, FHA, VA, and USDA. It also shows how much additional debt you can carry before exceeding each threshold, and how much gross monthly income you'd need to qualify at your current debt load.

DTI is the number that determines whether you can get a mortgage — often more than credit score. Understanding it before you apply lets you engineer your application rather than react to a rejection.

## How to Use It

1. Enter your **gross monthly income** — pre-tax, pre-deduction. Include all sources: salary, freelance, rental income, alimony if applicable.
2. Enter your **proposed housing costs**: monthly principal + interest (use the [Amortization Calculator](/apps/amortization-calculator/) to get this number), property taxes, homeowner's insurance, and HOA fees.
3. Enter all **other monthly debt obligations**: car payments, student loan minimums, credit card minimums, personal loan payments, child support.
4. The tool computes your front-end and back-end DTI instantly and shows a green/yellow/red qualification status for each loan type.
5. Check the "Income Needed" column to see what income level would comfortably qualify at each loan type's threshold.

## The Math / How It Works

**Front-end DTI** (housing ratio):
```
Front-end DTI = monthly housing costs / gross monthly income
```

**Back-end DTI** (total debt ratio):
```
Back-end DTI = (monthly housing costs + all other monthly debts) / gross monthly income
```

Both are expressed as percentages. Lenders calculate from **gross** income (before taxes) — not take-home pay, which is a common mistake that makes DTI look better than lenders will calculate it.

**The 28/36 rule** is the traditional conventional lending benchmark: no more than 28% front-end, no more than 36% back-end. Automated underwriting systems (Fannie Mae's DU, Freddie Mac's LP) have loosened this to allow back-end DTI up to 45% with compensating factors (high credit score, substantial reserves). FHA is more permissive at up to 50% back-end with compensating factors.

### Lender thresholds (approximate)

| Loan Type | Front-end Max | Back-end Max | Notes |
|-----------|--------------|-------------|-------|
| Conventional | 28% | 36%–45% | Lower DTI = better rate |
| FHA | 31% | 43%–50% | More flexible; requires MIP |
| VA | No limit | 41% | Residual income matters more |
| USDA | 29% | 41% | Rural/suburban only |

## Why Borrowers Need This Before Applying

DTI is the underwriting lever that most borrowers don't understand until a loan officer tells them they don't qualify. Credit score gets more attention, but for large mortgages, back-end DTI is often the binding constraint — especially for buyers who carry student loans or car payments alongside a proposed housing payment.

**Lenders care more about DTI than credit score** for one specific reason: it's a direct measure of monthly cash flow. A 750 credit score with a 55% back-end DTI still fails underwriting. A 680 score with a 38% DTI qualifies.

**How to lower DTI before a mortgage application:**
- Pay off or pay down revolving credit card balances (reduces minimum payment)
- Pay off small installment loans in full before applying (eliminates the payment entirely)
- Increase income through documented side income or a salary increase (requires 2-year history for most loan types)
- Choose a lower purchase price to reduce the proposed housing payment
- Make a larger down payment to reduce principal and therefore the monthly P&I

**Front-end vs back-end distinction matters for loan type selection.** If your credit card and student loan minimums are low but your housing cost is high relative to income, FHA's higher front-end threshold (31% vs 28% conventional) may be the difference between qualifying and not — even though FHA requires mortgage insurance premium (MIP).

The "income needed" output is useful for goal-setting. If the tool shows you need $8,500/month gross to qualify at a conventional back-end threshold on your target loan amount, and you currently earn $7,200, you have a concrete gap to close.

## Tips & Power Use

- **Use this alongside the [Amortization Calculator](/apps/amortization-calculator/)** — get the monthly P&I from there, enter it here as your housing cost, and see the DTI impact before you know what the property taxes will be. Then add a realistic tax estimate.
- **Credit card minimums, not balances** — DTI uses the minimum payment from your statement, not the balance. A $10,000 balance with a $200 minimum contributes $200 to your DTI, not $10,000. But paying it off eliminates that $200.
- **Do not include utilities, groceries, or subscriptions** — DTI only counts obligated recurring debt payments. Lenders don't factor in living expenses.
- **VA loans use residual income as the primary qualifier**, not DTI. The 41% back-end threshold is a guideline, not a hard cutoff. If your residual income (income after taxes and all debt payments) exceeds the VA's regional threshold, you may qualify even above 41%.
- **Run the "income needed" output before salary negotiation.** If you know you need $8,500/month gross to qualify for your target home, that number gives you a concrete negotiating anchor.

## Limitations

DTI is one factor among many. Lenders also weigh credit score, down payment, loan-to-value ratio, employment history, and cash reserves. A DTI within limits does not guarantee approval.

Minimum credit card payments are used in DTI — not balances. Check your statements for the actual required minimum.
