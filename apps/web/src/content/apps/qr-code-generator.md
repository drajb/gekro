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

## How this works

QR codes encode data as a matrix of black and white modules. This generator uses the `qr-code-styling` library entirely in your browser — no data is sent to any server at any point.

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

**Error correction**

Error correction level controls how much of the QR code can be obscured and still scan. Higher levels produce denser codes:

- **L** — ~7% recovery (smallest, fastest to scan)
- **M** — ~15% recovery (default for plain codes)
- **Q** — ~25% recovery (recommended when using a logo)
- **H** — ~30% recovery (best when logo covers a large area)

Logo embedding automatically raises the minimum level to **Q** to compensate for the obscured center modules.

**Logo embed**

The logo image is read entirely via the browser `FileReader` API and converted to a base64 data URL — it never leaves your device. Maximum file size: 1 MB.

## Limitations

- Very long text inputs produce denser, harder-to-scan codes. URLs over ~300 characters may not scan reliably on older phone cameras.
- The `geo:` URI is supported by Android natively. On iOS, use a Maps URL instead.
- SVG export preserves vector quality; PNG export renders at the selected pixel size.
