// Builds tools/labs-check/check.ts into something node can run, so the lab
// catalogue's model, the GUI panel spec and the web playground's document
// assembly can be verified without a browser.
//
// Same shape as tools/lessoncontent-check. The alias is here because the module
// under test imports nothing from src/ except types, but the CHECK reads several
// views and services off disk to assert what they never do — and those paths
// resolve through `@`.
//
//   npm run check:labs
import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: {
    // fileURLToPath, not .pathname: this workspace lives under a path with a
    // space in it, and .pathname hands back a percent-encoded string the
    // resolver cannot open.
    alias: { '@': fileURLToPath(new URL('../../src', import.meta.url)) },
  },
  build: {
    lib: { entry: 'tools/labs-check/check.ts', formats: ['es'], fileName: () => 'check.mjs' },
    outDir: 'tools/labs-check/dist',
    emptyOutDir: true,
    minify: false,
    target: 'node20',
    rollupOptions: { external: [/^node:/] },
  },
});
