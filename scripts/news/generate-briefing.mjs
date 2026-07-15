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
 * Model provider (set ONE key — at least one is required):
 *   OPENROUTER_API_KEY   — OpenRouter key → uses FREE models ($0). Preferred.
 *   ANTHROPIC_API_KEY    — Anthropic key (console.anthropic.com), pay-as-you-go.
 *   If both are set, OpenRouter wins.
 *
 * Optional env:
 *   NEWS_DATE            — Override the date, e.g. "2026-05-25" (default: today UTC)
 *   NEWS_MODEL           — Primary model. Default: openrouter/free (OpenRouter)
 *                          or claude-haiku-4-5 (Anthropic).
 *   NEWS_MODEL_FALLBACKS — Comma-separated models tried in order if the primary
 *                          errors. Default (OpenRouter): two free instruct models.
 */

import { writeFile, readFile, mkdir } from 'node:fs/promises';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../..');
const NEWS_DIR = resolve(REPO_ROOT, 'apps/web/src/content/news');
const DRY_RUN = process.argv.includes('--dry-run');
// --emit-prompt: build and print the exact model prompt + the citable-URL
// allow-list, then exit BEFORE calling the API. Lets the prompt and the
// citation gate be inspected/tested without an API key.
const EMIT_PROMPT = process.argv.includes('--emit-prompt');
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
// Provider selection: an OpenRouter key routes to OpenRouter's FREE models
// ($0/day); otherwise fall back to the Anthropic API. This lets the daily job
// run for free without ever touching an Anthropic credit balance.
const USE_OPENROUTER = !!OPENROUTER_API_KEY;

// Primary model.
//  - OpenRouter: `openrouter/free` is a meta-router that auto-selects an
//    available free model per request (built-in cross-model fallback).
//  - Anthropic: Haiku 4.5, the cheapest Claude model ($1/$5 per Mtok) — this
//    job is light once-a-day curation, so Haiku is more than enough.
// Override the primary via NEWS_MODEL.
const MODEL = process.env.NEWS_MODEL || (USE_OPENROUTER ? 'openrouter/free' : 'claude-haiku-4-5');

// Explicit fallbacks tried in order if the primary errors (belt-and-suspenders
// on top of openrouter/free's own routing). Comma-separated via NEWS_MODEL_FALLBACKS.
// The Anthropic path has no default fallback (single paid model).
const MODEL_FALLBACKS = process.env.NEWS_MODEL_FALLBACKS
  ? process.env.NEWS_MODEL_FALLBACKS.split(',').map((m) => m.trim()).filter(Boolean)
  : USE_OPENROUTER
    ? ['meta-llama/llama-3.3-70b-instruct:free', 'openai/gpt-oss-120b:free']
    : [];

// Ordered, de-duped list: primary first, then any distinct fallbacks.
const MODELS = [MODEL, ...MODEL_FALLBACKS.filter((m) => m !== MODEL)];
const TODAY = process.env.NEWS_DATE || new Date().toISOString().slice(0, 10);

// NEWS_DATE is interpolated into the output filename and frontmatter — reject
// anything that isn't a real ISO date before it can poison feeds/sitemaps.
if (!/^\d{4}-\d{2}-\d{2}$/.test(TODAY) || isNaN(new Date(`${TODAY}T00:00:00Z`).getTime())) {
  console.error(`[news] Invalid NEWS_DATE "${TODAY}" — expected YYYY-MM-DD.`);
  process.exit(1);
}

