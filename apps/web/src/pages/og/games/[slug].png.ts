/**
 * og/games/[slug].png.ts — Per-game Open Graph image endpoint
 *
 * Same card as og/apps/[slug].png.ts, for the games registered in
 * lib/utils/games.ts. The eyebrow is the game's genre.
 */

import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { renderOgCard } from '../../../lib/og/render';
import { GAME_GENRE, GENRES, isGame } from '../../../lib/utils/games';

export async function getStaticPaths() {
  const apps = await getCollection('apps', ({ id }) => isGame(id));
  return apps.map(app => ({
    params: { slug: app.id },
    props: {
      title: app.data.title,
      date: app.data.publishedAt,
      eyebrow: `Free Game - ${GENRES[GAME_GENRE[app.id]].label}`,
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
