import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import type { APIContext } from 'astro';

export async function GET(context: APIContext) {
  const posts = await getCollection('blog');
  
  const sortedPosts = posts.sort(
    (a, b) => new Date(b.data.publishedAt).getTime() - new Date(a.data.publishedAt).getTime()
  );

  return rss({
    title: 'gekro | AI Engineering Lab',
    description: "Personal engineering lab by Rohit. Deep dives into agentic AI, self-hosting, and building at the edge.",
    site: context.site ?? 'https://gekro.com',
    items: sortedPosts.map(post => ({
      title: post.data.title,
      pubDate: new Date(post.data.publishedAt),
      description: post.data.description,
      link: `/blog/${post.slug}`,
      categories: post.data.topics,
    })),
    customData: `<language>en-us</language>`,
  });
}
