// A browser preview of the Labs page with the sandbox stubbed.
//
//   npm run preview:tools        (then open the printed URL)
//   node tools/tools-preview/shoot.mjs
//
// WHY. `/labs` needs an account AND `lab_feature` on a live subscription AND a
// warm app 11 replica holding that student's workspace, so it is unreachable
// from `audit:rtl` and from any check. It went a long way in that state: this
// file's stylesheet was `@import`ed inside a `<style scoped>` block, so its
// `:root` token block became `:root[data-v-…]` and matched NOTHING — 51
// undefined custom properties and 300 fallback-less references to them, every
// one of those declarations invalid at computed value time. And all 40 of its
// icons were Font Awesome, which this app does not load. Both were invisible to
// every automated check and obvious the moment the page was looked at.
//
// Same shape as tools/home-preview. Only the service and the auth store are
// aliased; the view, lab.css and the theme system are the real ones.
//
//   ?tab=sql|linux|python   which sandbox
//   ?state=ok|loading|error|noaccess
//   ?theme=<id>   ?lang=ar
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
      { find: '@/services/lab.service', replacement: path.resolve(__dirname, 'stubs/lab.ts') },
      { find: '@/store/auth', replacement: path.resolve(__dirname, 'stubs/auth.ts') },
      { find: '@', replacement: path.resolve(root, 'src') },
    ],
  },
  build: { outDir: path.resolve(__dirname, 'dist'), emptyOutDir: true },
  server: { port: 3313, host: true },
});
