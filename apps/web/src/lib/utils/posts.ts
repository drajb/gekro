/**
 * lib/utils/posts.ts — Central post data utilities
 *
 * Single source of truth for the merged local + Sanity post list.
 * Decision 2026-03-24: all post fetching must go through getAllPosts() —
 * do NOT duplicate the merge/sort/consolidate logic elsewhere.
 *
 * Exports:
 *  FormattedPost  — canonical post shape consumed by all pages and components
 *  getAllPosts()   — merge + sort posts from local Content Collections + Sanity
 *  getTopicCounts() — derive [{title, count}] sorted by count desc
 *  (reading time lives exclusively in lib/utils/reading-time.ts — the duplicate
 *   calculateReadingTime that used to live here was removed 2026-04-17 as part
 *   of the code-review sweep; no consumer was importing it from this module.)
 *
 * Topic consolidation:
 *  TOPIC_MAP normalises raw topic strings from frontmatter/Sanity into a
 *  smaller set of canonical topic names used for filtering and display.
 *  Unmapped topics are kept as-is. Add mappings here when new posts use
 *  new topic strings that should resolve to an existing canonical topic.
 *
 * Sanity fallback:
 *  client.fetch() is wrapped in try/catch. If it rejects (missing env,
 *  network error, etc.), only local posts are returned. The site is fully
 *  functional without Sanity configured.
 */

import { getCollection } from 'astro:content';
import { client } from '../sanity/client';
import { ALL_POSTS_QUERY } from '../sanity/queries';

export interface FormattedPost {
  title: string;
  slug: { current: string };
  description: string;
  tldr: string;
  publishedAt: string;
  topics: string[];
  difficulty?: 'Beginner' | 'Intermediate' | 'Advanced';
  readingTime?: number;
  isLocal?: boolean;
  body?: unknown;
  mainImage?: string;
  // GEO-optimised 2-sentence summary. Preferred over description/tldr by
  // SEOHead and BlogLayout when present; falls back to tldr → description.
  aiSummary?: string;
  // Some older posts use `summary` as an alias for description — preserved
  // in the union so local post flattening doesn't lose the field.
  summary?: string;
  // ISO date of last significant content update (optional). When set,
  // BlogLayout uses it for dateModified in JSON-LD and OG article:modified_time.
  // Falls back to publishedAt when absent.
  updatedAt?: string;
}

/**
 * Fetch and merge Sanity + local blog posts, sorted newest-first.
 * Sanity failures are caught silently — the site works local-only.
 */
export async function getAllPosts(): Promise<FormattedPost[]> {
  const localPosts = await getCollection('blog');
  let sanityPosts: FormattedPost[] = [];

  try {
    sanityPosts = await client.fetch(ALL_POSTS_QUERY);
  } catch {
    // Sanity unreachable — continue with local posts only
  }

  const formattedLocal: FormattedPost[] = localPosts.map(p => ({
    title: p.data.title,
    slug: { current: p.slug },
    description: p.data.description || p.data.summary || '',
    tldr: p.data.tldr || p.data.description || p.data.summary || '',
    publishedAt: p.data.publishedAt,
    topics: consolidateTopics(p.data.topics),
    difficulty: p.data.difficulty,
    readingTime: p.data.readingTime,
    isLocal: true,
  }));

  // Local posts already have consolidated topics from formattedLocal.map() above.
  // Sanity posts need consolidation here. Running consolidateTopics on both is
  // idempotent but wasteful — apply only to Sanity posts before merging.
  const formattedSanity = sanityPosts.map(post => ({
    ...post,
    topics: consolidateTopics(post.topics),
  }));

  return [...formattedSanity, ...formattedLocal].sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  );
}

const TOPIC_MAP: Record<string, string> = {
  // AI Agents mapping
  'Ollama': 'AI Agents',
  'LLM': 'AI Agents',
  'AI': 'AI Agents',
  'Prompt Engineering': 'AI Agents',
  'Local AI': 'AI Agents',
  'Machine Learning': 'AI Agents',
  
  // Hardware mapping
  'Pi5': 'Hardware',
  'Raspberry Pi': 'Hardware',
  'Mac Mini': 'Hardware',
  'M4': 'Hardware',
  
  // Infrastructure mapping
  'Server': 'Infrastructure',
  'WSL2': 'Infrastructure',
  'Linux': 'Infrastructure',
  'Docker': 'Infrastructure',
  'Ubuntu': 'Infrastructure',
  
  // Architecture mapping
  'Sanity': 'Architecture',
  'Astro': 'Architecture',
  'Cloudflare': 'Architecture',
  'Frontend': 'Architecture',
  'TypeScript': 'Architecture',
  
  // Add some core tags unconditionally passed
};

function consolidateTopics(topics: string[]): string[] {
  if (!topics || !Array.isArray(topics)) return [];
  const merged = new Set<string>();
  topics.forEach(t => {
    const mapped = TOPIC_MAP[t] || t; // keep original if no mapping exists, though some will be long.
    // If you want to strictly limit to core topics, we can filter out non-core,
    // but mapping is safer to not lose data.
    merged.add(mapped);
  });
  return Array.from(merged);
}

/** Derive { title, count } topic stats from a post array. */
export function getTopicCounts(posts: Pick<FormattedPost, 'topics'>[]): { title: string; count: number }[] {
  const counts = new Map<string, number>();
  posts.forEach(p => {
    const consolidated = consolidateTopics(p.topics);
    consolidated.forEach(t => counts.set(t, (counts.get(t) || 0) + 1));
  });
  return Array.from(counts.entries())
    .map(([title, count]) => ({ title, count }))
    .sort((a, b) => b.count - a.count);
}

