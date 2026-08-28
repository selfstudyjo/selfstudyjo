// Builds tools/aichat-check/check.ts into something node can run, so the AI
// Chat room model and its Markdown renderer can be verified without a browser.
// Same shape as tools/lessoncontent-check.
//
//   npm run check:aichat
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
    lib: { entry: 'tools/aichat-check/check.ts', formats: ['es'], fileName: () => 'check.mjs' },
    outDir: 'tools/aichat-check/dist',
    emptyOutDir: true,
    minify: false,
    target: 'node20',
    rollupOptions: { external: [/^node:/] },
  },
});
