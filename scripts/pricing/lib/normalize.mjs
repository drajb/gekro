/**
 * normalize.mjs — cross-platform model SKU mapping
 *
 * Each hyperscaler names the same underlying foundation model differently:
 *   AWS Bedrock:  "anthropic.claude-3-5-sonnet-20241022-v2:0"
 *   GCP Vertex:   "claude-3-5-sonnet-v2@20241022"
 *   Azure Foundry: (Anthropic not offered)
 *
 * This file is the AUTHORITATIVE mapping. When a fetcher pulls down a SKU
 * from a vendor pricing API, it looks the SKU up here to find the canonical
 * model ID (e.g. "anthropic/claude-3-5-sonnet"), which is what we use in
 * hyperscaler-pricing.json.
 *
 * Adding a new model: add a row here AND add a model entry in
 * hyperscaler-pricing.json. The fetchers ignore SKUs they don't recognize —
 * intentional, so vendor pricing APIs returning hundreds of unrelated SKUs
 * (image gen, embeddings, fine-tuning, regional variants) don't pollute
 * the comparison.
 */

/** @type {Record<string, { canonicalId: string, platform: 'aws_bedrock' | 'azure_foundry' | 'gcp_vertex' }>} */
export const SKU_TO_CANONICAL = {
  // ── Anthropic ─────────────────────────────────────────────────────────
  'anthropic.claude-3-5-sonnet-20241022-v2:0':       { canonicalId: 'anthropic/claude-3-5-sonnet', platform: 'aws_bedrock' },
  'claude-3-5-sonnet-v2@20241022':                   { canonicalId: 'anthropic/claude-3-5-sonnet', platform: 'gcp_vertex' },

  'anthropic.claude-3-5-haiku-20241022-v1:0':        { canonicalId: 'anthropic/claude-3-5-haiku', platform: 'aws_bedrock' },
  'claude-3-5-haiku@20241022':                       { canonicalId: 'anthropic/claude-3-5-haiku', platform: 'gcp_vertex' },

  // ── OpenAI (Azure Foundry only) ───────────────────────────────────────
  'gpt-4o-2024-11-20':                               { canonicalId: 'openai/gpt-4o', platform: 'azure_foundry' },
  'gpt-4o-mini-2024-07-18':                          { canonicalId: 'openai/gpt-4o-mini', platform: 'azure_foundry' },

  // ── Google (Vertex only) ──────────────────────────────────────────────
  'gemini-2.5-pro':                                  { canonicalId: 'google/gemini-2-5-pro', platform: 'gcp_vertex' },
  'gemini-2.5-flash':                                { canonicalId: 'google/gemini-2-5-flash', platform: 'gcp_vertex' },

  // ── Meta Llama (all three platforms) ──────────────────────────────────
  'meta.llama3-3-70b-instruct-v1:0':                 { canonicalId: 'meta/llama-3-3-70b', platform: 'aws_bedrock' },
  'Meta-Llama-3.3-70B-Instruct':                     { canonicalId: 'meta/llama-3-3-70b', platform: 'azure_foundry' },
  'llama-3.3-70b-instruct':                          { canonicalId: 'meta/llama-3-3-70b', platform: 'gcp_vertex' },

  // ── Mistral (all three platforms) ─────────────────────────────────────
  'mistral.mistral-large-2407-v1:0':                 { canonicalId: 'mistral/mistral-large-2', platform: 'aws_bedrock' },
  'Mistral-large-2407':                              { canonicalId: 'mistral/mistral-large-2', platform: 'azure_foundry' },
  'mistral-large-2':                                 { canonicalId: 'mistral/mistral-large-2', platform: 'gcp_vertex' },
};

/**
 * Look up a canonical model ID from a vendor SKU.
 * Returns null if the SKU isn't tracked (intentional — we only track top models).
 *
 * @param {string} vendorSku
 * @returns {{ canonicalId: string, platform: string } | null}
 */
export function resolveCanonical(vendorSku) {
  return SKU_TO_CANONICAL[vendorSku] ?? null;
}
