#!/usr/bin/env node
/**
 * generate-briefing.mjs — daily AI news briefing generator
 *
 * What this does:
 *   1. Fetches the last 24h of items from vetted RSS feeds
 *   2. Calls Claude API to select + summarize the 3-5 most significant stories
 *      for an AI engineering audience (Rohit's voice)
 *   3. Writes apps/web/src/content/news/YYYY-MM-DD.md
 *
 * The GitHub Action opens a PR with this file. Rohit reviews and merges
 * (or rejects with a reason that gets logged to refine future prompts).
 *
 * Run locally:
 *   ANTHROPIC_API_KEY=sk-ant-xxx node scripts/news/generate-briefing.mjs
 *
 * Dry run (prints the draft, doesn't write):
 *   node scripts/news/generate-briefing.mjs --dry-run
 *
 * Required env:
 *   ANTHROPIC_API_KEY  — Anthropic API key (console.anthropic.com)
 *
 * Optional env:
 *   NEWS_DATE          — Override the date, e.g. "2026-05-25" (default: today UTC)
 *   NEWS_MODEL         — Claude model to use (default: claude-sonnet-4-6)
 */

import { writeFile, readFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../..');
const NEWS_DIR = resolve(REPO_ROOT, 'apps/web/src/content/news');
const DRY_RUN = process.argv.includes('--dry-run');
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = process.env.NEWS_MODEL || 'claude-sonnet-4-6';
const TODAY = process.env.NEWS_DATE || new Date().toISOString().slice(0, 10);

// NEWS_DATE is interpolated into the output filename and frontmatter — reject
// anything that isn't a real ISO date before it can poison feeds/sitemaps.
if (!/^\d{4}-\d{2}-\d{2}$/.test(TODAY) || isNaN(new Date(`${TODAY}T00:00:00Z`).getTime())) {
  console.error(`[news] Invalid NEWS_DATE "${TODAY}" — expected YYYY-MM-DD.`);
  process.exit(1);
}

if (!ANTHROPIC_API_KEY) {
  console.error('[news] ANTHROPIC_API_KEY is not set. Export it and try again.');
  process.exit(1);
}

// Minimal HTML entity decoding so Claude sees clean titles/descriptions
// (mirrors fetch-headlines.mjs — keep the two in sync).
const decodeEntities = (s) => String(s || '')
  .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#x27;/gi, "'")
  .replace(/&nbsp;/g, ' ').replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n));

// ── RSS sources ───────────────────────────────────────────────────────────────
// Vetted, signal-dense feeds for an AI engineering audience.
// Each has a name (used in source attribution) + feed URL.
// Kept in sync with scripts/news/fetch-headlines.mjs — the working set. The
// previously-listed OpenAI/DeepMind/Anthropic RSS endpoints 403 or moved;
// Simon Willison + TechCrunch AI replace them as reliable high-signal feeds.
const SOURCES = [
  { name: 'The Verge · AI',        url: 'https://www.theverge.com/rss/ai-artificial-intelligence/index.xml' },
  { name: 'Ars Technica',          url: 'https://feeds.arstechnica.com/arstechnica/technology-lab' },
  { name: 'MIT Technology Review', url: 'https://www.technologyreview.com/feed/' },
  { name: 'Hugging Face Blog',     url: 'https://huggingface.co/blog/feed.xml' },
  { name: 'Simon Willison',        url: 'https://simonwillison.net/atom/everything/' },
  { name: 'TechCrunch · AI',       url: 'https://techcrunch.com/category/artificial-intelligence/feed/' },
  { name: 'Google DeepMind',       url: 'https://deepmind.google/blog/feed/basic/' },
  { name: 'VentureBeat · AI',      url: 'https://venturebeat.com/category/ai/feed/' },
  { name: 'IEEE Spectrum · AI',    url: 'https://spectrum.ieee.org/feeds/topic/artificial-intelligence.rss' },
];

// ── Curation prompt ───────────────────────────────────────────────────────────
// Encodes the gekro /news standard: a NEUTRAL, sourced wire-service digest, not
// an opinion column. Mirrors .claude/commands/news-briefing.md. Keep the two in
// sync if either changes.
const CURATION_PROMPT = `You are writing the daily AI news briefing for gekro.com, an AI engineering lab. The briefing is a NEUTRAL, sourced summary of third-party reporting - a wire-service digest, not an opinion column.

AUDIENCE: AI engineers, ML practitioners, and infra folks who want the day's signal without hype.

SELECTION CRITERIA - pick the 2-4 most significant stories from the supplied headlines:
PREFER: model releases (open-weight especially), research with engineering implications, infra/tooling, real benchmark results, API/pricing changes that affect developers.
AVOID: standalone funding rounds, pure business news, opinion pieces, press releases, AI drama, AGI speculation without evidence.

VOICE + STYLE (strict):
- Neutral and factual. Third person. NO first person ("I", "we"), NO opinion, NO editorializing. Report what happened and let the reader judge.
- NO hype words (revolutionary, groundbreaking, game-changing). Use specific, measurable claims.
- NO em-dashes (the character "—"). Use a regular hyphen "-" with spaces, or rewrite the sentence.
- 2 paragraphs. First paragraph: the lead story in depth. Second paragraph: the remaining 1-3 items.
- EVERY factual claim must carry an inline citation as a markdown link in this exact form: ([Source Name](https://url)). Multiple claims may reuse the same source. Do not state anything you cannot link.
- Prose only - no bullet lists, no headings inside the body.

OUTPUT FORMAT - return only valid JSON, no markdown wrapper:
{
  "title": "A real, specific headline summarizing the lead story (two leads may be joined with a semicolon). NOT 'AI Briefing'. Max ~110 chars.",
  "summary": "One neutral sentence capturing the most important story (max 160 chars; shown on cards).",
  "body": "Two markdown paragraphs with inline ([Source](url)) citations. Separate paragraphs with a blank line.",
  "sources": ["Source Name 1", "Source Name 2"],
  "sourceUrls": ["https://...", "https://..."],
  "topics": ["keyword1", "keyword2"]
}

CRITICAL: "sources" and "sourceUrls" MUST be the same length and aligned by index - sources[i] is the display name for sourceUrls[i]. Include every source you cite inline, once per distinct URL.`;

