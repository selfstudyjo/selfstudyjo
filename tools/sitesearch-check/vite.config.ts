// Builds tools/sitesearch-check/check.ts into something node can run, so the
// site search's folding, scoring, ordering, locks and keyboard arithmetic can
// be verified without a browser. Same shape as tools/roadmap-check.
//
//   npm run check:sitesearch
import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: {
    // fileURLToPath, not .pathname: the workspace path has a space in it.
    alias: { '@': fileURLToPath(new URL('../../src', import.meta.url)) },
  },
  build: {
    lib: { entry: 'tools/sitesearch-check/check.ts', formats: ['es'], fileName: () => 'check.mjs' },
    outDir: 'tools/sitesearch-check/dist',
    emptyOutDir: true,
    minify: false,
    target: 'node20',
    rollupOptions: { external: [/^node:/] },
  },
});
