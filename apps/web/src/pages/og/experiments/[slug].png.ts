/**
 * og/experiments/[slug].png.ts — Per-experiment Open Graph image endpoint
 *
 * Mirror of og/blog/[slug].png.ts but for the experiments collection.
 * Eyebrow defaults to "Experiment" and falls through to the first topic
 * when present. Date uses `startDate` since experiments don't have a
 * `publishedAt` field.
 */

import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { renderOgCard } from '../../../lib/og/render';

export async function getStaticPaths() {
  const experiments = await getCollection('experiments');
  return experiments.map(exp => ({
    params: { slug: exp.slug },
    props: {
      title: exp.data.title,
      date: exp.data.startDate,
      eyebrow: exp.data.topics?.[0] ?? 'Experiment',
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
