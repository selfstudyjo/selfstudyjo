// A browser preview of the PLAYGROUNDS - the top bar's menu, /playgrounds and
// one /playground/:id - against a REAL local app 11.
//
//   cd ../selfstudyuserlab && python _portal_server.py --port 5311
//   npx vite --config tools/playgrounds-preview/vite.config.ts --port 3340
//   http://127.0.0.1:3340/?view=index|menu|play&id=play-aws&api=http://127.0.0.1:5311
//
// Only the registry, the HTTP client and the auth store are stubbed: the views,
// the TopBar, LabWorkspace, every portal, labs.css and the theme are the real
// ones, and every request reaches the real engines (no fixture to drift from).
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import path from 'path';

const root = path.resolve(__dirname, '../..');

export default defineConfig({
  root: __dirname,
  base: './',
  plugins: [vue(), {
    // labs.service.ts (and only it) imports `./api` and `./config` RELATIVELY, which no
    // alias sees - so they are redirected by resolved path, or every request
    // would go through the real registry and the real token.
    name: 'sfs-playgrounds-stubs',
    enforce: 'pre',
    resolveId(source: string, importer?: string) {
      if (!importer || !/labs\.service\.ts$/.test(importer.split('?')[0])) return null;
      if (source === './api') return path.resolve(__dirname, 'stubs/api.ts');
      if (source === './config') return path.resolve(__dirname, 'stubs/config.ts');
      return null;
    },
  }],
  resolve: {
    alias: [
      { find: '@/services/config', replacement: path.resolve(__dirname, 'stubs/config.ts') },
      { find: '@/services/api', replacement: path.resolve(__dirname, 'stubs/api.ts') },
      { find: '@/services/lab.service', replacement: path.resolve(__dirname, '../labs-preview/stubs/lab.ts') },
      { find: '@/services/lab-ai.service', replacement: path.resolve(__dirname, '../labs-preview/stubs/labai.ts') },
      { find: '@/store/auth', replacement: path.resolve(__dirname, '../labs-preview/stubs/auth.ts') },
      { find: '@', replacement: path.resolve(root, 'src') },
    ],
  },
  build: { outDir: path.resolve(__dirname, 'dist'), emptyOutDir: true },
  server: { host: '127.0.0.1' },
});
