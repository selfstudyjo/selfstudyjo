// Builds tools/answeredit-check/check.ts into something node can run, so the
// spoken-correction rules can be verified without a browser, a microphone or a
// person willing to say "sorry sorry" into one.
// Same shape as tools/interview-check.
//
//   npm run check:answeredit
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    lib: { entry: 'tools/answeredit-check/check.ts', formats: ['es'], fileName: () => 'check.mjs' },
    outDir: 'tools/answeredit-check/dist',
    emptyOutDir: true,
    minify: false,
    target: 'node20',
    rollupOptions: { external: [/^node:/] },
  },
});
