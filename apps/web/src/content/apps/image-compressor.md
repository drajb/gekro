---
title: "Image Compressor"
category: "dev"
job: "Compress JPEG, PNG, and WebP images client-side with target size and dimension controls"
description: "Drop images or click to upload — each file is compressed in the browser using browser-image-compression. Set a target file size, maximum dimension, and output format. A hard 10 MB limit prevents browser overload. Before/after size comparison and direct download. Nothing is uploaded to any server."
aiSummary: "Client-side image compression using the browser-image-compression library. Supports JPEG, PNG, WebP, and HEIC (Safari only). Hard 10 MB file limit enforced before processing. Shows before/after size with percentage savings and provides direct download of compressed output."
personalUse: "I compress screenshots and blog post images here before uploading to Sanity. Dropping from 2 MB to 200 KB without visible quality loss saves CDN bandwidth and improves page load times."
status: "active"
publishedAt: "2026-04-20"
icon: "🗜️"
license: "MIT"
---

## What It Does

The Image Compressor reduces file sizes for JPEG, PNG, and WebP images entirely in the browser. Drop an image, set a target size in KB and a maximum dimension, choose the output format, and download the compressed result. Before/after size comparison shows exactly how much was saved. Nothing is uploaded to a server.

It's for developers compressing assets before deploying to a CDN, bloggers optimizing images before uploading to a CMS, and anyone who needs a fast, local compression workflow without installing software or using a web service that receives your files.

## How to Use It

1. **Drop an image** onto the upload area or click to browse. JPEG, PNG, WebP are supported. HEIC works on Safari only.
2. Set your **target size** in KB — the compressor aims for this but may not hit it exactly for already-compressed images.
3. Set the **maximum dimension** — width and height are both capped proportionally at this value.
4. Select **output format**: JPEG (photos, smallest), PNG (graphics, lossless), WebP (best compression ratio).
5. The compressed file processes immediately. Before/after sizes appear with a percentage savings.
6. Click **Download** to save the result.
7. The **10 MB hard limit** on input files is enforced before processing — files above this are rejected immediately.

## The Math / How It Works

Processing uses [browser-image-compression](https://github.com/Donaldcwl/browser-image-compression), an MIT-licensed library that uses the browser's Canvas API to resize and re-encode images.

**Processing pipeline:**
1. File is read via `FileReader` API — no network request
2. Size is checked — files over 10 MB are rejected before processing begins
3. Image is decoded to a Canvas element
4. Canvas is resized if either dimension exceeds the maximum
5. Canvas is re-encoded using `canvas.toBlob(callback, mimeType, quality)` — the browser's native encoder
6. The compressor iterates on the quality parameter (binary search) until the output is at or below the target size
7. The resulting `Blob` is converted to an object URL for preview and download

**WebP vs JPEG vs PNG — when to use each:**

| Format | Best for | Lossy? | Typical savings vs JPEG |
|--------|----------|--------|------------------------|
| JPEG | Photos, complex images with gradients | Yes | baseline |
| PNG | Logos, screenshots, text, transparency | No (lossless) | varies |
| WebP | Everything — modern universal format | Both modes | 25–35% vs JPEG |

**The quality/size tradeoff:** JPEG quality follows a sharply nonlinear curve. Going from quality 100 → 90 may save 50% of file size with negligible visible difference. Going from 90 → 80 may save another 30–40% with minor detail loss visible only at 1:1 zoom in high-frequency areas. Going from 80 → 70 starts producing visible compression artifacts in smooth gradients. The effective sweet spot for most web use cases is quality 75–85.

As a concrete example: a 2 MB screenshot that's a mix of UI and text typically compresses to 180–250 KB at JPEG quality 80 with no visible quality degradation at normal viewing distances. That's an 85–90% size reduction that translates directly to faster page loads and lower CDN bandwidth costs.

## Why Format Choice Matters

Format selection is the single highest-leverage decision in image optimization, and most developers default to JPEG for everything without thinking about it.

**JPEG is lossy DCT compression.** It works by discarding high-frequency spatial information in 8×8 pixel blocks. This makes it excellent for photographs (where the human visual system has low sensitivity to high-frequency detail loss in complex scenes) and poor for screenshots, diagrams, and text (where high-frequency edges — the sharp transitions between UI elements — are exactly what the user is looking at). A screenshot compressed as JPEG at quality 80 will have noticeable blockiness around text. The same screenshot as PNG stays sharp but is larger.

**PNG is lossless.** Use it for anything with transparency, anything with sharp edges (UI screenshots, diagrams, icons), and anything that will be edited again later. PNG file sizes are determined by pixel count and color complexity — a simple diagram with large flat color areas will compress very well; a photograph will be very large.

**WebP is the correct default for web assets.** It supports both lossy and lossless modes, handles transparency, and achieves 25–35% smaller files than JPEG at equivalent perceptual quality. Browser support has been universal since 2022. If you're serving images on the web and not using WebP, you're shipping unnecessary bandwidth. The only exception is when you need to support extremely old browser versions or email clients (which cannot render WebP).

**The Canvas API's HEIC limitation** is relevant for iPhone users. iOS captures photos in HEIC format, which is Apple's high-efficiency image format. Safari has a native HEIC decoder and can process HEIC files through the Canvas API; Chrome and Firefox do not. For web workflows that start from iPhone photos, converting to JPEG or PNG first (iOS can do this automatically when sharing to non-Apple apps) is the reliable path.

## Tips & Power Use

- **Start with WebP output for any web-destined image.** If the target environment supports it (any modern browser), WebP gives better quality-to-size ratio than JPEG by default.
- **For blog post images**, compress to a target of 150–250 KB at a max dimension of 1200–1600px. This covers retina displays at content column widths without excess payload.
- **For OpenGraph / social share images** (1200×630px), compress to under 100 KB. Social platforms re-compress these anyway; starting smaller reduces double-compression artifacts.
- **PNG screenshots of UI** often compress well as WebP lossy at quality 85. Try it before defaulting to lossless PNG — you'll often get 60–70% size reduction with no visible quality loss.
- **The quality slider does not exist** — this tool uses a target-size approach rather than a quality setting. If the result looks degraded, raise the target KB and re-compress.
- **For already-compressed JPEGs** (downloaded from the web, exported from Photoshop at high quality), the tool may not hit the target KB exactly — re-compressing a lossy-compressed file cannot always reduce size to an arbitrary target without severe quality loss. The "Quality floor" limitation applies here.
- **Batch workflow:** process multiple images sequentially — each file is independent, and results download as separate files. There's no zip bundling.

## How this works

Files are processed entirely in your browser using [browser-image-compression](https://github.com/Donaldcwl/browser-image-compression), an MIT-licensed library that uses the Canvas API to resize and re-encode images.

**Processing pipeline**

1. File is read via `FileReader` API (no upload)
2. File size is checked — files over 10 MB are rejected immediately
3. `imageCompression(file, options)` is called with your settings
4. The compressed `Blob` is converted to an object URL for preview and download

## Limitations

- **10 MB hard limit** — enforced before any processing to prevent the browser from freezing.
- **Quality floor** — for very small target sizes, the library may produce visibly degraded output. Use the preview to judge quality before downloading.
- **HEIC on non-Safari** — not supported without an additional HEIC decoder library.
- **Animated GIFs** — the library does not support animated GIFs. Static GIFs can be processed but will lose animation.
