#!/usr/bin/env node
/**
 * skeleton.mjs - print an English post as a translation worksheet
 *
 * Shows the translatable frontmatter fields and the body with every fenced code
 * block replaced by a numbered placeholder ({{CODE:1}}, {{CODE:2}}, ...). A
 * translator writes a draft with the same placeholders; assemble.mjs puts the
 * original blocks back byte-for-byte, so code is never retyped.
 *
 * Usage (repo root): node scripts/i18n/skeleton.mjs <slug>
 */
import { readFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseFrontmatter } from './source-hash.mjs';
import { splitFences } from './fences.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const slug = process.argv[2];
if (!slug) {
  console.error('usage: skeleton.mjs <slug>');
  process.exit(1);
}
const { data, body } = parseFrontmatter(readFileSync(join(ROOT, 'apps/web/src/content/blog', `${slug}.md`), 'utf8'));
const { text, blocks } = splitFences(body);

for (const k of ['title', 'description', 'summary', 'tldr', 'aiSummary']) {
  if (data[k]) console.log(`${k}: ${JSON.stringify(data[k])}`);
}
console.log(`(code blocks: ${blocks.length})`);
console.log('=====');
console.log(text.trim());
