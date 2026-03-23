import { defineType, defineField } from 'sanity';

export default defineType({
  name: 'post',
  title: 'Post',
  type: 'document',
  fields: [
    defineField({ name: 'title', type: 'string', validation: Rule => Rule.required() }),
    defineField({ name: 'slug', type: 'slug', options: { source: 'title' } }),
    defineField({ name: 'tldr', type: 'text', validation: Rule => Rule.required() }),
    defineField({ name: 'body', type: 'array', of: [{type: 'block'}, {type: 'image'}] }),
    defineField({ name: 'topics', type: 'array', of: [{ type: 'reference', to: [{ type: 'topic' }] }] }),
    defineField({
      name: 'type',
      type: 'string',
      options: { list: ['tutorial', 'lab-note', 'deep-dive', 'opinion', 'case-study'] }
    }),
    defineField({ name: 'publishedAt', type: 'datetime' }),
    defineField({ name: 'featuredImage', type: 'image', options: { hotspot: true } }),
    defineField({ name: 'seoTitle', type: 'string' }),
    defineField({ name: 'seoDescription', type: 'string' }),
    defineField({ name: 'aiSummary', type: 'text' }),
    defineField({ name: 'estimatedReadingTime', type: 'number' }),
    defineField({ name: 'featured', type: 'boolean' }),
    defineField({ name: 'linkedExperiment', type: 'reference', to: [{ type: 'experiment' }] })
  ]
});
