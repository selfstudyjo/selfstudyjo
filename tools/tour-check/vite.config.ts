// Builds tools/tour-check/check.ts into something node can run, so the guided
// tour can be verified without a browser. Same shape as tools/practice-check.
//
//   npm run check:tour
import { defineConfig } from 'vite';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  // No vue() plugin: this check reads the .vue files as TEXT rather than
  // compiling them, because what it asserts about them is source rules - no
  // `v-html`, a Teleport, an Escape handler - and compiling three components to
  // grep them would be a slower way to get the same string.
  resolve: {
    alias: { '@': fileURLToPath(new URL('../../src', import.meta.url)) },
  },
  build: {
    lib: { entry: 'tools/tour-check/check.ts', formats: ['es'], fileName: () => 'check.mjs' },
    outDir: 'tools/tour-check/dist',
    emptyOutDir: true,
    minify: false,
    target: 'node20',
    rollupOptions: { external: [/^node:/] },
  },
});
