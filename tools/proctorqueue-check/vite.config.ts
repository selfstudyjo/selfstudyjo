// Builds tools/proctorqueue-check/check.ts into something node can run, so the
// proctor dashboard's ordering model can be verified without a browser.
// Same shape as tools/linkify-check.
//
//   npm run check:proctorqueue
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    lib: { entry: 'tools/proctorqueue-check/check.ts', formats: ['es'], fileName: () => 'check.mjs' },
    outDir: 'tools/proctorqueue-check/dist',
    emptyOutDir: true,
    minify: false,
    target: 'node20',
    rollupOptions: { external: [/^node:/] },
  },
});
