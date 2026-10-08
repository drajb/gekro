#!/usr/bin/env node
/**
 * verify-i18n.mjs - deterministic integrity checks for blog translations
 *
 * Source checks (always): every file in apps/web/src/translations/<lang>/<slug>.md
 * is compared with its English original in apps/web/src/content/blog/<slug>.md.
 * A translation may change words, never facts or structure.
 *
 * Build checks (--dist <dir>): reads the built HTML and verifies <html lang/dir>,
 * canonical, og:locale and hreflang reciprocity for every translated page, and
 * that English pages WITHOUT translations carry no hreflang at all.
 *
 * Errors fail the run (exit 1). Warnings are printed; --strict promotes the
 * staleness warning (English changed after the translation) to an error.
 *
 * Usage (repo root):
 *   node scripts/verify-i18n.mjs [--strict] [--lang hi] [--dist apps/web/dist]
 * Usage (postbuild, cwd apps/web):
 *   node ../../scripts/verify-i18n.mjs --dist dist
 */

import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sourceHash, parseFrontmatter } from './i18n/source-hash.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const WEB = join(ROOT, 'apps/web');
const BLOG_DIR = join(WEB, 'src/content/blog');
const TR_DIR = join(WEB, 'src/translations');

const args = process.argv.slice(2);
const STRICT = args.includes('--strict');
const onlyLang = args.includes('--lang') ? args[args.indexOf('--lang') + 1] : null;
const distArg = args.includes('--dist') ? args[args.indexOf('--dist') + 1] : null;

const errors = [];
const warnings = [];
const err = (file, msg) => errors.push(`${file}: ${msg}`);
const warn = (file, msg) => warnings.push(`${file}: ${msg}`);

// ── Registry (parsed from the TypeScript source so there is one definition) ──
const registrySrc = readFileSync(join(WEB, 'src/lib/languages.ts'), 'utf8');
const REGISTRY = new Map();
for (const m of registrySrc.matchAll(/\{ code: '([a-z]{2})'[^}]*?bcp47: '([A-Za-z-]+)'[^}]*?dir: '(ltr|rtl)'[^}]*?titleMax: (\d+) \}/g)) {
  REGISTRY.set(m[1], { bcp47: m[2], dir: m[3], titleMax: Number(m[4]) });
}
const ogLocaleOf = new Map(
  [...registrySrc.matchAll(/\{ code: '([a-z]{2})'[^}]*?ogLocale: '([A-Za-z_]+)'/g)].map((m) => [m[1], m[2]])
);
if (REGISTRY.size === 0) {
  console.error('[verify-i18n] could not read the language registry');
  process.exit(1);
}

