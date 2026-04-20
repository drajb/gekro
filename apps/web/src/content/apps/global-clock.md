---
title: "Global Clock"
description: "Live world clock showing CST and IST as large hero clocks, with London, New York, LA, Tokyo, Sydney, Dubai, Paris, and Singapore as secondary displays."
job: "Live clocks in 10 timezones — CST & IST hero, 8 secondary cities"
icon: "🌍"
category: "fun"
status: "active"
publishedAt: "2026-04-19"
lastVerified: "2026-04-19"
license: "MIT"
aiSummary: "Live world clock displaying current time across 10 timezones. Chicago (CST/CDT) and Mumbai (IST) shown as large analog + digital clocks. London, New York, Los Angeles, Tokyo, Sydney, Dubai, Paris, and Singapore shown as compact secondary clocks. All times update every second using the browser's Intl.DateTimeFormat API."
personalUse: "I coordinate across US Central and India regularly. Having both front-and-center saves the mental math every time."
companionPostSlug: ""
---

## How it works

All times use the browser's built-in `Intl.DateTimeFormat` API with IANA timezone identifiers (e.g., `America/Chicago`, `Asia/Kolkata`). No external API calls are made — the source of truth is the user's local clock.

### Timezones displayed

| City | IANA Zone | Notes |
|------|-----------|-------|
| Chicago | `America/Chicago` | CST (UTC−6) / CDT (UTC−5) |
| Mumbai | `Asia/Kolkata` | IST (UTC+5:30), no DST |
| London | `Europe/London` | GMT (UTC+0) / BST (UTC+1) |
| New York | `America/New_York` | EST (UTC−5) / EDT (UTC−4) |
| Los Angeles | `America/Los_Angeles` | PST (UTC−8) / PDT (UTC−7) |
| Tokyo | `Asia/Tokyo` | JST (UTC+9), no DST |
| Sydney | `Australia/Sydney` | AEST (UTC+10) / AEDT (UTC+11) |
| Dubai | `Asia/Dubai` | GST (UTC+4), no DST |
| Paris | `Europe/Paris` | CET (UTC+1) / CEST (UTC+2) |
| Singapore | `Asia/Singapore` | SGT (UTC+8), no DST |

### DST handling

Daylight Saving Time transitions are handled automatically by the `Intl` API. The displayed abbreviation (e.g., CST vs CDT) updates to reflect the current DST state.

### Limitations

- Accuracy is limited to the precision of the user's system clock.
- The clock does not account for leap seconds.
