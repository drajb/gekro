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

## What It Does

Global Clock is a live world clock displaying 10 timezones simultaneously. Chicago (CST/CDT) and Mumbai (IST) are shown as large hero clocks with both analog and digital displays. Eight additional cities — London, New York, Los Angeles, Tokyo, Sydney, Dubai, Paris, and Singapore — display as compact secondary clocks. All times update every second. No server, no API, no external call — the source of truth is your local system clock.

## How to Use It

Open the page. The clocks start running immediately. The large clocks on top are Chicago and Mumbai (configurable to your preference). The secondary row shows the remaining 8 cities.

Use this for:
- Scheduling meetings between US Central and India — see both without mental arithmetic
- Knowing whether Tokyo is open before sending a Slack message
- Verifying whether a city is in DST right now (the abbreviation updates automatically)

**Timezones displayed**

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

## The Math / How It Works

Every clock is driven by a single `setInterval` that fires every second. On each tick, `new Date()` captures the current moment in the user's local system time, then `Intl.DateTimeFormat` with the appropriate IANA timezone ID converts it to the target city's local representation.

```js
new Intl.DateTimeFormat('en-US', {
  timeZone: 'Asia/Kolkata',
  hour: '2-digit', minute: '2-digit', second: '2-digit',
  hour12: true
}).format(new Date())
```

The `Intl` API handles DST transitions, half-hour offsets, and all historical timezone rule changes automatically — the IANA timezone database is embedded in every modern browser. No timezone math is done manually in the code.

## Why This Is Harder Than It Looks (deep dive)

Timezone management has a long and painful engineering history. A few things that look simple but aren't:

**DST transitions aren't universal.** The US, most of Europe, and Australia observe DST. India (IST), Japan (JST), Singapore (SGT), and Dubai (GST) do not. This means the offset between Chicago and Mumbai is +11:30 in US winter and +10:30 in US summer — not a fixed number. Any calculator that assumes a fixed UTC offset between two cities is wrong for at least part of the year.

**Half-hour and 45-minute offsets exist.** India is UTC+5:30. Nepal is UTC+5:45. Chatham Islands (New Zealand) observes UTC+12:45 in summer. The naive assumption that timezones are always on the hour breaks for a meaningful chunk of the world's population.

**DST transitions happen on different dates in different regions.** The US switches on the second Sunday in March; Europe switches on the last Sunday in March; Australia switches on the first Sunday in April (and their season is reversed — Australian DST *starts* in October). There's a period each year where the US has already switched but Europe hasn't, collapsing a typical 6-hour gap to 5 hours.

**Historical changes are captured in the IANA database.** Countries change their timezone rules — sometimes with only a few weeks of notice. The `Intl` API uses the browser's bundled copy of the IANA timezone database (`tzdata`), which is updated with each browser release. This is why you should use IANA zone IDs (`America/Chicago`) and never hardcode UTC offsets in production code.

**"What time is it in Tokyo right now" is a solved problem.** The `Intl.DateTimeFormat` API has been broadly available since 2012 and handles all of the above. The hard part in real engineering isn't displaying a timezone — it's storing and scheduling in a timezone-aware way. For that, use a library like `Temporal` (the TC39 proposal, now in browsers) or `date-fns-tz` for legacy code.

## Tips & Power Use

- **Meeting scheduling.** Before scheduling a cross-timezone call, open this clock to see the local time in each participant's city *right now*, then mentally add your meeting duration. If it's 6 PM in Tokyo and you want a 1-hour call, that means 7 PM Tokyo — confirm that works.
- **"Is anyone awake?"** The secondary clocks make it immediately obvious which offices are in business hours and which are in the middle of the night. 9 AM Chicago is 10:30 PM IST — Mumbai is asleep.
- **DST sanity check.** The abbreviation next to each clock (CDT vs CST, BST vs GMT) tells you the current DST status at a glance. Useful when you've lost track of whether a region has switched yet.

## Limitations

- Accuracy is limited to the precision of the user's system clock. If your system clock is wrong, all clocks are wrong by the same amount.
- The clock does not account for leap seconds.
- No user-configurable city list in the current version — the 10 cities are fixed.
