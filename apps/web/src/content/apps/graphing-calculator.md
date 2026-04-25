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

## What It Does

This is a four-mode calculator that runs entirely in the browser: basic arithmetic, scientific functions, 2D function graphing (up to six simultaneous equations), and 3D surface plotting with mouse-drag rotation. No dependencies, no server — the expression evaluator, canvas renderer, and 3D mesh are all hand-rolled TypeScript.

The 2D graphing mode is Desmos-like: type a function of `x`, see it plotted, pan and zoom with the mouse. The 3D mode takes functions of two variables (`z = f(x,y)`) and renders them as colored wireframe meshes — useful for visualizing optimization landscapes, wave functions, and any math that lives in three dimensions.

## How to Use It

**Basic / Scientific mode** — type an expression and press Enter or click Equals. The evaluator handles precedence, parentheses, and all standard functions. Scientific mode adds trig, inverse trig, logarithms, and factorials.

**2D graphing mode:**
1. Enter up to 6 equations in the form `y = f(x)`. The `y =` prefix is implied — just enter the right-hand side (e.g., `sin(x)`, `x^2 - 3`).
2. Scroll to zoom in/out. Click and drag to pan.
3. Use the range inputs to snap the viewport to specific x/y bounds.
4. Each equation gets a distinct color automatically.

**3D surface mode:**
1. Enter a function of two variables (e.g., `sin(sqrt(x^2 + y^2))`, `x^2 - y^2`).
2. Click and drag to rotate (azimuth + elevation). Scroll to zoom.
3. Use the resolution slider to adjust mesh density (6–36 divisions per axis). Higher resolution shows more detail but slows rendering on complex expressions.

## The Math / How It Works

**Expression evaluator** — all modes share a hand-written recursive descent parser. It handles operator precedence, nested parentheses, and function calls via `new Function()` in a sandboxed context with no network access.

**2D graphing** — each equation is sampled at 800 points across the visible x range. The sampler detects discontinuities (NaN returns, or function value jumps exceeding 2× the canvas height in graph units) and lifts the pen, avoiding false lines drawn across vertical asymptotes. This is why `1/x` doesn't show a vertical line at `x=0`.

**3D surface** — a quad mesh is generated at `n × n` grid points over the x/y range, where `n` is the resolution setting. Each quad is split into two triangles, z-colored using a blue–green–yellow–red heatmap gradient mapped to the normalized z range. Rendering uses the Painter's algorithm (back-to-front sort) for depth-correct occlusion — no WebGL required.

**Expression syntax** supported across all modes:

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
| `pi` `e` | Constants |

## Why Developers and Students Need This

Mathematical visualization is one of the most underused debugging techniques in software engineering. Before implementing a mathematical function — a smoothing curve, a decay schedule, a price model — plot it. See if the shape matches your intuition. Catch domain errors (negative inputs to square roots, division by zero) before they appear as NaN values in production.

**Use cases where 2D graphing saves debugging time:**
- Visualize a sigmoid activation function with different temperature parameters before choosing one
- Plot an exponential backoff curve (`base^attempt`) to verify it doesn't explode on high retry counts
- Check that a pricing formula stays monotonically increasing over the relevant input range
- Compare two candidate smoothing functions side by side (both plotted simultaneously)

**3D graphing is uniquely useful** for understanding optimization landscapes. Plotting a loss function `z = (x-2)^2 + (y-1)^2` shows the bowl shape that gradient descent navigates. `x^2 - y^2` (a saddle point) makes the saddle-point problem in non-convex optimization instantly visual. `sin(x)*cos(y)` shows why periodic functions have multiple local minima.

**Parametric thinking** — even without explicit parametric mode, you can plot related equations simultaneously. Plot `x^2`, `x^2 - 1`, `x^2 + 1` to visualize vertical translation. Plot `sin(x)` and `sin(2x)` to see frequency doubling. The six-equation limit is enough for most comparison tasks.

## Tips & Power Use

- **Trig functions use radians.** To use degrees, wrap your input: `sin(x * pi / 180)`. This is stated in the limitations but worth remembering — `sin(90)` returns -0.85, not 1.0.
- **3D resolution sweet spot is 18–24 divisions.** At 36, complex expressions may pause briefly. At 12, the mesh is too coarse for curved surfaces. Start at 20 and adjust.
- **For optimization landscape visualization**, set x and y ranges to your parameter search space and enter your loss/objective function directly. The heatmap coloring makes local minima (blue) and maxima (red) immediately visible.
- **Debugging asymptotes:** plot `1/(x-2)` to see how the discontinuity detection works. The graph correctly lifts the pen at `x=2` rather than drawing a spurious vertical line.
- **Use `abs(x)` to plot piecewise-linear functions:** `abs(x - 2) + abs(x + 1)` is a valid piecewise linear plot. Useful for visualizing L1 regularization terms.
- **The 3D mode renders synchronously on the main thread** — very complex expressions at high resolution will cause brief pauses. Keep expressions computationally simple for interactive rotation.

## Limitations

- All computation runs synchronously on the main thread. Very complex 3D expressions at high resolution (>30 divisions) may cause brief pauses.
- The expression evaluator uses `new Function()` — standard browser JavaScript sandbox. No network access is possible from within it.
- Trigonometric functions use **radians**, not degrees. Use `x * pi / 180` to convert degree input.
