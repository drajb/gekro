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
    topics: p.data.topics,
    difficulty: p.data.difficulty,
    readingTime: p.data.readingTime,
    isLocal: true,
  }));

  return [...sanityPosts, ...formattedLocal].sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  );
}

/** Derive { title, count } topic stats from a post array. */
export function getTopicCounts(posts: Pick<FormattedPost, 'topics'>[]): { title: string; count: number }[] {
  const counts = new Map<string, number>();
  posts.forEach(p => {
    p.topics?.forEach(t => counts.set(t, (counts.get(t) || 0) + 1));
  });
  return Array.from(counts.entries())
    .map(([title, count]) => ({ title, count }))
    .sort((a, b) => b.count - a.count);
}

export function calculateReadingTime(text: string): number {
  const wordsPerMinute = 200;
  const noOfWords = text.split(/\s/g).length;
  const minutes = noOfWords / wordsPerMinute;
  return Math.ceil(minutes);
}
