// Builds tools/drawengine-check/check.ts into something node can run, so the
// drawing paper's geometry and ordering can be verified without a browser or a test
// runner. Same shape as tools/photomask-check.
//
//   npm run check:drawengine
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    lib: { entry: 'tools/drawengine-check/check.ts', formats: ['es'], fileName: () => 'check.mjs' },
    outDir: 'tools/drawengine-check/dist',
    emptyOutDir: true,
    minify: false,
    target: 'node20',
  },
});
