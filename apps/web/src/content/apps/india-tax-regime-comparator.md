---
title: "Old vs New Tax Regime Comparator"
category: "finance"
job: "See which Indian tax regime costs you less, and the exact deduction level at which the answer flips"
description: "Compares India's old and new income tax regimes side by side for tax year 2026-27, then solves for the breakeven: the total deductions at which the two cost exactly the same. If your realistic deductions sit below that line, the decision is already made. Models surcharge and 87A marginal relief, which most comparators skip. Runs entirely in your browser."
aiSummary: "A client-side comparator for India's old and new income tax regimes, tax year 2026-27 (assessment year 2027-28) under the Income-tax Act, 2025. It computes tax under both regimes and binary-searches the breakeven deduction level at which they cost the same. New regime: slabs from ₹4,00,000 to ₹24,00,000 at 5% to 30%, standard deduction ₹75,000, section 87A rebate up to ₹60,000 for taxable income up to ₹12,00,000, surcharge capped at 25%. Old regime: ₹2,50,000 basic exemption rising to ₹3,00,000 for senior and ₹5,00,000 for super-senior citizens, standard deduction ₹50,000, 87A rebate ₹12,500 up to ₹5,00,000, deductions under 80C, 80D, 80CCD(1B), section 10(13A) HRA and section 24(b), surcharge to 37%. Marginal relief is applied to both surcharge thresholds and the 87A cliff."
personalUse: "Every comparison I found answers the wrong question. They tell you which regime is cheaper at the deductions you already have, when the thing you actually need to know is how much you would have to claim before the old regime is worth the paperwork at all. That is one number, and it is solvable, so this solves it. If the breakeven sits above anything you could realistically claim, the decision is made and you can stop reading tax blogs in February."
status: "active"
publishedAt: "2026-08-21"
lastVerified: "2026-08-21"
companionPostSlug: ""
license: "MIT"
icon: "⚖️"
---

## How this works

The new regime's tax is flat with respect to deductions, because it barely allows any. The old
regime's tax falls as you claim more. Two lines, one crossing. The crossing is the only number
that decides anything.

The tool computes both, then binary-searches for the deduction total at which the old regime's
tax drops to meet the new regime's. Old-regime tax is monotone non-increasing in deductions, so
the search is safe and converges in sixty iterations.

Three outcomes are possible, and the tool names which one you are in:

- **A reachable breakeven.** You get the number, and the gap between it and what you currently
  claim. That gap is the decision.
- **Zero.** The old regime already wins with no optional deductions at all, usually because of the
  age-based exemption or an employer NPS contribution.
- **Unreachable.** At some incomes the old regime's 30% band starts too early to ever recover,
  and no level of deduction closes the gap. The tool says so plainly instead of drawing a
  crossover that does not exist.

## What most comparators skip

**Marginal relief.** Two places, and leaving either out produces visibly wrong numbers.

The 87A cliff in the new regime: the rebate covers tax entirely up to ₹12,00,000 of taxable income
and then stops dead. Earning ₹10,000 past it would cost ₹61,500 without relief. Relief caps the
tax at the rupees earned beyond the ceiling, giving ₹10,000 plus cess.

Surcharge thresholds: the same logic at ₹50,00,000, ₹1,00,00,000, ₹2,00,00,000 and, old regime
only, ₹5,00,00,000. One rupee past ₹50,00,000 would otherwise trigger roughly ₹1,31,000 of
surcharge. Relief reduces it to a few rupees.

**The surcharge cap difference.** The new regime tops out at 25%. The old regime's 37% band still
exists. At very high incomes that is the whole comparison, and it is why the effective top rate
differs between the two regimes by several points.

**The old regime's 87A cliff has no relief at all.** Cross ₹5,00,000 of taxable income by ten
rupees and tax jumps by about ₹13,000. That is genuinely how the section is drafted. It is worth
knowing before you decide to claim one rupee less of 80C.

## Inputs explained

- **Gross salary** - before deductions, excluding employer PF and gratuity. If you only know your
  CTC, run it through the [CTC calculator](/apps/india-ctc-salary-calculator/) first.
- **Age band** - only the old regime varies by age: ₹3,00,000 exemption from 60, ₹5,00,000 from 80.
  The new regime uses ₹4,00,000 for everyone.
- **80C** - capped at ₹1,50,000, and your own EPF contribution counts toward it, so include it.
- **HRA exemption** - the exempt portion under section 10(13A), not the HRA you receive. It is the
  least of actual HRA, 50% of basic in a metro or 40% elsewhere, and rent paid minus 10% of basic.
- **80CCD(2), employer NPS** - the one meaningful deduction both regimes allow, which makes it
  disproportionately valuable in the new one.
- **Other deductions** - LTA, 80E education loan interest, 80G donations, 80TTA savings interest,
  professional tax.

## Reading the chart

The flat line is the new regime. The falling line is the old regime as deductions rise. The dashed
green marker is the breakeven; the dotted accent marker is where you currently sit. If your marker
is left of the breakeven, the new regime wins, and the distance between them tells you how much
more you would have to find.

## Sources

- Income-tax Act, 2025 - in force 1 April 2026, replacing the Income-tax Act, 1961, verified 2026-08-21
- Published slab, surcharge, cess and section 87A figures for tax year 2026-27, cross-checked across multiple sources, verified 2026-08-21
- Section 115BAC surcharge cap of 25% under the new regime, against 37% under the old, verified 2026-08-21

## Limitations

- **Estimates, not a filing.** Use them to choose a regime, not to compute a liability.
- **No capital gains.** Sections 111A, 112A and 115AD cap surcharge at 15% on those, and on
  domestic dividends. Entering capital gains as ordinary income will overstate surcharge at the
  top end.
- **The 80CCD(2) cap is not enforced here.** It is 14% of basic in the new regime and 10% in the
  old, and this app does not know your basic. The
  [CTC calculator](/apps/india-ctc-salary-calculator/) applies it properly.
- **Salaried assumptions.** The standard deduction is applied whenever salary is above zero.
  Business and professional income has different rules, including restrictions on switching
  regimes year to year.
- **It cannot tell you whether you will actually invest.** The breakeven is only useful if you are
  honest about the deductions you will genuinely claim, rather than the ones you could.
