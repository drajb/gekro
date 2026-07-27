#!/usr/bin/env node
/**
 * validate-pricing.mjs — safety gate for the auto-committed pricing file.
 *
 * WHY THIS EXISTS
 *  The weekly pricing job used to open a PR, so a human read the diff before it
 *  reached `main`. In practice nobody did: PR #22 sat unmerged for 8 weeks and
 *  the shipped data silently froze at 2026-06-01 while the workflow reported
 *  success every Monday. The job now commits straight to `main` — which removes
 *  the review gate, so this replaces it with an automated one.
 *
 *  It compares the freshly written file against the version currently committed
 *  and refuses the commit on anything that looks like a fetcher malfunction
 *  rather than a real price move. Failing here leaves `main` on the last good
 *  data, which is the safe direction: stale-but-correct beats confidently wrong.
 *
 * USAGE
 *  node scripts/pricing/validate-pricing.mjs <new.json> <previous.json>
 *  Exits 0 when safe to commit, 1 with an explanation otherwise.
 */
import { readFileSync } from 'node:fs';

const [, , newPath, prevPath] = process.argv;
if (!newPath) {
  console.error('[validate] usage: validate-pricing.mjs <new.json> [previous.json]');
  process.exit(1);
}

/** A single fetcher outage must not be able to wipe the catalog. */
const MAX_MODEL_DROP_RATIO = 0.2;
/** Real prices drift by cents. A 5x jump is a unit error (per-1k vs per-1M) or a bad parse. */
const MAX_PRICE_MULTIPLE = 5;
/** Nothing legitimately costs more than this per 1M tokens; catches decimal slips. */
const ABSURD_PRICE_USD = 1000;

const load = (p, label) => {
  try {
    return JSON.parse(readFileSync(p, 'utf8'));
  } catch (e) {
    console.error(`[validate] ${label} is not parseable JSON: ${e.message}`);
    process.exit(1);
  }
};

const next = load(newPath, 'new file');
const prev = prevPath ? (() => { try { return load(prevPath, 'previous file'); } catch { return null; } })() : null;

const errors = [];
const warnings = [];

// ── Structure ────────────────────────────────────────────────────────────────
if (!Array.isArray(next.models) || next.models.length === 0) {
  errors.push('models[] is missing or empty');
}
if (!next.last_run || Number.isNaN(Date.parse(next.last_run))) {
  errors.push(`last_run is missing or unparseable: ${JSON.stringify(next.last_run)}`);
}

// ── Per-model / per-platform price sanity ────────────────────────────────────
const priceOf = (m, plat) => m?.platforms?.[plat];
const platformsOf = (m) => Object.keys(m.platforms ?? {});

for (const m of next.models ?? []) {
  if (!m.id) { errors.push('a model entry has no id'); continue; }
  for (const plat of platformsOf(m)) {
    const p = priceOf(m, plat);
    if (!p || p.available !== true) continue; // unavailable entries carry no prices
    for (const field of ['input_per_1m_usd', 'output_per_1m_usd']) {
      const v = p[field];
      if (typeof v !== 'number' || !Number.isFinite(v)) {
        errors.push(`${m.id} / ${plat}: ${field} is not a finite number (${JSON.stringify(v)})`);
      } else if (v < 0) {
        errors.push(`${m.id} / ${plat}: ${field} is negative (${v})`);
      } else if (v > ABSURD_PRICE_USD) {
        errors.push(`${m.id} / ${plat}: ${field} = ${v} exceeds $${ABSURD_PRICE_USD}/1M — likely a unit error`);
      }
    }
  }
}

// ── Comparison against the currently committed data ──────────────────────────
if (prev && Array.isArray(prev.models)) {
  const before = prev.models.length;
  const after = next.models?.length ?? 0;
  if (before > 0 && after < before * (1 - MAX_MODEL_DROP_RATIO)) {
    errors.push(`model count fell ${before} -> ${after} (>${MAX_MODEL_DROP_RATIO * 100}%) — looks like a fetcher outage, not a catalog change`);
  }

  const prevById = new Map(prev.models.map((m) => [m.id, m]));
  for (const m of next.models ?? []) {
    const old = prevById.get(m.id);
    if (!old) continue;
    for (const plat of platformsOf(m)) {
      const a = priceOf(old, plat);
      const b = priceOf(m, plat);
      if (!a?.available || !b?.available) continue;
      for (const field of ['input_per_1m_usd', 'output_per_1m_usd']) {
        const x = a[field], y = b[field];
        if (typeof x !== 'number' || typeof y !== 'number' || x <= 0 || y <= 0) continue;
        const mult = y > x ? y / x : x / y;
        if (mult >= MAX_PRICE_MULTIPLE) {
          errors.push(`${m.id} / ${plat}: ${field} moved ${x} -> ${y} (${mult.toFixed(1)}x) — beyond a plausible price change`);
        }
      }
    }
  }

  // Losing availability everywhere is usually an API hiccup, not a delisting.
  const availCount = (doc) => (doc.models ?? []).reduce(
    (n, m) => n + platformsOf(m).filter((p) => priceOf(m, p)?.available === true).length, 0);
  const aBefore = availCount(prev), aAfter = availCount(next);
  const massDelisting = aBefore > 0 && aAfter < aBefore * (1 - MAX_MODEL_DROP_RATIO);
  if (massDelisting) {
    errors.push(`available SKUs fell ${aBefore} -> ${aAfter} (>${MAX_MODEL_DROP_RATIO * 100}%) — refusing to publish a mass delisting`);
  } else if (aAfter < aBefore) {
    // Only call it tolerable when it actually is, or the note contradicts the error.
    warnings.push(`available SKUs ${aBefore} -> ${aAfter} (within tolerance)`);
  }
}

for (const w of warnings) console.log(`[validate] note: ${w}`);

if (errors.length) {
  console.error(`[validate] REFUSING to commit — ${errors.length} problem(s):`);
  for (const e of errors) console.error(`  - ${e}`);
  console.error('[validate] main keeps the last good pricing data.');
  process.exit(1);
}

console.log(`[validate] OK — ${next.models.length} models, prices within sane bounds.`);
