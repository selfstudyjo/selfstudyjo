// Builds tools/theme-check/check.ts into something node can run, so the ten
// galaxies can be verified without a browser or a test runner. Same shape as
// tools/appnav-check: the check reads src/assets/css off disk to prove the
// stylesheets and the token contract agree, so node's own modules stay
// external rather than being bundled.
//
//   npm run check:theme
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    lib: { entry: 'tools/theme-check/check.ts', formats: ['es'], fileName: () => 'check.mjs' },
    outDir: 'tools/theme-check/dist',
    emptyOutDir: true,
    minify: false,
    target: 'node20',
    rollupOptions: { external: [/^node:/] },
  },
});
