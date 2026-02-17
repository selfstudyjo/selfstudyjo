import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'

export default defineConfig({
  plugins: [vue()],
                            base: '/',  // 👈 now always root – works for custom domain and local dev
                            resolve: {
                              alias: {
                                '@': path.resolve(__dirname, './src'),
                              },
                            },
                            server: {
                              port: 3000,
                            host: true
                            }
})
