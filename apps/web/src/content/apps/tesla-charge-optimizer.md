---
title: "Tesla Charge Optimizer"
category: "ev"
job: "Time-of-use rate schedule + battery + departure → cheapest contiguous charging window."
description: "Free browser-based EV charging optimizer. Set your utility's hourly rate schedule (24-hour grid), your vehicle (Tesla Model 3/Y/S/X, Cybertruck, Lightning, Rivian, Ioniq 5, Mach-E, Leaf, custom), current SoC and target SoC, plug-in and departure times - tool finds the cheapest contiguous charge window inside that envelope. Compares against the naive 'charge immediately' baseline and shows the dollar savings. Outputs a copy-pasteable schedule in Tesla / Home Assistant / EVCC format."
aiSummary: "Client-side time-of-use EV charging optimizer. Accepts: vehicle battery (kWh, usable), on-board charger rate (kW), charge efficiency (default 90%), current and target SoC, plug-in time, departure time (auto-wraps to next day), and a 24-element hourly rate array. Iterates start times in 5-minute increments, computes per-hour-segment cost summing rate × kw × duration, picks the cheapest contiguous window of length kWh-needed / kW. Compares against the immediate-charge baseline to show savings. Five rate-preset patterns shipped (PG&E EV2-A, SCE TOU-D-PRIME, ERCOT flat, TX free-nights, solar-export). Handles partial-charge scenarios when the window is too short."
personalUse: "I built this because my Tesla's scheduled-charge UI doesn't know my utility's TOU rates. Now I look at this once when my TOU plan changes and update the schedule once."
status: "active"
publishedAt: "2026-05-13"
icon: "🔌"
license: "MIT"
---

## What It Does

Most EVs let you schedule charging start time but DON'T know your utility's time-of-use rates. This tool bridges that gap:

1. Pick your vehicle (or set custom battery + charger rate)
2. Set current SoC + target SoC
3. Pick plug-in time + departure time
4. Set hourly rates (preset or custom — click any hour to edit)

You get: the cheapest contiguous charging window, dollar savings vs charging immediately, and a copy-pasteable schedule for Tesla / Home Assistant / EVCC / OpenEVSE.

## Rate Presets Included

- **PG&E EV2-A** — California, common Tesla owner default. ~$0.31 off-peak / $0.61 peak (4-9pm)
- **SCE TOU-D-PRIME** — Southern California. ~$0.26 super-off-peak / $0.54 peak (4-9pm)
- **ERCOT flat** — Texas reference flat rate ~$0.13/kWh
- **TXU Free Nights** — Texas plan with free charging 8pm-6am
- **Solar self-consumption** — Cheap midday from rooftop solar, expensive overnight

Click "Custom" and edit any hour to match your specific plan.

## Algorithm

For a needed energy E = battery × (target - current) / 100 / efficiency, charging duration is D = E / charge_rate kW. We sweep start times from plug-in to (depart - D) in 5-minute increments. For each candidate start, sum the cost across hour-block boundaries:

```
for hour-segment from start to start+D:
  segment_cost = rate[floor(hour) % 24] × charge_rate × segment_duration
total_cost = sum(segment_costs)
```

Pick the start time with lowest total_cost. O(N) in number of 5-minute slots — fast enough to recompute on every input change.

## Limitations

- **Assumes constant kW charging** — real EVs taper above ~80% SoC. Above 80% target, expect 5-15 more minutes than the calculator estimates.
- **No demand charges** — commercial / industrial TOU plans sometimes also charge for peak kW pulled. Not modelled.
- **Tesla supercharger pricing** is location-dependent and not in scope — this is for home charging.
- **5-minute resolution** — most utilities bill at the hour, so this is fine.

## Related Tools

- [EV Charging Cost Calculator](/apps/ev-charging-cost/) - simpler flat-rate cost-per-mile
- [Tesla Trip Calculator](/apps/tesla-trip-calculator/) - route + charge planning
