/**
 * astro.config.mjs — Astro site configuration
 *
 * Site: https://gekro.com (used for canonical URLs, sitemap, RSS)
 *
 * Integrations:
 *  sanity (conditional) — loaded only when PUBLIC_SANITY_PROJECT_ID is set.
 *    Dynamic import avoids a hard dependency on @sanity/astro for local builds.
 *    Without it, the site builds cleanly using only local Content Collections.
 *  sitemap — generates /sitemap.xml at build time (auto-discovers all pages)
 *
 * Vite plugins:
 *  @tailwindcss/vite — Tailwind v4 Vite plugin (replaces postcss config).
 *    Processing happens in Vite's transform pipeline, not PostCSS.
 *
 * Image domains:
 *  deepwiki.com is whitelisted so Astro's <Image> component can optimise
 *  the DeepWiki badge loaded from their CDN in Footer.astro.
 */

import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';

// Sanity integration is conditional — site works local-only without it
const sanityIntegration = [];
if (process.env.PUBLIC_SANITY_PROJECT_ID) {
  const sanity = (await import('@sanity/astro')).default;
  sanityIntegration.push(
    sanity({
      projectId: process.env.PUBLIC_SANITY_PROJECT_ID,
      dataset: process.env.PUBLIC_SANITY_DATASET || 'production',
      useCdn: false,
      apiVersion: '2024-03-22',
    })
  );
}

export default defineConfig({
  site: 'https://gekro.com',
  integrations: [
    ...sanityIntegration,
    sitemap({
      site: 'https://gekro.com'
    })
  ],
  image: {
    domains: ['deepwiki.com'],
  },
  vite: {
    plugins: [tailwindcss()],
  },
});
