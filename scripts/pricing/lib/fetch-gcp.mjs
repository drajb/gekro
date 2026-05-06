/**
 * fetch-gcp.mjs — Google Vertex AI pricing via the Cloud Billing Catalog API
 *
 * API docs: https://cloud.google.com/billing/docs/reference/rest/v1/services.skus/list
 * Endpoint: https://cloudbilling.googleapis.com/v1/services/{serviceId}/skus
 *
 * The Vertex AI service ID is "CCD8-9BF1-090E" (stable, known constant).
 *
 * AUTH REQUIREMENT — this is the only fetcher of the three that needs a key:
 *   1. Go to https://console.cloud.google.com/apis/credentials
 *   2. Create an API key (no scopes needed; Cloud Billing Catalog is public)
 *   3. Restrict the key to "Cloud Billing API" only (security hygiene)
 *   4. In the Gekro repo on GitHub: Settings → Secrets and variables → Actions
 *      → New repository secret → name: GCP_BILLING_API_KEY, value: your key
 *   5. The pricing-update workflow injects the secret as env var GCP_BILLING_API_KEY
 *
 * If the env var is missing, this fetcher logs a warning and returns []. The
 * pipeline still works — Azure + AWS observations get applied; GCP rows in
 * hyperscaler-pricing.json keep their existing values.
 *
 * Pricing structure quirk: GCP returns USD prices as (units, nanos) where
 *   total_usd = units + (nanos / 1e9)
 * Example: { units: "0", nanos: 75000 } means $0.000075. We multiply up to
 * per-1M tokens.
 */

const SERVICE_ID = 'CCD8-9BF1-090E'; // Vertex AI
const ENDPOINT = `https://cloudbilling.googleapis.com/v1/services/${SERVICE_ID}/skus`;

/**
 * Fetch all SKUs across paginated responses.
 * @param {string} apiKey
 * @returns {Promise<any[]>}
 */
async function fetchAllSkus(apiKey) {
  /** @type {any[]} */
  const items = [];
  let pageToken = '';
  let safety = 0;

  while (safety < 50) {
    safety += 1;
    const url = `${ENDPOINT}?key=${apiKey}&pageSize=500${pageToken ? `&pageToken=${pageToken}` : ''}`;
    const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
    if (!res.ok) {
      throw new Error(`GCP Billing API returned ${res.status}: ${await res.text()}`);
    }
    const body = await res.json();
    items.push(...(body.skus ?? []));
    pageToken = body.nextPageToken ?? '';
    if (!pageToken) break;
  }

  return items;
}

/**
 * Public entrypoint — returns pricing observations for tracked Vertex models.
 *
 * @returns {Promise<Array<{ canonicalId: string, sku: string, side: 'input'|'output', usdPer1M: number }>>}
 */
export async function fetchGCPPricing() {
  const apiKey = process.env.GCP_BILLING_API_KEY;
  if (!apiKey) {
    console.warn('[gcp] GCP_BILLING_API_KEY env var not set. Skipping Vertex pricing fetch.');
    console.warn('[gcp] See scripts/pricing/lib/fetch-gcp.mjs header for setup instructions.');
    return [];
  }

  const { SKU_TO_CANONICAL } = await import('./normalize.mjs');
  const trackedSkus = Object.entries(SKU_TO_CANONICAL)
    .filter(([, info]) => info.platform === 'gcp_vertex')
    .map(([sku, info]) => ({ sku, canonicalId: info.canonicalId }));

  console.log(`[gcp] Fetching Vertex AI SKUs from Cloud Billing Catalog…`);

  /** @type {any[]} */
  let skus;
  try {
    skus = await fetchAllSkus(apiKey);
  } catch (err) {
    console.error(`[gcp] FETCH FAILED:`, err.message);
    return [];
  }

  console.log(`[gcp] Got ${skus.length} Vertex SKUs. Filtering…`);

  /** @type {Array<{ canonicalId: string, sku: string, side: 'input'|'output', usdPer1M: number }>} */
  const matches = [];

  for (const sku of skus) {
    const description = (sku.description ?? '').toLowerCase();
    const isInput = /input/.test(description);
    const isOutput = /output/.test(description);
    if (!isInput && !isOutput) continue;

    // Match against our tracked SKU strings. GCP descriptions are like:
    // "Claude 3 5 Sonnet Input Tokens" — fuzzy match by canonical model name.
    const tracked = trackedSkus.find(t => description.includes(t.sku.toLowerCase().replace(/[.@-]/g, ' ')));
    if (!tracked) continue;

    // Each SKU has pricingInfo[].pricingExpression.tieredRates[].unitPrice
    const pricingInfo = sku.pricingInfo?.[0];
    const tier = pricingInfo?.pricingExpression?.tieredRates?.[0];
    const unitPrice = tier?.unitPrice;
    if (!unitPrice) continue;

    const units = parseFloat(unitPrice.units ?? '0');
    const nanos = parseInt(unitPrice.nanos ?? '0', 10);
    const usdPerToken = units + nanos / 1e9;

    // GCP usually publishes prices per character or per 1k token. We assume
    // per 1k tokens for now and adjust based on usageUnit.
    const usageUnit = pricingInfo?.pricingExpression?.usageUnit ?? '';
    let multiplier = 1000; // per-1k → per-1M
    if (/1m|million/i.test(usageUnit)) multiplier = 1;

    const usdPer1M = usdPerToken * multiplier;

    matches.push({
      canonicalId: tracked.canonicalId,
      sku: tracked.sku,
      side: isInput ? 'input' : 'output',
      usdPer1M: Number(usdPer1M.toFixed(4)),
    });
  }

  console.log(`[gcp] Matched ${matches.length} pricing observations for tracked models.`);
  return matches;
}
