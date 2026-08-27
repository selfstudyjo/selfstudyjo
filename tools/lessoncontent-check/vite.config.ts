// Builds tools/lessoncontent-check/check.ts into something node can run, so the
// lesson write-up parser can be verified without a browser.
// Same shape as tools/examshuffle-check; the alias is here because the module
// imports `countWords` from src/i18n/locales.ts rather than keeping a second
// copy of the CJK character range (working rule 40).
//
//   npm run check:lessoncontent
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
    lib: { entry: 'tools/lessoncontent-check/check.ts', formats: ['es'], fileName: () => 'check.mjs' },
    outDir: 'tools/lessoncontent-check/dist',
    emptyOutDir: true,
    minify: false,
    target: 'node20',
    rollupOptions: { external: [/^node:/] },
  },
});
