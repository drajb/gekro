# Gekro Stack — Tool Review Standard

> Canonical methodology for `/stack` entries on gekro.com. Mirrors the role of `deep-dive-standard.md` but for third-party tool reviews instead of essays.

## 1. What the section is

**`/stack`** is the section where Rohit reviews and recommends third-party AI/dev/infra tools he actively uses in his own workflow. It is **not**:

- A blog post (those go in `/blog` — different shape: essays, frameworks, war stories)
- An app (those go in `/apps` — single-session stateless tools Rohit himself built)
- A listicle ("5 best X" — banned format)
- An advertisement (visible monetization is banned)

It **is**:

- A curated set of tools used by a working AI engineer
- Verifiable through `lastVerified` dates and prose-level specificity
- Honest about what tools are bad at (mandatory field; Zod-enforced)
- Cross-linked with the `/blog` and `/experiments` content that demonstrates the tool in use

## 2. Core invariants — never break these

| Invariant | Why |
|---|---|
| **`whatItsBadAt` is a required Zod field with `.min(1)`.** | Structural defense against affiliate fatigue. If the field is empty, the build fails. |
| **`lastVerified` is shown on every entry.** | Proves the review is alive, not write-once. Updated whenever the entry is touched. |
| **Verdict appears in the top viewport.** Never buried. | Affiliate sites bury verdicts; honest reviews lead with them. |
| **No banners, no popups, no "use this code for 20% off" CTAs, no "referral" labels.** The referral rides the unlabelled primary "Try {tool}" CTA (+ optional in-body link); a secondary "Visit site" button and the meta tile stay un-tracked; the muted footer is the only place the relationship is named. | Visible monetization breaks the "verified by an engineer" persona instantly. See §6. |
| **Dropped tools stay listed** with `status: 'dropped'` and `droppedReason`. | The strongest trust signal we can send. Affiliate sites never do this. |
| **No "X best Y" listicles.** | Listicles are the format-DNA of the affiliate genre. Head-to-head comparisons only. |
| **Tone matches an open-minded learner.** | Per Rohit: "I expect my audience to come in with a very open mind, with a learning mindset." No jargon dumping. Plain language. |

## 3. Entry structure (per file at `apps/web/src/content/stack/<slug>.md`)

### Frontmatter (Zod-validated)

```yaml
name: "Cursor"
category: "editor"        # one of the enum values in content/config.ts
tagline: "AI-first VS Code fork that actually ships."  # ≤ 80 chars
status: "active"          # active | watching | dropped
publishedAt: "2026-05-15"
lastVerified: "2026-05-15"
verdict: "Two sentences. The first commits to a recommendation. The second qualifies it with a specific case where it shines or fails."
priceTier: "paid-tier"    # free | paid-tier | paid-only | enterprise
pricingNotes: "$20/mo Pro, $40/mo Business — Pro is enough for solo work"
goodAt:
  - "Specific capability A with a concrete number or example"
  - "Specific capability B"
  - "Specific capability C"
badAt:
  - "A real limitation that affects daily workflow"
  - "Another real limitation"
homepage: "https://example.com"
referralLink: "https://example.com/?ref=rohit"  # optional
alternatives: ["windsurf", "zed", "github-copilot"]  # slugs of other /stack entries OR free-text
relatedPost: "ai-codes-like-genius"  # blog slug, optional
relatedExperiment: "neural-home-orchestrator"  # experiment slug, optional
aiSummary: "2-sentence plain-text distillation for /llms-full.txt"
```

For `status: 'dropped'`:
```yaml
status: "dropped"
droppedReason: "Replaced by X in Q2 2026 — Y stopped working with my Pi cluster after their v3 update."
```

### Body structure

```
[Optional 1-2 paragraph hook — what made me try it, real moment]

## Verdict
[The verdict from frontmatter, expanded to 3-5 sentences. Specific. No hedge words.]

## What it's good at
[Render the goodAt bullets as a <StackPros> block. Each bullet should pair the capability with a concrete number, screenshot, or workflow it slots into. "Fast" is banned; "completes a 200-line refactor in ~4 seconds on M4 Pro" is good.]

## What it's bad at
[Render the badAt bullets as a <StackCons> block. Same specificity rule. "Edge cases" is banned; "loses context after ~30 tabs open" is good.]

## When I'd skip it
[1-2 paragraphs. "If you're doing X, use Y instead." Names the specific alternative.]

## How it compares
[Optional <ComparisonTable> or <SimpleBarChart>. Only include when the comparison adds real value — skip if it would just be ceremonial.]

## My setup
[Optional 1 paragraph: how Rohit specifically uses it. Settings, integrations, plugins. The "verified engineer" part — proves real usage.]

## Where it goes next
[Optional 1-2 sentences: is this on the watch-list to drop, or sticking around?]
```

