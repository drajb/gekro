/**
 * content.config.ts — Astro Content Collections schema definitions
 *
 * Single source of truth for all markdown frontmatter shapes.
 * Astro validates every .md file in src/content/{blog,experiments,apps,stack,news}/
 * against these Zod schemas at build time — type errors surface during `astro build`.
 *
 * Registered collections (see the `collections` export at the bottom):
 *  blog        — blog posts (markdown with frontmatter, via glob loader)
 *  experiments — experiment case studies
 *  apps        — gekro-built stateless tools
 *  news        — daily AI industry briefings (auto-generated + human-reviewed)
 *  stack       — third-party tool reviews ("Verified by an AI engineer").
 *                See .gekro/docs/stack-standard.md for the methodology. Note that
 *                the `badAt` field has .min(1) — that is intentional and is the
 *                structural defense against affiliate fatigue (the format
 *                refuses to build an entry that has no negative section).
 *
 * blog fields:
 *  title       — post headline (required)
 *  description — short 1-2 sentence summary (required; used in meta/OG)
 *  summary     — alias for description (optional; some older posts use this)
 *  publishedAt — ISO date string (e.g. "2026-04-15") — used for sorting
 *  difficulty  — Beginner | Intermediate | Advanced (defaults to Beginner)
 *  topics      — string[] — normalised by TOPIC_MAP in posts.ts
 *  readingTime — estimated minutes (optional, defaults to 5)
 *  tldr        — 2-4 sentence reader summary (optional; shown in TLDR block)
 *  aiSummary   — 2-sentence plain-text summary for AI citation / GEO (optional)
 *  mainImage   — path or URL to the featured image (optional)
 *
 * experiments fields:
 *  title, description, summary — required text fields
 *  aiSummary   — same GEO-optimised summary as blog (optional)
 *  status      — active | completed | archived
 *  startDate   — ISO date string
 *  stack       — string[] of technology names
 *  topics      — string[] for categorisation
 *  githubUrl   — optional link to source repo
 *  demoUrl     — optional link to live demo
 *  difficulty  — Beginner | Intermediate | Advanced
 */

import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const blog = defineCollection({
  // Astro 6 Content Layer: glob loader. `!**/_*` excludes _template.md
  loader: glob({ pattern: ['**/*.md', '!**/_*'], base: './src/content/blog' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    summary: z.string().optional(),
    publishedAt: z.string(),
    difficulty: z.enum(['Beginner', 'Intermediate', 'Advanced']).default('Beginner'),
    topics: z.array(z.string()),
    readingTime: z.number().optional().default(5),
    tldr: z.string().optional(),
    // 2-sentence plain-text summary optimised for AI citation (GEO)
    // If missing, BlogLayout falls back to description
    aiSummary: z.string().optional(),
    mainImage: z.string().optional(),
    // ISO date of last significant content update (optional; falls back to publishedAt)
    updatedAt: z.string().optional(),

    // Optional FAQ block — emitted as FAQPage JSON-LD by BlogLayout. AI
    // assistants cite FAQ schemas heavily and Google may surface them as
    // "People Also Ask" rich results. Each question is plain text; answer
    // can be 1-3 sentences. Both fields required if entry is present.
    faq: z.array(z.object({
      question: z.string(),
      answer: z.string(),
    })).optional(),

    // Optional HowTo block — emitted as HowTo JSON-LD by BlogLayout. Drives
    // step-by-step rich results in SERP for tutorial-style posts. `name` is
    // the high-level task; each step has its own short name + body text.
    howto: z.object({
      name: z.string(),
      totalTime: z.string().optional(), // ISO 8601 duration, e.g. "PT30M"
      steps: z.array(z.object({
        name: z.string(),
        text: z.string(),
      })).min(2),
    }).optional(),
  }),
});
const experiments = defineCollection({
  // Astro 6 Content Layer: glob loader. `!**/_*` excludes _template.md
  loader: glob({ pattern: ['**/*.md', '!**/_*'], base: './src/content/experiments' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    summary: z.string(),
    aiSummary: z.string().optional(),
    status: z.enum(['active', 'completed', 'archived']),
    startDate: z.string(),
    stack: z.array(z.string()),
    topics: z.array(z.string()),
    githubUrl: z.string().optional(),
    demoUrl: z.string().optional(),
    difficulty: z.enum(['Beginner', 'Intermediate', 'Advanced']),
    // ISO date when the experiment concluded (optional — ongoing experiments omit this)
    endDate: z.string().optional(),
  }),
});

const apps = defineCollection({
  // Astro 6 Content Layer: glob loader. `!**/_*` excludes _template.md
  loader: glob({ pattern: ['**/*.md', '!**/_*'], base: './src/content/apps' }),
  schema: z.object({
    title: z.string(),
    // slug is auto-derived from filename by Astro — do not add it here
    category: z.enum(['ai', 'infra', 'ev', 'trading', 'dev', 'finance', 'fun', 'health']),
    job: z.string(),
    description: z.string(),
    aiSummary: z.string().optional(),
    personalUse: z.string(),
    status: z.enum(['active', 'beta', 'archived']).default('active'),
    publishedAt: z.string(),
    lastVerified: z.string().optional(),
    companionPostSlug: z.string().optional(),
    license: z.string().default('MIT'),
    icon: z.string().optional(),
  }),
});

