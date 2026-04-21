/**
 * og/blog/[slug].png.ts — Per-post Open Graph image endpoint
 *
 * Static generation: getStaticPaths() emits one endpoint per blog post
 * in the local Content Collection. Sanity posts are not included — the
 * OG image path for Sanity posts would need to be resolved at the Sanity
 * side, and mixing the two would risk slug collisions.
 *
 * Image is 1200×630 PNG rendered via sharp + SVG — see lib/og/render.ts
 * for the template.
 *
 * Why this exists:
 *  Every BlogPosting references an og:image. When a post doesn't define
 *  `mainImage` in its frontmatter, BlogLayout falls back to
 *  /og/blog/<slug>.png (this endpoint). Having a branded, title-imprinted
 *  card gives social-preview cards a consistent, recognisable look even
 *  for posts without a hero illustration.
 */

import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { renderOgCard } from '../../../lib/og/render';

export async function getStaticPaths() {
  const posts = await getCollection('blog');
  return posts.map(post => ({
    params: { slug: post.slug },
    props: {
      title: post.data.title,
      date: post.data.publishedAt,
      // Use the primary topic as the eyebrow label when present — it makes
      // the card visually categorise itself at a glance in a social feed.
      eyebrow: post.data.topics?.[0] ?? 'Blog Post',
    },
  }));
}

export const GET: APIRoute = async ({ props }) => {
  const { title, date, eyebrow } = props as { title: string; date: string; eyebrow: string };
  const buffer = await renderOgCard({ title, date, eyebrow });
  return new Response(buffer as unknown as BodyInit, {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
};
