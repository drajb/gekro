---
title: "EV Data Logger"
description: "Real-time telemetry extraction from Tesla Fleet API for green energy optimization."
summary: "Real-time telemetry extraction from Tesla Fleet API for green energy optimization. Connects vehicle telemetry to home energy storage for 100% solar charging."
aiSummary: "Developed a TypeScript listener for the Tesla Fleet API to sync EV charging cycles with solar production peaks. Reduced grid dependency for vehicle charging to near zero during peak summer months."
status: "active"
startDate: "2026-03-15"
stack:
  - "TypeScript"
  - "Astro"
  - "Tesla API"
topics:
  - "Green Tech"
  - "IoT"
githubUrl: "https://github.com/drajb/ev-logger"
difficulty: "Intermediate"
---

## What I Was Trying to Solve

Charging an electric vehicle is great, but charging it with coal power from the grid is a half-measure. I wanted my Tesla to only charge when my solar panels were producing an excess, or when the grid was at its cleanest/cheapest.

The problem? The official Tesla API is moving towards the **Fleet API**, which requires complex OAuth handshakes and signed commands.

---

## Architecture

I built a lightweight middleware in TypeScript that polls the vehicle state and pushes it to an InfluxDB instance for visualization. 

```
[Tesla Model 3] → [Fleet API] → [TS Logger] → [Grafana Dashboard]
```

---

## What I Learned

1. **API Sovereignty** — Owning your data means you aren't beholden to a single app UI. I can now trigger "Defrost" mode based on my own weather station data, not just a schedule.
2. **Telemetry is Noisy** — You need to filter out GPS drift and battery sag to get clean energy metrics.
3. **The Power of Open Standards** — By exporting this data to a standard dashboard, I can compare my actual vehicle efficiency against the manufacturer's claims in real-time.