### Length discipline

Stack entries are **shorter than blog posts**. Target: **400-900 words**. They are reference docs, not essays. If the content wants to be longer, split off a `/blog` deep dive and link to it from the stack entry's "How it compares" section.

A common shape: 600 words across 6 short sections, plus a comparison table and a "what's bad" block.

## 4. Visual building blocks (components in `apps/web/src/components/stack/`)

- `<StackHeader>` — name, badges (category + status), tagline, verdict — top of every entry
- `<StackVerdict>` — verdict pull-quote + action row. Primary "Try {tool}" button (app-btn-primary) carries the `referralLink`; secondary "Visit site" button (app-btn-secondary) points at `homepage`. See §6.
- `<StackPros>` / `<StackCons>` — tinted cards rendered side-by-side in a two-column grid (StackLayout). emerald / rose.
- `<StackPros items={[...]} />` — emerald-accented bullet list of `goodAt`
- `<StackCons items={[...]} />` — rose-accented bullet list of `badAt`
- `<ComparisonTable>` — generic table for feature/spec comparisons (used in body markdown)
- `<SimpleBarChart>` — pure-SVG horizontal bar chart (used in body markdown)
- `<StackMeta>` — sidebar/footer block: price tier, last verified, homepage link, related post/experiment cross-links
- `<StackReferralFooter>` — single muted line at entry footer: "This entry includes a referral link. If you sign up through it I may receive free credits at no cost to you. Referrals never affect the verdict."

## 5. Voice and tone

Stack entries use the same first-person Rohit voice as `/blog` (see `deep-dive-standard.md` for the canonical voice notes), with these adjustments:

- **More concrete, less narrative.** No "Picture this" or "Imagine if" openers. Stack entries open with the verdict or a concrete moment.
- **Numbers over adjectives.** "Fast" → "300 tokens/sec on my M4 Pro." "Cheap" → "$20/mo for the Pro tier, vs $200/mo for the equivalent on the alternative."
- **Audience: open-minded learner, not an expert.** No assuming the reader knows what RAG is or what an MCP server does. Hyperlink to the appropriate `/blog` post or define in one short clause.
- **No em-dashes** (`—` U+2014). Use regular hyphens. Same global rule as the rest of gekro content.
- **No marketing copy.** If a sentence could appear on the tool's homepage, rewrite it.

## 6. Disclosure (per Rohit's preference: discreet, not in-your-face)

