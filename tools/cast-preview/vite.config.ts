// A browser preview of the 3D cast, with no backend and no account.
//
//   npm run preview:cast              (then open the printed URL)
//   node tools/cast-preview/shoot.mjs  (screenshots, at four framings)
//
// WHY THIS EXISTS
//
// `check:actors` verifies the MODEL — the proportions, the blink schedule, the
// jaw, the gestures — and cannot see a FACE. Whether the eyes read as eyes,
// whether the shoulders read as shoulders, and whether a mouth opening looks
// like speech are all questions only a rendered frame answers, and the two
// rooms that render the cast are both behind a login and a working app 27.
//
// So: the real `PersonStage`, the real figures, the real materials and the real
// animation, mounted on a page with nothing else on it. Three things it does
// that the app cannot:
//
//   * `?zoom=head` frames one face at a size where a modelling mistake is
//     visible. The meeting tile is ~180px; a wrong eyelid angle simply is not
//     legible at that size, which is how the first version shipped with the
//     eyes reading as two dark holes.
//   * a SPEAKING toggle, so the jaw, the brows and the gestures can be watched
//     without waiting for a language model.
//   * every figure at once, which is the only way to see that six people look
//     like six people rather than one model in six colours.
//
// Same shape and same reasons as `tools/leaderboard-preview`.
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
            { find: '@', replacement: path.resolve(root, 'src') },
        ],
    },
    build: { outDir: path.resolve(__dirname, 'dist'), emptyOutDir: true },
    server: { port: 3312, host: true },
});
