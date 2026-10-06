import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

export default defineConfig({
  base: '/docs',
  outDir: new URL('../../docs/', import.meta.url),
  integrations: [
    starlight({
      title: 'Germes Bot',
      sidebar: [
        {
          label: 'Documentation',
          autogenerate: { directory: '.' },
        },
      ],
    }),
  ],
});
