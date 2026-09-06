// Builds tools/i18n-check/check.ts into something node can run, so the three
// languages can be verified without a browser or a test runner. Same shape as
// tools/theme-check and tools/appnav-check: the check reads `src/` off disk to
// prove the catalogues and the source agree, so node's own modules stay
// external rather than being bundled.
//
//   npm run check:i18n
//   npm run check:i18n -- --gaps      # and print what is still untranslated
import { defineConfig } from 'vite';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  resolve: {
    // `fileURLToPath`, not `.pathname`. On Windows the latter answers
    // `/D:/SelfStudy%20Apps/...` — a leading slash and a percent-encoded
    // space — so the alias resolved to nothing and any `src/` module that
    // imports another through `@` was unloadable. Every other check here
    // already does it this way; this one only got away with it because
    // nothing it imported had reached for the alias yet.
    alias: { '@': fileURLToPath(new URL('../../src', import.meta.url)) },
  },
  build: {
    lib: { entry: 'tools/i18n-check/check.ts', formats: ['es'], fileName: () => 'check.mjs' },
    outDir: 'tools/i18n-check/dist',
    emptyOutDir: true,
    minify: false,
    target: 'node20',
    rollupOptions: { external: [/^node:/] },
  },
});
