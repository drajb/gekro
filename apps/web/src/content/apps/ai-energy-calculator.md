---
title: "AI Energy & Carbon Calculator"
category: "ai"
job: "Estimate the electricity, CO2, and water behind an LLM query - or a full training run - with relatable equivalences"
description: "How much energy does one LLM query actually use? What about a full training run? Pick a model, an accelerator, and a grid region and get a transparent, first-principles estimate of watt-hours, CO2, and water - plus relatable equivalences like EV miles, phone charges, and homes powered. Every coefficient is editable and dated; it all runs in your browser."
aiSummary: "A client-side AI energy and carbon estimator with two modes. Inference: energy per query = output_tokens/throughput × GPU_power × PUE, scaled to daily volume, converted to CO2 via grid carbon intensity and to water via WUE. Training: energy = (6·params·tokens / (peak_FLOPS·MFU)) GPU-hours × power × PUE, then CO2. Provides EV-mile, phone-charge, and household equivalences. Curated, editable coefficients (GPU power, throughput, grid gCO2/kWh, PUE) with a verified date."
personalUse: "The 'ChatGPT uses X of energy' claims flying around are almost always uncited and often off by orders of magnitude. As someone who runs a home cluster and drives an EV, I wanted a transparent calculator where every assumption - GPU wattage, throughput, grid mix, datacenter overhead - is visible and editable, so I can reason about the real footprint of what I build instead of repeating a viral number."
status: "active"
publishedAt: "2026-08-08"
lastVerified: "2026-08-08"
companionPostSlug: ""
license: "MIT"
icon: "⚡"
---

## What It Does

There are a lot of confident, uncited claims about how much energy AI uses. This tool replaces the hand-waving with a transparent calculation where you can see and change every assumption. Two modes:

- **Inference** - energy, CO2, and water for a single query and at daily volume. The math is simply the GPU's power draw times how long it spends generating your tokens (`output_tokens / throughput`), scaled up by datacenter overhead (PUE).
- **Training run** - the one-off cost of training a model, using the standard `6 × params × tokens` FLOP estimate divided by achievable GPU throughput to get GPU-hours, then energy and CO2.

Carbon comes from the grid's **carbon intensity** (gCO2/kWh), which varies enormously by region - the same query emits ten times more CO2 in India or China than in France or Norway. Water comes from a datacenter cooling coefficient.

## Relatable Equivalences

Raw watt-hours are hard to feel, so every result is also expressed as something concrete: **EV miles driven**, **phone charges**, **web searches**, and for training runs, **US homes powered for a year**. That's what makes the number land - and what makes it shareable.

## Everything Is Editable

The presets - GPU power draw, serving throughput, grid carbon intensity, PUE - are representative published figures with a verified date. None of them is hidden. Change any of them to match your setup and the whole calculation updates live.

Pairs naturally with the [Reasoning Cost Calculator](/apps/reasoning-cost-calculator/) (dollars instead of joules), the [Inference Latency Estimator](/apps/inference-latency-estimator/) (where the throughput number comes from), and the [EV Charging Cost Calculator](/apps/ev-charging-cost/) if the miles equivalence makes you curious.

## Limitations

- **Order of magnitude, not measurement.** It models GPU electricity only. It excludes networking and storage energy, the embodied carbon of manufacturing the hardware, idle capacity, and cooling beyond the PUE multiplier.
- **Throughput is the biggest lever and the least universal number** - it depends heavily on the model, batching, and serving stack. The default is representative; set it to your measured value for a real answer.
- **Grid intensity is an annual average.** Real marginal carbon shifts hour by hour with the generation mix.
