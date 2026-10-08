#!/usr/bin/env node
/**
 * stamp-hash.mjs - write the correct sourceHash into translation files
 *
 * Computes the hash of the current English post (title + description + body,
 * see source-hash.mjs) and writes it into the `sourceHash:` line of each
 * named translation. Run after producing or refreshing a translation.
 *
 * Usage (repo root):
 *   node scripts/i18n/stamp-hash.mjs <lang>/<slug> [<lang>/<slug> ...]
 *   node scripts/i18n/stamp-hash.mjs --all
 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sourceHash, parseFrontmatter } from './source-hash.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const BLOG = join(ROOT, 'apps/web/src/content/blog');
const TR = join(ROOT, 'apps/web/src/translations');

let targets = process.argv.slice(2);
if (targets.includes('--all')) {
  targets = [];
  for (const lang of readdirSync(TR, { withFileTypes: true })) {
    if (!lang.isDirectory()) continue;
    for (const f of readdirSync(join(TR, lang.name))) {
      if (f.endsWith('.md') && !f.startsWith('_')) targets.push(`${lang.name}/${f.replace(/\.md$/, '')}`);
    }
  }
}
if (!targets.length) {
  console.error('usage: stamp-hash.mjs <lang>/<slug> ... | --all');
  process.exit(1);
}

let failed = 0;
for (const id of targets) {
  const [lang, slug] = id.split('/');
  const trPath = join(TR, lang, `${slug}.md`);
  const enPath = join(BLOG, `${slug}.md`);
  if (!existsSync(trPath) || !existsSync(enPath)) {
    console.error(`skip ${id}: missing translation or English original`);
    failed++;
    continue;
  }
  const en = parseFrontmatter(readFileSync(enPath, 'utf8'));
  const hash = sourceHash({ title: en.data.title, description: en.data.description, body: en.body });
  const raw = readFileSync(trPath, 'utf8');
  if (!/^sourceHash:.*$/m.test(raw)) {
    console.error(`skip ${id}: no sourceHash line`);
    failed++;
    continue;
  }
  const next = raw.replace(/^sourceHash:.*$/m, `sourceHash: "${hash}"`);
  if (next !== raw) writeFileSync(trPath, next, 'utf8');
  console.log(`${id}: ${hash.slice(0, 12)}`);
}
process.exit(failed ? 1 : 0);
