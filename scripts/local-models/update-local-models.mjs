#!/usr/bin/env node
/**
 * update-local-models.mjs — keep local-models.json fresh against HuggingFace
 *
 * What this does, in order:
 *   1. Reads the canonical apps/web/src/content/data/local-models.json
 *   2. For each model with an `hf_id` field, hits the HuggingFace API:
 *        - GET https://huggingface.co/api/models/{hf_id}
 *          → license, downloads, last_modified, library, tags
 *        - GET https://huggingface.co/{hf_id}/raw/main/config.json
 *          → architecture (num_hidden_layers, hidden_size, num_attention_heads,
 *            num_key_value_heads, head_dim, intermediate_size, etc.)
 *          + max_position_embeddings (context_window)
 *   3. Merges fetched values into the JSON, only OVERWRITING fields that
 *      look clearly stale or wrong. Manual edits (notes, ollama_tag, type
 *      tags, supports flags) are preserved.
 *   4. Bumps `last_verified` on each refreshed model.
 *   5. Bumps top-level `last_updated` to today.
 *   6. Writes file back if anything changed (the GH Actions workflow's
 *      `git status` then drives the PR creation).
 *
 * What this DOESN'T do (deliberate v1 scope):
 *   - Add new models not already in the JSON. The HF leaderboard has tens
 *     of thousands of models; auto-adding would dilute the curated catalog.
 *     New models stay a manual-PR decision.
 *   - Touch models without an hf_id. A few entries in the JSON are
 *     hand-curated (e.g. some hardware-specific variants) and don't map
 *     cleanly to a single HF repo.
 *   - Replace `notes`. The notes are editorial color, not API data.
 *
 * Run locally:
 *   node scripts/local-models/update-local-models.mjs
 *
 * Run with HF auth token for higher rate limits (recommended for CI):
 *   HF_TOKEN=hf_xxxxx node scripts/local-models/update-local-models.mjs
 *
 * Dry run (logs proposed changes, doesn't write):
 *   node scripts/local-models/update-local-models.mjs --dry-run
 *
 * Output: prints a summary to stdout. Writes (or doesn't, in --dry-run) to
 * apps/web/src/content/data/local-models.json. The GH Action's `git status`
 * step picks up the diff and triggers PR creation.
 */

import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { fetchHfModelMeta, fetchHfConfigJson } from './lib/fetch-hf.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const JSON_PATH = resolve(__dirname, '../../apps/web/src/content/data/local-models.json');

const DRY_RUN = process.argv.includes('--dry-run');
const TODAY = new Date().toISOString().slice(0, 10);

// ── Helpers ───────────────────────────────────────────────────────────────
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

/**
 * Map a HuggingFace `config.json` to the architecture fields we use in
 * local-models.json. Different model families use different key names —
 * Llama uses `num_hidden_layers`, Mistral the same, Qwen the same, but
 * Phi uses `n_layer`, Gemma uses some Gemma-specific keys, etc.
 * This function normalises across the common variants.
 */
function configToArchitecture(config) {
  const layers = config.num_hidden_layers ?? config.n_layer ?? config.num_layers;
  const hidden = config.hidden_size ?? config.n_embd ?? config.d_model;
  const heads = config.num_attention_heads ?? config.n_head ?? config.num_heads;
  const kvHeads = config.num_key_value_heads ?? heads;
  const headDim = config.head_dim ?? (hidden && heads ? Math.round(hidden / heads) : undefined);
  const intermediate = config.intermediate_size ?? config.ffn_dim;
  const ctx = config.max_position_embeddings ?? config.n_positions ?? config.max_sequence_length;
  const numExperts = config.num_local_experts ?? config.num_experts ?? config.n_routed_experts;
  const expertsPerToken = config.num_experts_per_tok ?? config.num_experts_per_token;
  return {
    layers: isNum(layers) ? layers : undefined,
    hidden_dim: isNum(hidden) ? hidden : undefined,
    kv_heads: isNum(kvHeads) ? kvHeads : undefined,
    head_dim: isNum(headDim) ? headDim : undefined,
    intermediate_dim: isNum(intermediate) ? intermediate : undefined,
    num_experts: isNum(numExperts) ? numExperts : undefined,
    experts_per_token: isNum(expertsPerToken) ? expertsPerToken : undefined,
    context_window: isNum(ctx) ? ctx : undefined,
  };
}

