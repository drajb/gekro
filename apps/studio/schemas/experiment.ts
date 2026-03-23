import { defineType, defineField } from 'sanity';

export default defineType({
  name: 'experiment',
  title: 'Experiment',
  type: 'document',
  fields: [
    defineField({ name: 'title', type: 'string' }),
    defineField({ name: 'slug', type: 'slug', options: { source: 'title' } }),
    defineField({ name: 'summary', type: 'text' }),
    defineField({
      name: 'status',
      type: 'string',
      options: { list: ['active', 'completed', 'archived'] }
    }),
    defineField({ name: 'startDate', type: 'date' }),
    defineField({ name: 'stack', type: 'array', of: [{ type: 'string' }] }),
    defineField({ name: 'architectureDiagram', type: 'image' }),
    defineField({ name: 'body', type: 'array', of: [{type: 'block'}, {type: 'image'}] }),
    defineField({ name: 'githubUrl', type: 'url' }),
    defineField({ name: 'demoUrl', type: 'url' }),
    defineField({ name: 'topics', type: 'array', of: [{ type: 'reference', to: [{ type: 'topic' }] }] }),
    defineField({ name: 'outcomes', type: 'array', of: [{type: 'block'}] }),
    defineField({ name: 'aiSummary', type: 'text' })
  ]
});
