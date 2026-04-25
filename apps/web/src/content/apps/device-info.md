---
title: "Device & Browser Info"
category: "infra"
job: "Inspect your browser, OS, hardware, network, and public IP — all displayed locally"
description: "Reads navigator, screen, and hardware APIs to display detailed browser and device information. Fetches your public IP via Cloudflare's trace endpoint (displayed only — not stored anywhere). Includes timezone, GPU, connection type, screen specs, and more. Zero data retention."
aiSummary: "Client-side device inspector reading navigator.*, screen.*, and hardware APIs. Fetches public IP via Cloudflare's cdn-cgi/trace endpoint for display only. Shows user agent, OS, GPU (via WebGL), connection type, screen dimensions, timezone, and language. Nothing stored."
personalUse: "I use this to debug cross-device issues and verify VPN IP address changes. Having all browser and network context in one view is faster than opening DevTools and running navigator calls manually."
status: "active"
publishedAt: "2026-04-20"
icon: "🖥️"
license: "MIT"
---

## What It Does

Device & Browser Info reads the browser's own APIs and displays a comprehensive snapshot of your device: browser identity, OS, hardware specs, screen properties, network connection type, GPU, timezone, and public IP. Nothing is sent to any Gekro server. The only external request is a single call to Cloudflare's free trace endpoint to surface your public IP.

## How to Use It

Open the page. The tool reads all available properties immediately and displays them. No interaction required. Click any value to copy it to clipboard. The public IP appears within a second after the Cloudflare fetch resolves.

**Data sources**

| Property | Source API |
|----------|-----------|
| User agent string | `navigator.userAgent` |
| Platform / OS | `navigator.platform`, user-agent hints |
| Browser language | `navigator.language`, `navigator.languages` |
| Hardware threads | `navigator.hardwareConcurrency` |
| Device memory (GB) | `navigator.deviceMemory` |
| Touch support | `navigator.maxTouchPoints` |
| Connection type | `navigator.connection.effectiveType` |
| Screen dimensions | `screen.width`, `screen.height` |
| Device pixel ratio | `window.devicePixelRatio` |
| Color depth | `screen.colorDepth` |
| GPU / Renderer | WebGL `RENDERER` string |
| Timezone | `Intl.DateTimeFormat().resolvedOptions().timeZone` |
| Public IP | Cloudflare `cdn-cgi/trace` |

## The Math / How It Works

All values except the public IP are read synchronously from browser APIs at page load. The GPU renderer string requires creating a temporary WebGL context (`canvas.getContext('webgl')`) and querying the `RENDERER` extension — this is the same technique browser fingerprinting scripts use, which is why some privacy-focused browsers return a generic value here.

The public IP fetch hits `https://1.1.1.1/cdn-cgi/trace` — a plain-text endpoint that Cloudflare provides for network diagnostics. It returns key-value pairs including your IP, server location, and TLS version. The response is parsed and only the IP field is displayed. No data is sent to Gekro; the IP goes from Cloudflare's edge to your browser, never onwards.

## Why Developers Need This (deep dive)

The dirty secret of browser capability detection is that `navigator.userAgent` is not reliable. It's a string that browsers have inflated, spoofed, and frozen for compatibility reasons over 30 years. Chrome on Android still says "Safari" in it. Firefox on Windows still includes "Gecko/20100101". Detecting "is this an iPhone?" from the user agent string requires a fragile regex that breaks with every major iOS release.

Feature detection is the correct pattern: instead of "is this Chrome on Android?", ask "does `navigator.connection` exist?" If yes, use it. If not, fall back gracefully. This tool shows you exactly which APIs are present and returning values in *your* current browser — which is what you need when debugging why a particular feature works in Chrome but not Firefox, or why your media query fires differently on an iPad than on your development machine.

**Screen density for responsive images** — `window.devicePixelRatio` tells you how many physical pixels correspond to one CSS pixel. On a standard 1080p monitor, it's 1. On a MacBook Retina, it's 2. On a modern Android phone, it's 3 or even 4. This is the number you need when deciding whether to serve `srcset` at 1x, 2x, or 3x resolution. Checking it here on your actual device, vs. assuming, prevents shipping oversized images to non-retina displays or blurry images to retina ones.

**Connection type for progressive enhancement** — `navigator.connection.effectiveType` returns `'4g'`, `'3g'`, `'2g'`, or `'slow-2g'`. This is only available in Chrome/Chromium, but when it is available, it lets you make runtime decisions: skip autoplay video on 2G, defer loading heavy analytics scripts on slow connections, or show a "low bandwidth mode" toggle. This tool shows you the raw API value so you can understand what your users' browsers actually report — useful when building adaptive loading strategies.

**The battery API** — `navigator.getBattery()` is available in Chromium browsers. It returns charge level, charging state, and estimated time to full/empty. Useful for native-feeling web apps that want to warn users before starting a long operation on low battery. The API is intentionally coarse-grained (charge level rounded to nearest 5%) to reduce fingerprinting utility.

**VPN verification** — the public IP readout makes this useful as a quick VPN sanity check. Open the tool before and after connecting to your VPN to confirm the IP changed. Faster than googling "what is my IP" and hitting a tracking-heavy site.

## Tips & Power Use

- **Cross-device debugging.** When a user reports a layout bug on "my phone," open this tool on their device (send them the URL) and have them screenshot it. You'll know exactly what browser, OS, pixel ratio, and screen dimensions to debug against.
- **Emulation validation.** Chrome DevTools device emulation changes the user agent and viewport but not everything — GPU renderer, hardware threads, and actual screen depth remain as your desktop. Use this tool in emulation mode to see what *isn't* being simulated.
- **Timezone capture.** The IANA timezone string (`America/Chicago`, `Asia/Kolkata`) is more reliable than the UTC offset for scheduling logic. If you're building a time-aware feature, this is the string to capture from users.

## Limitations

- **DeviceMemory** — rounded to 0.25/0.5/1/2/4/8 GB by the browser for fingerprinting resistance; not an exact value.
- **GPU renderer** — some browsers return a generic string or blank when hardware acceleration is disabled or fingerprinting protection is active.
- **Connection type** — only available in Chrome/Android. Returns undefined on Firefox and Safari.
- **IP geolocation** — this tool displays your IP but does not geolocate it. Use a WHOIS or GeoIP lookup separately if needed.
- **Privacy note** — your IP is visible to Cloudflare as it is for any request made to their network. The Cloudflare trace endpoint does not set cookies or persist data.
