// Builds tools/appnav-check/check.ts into something node can run, so the
// sidebar's navigation registry can be verified without a browser or a test
// runner. Same shape as tools/drawengine-check, with one addition: the check
// reads src/router/index.ts and src/components/SideNav.vue off disk to prove
// the registry agrees with them, so node's own modules stay external rather
// than being bundled.
//
//   npm run check:appnav
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    lib: { entry: 'tools/appnav-check/check.ts', formats: ['es'], fileName: () => 'check.mjs' },
    outDir: 'tools/appnav-check/dist',
    emptyOutDir: true,
    minify: false,
    target: 'node20',
    rollupOptions: { external: [/^node:/] },
  },
});
