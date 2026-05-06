#!/usr/bin/env node
/**
 * update-pricing.mjs — orchestrator for the hyperscaler pricing pipeline
 *
 * What this does, in order:
 *   1. Reads the canonical pricing JSON (current source of truth)
 *   2. Calls all three platform fetchers in parallel
 *   3. Merges fetched observations into the JSON (overwriting only changed prices)
 *   4. For each price that changed, bumps `last_verified` and sets `verified_via: "api"`
 *   5. Writes the file back if anything changed
 *   6. Exits 0 either way — the GitHub Actions workflow then uses `git status`
 *      to decide whether to open a PR
 *
 * Run locally:
 *   node scripts/pricing/update-pricing.mjs
 *
 * Run with GCP enabled:
 *   GCP_BILLING_API_KEY=xxx node scripts/pricing/update-pricing.mjs
 *
 * Run discovery mode (lists all available models per platform — use this
 * when refreshing the seed data after a vendor catalogue rotation):
 *   node scripts/pricing/update-pricing.mjs --discover
 *
 * Output: prints a summary to stdout. Writes to apps/web/src/content/data/
 *   hyperscaler-pricing.json. The GitHub Action's `git status` step picks up
 *   the diff (if any) and triggers PR creation via peter-evans/create-pull-request.
 */

import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { fetchAzurePricing } from './lib/fetch-azure.mjs';
import { fetchAWSPricing } from './lib/fetch-aws.mjs';
import { fetchGCPPricing } from './lib/fetch-gcp.mjs';

// Resolve the canonical JSON path relative to this script (so the script works
// regardless of cwd — invoked from repo root in CI, from anywhere locally).
const __dirname = dirname(fileURLToPath(import.meta.url));
const PRICING_JSON_PATH = resolve(__dirname, '../../apps/web/src/content/data/hyperscaler-pricing.json');

const TODAY = new Date().toISOString().slice(0, 10);  // 'YYYY-MM-DD'

async function main() {
  const isDiscover = process.argv.includes('--discover');
  if (isDiscover) {
    return discoverMode();
  }

  console.log(`\n=== Hyperscaler Pricing Update — ${TODAY} ===\n`);

  // 1. Read current canonical state
  const raw = await readFile(PRICING_JSON_PATH, 'utf-8');
  const current = JSON.parse(raw);

  // 2. Fetch from all three platforms in parallel
  console.log('Fetching pricing from all three platforms in parallel…\n');
  const [azure, aws, gcp] = await Promise.all([
    fetchAzurePricing(),
    fetchAWSPricing(),
    fetchGCPPricing(),
  ]);

  const observations = [
    ...azure.map(o => ({ ...o, platform: 'azure_foundry' })),
    ...aws.map(o => ({ ...o, platform: 'aws_bedrock' })),
    ...gcp.map(o => ({ ...o, platform: 'gcp_vertex' })),
  ];

  console.log(`\nTotal observations: ${observations.length} (azure=${azure.length}, aws=${aws.length}, gcp=${gcp.length})\n`);

  // 3. Merge observations into the canonical structure
  let changeCount = 0;
  const changes = [];

  for (const obs of observations) {
    const model = current.models.find(m => m.id === obs.canonicalId);
    if (!model) {
      console.warn(`  ⚠ Observation for unknown canonical model "${obs.canonicalId}" — ignoring`);
      continue;
    }
    const platformBlock = model.platforms[obs.platform];
    if (!platformBlock || !platformBlock.available) {
      console.warn(`  ⚠ Observation for ${obs.canonicalId} on ${obs.platform} but model marked unavailable — ignoring`);
      continue;
    }

    const priceField = obs.side === 'input' ? 'input_per_1m_usd' : 'output_per_1m_usd';
    const oldValue = platformBlock[priceField];
    const newValue = obs.usdPer1M;

    if (Math.abs(oldValue - newValue) > 0.0001) {
      changes.push({
        model: obs.canonicalId,
        platform: obs.platform,
        side: obs.side,
        old: oldValue,
        new: newValue,
        delta_pct: oldValue ? ((newValue - oldValue) / oldValue * 100).toFixed(1) : 'N/A',
      });
      platformBlock[priceField] = newValue;
      changeCount += 1;
    }

    // Always update verification metadata when an API observation arrives,
    // even if the price didn't change — proves the API still confirms the value.
    platformBlock.last_verified = TODAY;
    platformBlock.verified_via = 'api';
  }

  // 4. Update top-level last_run timestamp
  current.last_run = new Date().toISOString();

  // 5. Print human-readable summary
  if (changes.length === 0) {
    console.log('✓ No pricing changes detected. All tracked models are stable.');
  } else {
    console.log(`\n${changes.length} price change(s) detected:\n`);
    for (const c of changes) {
      const arrow = c.new > c.old ? '↑' : '↓';
      console.log(`  ${arrow} ${c.model}  ${c.platform}/${c.side}: $${c.old} → $${c.new} per 1M tokens (${c.delta_pct}%)`);
    }
    console.log('');
  }

  // 6. Write back if anything (price OR last_run) changed.
  // Note: last_run always changes, so the file always rewrites — but if no
  // prices changed, only the timestamp differs. The GitHub Action's diff step
  // checks for SUBSTANTIVE changes (see workflow YAML).
  await writeFile(PRICING_JSON_PATH, JSON.stringify(current, null, 2) + '\n', 'utf-8');
  console.log(`Wrote ${PRICING_JSON_PATH}`);
  console.log(`\n=== Done ===\n`);
}

