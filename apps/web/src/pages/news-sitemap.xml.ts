/**
 * news-sitemap.xml.ts — Google News sitemap (GET /news-sitemap.xml)
 *
 * Google News (2026) is fully automated — no Publisher Center submission. The
 * key technical lever is a dedicated news sitemap using the <news:news>
 * namespace, listing ONLY articles from the last 48 hours. Older URLs must drop
 * out (Google ignores / penalises stale news sitemaps), so we filter by date at
 * build time. Auto-publish triggers a deploy each day, which regenerates this.
 *
 * Pairs with: NewsArticle JSON-LD on each briefing (publisher = Organization,
 * per Google's requirement) and the standard sitemap-index.
 *
 * Referenced from robots.txt so crawlers discover it.
 */

import { getCollection } from 'astro:content';
import { newsPublishedISO } from '../lib/utils/news-dates';

const SITE = 'https://gekro.com';

const escapeXml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
   .replace(/"/g, '&quot;').replace(/'/g, '&apos;');

export async function GET() {
  const all = await getCollection('news', b => b.data.approved);

  // Google News: include only articles published in the last 48 hours.
  // Window is measured from the real publish instant (see news-dates.ts), not a
  // midday guess, so an article ages out ~48h after it actually shipped.
  const cutoff = Date.now() - 48 * 60 * 60 * 1000;
  const recent = all
    .filter(n => new Date(newsPublishedISO(n.data)).getTime() >= cutoff)
    .sort((a, b) => b.data.publishedAt.localeCompare(a.data.publishedAt));

  const urls = recent.map(n => `  <url>
    <loc>${SITE}/news/${n.id}/</loc>
    <news:news>
      <news:publication>
        <news:name>gekro</news:name>
        <news:language>en</news:language>
      </news:publication>
      <news:publication_date>${newsPublishedISO(n.data)}</news:publication_date>
      <news:title>${escapeXml(n.data.title)}</news:title>
    </news:news>
  </url>`).join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">
${urls}
</urlset>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      // Short TTL — this list rolls over daily as articles age past 48h
      'Cache-Control': 'public, max-age=600, s-maxage=1800',
    },
  });
}
