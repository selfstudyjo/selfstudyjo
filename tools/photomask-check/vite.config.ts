// Builds tools/photomask-check/check.ts into something node can run, so the photo
// studio's segmentation maths can be verified without a browser or a test runner.
//
//   npm run check:photomask
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    lib: { entry: 'tools/photomask-check/check.ts', formats: ['es'], fileName: () => 'check.mjs' },
    outDir: 'tools/photomask-check/dist',
    emptyOutDir: true,
    minify: false,
    target: 'node20',
  },
});
