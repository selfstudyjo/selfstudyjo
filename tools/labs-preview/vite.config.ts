// A browser preview of ONE LAB — `/lab/:labId` — with app 11 stubbed.
//
//   npm run preview:lab            (then open the printed URL)
//   node tools/labs-preview/shoot.mjs
//
// WHY. `/lab/:labId` needs an account AND `lab_feature` on a live subscription
// AND a warm app 11 replica holding that student's workspace, so it is
// unreachable from `audit:rtl`, from `check:labs` and from every other harness
// here. `check:labs` drives `labCatalogue.ts` in node and passes 341 assertions
// against a page whose web result pane, whose Network Simulator pane and whose
// Check-my-work button were all reported broken — because none of the three is
// a property of that module. This is the only thing that renders the workbench.
//
// Same shape as tools/tools-preview and tools/home-preview: only the services
// and the auth store are aliased; the view, its components, labs.css and the
// theme system are the real ones.
//
//   ?lab=web-01-html | net-01-addressing | docker-01-run   which lab
//   ?state=ok|loading|error|noaccess|gradefail
//   ?theme=<id>   ?lang=ar   ?probe=1
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
      // The specific paths first — a bare `@` alias declared before them would
      // swallow both and the preview would reach the real registry.
      { find: '@/services/labs.service', replacement: path.resolve(__dirname, 'stubs/labs.ts') },
      { find: '@/services/lab.service', replacement: path.resolve(__dirname, 'stubs/lab.ts') },
      { find: '@/services/lab-ai.service', replacement: path.resolve(__dirname, 'stubs/labai.ts') },
      { find: '@/store/auth', replacement: path.resolve(__dirname, 'stubs/auth.ts') },
      { find: '@', replacement: path.resolve(root, 'src') },
    ],
  },
  build: { outDir: path.resolve(__dirname, 'dist'), emptyOutDir: true },
  server: { port: 3314, host: true },
});
