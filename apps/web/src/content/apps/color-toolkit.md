---
title: "Color Toolkit"
category: "dev"
job: "Extract dominant colors from images and convert between HEX, RGB, HSL, and CMYK"
description: "Two tools in one: drag and drop any image to extract the top 5 dominant colors using Canvas API pixel sampling, or use the bidirectional converter to translate colors between HEX, RGB, HSL, and CMYK in real time. Zero dependencies, fully client-side."
aiSummary: "Client-side color tool with two modes: image-based dominant color extraction via Canvas API pixel sampling with median-cut quantization, and a four-way bidirectional color converter (HEX, RGB, HSL, CMYK). No network requests, no libraries."
personalUse: "I extract brand colors from logos and design mockups, then paste the HEX values into my Tailwind config. The converter lets me sanity-check between design tool color formats without opening a separate app."
status: "active"
publishedAt: "2026-04-20"
icon: "🎨"
license: "MIT"
---

## What It Does

Color Toolkit is two utilities in one tab. The **extractor** drops an image onto a canvas and surfaces the five dominant colors as HEX swatches with click-to-copy. The **converter** is a live four-way translator between HEX, RGB, HSL, and CMYK — edit any field and all others update instantly. No server, no dependencies, no upload.

## How to Use It

**Color Extractor**
1. Drag an image onto the drop zone (PNG, JPG, WebP, SVG).
2. The tool samples the pixels and surfaces 5 dominant color swatches.
3. Click any swatch to copy the HEX value.

**Color Converter**
1. Type or paste a value into any of the four format fields.
2. All other fields update immediately.
3. Click any field to copy its value.

## The Math / How It Works

**Extractor:** The image is drawn onto an off-screen `<canvas>`. Every Nth pixel is sampled (N scales with image size to keep it fast — a 4 MP photo samples roughly 1 in 40 pixels). The sampled RGB triplets are then quantized using a simplified **median-cut algorithm**: the sample space is iteratively bisected along its longest color axis until you have 5 buckets. The centroid of each bucket becomes a representative color. This produces perceptually distinct dominant colors, not just the most frequent raw pixel values.

**Converter:** All formats convert through RGB as the canonical intermediate:

- `HEX → RGB`: parse 6-digit hex, divide each channel by 255
- `RGB → HSL`: compute lightness as `(max + min) / 2`, saturation based on the delta, hue from which channel is max
- `HSL → RGB`: reverse the hue-sector formula, scale back to 0–255
- `RGB → CMYK`: `K = 1 - max(R,G,B)`, then `C = (1-R-K)/(1-K)`, etc.

CMYK conversion is device-independent — no ICC profile. For print workflows, use professional software.

## Why Developers Need This (deep dive)

Color formats exist for different audiences and use cases, and you constantly need to translate between them.

**HEX** is the lingua franca of the web. Every HTML color attribute, every CSS value, every Tailwind config expects hex. It's compact and unambiguous, but completely unintuitive for humans — `#1a2b3c` tells you nothing about whether that's a dark blue or a dark green until you render it.

**RGB** is the hardware model. Screens mix red, green, and blue light. When you're doing arithmetic on colors in code — blending, darken/lighten transforms, generating palettes — you need RGB. JavaScript canvas operations work in RGB. WebGL shaders work in RGB.

**HSL** (Hue, Saturation, Lightness) is the designer's model. It separates the *color identity* (hue: 0–360°) from *how vivid it is* (saturation) and *how light or dark* (lightness). This makes it possible to say "make this color 20% lighter" by just incrementing the L value. Tailwind v4 generates its palette in HSL internally for exactly this reason. When you're building a design system with systematic color relationships, HSL is the format to work in.

**CMYK** is the print model. Screens add light (additive color). Printers subtract light by mixing ink (subtractive). The same hex value looks different on screen vs. on paper. CMYK conversion here is a reference, not a print specification.

For a real-world workflow: extract brand colors from a logo using the extractor, convert to HSL to generate tint/shade variations, paste the hex values into your Tailwind `theme.extend.colors` block. For Tailwind v4 which uses CSS custom properties (`--color-brand-500`), HSL is directly usable in `@theme` blocks.

## Tips & Power Use

- **Extract from screenshots, not just logos.** If a competitor's UI has a color palette you want to analyze, screenshot it and drop it in. The extractor surfaces the dominant UI colors.
- **Use HSL for building palettes.** Pick a base hue, then generate 5 tints by incrementing L from 20% to 80% in 15% steps. HSL makes this arithmetic obvious.
- **Accessibility quick-check.** After extracting foreground and background colors, check their contrast ratio using a WCAG contrast tool. The [WCAG AA minimum](https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum) is 4.5:1 for normal text, 3:1 for large text.
- **Pair with the [Gradient Generator](/apps/gradient-generator/)** — extract dominant colors from a reference image, then use those HEX values as gradient stops in the mesh generator.

## Limitations

- **Large images** — images over ~10 MB are rejected to prevent browser freezing. The canvas sampling is fast for typical photos (< 5 MP).
- **CMYK** — the conversion is mathematical and does not use ICC color profiles. For print workflows, use professional software.
- **Alpha channel** — transparent pixels are skipped during extraction. Partially transparent images may produce unexpected results.
- **Median-cut approximation** — for photos with subtle color variation (e.g., all blues), the 5 extracted colors may feel redundant. This is a quantization limit, not a bug.
