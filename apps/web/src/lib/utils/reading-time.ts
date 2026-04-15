/**
 * lib/utils/reading-time.ts — Rough reading time estimate
 *
 * Used in: PostCard.astro, PostHeader.astro (fallback when readingTime prop is absent)
 *
 * Assumes 200 words per minute (conservative adult reading pace).
 * Splits on whitespace — not word-boundary aware, but accurate enough for
 * short strings (tldr / description fields).
 *
 * For full-article accuracy, pass the `readingTime` frontmatter field instead.
 * This function is only a fallback for Sanity posts that don't include it.
 *
 * Tests: apps/web/src/lib/utils/reading-time.test.ts (vitest)
 */
export function calculateReadingTime(text: string): number {
  const wordsPerMinute = 200;
  const noOfWords = text.split(/\s/g).length;
  const minutes = noOfWords / wordsPerMinute;
  return Math.ceil(minutes);
}
