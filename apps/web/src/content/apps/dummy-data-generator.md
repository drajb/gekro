---
title: "Dummy Data Generator"
category: "dev"
job: "Generate realistic fake datasets as JSON or CSV for testing and prototyping"
description: "Build a column schema, pick data types for each field, set the row count, and generate up to 1000 rows of realistic fake data. Export as JSON or CSV. Uses a hand-rolled micro-faker — no external dependencies, instant generation. Everything stays in your browser."
aiSummary: "Client-side dummy data generator with a column builder UI and 20+ data type options. Generates up to 1000 rows of realistic fake names, emails, UUIDs, dates, numbers, lorem text, addresses, and more. Exports as formatted JSON or CSV with header row."
personalUse: "I use this to seed test databases and mock API responses during local development. Generating 200 rows of users with email, UUID, role, and created_at in 5 seconds beats writing a seed script every time."
status: "active"
publishedAt: "2026-04-20"
icon: "🎲"
license: "MIT"
---

## What It Does

Dummy Data Generator lets you define a schema — column names, data types, row count — and instantly produces a realistic fake dataset in JSON or CSV. No sign-up, no API key, no upload. It's a hand-rolled micro-faker that runs entirely in your browser.

## How to Use It

1. Click **Add Column** to define your schema. Give each column a name and pick a data type from the 20+ options.
2. Set the row count (1–1000).
3. Click **Generate** and the dataset appears immediately.
4. Switch between JSON and CSV output modes. Copy to clipboard or download.

**Available data types**

| Category | Types |
|----------|-------|
| Identity | Full name, First name, Last name, Email, Username, UUID |
| Communication | Phone, URL, Domain |
| Location | City, Country, Street address, Postal code |
| Content | Lorem sentence, Lorem words, Lorem paragraph |
| Numbers | Integer (range), Float, Boolean, Percent |
| Dates | Date (ISO), Date (short), Timestamp (Unix) |
| Business | Company name, Job title, Department |
| Other | Color (hex), Gender |

## The Math / How It Works

Each column value is generated independently on every row. There's no shared state between rows, which makes generation O(rows × columns) — essentially instant up to 1000 rows in a browser. The "faker" is a lookup-table approach: names, cities, companies, and job titles are sampled from curated word lists; UUIDs use `crypto.randomUUID()`; numbers use `Math.random()` with configurable ranges; dates generate timestamps within a reasonable window and format them via the `Intl` API.

CSV output applies RFC 4180 escaping: values containing commas, quotes, or newlines are wrapped in double quotes, and internal double quotes are doubled.

## Why Developers Need This (deep dive)

Hand-typed test data is the silent killer of robust testing. When you write `test@example.com` as your email fixture, you're testing a normalized, no-edge-case string. Real users send `user+tag@subdomain.example.co.uk`, names with apostrophes, phone numbers with extensions, and city names with accents. A faker-generated dataset surfaces the character-encoding bugs, the field-length truncations, and the sort-order assumptions that hand-typed fixtures never catch.

Beyond correctness, volume matters. A UI component tested with 5 rows looks fine. At 500 rows, the layout breaks, the scroll performance degrades, and the "empty state" logic turns out to have an off-by-one. Seeding a test database with realistic volume is the difference between "it works in dev" and "it works in prod."

There's also a demo and documentation use case. Showing a database schema or an API response to a non-technical stakeholder with real-looking data — not `foo`, `bar`, `test1` — changes how they engage with the specification. Dummy data that looks plausible produces better feedback.

Seed scripts solve the same problem but they take time to write, live in the repo, and need updating when the schema changes. For one-off prototyping, this is faster.

## Tips & Power Use

- **Schema first, then count.** Define all your columns before bumping the row count to 1000. Generation is instant but re-generating is faster than editing.
- **Use UUID as a primary key column** and add it first. Other tools like the [CSV to JSON Converter](/apps/csv-to-json/) can then parse the exported CSV with the UUID as a stable record identifier.
- **Combine with a seed script.** Generate 100 rows here, export CSV, then `COPY` it into Postgres with `\copy table FROM 'file.csv' CSV HEADER`. Faster than an ORM seed.
- **Integer range for realistic IDs.** Set min/max (e.g., 1000–9999) to generate realistic-looking non-sequential IDs without the verbosity of UUIDs.
- **Lorem paragraph for longform fields.** Use this for `description`, `bio`, or `notes` columns — it produces enough variance to stress-test truncation and overflow behavior.

## Limitations

- **Uniqueness** — values are drawn independently per row. Duplicate emails or UUIDs may occur across a large dataset. Deduplicate downstream if uniqueness is required.
- **Locale** — names, addresses, and phone numbers follow English/US conventions. No locale switching is currently supported.
- **Row limit** — capped at 1000 rows to keep browser performance snappy. For larger datasets, export and repeat, or script the generation.
- **Relational constraints** — there's no foreign-key awareness. If you need column B to be drawn from the values in column A, generate them separately and join downstream.
