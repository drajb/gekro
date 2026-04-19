# Gekro `/apps` Platform Standard

**Version:** 1.0
**Established:** 2026-04-19
**Owner:** Rohit Burani
**Decision log refs:** 2026-04-19 (entries 1–3)

This is the canonical specification for gekro's `/apps` section — a platform of single-session, client-only mini-tools that complement the blog. Read this in full before adding, modifying, or scaffolding anything under `/apps`. If a request contradicts this standard, stop and request **Override** per CLAUDE.md §6.

---

## 1. Vision & positioning

The blog is gekro's lab notebook. **`/apps` is the working bench.** Each app is a public version of a tool Rohit built for himself. Together they form an AI engineer's portfolio front + traffic driver.

**Confirmed tagline (2026-04-19):** *"Free tools I built for myself. Sourced data. No login."*
This goes on the `/apps` landing page hero. It is the positioning statement, the quality bar, and the content filter all in one sentence.

**Differentiation vs AI app generators (Lovable, Bolt, Emergent):**
- They generate shells. We ship sourced data.
- They are anonymous. Every gekro app is a signed artifact with a named maker and methodology.
- They sell "build your own." We sell "use this now, no account required."
- They have breadth. We have depth — 20 focused apps, each with a companion post and cited data, beats 10,000 generated stubs.
- Open-source + forkable + attribution-required = the portfolio moat.

Three non-negotiables for every app:
1. **Personally useful first.** Rohit must use it himself before it ships. No speculative apps.
2. **Static-only, single-session, no auth, no storage.** The user's data never leaves their browser (URL params + localStorage are exceptions for self-managed state).
3. **Companion blog post.** Every app links to a methodology post; every post can link back to its app. Two-way traffic.

---

## 2. Anti-overengineering guardrails (locked)

These rules exist because we already know the trap: a 20-app platform tempts premature abstraction.

| Rule | Trigger to revisit |
|---|---|
| Static-only — no APIs, no edge functions, no DB | Never (this is a hard constraint of the gekro ecosystem) |
| `localStorage` for user preferences only — never user input data | Never |
| **No new npm deps.** Vanilla TS + Tailwind tokens + existing site libs (GSAP, Three.js if 3D) | New dep requires a decision log entry citing 3+ apps that need it |
| One file per app under `components/apps/{slug}/Calculator.astro` until it grows past ~400 lines | When file exceeds ~400 lines, split into `Calculator.astro` + `data.ts` + `helpers.ts` (max) |
| Shared layer is **closed-set**: only the components listed in §6 below | New shared component requires a decision log entry |
| No "calculator framework" — every app is its own self-contained island | Never |
| No state management library (no Pinia, Zustand, etc.) — vanilla `<script>` + DOM | Never |
| One new app per month until traffic data justifies more | After 3 months of data |

---

## 3. File structure (canonical)

```
apps/web/src/
├── content/
│   ├── config.ts                          # +apps collection (Zod schema, §4)
│   └── apps/
│       ├── _template.md                   # frontmatter scaffold
│       └── {slug}.md                      # one .md per app
├── layouts/
│   └── AppLayout.astro                    # extends BaseLayout
├── pages/apps/
│   ├── index.astro                        # search + filter UI
│   └── [slug].astro                       # dynamic route
└── components/apps/
    ├── AppCard.astro                      # landing-page grid card
    ├── AppFilters.astro                   # search input + category chips
    ├── AppShell.astro                     # title, JTBD, toolbar, methodology, attribution
    ├── AttributionFooter.astro            # © + license + source link
    ├── shared/
    │   ├── NumberInput.astro
    │   ├── Select.astro
    │   ├── Tabs.astro
    │   ├── ResultCard.astro
    │   ├── CopyButton.astro
    │   ├── ExportButton.astro
    │   ├── ResetButton.astro
    │   ├── csv.ts                         # exportRows(rows, filename)
    │   └── url-state.ts                   # readState/writeState helpers
    └── {slug}/
        ├── Calculator.astro               # the island for this app
        └── data.ts                        # app-specific data (optional)
```

**Root-level additions for licensing:**
```
gekro/
├── LICENSE                  # MIT — covers all code
├── LICENSE-CONTENT          # CC BY-NC 4.0 — covers blog + app copy
└── README.md                # updated to state both licenses
```

---

## 4. Content collection schema

Add to `apps/web/src/content/config.ts`:

