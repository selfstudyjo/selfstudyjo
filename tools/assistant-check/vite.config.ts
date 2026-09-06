// Builds tools/assistant-check/check.ts into something node can run, so Noor
// can be verified without a browser. Same shape as tools/tour-check.
//
//   npm run check:assistant
import { defineConfig } from 'vite';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  // No vue() plugin: the .vue files are read as TEXT rather than compiled,
  // because what is asserted about them is source rules - no `v-html`, a
  // Teleport, an Escape handler, a keepalive - and compiling three components
  // to grep them would be a slower way to get the same string.
  resolve: {
    alias: { '@': fileURLToPath(new URL('../../src', import.meta.url)) },
  },
  build: {
    lib: { entry: 'tools/assistant-check/check.ts', formats: ['es'], fileName: () => 'check.mjs' },
    outDir: 'tools/assistant-check/dist',
    emptyOutDir: true,
    minify: false,
    target: 'node20',
    rollupOptions: { external: [/^node:/] },
  },
});
