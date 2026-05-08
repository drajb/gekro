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
  // AWS calls DeepSeek R1 just "R1" in model attribute — match exact + provider check at fetcher level
  'R1':                                              { canonicalId: 'deepseek/r1',   platform: 'aws_bedrock' },

  // Azure Foundry DeepSeek SKUs — match against productName + skuName combo
  'Azure Deepseek Models V3.2 Inp':                  { canonicalId: 'deepseek/v3-2', platform: 'azure_foundry' },
  'Azure Deepseek Models V3.2 Outp':                 { canonicalId: 'deepseek/v3-2', platform: 'azure_foundry' },
  'Azure Deepseek Models R1 Inp glbl':               { canonicalId: 'deepseek/r1',   platform: 'azure_foundry' },
  'Azure Deepseek Models R1 Outp glbl':              { canonicalId: 'deepseek/r1',   platform: 'azure_foundry' },

  // ── Azure Llama (cross-platform with Bedrock) ────────────────────────────
  // Verified live SKUs in eastus, global pricing tier ('glbl' = cheapest)
  'Azure Llama Models Llama 4 Maverick 17B Inp glbl':  { canonicalId: 'meta/llama-4-maverick-17b', platform: 'azure_foundry' },
  'Azure Llama Models Llama 4 Maverick 17B Outp glbl': { canonicalId: 'meta/llama-4-maverick-17b', platform: 'azure_foundry' },
  'Azure Llama Models Llama 3.3 70B Inp glbl':         { canonicalId: 'meta/llama-3-3-70b',        platform: 'azure_foundry' },
  'Azure Llama Models Llama 3.3 70B Outp glbl':        { canonicalId: 'meta/llama-3-3-70b',        platform: 'azure_foundry' },

  // ── Azure Mistral Large 3 (cross-platform with Bedrock) ──────────────────
  'Azure Mistral Models Large 3 Inp glbl':             { canonicalId: 'mistral/large-3', platform: 'azure_foundry' },
  'Azure Mistral Models Large 3 Outp glbl':            { canonicalId: 'mistral/large-3', platform: 'azure_foundry' },

  // ── Azure OpenAI GPT-5 family (Azure-exclusive) ──────────────────────────
  // Convention here is different: lowercase "inp"/"opt" instead of "Inp"/"Outp"
  // and "Gl" instead of "glbl". The "5 pp" / "5 mini pp" suffix indicates the
  // standard pay-per-token tier (vs PTU/provisioned).
  'Azure OpenAI GPT5 5 pp inp Gl':                     { canonicalId: 'openai/gpt-5',         platform: 'azure_foundry' },
  'Azure OpenAI GPT5 5 pp opt Gl':                     { canonicalId: 'openai/gpt-5',         platform: 'azure_foundry' },
  'Azure OpenAI GPT5 5 mini pp Inp Gl':                { canonicalId: 'openai/gpt-5-mini',    platform: 'azure_foundry' },
  'Azure OpenAI GPT5 5 mini pp Opt Gl':                { canonicalId: 'openai/gpt-5-mini',    platform: 'azure_foundry' },
  'Azure OpenAI GPT5 5.2 chat 0210 inp Gl':            { canonicalId: 'openai/gpt-5-2-chat',  platform: 'azure_foundry' },
  'Azure OpenAI GPT5 5.2 chat 0210 opt Gl':            { canonicalId: 'openai/gpt-5-2-chat',  platform: 'azure_foundry' },

  // ── Azure Grok 4.2 (xAI on Azure — Azure-exclusive among the three hyperscalers) ──
  'Azure Grok Models Grok 4.2 Inp glbl':               { canonicalId: 'xai/grok-4-2', platform: 'azure_foundry' },
  'Azure Grok Models Grok 4.2 Outp glbl':              { canonicalId: 'xai/grok-4-2', platform: 'azure_foundry' },

  // ── Azure Fireworks-hosted variants (cross-platform comparable to Bedrock direct) ──
  // Note: Fireworks uses "DZ" (data zone) tier — no glbl variant offered.
  // Comparing Bedrock-direct vs Azure-Fireworks of the same model surfaces the
  // hosting-vendor markup, which is genuinely interesting App #51 data.
  'Azure Fireworks Models FW GPT OSS 120B Inp DZ':     { canonicalId: 'openai/gpt-oss-120b', platform: 'azure_foundry' },
  'Azure Fireworks Models FW GPT OSS 120B Outp DZ':    { canonicalId: 'openai/gpt-oss-120b', platform: 'azure_foundry' },
  'Azure Fireworks Models FW GLM 5 Inp DZ':            { canonicalId: 'zai/glm-5',           platform: 'azure_foundry' },
  'Azure Fireworks Models FW GLM 5 Outp DZ':           { canonicalId: 'zai/glm-5',           platform: 'azure_foundry' },

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

  // ── Anthropic Claude on Bedrock (cross-platform with Vertex) ─────────────
  // 2026: AWS Bedrock has the latest Claude versions, NOT just legacy 2/3.
  // Anthropic maintains parity between Bedrock and Vertex offerings.
  'Claude Opus 4':                                   { canonicalId: 'anthropic/claude-opus-4',   platform: 'aws_bedrock' },
  'Claude Sonnet 4':                                 { canonicalId: 'anthropic/claude-sonnet-4', platform: 'aws_bedrock' },
  'Claude Haiku 4':                                  { canonicalId: 'anthropic/claude-haiku-4',  platform: 'aws_bedrock' },

  // ── Azure Llama 4 Scout (Foundry — cross-platform with Bedrock + Vertex) ─
  'Azure Llama Models Llama 4 Scout 17B Inp glbl':   { canonicalId: 'meta/llama-4-scout-17b', platform: 'azure_foundry' },
  'Azure Llama Models Llama 4 Scout 17B Outp glbl':  { canonicalId: 'meta/llama-4-scout-17b', platform: 'azure_foundry' },

  // ── Azure Qwen (Foundry — cross-platform with Bedrock + Vertex) ──────────
  // Educated guess on naming convention; refine after first --discover run.
  'Azure Qwen Models Qwen3 32B Inp glbl':            { canonicalId: 'qwen/qwen3-32b', platform: 'azure_foundry' },
  'Azure Qwen Models Qwen3 32B Outp glbl':           { canonicalId: 'qwen/qwen3-32b', platform: 'azure_foundry' },

  // ── GCP Vertex AI (Google + Anthropic + Llama/Qwen/DeepSeek/GLM/GPT-OSS via Model Garden) ─
  // Match against sku.description after normalization (lowercase + special
  // chars → spaces). SKU keys here are the description prefix, NOT the
  // model API ID. GCP typically names tokens like:
  //   "Gemini 3.0 Pro Input Tokens"
  //   "Claude Opus 4 Output Tokens"
  //   "Llama 3.3 Input Tokens"
  // The fetcher normalizes both sides, so dots/dashes don't break matching.
  //
  // These are EDUCATED GUESSES based on Google's typical naming conventions.
  // After the next workflow run we'll see which match — anything that
  // doesn't can be refined by inspecting `--discover` output for that SKU.

  // Google Gemini family (Vertex-exclusive — Google's own models)
  'Gemini 3.0 Pro Input':                            { canonicalId: 'google/gemini-3-0-pro',   platform: 'gcp_vertex' },
  'Gemini 3.0 Pro Output':                           { canonicalId: 'google/gemini-3-0-pro',   platform: 'gcp_vertex' },
  'Gemini 3.0 Flash Input':                          { canonicalId: 'google/gemini-3-0-flash', platform: 'gcp_vertex' },
  'Gemini 3.0 Flash Output':                         { canonicalId: 'google/gemini-3-0-flash', platform: 'gcp_vertex' },
  'Gemini 2.5 Pro Input':                            { canonicalId: 'google/gemini-2-5-pro',   platform: 'gcp_vertex' },
  'Gemini 2.5 Pro Output':                           { canonicalId: 'google/gemini-2-5-pro',   platform: 'gcp_vertex' },
  'Gemini 2.5 Flash Input':                          { canonicalId: 'google/gemini-2-5-flash', platform: 'gcp_vertex' },
  'Gemini 2.5 Flash Output':                         { canonicalId: 'google/gemini-2-5-flash', platform: 'gcp_vertex' },

  // Anthropic Claude on Vertex (cross-platform — also on Bedrock)
  // Anthropic maintains feature parity between Bedrock and Vertex.
  'Claude Opus 4 Input':                             { canonicalId: 'anthropic/claude-opus-4',     platform: 'gcp_vertex' },
  'Claude Opus 4 Output':                            { canonicalId: 'anthropic/claude-opus-4',     platform: 'gcp_vertex' },
  'Claude Sonnet 4 Input':                           { canonicalId: 'anthropic/claude-sonnet-4',   platform: 'gcp_vertex' },
  'Claude Sonnet 4 Output':                          { canonicalId: 'anthropic/claude-sonnet-4',   platform: 'gcp_vertex' },
  'Claude Haiku 4 Input':                            { canonicalId: 'anthropic/claude-haiku-4',    platform: 'gcp_vertex' },
  'Claude Haiku 4 Output':                           { canonicalId: 'anthropic/claude-haiku-4',    platform: 'gcp_vertex' },

  // Meta Llama on Vertex Model Garden (cross-platform with Bedrock + Azure)
  'Llama 3.3 Input':                                 { canonicalId: 'meta/llama-3-3-70b',        platform: 'gcp_vertex' },
  'Llama 3.3 Output':                                { canonicalId: 'meta/llama-3-3-70b',        platform: 'gcp_vertex' },
  'Llama 4 Maverick Input':                          { canonicalId: 'meta/llama-4-maverick-17b', platform: 'gcp_vertex' },
  'Llama 4 Maverick Output':                         { canonicalId: 'meta/llama-4-maverick-17b', platform: 'gcp_vertex' },
  'Llama 4 Scout Input':                             { canonicalId: 'meta/llama-4-scout-17b',    platform: 'gcp_vertex' },
  'Llama 4 Scout Output':                            { canonicalId: 'meta/llama-4-scout-17b',    platform: 'gcp_vertex' },

  // Mistral on Vertex Model Garden (cross-platform with Bedrock + Azure)
  'Mistral Large 3 Input':                           { canonicalId: 'mistral/large-3', platform: 'gcp_vertex' },
  'Mistral Large 3 Output':                          { canonicalId: 'mistral/large-3', platform: 'gcp_vertex' },

  // Open-weights models on Vertex Model Garden (cross-platform on all three)
  'DeepSeek V3.2 Input':                             { canonicalId: 'deepseek/v3-2', platform: 'gcp_vertex' },
  'DeepSeek V3.2 Output':                            { canonicalId: 'deepseek/v3-2', platform: 'gcp_vertex' },
  'DeepSeek R1 Input':                               { canonicalId: 'deepseek/r1',   platform: 'gcp_vertex' },
  'DeepSeek R1 Output':                              { canonicalId: 'deepseek/r1',   platform: 'gcp_vertex' },
  'GLM 5 Input':                                     { canonicalId: 'zai/glm-5',     platform: 'gcp_vertex' },
  'GLM 5 Output':                                    { canonicalId: 'zai/glm-5',     platform: 'gcp_vertex' },
  'GPT-OSS 120B Input':                              { canonicalId: 'openai/gpt-oss-120b', platform: 'gcp_vertex' },
  'GPT-OSS 120B Output':                             { canonicalId: 'openai/gpt-oss-120b', platform: 'gcp_vertex' },
  'Qwen3 32B Input':                                 { canonicalId: 'qwen/qwen3-32b', platform: 'gcp_vertex' },
  'Qwen3 32B Output':                                { canonicalId: 'qwen/qwen3-32b', platform: 'gcp_vertex' },
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
