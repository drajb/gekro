import { defineType, defineField } from 'sanity';

export default defineType({
  name: 'slideDeck',
  title: 'Slide Deck',
  type: 'document',
  fields: [
    defineField({ name: 'title', type: 'string' }),
    defineField({ name: 'slug', type: 'slug', options: { source: 'title' } }),
    defineField({ name: 'description', type: 'text' }),
    defineField({ name: 'presentationUrl', type: 'url' }),
    defineField({
      name: 'slides',
      type: 'array',
      of: [{
        type: 'object',
        fields: [
          { name: 'title', type: 'string' },
          { name: 'content', type: 'text' },
          { name: 'notes', type: 'text' },
          { name: 'image', type: 'image' }
        ]
      }]
    }),
    defineField({ name: 'topics', type: 'array', of: [{ type: 'reference', to: [{ type: 'topic' }] }] }),
    defineField({ name: 'publishedAt', type: 'datetime' }),
    defineField({ name: 'isPublic', type: 'boolean' })
  ]
});
