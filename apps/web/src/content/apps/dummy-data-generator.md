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

## How this works

Build a schema by adding columns. Each column gets a name and a data type. Click **Generate** to produce rows of fake data that match the schema.

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

**Export formats**

- **JSON** — pretty-printed array of objects. Each object has keys from your column names.
- **CSV** — header row followed by data rows. Values containing commas or quotes are properly escaped.

## Limitations

- **Uniqueness** — values are drawn independently per row. Duplicate emails or UUIDs may occur across a large dataset. If uniqueness is required, deduplicate downstream.
- **Locale** — names, addresses, and phone numbers follow English/US conventions. No locale switching is currently supported.
- **Row limit** — capped at 1000 rows to keep browser performance snappy. For larger datasets, export and repeat.
