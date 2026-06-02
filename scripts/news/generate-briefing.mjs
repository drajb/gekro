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
 *   NEWS_MODEL         — Claude model to use (default: claude-sonnet-4-5)
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
const MODEL = process.env.NEWS_MODEL || 'claude-sonnet-4-5';
const TODAY = process.env.NEWS_DATE || new Date().toISOString().slice(0, 10);

if (!ANTHROPIC_API_KEY) {
  console.error('[news] ANTHROPIC_API_KEY is not set. Export it and try again.');
  process.exit(1);
}

// ── RSS sources ───────────────────────────────────────────────────────────────
// Vetted, signal-dense feeds for an AI engineering audience.
// Each has a name (used in source attribution) + feed URL.
const SOURCES = [
  { name: 'The Verge · AI',     url: 'https://www.theverge.com/rss/ai-artificial-intelligence/index.xml' },
  { name: 'Ars Technica · AI',  url: 'https://feeds.arstechnica.com/arstechnica/technology-lab' },
  { name: 'MIT Technology Review', url: 'https://www.technologyreview.com/feed/' },
  { name: 'Hugging Face Blog',  url: 'https://huggingface.co/blog/feed.xml' },
  { name: 'Google DeepMind',    url: 'https://deepmind.google/blog/rss/' },
  { name: 'OpenAI Blog',        url: 'https://openai.com/blog/rss/' },
  { name: 'Anthropic News',     url: 'https://www.anthropic.com/news/rss.xml' },
  { name: 'VentureBeat · AI',   url: 'https://venturebeat.com/category/ai/feed/' },
  { name: 'IEEE Spectrum · AI', url: 'https://spectrum.ieee.org/feeds/topic/artificial-intelligence.rss' },
];

// ── Curation prompt ───────────────────────────────────────────────────────────
// This prompt encodes Rohit's editorial voice and selection criteria.
// It evolves as PRs are approved/rejected — see scripts/news/refine-prompt.mjs.
const CURATION_PROMPT = `You are writing the daily AI news briefing for gekro.com, Rohit Burani's AI engineering lab and personal site.

ABOUT ROHIT:
- AI engineer with an engineering and management background
- Runs a Pi 5 cluster for local LLM experiments, uses Mac M4 Pro, builds MCP agents
- Honest, post-mortem voice — "authoritative engineering lab", not a hype blog
- Audience: AI engineers, ML practitioners, infra folks who build things

SELECTION CRITERIA — pick the 3-5 most significant stories from today's headlines:
✅ PREFER: technical breakthroughs, model releases (open-weight especially), research papers with engineering implications, infra/tooling announcements, real benchmark results, API changes that affect developers
❌ AVOID: funding rounds by themselves (unless truly landmark and technically significant), pure business news, opinion pieces without technical content, anything that's primarily a press release, celebrity AI drama, AGI speculation without evidence

VOICE + STYLE:
- 2 paragraphs total. First paragraph covers the lead story in depth. Second paragraph sweeps the remaining 2-4 notable items.
- First person where it adds context ("I've been watching...", "This directly affects the RAG pipelines I run...")
- Be opinionated — say why something matters or doesn't. Don't just restate the headline.
- No hype words: revolutionary, groundbreaking, game-changing. Use specific, measurable claims instead.
- Em-dashes are fine. Short sentences OK. No bullet lists in the body — prose only.
- Cite the specific source name at the end of a claim if it's not obvious.

OUTPUT FORMAT — return only valid JSON, no markdown wrapper:
{
  "title": "AI Briefing — [Month Day, Year]",
  "summary": "One sentence that captures the most important story (max 160 chars, shown in card previews)",
  "body": "The two paragraph body text. Separate paragraphs with a blank line.",
  "sources": ["Source Name 1", "Source Name 2"],
  "sourceUrls": ["https://...", "https://..."],
  "topics": ["keyword1", "keyword2"]
}`;

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
      const title = (xml.match(/<title[^>]*>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/s) || [])[1]?.trim();
      const link = (xml.match(/<link[^>]*href="([^"]+)"/) || xml.match(/<link[^>]*>(https?:\/\/[^<]+)<\/link>/) || [])[1]?.trim();
      const desc = (xml.match(/<description[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/s) || [])[1]?.replace(/<[^>]+>/g, '').trim().slice(0, 300);
      const pubDate = (xml.match(/<pubDate>(.*?)<\/pubDate>|<published>(.*?)<\/published>|<updated>(.*?)<\/updated>/) || [])[1]?.trim();
      if (title && link) {
        // Filter to last 36h
        const pub = pubDate ? new Date(pubDate) : new Date();
        const hoursAgo = (Date.now() - pub.getTime()) / 3_600_000;
        if (hoursAgo <= 36) {
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
  const srcYaml = sources.map(s => `  - "${s.replace(/"/g, '\\"')}"`).join('\n');
  const urlYaml = sourceUrls.map(u => `  - "${u}"`).join('\n');
  const topicsYaml = (topics || []).map(t => `  - "${t}"`).join('\n');
  // Convert the two-paragraph body to proper markdown paragraphs
  const bodyMd = body.trim().split(/\n\n+/).map(p => p.trim()).join('\n\n');
  return `---
title: "${title.replace(/"/g, '\\"')}"
publishedAt: "${TODAY}"
summary: "${summary.replace(/"/g, '\\"')}"
sources:
${srcYaml}
sourceUrls:
${urlYaml}
autoGenerated: true
approved: false
topics:
${topicsYaml || '  []'}
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

  // Extract JSON from response
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    console.error('[news] Claude did not return valid JSON:\n', raw);
    process.exit(1);
  }

  let parsed;
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch (e) {
    console.error('[news] JSON parse error:', e.message, '\nRaw:\n', raw);
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
