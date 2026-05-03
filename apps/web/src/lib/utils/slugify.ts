/**
 * lib/utils/slugify.ts — Centralised topic-name → URL-slug conversion
 *
 * Single source of truth for the mapping used by /topics/[topic]'s
 * getStaticPaths(), Tag.astro, and PostHeader.astro. Previously this transform
 * was inlined in three places — if a topic ever contained `/`, `+`, `&`, or
 * accented characters, the three sites would all need to be patched in lockstep
 * (code-review finding 2026-04-20 #4).
 *
 * Behaviour:
 *  - lowercase
 *  - run of non-alphanumerics → single hyphen
 *  - strip leading/trailing hyphens
 *
 * Examples:
 *  "AI Agents"   → "ai-agents"
 *  "Local LLM"   → "local-llm"
 *  "C++"         → "c"
 *  "AI / ML"     → "ai-ml"
 *  "Pi-5  cluster" → "pi-5-cluster"
 */

export function topicToSlug(topic: string): string {
  return topic
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
