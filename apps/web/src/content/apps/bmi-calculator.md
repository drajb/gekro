---
title: "BMI & Health Metrics"
description: "Calculate BMI, BMR, TDEE, ideal weight range, and body fat category. Supports lbs/ft or kg/cm. Results include a visual gauge and evidence-based ranges."
job: "BMI · BMR · TDEE · ideal weight — lbs or kg, ft/in or cm"
icon: "⚕️"
category: "health"
status: "active"
publishedAt: "2026-04-19"
lastVerified: "2026-04-19"
license: "MIT"
aiSummary: "Calculates Body Mass Index (BMI), Basal Metabolic Rate (BMR via Mifflin-St Jeor), Total Daily Energy Expenditure (TDEE), and healthy weight range. Supports imperial (lbs, ft/in) and metric (kg, cm) inputs. Results include a color-coded BMI gauge and five activity level TDEE estimates."
personalUse: "I track weight and calorie targets periodically and wanted one tool that gives me all the derived numbers at once without ads or upsells."
companionPostSlug: ""
---

## What It Does

This tool calculates four health metrics from your height, weight, age, sex, and activity level: BMI (Body Mass Index), BMR (Basal Metabolic Rate — calories burned at rest), TDEE (Total Daily Energy Expenditure — calories burned at your activity level), and your healthy weight range. Results include a visual BMI gauge and a five-level TDEE breakdown.

It supports both imperial (lbs, ft/in) and metric (kg, cm) inputs, requires no account, and contains no ads or upsells. The formulas are the same ones used by registered dietitians — the Mifflin-St Jeor equation for BMR, the standard Harris-Benedict activity multipliers for TDEE.

## How to Use It

1. Select your unit system: **Imperial** (lbs, ft, in) or **Metric** (kg, cm).
2. Enter your **weight**, **height**, **age**, and **biological sex**.
3. Select your **activity level** from the five-option scale (sedentary to extremely active).
4. Results appear immediately: BMI with category, BMR, TDEE at your activity level, and healthy weight range for your height.
5. The TDEE breakdown shows all five activity multiplier values so you can see the range.

The healthy weight range is not a prescription — it's the weight span at the BMI normal band (18.5–24.9) for your height.

## The Math / How It Works

**BMI formula:**
```
BMI = weight(kg) / height(m)²
```

**WHO BMI categories:** Underweight < 18.5 · Normal 18.5–24.9 · Overweight 25–29.9 · Obese ≥ 30.

**BMR — Mifflin-St Jeor equation (1990):**
```
Male:   BMR = 10 × weight(kg) + 6.25 × height(cm) − 5 × age + 5
Female: BMR = 10 × weight(kg) + 6.25 × height(cm) − 5 × age − 161
```

Mifflin-St Jeor is the formula recommended by the Academy of Nutrition and Dietetics as most accurate for the general population. The older Harris-Benedict equation (1919) overestimates by 5% on average; Mifflin-St Jeor corrects for this.

**TDEE activity multipliers:**

| Activity level | Multiplier |
|---------------|-----------|
| Sedentary (desk job, little exercise) | 1.2 |
| Lightly active (1–3 days/week) | 1.375 |
| Moderately active (3–5 days/week) | 1.55 |
| Very active (6–7 days/week) | 1.725 |
| Extremely active (physical job + exercise) | 1.9 |

## Why BMI Measures What It Measures — And What It Misses

BMI was developed in the 1830s by Belgian mathematician Adolphe Quetelet as a population-level statistical tool for describing the "average man." It was never designed as a diagnostic tool for individuals, and its widespread use in clinical settings is a category error that persists for historical and convenience reasons.

**What BMI doesn't measure:** body fat percentage. A 200 lb person at 6'0" with 15% body fat and significant muscle mass has the same BMI as a 200 lb person at 6'0" with 28% body fat and minimal muscle. One is at peak athletic fitness; the other is at elevated cardiovascular risk. BMI can't tell them apart. This is why elite athletes regularly score in the "overweight" or "obese" BMI range.

**Ethnicity affects BMI interpretation.** Asian populations have significantly higher metabolic risk at lower BMIs than European populations. WHO recommends lower cutoff points for Asian populations: overweight at 23 (vs 25), obese at 27.5 (vs 30). Some health systems have adopted these adjusted thresholds; the standard WHO categories used in this tool have not.

**Why doctors still use it:** BMI is cheap, quick, and population-level correlations with health outcomes are real, even if individual prediction is weak. For large-scale public health tracking, BMI is useful. For individual clinical decisions, it's one input among many.

**Better alternatives for individuals:**
- **Waist-to-height ratio** (waist circumference ÷ height, both in same units) — should be below 0.5 regardless of sex or ethnicity. More predictive of cardiovascular risk than BMI.
- **Body fat percentage** (via DEXA scan, hydrostatic weighing, or impedance) — directly measures what BMI estimates.
- **Waist-to-hip ratio** — useful for abdominal fat assessment, which is the metabolically active fat linked to insulin resistance.

Use this tool's BMI result as a rough orientation, not a health verdict. The TDEE is the more actionable number — it tells you your calorie maintenance level, which is the starting point for any intentional weight change.

## Tips & Power Use

- **TDEE is your maintenance calories.** To lose weight slowly and sustainably, subtract 300–500 calories from your TDEE. To gain muscle, add 250–500 calories. Larger deficits or surpluses work faster but are harder to sustain and increase muscle loss (in deficit) or fat gain (in surplus).
- **BMR is your floor, not your target.** Eating below BMR consistently suppresses metabolic rate over time. For most people, eating below 1,200–1,500 calories (depending on size) puts them below BMR, which is medically inadvisable without clinical supervision.
- **Activity multiplier selection matters more than most people think.** "Moderately active (3–5 days/week)" assumes deliberate exercise — not just walking around. If you're sedentary at a desk job but exercise 4 times/week, "lightly active" is probably more accurate. Overestimating activity level is the most common reason TDEE-based calorie targets don't produce expected results.
- **Re-run after significant weight changes.** BMR changes with weight — a 20 lb weight loss typically reduces BMR by 100–150 calories/day. Your calorie target needs to adjust as your weight changes.
- **Waist-to-height ratio check:** measure your waist at the narrowest point (usually just above the navel). Divide by your height in the same unit. Below 0.5 is the general target, regardless of what your BMI says.

## Limitations and medical disclaimer

**These calculations are for informational purposes only.** They are not a substitute for advice from a qualified healthcare provider. BMI has well-documented limitations, particularly for athletes, children, the elderly, and people of different ethnicities. Calorie targets are estimates — individual metabolism varies. Consult a physician or registered dietitian before making significant dietary or lifestyle changes.