/**
 * Discovery mode — dumps every model name found in each platform's pricing
 * data, with input/output prices. Use this to refresh normalize.mjs and the
 * seed JSON when a vendor catalogue rotates (which they do every 3-6 months).
 *
 * No filtering by tracked SKUs — shows EVERYTHING the platform offers.
 */
async function discoverMode() {
  console.log(`\n=== Discovery mode — what's available on each platform ===\n`);

  // AWS Bedrock — has the cleanest discovery
  console.log('--- AWS Bedrock ---');
  try {
    const r = await fetch('https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/AmazonBedrock/current/us-east-1/index.json');
    const d = await r.json();
    /** @type {Map<string, {provider: string, hasInput: boolean, hasOutput: boolean}>} */
    const models = new Map();
    for (const product of Object.values(d.products ?? {})) {
      const a = /** @type {any} */ (product).attributes ?? {};
      const name = a.model;
      const inferenceType = (a.inferenceType ?? '').toLowerCase();
      if (!name) continue;
      if (!models.has(name)) models.set(name, { provider: a.provider ?? '?', hasInput: false, hasOutput: false });
      const entry = /** @type {any} */ (models.get(name));
      if (inferenceType.includes('input')) entry.hasInput = true;
      if (inferenceType.includes('output')) entry.hasOutput = true;
    }
    /** @type {[string, any][]} */
    const sorted = [...models.entries()].sort((a, b) => a[1].provider.localeCompare(b[1].provider) || a[0].localeCompare(b[0]));
    for (const [name, info] of sorted) {
      const flags = `${info.hasInput ? 'I' : '-'}${info.hasOutput ? 'O' : '-'}`;
      console.log(`  [${flags}] ${(info.provider || '?').padEnd(15)} ${name}`);
    }
    console.log(`  (${models.size} models, I=has input pricing, O=has output pricing)\n`);
  } catch (err) {
    console.error('  AWS discovery failed:', err.message);
  }

  // Azure Foundry — paginate fully, no truncation
  console.log('--- Azure AI Foundry ---');
  try {
    /** @type {any[]} */
    const allItems = [];
    let url = `https://prices.azure.com/api/retail/prices?$filter=${encodeURIComponent("serviceName eq 'Foundry Models' and armRegionName eq 'eastus' and type eq 'Consumption'")}`;
    let safety = 0;
    while (url && safety < 50) {
      safety += 1;
      const r = await fetch(url);
      const d = await r.json();
      allItems.push(...(d.Items ?? []));
      url = d.NextPageLink ?? null;
    }
    /** @type {Set<string>} */
    const productNames = new Set();
    for (const item of allItems) productNames.add(`${item.productName} :: ${item.skuName}`);
    for (const name of [...productNames].sort()) {
      console.log(`  ${name}`);
    }
    console.log(`  (${productNames.size} unique product/sku combinations across ${allItems.length} rows)\n`);
  } catch (err) {
    console.error('  Azure discovery failed:', err.message);
  }

  // GCP — paginate fully, filter to only model-related SKUs (the catalog
  // returns infrastructure SKUs too — GKE/Autopilot/Compute — which dominate
  // by count but aren't what we want. Filter heuristic: description contains
  // "Token" OR a known model family keyword.
  console.log('--- GCP Vertex AI ---');
  if (!process.env.GCP_BILLING_API_KEY) {
    console.log('  (skipped — set GCP_BILLING_API_KEY to discover)');
  } else {
    try {
      /** @type {any[]} */
      const allSkus = [];
      let pageToken = '';
      let safety = 0;
      while (safety < 50) {
        safety += 1;
        const url = `https://cloudbilling.googleapis.com/v1/services/CCD8-9BF1-090E/skus?key=${process.env.GCP_BILLING_API_KEY}&pageSize=500${pageToken ? `&pageToken=${pageToken}` : ''}`;
        const r = await fetch(url);
        const d = await r.json();
        allSkus.push(...(d.skus ?? []));
        pageToken = d.nextPageToken ?? '';
        if (!pageToken) break;
      }
      // Heuristic filter — model-like SKUs only
      const modelKeywords = /token|gemini|claude|llama|mistral|deepseek|gemma|qwen|grok|nova/i;
      const modelSkus = allSkus.filter(s => modelKeywords.test(s.description ?? ''));
      const sortedDescs = [...new Set(modelSkus.map(s => s.description))].sort();
      for (const desc of sortedDescs) {
        console.log(`  ${desc}`);
      }
      console.log(`  (${modelSkus.length} model SKUs filtered from ${allSkus.length} total Vertex SKUs)\n`);
    } catch (err) {
      console.error('  GCP discovery failed:', err.message);
    }
  }

  console.log('Done. Use this output to update normalize.mjs SKU keys + seed hyperscaler-pricing.json.\n');
}

main().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});
