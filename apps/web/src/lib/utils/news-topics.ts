/**
 * lib/utils/news-topics.ts — News topic normalisation + hub eligibility
 *
 * WHY THIS EXISTS
 *  Every news briefing carries a `topics` array written by the generator, but
 *  those strings were free-form: 53 briefings produced 113 distinct labels that
 *  fragmented the same concept across spellings ("open-weights" vs "open-weight
 *  models" vs "open-source-models"; "coding-agents" vs "coding agents"). None of
 *  them were rendered or linked anywhere, so the whole /news archive had no
 *  internal links beyond the index and prev/next — a chronological silo.
 *
 *  NEWS_TOPIC_MAP collapses those variants onto a canonical display name. Where
 *  a canonical name matches an existing blog topic ("LLMs", "AI Agents",
 *  "Hardware", "Infrastructure", "APIs"), the news briefings merge into that
 *  same /topics/<slug>/ hub, so a Deep Dive and the daily briefings on the same
 *  subject finally share a page.
 *
 * THRESHOLD
 *  A hub built from a single briefing is thin content. `MIN_HUB_ARTICLES` gates
 *  which news-only topics get their own page. Topics below the threshold still
 *  render as chips on the article (useful to a reader) but only link out when a
 *  hub actually exists — see `newsTopicHasHub()`.
 *
 * ADDING TOPICS
 *  When the generator emits a new label, add it here. Anything unmapped is
 *  deliberately dropped rather than guessed at, so a typo can never mint a junk
 *  hub page like /topics/teh-decoder/.
 */

/** Raw generator label → canonical display name. Keys are lowercased on lookup. */
const NEWS_TOPIC_MAP: Record<string, string> = {
  // ── Vendors (real, high-intent queries: "anthropic news", "openai news") ──
  'anthropic': 'Anthropic', 'claude': 'Anthropic', 'fable-5': 'Anthropic',
  'openai': 'OpenAI', 'gpt-5.6': 'OpenAI', 'codex': 'OpenAI',
  'google': 'Google', 'gemini': 'Google', 'deepmind': 'Google',
  'meta': 'Meta', 'alibaba': 'Alibaba', 'mistral': 'Mistral', 'xai': 'xAI',
  'apple': 'Apple', 'siri': 'Apple', 'ios-27': 'Apple', 'swift': 'Apple',
  'github': 'GitHub', 'github-copilot': 'GitHub', 'copilot': 'GitHub',
  'nvidia': 'Hardware', 'azure': 'Infrastructure', 'glm': 'Open Weights',

  // ── Open weights / open source ──
  'open-weights': 'Open Weights', 'open-weight models': 'Open Weights',
  'open-source-models': 'Open Weights', 'open-source': 'Open Source',

  // ── Coding agents ──
  'coding-agents': 'Coding Agents', 'coding agents': 'Coding Agents',
  'ai-coding': 'Coding Agents', 'coding-models': 'Coding Agents',

  // ── Developer tooling ──
  'developer-tools': 'Developer Tools', 'developer tools': 'Developer Tools',
  'developer tooling': 'Developer Tools', 'tooling': 'Developer Tools',
  'vscode': 'Developer Tools', 'text-to-sql': 'Developer Tools',

  // ── Model releases ──
  'model-release': 'Model Releases', 'model-releases': 'Model Releases',
  'model updates': 'Model Releases', 'model-access': 'Model Releases',
  'model-deprecation': 'Model Releases', 'reasoning models': 'Model Releases',

  // ── Inference ──
  'inference': 'Inference', 'inference optimization': 'Inference',
  'inference efficiency': 'Inference', 'inference infrastructure': 'Inference',
  'model routing': 'Inference',
  'local-inference': 'Local Inference', 'local inference': 'Local Inference',
  'on-device inference': 'Local Inference', 'webgpu': 'Local Inference',
  'inference cost': 'Inference Cost', 'inference-cost': 'Inference Cost',
  'token economics': 'Inference Cost', 'cost efficiency': 'Inference Cost',
  'quantization': 'Quantization', 'model compression': 'Quantization',
  'model distillation': 'Quantization', 'model efficiency': 'Quantization',

  // ── Security & safety ──
  'security': 'Security', 'ai-security': 'Security',
  'model hardening': 'Security', 'red teaming': 'Security',
  'prompt-injection': 'Security',
  'safety': 'AI Safety', 'ai-safety': 'AI Safety', 'biosecurity': 'AI Safety',

  // ── Policy ──
  'policy': 'AI Policy', 'ai-policy': 'AI Policy',
  'government-ai-policy': 'AI Policy', 'regulation': 'AI Policy',
  'government': 'AI Policy',
  'export-controls': 'Export Controls', 'export-control': 'Export Controls',

  // ── Core concepts. These names intentionally match existing BLOG topics so
  //    the two content types land on one hub instead of two near-duplicates. ──
  'llm': 'LLMs', 'models': 'LLMs', 'ml': 'LLMs', 'nlp': 'LLMs',
  'tokenization': 'LLMs',
  'agents': 'AI Agents', 'agentic-ai': 'AI Agents',
  'agent orchestration': 'AI Agents', 'mcp': 'AI Agents', 'memory': 'AI Agents',
  'api': 'APIs', 'api-changes': 'APIs',
  'pricing': 'Pricing', 'api-pricing': 'Pricing',
  'benchmarks': 'Benchmarks', 'agent benchmarking': 'Benchmarks',
  'infrastructure': 'Infrastructure', 'infra': 'Infrastructure',
  'ai-infrastructure': 'Infrastructure', 'cloud-infrastructure': 'Infrastructure',
  'hardware': 'Hardware', 'chip': 'Hardware', 'custom silicon': 'Hardware',
  'tpu alternatives': 'Hardware', 'apple-silicon': 'Hardware',
  'multimodal': 'Multimodal', 'multimodal models': 'Multimodal',
  'image-generation': 'Multimodal', 'diffusion': 'Multimodal',
  'voice-ai': 'Multimodal',
  'world-models': 'World Models', 'world models': 'World Models',
  'robotics': 'Robotics', 'enterprise': 'Enterprise',
  'research': 'Research', 'drug-discovery': 'Research',
  'ipo': 'Business', 'acquisition': 'Business', 'talent': 'Business',
};

/**
 * A news-only topic needs at least this many briefings before it earns its own
 * hub page. Prevents 1-article pages that read as thin content.
 */
export const MIN_HUB_ARTICLES = 3;

/** Map raw generator labels onto canonical names, deduped. Unmapped → dropped. */
export function normalizeNewsTopics(topics: string[] | undefined): string[] {
  if (!Array.isArray(topics)) return [];
  const out = new Set<string>();
  for (const raw of topics) {
    const canon = NEWS_TOPIC_MAP[String(raw).trim().toLowerCase()];
    if (canon) out.add(canon);
  }
  return [...out];
}

/** Canonical topic → number of briefings carrying it. */
export function newsTopicCounts(
  briefings: { data: { topics?: string[] } }[],
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const b of briefings) {
    for (const t of normalizeNewsTopics(b.data.topics)) {
      counts.set(t, (counts.get(t) || 0) + 1);
    }
  }
  return counts;
}

/**
 * Canonical topics that qualify for a hub page from news alone.
 * Topics that already exist as blog topics get a hub regardless — that
 * decision lives in topics/[topic].astro, which unions both sources.
 */
export function eligibleNewsHubTopics(
  briefings: { data: { topics?: string[] } }[],
): string[] {
  return [...newsTopicCounts(briefings).entries()]
    .filter(([, n]) => n >= MIN_HUB_ARTICLES)
    .map(([t]) => t);
}
