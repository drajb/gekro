/**
 * fetch-aws.mjs — AWS Bedrock pricing via the public Bulk Pricing API
 *
 * AWS publishes pricing as static JSON files at well-known URLs. No auth, no
 * API key. The files are large (per-service, per-region) but cacheable.
 *
 * Index of all Bedrock regional files:
 *   https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/AmazonBedrock/current/region_index.json
 *
 * Per-region pricing file (e.g. us-east-1):
 *   https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/AmazonBedrock/current/us-east-1/index.json
 *
 * Structure of the per-region file:
 *   {
 *     "products": {
 *       "<sku>": { "productFamily": "...", "attributes": { "modelId": "...", ... } }
 *     },
 *     "terms": {
 *       "OnDemand": {
 *         "<sku>": {
 *           "<termCode>": {
 *             "priceDimensions": {
 *               "<rateCode>": { "pricePerUnit": { "USD": "0.003" }, "unit": "1k tokens", "description": "..." }
 *             }
 *           }
 *         }
 *       }
 *     }
 *   }
 *
 * Approach:
 *   1. Download the us-east-1 file (single ~15MB JSON)
 *   2. Filter products where attributes.model matches one of our tracked names
 *   3. For each match, find the OnDemand price for "input tokens" and "output tokens"
 *   4. Convert to per-1M and emit observations
 *
 * IMPORTANT — AWS attribute schema (verified 2026-05-06 against live API):
 *   attributes.model        — HUMAN-READABLE name e.g. "Nova 2.0 Pro", "GLM 4.7"
 *   attributes.provider     — "Z AI", "Mistral", "Google", "Amazon", etc.
 *   attributes.inferenceType — "Input tokens", "Output tokens", "Input tokens priority", etc.
 *
 * The `attributes.model` field is what we substring-match in normalize.mjs's
 * AWS SKU keys. So normalize map keys for AWS should be the model name, NOT
 * a vendor SKU ID like "anthropic.claude-3-5-sonnet-20241022-v2:0" (those
 * IDs don't appear in the pricing data — they're API IDs only).
 */

const REGION = 'us-east-1';
const PRICING_URL = `https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/AmazonBedrock/current/${REGION}/index.json`;

/**
 * Public entrypoint — returns pricing observations for tracked Bedrock models.
 *
 * @returns {Promise<Array<{ canonicalId: string, sku: string, side: 'input'|'output', usdPer1M: number }>>}
 */
