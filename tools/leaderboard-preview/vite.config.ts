// A browser preview of the leaderboard with the network stubbed.
//
//   npm run preview:leaderboard        (then open the printed URL)
//
// `check:leaderboard` verifies the MODEL and cannot see the LAYOUT — a label
// collision, an overflowing card, a column that will not shrink. Those need a
// browser and a page full of awkward data, and the live backends give neither on
// demand. Only the service is aliased away; the view, the stylesheet, the chart
// component and the engine are the real ones.
//
// `?theme=<id>` renders any of the ten galaxies, which is how the charts get
// eyeballed in the light three as well as the dark seven.
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
      // Order matters: the more specific alias has to come first, or `@/…`
      // would swallow the service path and the preview would try to reach the
      // real registry.
      {
        find: '@/services/leaderboard.service',
        replacement: path.resolve(__dirname, 'stub.service.ts'),
      },
      { find: '@', replacement: path.resolve(root, 'src') },
    ],
  },
  build: { outDir: path.resolve(__dirname, 'dist'), emptyOutDir: true },
  server: { port: 3311, host: true },
});
