/**
 * fetch-azure.mjs — Azure AI Foundry pricing via the Retail Prices API
 *
 * API docs: https://learn.microsoft.com/en-us/rest/api/cost-management/retail-prices/azure-retail-prices
 * Endpoint: https://prices.azure.com/api/retail/prices
 *
 * Why Azure is the easiest of the three:
 *   - No API key required (anonymous access)
 *   - Returns clean JSON
 *   - Standard OData $filter syntax for narrowing results
 *
 * Why this is still annoying:
 *   - Azure's "Cognitive Services" / "Azure AI Inference" SKU names don't
 *     map cleanly to model names. We have to filter and pattern-match.
 *   - Pagination via NextPageLink — must follow until null.
 *   - Same model can appear under multiple SKUs (input vs output, regions,
 *     pay-as-you-go vs reserved). We only want PAYG, eastus, base inference.
 */

import { resolveCanonical } from './normalize.mjs';

const ENDPOINT = 'https://prices.azure.com/api/retail/prices';

// OData filter narrowing the response to AI inference SKUs.
// "Foundry Models" is the current serviceName as of 2026-05 (was "Cognitive
// Services" pre-rebrand). serviceFamily is the broader bucket including model
// inference + media + tools. We narrow to inference-priced SKUs in eastus.
//
// To inspect the API directly:
//   curl 'https://prices.azure.com/api/retail/prices?$filter=serviceName%20eq%20%27Foundry%20Models%27&$top=5'
const FILTER = [
  "serviceName eq 'Foundry Models'",
  "armRegionName eq 'eastus'",
  "type eq 'Consumption'",
].join(' and ');

/**
 * Fetch all matching SKUs across paginated responses.
 * @returns {Promise<Array<{ skuName: string, productName: string, meterName: string, unitPrice: number, unitOfMeasure: string }>>}
 */
async function fetchAllPages() {
  /** @type {any[]} */
  const items = [];
  let url = `${ENDPOINT}?$filter=${encodeURIComponent(FILTER)}`;
  let pageNum = 0;

  // Cap at 50 pages (~50K rows) — defensive against infinite-pagination bugs.
  while (url && pageNum < 50) {
    pageNum += 1;
    let res;
    try {
      res = await fetch(url, {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(30_000),  // 30s per page
      });
    } catch (err) {
      // Native fetch errors are extremely vague ("fetch failed") without cause.
      // Surface the URL and any Node error.cause for actionable debugging.
      throw new Error(
        `Azure fetch failed at page ${pageNum} for URL: ${url}\n` +
        `Error: ${err.name}: ${err.message}\n` +
        `Cause: ${err.cause ? JSON.stringify(err.cause) : 'none'}`
      );
    }
    if (!res.ok) {
      throw new Error(`Azure pricing API returned HTTP ${res.status} ${res.statusText}: ${await res.text()}`);
    }
    let body;
    try {
      body = await res.json();
    } catch (err) {
      throw new Error(`Azure response wasn't JSON at page ${pageNum}: ${err.message}`);
    }
    items.push(...(body.Items ?? []));
    url = body.NextPageLink ?? null;
  }

  return items;
}

/**
 * Normalize an Azure SKU row into our canonical pricing shape.
 * Returns null if the SKU isn't a tracked model. The SKU naming in Azure is
 * inconsistent — sometimes the model name is in skuName, sometimes meterName.
 *
 * @param {any} row
 */
function tryNormalize(row) {
  // Azure meterName patterns: "Input Tokens (per 1k tokens)", "Output Tokens"
  const isInput = /input/i.test(row.meterName);
  const isOutput = /output/i.test(row.meterName);
  if (!isInput && !isOutput) return null;

  // Try to extract a model SKU from skuName / productName / meterName.
  // We look for any of our tracked SKUs as a substring.
  const haystack = `${row.skuName} ${row.productName} ${row.meterName}`;
  const trackedAzureSkus = Object.keys(
    Object.fromEntries(
      Object.entries(
        // SKU map keys filtered to azure_foundry platform — keeps this list tight
        // and avoids matching e.g. "claude-3-5-sonnet" inside an Azure SKU string
        // when we know Anthropic models aren't on Azure.
        // (defer import to avoid circular)
        Object.entries(import.meta).length
          ? {}
          : {}
      )
    )
  );
  // Easier approach: iterate the normalize map
  return matchByVendorSku(haystack, isInput);
}

