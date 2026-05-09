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

  server: {
    port: 3000,
    host: true,
    proxy: {
      '/media1': {
        target: 'https://selfstudymedia1.pythonanywhere.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/media1/, ''),
      },
      '/media2': {
        target: 'https://selfstudymedia2.pythonanywhere.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/media2/, ''),
      },
    },
  },
})