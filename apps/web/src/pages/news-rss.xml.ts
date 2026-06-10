/**
 * /news-rss.xml — RSS feed for the AI news briefings section
 */
import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import type { APIContext } from 'astro';

export async function GET(context: APIContext) {
  const briefings = (await getCollection('news', b => b.data.approved))
    .sort((a, b) => b.data.publishedAt.localeCompare(a.data.publishedAt));

  return rss({
    title: 'gekro.com — AI News Briefings',
    description: 'Daily AI industry signal from Rohit Burani. No hype, no VC press releases. Curated from vetted sources for engineers.',
    site: context.site ?? 'https://gekro.com',
    xmlns: { atom: 'http://www.w3.org/2005/Atom' },
    items: briefings.map(b => ({
      title: b.data.title,
      pubDate: new Date(b.data.publishedAt + 'T07:00:00Z'),
      description: b.data.summary,
      link: `/news/${b.id}/`,
      categories: b.data.topics,
    })),
    customData: '<language>en-us</language><atom:link href="https://gekro.com/news-rss.xml" rel="self" type="application/rss+xml"/>',
  });
}