// ── Helpers ─────────────────────────────────────────────────────────────────
const FENCE_RE = /^(```|~~~)[^\n]*\n[\s\S]*?\n\1[ \t]*$/gm;

function fencedBlocks(body) {
  return [...body.matchAll(FENCE_RE)].map((m) => m[0]);
}
function stripFences(body) {
  return body.replace(FENCE_RE, '\n');
}
function inlineCode(body) {
  return [...stripFences(body).matchAll(/`[^`\n]+`/g)].map((m) => m[0]).sort();
}
function proseOnly(body) {
  return stripFences(body)
    .replace(/`[^`\n]+`/g, ' ')
    .replace(/\]\((?:[^)\s]+)\)/g, '] ')
    .replace(/https?:\/\/[^\s)>\]]+/g, ' ')
    .replace(/<\/?[A-Za-z][^>]*>/g, ' ');
}
function links(body) {
  const text = stripFences(body);
  const hrefs = [...text.matchAll(/\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)].map((m) => m[1]);
  // A bare URL ends at whitespace, a backtick, a closing bracket or any non-ASCII
  // character (CJK full-width punctuation often follows a URL directly).
  const bare = [...text.matchAll(/(?<![("'=])https?:\/\/[^\s\u0080-￿`)<>\]"]+/g)].map((m) => m[0]);
  const all = [...hrefs, ...bare].map((h) => h.replace(/[.,;:]+$/, ''));
  return {
    external: [...new Set(all.filter((h) => /^https?:\/\//.test(h)))].sort(),
    internal: [...new Set(all.filter((h) => h.startsWith('/')))].sort(),
  };
}
function structure(body) {
  const text = stripFences(body).replace(/\r\n/g, '\n');
  const lines = text.split('\n');
  const s = { headings: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 }, listItems: 0, tableRows: 0, paragraphs: 0, tldr: 0, fences: fencedBlocks(body).length };
  let para = false;
  for (const line of lines) {
    const h = line.match(/^(#{1,6})\s+\S/);
    if (h) { s.headings[h[1].length]++; para = false; continue; }
    if (/^\s*([-*+]|\d+[.)])\s+/.test(line)) { s.listItems++; para = false; continue; }
    if (/^\s*\|/.test(line)) { s.tableRows++; para = false; continue; }
    if (line.trim() === '') { para = false; continue; }
    if (/^\s*<\/?TLDR>/.test(line)) { if (/<TLDR>/.test(line)) s.tldr++; para = false; continue; }
    if (!para) { s.paragraphs++; para = true; }
  }
  return s;
}
function digitTokens(body) {
  const prose = proseOnly(body);
  // Compare digits only: 1.5 vs 1,5 and 4,500 vs 4500 are the same number.
  return [...prose.matchAll(/\d[\d.,]*\d|\d/g)].map((m) => m[0].replace(/\D/g, '')).filter(Boolean);
}
const counts = (arr) => arr.reduce((m, x) => m.set(x, (m.get(x) || 0) + 1), new Map());

function listMd(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => f.endsWith('.md') && !f.startsWith('_'));
}

// ── Source checks ───────────────────────────────────────────────────────────
const englishSlugs = new Set(listMd(BLOG_DIR).map((f) => f.replace(/\.md$/, '')));
for (const slug of englishSlugs) {
  if (REGISTRY.has(slug)) err(`content/blog/${slug}.md`, 'English slug equals a language code and would collide with /blog/<lang>/');
}

const translationFiles = []; // { lang, slug, path, rel }
if (existsSync(TR_DIR)) {
  for (const entry of readdirSync(TR_DIR)) {
    const p = join(TR_DIR, entry);
    if (entry.startsWith('_') || entry.startsWith('.')) continue;
    if (!statSync(p).isDirectory()) { err(`translations/${entry}`, 'stray file; translations must be in <lang>/<slug>.md'); continue; }
    if (!REGISTRY.has(entry)) { err(`translations/${entry}/`, 'folder is not a registered language'); continue; }
    for (const f of listMd(p)) translationFiles.push({ lang: entry, slug: f.replace(/\.md$/, ''), path: join(p, f), rel: `translations/${entry}/${f}` });
    for (const f of readdirSync(p)) if (!f.endsWith('.md') && !f.startsWith('_')) warn(`translations/${entry}/${f}`, 'non-markdown file ignored by the collection');
  }
}

let checked = 0;
let stale = 0;
const translated = new Map(); // lang -> Set(slug)
for (const t of translationFiles) {
  if (onlyLang && t.lang !== onlyLang) continue;
  checked++;
  if (!translated.has(t.lang)) translated.set(t.lang, new Set());
  translated.get(t.lang).add(t.slug);
}

for (const t of translationFiles) {
  if (onlyLang && t.lang !== onlyLang) continue;
  const reg = REGISTRY.get(t.lang);
  const enPath = join(BLOG_DIR, `${t.slug}.md`);
  if (!existsSync(enPath)) { err(t.rel, `orphan: no English original content/blog/${t.slug}.md`); continue; }

  const tr = parseFrontmatter(readFileSync(t.path, 'utf8'));
  const en = parseFrontmatter(readFileSync(enPath, 'utf8'));

  // Frontmatter contract
  if ('mainImage' in tr.data) err(t.rel, 'translations must not set mainImage (the English image is reused)');
  for (const k of ['title', 'description', 'sourceHash', 'translatedAt', 'translator']) {
    if (!tr.data[k]) err(t.rel, `missing frontmatter field "${k}"`);
  }
  for (const k of ['publishedAt', 'updatedAt', 'difficulty', 'readingTime', 'topics']) {
    if (JSON.stringify(tr.data[k] ?? null) !== JSON.stringify(en.data[k] ?? null)) {
      err(t.rel, `"${k}" must be copied from the English post (English: ${JSON.stringify(en.data[k])}, translation: ${JSON.stringify(tr.data[k])})`);
    }
  }
  // Optional translated fields exist in translation only if English has them
  for (const k of ['summary', 'tldr', 'aiSummary']) {
    if (tr.data[k] && !en.data[k]) warn(t.rel, `has "${k}" but the English post does not`);
    if (!tr.data[k] && en.data[k]) warn(t.rel, `English has "${k}" but the translation does not`);
  }

  // Staleness
  const expected = sourceHash({ title: en.data.title, description: en.data.description, body: en.body });
  if (tr.data.sourceHash && tr.data.sourceHash !== expected) {
    stale++;
    (STRICT ? err : warn)(t.rel, 'stale: the English post changed after this translation was made');
  }

  // Dashes
  const wholeFile = readFileSync(t.path, 'utf8');
  if (wholeFile.includes('—')) err(t.rel, 'contains an em-dash (U+2014); the site bans them (a Chinese "——" counts)');

  // Code must be byte-identical
  const enFences = fencedBlocks(en.body), trFences = fencedBlocks(tr.body);
  if (enFences.length !== trFences.length || enFences.some((b, i) => b !== trFences[i])) err(t.rel, 'fenced code blocks differ from the English original');
  const enInline = inlineCode(en.body), trInline = inlineCode(tr.body);
  if (JSON.stringify(enInline) !== JSON.stringify(trInline)) {
    const e = counts(enInline), r = counts(trInline);
    const missing = [...e].filter(([k, n]) => (r.get(k) || 0) < n).map(([k]) => k);
    const extra = [...r].filter(([k, n]) => (e.get(k) || 0) < n).map(([k]) => k);
    err(t.rel, `inline code spans differ (missing: ${missing.slice(0, 5).join(' ') || '-'}; extra: ${extra.slice(0, 5).join(' ') || '-'})`);
  }

  // Links
  const enL = links(en.body), trL = links(tr.body);
  if (JSON.stringify(enL.external) !== JSON.stringify(trL.external)) {
    err(t.rel, `external links differ (missing: ${enL.external.filter((x) => !trL.external.includes(x)).join(' ') || '-'}; extra: ${trL.external.filter((x) => !enL.external.includes(x)).join(' ') || '-'})`);
  }
  const localize = (href) => {
    const m = href.match(/^\/blog\/([^/]+)\/?$/);
    return m && translated.get(t.lang)?.has(m[1]) ? `/blog/${t.lang}/${m[1]}/` : href;
  };
  const allowed = new Set(enL.internal.flatMap((h) => [h, localize(h)]));
  for (const h of trL.internal) if (!allowed.has(h)) err(t.rel, `internal link ${h} is not in the English post`);
  for (const h of enL.internal) if (!trL.internal.includes(h) && !trL.internal.includes(localize(h))) err(t.rel, `internal link ${h} from the English post is missing`);

  // Structure
  const es = structure(en.body), ts = structure(tr.body);
  for (const key of ['paragraphs', 'listItems', 'tableRows', 'tldr', 'fences']) {
    if (es[key] !== ts[key]) err(t.rel, `${key} count differs (English ${es[key]}, translation ${ts[key]})`);
  }
  for (const lvl of [1, 2, 3, 4, 5, 6]) {
    if (es.headings[lvl] !== ts.headings[lvl]) err(t.rel, `h${lvl} count differs (English ${es.headings[lvl]}, translation ${ts.headings[lvl]})`);
  }

  // Numbers
  const enD = counts(digitTokens(en.body)), trD = counts(digitTokens(tr.body));
  const missingD = [...enD].filter(([k, n]) => (trD.get(k) || 0) < n).map(([k]) => k);
  const extraD = [...trD].filter(([k, n]) => (enD.get(k) || 0) < n).map(([k]) => k);
  if (missingD.length) err(t.rel, `numbers from the English post missing in the translation: ${[...new Set(missingD)].slice(0, 10).join(', ')}`);
  if (extraD.length) warn(t.rel, `numbers not in the English post: ${[...new Set(extraD)].slice(0, 10).join(', ')}`);

  // Title length (SERP)
  const title = tr.data.title || '';
  const full = title.includes('gekro') ? title : `${title} | gekro`;
  // The limit is the script's SERP budget, but never stricter than the English
  // title already is (long English titles truncate too).
  const enTitle = en.data.title || '';
  const enFull = [...(enTitle.includes('gekro') ? enTitle : `${enTitle} | gekro`)].length;
  const limit = Math.max(reg.titleMax, enFull);
  if ([...full].length > limit) warn(t.rel, `"${full}" is ${[...full].length} characters; limit for ${t.lang} is ${limit}`);

  // Untranslated-prose heuristic for non-Latin scripts
  if (!['es'].includes(t.lang)) {
    const prose = proseOnly(tr.body);
    const latin = (prose.match(/[A-Za-z]/g) || []).length;
    const letters = (prose.match(/\p{L}/gu) || []).length || 1;
    const ratio = latin / letters;
    if (ratio > 0.7) err(t.rel, `looks untranslated: ${(ratio * 100).toFixed(0)}% of prose letters are Latin`);
    else if (ratio > 0.4) warn(t.rel, `${(ratio * 100).toFixed(0)}% of prose letters are Latin; check for untranslated passages`);
  }
}

// ── Build checks ────────────────────────────────────────────────────────────
function walkHtml(dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) walkHtml(p, out);
    else if (e.name.endsWith('.html')) out.push(p);
  }
  return out;
}

