#!/usr/bin/env node
/**
 * fetch-headlines.mjs — pull recent AI headlines from vetted RSS feeds
 *
 * This script does NO summarization and needs NO API key. It just fetches
 * the last 36h of items from the source feeds and prints them as JSON to
 * stdout (and optionally writes a file). The summarization is done by
 * whatever reads this output — a scheduled Claude Code routine, a human,
 * or a local Ollama model.
 *
 * This is the "free, no key" half of the news pipeline. See
 * .claude/commands/news-briefing.md for the routine that consumes it.
 *
 * Run:
 *   node scripts/news/fetch-headlines.mjs                 # prints JSON
 *   node scripts/news/fetch-headlines.mjs --out file.json # also writes file
 *   node scripts/news/fetch-headlines.mjs --hours 48      # widen window
 */

import { writeFile } from 'node:fs/promises';

const args = process.argv.slice(2);
const outIdx = args.indexOf('--out');
const outFile = outIdx >= 0 ? args[outIdx + 1] : null;
const hoursIdx = args.indexOf('--hours');
const WINDOW_HOURS = hoursIdx >= 0 ? parseFloat(args[hoursIdx + 1]) : 36;

// Vetted, signal-dense feeds for an AI engineering audience.
// NOTE: a few publishers block bots (OpenAI returns 403) or rotate their
// RSS paths (DeepMind, Anthropic). The fetcher degrades gracefully — a
// dead feed just logs a warning and is skipped. Simon Willison + TechCrunch
// AI are added as reliable high-signal replacements for the flaky ones.
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

const decodeEntities = (s) => String(s || '')
  .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#x27;/gi, "'")
  .replace(/&nbsp;/g, ' ').replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n));

async function fetchFeed(source) {
  try {
    const res = await fetch(source.url, {
      headers: { 'User-Agent': 'gekro-news-bot/1.0 (+https://gekro.com/news)' },
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) { console.error(`  warn ${source.name}: HTTP ${res.status}`); return []; }
    const text = await res.text();
    const items = [];
    const matches = text.matchAll(/<item>([\s\S]*?)<\/item>|<entry>([\s\S]*?)<\/entry>/g);
    for (const [, itemXml = '', entryXml = ''] of matches) {
      const xml = itemXml || entryXml;
      const title = decodeEntities((xml.match(/<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/) || [])[1]?.trim());
      const link = (
        (xml.match(/<link[^>]*href="([^"]+)"/) || [])[1] ||
        (xml.match(/<link[^>]*>(https?:\/\/[^<]+)<\/link>/) || [])[1] ||
        ''
      ).trim();
      const descRaw = (xml.match(/<description[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/) || xml.match(/<summary[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/summary>/) || [])[1] || '';
      const desc = decodeEntities(descRaw.replace(/<[^>]+>/g, '').trim()).slice(0, 280);
      const pubRaw = (xml.match(/<pubDate>([\s\S]*?)<\/pubDate>|<published>([\s\S]*?)<\/published>|<updated>([\s\S]*?)<\/updated>/) || []);
      const pubDate = (pubRaw[1] || pubRaw[2] || pubRaw[3] || '').trim();
      if (title && link) {
        const pub = pubDate ? new Date(pubDate) : new Date();
        const hoursAgo = (Date.now() - pub.getTime()) / 3_600_000;
        if (!isFinite(hoursAgo) || hoursAgo <= WINDOW_HOURS) {
          items.push({ source: source.name, title, link, desc, hoursAgo: Math.max(0, hoursAgo).toFixed(1) });
        }
      }
    }
    console.error(`  ok   ${source.name}: ${items.length} items`);
    return items;
  } catch (e) {
    console.error(`  fail ${source.name}: ${e.message}`);
    return [];
  }
}

async function main() {
  console.error(`[fetch-headlines] window=${WINDOW_HOURS}h across ${SOURCES.length} sources`);
  const results = await Promise.all(SOURCES.map(fetchFeed));
  const items = results.flat()
    .sort((a, b) => parseFloat(a.hoursAgo) - parseFloat(b.hoursAgo))
    .slice(0, 50);

  const payload = {
    generated_at: new Date().toISOString(),
    window_hours: WINDOW_HOURS,
    count: items.length,
    items,
  };

  const json = JSON.stringify(payload, null, 2);
  if (outFile) {
    await writeFile(outFile, json, 'utf-8');
    console.error(`[fetch-headlines] wrote ${outFile} (${items.length} items)`);
  }
  // Always print to stdout so a routine can pipe it
  console.log(json);
}

main().catch(e => { console.error('[fetch-headlines] fatal:', e); process.exit(1); });
