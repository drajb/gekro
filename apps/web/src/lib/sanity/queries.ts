/**
 * lib/sanity/queries.ts — GROQ query definitions for Sanity CMS
 *
 * Uses String.raw as a `groq` tag template literal to avoid importing
 * @sanity/client's groq export (which causes issues in some build contexts)
 * while still enabling syntax highlighting in IDEs that recognise `groq`.
 *
 * Queries:
 *  ALL_POSTS_QUERY     — all published posts, newest-first (used by getAllPosts)
 *  RECENT_POSTS_QUERY  — latest 5 posts (currently unused; kept for future use)
 *  ALL_EXPERIMENTS_QUERY — all experiments, newest-first (currently unused)
 *  TOPIC_CLUSTERS_QUERY — all topic documents (currently unused)
 *
 * Note: only ALL_POSTS_QUERY is actively consumed. The others are retained
 * for future features (e.g., a Sanity-driven experiments section).
 */

// String.raw mimics the groq tag for IDE syntax highlighting without the import
const groq = String.raw;

export const ALL_POSTS_QUERY = groq`
  *[_type == "post" && publishedAt <= now()] | order(publishedAt desc) {
    title,
    slug,
    description,
    tldr,
    publishedAt,
    body,
    "mainImage": featuredImage.asset->url,
    "topics": topics[]->title
  }
`;

export const RECENT_POSTS_QUERY = groq`
  *[_type == "post" && publishedAt <= now()] | order(publishedAt desc)[0...5] {
    title,
    slug,
    description,
    tldr,
    publishedAt,
    "mainImage": featuredImage.asset->url,
    "topics": topics[]->title,
    estimatedReadingTime
  }
`;

export const ALL_EXPERIMENTS_QUERY = groq`
  *[_type == "experiment"] | order(startDate desc) {
    title,
    slug,
    summary,
    status,
    stack,
    "mainImage": architectureDiagram.asset->url
  }
`;

export const TOPIC_CLUSTERS_QUERY = groq`
  *[_type == "topic"] {
    title,
    slug,
    "icon": icon.asset->url
  }
`;