```ts
const apps = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),                                    // "LLM Cost Calculator"
    slug: z.string(),                                     // "llm-cost-calculator"
    category: z.enum(['ai', 'infra', 'ev', 'trading', 'dev', 'finance']),
    job: z.string(),                                      // JTBD one-liner: "Compare LLM API costs across providers"
    description: z.string(),                              // 1–2 sentence summary (meta/OG)
    aiSummary: z.string().optional(),                     // GEO-optimised 2-sentence summary
    personalUse: z.string(),                              // "Why I built this for myself" — the portfolio hook
    status: z.enum(['active', 'beta', 'archived']).default('active'),
    publishedAt: z.string(),                              // ISO date
    lastVerified: z.string().optional(),                  // ISO date — surfaces in UI for data-driven apps
    companionPostSlug: z.string().optional(),             // links to /blog/{slug}
    license: z.string().default('MIT'),                   // override only when necessary
    icon: z.string().optional(),                          // emoji or icon path for AppCard
  }),
});

export const collections = { blog, experiments, apps };
```

**Categories taxonomy (v1, locked, additive only):**

| Category | Domain |
|---|---|
| `ai` | LLM/inference/prompt tools, token counters, model comparisons |
| `infra` | Self-hosting calculators, cluster sizing, network/storage planning |
| `ev` | Tesla, charging, range, EV economics |
| `trading` | Position sizing, risk/reward, Kelly criterion, options math |
| `dev` | Regex, cron, JSON/YAML, encoding/decoding, dev productivity |
| `finance` | Amortization, rate comparison, retirement, savings math |

Adding a new category requires a decision log entry.

---

## 5. Per-app UX standard (locked)

Every app must:

1. **Render results immediately on page load** with sensible defaults — no blank state.
2. **Live recalc on input** — no submit button. Update on every `input` event.
3. **Mobile-first inputs** — `inputmode="decimal"` or `numeric` for number fields, large tap targets, no tiny spinners.
4. **Tailwind tokens only** — `bg-bg-base`, `bg-bg-surface`, `text-text-primary`, `text-text-secondary`, `text-accent`, `border-border`, etc. **No custom CSS** unless the app needs a unique visual element (charts, etc.) — and even then, scope it inside the app's `Calculator.astro`.
5. **Toolbar via AppShell** — every app gets the toolbar slot with: `ExportButton` (CSV), `CopyButton` (copy result to clipboard), share-link button (copy URL with current state), `ResetButton`. AppShell renders these — apps wire them up via callbacks.
6. **URL-state sync** — every input change updates the URL via `url-state.ts`. On load, `url-state.ts` reads URL params and applies them as initial state (falls back to defaults if missing).
7. **`prefers-reduced-motion`** respected on any animation.
8. **Methodology link** — if `companionPostSlug` is set in frontmatter, AppShell renders "Read the methodology →" linking to `/blog/{slug}`.
9. **Last-verified stamp** — for data-driven apps, AppShell renders `Last verified: {date}` near the data source link.
10. **Attribution** — `AttributionFooter.astro` renders at the bottom of every app page.

**View Transitions discipline:** all event listeners must be wrapped in an `init{App}()` function bound to `astro:after-swap` per the established gekro pattern (issue tracker 2026-04-11). Use `AbortController` if you attach scroll/resize listeners.

---

## 6. Shared layer contracts (closed set)

The `components/apps/shared/` folder is closed — adding to it requires a decision log entry. The contracts:

### `csv.ts`
```ts
export function exportRows(
  rows: Record<string, string | number>[],
  filename: string         // e.g. "llm-cost-2026-04-19.csv"
): void;
```
- Generates RFC 4180 compliant CSV.
- Triggers browser download via `Blob` + temporary `<a download>`.
- Handles values containing commas/quotes/newlines (escape with double-quotes).
- ~30 lines, no deps.

### `url-state.ts`
```ts
export function readState<T extends Record<string, string | number | boolean>>(
  defaults: T
): T;

export function writeState(state: Record<string, string | number | boolean>): void;
// Updates window.location with replaceState (no history pollution).

export function shareLinkUrl(): string;
// Returns full URL with current querystring — for the share-link button.
```
- Uses `URLSearchParams`.
- Numbers/booleans round-trip through string encoding.
- ~40 lines, no deps.

### UI primitives (Astro components, all use Tailwind tokens)
- **`NumberInput.astro`** — `{ label, name, value, min?, max?, step?, suffix?, mode? }`. Renders large input with optional suffix (e.g. "tokens", "$/month"). `mode` toggles `inputmode` between `decimal` and `numeric`.
- **`Select.astro`** — `{ label, name, options: { value, label }[], value }`. Native `<select>` styled.
- **`Tabs.astro`** — `{ tabs: { id, label }[], active }`. Renders pill-style tab strip; emits `tab-change` CustomEvent.
- **`ResultCard.astro`** — `{ label, value, suffix?, accent? }`. Big number display. `accent: true` uses `text-accent` for the headline.
- **`CopyButton.astro`** — `{ targetId, label? }`. Copies text content of `#targetId` to clipboard, shows "Copied!" for 1.5s.
- **`ExportButton.astro`** — `{ filename }`. Triggers a `request-export` CustomEvent on the app island; the island responds by calling `exportRows()`.
- **`ResetButton.astro`** — Triggers `request-reset` CustomEvent; island responds by clearing state.

