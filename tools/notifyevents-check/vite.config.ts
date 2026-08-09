// Builds tools/notifyevents-check/check.ts into something node can run, so the
// notification catalogue can be verified without a browser or a test runner.
// Same shape as tools/appnav-check, and for the same reason: the check reads
// src/router/index.ts and (when it is there) the admin console's copy of the
// catalogue off disk, so node's own modules stay external rather than being
// bundled.
//
//   npm run check:notifyevents
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    lib: { entry: 'tools/notifyevents-check/check.ts', formats: ['es'], fileName: () => 'check.mjs' },
    outDir: 'tools/notifyevents-check/dist',
    emptyOutDir: true,
    minify: false,
    target: 'node20',
    rollupOptions: { external: [/^node:/] },
  },
});
