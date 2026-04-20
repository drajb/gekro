---
title: "Unix Timestamp Converter"
description: "Convert Unix timestamps to human-readable dates and back. Live clock, relative time, multi-format output, common epoch reference table."
job: "Unix ↔ datetime — relative time, ISO / RFC / local formats, live clock"
icon: "🕐"
category: "dev"
status: "active"
publishedAt: "2026-04-19"
lastVerified: "2026-04-19"
license: "MIT"
aiSummary: "Converts Unix timestamps (seconds or milliseconds) to human-readable datetimes and vice versa. Shows current live timestamp, relative time, multiple output formats (ISO 8601, RFC 2822, US, EU, local), and a reference table of common historical epochs."
personalUse: "I paste epoch timestamps from API responses and logs constantly. Tired of opening a browser tab to decode them — so I built this."
companionPostSlug: ""
---

## How it works

Unix time (also called epoch time or POSIX time) counts seconds elapsed since **1970-01-01T00:00:00Z** — the Unix epoch. It's timezone-agnostic: `0` is always midnight UTC on January 1st, 1970, regardless of where you are.

### Seconds vs milliseconds

Most Unix APIs use **seconds**. JavaScript's `Date.now()` returns **milliseconds**. The converter auto-detects the unit: values with 13+ digits are treated as milliseconds; shorter values as seconds.

### Timezone handling

All conversions display in both **UTC** and your **local browser timezone**. The ISO 8601 format includes the offset (e.g., `2026-04-19T14:30:00-05:00`).

### Common epochs

- **Unix epoch** — `0` → 1970-01-01T00:00:00Z (the origin)
- **Y2K** — `946684800` → 2000-01-01T00:00:00Z
- **Unix 1 billion** — `1000000000` → 2001-09-09T01:46:40Z
- **Unix 2 billion** — `2000000000` → 2033-05-18T03:33:20Z (upcoming)
- **Year 2038 problem** — `2147483647` → 2038-01-19T03:14:07Z (max signed 32-bit int)

### Limitations

- Accuracy is limited to 1-second resolution for Unix seconds input.
- Dates before 1970 (negative timestamps) are supported by JavaScript's `Date` but may display inconsistently in older browsers.
- Leap seconds are not accounted for — Unix time treats all minutes as exactly 60 seconds.
