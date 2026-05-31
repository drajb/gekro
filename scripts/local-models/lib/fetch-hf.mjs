/**
 * fetch-hf.mjs — HuggingFace API helpers
 *
 * Two endpoints we hit:
 *   - Model metadata:  GET https://huggingface.co/api/models/{hf_id}
 *     Returns: { license, tags, pipeline_tag, cardData, lastModified, downloads, ... }
 *
 *   - Raw config.json: GET https://huggingface.co/{hf_id}/raw/main/config.json
 *     Returns the model's HF Transformers config (num_hidden_layers, hidden_size,
 *     num_attention_heads, num_key_value_heads, head_dim, intermediate_size,
 *     max_position_embeddings, num_local_experts, num_experts_per_tok, ...).
 *
 * Both endpoints work unauthenticated for public models. We honor HF_TOKEN
 * if it's in the env (higher rate limits + access to gated repos that are
 * approved for the token).
 *
 * Errors we tolerate gracefully (return null instead of throwing):
 *   - 404: the model has been removed or renamed
 *   - 401/403: gated repo we don't have access to (Llama family pre-acceptance)
 *   - 5xx: transient HF backend issue — caller can retry
 */

const HF_TOKEN = process.env.HF_TOKEN || '';
const baseHeaders = HF_TOKEN ? { Authorization: `Bearer ${HF_TOKEN}` } : {};

async function fetchJson(url) {
  const res = await fetch(url, { headers: { ...baseHeaders, Accept: 'application/json' } });
  if (res.status === 404) return null;
  if (res.status === 401 || res.status === 403) {
    // Gated repo — don't crash the whole run on these
    return null;
  }
  if (!res.ok) throw new Error(`HF ${res.status}: ${url}`);
  return res.json();
}

export async function fetchHfModelMeta(hfId) {
  return fetchJson(`https://huggingface.co/api/models/${encodeURI(hfId)}`);
}

export async function fetchHfConfigJson(hfId) {
  // Note: this endpoint returns plain JSON for the raw config file.
  // Branch is hard-coded to `main` — every public model in our catalog uses it.
  const url = `https://huggingface.co/${encodeURI(hfId)}/raw/main/config.json`;
  const res = await fetch(url, { headers: baseHeaders });
  if (res.status === 404) return null;
  if (res.status === 401 || res.status === 403) return null;
  if (!res.ok) throw new Error(`HF config ${res.status}: ${url}`);
  return res.json();
}
