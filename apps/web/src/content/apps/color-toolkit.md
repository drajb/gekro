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

## How this works

**Color extractor**

The image is drawn onto an off-screen `<canvas>` element. Every Nth pixel is sampled (N is adaptive based on image size to keep it fast). The sampled RGB values are quantized into 5 buckets using a simplified median-cut algorithm, producing 5 representative colors.

The algorithm is approximate — it produces perceptually distinct dominant colors, not necessarily the exact most-frequent pixels. For flat-color illustrations and logos, results are precise; for photographs with continuous gradients, results represent the dominant hue ranges.

**Color converter**

| Format | Example |
|--------|---------|
| HEX | `#1a2b3c` |
| RGB | `rgb(26, 43, 60)` |
| HSL | `hsl(210, 40%, 17%)` |
| CMYK | `cmyk(57%, 28%, 0%, 76%)` |

Edit any field and all others update instantly. The conversion chain is: all inputs convert through RGB as the canonical intermediate format.

**CMYK note** — CMYK is a subtractive model used in print. The formula used here is the device-independent conversion (no color profile). Actual printed colors depend on ink and paper; use this as a reference point, not a print specification.

## Limitations

- **Large images** — images over ~10 MB are rejected to prevent browser freezing. The canvas sampling is fast for typical photos (< 5 MP).
- **CMYK** — the conversion is mathematical and does not use ICC color profiles. For print workflows, use professional software.
- **Alpha channel** — transparent pixels are skipped during extraction. Partially transparent images may produce unexpected results.
