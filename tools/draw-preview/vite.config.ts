// A browser preview of the Drawing Papers page with the network stubbed.
//
//   npm run preview:draw          (then open the printed URL)
//   npm run shoot:draw
//
// WHY THIS EXISTS
//
// `/draw` carries `requiresAuth: true` and needs a warm app 34, so it is one of
// the screens `audit:rtl` cannot reach — its eight routes are the ones that
// render without an account. That is exactly how it came to ship with card
// titles that did not appear at all: `.card` was `--sfs-paper` (light in all
// ten galaxies) and `h3` was `--sfs-text` (WHITE in the seven dark ones), and
// no check on this platform can see a colour pair on a rendered card.
//
// Same shape as `tools/home-preview` and `tools/tools-preview`. Only the
// service and the auth store are aliased away; the view, its stylesheet, the
// theme system, `ui.css` and the real background are all the real ones, so
// what is on screen is what a student gets.
//
//   ?theme=<id>     any of the ten galaxies. The bug was invisible in a light
//                   one and total in a dark one, so BOTH have to be looked at
//   ?lang=ar        the grid, the tag row and a paper title in Arabic
//   ?empty=1        the day-one state, which is the first thing a new user sees
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
      /*
        Order matters, and getting it wrong is silent: `@/…` is a prefix of
        every path below it, so a bare `@` declared first would swallow both
        and the preview would quietly reach the real registry — which on a cold
        replica means a 20-second wait and then an empty page that looks
        exactly like the stub working.
      */
      { find: '@/services/draw.service', replacement: path.resolve(__dirname, 'stubs/draw.ts') },
      { find: '@/store/auth', replacement: path.resolve(__dirname, 'stubs/auth.ts') },
      { find: '@', replacement: path.resolve(root, 'src') },
    ],
  },
  build: { outDir: path.resolve(__dirname, 'dist'), emptyOutDir: true },
  server: { port: 3314, host: true },
});
