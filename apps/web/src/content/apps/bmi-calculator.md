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

## Formulas used

### BMI

```
BMI = weight(kg) / height(m)²
```

WHO categories: Underweight < 18.5 · Normal 18.5–24.9 · Overweight 25–29.9 · Obese ≥ 30.

BMI is a population-level screening tool. It does not distinguish muscle from fat and is less accurate for athletes, the elderly, and individuals with high muscle mass.

### BMR — Mifflin-St Jeor equation (1990)

Most accurate for the general population according to the Academy of Nutrition and Dietetics.

```
Male:   BMR = 10 × weight(kg) + 6.25 × height(cm) − 5 × age + 5
Female: BMR = 10 × weight(kg) + 6.25 × height(cm) − 5 × age − 161
```

### TDEE — Total Daily Energy Expenditure

```
TDEE = BMR × activity multiplier
```

| Activity level | Multiplier |
|---------------|-----------|
| Sedentary (desk job, little exercise) | 1.2 |
| Lightly active (1–3 days/week) | 1.375 |
| Moderately active (3–5 days/week) | 1.55 |
| Very active (6–7 days/week) | 1.725 |
| Extremely active (physical job + exercise) | 1.9 |

### Ideal weight range

Calculated as the weight span at the BMI normal range (18.5–24.9) for your entered height.

### Limitations and medical disclaimer

**These calculations are for informational purposes only.** They are not a substitute for advice from a qualified healthcare provider. BMI has well-documented limitations, particularly for athletes, children, the elderly, and people of different ethnicities. Calorie targets are estimates — individual metabolism varies. Consult a physician or registered dietitian before making significant dietary or lifestyle changes.
