// Builds tools/interview-check/check.ts into something node can run, so the Job
// Interview setup model can be verified without a browser.
// Same shape as tools/proctorqueue-check.
//
//   npm run check:interview
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    lib: { entry: 'tools/interview-check/check.ts', formats: ['es'], fileName: () => 'check.mjs' },
    outDir: 'tools/interview-check/dist',
    emptyOutDir: true,
    minify: false,
    target: 'node20',
    rollupOptions: { external: [/^node:/] },
  },
});
