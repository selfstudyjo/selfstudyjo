// A browser preview of Self Study TV with the network stubbed.
//
//   npm run preview:iptv        (then open the printed URL)
//
// `check:iptv` verifies the MODEL — the running order, the rails, the resume
// decisions, which tab a path belongs to — and can see nothing about the LAYOUT.
// "The style is bad, mixed blocks and text" is entirely a layout report, and the
// live pages are behind a login AND a working app 38, so there is no way to look
// at them on demand. This is that way.
//
// Only the service is aliased away. The views, the stylesheet, the card, the tab
// strip and the engine are the real ones, and the router is real too — which
// matters more here than on any other preview, because the tabs ARE routes and a
// harness with fake tabs would be testing fake tabs.
//
// `?theme=<id>` renders any of the ten galaxies.
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import path from 'path';

const root = path.resolve(__dirname, '../..');

export default defineConfig({
  root: __dirname,
  base: './',
  plugins: [vue()],
  resolve: {
    alias: [
      // Order matters: the more specific alias has to come first, or `@/…` would
      // swallow the service path and the preview would try to reach the real
      // registry.
      {
        find: '@/services/iptv.service',
        replacement: path.resolve(__dirname, 'stub.service.ts'),
      },
      { find: '@', replacement: path.resolve(root, 'src') },
    ],
  },
  build: { outDir: path.resolve(__dirname, 'dist'), emptyOutDir: true },
  server: { port: 3312, host: true },
});
