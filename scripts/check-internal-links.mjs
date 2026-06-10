#!/usr/bin/env node
/**
 * check-internal-links.mjs — redirect-hygiene guard (runs in postbuild)
 *
 * Fails the build if any internal link to a top-level section omits its
 * trailing slash, e.g. href="/blog" instead of href="/blog/". Cloudflare Pages
 * 308-redirects the slashless form to the canonical /blog/, which surfaces in
 * Google Search Console as "Page with redirect" and wastes crawl budget
 * (this guard exists because that happened — see the 2026-06 SEO fix).
 *
 * It scans the BUILT output (dist), not source, so it catches links rendered
 * from arrays / JS (e.g. the Header navItems list), not just literal markup.
 *
 * Run from apps/web (the postbuild cwd):
 *   node ../../scripts/check-internal-links.mjs [distDir=dist]
 */

import { readdir, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const DIST = resolve(process.argv[2] || 'dist');

// Top-level routes that resolve to a /<route>/ directory page. A bare
// href="/<route>" 308-redirects to the slash form. File routes (/rss.xml,
// /llms.txt, /og/*.png, /api/posts.json) correctly have no trailing slash and
// are intentionally NOT listed here.
const ROUTES = ['blog', 'apps', 'stack', 'news', 'experiments', 'about', 'contact', 'now', 'slides'];
// Also catch slashless links that carry a fragment or query (href="/blog#x",
// href="/blog?x") — those 308 too. A trailing slash (href="/blog/...") is fine.
const RE = new RegExp(`href="/(${ROUTES.join('|')})(["#?])`, 'g');

async function* htmlFiles(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) yield* htmlFiles(p);
    else if (entry.name.endsWith('.html')) yield p;
  }
}

let violations = 0;
const offenders = [];
for await (const file of htmlFiles(DIST)) {
  const html = await readFile(file, 'utf-8');
  const hits = [...html.matchAll(RE)].map(m => m[0]);
  if (hits.length) {
    violations += hits.length;
    offenders.push(`${file.replace(DIST, 'dist')}: ${[...new Set(hits)].join(', ')}`);
  }
}

if (violations) {
  console.error(`\n[link-guard] FAIL: ${violations} internal section link(s) missing a trailing slash:`);
  for (const o of offenders.slice(0, 20)) console.error(`  - ${o}`);
  if (offenders.length > 20) console.error(`  ...and ${offenders.length - 20} more files`);
  console.error(`\nUse the canonical slash form (href="/blog/", not href="/blog"). The slashless form 308-redirects and shows up in GSC as "Page with redirect".\n`);
  process.exit(1);
}

console.log('[link-guard] OK: all internal section links use the canonical trailing-slash form');
