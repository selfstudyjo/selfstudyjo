// Builds tools/liveturns-check/check.ts into something node can run, so live
// interview turn-taking can be verified without a microphone, a speaker or a
// person willing to talk over an interviewer on purpose.
// Same shape as tools/answeredit-check.
//
//   npm run check:liveturns
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    lib: { entry: 'tools/liveturns-check/check.ts', formats: ['es'], fileName: () => 'check.mjs' },
    outDir: 'tools/liveturns-check/dist',
    emptyOutDir: true,
    minify: false,
    target: 'node20',
    rollupOptions: { external: [/^node:/] },
  },
});
