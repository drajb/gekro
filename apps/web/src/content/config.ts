/**
 * content/config.ts — Astro Content Collections schema definitions
 *
 * Single source of truth for all markdown frontmatter shapes.
 * Astro validates every .md file in src/content/{blog,experiments}/ against
 * these Zod schemas at build time — type errors surface during `astro build`.
 *
 * Collections:
 *  blog        — blog posts (type: 'content' — markdown with frontmatter)
 *  experiments — experiment case studies (type: 'content')
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

const blog = defineCollection({
  type: 'content',
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
  }),
});
const experiments = defineCollection({
  type: 'content',
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
  }),
});

export const collections = { blog, experiments };
