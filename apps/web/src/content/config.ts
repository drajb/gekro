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
    mainImage: z.string().optional(),
  }),
});
const experiments = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    description: z.string(),
    summary: z.string(),
    aiSummary: z.string().optional(),
    status: z.enum(['active', 'completed', 'archived']),
    startDate: z.string(),
    stack: z.array(z.string()),
    topics: z.array(z.string()),
    githubUrl: z.string().optional(),
    demoUrl: z.string().optional(),
    difficulty: z.enum(['Beginner', 'Intermediate', 'Advanced']),
  }),
});

export const collections = { blog, experiments };
