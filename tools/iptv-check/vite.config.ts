// Builds tools/iptv-check/check.ts into something node can run, so Self Study
// TV's browsing model can be verified without a browser.
// Same shape as tools/leaderboard-check.
//
//   npm run check:iptv
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    lib: { entry: 'tools/iptv-check/check.ts', formats: ['es'], fileName: () => 'check.mjs' },
    outDir: 'tools/iptv-check/dist',
    emptyOutDir: true,
    minify: false,
    target: 'node20',
    rollupOptions: { external: [/^node:/] },
  },
});
