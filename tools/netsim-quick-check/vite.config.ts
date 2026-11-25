// Builds tools/netsim-quick-check/check.ts for node (npm run check:netsimquick).
//   npm run check:newscast
import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  // `src/utils/speechAudio.ts` imports the shaper through the `@` alias, and it
  // is pulled in here for the sample-domain level chain — the compressor, the
  // limiter and the tilt correction, all of which are plain arithmetic over a
  // Float32Array and therefore checkable in node.
  resolve: { alias: { '@': path.resolve(__dirname, '../../src') } },
  build: {
    lib: { entry: 'tools/netsim-quick-check/check.ts', formats: ['es'], fileName: () => 'check.mjs' },
    outDir: 'tools/netsim-quick-check/dist',
    emptyOutDir: true,
    minify: false,
    target: 'node20',
    rollupOptions: { external: [/^node:/] },
  },
});
