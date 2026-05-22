/**
 * og/stack/[slug].png.ts — Per-stack-entry Open Graph image endpoint
 *
 * Mirrors og/blog/[slug].png.ts. Every /stack/<slug>/ entry gets a branded
 * 1200×630 social card with the tool name as the title and a category-driven
 * eyebrow label. Lets stack entries share well to LinkedIn / X / Mastodon
 * without using the generic site OG image.
 *
 * StackLayout reads `/og/stack/${slug}.png` and absolutises in SEOHead.
 */

import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { renderOgCard } from '../../../lib/og/render';

export async function getStaticPaths() {
  const entries = await getCollection('stack');
  return entries.map(entry => ({
    params: { slug: entry.slug },
    props: {
      title: entry.data.name,
      date: entry.data.lastVerified,
      // Eyebrow: pretty-printed category, e.g. "llm-client" → "LLM CLIENT".
      // Capitalises the badge so it reads as a category label in the card.
      eyebrow: entry.data.category.replace(/-/g, ' ').toUpperCase(),
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
