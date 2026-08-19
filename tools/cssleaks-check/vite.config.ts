// Builds tools/cssleaks-check/check.ts into something node can run, so a page
// stylesheet that can cover another page's content fails the build.
// Same shape as tools/linkify-check.
//
//   npm run check:cssleaks
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    lib: { entry: 'tools/cssleaks-check/check.ts', formats: ['es'], fileName: () => 'check.mjs' },
    outDir: 'tools/cssleaks-check/dist',
    emptyOutDir: true,
    minify: false,
    target: 'node20',
    rollupOptions: { external: [/^node:/] },
  },
});
