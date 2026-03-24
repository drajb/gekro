import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';

// Sanity integration is conditional — site works local-only without it
const sanityIntegration = [];
if (process.env.PUBLIC_SANITY_PROJECT_ID) {
  const sanity = (await import('@sanity/astro')).default;
  sanityIntegration.push(
    sanity({
      projectId: process.env.PUBLIC_SANITY_PROJECT_ID,
      dataset: process.env.PUBLIC_SANITY_DATASET || 'production',
      useCdn: false,
      apiVersion: '2024-03-22',
    })
  );
}

export default defineConfig({
  site: 'https://gekro.com',
  integrations: [
    ...sanityIntegration,
    sitemap({
      site: 'https://gekro.com'
    })
  ],
  vite: {
    plugins: [tailwindcss()],
  },
});
