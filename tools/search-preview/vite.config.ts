// A browser preview of the top bar's SITE SEARCH with the network stubbed.
//
//   npm run preview:search                 (then open the printed URL)
//   npm run build:search-preview && node tools/search-preview/shoot.mjs
//
// The search needs four services and an account to look at anything, so the
// only way to see it - in Arabic, in a light galaxy, on a phone, with a service
// down - is here. Only the transport is fake: see stubs/api.ts.
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import path from 'path';

const root = path.resolve(__dirname, '../..');
const stub = (name: string) => path.resolve(__dirname, `stubs/${name}.ts`);

export default defineConfig({
  root: __dirname,
  base: './',
  plugins: [vue(), {
    // The services import `./api` and `./config` RELATIVELY, which no alias
    // sees - redirected by resolved path, or a request would reach the real
    // registry with the real token (playgrounds-preview's lesson).
    name: 'sfs-search-stubs',
    enforce: 'pre',
    resolveId(source: string, importer?: string) {
      if (!importer || !/[\\/]src[\\/]services[\\/]/.test(importer)) return null;
      if (source === './api') return stub('api');
      if (source === './config') return stub('config');
      return null;
    },
  }],
  resolve: {
    alias: [
      // Order matters: `@` is a prefix of all of these.
      { find: '@/services/api', replacement: stub('api') },
      { find: '@/services/config', replacement: stub('config') },
      { find: '@/store/auth', replacement: stub('auth') },
      { find: '@', replacement: path.resolve(root, 'src') },
    ],
  },
  build: { outDir: path.resolve(__dirname, 'dist'), emptyOutDir: true },
  server: { port: 3350, host: '127.0.0.1' },
});
