// Builds tools/reader-check/check.ts into something node can run, so the
// read-aloud decisions can be verified without a browser and without a voice.
//
// Same shape as tools/lessoncontent-check. The alias is needed because
// src/utils/reader.ts deliberately imports `blocks` from lessonContent and
// `sentences`/`speakable`/`estimateDurationMs` from the newscast engine rather
// than keeping a second copy of either (working rule 10 -- a second sentence
// splitter is a second place for the Chinese whitespace rule to be wrong).
//
//   npm run check:reader
import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: {
    // fileURLToPath, not .pathname: this workspace lives under a path with a
    // space in it, and .pathname hands back a percent-encoded string that the
    // resolver then cannot open.
    alias: { '@': fileURLToPath(new URL('../../src', import.meta.url)) },
  },
  build: {
    lib: { entry: 'tools/reader-check/check.ts', formats: ['es'], fileName: () => 'check.mjs' },
    outDir: 'tools/reader-check/dist',
    emptyOutDir: true,
    minify: false,
    target: 'node20',
    rollupOptions: { external: [/^node:/] },
  },
});