All buttons use the same visual treatment: rounded pill, `bg-bg-surface`, `border-border`, hover `border-accent`, mono uppercase label with tracking.

### `AppShell.astro`
```astro
<AppShell
  title={app.data.title}
  job={app.data.job}
  category={app.data.category}
  lastVerified={app.data.lastVerified}
  companionPostSlug={app.data.companionPostSlug}
  license={app.data.license}
  exportFilename={`${app.data.slug}-{YYYY-MM-DD}.csv`}
>
  <Calculator client:load />
</AppShell>
```
Renders: header (title + JTBD + category badge) → toolbar (Export + Copy + Share + Reset) → `<slot />` (the island) → "Last verified" + methodology link + AttributionFooter.

### `AttributionFooter.astro`
```astro
<AttributionFooter license={app.data.license} sourceUrl={`https://github.com/drajb/gekro/tree/main/apps/web/src/components/apps/${slug}`} />
```
Renders: `© 2026 Rohit Burani · {license} · Built at gekro.com · View source on GitHub`.

---

## 7. Landing page (`/apps/index.astro`)

Sections:
1. **Hero strip** — headline ("Free tools I built for myself, public versions"), subhead (1 sentence), no animation overhead.
2. **Filter bar** — `AppFilters.astro` renders search input + 6 category chips (matches the v1 taxonomy). Vanilla JS array filter — no Fuse.js, no Pagefind.
3. **Card grid** — `AppCard` for each app, sorted by `publishedAt` desc, filtered live by search + category state.
4. **Empty state** — shown when filters return 0 results.

**`AppCard.astro`** displays: icon (frontmatter), title, JTBD one-liner, category badge, status badge if not `active`. Uses the same hover-tilt + glow treatment as `PostCard.astro` and `ExperimentCard.astro` for visual consistency (see decision log 2026-04-15).

**SEO/structured data:** mirror `/experiments/index.astro` pattern — `CollectionPage` + `ItemList` JSON-LD, `BreadcrumbList`.

**Header nav:** add `{ label: 'Apps', href: '/apps' }` to `navItems` in `Header.astro`.

---

## 8. Per-app dynamic route (`/apps/[slug].astro`)

Pattern (mirrors `/blog/[slug].astro` and `/experiments/[slug].astro`):

```astro
---
import { getCollection, getEntryBySlug } from 'astro:content';
import AppLayout from '../../layouts/AppLayout.astro';
import AppShell from '../../components/apps/AppShell.astro';

export async function getStaticPaths() {
  const apps = await getCollection('apps');
  return apps.map(app => ({ params: { slug: app.slug }, props: { app } }));
}

const { app } = Astro.props;
const { Content } = await app.render();

// Dynamic-import the per-app island
const Calculator = (await import(`../../components/apps/${app.slug}/Calculator.astro`)).default;
---

<AppLayout app={app}>
  <AppShell {...} >
    <Calculator />
  </AppShell>
  <Content />  <!-- methodology copy from the .md file -->
