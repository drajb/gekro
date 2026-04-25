---
title: "Cron Expression Builder"
category: "dev"
job: "Write, validate, and understand cron expressions with next-run previews"
description: "Build and decode cron expressions interactively. Get a plain-English description of any schedule, see the next 10 run times, and choose from 15 common presets. Zero dependencies, runs entirely in your browser."
aiSummary: "A client-side cron expression builder and explainer. Parses standard 5-field cron syntax, generates human-readable schedule descriptions, shows next 10 execution times, and includes 15 common presets. No external libraries."
personalUse: "I write cron schedules for Pi cluster tasks and Cloudflare Workers. I always need to double-check that '0 */4 * * 1-5' actually means what I think it means."
status: "active"
publishedAt: "2026-04-19"
icon: "⏱️"
license: "MIT"
---

## How this works

Enter a 5-field cron expression. The builder immediately:

1. **Validates** each field and highlights invalid syntax in red
2. **Describes** the schedule in plain English
3. **Shows the next 10 run times** relative to your local clock

Use the presets to start from a known schedule and modify from there.

## Cron syntax reference

```
┌─ minute      (0–59)
│ ┌─ hour      (0–23)
│ │ ┌─ day     (1–31)
│ │ │ ┌─ month (1–12 or JAN–DEC)
│ │ │ │ ┌─ weekday (0–7, 0 and 7 = Sunday, or SUN–SAT)
│ │ │ │ │
* * * * *
```

| Syntax | Meaning |
|--------|---------|
| `*` | Every value |
| `*/n` | Every nth value |
| `a-b` | Range from a to b |
| `a,b,c` | Specific values |
| `a-b/n` | Range with step |

## Examples

| Expression | Meaning |
|------------|---------|
| `* * * * *` | Every minute |
| `0 * * * *` | Every hour (on the hour) |
| `0 9 * * 1-5` | 9:00 AM Monday–Friday |
| `30 8 1 * *` | 8:30 AM on the 1st of every month |
| `0 0 * * 0` | Midnight every Sunday |
| `*/15 * * * *` | Every 15 minutes |

## Limitations

- **5-field syntax only** — does not support 6-field (with seconds) or 7-field (Quartz) variants.
- **No timezone support** — next-run times are shown in your local browser timezone.
- **L, W, #, ? special characters** — not supported (these are Quartz/Spring extensions).
- **Day-of-month and day-of-week interaction** — when both fields are non-wildcard, this builder treats the schedule as "match either" (OR logic), consistent with most cron implementations.

## Crontab Explainer

Paste any crontab expression in the builder above and it will parse it instantly. But here are more complex real-world expressions explained:

| Expression | What it means | Use case |
|------------|---------------|----------|
| `0 2 * * 0` | 2:00 AM every Sunday | Weekly backup |
| `*/15 9-17 * * 1-5` | Every 15 min, 9am–5pm, Mon–Fri | Business-hours polling |
| `0 0 1,15 * *` | Midnight on 1st and 15th of each month | Bi-monthly billing |
| `30 23 * * 1-5` | 11:30 PM Mon–Fri | Nightly report |
| `@reboot` | On system boot (not supported by this builder — standard cron only) | Startup tasks |
| `0 */6 * * *` | Every 6 hours | Cache refresh |

### Debugging complex expressions

When an expression behaves unexpectedly:
1. **Check your timezone** — system cron runs in the server's timezone, not yours
2. **Test with next-run preview** — the builder shows 10 upcoming fires; check if they match your mental model
3. **Day-of-month AND day-of-week** — most implementations use OR logic when both fields are non-wildcard. `0 0 1 * 1` fires on the 1st of the month OR every Monday.
4. **Use presets as anchors** — the 15 built-in presets cover the most common schedules; modify from there

### Cloudflare Workers cron triggers

Cloudflare uses a slightly different format — 6 fields with seconds first. But you can test the 5-field logic here and convert:

```
# Standard cron (5 fields) → CF Workers (6 fields with second=0)
0 * * * *      → 0 0 * * * *
*/5 * * * *    → 0 */5 * * * *
```
