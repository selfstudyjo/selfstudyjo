// A browser preview of the read-aloud control and its transport bar.
//
//   npm run preview:reader                 (then open the printed URL)
//   npm run shoot:reader
//
// WHY. `check:reader` proves 190 decisions and can say nothing about a LAYOUT.
// The bar is a `position: fixed` overlay teleported to `<body>` with a wrapping
// flex row in it -- a title, a counter, four controls and a four-button speed
// picker -- and at 320px that does not fit on one line. An overlay that
// overflows is the one element on a page that can give the whole document
// sideways scroll, which is the fault `audit:rtl` exists to catch and which no
// amount of source reading finds.
//
// It cannot be reached any other way: the control lives on `/course/:id/lesson/
// :id`, `/runbooks/:id`, `/lab/:labId` and the Network Simulator, and three of
// those need an account, a subscription and a warm replica.
//
// THE SPEECH ENGINE IS STUBBED, NOT THE READER. `main.ts` installs a fake
// `speechSynthesis` on `window` and points `news.service` at a stub that reports
// no server voices, so `planSpeech` takes the platform route and the REAL
// composable runs: the real chunking, the real generation counter, the real
// keepalive, the real progress. Stubbing `useReader` instead would photograph a
// bar nothing drives, which is the mistake `tools/leaderboard-preview` made when
// it handed its view finished records a service never sends.
//
//   ?theme=<id>   ?lang=ar|zh   ?play=1   ?probe=1
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
      // The specific path first -- a bare `@` alias declared before it would
      // swallow it and the preview would reach the real registry and the real
      // app 36.
      { find: '@/services/news.service', replacement: path.resolve(__dirname, 'stubs/news.ts') },
      { find: '@', replacement: path.resolve(root, 'src') },
    ],
  },
  build: { outDir: path.resolve(__dirname, 'dist'), emptyOutDir: true },
  server: { port: 3315, host: true },
});
