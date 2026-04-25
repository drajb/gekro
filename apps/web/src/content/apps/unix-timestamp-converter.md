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

## What It Does

The Unix Timestamp Converter converts between Unix epoch timestamps and human-readable dates — in both directions. Paste a Unix timestamp and get the date in ISO 8601, RFC 2822, US, EU, and local formats. Enter a date and get the Unix timestamp back. A live clock shows the current Unix time ticking in real time, plus a reference table of common historical epoch values.

It's the fastest way to decode a timestamp you're staring at in an API response, log file, or database record — without context-switching to a search engine.

## How to Use It

1. **To decode a timestamp:** paste any Unix timestamp (seconds or milliseconds) into the input field. The converter auto-detects the unit. All date formats appear instantly below.
2. **To get a timestamp:** enter a date using the date/time picker. The corresponding Unix timestamp appears immediately.
3. **Live clock:** the current timestamp is displayed in real time — useful for generating a "now" timestamp to use in API calls or database inserts.
4. **Reference table:** common historical epochs (Unix origin, Y2K, Unix 1 billion, Unix 2 billion, Year 2038 limit) are listed at the bottom.

The converter shows results in both UTC and your local browser timezone side by side, so you always know which timezone applies without having to convert manually.

## The Math / How It Works

Unix time counts **seconds elapsed since 1970-01-01T00:00:00Z** (the Unix epoch). It's a single integer that means the same thing everywhere on Earth, regardless of timezone or daylight saving time. That's its core value: it's globally unambiguous.

**Seconds vs milliseconds auto-detection:** values with 13+ digits are treated as milliseconds (JavaScript's `Date.now()` returns ms); shorter values are treated as seconds (most Unix system timestamps, POSIX APIs, database timestamps). This distinction is the #1 source of "timestamp too large" or "date in 2554" bugs — `Date.now()` returns 1745000000000 (13 digits), not 1745000000 (10 digits). Dividing by 1,000 gives the correct seconds value.

**Timezone handling:** the ISO 8601 output includes the UTC offset for your local timezone (e.g., `2026-04-19T14:30:00-05:00`). RFC 2822 format is used in email headers and HTTP `Date` headers. Both are unambiguous representations.

**The Year 2038 problem (Y2K38):** the maximum signed 32-bit integer is `2,147,483,647`, which corresponds to 2038-01-19T03:14:07Z. Any system that stores Unix timestamps as a signed 32-bit integer will overflow at this point and wrap to 1901. Modern systems use 64-bit integers, but embedded systems, legacy databases, and old C code may still be affected. The reference table includes this value so you can check it directly.

## Why Developers Need This

Unix timestamps are universal in software infrastructure. Every API with a `created_at` or `expires_at` field, every log file, every database record, every JWT `exp` claim uses them. The problem is that a raw integer like `1745271000` is not human-readable, and converting it mentally (or by asking a search engine) breaks flow.

The timezone trap is where most bugs live. A timestamp of `1745271000` decoded without a timezone context could be 2026-04-21 at any hour depending on where you are. The correct answer is always: decode to UTC first, then apply the timezone offset for your context. This tool shows both by default, removing that decision.

**Milliseconds vs seconds** is genuinely the most common timestamp bug I encounter in production systems. JavaScript always returns milliseconds from `Date.now()`. Python's `time.time()` returns seconds (as a float). Unix shell `date +%s` returns seconds. Redis timestamps are seconds. Most REST APIs use seconds. When a JS frontend passes a timestamp to a Python backend without dividing by 1,000 first, you get dates in the year 2524 in the logs. Recognizing this from a 13-digit number immediately saves debugging time.

**Logging and tracing** use Unix timestamps because they sort correctly as integers, require no timezone conversion for comparison, and are unambiguous across machines in different timezones. When you're reading distributed system logs and correlating events across services, being able to quickly convert a timestamp to a human-readable time is essential.

## Tips & Power Use

- **To generate a timestamp for "N minutes from now":** read the current live timestamp, add `N × 60` seconds. Useful for setting JWT expiry or cache TTL values.
- **JWT `exp` claims** are Unix timestamps in seconds. Paste the `exp` value here to see exactly when the token expires — or use the [JWT Decoder](/apps/jwt-decoder/) which does this automatically in context.
- **Database timestamps:** PostgreSQL and MySQL store timestamps as timezone-aware datetime values, but many applications extract Unix timestamps for portability. The converter handles both directions.
- **The Unix 2 billion mark** (`2000000000`) was reached on May 18, 2033 — close enough that some systems' time-related edge cases are worth checking now.
- **Negative timestamps** represent dates before 1970. JavaScript's `Date` supports them; paste `-86400` to get 1969-12-31T00:00:00Z (one day before epoch).

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

## Limitations

- Accuracy is limited to 1-second resolution for Unix seconds input.
- Dates before 1970 (negative timestamps) are supported by JavaScript's `Date` but may display inconsistently in older browsers.
- Leap seconds are not accounted for — Unix time treats all minutes as exactly 60 seconds.
