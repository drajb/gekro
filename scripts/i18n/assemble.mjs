#!/usr/bin/env node
/**
 * assemble.mjs - turn translated drafts into final translation files
 *
 * A draft is a markdown file with frontmatter holding ONLY the translated text
 * fields (title, description, and summary / tldr / aiSummary if the English post
 * has them) and a body that uses the {{CODE:n}} placeholders printed by
 * skeleton.mjs. This script:
 *   - copies publishedAt, updatedAt, difficulty, topics, readingTime from the
 *     English post verbatim (never hand-typed)
 *   - puts the original code blocks back byte-for-byte
 *   - adds sourceHash, translatedAt, translator, reviewed: false
 *   - writes apps/web/src/translations/<lang>/<slug>.md
 * It then runs verify-i18n for the languages it wrote and exits with its status.
 *
 * Usage (repo root):
 *   node scripts/i18n/assemble.mjs --dir <draftsDir> <slug> [<slug> ...]
 * where <draftsDir>/<lang>/<slug>.md are the drafts.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { parseFrontmatter, sourceHash } from './source-hash.mjs';
import { splitFences, joinFences } from './fences.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const BLOG = join(ROOT, 'apps/web/src/content/blog');
const TR = join(ROOT, 'apps/web/src/translations');
const TRANSLATOR = 'claude-sonnet-5-5';

const args = process.argv.slice(2);
const dirIdx = args.indexOf('--dir');
if (dirIdx < 0 || !args[dirIdx + 1]) {
  console.error('usage: assemble.mjs --dir <draftsDir> <slug> ...');
  process.exit(1);
}
const draftsDir = resolve(args[dirIdx + 1]);
const slugs = args.filter((a, i) => i !== dirIdx && i !== dirIdx + 1);

// Raw frontmatter lines of the English post, so copied fields are byte-identical.
function rawFields(raw) {
  const m = raw.replace(/^﻿/, '').replace(/\r\n/g, '\n').match(/^---\n([\s\S]*?)\n---/);
  const lines = m ? m[1].split('\n') : [];
  const out = {};
  for (const line of lines) {
    const kv = line.match(/^([A-Za-z][A-Za-z0-9_]*):/);
    if (kv) out[kv[1]] = line;
  }
  return out;
}

const today = new Date().toISOString().slice(0, 10);
const written = new Set();
let failed = 0;

for (const slug of slugs) {
  const enRaw = readFileSync(join(BLOG, `${slug}.md`), 'utf8');
  const en = parseFrontmatter(enRaw);
  const raw = rawFields(enRaw);
  const { blocks } = splitFences(en.body);
  const hash = sourceHash({ title: en.data.title, description: en.data.description, body: en.body });

  for (const lang of readdirSync(draftsDir)) {
    const draftPath = join(draftsDir, lang, `${slug}.md`);
    if (!existsSync(draftPath)) continue;
    const d = parseFrontmatter(readFileSync(draftPath, 'utf8'));
    try {
      for (const k of ['title', 'description']) if (!d.data[k]) throw new Error(`draft is missing "${k}"`);
      for (const k of ['summary', 'tldr', 'aiSummary']) {
        if (en.data[k] && !d.data[k]) throw new Error(`English has "${k}" but the draft does not`);
        if (!en.data[k] && d.data[k]) throw new Error(`draft has "${k}" but English does not`);
      }
      const body = joinFences(d.body.trim(), blocks);
      const fm = ['---'];
      fm.push(`title: ${JSON.stringify(d.data.title)}`);
      fm.push(`description: ${JSON.stringify(d.data.description)}`);
      if (d.data.summary) fm.push(`summary: ${JSON.stringify(d.data.summary)}`);
      for (const k of ['publishedAt', 'updatedAt', 'difficulty', 'topics', 'readingTime']) if (raw[k]) fm.push(raw[k]);
      if (d.data.tldr) fm.push(`tldr: ${JSON.stringify(d.data.tldr)}`);
      if (d.data.aiSummary) fm.push(`aiSummary: ${JSON.stringify(d.data.aiSummary)}`);
      fm.push(`sourceHash: "${hash}"`);
      fm.push(`translatedAt: "${today}"`);
      fm.push(`translator: "${TRANSLATOR}"`);
      fm.push('reviewed: false');
      fm.push('---');
      const outDir = join(TR, lang);
      mkdirSync(outDir, { recursive: true });
      writeFileSync(join(outDir, `${slug}.md`), `${fm.join('\n')}\n\n${body}\n`, 'utf8');
      written.add(lang);
      console.log(`wrote ${lang}/${slug}`);
    } catch (e) {
      failed++;
      console.error(`FAILED ${lang}/${slug}: ${e.message}`);
    }
  }
}

if (written.size) {
  for (const lang of written) {
    const r = spawnSync(process.execPath, [join(ROOT, 'scripts/verify-i18n.mjs'), '--lang', lang], { encoding: 'utf8' });
    const lines = (r.stdout + r.stderr).split('\n').filter((l) => l.includes('[verify-i18n]'));
    // Only report problems in the slugs just assembled
    // Report only problems in the slugs just assembled (errors and warnings)
    for (const l of lines) if ((l.includes('ERROR') || (l.includes('warn') && !l.includes('characters; limit'))) && slugs.some((s) => l.includes(`/${s}.md`))) console.log(l);
    if (r.status !== 0) failed++;
  }
}
process.exit(failed ? 1 : 0);
