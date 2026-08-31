// A browser preview of the dashboard with the network stubbed.
//
//   npm run preview:home          (then open the printed URL)
//   node tools/home-preview/shoot.mjs
//
// WHY THIS EXISTS
//
// `/` is `requiresAuth: true`, so the dashboard is the one screen on this
// platform that cannot be looked at without an account and five live backends —
// which is why it went years with its welcome banner, its five list cards and no
// single number on it. Every layout fault on it is therefore invisible to
// `audit:rtl` (eight public routes) and to every check in the suite: a check can
// prove a model and cannot see a card.
//
// Same shape as `tools/leaderboard-preview`, and for the same reason. Only the
// five services and the auth store are aliased away; the view, its stylesheet,
// the `.sfs-*` kit, the theme system, `ui.css` and `dashboardProgress.ts` are
// all the real ones, so what is on screen is what a learner gets.
//
//   ?empty=1        the day-one state — no courses, no quizzes, locked badges
//   ?theme=<id>     any of the ten galaxies, which is the only way to see the
//                   score ring and the badge tiers in the three light ones
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
        Order matters, and getting it wrong is silent: `@/…` is a prefix of every
        path below it, so a bare `@` alias declared first would swallow all five
        and the preview would quietly reach the real registry — which on a cold
        replica means a 20-second wait and then a page of empty states that look
        exactly like the stub working.
      */
      { find: '@/services/course.service', replacement: path.resolve(__dirname, 'stubs/course.ts') },
      { find: '@/services/certificate.service', replacement: path.resolve(__dirname, 'stubs/certificate.ts') },
      { find: '@/services/quiz.service', replacement: path.resolve(__dirname, 'stubs/quiz.ts') },
      { find: '@/services/subscription.service', replacement: path.resolve(__dirname, 'stubs/subscription.ts') },
      { find: '@/services/exam.service', replacement: path.resolve(__dirname, 'stubs/exam.ts') },
      { find: '@/store/auth', replacement: path.resolve(__dirname, 'stubs/auth.ts') },
      { find: '@', replacement: path.resolve(root, 'src') },
    ],
  },
  build: { outDir: path.resolve(__dirname, 'dist'), emptyOutDir: true },
  server: { port: 3312, host: true },
});
