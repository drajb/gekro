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

## How this works

Files are processed entirely in your browser using [browser-image-compression](https://github.com/Donaldcwl/browser-image-compression), an MIT-licensed library that uses the Canvas API to resize and re-encode images.

**Processing pipeline**

1. File is read via `FileReader` API (no upload)
2. File size is checked — files over 10 MB are rejected immediately
3. `imageCompression(file, options)` is called with your settings
4. The compressed `Blob` is converted to an object URL for preview and download

**Options**

| Option | What it does |
|--------|-------------|
| Max size (KB) | Target output file size — the library tries to reach this but may not hit it exactly for already-compressed images |
| Max dimension | Width and height cap — image is scaled down proportionally if either dimension exceeds this |
| Output format | JPEG for photos (smaller), PNG for graphics (lossless), WebP for best compression |

**HEIC/HEIF** — Safari on iOS and macOS can convert HEIC files natively. Chrome and Firefox do not have built-in HEIC decoders; attempting to compress a HEIC file in those browsers will fail with a clear error message.

## Limitations

- **10 MB hard limit** — enforced before any processing to prevent the browser from freezing.
- **Quality floor** — for very small target sizes, the library may produce visibly degraded output. Use the preview to judge quality before downloading.
- **HEIC on non-Safari** — not supported without an additional HEIC decoder library.
- **Animated GIFs** — the library does not support animated GIFs. Static GIFs can be processed but will lose animation.
