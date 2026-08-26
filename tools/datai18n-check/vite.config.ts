// Builds tools/datai18n-check/check.ts into something node can run, so the
// rules that decide which of a record's three titles a reader sees can be
// verified without a browser. Same shape as tools/leaderboard-check.
//
//   npm run check:datai18n
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    lib: { entry: 'tools/datai18n-check/check.ts', formats: ['es'], fileName: () => 'check.mjs' },
    outDir: 'tools/datai18n-check/dist',
    emptyOutDir: true,
    minify: false,
    target: 'node20',
    rollupOptions: { external: [/^node:/] },
  },
});
