// Builds tools/newscast-check/check.ts into something node can run, so the
// newscast's running order, bed policy and voice casting can be verified without
// a browser. Same shape as tools/chatmedia-check and tools/drawengine-check.
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
  },
});
