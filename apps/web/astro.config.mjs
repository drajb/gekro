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
 * Sitemap:
 *  @astrojs/sitemap generates /sitemap-index.xml + /sitemap-0.xml at build time.
 *  The filter() hook excludes /og/ prerendered images and /api/ JSON endpoints.
 *  The serialize() hook sets per-URL lastmod from frontmatter dates (via lastmodMap)
 *  and assigns priority tiers: homepage (1.0), archives (0.9), posts (0.8),
 *  apps (0.7), topics (0.6), static pages (0.5).
 */

import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// ── Build a URL → lastmod map by scanning Content Collections at config load.
// Why here: @astrojs/sitemap's `serialize` hook needs sync access to dates,
// and it runs before Astro's content-collection runtime is warmed. Parsing
// frontmatter directly is cheap (≈15 files) and avoids pulling gray-matter.
//
// Extracted fields:
//   blog:        publishedAt  → lastmod
//   experiments: endDate OR startDate → lastmod (endDate wins if present)
//
// Anything not in the map falls back to file mtime (handled in serialize).
const __dirname = dirname(fileURLToPath(import.meta.url));
const lastmodMap = new Map();

const extractFrontmatterField = (raw, field) => {
  // Frontmatter lives between the first two `---` lines. Match `field: value`
  // with optional quotes. Dates are YYYY-MM-DD; we don't need to handle every
  // YAML edge case — just the two fields we care about.
  const fm = raw.match(/^---\n([\s\S]*?)\n---/);
  if (!fm) return null;
  const line = fm[1].split('\n').find(l => l.trim().startsWith(`${field}:`));
  if (!line) return null;
  return line.replace(`${field}:`, '').trim().replace(/^['"]|['"]$/g, '');
};

const scanCollection = (collectionDir, urlPrefix, dateFields) => {
  try {
    for (const entry of readdirSync(collectionDir)) {
      if (entry.startsWith('_') || !entry.endsWith('.md')) continue;
      const slug = entry.replace(/\.md$/, '');
      const filePath = join(collectionDir, entry);
      const raw = readFileSync(filePath, 'utf8');
      let date = null;
      for (const field of dateFields) {
        const v = extractFrontmatterField(raw, field);
        if (v) { date = v; break; }
      }
      // Fallback to file mtime if no frontmatter date was found
      if (!date) date = statSync(filePath).mtime.toISOString().slice(0, 10);
      lastmodMap.set(`https://gekro.com${urlPrefix}${slug}/`, date);
    }
  } catch { /* collection dir missing — silent skip for fresh forks */ }
};

scanCollection(join(__dirname, 'src/content/blog'), '/blog/', ['publishedAt']);
scanCollection(join(__dirname, 'src/content/experiments'), '/experiments/', ['endDate', 'startDate']);
scanCollection(join(__dirname, 'src/content/apps'), '/apps/', ['publishedAt', 'updatedAt']);

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
      // Per-URL lastmod + priority hints. Google ignores priority in practice,
      // but lastmod is honoured — it's the single most valuable sitemap signal
      // for "re-crawl this". Homepage + archives get daily, posts get monthly.
      filter(page) {
        // Exclude build artefacts and API routes from the sitemap
        return !page.includes('/og/') && !page.includes('/api/');
      },
      serialize(item) {
        const mapped = lastmodMap.get(item.url);
        if (mapped) item.lastmod = mapped;

        if (item.url === 'https://gekro.com/') {
          item.priority = 1.0;
          item.changefreq = 'weekly';
        } else if (
          item.url === 'https://gekro.com/blog/' ||
          item.url === 'https://gekro.com/experiments/' ||
          item.url === 'https://gekro.com/apps/'
        ) {
          item.priority = 0.9;
          item.changefreq = 'weekly';
        } else if (item.url.includes('/blog/') || item.url.includes('/experiments/')) {
          item.priority = 0.8;
          item.changefreq = 'monthly';
        } else if (item.url.includes('/apps/')) {
          item.priority = 0.7;
          item.changefreq = 'monthly';
        } else if (item.url.includes('/topics/')) {
          item.priority = 0.6;
          item.changefreq = 'monthly';
        } else {
          item.priority = 0.5;
          item.changefreq = 'monthly';
        }
        return item;
      },
    })
  ],
  vite: {
    plugins: [tailwindcss()],
    optimizeDeps: {
      include: ['qr-code-styling'],
    },
  },
});
