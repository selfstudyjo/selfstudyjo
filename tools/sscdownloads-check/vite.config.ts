// Builds tools/sscdownloads-check/check.ts so the SelfStudyCode download picker can be
// verified without a browser.
//
//   npm run check:sscdownloads
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
    lib: { entry: 'tools/sscdownloads-check/check.ts', formats: ['es'], fileName: () => 'check.mjs' },
    outDir: 'tools/sscdownloads-check/dist',
    emptyOutDir: true,
    minify: false,
    target: 'node20',
    rollupOptions: { external: [/^node:/] },
  },
});
