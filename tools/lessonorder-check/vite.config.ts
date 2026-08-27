// Builds tools/lessonorder-check/check.ts into something node can run, so the
// lesson ordering can be verified without a browser or a network.
// Same shape as tools/lessoncontent-check.
//
//   npm run check:lessonorder
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
    lib: { entry: 'tools/lessonorder-check/check.ts', formats: ['es'], fileName: () => 'check.mjs' },
    outDir: 'tools/lessonorder-check/dist',
    emptyOutDir: true,
    minify: false,
    target: 'node20',
    rollupOptions: { external: [/^node:/] },
  },
});
