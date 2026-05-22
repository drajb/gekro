# Stack section — agent quick reference

> Pointer doc. Full methodology lives at [`.gekro/docs/stack-standard.md`](../docs/stack-standard.md). Read that before writing or modifying stack entries.

## Section purpose

`/stack` — third-party tools Rohit actively uses, reviewed honestly. Distinct from `/blog` (essays), `/experiments` (proof-driven case studies), and `/apps` (stateless tools Rohit built).

## File locations

| What | Where |
|---|---|
| Methodology spec | `.gekro/docs/stack-standard.md` |
| Content collection schema | `apps/web/src/content/config.ts` — `stack` collection |
| Entry markdown files | `apps/web/src/content/stack/<slug>.md` |
| Template | `apps/web/src/content/stack/_template.md` |
| Layout | `apps/web/src/layouts/StackLayout.astro` |
| Components | `apps/web/src/components/stack/*.astro` |
| Index page | `apps/web/src/pages/stack/index.astro` |
| Per-entry page | `apps/web/src/pages/stack/[slug].astro` |

## Core invariants (must enforce)

1. **`badAt` is Zod-required with `.min(1)`.** Build fails if missing. Structural defense against affiliate fatigue.
2. **`lastVerified` shown on every entry.** Updated when entry is touched.
3. **No "X best Y" listicles.** Head-to-head comparisons only.
4. **Dropped tools stay listed** with `status: 'dropped'` and `droppedReason`.
5. **Disclosure is one muted line in the footer.** No banners, no per-link wrapping.
6. **No em-dashes.** Use regular hyphens (project-wide rule).
7. **Target 400-900 words.** Longer analysis → blog post + cross-link.
8. **Verdict in top viewport.** Lead with the recommendation.

## When user asks for "a stack post" or "review tool X"

1. Pull the methodology: `.gekro/docs/stack-standard.md`.
2. Verify required fields can be honestly filled — especially `badAt`. If you don't know real limitations, ask the user for them. Do not invent.
3. Use `_template.md` as the starting scaffold.
4. Compose body using `<StackPros>`, `<StackCons>`, `<ComparisonTable>`, `<SimpleBarChart>` where they add real value. Skip if ceremonial.
5. Cross-link at least one outward target (post, experiment, peer stack entry).
6. Build and verify before committing. Zod failures during build are the format's enforcement.

## Where this section appears in nav

`Header.astro` — between "Experiments" and "About". Lowercase, same treatment as other items.

## Cross-section links

- Stack ↔ Blog: stack entry references the post that uses the tool; post references the review.
- Stack ↔ Experiments: experiment references tools used; tool entries can list "demonstrated in".
- Stack → Stack: alternatives field links to peer entries.

## Affiliate / referral protocol

- Referral links go in `referralLink` frontmatter; rendered as the single normal link in the verdict block.
- One discrete muted line at footer: `<StackReferralFooter>`. Same template across all entries.
- No "20% off with code GEKRO" content. No banner. No popup.
- `/stack` index page mentions disclosure once at the top of the page description.

## Status semantics

- `active` — currently in production use
- `watching` — under evaluation
- `dropped` — was on the stack, no longer; `droppedReason` required

Index page sorts within category: active → watching → dropped. Dropped at reduced opacity but clickable.
