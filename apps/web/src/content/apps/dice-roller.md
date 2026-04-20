---
title: "Dice Roller"
job: "Roll up to 4 dice at once with 3D animation and roll history"
description: "A 3D dice roller supporting 1–4 standard six-sided dice. Each die animates in true 3D with correct pip faces, crypto-random rolls, running history, and session stats."
icon: "🎲"
category: "fun"
status: "active"
publishedAt: "2026-04-20"
lastVerified: "2026-04-20"
license: "free"
personalUse: "Used for tabletop game sessions and probability experiments."
tags: ["dice", "random", "game", "probability", "3d"]
aiSummary: "Browser-based 3D dice roller with 1–4 dice, pip-accurate SVG faces, crypto-random values, roll history, and session statistics. No login, no server."
---

## How it works

Each die uses CSS `transform-style: preserve-3d` to render a true six-face cube. Pips are laid out on a 3×3 grid per standard die convention. The front face always shows the rolled value; the remaining faces are arranged following standard die adjacency (opposite faces sum to 7).

## Randomness

Values are generated with `crypto.getRandomValues()` — the same cryptographic RNG used in security-sensitive contexts — giving uniform 1–6 distribution with no modulo bias corrections needed at this scale.

## Stats

The session tracks total rolls, running average total, and the best (highest) total rolled. History shows up to the last 40 rolls with individual die values and sum.