/**
 * Decide whether `proposed` value should replace `current`. Returns null
 * if no change is justified, otherwise returns the new value.
 * Conservative: only replaces when both values exist and differ AND the
 * proposed value isn't obviously wrong.
 */
function justifyOverride(current, proposed, fieldName) {
  if (proposed === undefined || proposed === null) return null;
  if (current === proposed) return null;
  if (current === undefined || current === null || current === '') return proposed; // fill missing
  if (typeof current === 'number' && typeof proposed === 'number') {
    // Sanity: don't accept a wildly smaller layer count etc. unless the
    // delta is small. Architecture values rarely change for a given model.
    if (current > 0 && proposed > 0 && Math.abs(proposed - current) / current > 0.5) {
      console.log(`  ⚠ Skipping ${fieldName}: ${current} → ${proposed} (>50% delta, likely wrong fetched value)`);
      return null;
    }
  }
  return proposed;
}

// ── Main ──────────────────────────────────────────────────────────────────
async function main() {
  console.log(`[update-local-models] ${DRY_RUN ? 'DRY RUN — ' : ''}Reading ${JSON_PATH}`);
  const raw = await readFile(JSON_PATH, 'utf-8');
  const data = JSON.parse(raw);

  const models = data.models || [];
  console.log(`[update-local-models] Catalog: ${models.length} models, ${models.filter(m => m.hf_id).length} with hf_id`);

  let refreshed = 0;
  let changedFields = 0;
  let errored = 0;

  for (const model of models) {
    if (!model.hf_id) {
      console.log(`  · ${model.id}: skip (no hf_id)`);
      continue;
    }

    try {
      console.log(`  · ${model.id} (${model.hf_id})`);
      const [meta, config] = await Promise.all([
        fetchHfModelMeta(model.hf_id),
        fetchHfConfigJson(model.hf_id),
      ]);

      // ── License ──
      if (meta?.cardData?.license || meta?.license) {
        const proposed = meta.cardData?.license || meta.license;
        // The HF license slug is e.g. "apache-2.0" — normalise common ones
        const normalized = ({
          'apache-2.0': 'Apache-2.0',
          'mit': 'MIT',
          'llama3.1': 'Llama-3-Community',
          'llama3.2': 'Llama-3-Community',
          'llama3.3': 'Llama-3-Community',
          'llama4': 'Llama-4-Community',
          'gemma': 'Gemma-Terms-of-Use',
        })[proposed.toLowerCase()] || proposed;
        const override = justifyOverride(model.license, normalized, 'license');
        if (override !== null) { model.license = override; changedFields++; }
      }

      // ── Architecture from config.json ──
      if (config) {
        const arch = configToArchitecture(config);
        model.architecture = model.architecture || {};
        for (const key of ['layers', 'hidden_dim', 'kv_heads', 'head_dim', 'intermediate_dim', 'num_experts', 'experts_per_token']) {
          const override = justifyOverride(model.architecture[key], arch[key], `architecture.${key}`);
          if (override !== null) { model.architecture[key] = override; changedFields++; }
        }
        // context_window lives at top level, not inside architecture
        const ctxOverride = justifyOverride(model.context_window, arch.context_window, 'context_window');
        if (ctxOverride !== null) { model.context_window = ctxOverride; changedFields++; }
      }

      model.last_verified = TODAY;
      refreshed++;
    } catch (e) {
      console.log(`    ✗ ${model.id}: ${e.message}`);
      errored++;
    }

    // Be polite to the HF API. 50 ms gap = ~20 req/s, well under any limit.
    await new Promise(r => setTimeout(r, 50));
  }

  data.last_updated = TODAY;

  console.log(`\n[update-local-models] Refreshed ${refreshed}/${models.length} models, ${changedFields} field changes, ${errored} errors`);

  if (DRY_RUN) {
    console.log('[update-local-models] --dry-run: NOT writing file');
    return;
  }

  await writeFile(JSON_PATH, JSON.stringify(data, null, 2) + '\n', 'utf-8');
  console.log(`[update-local-models] Wrote ${JSON_PATH}`);
}

main().catch(e => {
  console.error('[update-local-models] fatal:', e);
  process.exit(1);
});
