// Builds tools/leaderboard-check/check.ts into something node can run, so the
// leaderboard's ranking model can be verified without a browser.
// Same shape as tools/proctorqueue-check.
//
//   npm run check:leaderboard
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    lib: { entry: 'tools/leaderboard-check/check.ts', formats: ['es'], fileName: () => 'check.mjs' },
    outDir: 'tools/leaderboard-check/dist',
    emptyOutDir: true,
    minify: false,
    target: 'node20',
    rollupOptions: { external: [/^node:/] },
  },
});
