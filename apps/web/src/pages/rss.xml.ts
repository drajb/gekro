/**
 * rss.xml.ts — RSS feed endpoint (GET /rss.xml)
 *
 * Generates an RSS 2.0 feed for all local blog posts, sorted newest-first.
 *
 * Data source:
 *  Local Content Collections only (getCollection('blog')).
 *  Sanity posts are intentionally excluded from the RSS feed because the
 *  feed is consumed by external RSS readers that expect stable, canonical
 *  URLs — Sanity slugs and local slugs can collide if both are included.
 *
 * Description priority:
 *  aiSummary → tldr → description
 *  aiSummary is optimised for AI readers/crawlers (GEO); tldr is the
 *  human-readable summary; description is the shortest fallback.
 *  Previously only used `description`, which is the least informative field.
 *
 * Site URL:
 *  Derived from context.site (set in astro.config.mjs) with a fallback to
 *  the production URL. The fallback ensures the feed is valid if context.site
 *  is not configured in a fork/local-only build.
 */

import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import type { APIContext } from 'astro';

export async function GET(context: APIContext) {
  // Local posts only — see header comment for why Sanity is excluded here
  const posts = await getCollection('blog');

  // Sort newest-first so RSS readers show the latest post at the top
  const sortedPosts = posts.sort(
    (a, b) => new Date(b.data.publishedAt).getTime() - new Date(a.data.publishedAt).getTime()
  );

  return rss({
    title: 'gekro | AI Engineering Lab',
    description: "Personal engineering lab by Rohit. Deep dives into agentic AI, self-hosting, and building at the edge.",
    // context.site is set in astro.config.mjs; fallback to prod URL for safety
    site: context.site ?? 'https://gekro.com',
    items: sortedPosts.map(post => ({
      title: post.data.title,
      pubDate: new Date(post.data.publishedAt),
      // Description priority: aiSummary (AI-optimised) → tldr → description
      description: post.data.aiSummary || post.data.tldr || post.data.description,
      link: `/blog/${post.slug}`,
      categories: post.data.topics,
    })),
    customData: `<language>en-us</language>`,
  });
}