if (distArg) {
  const DIST = resolve(distArg);
  const expectPages = new Map(); // url -> { lang, slug }
  for (const t of translationFiles) {
    if (onlyLang && t.lang !== onlyLang) continue;
    if (!englishSlugs.has(t.slug)) continue;
    expectPages.set(`https://gekro.com/blog/${t.lang}/${t.slug}/`, t);
  }
  const hreflangOf = (html) =>
    [...html.matchAll(/<link rel="alternate" hreflang="([^"]+)" href="([^"]+)"\s*\/?>/g)].map((m) => [m[1], m[2]]);
  const pageHtml = (url) => {
    const p = join(DIST, new URL(url).pathname, 'index.html');
    return existsSync(p) ? readFileSync(p, 'utf8') : null;
  };

  for (const [url, t] of expectPages) {
    const reg = REGISTRY.get(t.lang);
    const html = pageHtml(url);
    if (!html) { err(url, 'translated page was not built'); continue; }
    const m = html.match(/<html([^>]*)>/);
    const attrs = m ? m[1] : '';
    if (!new RegExp(`lang="${reg.bcp47}"`).test(attrs)) err(url, `<html> must have lang="${reg.bcp47}" (found ${attrs.trim()})`);
    if (!new RegExp(`dir="${reg.dir}"`).test(attrs)) err(url, `<html> must have dir="${reg.dir}"`);
    if (!html.includes(`<link rel="canonical" href="${url}"`)) err(url, 'canonical must be the translated page itself');
    if (!html.includes(`<meta property="og:locale" content="${ogLocaleOf.get(t.lang)}"`)) err(url, `og:locale must be ${ogLocaleOf.get(t.lang)}`);
    // Site-wide HTML comments and scripts contain developer prose with dashes;
    // only what a reader (or a crawler) sees counts.
    const visible = html
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/<script[\s\S]*?<\/script>/g, '')
      .replace(/<style[\s\S]*?<\/style>/g, '');
    if (visible.includes('—')) err(url, 'built page shows an em-dash');

    // hreflang cluster: English, every translation, x-default
    const englishUrl = `https://gekro.com/blog/${t.slug}/`;
    const cluster = [['en', englishUrl], ...[...REGISTRY].filter(([c]) => translated.get(c)?.has(t.slug)).map(([c, r]) => [r.bcp47, `https://gekro.com/blog/${c}/${t.slug}/`]), ['x-default', englishUrl]];
    const got = hreflangOf(html);
    for (const [hl, href] of cluster) {
      if (!got.some(([h, u]) => h === hl && u === href)) err(url, `missing hreflang ${hl} -> ${href}`);
    }
    // reciprocity: every member lists this page back
    for (const [hl, href] of cluster) {
      if (hl === 'x-default') continue;
      const other = pageHtml(href);
      if (!other) { err(url, `hreflang target ${href} does not exist in the build`); continue; }
      if (!hreflangOf(other).some(([, u]) => u === url)) err(href, `does not link back to ${url} via hreflang`);
    }
  }

  // English pages without translations must carry no hreflang (unchanged output)
  const translatedSlugs = new Set(translationFiles.map((t) => t.slug));
  for (const slug of englishSlugs) {
    if (translatedSlugs.has(slug)) continue;
    const html = pageHtml(`https://gekro.com/blog/${slug}/`);
    if (html && hreflangOf(html).length) err(`/blog/${slug}/`, 'has hreflang but no translations exist');
  }
  // Sitemap must carry the cluster too
  const sm = join(DIST, 'sitemap-0.xml');
  if (existsSync(sm) && expectPages.size) {
    const xml = readFileSync(sm, 'utf8');
    for (const url of expectPages.keys()) if (!xml.includes(`<loc>${url}</loc>`)) err('sitemap-0.xml', `missing ${url}`);
    if (!/xhtml:link[^>]*hreflang="x-default"/.test(xml)) err('sitemap-0.xml', 'no xhtml:link hreflang x-default entries');
  }
}

// ── Report ──────────────────────────────────────────────────────────────────
for (const w of warnings) console.warn(`[verify-i18n] warn  ${w}`);
for (const e of errors) console.error(`[verify-i18n] ERROR ${e}`);
const langs = [...translated.keys()].join(', ') || 'none';
console.log(`[verify-i18n] ${checked} translation(s) checked (languages: ${langs}); ${stale} stale; ${warnings.length} warning(s); ${errors.length} error(s)`);
process.exit(errors.length ? 1 : 0);