</AppLayout>
```

`AppLayout.astro` extends `BaseLayout`, adds `SEOHead`, `JsonLD` (TechArticle or SoftwareApplication schema), `BreadcrumbList`. No hero canvas.

---

## 9. Methodology + companion blog post pattern

Each app has a markdown body in its `.md` file (rendered via `<Content />` below the calculator). The body covers:
- **What this calculates** — the model in plain English.
- **Inputs explained** — each input + sensible default justification.
- **Sources** — cited links for any data (model pricing, benchmarks).
- **Limitations** — what the calculator does NOT model.
- **Companion post link** — "For the full methodology, see [companion post]."

The **companion blog post** is written AFTER the app ships and Rohit has used it for ~1 week (so the post has real numbers and lessons). Write order:
1. Ship the app
2. Use it
3. Write the companion post citing the app
4. Update the app's `companionPostSlug` frontmatter
5. AppShell auto-renders the methodology link

**Do not write the companion post during the app build phase** — premature posts are thin.

---

## 10. Licensing

### Files at root
- **`LICENSE`** — MIT License, copyright Rohit Burani, current year. Standard SPDX MIT text.
- **`LICENSE-CONTENT`** — CC BY-NC 4.0 deed + legal code. Standard Creative Commons text.

### What each covers
| File | License |
|---|---|
| All `.ts`, `.astro`, `.js`, `.json`, `.css` files | MIT |
| `apps/web/src/content/blog/**/*.md` (article body) | CC BY-NC 4.0 |
| `apps/web/src/content/experiments/**/*.md` (article body) | CC BY-NC 4.0 |
| `apps/web/src/content/apps/**/*.md` (methodology body) | CC BY-NC 4.0 |
| Per-app code under `components/apps/{slug}/` | MIT (or per-app override) |

### Per-app override
The `license` frontmatter field defaults to `MIT`. If a future app ships with a dependency requiring different terms, override it (e.g. `license: 'Apache-2.0'`). Any non-MIT license must have its full text added to a `LICENSES/` folder at the repo root.

### `AttributionFooter` rendering
```
© 2026 Rohit Burani · MIT · Built at gekro.com · View source
```
The license token reads from frontmatter. The "View source" link points to the app's folder on GitHub.

### README update
The repo README must state:
- "This repo is dual-licensed: code under MIT, content under CC BY-NC 4.0."
- "Per-app license is declared in each app's frontmatter; defaults to MIT."
- "If you fork an app, include the MIT copyright notice and link back to gekro.com."

---

## 11. Data freshness pattern (for data-driven apps)

Every data-driven app (cost calculators, hardware comparisons, anything with prices/benchmarks) follows this pattern:

1. **Data lives in `components/apps/{slug}/data.ts`** as a typed export.
2. Each data record has a `source` field (URL) and a top-level `lastVerified` date constant.
3. AppShell receives `lastVerified` from frontmatter and renders it visibly: *"Last verified: 2026-04-19 · Sources →"*
4. Quarterly review cadence: every quarter, scan all apps' `lastVerified` and refresh stale data. Append a row to the issue tracker if data was meaningfully out of date.

**Hardware-comparison apps additionally:** never predict throughput from raw specs (TOPS, TFLOPS). Always use a curated benchmark table (`{ model, hardware, quantization, tokens_per_sec, watts }`) sourced from published numbers + Rohit's own runs. This is a hard rule (decision log 2026-04-19 entry 1).

---

## 12. Quality bar — "LinkedIn-screenshot-worthy"

Every app must pass these checks before shipping:
- [ ] Renders results immediately on page load (no blank state)
- [ ] One screenshot of the app shows a clear, headline-worthy result (savings, comparison, surprising insight) — large numbers, accent color on the punchline
- [ ] Side-by-side or comparison view available (where relevant)
- [ ] Mobile responsive — usable single-handed
- [ ] CSV export works and the filename is sensible
- [ ] Share-link round-trip works (copy URL, paste in incognito, see same state)
- [ ] AttributionFooter visible
- [ ] At least one data source cited (for data-driven apps)
- [ ] Tested in light mode + dark mode (gekro has reader-mode theme toggle on some pages)
- [ ] Lighthouse perf > 90 on mobile (apps are lighter than blog posts — should be easy)

If an app doesn't meet the bar, it doesn't ship. No exceptions for "good enough."

---

## 13. Governance

Per CLAUDE.md §6:
- **Pre-flight:** before any /apps work, read this standard + decision log 2026-04-19 entries + issue tracker.
- **During work:** any architectural decision (new shared component, new category, new dependency) requires a decision log entry **before** implementation.
- **Bugs:** every bug found during /apps work gets an issue tracker entry with RCA.
- **Override:** if a request contradicts this standard, stop and request literal phrase "Override" from user.
- **Content protection (CLAUDE.md §6a):** apps can have new markdown under `apps/web/src/content/apps/` — that's permitted. The `apps` collection is new and not under the existing protection. Existing `blog/` and `experiments/` markdown remains protected.
- **Commit cadence:** batch commits per the user's standard preference (one commit per logical unit, not per file).

---

## 14. Adding a new app — the recipe

For every app after the platform scaffold is in place:

1. **Justify it.** Confirm: (a) Rohit personally uses it, (b) it fits an existing category, (c) the data isn't trivially Googleable elsewhere.
2. **Source the data** (if data-driven). Cite every source. Mark `lastVerified`.
3. **Create files:**
   - `apps/web/src/content/apps/{slug}.md` — frontmatter + methodology body
   - `apps/web/src/components/apps/{slug}/Calculator.astro` — the island
   - `apps/web/src/components/apps/{slug}/data.ts` — only if data-driven
4. **Wire up the toolbar callbacks** — `request-export`, `request-reset` event listeners in the island.
5. **Validate URL-state round-trip** in dev.
6. **Run the §12 quality bar checklist.**
7. **Get user review before commit** if any data was researched (pricing, benchmarks).
8. **Commit + push.**
9. **Use the app for 1 week.** Take notes.
10. **Write the companion blog post.** Update `companionPostSlug` in frontmatter.

---

*End of standard. Version bumps go here as the platform evolves.*
