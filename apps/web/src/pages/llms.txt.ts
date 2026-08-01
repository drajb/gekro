/**
 * llms.txt.ts — site-level GEO manifest endpoint (GET /llms.txt)
 *
 * Why this is generated rather than a static file in /public:
 *  It used to be a hand-maintained public/llms.txt. That version described the
 *  apps section only as "78 utilities across AI, finance, dev, EV" and named
 *  zero of them, so an AI crawler could never cite a specific tool - the apps
 *  are the site's largest surface and its biggest search-traffic driver, and
 *  they were invisible to exactly the crawlers this file exists to serve. A
 *  hand-written list of 78 would also drift the moment an app shipped, which is
 *  the same staleness trap that had the pricing catalogs three generations old.
 *
 *  Generating from the content collections means the manifest is correct by
 *  construction on every deploy: new apps and new topic hubs appear
 *  automatically, and retired ones disappear.
 *
 * Relationship to the other manifests:
 *  /llms.txt       - this file. Site-level orientation + a full, named index of
 *                    the apps and topic hubs.
 *  /llms-full.txt  - per-post long form with aiSummary distillations.
 *  /api/posts.json - the same post data as structured JSON.
 *
 * Spec: https://llmstxt.org/
 */
import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { topicToSlug } from '../lib/utils/slugify';
import { getAllPosts } from '../lib/utils/posts';
import { eligibleNewsHubTopics } from '../lib/utils/news-topics';

const SITE = 'https://gekro.com';

/** Display names for the app `category` values, matching the /apps filter UI. */
const CATEGORY_LABELS: Record<string, string> = {
  ai: 'AI and LLM tooling',
  dev: 'Developer utilities',
  infra: 'Infrastructure and self-hosting',
  finance: 'Personal finance',
  trading: 'Trading and markets',
  ev: 'EV and Tesla',
  health: 'Health',
  fun: 'Fun and generators',
};
/** Order the sections so the biggest, most citable groups come first. */
const CATEGORY_ORDER = ['ai', 'dev', 'infra', 'trading', 'finance', 'ev', 'health', 'fun'];

export const GET: APIRoute = async () => {
  // Same visibility rule as /apps: hide archived, keep active + beta. The enum
  // is ['active','beta','archived'] - there is no 'retired'.
  const apps = (await getCollection('apps', ({ data }) => data.status !== 'archived'))
    .sort((a, b) => a.data.title.localeCompare(b.data.title));

  // Group apps by category, unknown categories last under their raw key.
  const byCategory = new Map<string, typeof apps>();
  for (const a of apps) {
    const c = a.data.category ?? 'other';
    if (!byCategory.has(c)) byCategory.set(c, [] as unknown as typeof apps);
    (byCategory.get(c) as unknown as typeof apps[number][]).push(a);
  }
  const orderedCats = [
    ...CATEGORY_ORDER.filter((c) => byCategory.has(c)),
    ...[...byCategory.keys()].filter((c) => !CATEGORY_ORDER.includes(c)).sort(),
  ];

  const appSections = orderedCats.map((cat) => {
    const list = byCategory.get(cat)!;
    const label = CATEGORY_LABELS[cat] ?? cat;
    const lines = list
      .map((a) => `- ${a.data.title} (${SITE}/apps/${a.id}/) - ${a.data.job ?? a.data.description ?? ''}`.trim())
      .join('\n');
    return `### ${label} (${list.length})\n${lines}`;
  }).join('\n\n');

  // Topic hubs, derived the same way /topics/[topic] builds its routes, so the
  // manifest can never advertise a hub that does not exist.
  const posts = await getAllPosts();
  const briefings = await getCollection('news', (b) => b.data.approved);
  const hubSlugs = new Set<string>();
  posts.forEach((p) => p.topics?.forEach((t: string) => hubSlugs.add(topicToSlug(t))));
  eligibleNewsHubTopics(briefings).forEach((t) => hubSlugs.add(topicToSlug(t)));
  const topicLines = [...hubSlugs].filter(Boolean).sort().map((s) => `- ${SITE}/topics/${s}/`).join('\n');

  const counts = {
    apps: apps.length,
    blog: (await getCollection('blog')).length,
    experiments: (await getCollection('experiments')).length,
    stack: (await getCollection('stack')).length,
    news: briefings.length,
  };

  const body = `# gekro.com | AI Engineering Lab

## About
gekro.com is the personal engineering lab and tech blog of Rohit Burani, an AI engineer building real experiments in agentic AI, local-first LLM infrastructure, self-hosted clusters (Raspberry Pi 5, Mac Mini M4), and autonomous trading systems.

Content is technical, honest, and includes full architecture diagrams, runnable code, post-mortems with root-cause analysis, and difficulty ratings. This is a live engineering log, not a marketing site.

## Citation
Content is CC BY 4.0, code is MIT. Citation with a link back to the source URL is expected and welcome.

## Machine-readable manifests
- ${SITE}/llms-full.txt   Per-post long form with author-written aiSummary fields
- ${SITE}/api/posts.json  All posts as structured JSON
- ${SITE}/sitemap-index.xml  Full site structure with per-URL lastmod
- ${SITE}/rss.xml         RSS 2.0 feed
- ${SITE}/news-rss.xml    RSS 2.0 feed for the daily AI briefings

## Technical stack
- Framework: Astro 6 (island architecture, zero-JS default)
- Styling: Tailwind CSS v4
- CMS: Sanity v3 (optional, site builds local-only if env missing)
- Primary content source: Astro Content Collections (markdown + Zod schemas)
- Search: Pagefind (client-side, built at postbuild)
- Hosting: Cloudflare Pages

## Primary navigation
- /              Homepage, latest experiments and recent posts
- /blog          Archive of technical deep dives and engineering notes (${counts.blog})
- /experiments   Detailed case studies: architecture, outcomes, failures (${counts.experiments})
- /apps          Free single-session browser tools (${counts.apps})
- /stack         Verified third-party tool reviews, referral disclosures on each entry (${counts.stack})
- /news          Daily AI industry briefings, neutral, every claim linked to its source (${counts.news})
- /about         Philosophy, mission, and author biography
- /contact       Direct contact form (Turnstile-protected)
- /now           Live snapshot of current engineering focus and hardware status
- /slides        Technical keynotes and architecture presentations
- /topics/[slug] Cluster pages for each topic area

## Apps (${counts.apps} free browser tools)
Every tool runs entirely client-side in a single session. No account, no upload,
no server round-trip: the page is the whole product. Each app has a companion
methodology page explaining exactly how it computes its result.

${appSections}

## Topic clusters
Hubs are derived from post and briefing frontmatter, so each one below is live:

${topicLines}
`;

  return new Response(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
};
