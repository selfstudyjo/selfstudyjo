// Builds tools/actors-check/check.ts into something node can run, so the cast
// registry and the twelve files it names can be verified without a browser.
// Same shape as tools/appnav-check, with two additions:
//
//   * `resolve.alias` for `@`, because src/cast/actors.ts imports the newscast
//     engine's voice-name table rather than keeping a second copy of it, and
//     that import is written the way the app writes it.
//   * node's own modules stay external: this check READS the assets and the
//     sibling modules off disk, which is the only way to prove that every clip
//     and still really is the same square and that no filename has drifted.
//
//   npm run check:actors
import path from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(__dirname, '../../src') },
  },
  build: {
    lib: { entry: 'tools/actors-check/check.ts', formats: ['es'], fileName: () => 'check.mjs' },
    outDir: 'tools/actors-check/dist',
    emptyOutDir: true,
    minify: false,
    target: 'node20',
    rollupOptions: { external: [/^node:/] },
  },
});
