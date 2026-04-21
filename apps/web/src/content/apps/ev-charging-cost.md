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

## How this works

Most EV calculators online give you a single number (`kWh × rate`) and ignore three things that dominate real cost:

1. **Solar offset** — if some of the session's energy came from your own panels, that portion is effectively free (after panels are paid off; ignore solar amortization for a true marginal-cost view)
2. **Charger efficiency loss** — AC home chargers waste ~10-15% as heat; DC fast chargers waste ~5%. The kWh you pay for is more than the kWh that ends up in the battery
3. **Time-of-use rates** — same utility, same wire, but charging at 2 AM vs 6 PM can be 3× different

This tool models all three.

### Cost per session
```
total_cost = (kWh_from_grid × rate) + (kWh_from_solar × 0)
where kWh_from_grid = session_kWh / charger_efficiency × (1 - solar_offset_fraction)
```

### Cost per mile
```
cost_per_mile = total_cost / (session_kWh × vehicle_efficiency_mi_per_kWh)
```

### Gas equivalent
The breakeven gas price: at what pump price would an ICE doing this trip cost the same?
```
gas_breakeven = total_cost / (trip_miles / ice_mpg)
```

## Default vehicle profiles

| Vehicle | kWh/mile | Source |
|---|---|---|
| Tesla Model Y RWD | 0.245 | EPA combined cycle |
| Tesla Model 3 LR | 0.236 | EPA |
| Tesla Model S Plaid | 0.305 | EPA |
| Ford Mustang Mach-E | 0.32 | EPA |
| Hyundai Ioniq 5 | 0.30 | EPA |
| Rivian R1T | 0.50 | EPA |
| Polestar 2 | 0.31 | EPA |
| Custom… | user-set | — |

## Default charging contexts

| Context | Typical rate | Charger efficiency |
|---|---|---|
| Home (off-peak) | $0.08–0.14/kWh | 88% (AC, 240V L2) |
| Home (peak) | $0.20–0.40/kWh | 88% |
| Tesla Supercharger | $0.30–0.50/kWh | 95% (DC fast) |
| EVgo / Electrify America | $0.40–0.60/kWh | 95% (DC fast) |
| Public L2 (paid) | $0.20–0.30/kWh | 88% |
| Workplace (free) | $0.00 | 88% |

Defaults are starting points — set your actual rate in the input field.

## Why I built this

Living with a Tesla Model Y on a solar-equipped house, I needed to know my real per-mile cost — not the marketing brochure number, not the "average US EV cost" articles, but my actual blended rate accounting for the fact that my charging mix is ~75% solar/off-peak home and ~25% Supercharger on road trips.

This is also the answer to "should I rent an ICE for this trip?" — at gasoline equivalent of $1.20/gal blended, the answer is almost always no, but for pure-Supercharger trips it can flip.

## Limitations

- **Solar amortization not included** — assumes solar capex is sunk. The marginal cost of solar-derived kWh is ~$0
- **No degradation cost** — battery wear-and-tear from DC fast charging vs slow AC is real but small (~$0.01/mile difference per peer-reviewed studies). Ignored
- **No demand charges** — commercial-rate users with demand charges should add those separately
- **Vehicle efficiency is EPA combined** — real-world varies ±20% with weather, speed, terrain, payload
