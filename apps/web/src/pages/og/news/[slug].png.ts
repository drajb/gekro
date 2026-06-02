/**
 * og/news/[slug].png.ts — Per-briefing Open Graph image endpoint
 *
 * Mirrors og/stack/[slug].png.ts. Every approved /news/<slug>/ briefing gets a
 * branded 1200×630 social card with the headline as the title and an "AI NEWS"
 * eyebrow, so daily briefings share with a distinct card instead of the generic
 * site OG image. news/[slug].astro reads `/og/news/${slug}.png`.
 */

import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { renderOgCard } from '../../../lib/og/render';

export async function getStaticPaths() {
  const briefings = await getCollection('news', b => b.data.approved);
  return briefings.map(b => ({
    params: { slug: b.id },
    props: {
      title: b.data.title,
      date: b.data.publishedAt,
      eyebrow: 'AI NEWS',
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
