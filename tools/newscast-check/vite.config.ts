// Builds tools/newscast-check/check.ts into something node can run, so the
// newscast's running order, bed policy and voice casting can be verified without
// a browser. Same shape as tools/chatmedia-check and tools/drawengine-check,
// with the same addition tools/appnav-check needs: the check reads the engine
// off disk to assert a property of the SOURCE (no lookbehind, which is a
// parse-time crash on Safari < 16.4 and therefore invisible once bundled), so
// node's own modules stay external rather than being stubbed for the browser.
//
//   npm run check:newscast
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    lib: { entry: 'tools/newscast-check/check.ts', formats: ['es'], fileName: () => 'check.mjs' },
    outDir: 'tools/newscast-check/dist',
    emptyOutDir: true,
    minify: false,
    target: 'node20',
    rollupOptions: { external: [/^node:/] },
  },
});
