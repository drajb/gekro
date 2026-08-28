---
title: "India CTC to In-Hand Salary Calculator"
category: "finance"
job: "Take an Indian offer letter's CTC apart and see what actually reaches your bank account each month"
description: "Breaks an Indian CTC into basic, HRA, special allowance, employer PF, gratuity and NPS, then runs the remainder through both tax regimes to show monthly take-home. Models the EPF wage-ceiling choice, gratuity as a five-year lock-up, state professional tax and the HRA exemption. Tax year 2026-27. Runs entirely in your browser, so your salary never leaves the tab."
aiSummary: "A client-side Indian CTC to in-hand salary calculator for tax year 2026-27 (assessment year 2027-28), the first year under the Income-tax Act, 2025. It splits CTC into basic, HRA, special allowance, variable pay, employer EPF, the 4.81% gratuity provision and employer NPS, then computes tax under both the new regime (section 115BAC: standard deduction ₹75,000, 87A rebate up to ₹60,000 below ₹12,00,000, surcharge capped at 25%) and the old regime (standard deduction ₹50,000, HRA exemption under section 10(13A), 80C, 80D, 80CCD(1B), section 24(b) interest, surcharge to 37%). It models EPF at either the ₹15,000 statutory wage ceiling or 12% of full basic, applies state professional tax as a section 16(iii) deduction in the old regime only, and includes marginal relief on both surcharge and the 87A cliff."
personalUse: "I have filed tax in India, so I have sat with the gap between the CTC printed on an offer letter and the number that actually turns up. Employer PF, the gratuity provision and any NPS contribution all count against your package, and not one of them reaches your bank account this month. What bothered me more is that every tool answering this question is an ad-funded site asking you to paste your real salary into a form, which is a terrible trade for arithmetic a browser can do offline. So this does the subtraction locally and shows every line, including the EPF wage-ceiling toggle that swings take-home further than anything else on the page."
status: "active"
publishedAt: "2026-08-28"
lastVerified: "2026-08-28"
companionPostSlug: ""
license: "MIT"
icon: "🇮🇳"
---

## How this works

CTC is the total an employer spends on you. Your salary is a subset of it, and your take-home is
a subset of that. The tool walks the three levels.

**CTC** splits into basic, HRA, special allowance, variable pay, employer EPF, the gratuity
provision and employer NPS. You set basic as a percentage of CTC and HRA as a percentage of basic;
whatever is left over after every named component becomes the special allowance. If that number
goes negative, the split you described is impossible and the tool says so rather than quietly
showing nonsense.

**Gross salary** is CTC minus the employer's own EPF contribution and minus the gratuity
provision. Neither is salary in your hands. Employer NPS stays inside gross, because it is taxable
salary that then comes back out as a section 80CCD(2) deduction.

**Take-home** is gross minus your own EPF contribution, minus professional tax, minus income tax.
The tool computes tax under both regimes and reports whichever is cheaper.

## The three things that move the number most

**The EPF basis.** The statutory wage ceiling is ₹15,000, so 12% of it is ₹1,800 a month. Plenty
of employers stop there. Others apply 12% to your full basic, which on a ₹15,00,000 package is
₹6,000 a month out of each side instead of ₹1,800. That is the single largest swing on this page,
and offer letters are frequently vague about which one applies. Ask.

**Gratuity.** It is 4.81% of basic, it is counted against your package from the day you join, and
it pays nothing at all until five years of continuous service. On a ₹15,00,000 CTC with a 40%
basic that is roughly ₹28,900 a year of headline you may never collect. The tool lets you take it
out of the picture to see what the package looks like without it.

**Basic percentage.** A higher basic raises your EPF and gratuity, which lowers take-home now and
raises forced savings. It also raises the ceiling on your HRA exemption, which matters a great
deal in the old regime if you pay serious rent. There is no universally right answer, which is why
it is a slider rather than a constant.

## Inputs explained

