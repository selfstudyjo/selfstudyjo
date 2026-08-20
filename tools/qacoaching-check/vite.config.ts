// Builds tools/qacoaching-check/check.ts into something node can run, so the
// interview report's per-question block can be rendered without a browser.
//
//   npm run check:qacoaching
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [vue()],
  resolve: { alias: { '@': fileURLToPath(new URL('../../src', import.meta.url)) } },
  build: {
    lib: { entry: 'tools/qacoaching-check/check.ts', formats: ['es'], fileName: () => 'check.mjs' },
    outDir: 'tools/qacoaching-check/dist',
    emptyOutDir: true,
    minify: false,
    target: 'node20',
    rollupOptions: { external: [/^node:/, 'vue', '@vue/server-renderer'] },
  },
});
