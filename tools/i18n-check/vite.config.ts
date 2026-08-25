// Builds tools/i18n-check/check.ts into something node can run, so the three
// languages can be verified without a browser or a test runner. Same shape as
// tools/theme-check and tools/appnav-check: the check reads `src/` off disk to
// prove the catalogues and the source agree, so node's own modules stay
// external rather than being bundled.
//
//   npm run check:i18n
//   npm run check:i18n -- --gaps      # and print what is still untranslated
import { defineConfig } from 'vite';

export default defineConfig({
  resolve: {
    alias: { '@': new URL('../../src', import.meta.url).pathname },
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
