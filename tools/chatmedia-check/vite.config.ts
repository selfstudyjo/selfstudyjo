// Builds tools/chatmedia-check/check.ts into something node can run, so the
// chat's client-side compression maths can be verified without a browser or a test
// runner. Same shape as tools/photomask-check and tools/drawengine-check.
//
//   npm run check:chatmedia
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    lib: { entry: 'tools/chatmedia-check/check.ts', formats: ['es'], fileName: () => 'check.mjs' },
    outDir: 'tools/chatmedia-check/dist',
    emptyOutDir: true,
    minify: false,
    target: 'node20',
  },
});
