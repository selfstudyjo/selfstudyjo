// Builds tools/examshuffle-check/check.ts into something node can run, so the
// answer-ordering rules can be verified without a browser.
// Same shape as tools/proctorqueue-check.
//
//   npm run check:examshuffle
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    lib: { entry: 'tools/examshuffle-check/check.ts', formats: ['es'], fileName: () => 'check.mjs' },
    outDir: 'tools/examshuffle-check/dist',
    emptyOutDir: true,
    minify: false,
    target: 'node20',
    rollupOptions: { external: [/^node:/] },
  },
});
