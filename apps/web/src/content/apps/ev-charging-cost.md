---
title: "EV Charging Cost Calculator"
category: "ev"
job: "True cost per session and per mile for any EV — accounts for time-of-use rates, solar offset, and DC fast-charging premium"
description: "Pick your EV (or set custom kWh), charging context (home off-peak / home peak / DC fast / public L2), electricity rate, and how much of the session was offset by your own solar production. Get cost per session, cost per mile, and breakeven against gasoline at any pump price."
aiSummary: "A client-side EV charging cost calculator with solar offset and time-of-use rate modeling. Supports home charging (off-peak, peak), DC fast charging at supercharger-like rates, and public L2. Accounts for solar production credit, charger efficiency loss (typical 10% for AC, 5% for DC fast), and computes cost per kWh, cost per session, cost per mile, and gasoline-equivalent breakeven for direct comparison against ICE."
personalUse: "I charge my Model Y mostly at home from solar but use Superchargers on long trips. The blended cost per mile is hard to intuit because home solar is effectively free while Supercharging is 2-4× home rates. This gives me the actual number I should use when comparing against renting an ICE for a trip."
status: "active"
publishedAt: "2026-04-20"
lastVerified: "2026-04-20"
companionPostSlug: ""
license: "MIT"
icon: "🔌"
---

## What It Does

EV Charging Cost Calculator computes the true cost of an EV charging session — not the simplified `kWh × rate` figure, but the actual cost accounting for solar offset, charger efficiency loss, and time-of-use rate variation. It outputs cost per session, cost per mile, and a gasoline-equivalent breakeven price for direct comparison against ICE vehicles.

## How to Use It

1. Select your **EV** from the preset list or set a custom kWh capacity and efficiency.
2. Choose the **charging context**: home off-peak, home peak, DC fast (Supercharger), public L2, or workplace free.
3. Enter your actual **electricity rate** in $/kWh (check your utility bill — the default is a US average).
4. If you have solar, set the **solar offset percentage** — what fraction of this session's energy came from your panels.
5. Read the cost per session, cost per mile, and gasoline breakeven price.

**Default vehicle profiles**

| Vehicle | kWh/mile | Source |
|---|---|---|
| Tesla Model Y RWD | 0.245 | EPA combined |
| Tesla Model 3 LR | 0.236 | EPA |
| Tesla Model S Plaid | 0.305 | EPA |
| Ford Mustang Mach-E | 0.32 | EPA |
| Hyundai Ioniq 5 | 0.30 | EPA |
| Rivian R1T | 0.50 | EPA |
| Polestar 2 | 0.31 | EPA |

## The Math / How It Works

### Cost per session
```
kWh_from_grid = session_kWh / charger_efficiency × (1 − solar_offset_fraction)
total_cost = kWh_from_grid × electricity_rate
```

### Cost per mile
```
cost_per_mile = total_cost / (session_kWh × vehicle_efficiency_mi_per_kWh)
```

### Gasoline breakeven
At what pump price does an ICE doing the same trip cost the same?
```
gas_breakeven = total_cost / (trip_miles / ice_mpg)
```

**Default charging contexts**

| Context | Typical rate | Charger efficiency |
|---|---|---|
| Home (off-peak) | $0.08–0.14/kWh | 88% (AC, 240V L2) |
| Home (peak) | $0.20–0.40/kWh | 88% |
| Tesla Supercharger | $0.30–0.50/kWh | 95% (DC fast) |
| EVgo / Electrify America | $0.40–0.60/kWh | 95% (DC fast) |
| Public L2 (paid) | $0.20–0.30/kWh | 88% |
| Workplace (free) | $0.00 | 88% |

## The Three Factors Most Calculators Miss

### 1. Solar offset

A solar-equipped home changes EV economics significantly. If your panels generate excess power during the day and you charge directly from that excess (via a timed charge schedule), the marginal cost of the solar-sourced kWh is effectively $0 after the panels' upfront cost is sunk. This tool treats solar-sourced kWh as free for marginal cost purposes — a valid assumption once panels are paid off (typically 6–8 years).

The real-world impact: a Model Y that costs $0.048/mile on pure solar home charging costs $0.12–0.18/mile on Supercharger-only charging. If 75% of your charging is solar home and 25% is Supercharger, your blended rate is roughly $0.06/mile — still far below the $0.15–0.18/mile typical of a 30 MPG gasoline car at $4.50/gallon.

