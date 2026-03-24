import type { APIRoute } from 'astro';
import { getAllPosts } from '../../lib/utils/posts';

// Fix #9: Falls back to local content collections instead of fabricated mock data
export const GET: APIRoute = async () => {
  const posts = await getAllPosts();

  return new Response(JSON.stringify(posts), {
    status: 200,
    headers: {
      "Content-Type": "application/json"
    }
  });
};