/**
 * stack — third-party tool reviews. Methodology in .gekro/docs/stack-standard.md.
 *
 * Hard rules (enforced by this schema):
 *  - badAt is .min(1) — every entry must declare at least one real limitation.
 *    Affiliate-fatigue defense. Build fails if the field is empty.
 *  - lastVerified is required — proves the entry is alive, not write-once.
 *  - status drives the index page sort and visual badge.
 *  - droppedReason is required IFF status === 'dropped' (validated via .refine).
 *  - referralLink is optional; disclosure happens via the global
 *    <StackReferralFooter> component, NOT per-link wrapping.
 *  - alternatives is free-text array — entries can reference other stack slugs
 *    or just name a competitor without a corresponding entry yet.
 */
const stack = defineCollection({
  // Astro 6 Content Layer: glob loader. `!**/_*` excludes _template.md
  loader: glob({ pattern: ['**/*.md', '!**/_*'], base: './src/content/stack' }),
  schema: z.object({
    name: z.string(),
    category: z.enum([
      'llm-client',     // ChatGPT, Claude, Cursor, etc.
      'editor',         // VS Code, JetBrains, etc.
      'infra',          // Cloudflare, AWS, hosting
      'observability',  // logging, metrics, traces
      'data',           // databases, vector stores, ETL
      'devtool',        // CLI tools, build systems, formatters
      'hardware',       // Pi, Mac Mini, GPUs
      'service',        // SaaS, APIs (Together AI, Fireworks, etc.)
    ]),
    // ≤ 80 chars; rendered under the name
    tagline: z.string().max(80),

    // active | watching | dropped — drives index sort + badge color
    status: z.enum(['active', 'watching', 'dropped']),
    publishedAt: z.string(),
    // ISO YYYY-MM-DD. Shown on the entry. Update whenever entry is meaningfully touched.
    lastVerified: z.string(),

    // 2-sentence verdict shown in <StackVerdict> at top viewport
    verdict: z.string(),
    priceTier: z.enum(['free', 'paid-tier', 'paid-only', 'enterprise']),
    pricingNotes: z.string().optional(),

    // The honesty fields — both required, badAt cannot be empty
    goodAt: z.array(z.string()).min(2),
    badAt: z.array(z.string()).min(1),

    // Free-text array — can be slugs of other stack entries or plain names
    alternatives: z.array(z.string()).optional(),

    homepage: z.string().url(),
    referralLink: z.string().url().optional(),

    // Optional secondary CTA shown beside the primary "Try" button in the
    // verdict action row — e.g. "View my own version" linking to a self-built
    // alternative. When present, it replaces the default "Visit site" button.
    altCta: z.object({ label: z.string(), url: z.string().url() }).optional(),

    // Cross-links (slug refs to other collections)
    relatedPost: z.string().optional(),
    relatedExperiment: z.string().optional(),

    aiSummary: z.string().optional(),

    // Only meaningful when status === 'dropped'. Validated below.
    droppedReason: z.string().optional(),

    // Optional comparison table rendered between StackCons and the markdown body.
    // Frontmatter-driven instead of inline JSX so .md files stay portable
    // (no MDX dependency) and Zod can validate shape.
    comparisonTable: z.object({
      headers: z.array(z.string()).min(2),
      rows: z.array(z.array(z.string()).min(2)),
      highlight: z.string().optional(),
      caption: z.string().optional(),
    }).optional(),

    // Optional benchmark / pricing bar chart, same rationale as comparisonTable.
    barChart: z.object({
      title: z.string(),
      unit: z.string().optional(),
      bars: z.array(z.object({
        label: z.string(),
        value: z.number(),
        highlight: z.boolean().optional(),
      })).min(2),
      source: z.string().optional(),
      max: z.number().optional(),
    }).optional(),
  }).refine(
    data => data.status !== 'dropped' || (data.droppedReason && data.droppedReason.length > 0),
    { message: 'droppedReason is required when status is "dropped"', path: ['droppedReason'] }
  ),
});

/**
 * news — daily AI industry briefings, auto-generated + human-reviewed.
 *
 * Each file is one day's briefing: YYYY-MM-DD.md
 * Generated by scripts/news/generate-briefing.mjs (GitHub Actions daily).
 * Reviewed via PR; Rohit approves/rejects to train the curation algorithm.
 *
 * sources  — array of source names cited (for attribution footer)
 * sourceUrls — matching URLs for the cited sources
 * autoGenerated — true = machine draft, false = hand-written
 * approved — human-reviewed and intentionally published (set by the workflow)
 */
const news = defineCollection({
  // Astro 6 Content Layer: glob loader. `!**/_*` excludes _template.md
  loader: glob({ pattern: ['**/*.md', '!**/_*'], base: './src/content/news' }),
  schema: z.object({
    title: z.string(),
    publishedAt: z.string(),       // ISO date, e.g. "2026-05-26"
    summary: z.string().max(200),  // 1 sentence shown on the index card (card line-clamps at 2)
    sources: z.array(z.string()),  // source names, e.g. ["The Verge", "Ars Technica"]
    sourceUrls: z.array(z.string().url()),
    autoGenerated: z.boolean().default(true),
    approved: z.boolean().default(false),
    // Optional topics for future filtering
    topics: z.array(z.string()).optional().default([]),
  }).refine(
    // sources[i] is the display name for sourceUrls[i] — a length mismatch
    // silently misattributes citations (an LLM failure mode). Fail the build.
    data => data.sources.length === data.sourceUrls.length,
    { message: 'news: sources and sourceUrls must be the same length (aligned by index)', path: ['sourceUrls'] }
  ),
});

export const collections = { blog, experiments, apps, stack, news };
