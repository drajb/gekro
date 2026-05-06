/**
 * normalize.mjs — cross-platform model SKU mapping (refreshed 2026-05-06)
 *
 * Each hyperscaler names the same underlying foundation model differently.
 * THIS IS THE BRIDGE: vendor SKU → canonical model ID.
 *
 * SKU naming conventions per platform (verified against live API May 2026):
 *
 *   AWS Bedrock — uses HUMAN-READABLE names in attributes.model:
 *     "Llama 4 Maverick 17B", "Nova 2.0 Pro", "DeepSeek v3.2", "GLM 5"
 *     Match: exact substring against attributes.model
 *
 *   Azure AI Foundry — uses cryptic skuName + productName combo:
 *     productName="Azure Deepseek Models", skuName="V3.2 Inp DZ"
 *     productName="Azure Deepseek Models", skuName="R1 Outp glbl"
 *     Match: substring against `${productName} ${skuName}` haystack
 *     Pricing variants: "Inp"/"Outp" = input/output, "glbl" = global (cheapest),
 *                       "regnl" = regional, "DZone"/"DZ" = data zone
 *     We track "glbl" (global) where available — the standard choice.
 *
 *   GCP Vertex AI — uses descriptive strings in sku.description:
 *     "Gemini 2.5 Pro Input Tokens", "Claude Opus 4 Output Tokens"
 *     Match: substring against description
 *
 * Adding a new model: add ALL platform variants here, then add a model entry
 * in hyperscaler-pricing.json. The fetchers ignore SKUs not in this map —
 * intentional, keeps the comparison focused on top models.
 */

/** @type {Record<string, { canonicalId: string, platform: 'aws_bedrock' | 'azure_foundry' | 'gcp_vertex' }>} */
export const SKU_TO_CANONICAL = {
  // ── Meta Llama 4 (latest, on multiple platforms) ─────────────────────────
  'Llama 4 Maverick 17B':                            { canonicalId: 'meta/llama-4-maverick-17b', platform: 'aws_bedrock' },
  'Llama 4 Scout 17B':                               { canonicalId: 'meta/llama-4-scout-17b',    platform: 'aws_bedrock' },

  // ── Meta Llama 3.3 (broad cross-platform) ────────────────────────────────
  'Llama 3.3 70B':                                   { canonicalId: 'meta/llama-3-3-70b', platform: 'aws_bedrock' },

  // ── DeepSeek (cross-platform AWS + Azure) ────────────────────────────────
  'DeepSeek v3.2':                                   { canonicalId: 'deepseek/v3-2', platform: 'aws_bedrock' },
  'DeepSeek V3.1':                                   { canonicalId: 'deepseek/v3-1', platform: 'aws_bedrock' },
  // AWS calls DeepSeek R1 just "R1" in model attribute — match exact + provider check at fetcher level
  'R1':                                              { canonicalId: 'deepseek/r1',   platform: 'aws_bedrock' },

  // Azure Foundry DeepSeek SKUs — match against productName + skuName combo
  'Azure Deepseek Models V3.2 Inp':                  { canonicalId: 'deepseek/v3-2', platform: 'azure_foundry' },
  'Azure Deepseek Models V3.2 Outp':                 { canonicalId: 'deepseek/v3-2', platform: 'azure_foundry' },
  'Azure Deepseek Models V3.1 Inp glbl':             { canonicalId: 'deepseek/v3-1', platform: 'azure_foundry' },
  'Azure Deepseek Models V3.1 Outp glbl':            { canonicalId: 'deepseek/v3-1', platform: 'azure_foundry' },
  'Azure Deepseek Models R1 Inp glbl':               { canonicalId: 'deepseek/r1',   platform: 'azure_foundry' },
  'Azure Deepseek Models R1 Outp glbl':              { canonicalId: 'deepseek/r1',   platform: 'azure_foundry' },

  // ── Mistral Large 3 (cross-platform AWS confirmed) ───────────────────────
  'Mistral Large 3':                                 { canonicalId: 'mistral/large-3', platform: 'aws_bedrock' },

  // ── Amazon Nova (Bedrock-exclusive) ──────────────────────────────────────
  'Nova 2.0 Pro':                                    { canonicalId: 'amazon/nova-2-0-pro',   platform: 'aws_bedrock' },
  'Nova Premier':                                    { canonicalId: 'amazon/nova-premier',   platform: 'aws_bedrock' },
  'Nova Micro':                                      { canonicalId: 'amazon/nova-micro',     platform: 'aws_bedrock' },

  // ── Z AI GLM (Bedrock confirmed; may be elsewhere) ───────────────────────
  'GLM 5':                                           { canonicalId: 'zai/glm-5', platform: 'aws_bedrock' },

  // ── Open-weights tier (cheap option) ─────────────────────────────────────
  'gpt-oss-120b':                                    { canonicalId: 'openai/gpt-oss-120b',   platform: 'aws_bedrock' },
  'Qwen3 32B':                                       { canonicalId: 'qwen/qwen3-32b',        platform: 'aws_bedrock' },

  // ── GCP Vertex (placeholders — fill in once GCP discovery returns model SKUs) ──
  // The current discovery shows GKE infrastructure SKUs, not generative models.
  // After re-running discovery with the improved filter, populate Vertex SKUs here
  // for: Gemini 3.x Pro/Flash, Claude (now on Vertex), Llama 4, etc.
};

/**
 * Look up a canonical model ID from a vendor SKU.
 * Returns null if the SKU isn't tracked.
 *
 * @param {string} vendorSku
 * @returns {{ canonicalId: string, platform: string } | null}
 */
export function resolveCanonical(vendorSku) {
  return SKU_TO_CANONICAL[vendorSku] ?? null;
}
