// Builds tools/products-check/check.ts into something node can run, so the SelfStudy
// Products download picker and tab parsing can be verified without a browser.
// Replaces tools/sscdownloads-check.
//
//   npm run check:products
import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: {
    // fileURLToPath, not .pathname: this workspace lives under a path with a
    // space in it, and .pathname hands back a percent-encoded string that the
    // resolver then cannot open.
    alias: { '@': fileURLToPath(new URL('../../src', import.meta.url)) },
  },
  build: {
    lib: { entry: 'tools/products-check/check.ts', formats: ['es'], fileName: () => 'check.mjs' },
    outDir: 'tools/products-check/dist',
    emptyOutDir: true,
    minify: false,
    target: 'node20',
    rollupOptions: { external: [/^node:/] },
  },
});
