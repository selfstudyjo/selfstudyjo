// Builds tools/speechcapture-check/check.ts into something node can run, so the
// answer microphone's speech detection and segmentation can be verified
// without a browser. Same shape as tools/interview-check.
//
//   npm run check:speechcapture
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    lib: { entry: 'tools/speechcapture-check/check.ts', formats: ['es'], fileName: () => 'check.mjs' },
    outDir: 'tools/speechcapture-check/dist',
    emptyOutDir: true,
    minify: false,
    target: 'node20',
    rollupOptions: { external: [/^node:/] },
  },
});
