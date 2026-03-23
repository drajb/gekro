import { defineCollection, z } from 'astro:content';

const blog = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    description: z.string(),
    summary: z.string().optional(),
    publishedAt: z.string(),
    difficulty: z.enum(['Beginner', 'Intermediate', 'Advanced']).default('Beginner'),
    topics: z.array(z.string()),
    readingTime: z.number().optional().default(5),
    tldr: z.string().optional(),
    // 2-sentence plain-text summary optimised for AI citation (GEO)
    // If missing, BlogLayout falls back to description
    aiSummary: z.string().optional(),
  }),
});

export const collections = { blog };
