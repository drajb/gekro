---
title: "QR Code Generator"
category: "dev"
job: "Generate styled QR codes for URLs, WiFi, contacts, and more — with logo embed"
description: "Generate QR codes for 8 content types: URL, WiFi credentials, plain text, email, SMS, phone, vCard contact card, and geo location. Customize dot style, colors, and embed a logo image in the center. Download as PNG or SVG. Zero network requests — all processing happens in your browser."
aiSummary: "Client-side QR code generator supporting 8 data types (URL, WiFi, text, email, SMS, phone, vCard, geo). Visual controls: dot shape (square, rounded, dots, classy, classy-rounded, extra-rounded), foreground/background color, corner style, error correction level. Logo embed up to 1MB. Export PNG or SVG. Uses qr-code-styling library, no server calls."
personalUse: "I use this for WiFi QR codes at my desk and vCard codes on business materials. The logo embed makes them feel branded rather than generic."
status: "active"
publishedAt: "2026-04-20"
icon: "⬛"
license: "MIT"
---

## What It Does

QR Code Generator produces styled, brandable QR codes for 8 content types — URLs, WiFi credentials, vCards, SMS, email, phone numbers, plain text, and geo coordinates. Customize dot shape, colors, corner style, and optionally embed a logo in the center. Download as PNG or SVG. Everything runs in your browser; no data is sent to any server at any point.

## How to Use It

1. Select the content type (URL, WiFi, Text, Email, SMS, Phone, vCard, Location).
2. Fill in the relevant fields for that type.
3. Customize the visual style: dot shape, foreground color, background color, corner style.
4. Optionally upload a logo image (max 1 MB) to embed in the center.
5. Set the error correction level — use **Q** or **H** when embedding a logo.
6. Click **Download PNG** or **Download SVG**.

**Content types**

| Type | Encoded format |
|------|---------------|
| URL | Raw URL string |
| WiFi | `WIFI:S:ssid;T:WPA;P:pass;;` |
| Text | Raw UTF-8 string |
| Email | `mailto:addr?subject=…&body=…` |
| SMS | `sms:number?body=message` |
| Phone | `tel:+number` |
| vCard | vCard 3.0 (`BEGIN:VCARD … END:VCARD`) |
| Location | `geo:lat,lng` |

## The Math / How It Works

QR codes encode data as a matrix of black and white modules (the square dots). The encoding process has several stages: data is first encoded into a byte stream using the optimal encoding mode (numeric, alphanumeric, byte, or kanji), then Reed-Solomon error correction codes are added, then the data is arranged in the matrix with finder patterns, alignment patterns, and timing patterns. Finally, a masking pattern is applied to balance the module distribution and improve scan reliability.

**Error correction levels and why they exist:**

| Level | Recovery capacity | When to use |
|-------|------------------|-------------|
| L | ~7% | Smallest code, cleanest scan in ideal conditions |
| M | ~15% | Good default for plain codes without logos |
| Q | ~25% | Recommended when embedding a logo |
| H | ~30% | Maximum; use when logo covers a large center area |

Error correction works by encoding redundant information using Reed-Solomon codes. If up to X% of the modules are obscured or damaged, the scanner can reconstruct the original data from the remaining modules. A logo embedded in the center obscures the modules underneath — a logo covering 10–15% of the code area requires at least Q-level correction to remain scannable. This generator automatically raises the minimum to Q when you upload a logo.

**Data capacity by content type** — QR codes have a maximum data capacity that decreases as error correction level increases. At H-level, maximum capacity is about 1273 bytes in byte mode. This is plenty for a URL, a vCard, or WiFi credentials, but a very long URL (> 300 characters) at H-level will produce an extremely dense, hard-to-scan code. Keep URLs short; use a URL shortener for lengthy tracking URLs.

**Privacy advantage over web-based generators:** Many online QR generators send your data to a server to render the code. For WiFi credentials, vCard contact details, and business URLs, that's a data privacy issue. This generator uses the `qr-code-styling` library entirely in your browser — the WiFi password and contact details stay on your device.

## Why Developers and Non-Developers Need This (deep dive)

QR codes have had two eras: the 2012 era where they were awkward marketing gimmicks that required a separate scanner app, and the post-2017 era where every iPhone and Android camera app scans them natively. We're firmly in the second era. QR codes are now the correct answer for a wide range of physical-to-digital handoffs.

**Where QR codes outperform alternatives:**

- **WiFi credential sharing** — typing a WiFi password is error-prone and painful for guests. A QR code printed on a small card or taped to a router encodes the SSID, password, and security type in the `WIFI:` scheme. Android and iOS both decode it natively and offer to join the network in one tap.

- **vCard contact sharing** — printing a business card with a QR code encoding your full contact details (`BEGIN:VCARD`, phone, email, URL, address) lets someone add you to their contacts in one scan. Better than NFC for wide compatibility; better than typing for accuracy.

- **App store links** — `https://apps.apple.com/...` in a QR code printed on packaging or a poster is the correct approach for driving app downloads from physical materials.

- **Offline-to-online documentation** — a QR code on a physical device, product, or piece of equipment that links to its online manual, changelog, or support page. Better than a URL that users mistype.

**Dot style and scannability:** Custom dot shapes (rounded, dots, classy) look more branded than the standard square grid. They scan equally well as long as the finder patterns (the three corner squares) remain standard. This generator preserves standard finder patterns while allowing custom dot shapes in the data area.

**Print considerations:** Always test-scan before printing at scale. The minimum reliable printed size is approximately 2 × 2 cm at 300 DPI. High error correction (H) at small print sizes produces dense codes that require a steady camera and good lighting. If printing very small, use L or M level with a simple, short URL.

## Tips & Power Use

- **Use SVG for print.** SVG scales to any resolution without pixelation. For print materials, always download SVG rather than PNG.
- **Generate at the size you'll display it.** PNG export at 300px looks blurry when scaled up to 600px. Use SVG for scalability, or export PNG at your final display size.
- **WiFi QR codes for houseguests.** Generate once, print on a small card, laminate it, leave it on the coffee table. Saves explaining the password every time.
- **Logo embed best practices.** The logo should cover no more than 20–25% of the total code area. Circular logos (brand monogram, initials) work best in the center. Always test scan after adding a logo — at H-level error correction there's still a limit.
- **Short URLs scan faster.** A 30-character URL produces a less dense code that scans faster and from farther away than a 200-character URL. Use a URL shortener or a custom short domain for codes intended for wide distribution.

## Limitations

- Very long text inputs produce denser, harder-to-scan codes. URLs over ~300 characters may not scan reliably on older phone cameras.
- The `geo:` URI is supported by Android natively. On iOS, use a Maps URL instead (`https://maps.apple.com/?q=lat,lng`).
- SVG export preserves vector quality; PNG export renders at the selected pixel size.
- Logo embed requires that the logo file is a standard image format (JPEG, PNG, WebP, SVG). Max 1 MB.
