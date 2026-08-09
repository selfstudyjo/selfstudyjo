// Builds tools/linkify-check/check.ts into something node can run, so the
// escaping and URL-recognition rules can be verified without a browser.
// Same shape as tools/chatmedia-check.
//
//   npm run check:linkify
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    lib: { entry: 'tools/linkify-check/check.ts', formats: ['es'], fileName: () => 'check.mjs' },
    outDir: 'tools/linkify-check/dist',
    emptyOutDir: true,
    minify: false,
    target: 'node20',
    rollupOptions: { external: [/^node:/] },
  },
});
