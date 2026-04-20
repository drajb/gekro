---
title: "Graphing Calculator"
description: "A full-featured graphing calculator with basic, scientific, 2D function graphing, and 3D surface plotting. Pan, zoom, and rotate entirely in the browser."
job: "Basic · Scientific · 2D graph · 3D surface — all modes, zero deps"
icon: "📐"
category: "dev"
status: "active"
publishedAt: "2026-04-19"
lastVerified: "2026-04-19"
license: "MIT"
aiSummary: "Four-mode graphing calculator running entirely in the browser. Basic mode handles standard arithmetic. Scientific mode adds trig, logarithms, factorials, and inverse functions. 2D graphing mode plots up to six simultaneous y=f(x) equations on a pannable/zoomable canvas. 3D surface mode renders z=f(x,y) as a colored wireframe mesh with mouse-drag rotation."
personalUse: "I kept opening Desmos for quick plots but wanted something that also did 3D surfaces without installing anything — so I built it into the toolbox."
companionPostSlug: ""
---

## How the calculator works

### Expression syntax

All four modes share the same expression evaluator. Supported syntax:

| Symbol | Meaning |
|--------|---------|
| `+` `-` `*` `/` | Basic arithmetic |
| `^` | Exponentiation (e.g. `x^2`) |
| `sin(x)` `cos(x)` `tan(x)` | Trigonometric (radians) |
| `asin(x)` `acos(x)` `atan(x)` | Inverse trig |
| `log(x)` | Base-10 logarithm |
| `ln(x)` | Natural logarithm |
| `sqrt(x)` | Square root |
| `abs(x)` | Absolute value |
| `exp(x)` | e^x |
| `pow(x,n)` | x raised to n |
| `floor(x)` `ceil(x)` `round(x)` | Rounding |
| `pi` `e` | Constants (π ≈ 3.14159, e ≈ 2.71828) |
| `min(a,b)` `max(a,b)` | Min/max |

### 2D graphing

Plots `y = f(x)` for up to 6 simultaneous equations. Scroll to zoom, drag to pan. The x and y range inputs snap the viewport.

Each equation is sampled at 800 points across the visible x range. Discontinuities (where the function returns NaN or jumps more than 2× the canvas height in graph units) are automatically lifted to avoid false lines across asymptotes.

### 3D surface plotting

Renders `z = f(x, y)` as a shaded wireframe quad mesh. Painter's algorithm depth sorting ensures correct occlusion. The mesh is colored by z-height using a blue–green–yellow–red heat-map gradient.

Drag to rotate (azimuth + elevation). Scroll to zoom. Resolution slider controls the grid density (6–36 divisions per axis).

### Limitations

- All computation runs synchronously on the main thread. Very complex 3D expressions at high resolution (>30 divisions) may cause brief pauses.
- The expression evaluator uses `new Function()` — standard browser JavaScript sandbox. No network access is possible from within it.
- Trigonometric functions use **radians**, not degrees. Use `x * pi / 180` to convert degree input.
