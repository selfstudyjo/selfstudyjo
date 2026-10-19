// Builds tools/interviewreport-check/check.ts into something node can run, so the
// downloadable interview report (model, DOCX, PDF container) can be verified
// without a browser. Same shape as tools/interview-check.
//
//   npm run check:interviewreport
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    lib: { entry: 'tools/interviewreport-check/check.ts', formats: ['es'], fileName: () => 'check.mjs' },
    outDir: 'tools/interviewreport-check/dist',
    emptyOutDir: true,
    minify: false,
    target: 'node20',
    rollupOptions: { external: [/^node:/] },
  },
});
