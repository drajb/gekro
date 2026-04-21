/**
 * og/apps/[slug].png.ts — Per-app Open Graph image endpoint
 *
 * Mirror of og/blog/[slug].png.ts but for the apps collection.
 * Eyebrow uses the app category label. Date uses publishedAt.
 * Ensures every app page has a unique branded social-preview card
 * rather than falling back to the generic /og/default.png.
 */

import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { renderOgCard } from '../../../lib/og/render';

const CATEGORY_LABELS: Record<string, string> = {
  ai: 'AI Tool',
  finance: 'Finance Tool',
  trading: 'Trading Tool',
  dev: 'Dev Tool',
  ev: 'EV Tool',
  infra: 'Infra Tool',
  fun: 'Fun Tool',
  health: 'Health Tool',
};

export async function getStaticPaths() {
  const apps = await getCollection('apps');
  return apps.map(app => ({
    params: { slug: app.slug },
    props: {
      title: app.data.title,
      date: app.data.publishedAt,
      eyebrow: CATEGORY_LABELS[app.data.category] ?? 'App',
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