- **Annual CTC** - the headline number on the offer letter.
- **Basic as % of CTC** - typically 40 to 50%. Check your letter rather than guessing.
- **HRA as % of basic** - commonly 50% in the metros and 40% elsewhere, mirroring the exemption limbs.
- **EPF basis** - statutory ceiling, 12% of full basic, or not applicable.
- **Employer NPS** - deductible under section 80CCD(2) up to 14% of basic in the new regime and
  10% in the old. One of the very few deductions the new regime still allows, which makes it
  unusually valuable there.
- **City** - for HRA, metro means Delhi, Mumbai, Kolkata and Chennai. Those four, and nothing
  else, whatever the population of your city.
- **Professional tax state** - a state levy, capped at ₹2,500 a year by Article 276(2) of the
  Constitution, which is why nobody anywhere pays more than that. Deductible under section 16(iii)
  in the old regime only.

## The tax engine

Tax year 2026-27, the first year under the Income-tax Act, 2025, which replaced the 1961 Act on
1 April 2026 and retired "previous year" and "assessment year" in favour of "tax year". Budget
2026 left the slabs, cess, surcharge and rebate alone.

Two pieces of marginal relief are modelled, because leaving them out visibly breaks the numbers:

- **The 87A cliff.** In the new regime the rebate wipes out tax up to ₹12,00,000 of taxable income
  and then stops. Without relief, earning ₹10,000 more would cost ₹61,500. Relief caps the tax at
  the rupees you earned past the ceiling, so it is ₹10,000 plus cess.
- **Surcharge thresholds.** The same principle at ₹50,00,000, ₹1,00,00,000, ₹2,00,00,000 and, in
  the old regime only, ₹5,00,00,000.

Worth knowing: because relief caps the tax and then 4% cess lands on top of the capped figure, an
extra rupee inside a relief band costs ₹1.04. Take-home genuinely dips very slightly across those
bands. That is the law working as written, not a rounding error here.

## Sources

- Income-tax Act, 2025 - in force 1 April 2026, verified 2026-08-28
- Published slab, surcharge, cess and section 87A figures for tax year 2026-27 (assessment year 2027-28), cross-checked across multiple sources, verified 2026-08-28
- EPF statutory wage ceiling of ₹15,000 and the 12% contribution rate, verified 2026-08-28
- Professional tax rates by state, subject to the ₹2,500 annual constitutional cap under Article 276(2), verified 2026-08-28

## Limitations

- **Estimates, not your payslip.** Actual TDS depends on the investment declarations you file with
  your employer and when you file them.
- **The salary structure is a model.** Real letters carry LTA, food coupons, telephone
  reimbursement, car lease and a dozen other heads with their own tax treatment. This collapses
  all of it into the special allowance.
- **Monthly figures average the year.** If your variable pay lands as one lump, ordinary months
  are lower. The tool reports both.
- **No capital gains.** Sections 111A, 112A and 115AD cap surcharge at 15% on those. Feeding
  capital gains in here as ordinary income will overstate surcharge at the top end.
- **Below 60 only** for the age-based exemption. For the senior and super-senior bands, use the
  [regime comparator](/apps/india-tax-regime-comparator/).
- **Old regime deductions are yours to enter.** The tool will not check whether you actually hold
  the investments you claim.

## Disclaimer

**This tool is provided as is, with no warranty of any kind, express or implied**, including no
warranty of merchantability, fitness for a particular purpose, accuracy, completeness or currency.
There is no guarantee that the slabs, rates, limits or rules encoded here are correct or current.

These are estimates from a personal engineering project. **This is not tax, legal or financial
advice**, and no professional or advisory relationship is created by using it. Your actual
liability depends on your full financial position, your employer's payroll policy, the
declarations you file and provisions this tool does not model.

Verify anything that matters with a qualified chartered accountant or tax adviser before you act
on it, and do not use these figures to negotiate, plan or file. To the fullest extent permitted by
law, no liability is accepted for any loss or damage arising from use of this tool or reliance on
its output. Use entirely at your own risk.
