// A browser preview of Noor's window with the network stubbed.
//
//   npm run preview:assistant     (then open the printed URL)
//   npm run shoot:assistant
//
// WHY THIS EXISTS
//
// Her window is a FIXED PANEL IN A CORNER with a 3D canvas in it, and this
// platform has already been bitten twice by exactly that shape: the support
// chat launcher sat on top of the collapsed sidebar in Arabic at every width
// from 1024px up, and the mobile drawer parked itself in the middle of the
// viewport for the whole life of `rtl.css`. Neither was visible in English and
// neither was visible in the source.
//
// `audit:rtl` cannot help: it drives eight public routes and has no way to
// PRESS the button, so the window is closed in every one of its screenshots.
// `check:assistant` proves the model and cannot see a panel. This is the only
// thing that looks at it.
//
//   ?theme=<id>     any of the ten galaxies
//   ?lang=ar|zh     the two that are not the one it was written in
//   ?state=busy     mid-answer, with the typing indicator up
//   ?state=live     listening, with the microphone button in its recording state
//   ?state=long     a long reply and a long question, which is where a bubble
//                   with an unbreakable id in it sets the panel's width
//   ?probe=1        the overflow report `shoot.mjs` reads back
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
        ORDER MATTERS, and getting it wrong is silent: `@/…` is a prefix of
        every path below it, so a bare `@` declared first would swallow all
        three and the preview would quietly reach the real registry — which on
        a cold replica is a 20-second wait and then an error bubble that looks
        exactly like the stub working.
      */
      { find: '@/services/assistant.service', replacement: path.resolve(__dirname, 'stubs/assistant.ts') },
      { find: '@/services/news.service', replacement: path.resolve(__dirname, 'stubs/news.ts') },
      { find: '@/store/auth', replacement: path.resolve(__dirname, 'stubs/auth.ts') },
      { find: '@', replacement: path.resolve(root, 'src') },
    ],
  },
  build: { outDir: path.resolve(__dirname, 'dist'), emptyOutDir: true },
  server: { port: 3314, host: true },
});
