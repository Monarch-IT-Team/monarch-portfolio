import { defineConfig } from 'astro/config';

// GitHub Pages project site: https://monarch-it.github.io/monarch-portfolio/
// When the repository is renamed to "monarch-it.github.io", delete the `base` line (and set SITE.base to '').
export default defineConfig({
  site: 'https://monarch-it.github.io',
  base: '/monarch-portfolio',
  build: { inlineStylesheets: 'auto' },
  vite: { build: { chunkSizeWarningLimit: 1000 } },
});
