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

## How this works

All device and browser information is read from browser APIs — no server is involved for this part.

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
| Cookie enabled | `navigator.cookieEnabled` |
| Online status | `navigator.onLine` |

**Public IP**

Fetched from `https://1.1.1.1/cdn-cgi/trace` — Cloudflare's free, unauthenticated trace endpoint. The response is plain text containing your IP and other metadata. The IP is displayed on screen only and is **never sent to any Gekro server** or stored anywhere.

## Privacy note

This tool reads what your browser already knows about itself. It does not install trackers, write cookies, or make any requests other than the single Cloudflare IP lookup. The Cloudflare trace endpoint does not set cookies or persist data. Your IP is visible to Cloudflare as it is for any request to their network.

## Limitations

- **DeviceMemory** — rounded to 0.25/0.5/1/2/4/8 GB by the browser for fingerprinting resistance; not an exact value.
- **GPU renderer** — some browsers return a generic string ("ANGLE (vendor)") or a blank value when hardware acceleration is disabled or fingerprinting protection is active.
- **Connection type** — only available in Chrome/Android. Returns undefined on Firefox and Safari.
- **IP geolocation** — this tool displays your IP but does not geolocate it. Add your IP to a WHOIS or GeoIP lookup separately if needed.
