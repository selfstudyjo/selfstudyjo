import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'

export default defineConfig({
  plugins: [vue()],

  // Base path:
  // - '/' for custom domain (yourdomain.com) or username.github.io root
  // - '/repo-name/' for username.github.io/repo-name
  base: '/',

  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },

  // No /media proxy on purpose: the media backends send
  // `Access-Control-Allow-Origin: *`, so images load directly in dev exactly
  // as they do in production. A dev-only proxy here would hide prod CORS bugs.
  server: {
    port: 3000,
    host: true,
  },
})