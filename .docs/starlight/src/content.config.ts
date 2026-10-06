import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { docsSchema } from '@astrojs/starlight/schema';

const docs = defineCollection({
  loader: glob({
    pattern: '*.md',
    base: new URL('../../', import.meta.url),
    generateId: ({ entry }) => {
      const id = entry.replace(/\.md$/, '').replace(/^\d+-/, '');
      return id === 'project' ? 'index' : id;
    },
  }),
  schema: docsSchema(),
});

export const collections = { docs };