export async function fetchAWSPricing() {
  const { SKU_TO_CANONICAL } = await import('./normalize.mjs');
  const trackedSkus = Object.entries(SKU_TO_CANONICAL)
    .filter(([, info]) => info.platform === 'aws_bedrock')
    .map(([sku, info]) => ({ sku, canonicalId: info.canonicalId }));

  console.log(`[aws] Fetching Bedrock pricing JSON for ${REGION} (~15MB)…`);

  /** @type {any} */
  let dump;
  try {
    const res = await fetch(PRICING_URL, { headers: { 'Accept': 'application/json' } });
    if (!res.ok) throw new Error(`AWS pricing API returned ${res.status}`);
    dump = await res.json();
  } catch (err) {
    console.error(`[aws] FETCH FAILED:`, err.message);
    return [];
  }

  const products = dump.products ?? {};
  const onDemand = dump.terms?.OnDemand ?? {};
  console.log(`[aws] Got ${Object.keys(products).length} products. Filtering…`);

  /** @type {Array<{ canonicalId: string, sku: string, side: 'input'|'output', usdPer1M: number }>} */
  const matches = [];

  // Walk every product, check if its model name matches any of our tracked names.
  // AWS Bedrock uses HUMAN-READABLE names in `attributes.model` ("Nova 2.0 Pro",
  // "Llama 3.3 70B Instruct", "GLM 4.7"), NOT the API-style SKU IDs found in
  // the Bedrock SDK. So normalize.mjs's aws_bedrock keys must be those names.
  for (const [productSku, product] of Object.entries(products)) {
    const attrs = /** @type {any} */ (product).attributes ?? {};
    const modelName = attrs.model ?? '';
    if (!modelName) continue;

    // Substring match — our tracked name in the API-returned name (handles
    // version suffixes like "Llama 3.3 70B Instruct (text-only)").
    const tracked = trackedSkus.find(t =>
      modelName.toLowerCase().includes(t.sku.toLowerCase()) ||
      t.sku.toLowerCase().includes(modelName.toLowerCase())
    );
    if (!tracked) continue;

    // CRITICAL FILTER — match by attributes.usagetype (more deterministic
    // than inferenceType which has many free-form variants per model).
    //
    // AWS usagetype examples (verified against live API):
    //   USE1-zai.glm-4.7-output-tokens               ← STANDARD, want
    //   USE1-Ministral-3-8b-Instruct-input-tokens    ← STANDARD, want
    //   USE1-Nova2.0Pro-input-text-tokens            ← STANDARD, want (Nova multimodal)
    //   USE1-Ministral-3-8b-Instruct-input-tokens-priority ← skip (provisioned)
    //   USE1-mistral...-output-tokens-flex           ← skip (flex tier)
    //   USE1-google.gemma-3-4b-...-input-tokens-batch ← skip (batch API)
    //   USE1-Nova2.0Pro-input-video-token-count-... ← skip (video-specific)
    //   USE1-Nova2.0Pro-input-image-token-count-... ← skip (image-specific)
    //
    // Match: usagetype ends in "-input-tokens" or "-output-tokens" exactly.
    // The "-text-tokens" variant catches Nova multimodal text pricing.
    // No trailing modifier = standard on-demand rate. This is THE filter.
    //
    // Fallback: some older Anthropic SKUs lack usagetype but have
    // inferenceType="Input tokens" exactly. Catch those too.
    const usagetype = (attrs.usagetype ?? '').toLowerCase();
    const inferenceType = (attrs.inferenceType ?? '').toLowerCase().trim();

    const isStandardInput = (
      /(^|-)(input-tokens|input-text-tokens)$/.test(usagetype) ||
      inferenceType === 'input tokens'
    );
    const isStandardOutput = (
      /(^|-)(output-tokens|output-text-tokens)$/.test(usagetype) ||
      inferenceType === 'output tokens'
    );
    if (!isStandardInput && !isStandardOutput) continue;

    // Look up the OnDemand price entries for this SKU
    const offers = onDemand[productSku] ?? {};
    for (const offer of Object.values(offers)) {
      const dims = /** @type {any} */ (offer).priceDimensions ?? {};
      for (const dim of Object.values(dims)) {
        const dimAny = /** @type {any} */ (dim);
        // Re-derive input/output from the inferenceType we just filtered on.
        // Don't trust priceDimension descriptions — they're sometimes blank
        // or mismatched against the parent product's inferenceType.
        const isInput = isStandardInput;
        const isOutput = isStandardOutput;
        if (!isInput && !isOutput) continue;

        const usd = parseFloat(dimAny.pricePerUnit?.USD ?? '0');
        if (!usd) continue;

        // AWS unit is typically "1k tokens" — convert to per-1M.
        const unit = (dimAny.unit ?? '').toLowerCase();
        let multiplier = 1000; // default: per-1k → per-1M
        if (unit.includes('1m') || unit.includes('million')) multiplier = 1;

        const usdPer1M = usd * multiplier;

        matches.push({
          canonicalId: tracked.canonicalId,
          sku: tracked.sku,
          side: isInput ? 'input' : 'output',
          usdPer1M: Number(usdPer1M.toFixed(4)),
        });
      }
    }
  }

  console.log(`[aws] Matched ${matches.length} pricing observations for tracked models.`);
  return matches;
}
