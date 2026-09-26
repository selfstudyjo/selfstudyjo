// Builds tools/netsim-i18n/extract.ts into something node can run, so the
// Network Simulator's compiled-in curriculum can be dumped as JSON for
// translation without a browser.
//
// Same shape as tools/labs-check. The netsim catalogue is TypeScript that
// imports the simulator's own types and helpers, so there is no way to read it
// with a regex that survives the next edit -- and a regex over positional
// `L(...)` arguments is exactly the kind of extractor that silently drops a
// lesson.
//
//   npm run netsim:extract
import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: {
    // fileURLToPath, not .pathname: this workspace lives under a path with a
    // space in it.
    alias: { '@': fileURLToPath(new URL('../../src', import.meta.url)) },
  },
  build: {
    lib: { entry: 'tools/netsim-i18n/extract.ts', formats: ['es'], fileName: () => 'extract.mjs' },
    outDir: 'tools/netsim-i18n/dist',
    emptyOutDir: true,
    minify: false,
    target: 'node20',
    rollupOptions: { external: [/^node:/] },
  },
});
