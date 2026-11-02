// Builds tools/roadmap-check/check.ts into something node can run, so the
// Roadmap Provider's layout and progress model can be verified without a
// browser. Same shape as tools/aichat-check.
//
//   npm run check:roadmap
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
    lib: { entry: 'tools/roadmap-check/check.ts', formats: ['es'], fileName: () => 'check.mjs' },
    outDir: 'tools/roadmap-check/dist',
    emptyOutDir: true,
    minify: false,
    target: 'node20',
    rollupOptions: { external: [/^node:/] },
  },
});