// ── Helpers ───────────────────────────────────────────────────────────────────
async function fetchFeed(source) {
  try {
    const res = await fetch(source.url, {
      headers: { 'User-Agent': 'gekro-news-bot/1.0 (https://gekro.com/news)' },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) { console.warn(`  ⚠ ${source.name}: HTTP ${res.status}`); return null; }
    const text = await res.text();
    // Extract titles + descriptions + links from RSS/Atom XML (no dep needed for basic parsing)
    const items = [];
    const itemMatches = text.matchAll(/<item>([\s\S]*?)<\/item>|<entry>([\s\S]*?)<\/entry>/g);
    for (const [, itemXml = '', entryXml = ''] of itemMatches) {
      const xml = itemXml || entryXml;
      const title = decodeEntities((xml.match(/<title[^>]*>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/s) || [])[1]?.trim());
      const link = (xml.match(/<link[^>]*href="([^"]+)"/) || xml.match(/<link[^>]*>(https?:\/\/[^<]+)<\/link>/) || [])[1]?.trim();
      const desc = decodeEntities((xml.match(/<description[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/s) || [])[1]?.replace(/<[^>]+>/g, '').trim().slice(0, 300));
      // Alternation regex fills a DIFFERENT capture group per format: [1]=RSS
      // <pubDate>, [2]=Atom <published>, [3]=Atom <updated>. Reading only [1]
      // made every Atom item look 0h old — stale posts passed the 36h filter
      // and sorted to the top of Claude's input. (Bug found 2026-06-10.)
      const pubRaw = (xml.match(/<pubDate>([\s\S]*?)<\/pubDate>|<published>([\s\S]*?)<\/published>|<updated>([\s\S]*?)<\/updated>/) || []);
      const pubDate = (pubRaw[1] || pubRaw[2] || pubRaw[3] || '').trim();
      if (title && link) {
        // Filter to last 36h — items with missing/unparseable dates are DROPPED
        // (we cannot verify freshness, and "assume now" is how stale news leaks in).
        const pub = new Date(pubDate);
        const hoursAgo = (Date.now() - pub.getTime()) / 3_600_000;
        if (isFinite(hoursAgo) && hoursAgo <= 36) {
          items.push({ title, link, desc: desc || '', source: source.name, hoursAgo: hoursAgo.toFixed(1) });
        }
      }
    }
    console.log(`  ✓ ${source.name}: ${items.length} items in last 36h`);
    return items;
  } catch (e) {
    console.warn(`  ✗ ${source.name}: ${e.message}`);
    return null;
  }
}

async function callClaude(prompt) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1500,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Claude API ${res.status}: ${err}`);
  }
  const data = await res.json();
  return data.content[0].text;
}

function buildMarkdown(parsed) {
  const { title, summary, body, sources, sourceUrls, topics } = parsed;
  // JSON.stringify produces a valid YAML double-quoted scalar and — unlike the
  // old "escape quotes only" approach — correctly escapes backslashes too
  // (a title containing \n used to silently corrupt the frontmatter).
  const yamlStr = (v) => JSON.stringify(String(v));
  const yamlList = (arr) => arr.map(v => `  - ${yamlStr(v)}`).join('\n');
  // Convert the two-paragraph body to proper markdown paragraphs
  const bodyMd = body.trim().split(/\n\n+/).map(p => p.trim()).join('\n\n');
  return `---
title: ${yamlStr(title)}
publishedAt: "${TODAY}"
summary: ${yamlStr(summary)}
sources:
${yamlList(sources)}
sourceUrls:
${yamlList(sourceUrls)}
autoGenerated: true
approved: true
topics:
${(topics || []).length ? yamlList(topics) : '  []'}
---

${bodyMd}
`;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const outPath = resolve(NEWS_DIR, `${TODAY}.md`);

  if (!DRY_RUN && existsSync(outPath)) {
    console.log(`[news] ${TODAY}.md already exists — skipping (delete it first to regenerate)`);
    process.exit(0);
  }

  console.log(`[news] Generating briefing for ${TODAY} using ${MODEL}${DRY_RUN ? ' (DRY RUN)' : ''}`);
  console.log('[news] Fetching RSS feeds…');

  const results = await Promise.all(SOURCES.map(fetchFeed));
  const allItems = results.flat().filter(Boolean);

  if (allItems.length === 0) {
    console.error('[news] No items fetched from any source. Check network access and feed URLs.');
    process.exit(1);
  }

  console.log(`[news] Total items across all feeds: ${allItems.length}`);

  // Thin-day guard (mirrors the manual skill's "fewer than 3 substantive
  // stories → don't publish"). With most feeds down, forcing Claude to spin a
  // briefing out of 1-2 leftover items produces filler. Skip cleanly instead.
  const distinctSources = new Set(allItems.map(i => i.source)).size;
  if (allItems.length < 5 || distinctSources < 2) {
    console.log(`[news] Thin news day (${allItems.length} items from ${distinctSources} source(s)) — skipping today's briefing.`);
    process.exit(0);
  }

  // Build the headlines prompt
  const headlinesList = allItems
    .sort((a, b) => parseFloat(a.hoursAgo) - parseFloat(b.hoursAgo)) // newest first
    .slice(0, 40) // cap to avoid token overflow
    .map(item => `[${item.source} · ${item.hoursAgo}h ago] ${item.title}\n  ${item.desc}`)
    .join('\n\n');

  const userPrompt = `Today is ${TODAY}.

Here are the headlines from the last 36 hours across vetted AI publications:

${headlinesList}

Write the daily briefing following the instructions exactly. Return only valid JSON.`;

  console.log('[news] Calling Claude…');
  const raw = await callClaude(`${CURATION_PROMPT}\n\n${userPrompt}`);

  // Extract JSON from response. Strip code fences first, then try the greedy
  // first-{ to last-} slice; if a preamble's stray brace breaks the parse,
  // walk the closing brace backwards until a parse succeeds.
  const cleaned = raw.replace(/```(?:json)?/g, '').trim();
  let parsed = null;
  const start = cleaned.indexOf('{');
  if (start !== -1) {
    let end = cleaned.lastIndexOf('}');
    while (end > start && parsed === null) {
      try { parsed = JSON.parse(cleaned.slice(start, end + 1)); }
      catch { end = cleaned.lastIndexOf('}', end - 1); }
    }
  }
  if (parsed === null) {
    console.error('[news] Claude did not return parseable JSON:\n', raw);
    process.exit(1);
  }

  // Validation guard — REQUIRED for safe unattended auto-publish. If the draft
  // is malformed, fail loudly so the workflow aborts and nothing is committed.
  const problems = [];
  if (!parsed.title || parsed.title.trim().length < 8) problems.push('missing or too-short title');
  // Em-dash check must cover EVERY surfaced field — summary renders on cards
  // and in meta descriptions, so it slipped past the old title+body-only test.
  if (/—/.test(`${parsed.title} ${parsed.summary} ${parsed.body}`)) problems.push('contains an em-dash (—) — banned');
  if (!parsed.summary) problems.push('missing summary');
  if (parsed.summary && parsed.summary.length > 200) problems.push(`summary too long (${parsed.summary.length} > 200)`);
  if (!parsed.body || parsed.body.trim().length < 120) problems.push('missing or too-short body');
  if (!Array.isArray(parsed.sources) || !Array.isArray(parsed.sourceUrls)) {
    problems.push('sources/sourceUrls must both be arrays');
  } else if (parsed.sources.length !== parsed.sourceUrls.length) {
    problems.push(`sources (${parsed.sources.length}) and sourceUrls (${parsed.sourceUrls.length}) length mismatch`);
  } else if (parsed.sources.length === 0) {
    problems.push('at least one source is required');
  } else {
    // Zod enforces z.string().url() at build time — a scheme-less URL passing
    // this guard would freeze EVERY subsequent Cloudflare deploy. Catch it here.
    for (const u of parsed.sourceUrls) {
      try { new URL(u); } catch { problems.push(`sourceUrl is not a valid absolute URL: "${u}"`); }
    }
  }
  if (problems.length) {
    console.error('[news] Draft failed validation — NOT writing:\n - ' + problems.join('\n - '));
    process.exit(1);
  }

  const markdown = buildMarkdown(parsed);

  console.log('\n── Draft briefing ──────────────────────────────────────────');
  console.log(markdown);
  console.log('────────────────────────────────────────────────────────────\n');

  if (DRY_RUN) {
    console.log('[news] --dry-run: not writing file');
    return;
  }

  if (!existsSync(NEWS_DIR)) await mkdir(NEWS_DIR, { recursive: true });
  await writeFile(outPath, markdown, 'utf-8');
  console.log(`[news] Wrote ${outPath}`);
  console.log(`[news] Cost estimate: ~$0.01-0.05 (Sonnet-level call)`);
}

main().catch(e => { console.error('[news] Fatal:', e); process.exit(1); });