- **One muted line at the bottom of each entry**, via `<StackReferralFooter>`. `text-text-muted text-xs italic`. No banner, no bold, no "as an affiliate..." legalese. This footer line is non-negotiable: any entry that carries a `referralLink` keeps the muted disclosure. (Decision 2026-05-31.)
- **One sentence on the `/stack` index page** description: "Some entries include referral links - small disclosure on each entry."
- **No per-link wrapping.** A referral link looks the same as a regular link in the body. The single footer line is the disclosure for the entry.
- **The primary "Try {tool}" CTA carries the `referralLink`** (decision 2026-06-01, reverses 2026-05-31). It stays unlabelled - it reads as a normal CTA, never "click my referral" - so it is discreet without being hidden. Readers look for the action button; burying the referral only in body prose meant it was effectively invisible. `StackVerdict.astro` wires the primary button to `referralLink` when present.
- **A secondary "Visit site" button always points at the plain `homepage`** so the un-tracked link is one click away. The `<StackMeta>` homepage tile is also un-tracked.
- **The referral may also appear as one natural in-body link** (e.g. the tool's name on first mention) - same URL, no callout. Optional reinforcement, not a second disclosure.
- **No per-link wrapping or "referral" labels anywhere.** The muted footer is the only place the relationship is named.

## 7. Cross-linking conventions

- Stack entry → blog post: `[See the full architecture writeup](/blog/<slug>)`.
- Blog post → stack entry: `[I use <ToolName> for this — review here](/stack/<slug>)`.
- Stack entry → other stack entry (alternatives): `[<ToolName>](/stack/<slug>)`.
- Stack entry → experiment: `[Demonstrated in the <Experiment Name> experiment](/experiments/<slug>)`.

Every stack entry should have **at least one cross-link** outward (post, experiment, or peer entry). Isolated entries dilute the "lab ecosystem" feel.

## 8. Status semantics (drives the index page filter + visual badges)

- **`active`** — Rohit is using it right now in production-ish workflow. Default state.
- **`watching`** — Tried but not committed. May be promoted to `active` or demoted to `dropped` later. Use for tools in evaluation.
- **`dropped`** — Used to be on the stack, no longer is. Must include `droppedReason`. These entries stay live (don't delete) — they're trust signals.

The index page groups by category, and within each category sorts: `active` → `watching` → `dropped`. Dropped entries are rendered at reduced opacity but remain clickable.

## 9. Update protocol

When a tool meaningfully changes (pricing, capability, ownership):

1. Bump `lastVerified` to today's date.
2. Re-read the `verdict`, `goodAt`, `badAt`, `pricingNotes`. Update what's now wrong.
3. If verdict changed materially, append a short "Update YYYY-MM-DD: what changed" paragraph at the top of the body (above "## Verdict"). Don't silently rewrite history — note it.
4. If the tool was dropped or replaced: change `status` to `dropped`, add `droppedReason`, keep the entry live.

The `lastVerified` date is the implicit promise. If an entry's `lastVerified` is more than 12 months old, it should either be re-verified or marked `dropped`.

## 10. Examples of bad entries (what NOT to write)

- "5 Best LLM Clients in 2026" → listicle, banned
- "Why Cursor Is Awesome" → marketing tone, no `badAt`, banned
- "Cursor: Quick Review" with no `lastVerified` → write-once tone, banned
- A 4000-word essay on Cursor's architecture → belongs in `/blog`, link from `/stack`
- "Cursor vs Windsurf vs Zed vs Aider vs Continue" → too many entries; do pairs

## 11. Examples of good entries (what to aim for)

- "Cursor (active, last verified 2026-05-15) — best AI editor for solo refactors, falls over above ~30 tabs"
- "GitHub Copilot Pro (dropped 2026-04) — replaced by Cursor; reason: chat context window was too small for multi-file refactors"
- "Together AI (active) vs Fireworks (watching) — when the difference matters, when it doesn't"

## 12. SEO + structured data

Each stack entry emits `schema.org/Review` JSON-LD via `StackLayout.astro`. The schema includes:

- `itemReviewed`: `SoftwareApplication` or `Product` with `name` and `url`
- `reviewRating`: derived from `status` (active = 4-5, watching = 3, dropped = 2)
- `author`: `@id` reference to `/about/#person` (same as blog posts)
- `datePublished`: `publishedAt`
- `dateModified`: `lastVerified`
- `reviewBody`: the verdict

Plus `BreadcrumbList`: Home → Stack → tool name.

The `/stack/` index emits `CollectionPage` + `ItemList` with all entries (same pattern as `/blog/`).

## 13. Where to start when writing a new entry

1. Read this doc.
2. Open `apps/web/src/content/stack/_template.md` — copy it to a new slug.
3. Fill in frontmatter. **Be honest about `badAt` before writing anything else.** If you can't name 1 real limitation in 60 seconds, you don't know the tool well enough to review it yet.
4. Write the verdict. Two sentences. Strong.
5. Body: 400-900 words across the structure in §3.
6. Run `pnpm --filter web build` — Zod will fail loudly if the schema is wrong.
7. Eyeball the live preview: does it scan? Does the verdict land in the top viewport? Is the disclaimer line the LEAST prominent thing on the page?
8. Commit. Don't auto-cross-post to LinkedIn (different format; see `linkedin-standard.md` if you want a companion post).

---

*Last updated: 2026-06-01 — referral handling reversed (§2, §4, §6): the unlabelled primary "Try {tool}" CTA now carries the referral; secondary "Visit site" button + meta tile stay un-tracked; muted footer is the only named disclosure. Template made more exploratory: side-by-side pros/cons cards, CTA buttons, spec-sheet meta tiles. First entry: wispr-flow.*
