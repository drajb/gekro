# Hyperscaler Pricing Pipeline

Automated weekly verification of AWS Bedrock + Azure AI Foundry + GCP Vertex AI pricing for the planned `hyperscaler-comparison` app (gekro App #51).

## What this exists to solve

The same foundation model is sold at slightly different prices across the three managed AI platforms, and **the prices change frequently**. A static comparison page goes stale within weeks. This pipeline keeps `apps/web/src/content/data/hyperscaler-pricing.json` honest by hitting each platform's pricing API every Monday and opening a PR if anything drifted.

## File map

```
scripts/pricing/
├── README.md                    ← you are here
├── update-pricing.mjs           ← orchestrator (the entry point)
└── lib/
    ├── normalize.mjs            ← SKU → canonical model mapping (the bridge)
    ├── fetch-azure.mjs          ← Azure Retail Prices API (no auth)
    ├── fetch-aws.mjs            ← AWS Bedrock public pricing JSON (no auth)
    └── fetch-gcp.mjs            ← GCP Cloud Billing Catalog API (needs API key)

.github/workflows/
└── pricing-update.yml           ← cron trigger + diff + PR creation

apps/web/src/content/data/
└── hyperscaler-pricing.json     ← canonical pricing data (source of truth)
```

## How it works (data flow)

```
                  Monday 09:00 UTC
                         │
                         ▼
            GitHub Actions VM spins up
                         │
                         ▼
            update-pricing.mjs runs
                         │
            ┌────────────┼────────────┐
            ▼            ▼            ▼
       fetch-aws    fetch-azure   fetch-gcp
       (Bedrock)    (Foundry)     (Vertex)
            │            │            │
            └────────────┼────────────┘
                         ▼
            Merge into hyperscaler-pricing.json
                         │
                         ▼
            Workflow checks `git diff`
                         │
                  ┌──────┴──────┐
              prices            no
              changed?          changes
                  │              │
                  ▼              ▼
              Open PR         Exit cleanly
```

## Setup checklist (one-time, when first enabling)

### 1. GCP Billing API key

Without this, the GCP fetcher logs a warning and skips. AWS + Azure still work.

1. Open <https://console.cloud.google.com/apis/credentials>
2. **Create credentials** → **API key**
3. Edit the key → **API restrictions** → restrict to "Cloud Billing API"
4. Copy the key
5. In the gekro repo on GitHub: **Settings** → **Secrets and variables** → **Actions** → **New repository secret**
6. Name: `GCP_BILLING_API_KEY`, value: paste the key
7. Save

### 2. Workflow permissions

GitHub Actions defaults to read-only repo access. The pricing workflow needs write access to commit and to create PRs.

1. In the gekro repo: **Settings** → **Actions** → **General**
2. Scroll to **Workflow permissions**
3. Select **Read and write permissions**
4. Tick **Allow GitHub Actions to create and approve pull requests**
5. Save

### 3. First manual run (to test)

1. Go to the **Actions** tab in the GitHub repo
2. Pick **Update hyperscaler pricing** in the left sidebar
3. Click **Run workflow** (top right) → **Run workflow** (green button)
4. Wait ~30 seconds, click into the run, watch the logs
5. If everything works:
   - Either no PR is opened (current data matches APIs) — success
   - Or a PR appears in the **Pull requests** tab — review and merge

## Running locally (for development + debugging)

```bash
# Fast test — Azure + AWS only (GCP will skip without key)
node scripts/pricing/update-pricing.mjs

# Full test with GCP
GCP_BILLING_API_KEY=<your-key> node scripts/pricing/update-pricing.mjs
```

The script writes to the canonical JSON. To preview without committing:

```bash
node scripts/pricing/update-pricing.mjs
git diff apps/web/src/content/data/hyperscaler-pricing.json
git checkout apps/web/src/content/data/hyperscaler-pricing.json  # revert
```

## How to add a new model

When a new model launches (e.g., Claude 4 ships on Bedrock + Vertex):

1. **Find the SKU on each platform** — usually in the platform's pricing page or model catalog
2. **Add an entry to `apps/web/src/content/data/hyperscaler-pricing.json`** with `verified_via: "manual"`
3. **Add the SKU(s) to `lib/normalize.mjs`** so the fetchers recognize the new SKUs
4. **Run locally to test:** `node scripts/pricing/update-pricing.mjs`
5. **Commit** — the next weekly run will swap `verified_via: "manual"` → `"api"` automatically once it confirms the price

## How to add a new platform

If, e.g., you want to add IBM watsonx.ai or Oracle GenAI later:

1. Create `lib/fetch-watsonx.mjs` following the same shape as `fetch-azure.mjs` (export `fetchWatsonxPricing()` returning `Array<{canonicalId, sku, side, usdPer1M}>`)
2. Add `watsonx` keys to the `platforms` block in the JSON
3. Add `watsonx` entries to existing model rows
4. Wire the fetcher into `update-pricing.mjs`'s `Promise.all` block
5. Add SKU mappings to `normalize.mjs` with `platform: 'watsonx'`

## Caveats + intentional scope limits

- **Region**: us-east-1 / eastus / us-east5 only. Other regions cost more, but tracking N regions × N platforms × N models combinatorially explodes the maintenance.
- **On-demand pricing only**: provisioned throughput (Bedrock PT, Foundry PTU, Vertex PVM) is committed-use and negotiated, not generally publishable.
- **Inference only**: fine-tuning, embedding, image generation, storage, RAG primitives — all out of scope. The app is comparing inference pricing.
- **Top ~10 models**: not exhaustive. The fetchers ignore SKUs not in `normalize.mjs` — intentional, keeps the comparison readable.
- **APIs occasionally fail**: the fetchers log errors and return `[]` instead of throwing. The pipeline degrades gracefully — partial updates are better than no updates.

## Cost

GitHub Actions on a public repo: **free**, unlimited minutes. This pipeline runs ~30 sec/week. Annual budget: 26 minutes.

The three pricing APIs are all free with no rate limits relevant at our scale (one call per week each).

## Maintenance contract

- **You own**: the JSON seed values when manually adding new models, the normalize map when SKU IDs change, occasional API drift (vendor renames endpoints once a year).
- **The pipeline owns**: weekly verification, drift detection, PR creation, audit log via GitHub Actions run history.

If a vendor changes their pricing API URL or response schema, the corresponding fetcher returns `[]` and logs an error — you'll see this in the PR (or absence of one). Update the affected `fetch-*.mjs` and you're back online.
