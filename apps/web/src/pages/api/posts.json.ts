import type { APIRoute } from 'astro';
import { client } from '../../lib/sanity/client';
import { ALL_POSTS_QUERY } from '../../lib/sanity/queries';

export const GET: APIRoute = async () => {
  let posts = [];
  try {
    posts = await client.fetch(ALL_POSTS_QUERY);
  } catch (e) {
    posts = [
        {
          title: 'The Future of Agentic Workflows',
          slug: { current: 'future-of-agentic-workflows' },
          tldr: 'Why the next shift in AI isn\'t better models, but better orchestration of small, specialized agents.',
          publishedAt: new Date().toISOString(),
          aiSummary: 'A discussion on the transition from monolithic AI models to distributed agentic systems.',
        }
    ];
  }

  return new Response(JSON.stringify(posts), {
    status: 200,
    headers: {
      "Content-Type": "application/json"
    }
  });
};
