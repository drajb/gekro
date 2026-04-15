/**
 * api/posts.json.ts — Public JSON API endpoint (GET /api/posts.json)
 *
 * Returns the full merged post list (local Content Collections + Sanity)
 * as a JSON array. Consumed by:
 *  - External tooling that wants structured post metadata
 *  - SearchWidget client-side search as a data source
 *  - Any future integrations needing programmatic post access
 *
 * Uses getAllPosts() from lib/utils/posts.ts — the single source of truth
 * for the merged, sorted post list. Do not duplicate the fetch logic here.
 *
 * Response:
 *  200 application/json — array of FormattedPost objects, newest-first.
 *  The shape mirrors what PostCard and blog pages consume.
 */

import type { APIRoute } from 'astro';
import { getAllPosts } from '../../lib/utils/posts';

export const GET: APIRoute = async () => {
  // getAllPosts() merges local + Sanity, sorts newest-first, normalises topics
  const posts = await getAllPosts();

  return new Response(JSON.stringify(posts), {
    status: 200,
    headers: {
      "Content-Type": "application/json"
    }
  });
};