if (!ANTHROPIC_API_KEY && !OPENROUTER_API_KEY && !EMIT_PROMPT) {
  console.error('[news] No model API key set. Export OPENROUTER_API_KEY (free tier) or ANTHROPIC_API_KEY.');
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
  { name: 'MarkTechPost',          url: 'https://www.marktechpost.com/feed/' },
  { name: 'The Decoder',           url: 'https://the-decoder.com/feed/' },
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
- CITE ONLY THE URLs PROVIDED with the headlines below, copied EXACTLY from each headline's "URL:" line. NEVER invent, guess, complete, or recall a URL from memory, and never cite a source or domain that is not in the provided list. Every entry in "sourceUrls" must be one of the provided URLs verbatim. If a claim cannot be supported by a provided URL, leave the claim out.
- Report ONLY what the provided headlines and descriptions actually support. Do not add specific numbers, dates, names, quotes, or other details that are not present in the provided source text.
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

// ── Personalization + freshness + citation-integrity helpers ───────────────────
// Normalise a URL to host + path for matching a cited URL against the ones we
// supplied. Deliberately lenient on the parts that vary without changing the
// target - protocol (http vs https), a leading "www.", query, fragment, and a
// trailing slash - so the gate rejects fabricated URLs without false-rejecting
// a real one the model reformatted slightly. Host + path still must match.
function normalizeUrl(u) {
  const x = new URL(u);
  const host = x.host.toLowerCase().replace(/^www\./, '');
  const path = x.pathname.replace(/\/+$/, '').toLowerCase();
  return `${host}${path}`;
}

// Read the optional interest profile (scripts/news/interests.json). This is the
// ONLY personalization input; if it is missing or malformed we return null and
// the briefing runs on the static curation prompt exactly as before.
function loadInterests() {
  try {
    const p = resolve(__dirname, 'interests.json');
    if (!existsSync(p)) return null;
    const data = JSON.parse(readFileSync(p, 'utf-8'));
    const hasList = ['emphasis', 'topics', 'avoid'].some(k => Array.isArray(data?.[k]) && data[k].length);
    return hasList ? data : null;
  } catch { return null; }
}

// Turn the interest profile into a READER FOCUS block. This biases WHICH stories
// get selected and how they rank - never the neutral, third-person voice, and it
// never addresses the reader (the page is public).
function buildReaderFocus(interests) {
  const emph = (interests.emphasis || interests.topics || []).slice(0, 24);
  const avoid = (interests.avoid || []).slice(0, 24);
  if (!emph.length && !avoid.length) return '';
  let s = `\n\nREADER FOCUS - bias which stories you SELECT and how you rank them toward this audience's active interests, all else equal. This affects SELECTION ONLY. It does not change the neutral, third-person, sourced voice, and you must never address the reader directly.`;
  if (emph.length) s += `\nEmphasize: ${emph.join('; ')}.`;
  if (avoid.length) s += `\nDe-emphasize: ${avoid.join('; ')}.`;
  return s;
}

// Read the last `days` published briefings (excluding today) so the model can
// avoid re-reporting a story it already covered - the fix for a multi-day saga
// resurfacing in the feed every single morning.
function loadRecentBriefings(days) {
  try {
    return readdirSync(NEWS_DIR)
      .filter(f => /^\d{4}-\d{2}-\d{2}\.md$/.test(f))
      .map(f => f.replace(/\.md$/, ''))
      .filter(d => d < TODAY)
      .sort()
      .slice(-days)
      .map(d => {
        const md = readFileSync(resolve(NEWS_DIR, `${d}.md`), 'utf-8');
        const title = (md.match(/^title:\s*"?(.*?)"?\s*$/m) || [])[1] || '';
        return { date: d, title: title.replace(/"/g, '').trim() };
      })
      .filter(r => r.title);
  } catch { return []; }
}

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

async function callAnthropic(model, prompt) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 1500,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const text = data.content?.[0]?.text;
  if (!text) throw new Error(`Anthropic empty response: ${JSON.stringify(data).slice(0, 300)}`);
  return text;
}

async function callOpenRouter(model, prompt) {
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      // Attribution headers OpenRouter uses for its dashboard/rankings.
      'HTTP-Referer': 'https://gekro.com',
      'X-Title': 'Gekro News Briefing',
    },
    body: JSON.stringify({
      model,
      max_tokens: 1500,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!res.ok) throw new Error(`OpenRouter ${res.status}: ${await res.text()}`);
  const data = await res.json();
  // OpenRouter can return HTTP 200 with an error body when a provider fails —
  // treat that as a failure so the fallback loop moves to the next model.
  if (data.error) throw new Error(`OpenRouter provider error: ${JSON.stringify(data.error).slice(0, 300)}`);
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error(`OpenRouter empty response: ${JSON.stringify(data).slice(0, 300)}`);
  return text;
}

// Try the primary model, then each fallback in order. Only give up (throw) if
// every model fails — a single flaky free model no longer kills the run.
async function callModel(prompt) {
  let lastErr;
  for (const model of MODELS) {
    try {
      const text = USE_OPENROUTER ? await callOpenRouter(model, prompt) : await callAnthropic(model, prompt);
      if (MODELS.length > 1) console.log(`[news]   → generated with ${model}`);
      return text;
    } catch (e) {
      lastErr = e;
      console.warn(`[news]   ✗ ${model} failed: ${e.message}`);
    }
  }
  throw new Error(`All models failed (${MODELS.join(', ')}). Last error: ${lastErr?.message}`);
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

// Pull the JSON object out of a model response: strip code fences, then take the
// first-{ … last-} slice, walking the closing brace back until it parses.
function extractDraftJson(raw) {
  const cleaned = raw.replace(/```(?:json)?/g, '').trim();
  const start = cleaned.indexOf('{');
  if (start === -1) return null;
  let end = cleaned.lastIndexOf('}');
  while (end > start) {
    try { return JSON.parse(cleaned.slice(start, end + 1)); }
    catch { end = cleaned.lastIndexOf('}', end - 1); }
  }
  return null;
}

// Returns an array of human-readable problems; [] means the draft is publishable.
// REQUIRED for safe unattended auto-publish — a malformed draft must never ship.
function validateDraft(parsed, allowedUrls) {
  const problems = [];
  if (!parsed.title || parsed.title.trim().length < 8) problems.push('missing or too-short title');
  // Em-dash check covers EVERY surfaced field — summary renders on cards and in
  // meta descriptions, so a title+body-only test would miss it.
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
    // this guard would freeze every subsequent Cloudflare deploy. Catch it here.
    for (const u of parsed.sourceUrls) {
      let norm = null;
      try { norm = normalizeUrl(u); } catch { problems.push(`sourceUrl is not a valid absolute URL: "${u}"`); }
      // Citation integrity: a cited URL the pipeline never supplied is almost
      // always a model-fabricated link — fail closed rather than publish it.
      if (norm && !allowedUrls.has(norm)) {
        problems.push(`sourceUrl was not among the provided sources (possible fabrication): "${u}"`);
      }
    }
  }
  return problems;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const outPath = resolve(NEWS_DIR, `${TODAY}.md`);

  if (!DRY_RUN && existsSync(outPath)) {
    console.log(`[news] ${TODAY}.md already exists — skipping (delete it first to regenerate)`);
    process.exit(0);
  }

  console.log(`[news] Generating briefing for ${TODAY} via ${USE_OPENROUTER ? 'OpenRouter' : 'Anthropic'} (${MODELS.join(' → ')})${DRY_RUN ? ' (DRY RUN)' : ''}`);
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

  // Build the headlines prompt. Include the REAL feed URL for every candidate:
  // the model is told to cite only these URLs, verbatim, which (with the
  // allow-list check in the validation gate) makes a fabricated citation
  // impossible to publish - the old failure mode that put invented domains
  // like "FreeFable.org" on the public site.
  const candidates = allItems
    .sort((a, b) => parseFloat(a.hoursAgo) - parseFloat(b.hoursAgo)) // newest first
    .slice(0, 40); // cap to avoid token overflow
  const headlinesList = candidates
    .map(item => `[${item.source} · ${item.hoursAgo}h ago] ${item.title}\n  ${item.desc}\n  URL: ${item.link}`)
    .join('\n\n');

  // Allow-list of citable URLs (normalised), enforced by the validation gate.
  const allowedUrls = new Set();
  for (const i of candidates) { try { allowedUrls.add(normalizeUrl(i.link)); } catch { /* skip unparseable */ } }

  // Personalization: bias selection toward the reader's interests, if present.
  const interests = loadInterests();
  const focusBlock = interests ? buildReaderFocus(interests) : '';
  if (interests) console.log(`[news] Reader focus loaded (${(interests.emphasis || interests.topics || []).length} emphasis topics)`);
  else console.log('[news] No interests.json - using the static curation prompt');

  // Freshness: tell the model what it already covered so a multi-day story is
  // not re-reported every morning (the staleness the feed used to have).
  const recent = loadRecentBriefings(6);
  const recentBlock = recent.length
    ? `\n\nALREADY COVERED in the last ${recent.length} briefings. Do NOT re-report any of these unless today brings a genuinely NEW, material development (a new fact, not just a fresh article rehashing the same one). Prefer stories the reader has not seen yet:\n${recent.map(r => `- (${r.date}) ${r.title}`).join('\n')}`
    : '';
  if (recent.length) console.log(`[news] Dedup context: ${recent.length} recent briefings loaded`);

  const userPrompt = `Today is ${TODAY}.${focusBlock}${recentBlock}

Here are the candidate headlines from the last 36 hours across vetted AI publications. Cite ONLY the URLs shown here, copied exactly:

${headlinesList}

Write the daily briefing following the instructions exactly. Return only valid JSON.`;

  if (EMIT_PROMPT) {
    const fullPrompt = `${CURATION_PROMPT}\n\n${userPrompt}`;
    await writeFile(resolve(REPO_ROOT, 'scripts/news/.dryrun-prompt.txt'), fullPrompt, 'utf-8');
    await writeFile(resolve(REPO_ROOT, 'scripts/news/.dryrun-allowed.json'), JSON.stringify([...allowedUrls], null, 2), 'utf-8');
    console.log(`[news] --emit-prompt: prompt ${fullPrompt.length} chars · ${allowedUrls.size} citable URLs · ${candidates.length} candidates · ${recent.length} recent briefings in dedup context`);
    return;
  }

  // Generate → validate, retrying with corrective feedback. A cheap/weak model
  // (Haiku, or a free OpenRouter model) occasionally slips on a mechanical rule
  // — most often mismatched sources/sourceUrls counts, or an em-dash — which the
  // validator (correctly) rejects. Rather than silently skip the whole day, feed
  // the exact failures back and let the model fix them. Only give up (exit 1,
  // which the workflow now surfaces as a RED, notified run) if every attempt
  // fails — no more silent freezes on a stale briefing.
  const MAX_ATTEMPTS = 3;
  const basePrompt = `${CURATION_PROMPT}\n\n${userPrompt}`;
  let parsed = null;
  let lastProblems = [];
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const correction = attempt === 1 ? '' : `

YOUR PREVIOUS ATTEMPT WAS REJECTED for these reasons:
 - ${lastProblems.join('\n - ')}

Fix ALL of them and regenerate. In particular: "sources" and "sourceUrls" MUST be arrays of exactly the same length — one source name per URL, in the same order. Cite ONLY URLs from the candidate list above, copied verbatim. Never use an em-dash (—); use a regular hyphen. Return only valid JSON.`;
    console.log(`[news] Calling model (attempt ${attempt}/${MAX_ATTEMPTS})…`);
    const raw = await callModel(basePrompt + correction);
    const draft = extractDraftJson(raw);
    if (!draft) {
      lastProblems = ['response was not parseable JSON'];
      console.warn(`[news] Attempt ${attempt}/${MAX_ATTEMPTS}: unparseable JSON`);
      continue;
    }
    const problems = validateDraft(draft, allowedUrls);
    if (problems.length === 0) { parsed = draft; break; }
    lastProblems = problems;
    console.warn(`[news] Attempt ${attempt}/${MAX_ATTEMPTS} failed validation:\n - ${problems.join('\n - ')}`);
  }
  if (parsed === null) {
    console.error(`[news] Draft failed validation after ${MAX_ATTEMPTS} attempts — NOT writing:\n - ${lastProblems.join('\n - ')}`);
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
  console.log(`[news] Cost: ${USE_OPENROUTER ? '$0.00 (OpenRouter free tier)' : '~$0.01-0.02 (Haiku 4.5 call)'}`);
}

main().catch(e => { console.error('[news] Fatal:', e); process.exit(1); });