### 2. Charger efficiency loss

AC home chargers (Level 2) are not 100% efficient. About 10–15% of the electricity you pull from the grid is lost as heat in the onboard charger and wiring. You pay for 1 kWh at the meter, but only 0.88 kWh enters the battery. DC fast chargers are more efficient (~95%) because they bypass the onboard AC→DC converter.

This means the cost calculation isn't `kWh_to_battery × rate`. It's `kWh_from_grid × rate`, and `kWh_from_grid = kWh_to_battery / charger_efficiency`. Ignoring this understates your cost by ~12% for home charging.

### 3. Time-of-use (TOU) rates

Many utilities offer TOU pricing: cheaper electricity during off-peak hours (midnight–6 AM) and more expensive electricity during peak demand (4–9 PM). The ratio can be 3:1 or more. A Model Y charged entirely during off-peak at $0.09/kWh costs $0.022/mile. The same car charged during peak at $0.30/kWh costs $0.073/mile — 3.3× more expensive, same car, same electricity, different time.

Setting up timed charging (Tesla's "Schedule Charging" feature, or a smart outlet timer) to avoid peak hours is one of the highest-ROI optimizations for EV ownership. The TOU rate on your utility bill determines whether this optimization matters for you.

## Real-World Cost Examples

**Model Y, home charging, $0.12/kWh off-peak, 50% solar:**
- 50 kWh session
- Solar covers 25 kWh, grid provides 25 kWh
- Grid cost: 25 kWh / 0.88 efficiency × $0.12 = $3.41
- Cost per mile (0.245 kWh/mile): $0.068/mile
- Gas equivalent: breakeven at $2.04/gallon for a 30 MPG car

**Model Y, Tesla Supercharger, $0.38/kWh:**
- 50 kWh session, DC fast (95% efficient)
- Grid cost: 50 / 0.95 × $0.38 = $20.00
- Cost per mile: $0.163/mile
- Gas equivalent: breakeven at $4.89/gallon for a 30 MPG car

The gap between these two scenarios is why "how much does it cost to charge an EV?" is not a meaningful question without the context of where you charge.

## How Solar Changes EV Economics Entirely

Solar + EV is a system, not two separate products. The math for a solar-equipped household is different in kind from a grid-only EV owner:

1. **Marginal cost of solar kWh is ~$0** (after panel amortization). Every mile driven on solar power is essentially free fuel.
2. **Net metering** — if your utility offers net metering, excess solar generation earns credits. Those credits offset peak-rate charging. The effective cost of EV charging can go negative in high-generation months.
3. **Solar self-consumption** — charging during the day from excess solar (if your schedule permits) avoids both the grid rate and the export-reimport cycle. Direct solar consumption is more economically efficient than exporting and re-importing.
4. **Total cost of ownership** — when a single solar installation powers both the home and the EV, the per-mile fuel cost drops to near-zero. The question shifts from "what's the electricity cost?" to "what's the amortized cost of the solar system?"

This calculator handles the marginal-cost view (solar kWh is free). For a full TCO analysis including panel amortization, installation cost, and battery storage ROI, you'd need a longer-horizon model.

## Tips & Power Use

- **Use your actual electricity rate.** The number on your utility bill under "energy charge" is the rate. Ignore the "effective rate" that includes fixed fees — those are sunk regardless of how much you charge.
- **Check your TOU schedule.** If your utility offers TOU pricing, calculate cost at both off-peak and peak rates. The difference often justifies setting up timed charging.
- **The gas breakeven price** is the most useful metric for the "is EV cheaper?" question. If your current gas price is above the breakeven, the EV is cheaper per mile. Simple.
- **Set batch size for road trips.** If a 300-mile trip requires 2 Supercharger stops at 40 kWh each, calculate each session separately and sum the costs for the full-trip view.

## Limitations

- **Solar amortization not included** — assumes solar capex is sunk. The marginal cost of solar-derived kWh is modeled as $0.
- **No degradation cost** — battery wear from DC fast charging is real but small (~$0.01/mile differential). Not modeled.
- **No demand charges** — commercial-rate users with demand charges should add those separately.
- **Vehicle efficiency is EPA combined** — real-world varies ±20% with weather (cold reduces range ~20–30%), speed (highway efficiency is lower than city for EVs), and payload.
- **Supercharger pricing varies** — Tesla's pricing varies by location, time, and membership tier. Use the tool with your local observed rate.