/**
 * Look at all known Azure SKUs from normalize.mjs and try each as a substring.
 * Returns { canonicalId, side: 'input'|'output', priceUsdPerToken } or null.
 *
 * @param {string} haystack
 * @param {boolean} isInput
 */
function matchByVendorSku(haystack, isInput) {
  // Lazy require to keep top imports clean
  const { SKU_TO_CANONICAL } = require_normalize();
  for (const [sku, info] of Object.entries(SKU_TO_CANONICAL)) {
    if (info.platform !== 'azure_foundry') continue;
    if (haystack.includes(sku)) {
      return { sku, canonicalId: info.canonicalId, side: isInput ? 'input' : 'output' };
    }
  }
  return null;
}

// Workaround: import.meta require in pure ESM
function require_normalize() {
  return import('./normalize.mjs');
}

/**
 * Public entrypoint — returns price observations for tracked Azure Foundry models.
 *
 * Output shape (per row):
 *   { canonicalId, sku, side: 'input'|'output', usdPer1M }
 *
 * The caller (update-pricing.mjs) merges these into hyperscaler-pricing.json.
 *
 * @returns {Promise<Array<{ canonicalId: string, sku: string, side: 'input'|'output', usdPer1M: number }>>}
 */
export async function fetchAzurePricing() {
  const { SKU_TO_CANONICAL } = await import('./normalize.mjs');
  const trackedSkus = Object.entries(SKU_TO_CANONICAL)
    .filter(([, info]) => info.platform === 'azure_foundry')
    .map(([sku, info]) => ({ sku, canonicalId: info.canonicalId }));

  console.log(`[azure] Fetching Azure Retail Prices for ${trackedSkus.length} tracked SKUs…`);

  let rows;
  try {
    rows = await fetchAllPages();
  } catch (err) {
    console.error(`[azure] FETCH FAILED:`, err.message);
    return [];
  }

  console.log(`[azure] Got ${rows.length} pricing rows from API. Filtering…`);

  /** @type {Array<{ canonicalId: string, sku: string, side: 'input'|'output', usdPer1M: number }>} */
  const matches = [];

  for (const row of rows) {
    // Azure abbreviates inconsistently across product families:
    //   Inp / Input   — input tokens (most products)
    //   Outp / Output — output tokens (DeepSeek, Mistral, Llama, Grok)
    //   opt / Opt     — output tokens (Azure OpenAI GPT-5 family — different convention)
    // Word boundaries prevent false matches inside "Optimized" / "Output" etc.
    const meterName = row.meterName ?? '';
    const isInput  = /\b(inp(ut)?)\b/i.test(meterName);
    const isOutput = /\b(outp(ut)?|opt)\b/i.test(meterName);
    if (!isInput && !isOutput) continue;

    // Match against our tracked SKUs. Order: productName + skuName + meterName
    // so multi-word SKU keys like "Azure Deepseek Models V3.2 Inp" match.
    const haystack = `${row.productName ?? ''} ${row.skuName ?? ''} ${meterName}`;
    const match = trackedSkus.find(({ sku }) => haystack.includes(sku));
    if (!match) continue;

    // Azure prices are typically per 1k tokens; convert to per 1M
    // unitOfMeasure examples: "1K", "1000", "1M"
    const unit = (row.unitOfMeasure ?? '').toUpperCase();
    let multiplier = 1000; // default: per-1k → per-1M
    if (unit.includes('1M') || unit.includes('1000000') || unit.includes('1,000,000')) multiplier = 1;
    if (unit.includes('1K') || unit.includes('1000') || unit.includes('1,000')) multiplier = 1000;

    const usdPer1M = row.unitPrice * multiplier;

    matches.push({
      canonicalId: match.canonicalId,
      sku: match.sku,
      side: isInput ? 'input' : 'output',
      usdPer1M: Number(usdPer1M.toFixed(4)),
    });
  }

  console.log(`[azure] Matched ${matches.length} pricing observations for tracked models.`);
  return matches;
}
