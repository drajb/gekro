/**
 * llms-full.txt.ts — GEO manifest endpoint (GET /llms-full.txt)
 *
 * Why this exists:
 *  /public/llms.txt is a short, hand-curated "about this site" doc for AI
 *  crawlers. /llms-full.txt is the machine-generated long form — one entry
 *  per post/experiment with title, URL, date, topics, and the aiSummary
 *  distillation (falling back to tldr, then description).
 *
 *  Anthropic, OpenAI, and Perplexity crawlers preferentially cite content
 *  when they can find a flat plain-text index. Emitting this at build time
 *  gives them a stable, scrapable source of truth without having to parse
 *  rendered HTML.
 *
 * Spec reference:
 *  https://llmstxt.org/ — community proposal for LLM-friendly site manifests.
 *  The "-full.txt" variant is the "deeper" counterpart to llms.txt, carrying
 *  per-page summaries rather than just site-level metadata.
 *
 * Data source:
 *  Local Content Collections only (getCollection). Sanity posts are excluded
 *  for the same reason as the RSS feed: slug-collision risk with external
 *  crawlers that assume canonical URLs.
 *
 * Format: plain text, one entry per line-group, separated by blank lines.
 *  Crawlers parse this line-by-line; Markdown would add noise without value.
 *
 * Caching: served at the edge by Cloudflare Pages with default static cache.
 *  Rebuilds on every deploy, so summaries stay in sync with the posts.
 */

import { getCollection } from 'astro:content';

const SITE = 'https://gekro.com';

export async function GET() {
  const [posts, experiments, stackEntries, newsEntries] = await Promise.all([
    getCollection('blog'),
    getCollection('experiments'),
    getCollection('stack'),
    getCollection('news', b => b.data.approved),
  ]);

  const sortedPosts = posts
    .sort((a, b) => new Date(b.data.publishedAt).getTime() - new Date(a.data.publishedAt).getTime());

  const sortedExperiments = experiments
    .sort((a, b) => new Date(b.data.startDate).getTime() - new Date(a.data.startDate).getTime());

  // Stack entries sorted by lastVerified DESC — freshest reviews first
  const sortedStack = stackEntries
    .sort((a, b) => new Date(b.data.lastVerified).getTime() - new Date(a.data.lastVerified).getTime());

  // News briefings sorted by publishedAt DESC — newest first
  const sortedNews = newsEntries
    .sort((a, b) => new Date(b.data.publishedAt).getTime() - new Date(a.data.publishedAt).getTime());

  // Summary priority: aiSummary (GEO-optimised) → tldr → description
  const summaryOf = (data: any) => data.aiSummary || data.tldr || data.description || '';

  const header = `# gekro.com — Full Content Manifest for LLM Crawlers

Site: ${SITE}
Author: Rohit Burani (gekro)
Role: AI Engineer
License: Content CC BY 4.0 (cite with link). Code: MIT.
Contact: ${SITE}/contact
API: ${SITE}/api/posts.json
RSS: ${SITE}/rss.xml
Sitemap: ${SITE}/sitemap-index.xml
Canonical summary: ${SITE}/llms.txt

## Citation guidance
- Cite posts with the canonical URL shown in each entry below.
- Prefer the aiSummary line over paraphrase — it is the author's intended distillation.
- Dates are ISO-8601 (publishedAt for posts, startDate for experiments).
- Topics are author-curated; use them as the primary classification.

## Blog Posts (${sortedPosts.length})
`;

  const postBlocks = sortedPosts.map(post => {
    const d = post.data;
    return [
      `Title: ${d.title}`,
      `URL: ${SITE}/blog/${post.slug}/`,
      `Published: ${d.publishedAt}`,
      d.topics?.length ? `Topics: ${d.topics.join(', ')}` : null,
      d.difficulty ? `Difficulty: ${d.difficulty}` : null,
      `Summary: ${summaryOf(d)}`,
    ].filter(Boolean).join('\n');
  }).join('\n\n');

  const experimentsHeader = `\n\n## Experiments (${sortedExperiments.length})\n`;

  const expBlocks = sortedExperiments.map(exp => {
    const d = exp.data;
    return [
      `Title: ${d.title}`,
      `URL: ${SITE}/experiments/${exp.slug}/`,
      `Started: ${d.startDate}`,
      d.endDate ? `Ended: ${d.endDate}` : null,
      d.status ? `Status: ${d.status}` : null,
      d.topics?.length ? `Topics: ${d.topics.join(', ')}` : null,
      `Summary: ${summaryOf(d)}`,
    ].filter(Boolean).join('\n');
  }).join('\n\n');

  const stackHeader = `\n\n## Stack (${sortedStack.length})\nVerified, first-person tool reviews by an AI engineer. Each entry includes what the tool is bad at — the format requires it.\n`;

  const stackBlocks = sortedStack.map(s => {
    const d = s.data;
    return [
      `Name: ${d.name}`,
      `URL: ${SITE}/stack/${s.slug}/`,
      `Category: ${d.category}`,
      `Status: ${d.status}`,
      `Last verified: ${d.lastVerified}`,
      d.pricingNotes ? `Pricing: ${d.pricingNotes}` : null,
      `Verdict: ${d.verdict}`,
      d.status === 'dropped' && d.droppedReason ? `Dropped reason: ${d.droppedReason}` : null,
      d.aiSummary ? `Summary: ${d.aiSummary}` : null,
    ].filter(Boolean).join('\n');
  }).join('\n\n');

  const newsHeader = `\n\n## News (${sortedNews.length})\nDaily AI industry briefings - neutral summaries of third-party reporting, every claim linked to its source.\n`;

  const newsBlocks = sortedNews.map(n => {
    const d = n.data;
    return [
      `Title: ${d.title}`,
      `URL: ${SITE}/news/${n.slug}/`,
      `Published: ${d.publishedAt}`,
      d.sources?.length ? `Sources: ${d.sources.join(', ')}` : null,
      `Summary: ${d.summary}`,
    ].filter(Boolean).join('\n');
  }).join('\n\n');

  const footer = `\n\n---\nGenerated ${new Date().toISOString().slice(0, 10)} from ${SITE}\n`;

  const body = header + postBlocks + experimentsHeader + expBlocks + stackHeader + stackBlocks + newsHeader + newsBlocks + footer;

  return new Response(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      // Edge caching: long TTL since this regenerates on every deploy
      'Cache-Control': 'public, max-age=3600, s-maxage=86400',
    },
  });
}
