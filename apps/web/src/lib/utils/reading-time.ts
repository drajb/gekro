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

/**
 * WORDS_PER_MINUTE — shared constant. Single source of truth for the reading
 * pace assumption. Exported so any future consumer (e.g. a Sanity data loader)
 * uses the same baseline without redefining the number.
 */
export const WORDS_PER_MINUTE = 200;

export function calculateReadingTime(text: string): number {
  const noOfWords = text.split(/\s/g).length;
  const minutes = noOfWords / WORDS_PER_MINUTE;
  return Math.ceil(minutes);
}
